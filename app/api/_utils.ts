import { NextResponse } from 'next/server'

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init)
}

export function getBearerToken(request: Request) {
  const header = request.headers.get('authorization') ?? ''
  return header.toLowerCase().startsWith('bearer ') ? header.slice(7) : null
}

export function assertCron(request: Request) {
  // Vercel Cron automatically sends Authorization: Bearer <CRON_SECRET>
  // We also accept our own AGENT_CRON_SECRET for manual/local calls.
  // If neither is configured (fresh local dev), allow all callers.
  const vercelSecret = process.env.CRON_SECRET
  const agentSecret = process.env.AGENT_CRON_SECRET
  if (!vercelSecret && !agentSecret) return true
  const bearer = getBearerToken(request)
  const headerSecret = request.headers.get('x-cron-secret')
  if (vercelSecret && (bearer === vercelSecret || headerSecret === vercelSecret)) return true
  if (agentSecret && (bearer === agentSecret || headerSecret === agentSecret)) return true
  return false
}

// ---------------------------------------------------------------------------
// HMAC-SHA256 — webhook signature verification (Web Crypto, no Node crypto)
// ---------------------------------------------------------------------------

async function hmacSha256(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Verify the X-Webhook-Signature header against WEBHOOK_SECRET env var. */
export async function assertWebhookHmac(request: Request, rawBody: string): Promise<boolean> {
  const secret = process.env.WEBHOOK_SECRET
  if (!secret) return false
  const provided = request.headers.get('x-webhook-signature') ?? ''
  if (!provided) return false
  const expected = await hmacSha256(secret, rawBody)
  // Constant-time comparison via XOR
  if (expected.length !== provided.length) return false
  let mismatch = 0
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ provided.charCodeAt(i)
  }
  return mismatch === 0
}

// ---------------------------------------------------------------------------
// In-memory rate limiter (resets on cold start — sufficient for serverless)
// ---------------------------------------------------------------------------

interface RateEntry {
  count: number
  resetAt: number
}

const rateStore = new Map<string, RateEntry>()

/** Returns true if the request is allowed; false if the limit is exceeded. */
export function checkRateLimit(
  key: string,
  maxRequests = 20,
  windowMs = 60_000
): boolean {
  const now = Date.now()
  const entry = rateStore.get(key)

  if (!entry || now > entry.resetAt) {
    rateStore.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (entry.count >= maxRequests) return false
  entry.count++
  return true
}

/** Extract a rate-limit key from a request (IP → X-Forwarded-For → fallback). */
export function getRateLimitKey(request: Request, scope = ''): string {
  const ip =
    request.headers.get('x-real-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  return `${scope}:${ip}`
}
