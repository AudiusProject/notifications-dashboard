import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const COOKIE_NAME = 'notifications-dashboard-session'
const DEFAULT_MAX_AGE = 60 * 60 * 24 // 24 hours

export function isAudiusEmail(email: string | null | undefined): boolean {
  return (
    !!email &&
    (email.endsWith('@audius.co') || email.endsWith('@audius.org'))
  )
}

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SESSION_SECRET
  if (!secret || secret.length < 32) {
    throw new Error(
      'AUTH_SESSION_SECRET must be set and at least 32 characters (for JWT signing)'
    )
  }
  return new TextEncoder().encode(secret)
}

export type SessionUser = {
  email: string
  /** Google display name from login; missing on older cookies until re-login. */
  name?: string
}

/** Stable label for audit fields (announcements, etc.). */
export function displayNameFromSession(session: SessionUser): string {
  const fromName = session.name?.trim()
  if (fromName) return fromName
  const local = session.email.split('@')[0]?.trim()
  if (local) return local
  return 'Unknown'
}

export async function createSessionToken(
  email: string,
  name: string,
  maxAgeSeconds: number = DEFAULT_MAX_AGE
): Promise<string> {
  const secret = getSecret()
  const displayName = name.trim()
  return new SignJWT({
    email,
    ...(displayName ? { name: displayName } : {}),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(Math.floor(Date.now() / 1000) + maxAgeSeconds)
    .sign(secret)
}

export async function getSessionFromToken(
  token: string
): Promise<SessionUser | null> {
  try {
    const secret = getSecret()
    const { payload } = await jwtVerify(token, secret)
    const email = payload.email as string | undefined
    if (!email || !isAudiusEmail(email)) return null
    const name = payload.name as string | undefined
    return { email, ...(name?.trim() ? { name: name.trim() } : {}) }
  } catch {
    return null
  }
}

/** Use in Route Handlers: read session from request cookies. */
export async function getSessionFromRequest(
  request: { cookies: { get: (name: string) => { value: string } | undefined } }
): Promise<SessionUser | null> {
  const token = request.cookies.get(COOKIE_NAME)?.value
  if (!token) return null
  return getSessionFromToken(token)
}

/** Use in Server Components / server code: read session from Next cookies(). */
export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  return getSessionFromToken(token)
}

export function getSessionCookieName(): string {
  return COOKIE_NAME
}

export function getSessionCookieOptions(maxAgeSeconds: number = DEFAULT_MAX_AGE) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: maxAgeSeconds,
    path: '/',
  }
}
