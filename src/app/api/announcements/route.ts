import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { Announcement } from '@/lib/supabase/types'

export async function GET() {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false })
    .returns<Announcement[]>()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdmin()
  const formData = await request.formData()

  const internal_label = formData.get('internal_label') as string
  const heading = formData.get('heading') as string
  const body = formData.get('body') as string
  const cta_link = (formData.get('cta_link') as string) || null
  const status = (formData.get('status') as string) || 'draft'
  const created_by = (formData.get('created_by') as string) || 'Unknown'

  const csvFile = formData.get('csv') as File | null
  const imageFile = formData.get('image') as File | null

  let audience_csv_url: string | null = null
  let audience_csv_filename: string | null = null
  let audience_size = 0
  let invalid_rows = 0

  const recipientUserIds: number[] = []
  if (csvFile && csvFile.size > 0) {
    const csvText = await csvFile.text()
    const lines = csvText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    audience_csv_filename = csvFile.name

    const { data: upload, error: uploadError } = await supabase.storage
      .from('uploads')
      .upload(`csv/${Date.now()}_${csvFile.name}`, csvFile, {
        contentType: 'text/csv',
      })

    if (!uploadError && upload) {
      const { data: urlData } = supabase.storage
        .from('uploads')
        .getPublicUrl(upload.path)
      audience_csv_url = urlData.publicUrl
    }

    // Audius user IDs are numeric (blockchain user id)
    const validLines = lines.filter((l) => /^\d+$/.test(l))
    invalid_rows = lines.length - validLines.length
    audience_size = validLines.length
    validLines.forEach((l) => {
      const n = parseInt(l, 10)
      if (Number.isFinite(n)) recipientUserIds.push(n)
    })
  }

  // Sending requires recipients; reject create-as-ready when we have none
  if (status === 'ready' && recipientUserIds.length === 0) {
    return NextResponse.json(
      {
        error:
          'Upload a CSV with at least one user ID (one per line, numbers only) to send.',
      },
      { status: 400 }
    )
  }

  let image_url: string | null = null
  if (imageFile) {
    const { data: upload, error: uploadError } = await supabase.storage
      .from('uploads')
      .upload(`images/${Date.now()}_${imageFile.name}`, imageFile, {
        contentType: imageFile.type,
      })

    if (!uploadError && upload) {
      const { data: urlData } = supabase.storage
        .from('uploads')
        .getPublicUrl(upload.path)
      image_url = urlData.publicUrl
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('announcements')
    .insert({
      internal_label,
      heading,
      body,
      cta_link,
      status,
      created_by,
      image_url,
      audience_csv_url,
      audience_csv_filename,
      audience_size,
      invalid_rows,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (recipientUserIds.length > 0 && data?.id) {
    const recipients = recipientUserIds.map((user_id) => ({
      announcement_id: data.id,
      user_id,
    }))
    const uniq = Array.from(new Map(recipients.map((r) => [r.user_id, r])).values())
    const { error: recipientsError } = await (supabase as any)
      .from('announcement_recipients')
      .insert(uniq)
    if (recipientsError) {
      console.error('announcement_recipients insert failed:', recipientsError)
      return NextResponse.json(
        { error: `Saved announcement but failed to store recipients: ${recipientsError.message}. Ensure the announcement_recipients table exists.` },
        { status: 500 }
      )
    }
  }

  return NextResponse.json(data, { status: 201 })
}
