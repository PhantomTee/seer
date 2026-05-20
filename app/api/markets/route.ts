import { createServiceSupabase } from '@/lib/supabase'
import { json } from '../_utils'

export async function GET() {
  const supabase = createServiceSupabase()
  if (!supabase) return json({ error: 'Database not configured' }, { status: 503 })

  const { data, error } = await supabase.from('markets').select('*').order('created_at', { ascending: false })
  if (error) return json({ error: error.message }, { status: 500 })
  return json({ markets: data ?? [] })
}

export async function POST(request: Request) {
  const supabase = createServiceSupabase()
  if (!supabase) return json({ error: 'Database not configured' }, { status: 503 })

  const body = await request.json()
  const payload = {
    id: body.id,
    creator_address: String(body.creator_address ?? body.creatorAddress ?? '').toLowerCase(),
    question: body.question,
    ipfs_metadata_cid: body.ipfs_metadata_cid ?? body.ipfsMetadataCid ?? null,
    resolution_time: body.resolution_time ?? body.resolutionTime,
    oracle_mode: body.oracle_mode ?? body.oracleMode,
    market_type: body.market_type ?? body.marketType,
    outcome_labels: body.outcome_labels ?? body.outcomeLabels,
    chainlink_feed: body.chainlink_feed ?? body.chainlinkFeed ?? null,
    chainlink_threshold: body.chainlink_threshold ?? body.chainlinkThreshold ?? null,
    chainlink_above: body.chainlink_above ?? body.chainlinkAbove ?? null,
    tx_hash: body.tx_hash ?? body.txHash ?? null
  }

  const { data, error } = await supabase.from('markets').insert(payload).select('*').single()
  if (error) return json({ error: error.message }, { status: 400 })
  return json({ market: data }, { status: 201 })
}
