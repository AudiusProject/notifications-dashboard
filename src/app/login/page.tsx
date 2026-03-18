'use client'

import { useCallback, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google'
import type { CredentialResponse } from '@react-oauth/google'

const messages = {
  title: 'Audius Notifications Dashboard',
  signIn: 'Sign in with Google',
  hint: 'Only @audius.co and @audius.org accounts can access this dashboard.',
  error: 'Login failed. Use an Audius Google account.',
}

const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? ''

function LoginForm() {
  const searchParams = useSearchParams()
  const from = searchParams.get('from') ?? '/'
  const [error, setError] = useState<string | null>(null)

  const handleSuccess = useCallback(
    async (credentialResponse: CredentialResponse) => {
      setError(null)
      const token = credentialResponse.credential
      if (!token) {
        setError(messages.error)
        return
      }
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
        credentials: 'include',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError((data.error as string) ?? messages.error)
        return
      }
      window.location.href = from
    },
    [from]
  )

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-100">
      <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-lg font-semibold text-neutral-900">
            {messages.title}
          </h1>
          <p className="mt-2 text-sm text-neutral-500">{messages.hint}</p>
        </div>
        <div className="flex justify-center">
          <GoogleLogin
            onSuccess={handleSuccess}
            onError={() => setError(messages.error)}
            useOneTap={false}
          />
        </div>
        {error ? (
          <p className="mt-4 text-center text-sm text-red-600">{error}</p>
        ) : null}
      </div>
    </div>
  )
}

export default function LoginPage() {
  if (!clientId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-100">
        <p className="text-neutral-600">
          Google OAuth is not configured (NEXT_PUBLIC_GOOGLE_CLIENT_ID missing).
        </p>
      </div>
    )
  }

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center bg-neutral-100">
            <p className="text-neutral-600">Loading…</p>
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </GoogleOAuthProvider>
  )
}
