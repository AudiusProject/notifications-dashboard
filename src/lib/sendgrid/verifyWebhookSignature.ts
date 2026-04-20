import crypto from 'node:crypto'

/**
 * Verifies a SendGrid Event Webhook request using the ECDSA public key
 * configured in `SENDGRID_WEBHOOK_PUBLIC_KEY` (base64-encoded SPKI DER).
 *
 * Per SendGrid docs: signature is over `timestamp + rawBody` (string concat,
 * UTF-8), signed with ECDSA P-256 + SHA-256, signature is base64 DER.
 *
 * https://www.twilio.com/docs/sendgrid/for-developers/tracking-events/getting-started-event-webhook-security-features
 */

const SIGNATURE_HEADER = 'x-twilio-email-event-webhook-signature'
const TIMESTAMP_HEADER = 'x-twilio-email-event-webhook-timestamp'

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: string }

let cachedKey: crypto.KeyObject | null = null

function loadPublicKey(): crypto.KeyObject | null {
  if (cachedKey) return cachedKey
  const b64 = process.env.SENDGRID_WEBHOOK_PUBLIC_KEY?.trim()
  if (!b64) return null
  try {
    cachedKey = crypto.createPublicKey({
      key: Buffer.from(b64, 'base64'),
      format: 'der',
      type: 'spki',
    })
    return cachedKey
  } catch {
    return null
  }
}

export function sendgridWebhookConfigured(): boolean {
  return Boolean(process.env.SENDGRID_WEBHOOK_PUBLIC_KEY?.trim())
}

export function verifySendgridSignature(
  headers: Headers,
  rawBody: string
): VerifyResult {
  const key = loadPublicKey()
  if (!key) {
    return { ok: false, reason: 'SENDGRID_WEBHOOK_PUBLIC_KEY not set or invalid' }
  }
  const signature = headers.get(SIGNATURE_HEADER)
  const timestamp = headers.get(TIMESTAMP_HEADER)
  if (!signature || !timestamp) {
    return { ok: false, reason: 'Missing signature or timestamp header' }
  }
  // Reject clock skew > 10 min (replay protection).
  const ts = Number(timestamp)
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 600) {
    return { ok: false, reason: 'Timestamp out of tolerance' }
  }
  try {
    const payload = Buffer.from(timestamp + rawBody, 'utf8')
    const sig = Buffer.from(signature, 'base64')
    const ok = crypto.verify('sha256', payload, key, sig)
    return ok ? { ok: true } : { ok: false, reason: 'Signature mismatch' }
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) }
  }
}
