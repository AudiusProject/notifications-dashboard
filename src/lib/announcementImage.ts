import type { SupabaseClient } from '@supabase/supabase-js'

import {
  UPLOADS_BUCKET,
  formatStorageUploadError,
} from '@/lib/supabaseStorage'

export const MAX_ANNOUNCEMENT_IMAGE_BYTES = 2 * 1024 * 1024

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
])

export function assertAnnouncementImageFile(file: File): void {
  if (file.size > MAX_ANNOUNCEMENT_IMAGE_BYTES) {
    throw new Error('Image must be 2MB or smaller')
  }
  const type = file.type || ''
  if (!ALLOWED_IMAGE_TYPES.has(type)) {
    throw new Error('Image must be JPEG, PNG, GIF, or WebP')
  }
}

/**
 * Rich push (APNs / FCM) needs a URL their backends can fetch over HTTPS.
 */
export function parsePublicHttpsImageUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) {
    throw new Error('Image URL is empty')
  }
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    throw new Error('Invalid image URL')
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('Image URL must use https://')
  }
  if (!parsed.hostname) {
    throw new Error('Image URL must include a hostname')
  }
  return trimmed
}

function sanitizeFilename(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120)
  return base.length > 0 ? base : 'image'
}

/**
 * Upload to Supabase Storage (`uploads` bucket) and return the public HTTPS URL.
 * Ephemeral push imagery is fine — bucket should allow public read on this path.
 */
export async function uploadAnnouncementImageFile(
  supabase: SupabaseClient,
  file: File
): Promise<string> {
  assertAnnouncementImageFile(file)

  const path = `images/announcements/${Date.now()}_${sanitizeFilename(file.name)}`
  const { data: upload, error: uploadError } = await supabase.storage
    .from(UPLOADS_BUCKET)
    .upload(path, file, {
      contentType: file.type || 'application/octet-stream',
    })

  if (uploadError || !upload) {
    throw new Error(formatStorageUploadError(uploadError?.message, 'image'))
  }

  const { data: urlData } = supabase.storage
    .from(UPLOADS_BUCKET)
    .getPublicUrl(upload.path)

  const url = urlData.publicUrl
  try {
    return parsePublicHttpsImageUrl(url)
  } catch {
    throw new Error(
      'Supabase returned a non-https image URL. Ensure the uploads bucket is public over HTTPS.'
    )
  }
}
