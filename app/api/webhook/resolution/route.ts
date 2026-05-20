import { createServiceSupabase } from '@/lib/supabase'
import { assertWebhookHmac, json } from '../../_utils'

export async function POST(request: Request) {
  // Read the raw body first so we can verify the HMAC signature
  const rawBody = await request.text()

  // --- HMAC auth -----------------------------------------------------------
  const authenticated = await assertWebhookHmac(request, rawBody)
  if (!authenticated) {
    return json({ error: 'Unauthorized: invalid or missing webhook signature' }, { status: 401 })
  }

  // --- Parse body ----------------------------------------------------------
  let body: Record<string, unknown>
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>
  } catch {
    return json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { marketId, winningOutcome, txHash } = body as {
    marketId?: number
    winningOutcome?: number
    txHash?: string
  }

  if (typeof marketId !== 'number' || typeof winningOutcome !== 'number') {
    return json({ error: 'marketId and winningOutcome are required numbers' }, { status: 400 })
  }

  // --- Database update -----------------------------------------------------
  const supabase = createServiceSupabase()
  if (!supabase) return json({ error: 'Supabase service role is not configured' }, { status: 503 })

  const { error } = await supabase
    .from('markets')
    .update({ state: 'RESOLVED', winning_outcome: winningOutcome, tx_hash: txHash ?? null })
    .eq('id', marketId)

  if (error) return json({ error: error.message }, { status: 500 })

  await supabase.from('agent_logs').insert({
    action: 'resolve',
    market_id: marketId,
    tx_hash: txHash ?? null,
    details: { winningOutcome, source: 'webhook' }
  })

  return json({ ok: true })
}
