import { NextRequest, NextResponse } from 'next/server'

// ---------------------------------------------------------------------------
// Circle Testnet Faucet Proxy
// POST /api/faucet  { address: string, native?: boolean, usdc?: boolean }
//
// Requires CIRCLE_API_KEY env var. If not set, returns a redirect URL to
// the Circle faucet web UI so the user can drip manually.
// ---------------------------------------------------------------------------

const CIRCLE_FAUCET_URL = 'https://api.circle.com/v1/faucet/drips'
const FAUCET_FALLBACK = 'https://faucet.circle.com'

export async function POST(req: NextRequest) {
  let body: { address?: string; native?: boolean; usdc?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { address, native = true, usdc = true } = body

  if (!address) {
    return NextResponse.json({ error: 'address is required' }, { status: 400 })
  }

  const apiKey = process.env.CIRCLE_API_KEY
  if (!apiKey) {
    // No API key configured — tell the client to open the faucet UI instead
    return NextResponse.json({ fallback: FAUCET_FALLBACK }, { status: 200 })
  }

  try {
    const res = await fetch(CIRCLE_FAUCET_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        address,
        blockchain: 'ARC-TESTNET',
        native,
        usdc,
      }),
    })

    const data = await res.json() as Record<string, unknown>

    if (!res.ok) {
      return NextResponse.json(
        { error: (data.message as string) ?? `Faucet request failed (${res.status})` },
        { status: res.status }
      )
    }

    return NextResponse.json({ success: true, data })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Faucet proxy error' },
      { status: 500 }
    )
  }
}
