import { NextRequest, NextResponse } from 'next/server'
import { OAuth2Client } from 'google-auth-library'
import {
  isAudiusEmail,
  createSessionToken,
  getSessionCookieName,
  getSessionCookieOptions,
} from '@/lib/auth'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID

export async function POST(request: NextRequest) {
  if (!GOOGLE_CLIENT_ID) {
    return NextResponse.json(
      { error: 'Google OAuth not configured' },
      { status: 500 }
    )
  }

  let body: { token?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const token = body.token
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  }

  const client = new OAuth2Client(GOOGLE_CLIENT_ID)
  let payload: { email?: string; name?: string }
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID,
    })
    payload = ticket.getPayload() ?? {}
  } catch (e) {
    console.error('Google token verification failed:', e)
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  const email = payload.email
  if (!email || !payload.name) {
    return NextResponse.json({ error: 'Missing email or name' }, { status: 401 })
  }

  if (!isAudiusEmail(email)) {
    return NextResponse.json(
      { error: 'Only @audius.co and @audius.org accounts can access this dashboard' },
      { status: 403 }
    )
  }

  const sessionToken = await createSessionToken(email, payload.name)
  const cookieOptions = getSessionCookieOptions()
  const res = NextResponse.json({ email, name: payload.name }, { status: 201 })
  res.cookies.set(getSessionCookieName(), sessionToken, cookieOptions)
  return res
}
