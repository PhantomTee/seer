import { createServiceSupabase } from '@/lib/supabase'
import { checkRateLimit, getRateLimitKey, json } from '../_utils'

export async function GET(request: Request) {
  if (!checkRateLimit(getRateLimitKey(request, 'positions'), 60, 60_000)) {
    return json({ error: 'Too many requests' }, { status: 429 })
  }

  const url = new URL(request.url)
  const userAddress = url.searchParams.get('user')?.toLowerCase()
  if (!userAddress) return json({ error: 'Missing user query parameter' }, { status: 400 })

  const supabase = createServiceSupabase()
  if (!supabase) return json({ error: 'Database not configured' }, { status: 503 })

  const [{ data: positions, error: posErr }, { data: alerts, error: alertErr }] = await Promise.all([
    supabase.from('positions').select('*').eq('user_address', userAddress).order('updated_at', { ascending: false }),
    supabase.from('user_alerts').select('*').eq('user_address', userAddress).order('created_at', { ascending: false })
  ])

  if (posErr) return json({ error: posErr.message }, { status: 500 })
  if (alertErr) return json({ error: alertErr.message }, { status: 500 })
  return json({ positions: positions ?? [], alerts: alerts ?? [] })
}

export async function POST(request: Request) {
  if (!checkRateLimit(getRateLimitKey(request, 'positions-write'), 30, 60_000)) {
    return json({ error: 'Too many requests' }, { status: 429 })
  }

  const supabase = createServiceSupabase()
  if (!supabase) return json({ error: 'Database not configured' }, { status: 503 })

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('positions')
    .upsert(body, { onConflict: 'user_address,market_id,outcome_index' })
    .select('*')

  if (error) return json({ error: error.message }, { status: 400 })
  return json({ positions: data ?? [] })
}
