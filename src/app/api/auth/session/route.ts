import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ email: null, name: null }, { status: 200 })
  }
  return NextResponse.json({
    email: session.email,
    name: session.name ?? null,
  })
}
