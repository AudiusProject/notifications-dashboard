import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSessionFromToken, getSessionCookieName } from '@/lib/auth'

const LOGIN_PATH = '/login'
const AUTH_API_PREFIX = '/api/auth'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get(getSessionCookieName())?.value

  const session = token ? await getSessionFromToken(token) : null

  if (pathname.startsWith(AUTH_API_PREFIX)) {
    return NextResponse.next()
  }

  if (pathname === LOGIN_PATH) {
    if (session) {
      return NextResponse.redirect(new URL('/', request.url))
    }
    return NextResponse.next()
  }

  if (!session) {
    const loginUrl = new URL(LOGIN_PATH, request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
