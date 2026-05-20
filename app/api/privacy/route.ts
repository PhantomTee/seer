import { NextRequest, NextResponse } from 'next/server'

// ---------------------------------------------------------------------------
// Privacy proxy — forwards Stabletrust REST API calls from the browser.
//
// The browser generates a throwaway keypair (ethers.Wallet.createRandom()),
// stores the private key in sessionStorage, and passes it in the request body.
// This route forwards to Stabletrust without ever logging or persisting the key.
//
// REST API: https://stabletrust-api.fairblock.network
// Chain:    5042002 (Arc Testnet EVM) — supported by the REST API
// ---------------------------------------------------------------------------

const STABLETRUST_API = 'https://stabletrust-api.fairblock.network'
const ARC_CHAIN_ID = 5042002

type Action = 'balance' | 'deposit' | 'transfer' | 'withdraw'

interface PrivacyRequest {
  action: Action
  privateKey: string
  tokenAddress: string
  amount?: number
  recipientAddress?: string
}

export async function POST(req: NextRequest) {
  let body: PrivacyRequest
  try {
    body = await req.json() as PrivacyRequest
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { action, privateKey, tokenAddress, amount, recipientAddress } = body

  if (!action || !privateKey || !tokenAddress) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Build payload for Stabletrust
  const payload: Record<string, unknown> = {
    privateKey,
    tokenAddress,
    chainId: ARC_CHAIN_ID,
    waitForFinalization: true,
  }

  if (action === 'deposit' || action === 'withdraw') {
    if (!amount) return NextResponse.json({ error: 'amount is required' }, { status: 400 })
    // Stabletrust REST API expects raw units for deposit (BigInt string), number for withdraw
    payload.amount = action === 'deposit'
      ? String(BigInt(Math.round(amount * 1_000_000)))  // convert USDC → 6-decimal units
      : amount
  }

  if (action === 'transfer') {
    if (!amount || !recipientAddress) {
      return NextResponse.json({ error: 'amount and recipientAddress are required' }, { status: 400 })
    }
    payload.amount = amount
    payload.recipientAddress = recipientAddress
  }

  try {
    const res = await fetch(`${STABLETRUST_API}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = await res.json() as Record<string, unknown>

    if (!res.ok || data.success === false) {
      return NextResponse.json(
        { error: (data.error as string) ?? `Stabletrust ${action} failed` },
        { status: res.status }
      )
    }

    // For balance: parse the raw 6-decimal units into human-readable USDC
    if (action === 'balance' && data.balance) {
      const raw = data.balance as { total: string; available: string; pending: string }
      return NextResponse.json({
        address: data.address,
        balance: {
          total:     (Number(raw.total)     / 1_000_000).toFixed(6),
          available: (Number(raw.available) / 1_000_000).toFixed(6),
          pending:   (Number(raw.pending)   / 1_000_000).toFixed(6),
        }
      })
    }

    return NextResponse.json({ success: true, tx: data.tx ?? null })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Proxy error' },
      { status: 500 }
    )
  }
}
