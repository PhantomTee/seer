import { NextRequest, NextResponse } from 'next/server'
import { hashMessage, recoverAddress, type Address } from 'viem'
import { createServiceSupabase } from '@/lib/supabase'
import {
  getAgentWalletClient,
  getContractAddresses,
  getPublicClient,
  oracleResolverAbi,
} from '@/lib/contracts'

// ---------------------------------------------------------------------------
// Admin resolve endpoint
// POST /api/admin/resolve
//
// Body: { marketId: number, outcomeIndex: number, message: string, signature: `0x${string}` }
//
// Auth: the caller must sign `message` with the admin wallet. We recover the
// signer and verify it matches ADMIN_ADDRESS. The agent wallet then executes
// the on-chain call.
// ---------------------------------------------------------------------------

const ADMIN_ADDRESS = (
  process.env.ADMIN_ADDRESS ?? '0xF869c7b8A19146A4bbD5466e83c3B785AE7EE148'
).toLowerCase()

export async function POST(req: NextRequest) {
  let body: {
    marketId?: number
    outcomeIndex?: number
    message?: string
    signature?: `0x${string}`
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { marketId, outcomeIndex, message, signature } = body

  if (marketId === undefined || outcomeIndex === undefined || !message || !signature) {
    return NextResponse.json({ error: 'Missing fields: marketId, outcomeIndex, message, signature' }, { status: 400 })
  }

  // ── Verify admin signature ────────────────────────────────────────────────
  let recovered: Address
  try {
    recovered = await recoverAddress({
      hash: hashMessage(message),
      signature,
    })
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  if (recovered.toLowerCase() !== ADMIN_ADDRESS) {
    return NextResponse.json({ error: 'Forbidden — not the admin wallet' }, { status: 403 })
  }

  // ── Verify the message contains the expected params (replay protection) ───
  const expectedMsg = `SEER Admin: resolve market ${marketId} as outcome ${outcomeIndex}`
  if (message !== expectedMsg) {
    return NextResponse.json({ error: 'Message content mismatch' }, { status: 400 })
  }

  // ── Execute on-chain via agent wallet ─────────────────────────────────────
  const walletClient = getAgentWalletClient()
  const publicClient = getPublicClient()
  const addresses = getContractAddresses()

  if (!walletClient || !addresses.oracleResolver) {
    return NextResponse.json(
      { error: 'Agent wallet or oracle resolver not configured — set AGENT_PRIVATE_KEY and NEXT_PUBLIC_ORACLE_RESOLVER' },
      { status: 503 }
    )
  }

  let txHash: `0x${string}`
  try {
    // Try adminResolve first (direct, no dispute window); fall back to proposeOutcome
    try {
      const { request } = await publicClient.simulateContract({
        account: walletClient.account,
        address: addresses.oracleResolver,
        abi: oracleResolverAbi,
        functionName: 'adminResolve',
        args: [BigInt(marketId), BigInt(outcomeIndex)],
      })
      txHash = await walletClient.writeContract(request)
    } catch {
      // adminResolve not on this contract — use proposeOutcome (OPTIMISTIC path)
      const { request } = await publicClient.simulateContract({
        account: walletClient.account,
        address: addresses.oracleResolver,
        abi: oracleResolverAbi,
        functionName: 'proposeOutcome',
        args: [BigInt(marketId), BigInt(outcomeIndex)],
      })
      txHash = await walletClient.writeContract(request)
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'On-chain call failed' },
      { status: 500 }
    )
  }

  // ── Update Supabase market state ──────────────────────────────────────────
  const supabase = createServiceSupabase()
  if (supabase) {
    await supabase
      .from('markets')
      .update({
        state: 'RESOLVING',
        winning_outcome: outcomeIndex,
        updated_at: new Date().toISOString(),
      })
      .eq('id', marketId)

    await supabase.from('agent_logs').insert({
      action: 'admin_resolve',
      market_id: marketId,
      tx_hash: txHash,
      details: { outcomeIndex, admin: recovered },
    })
  }

  return NextResponse.json({ success: true, txHash, marketId, outcomeIndex })
}
