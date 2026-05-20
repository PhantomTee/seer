import { createServiceSupabase } from '@/lib/supabase'
import { json } from '../../_utils'

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const marketId = Number(id)
  const supabase = createServiceSupabase()
  if (!supabase) return json({ error: 'Database not configured' }, { status: 503 })

  const [{ data: market, error: marketError }, { data: trades, error: tradesError }] = await Promise.all([
    supabase.from('markets').select('*').eq('id', marketId).single(),
    supabase.from('trades').select('*').eq('market_id', marketId).order('created_at', { ascending: false }).limit(50)
  ])

  if (marketError) return json({ error: marketError.message }, { status: 404 })
  if (tradesError) return json({ error: tradesError.message }, { status: 500 })
  return json({ market, trades: trades ?? [] })
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const supabase = createServiceSupabase()
  if (!supabase) return json({ error: 'Database not configured' }, { status: 503 })

  const body = await request.json()
  const { data, error } = await supabase.from('markets').update(body).eq('id', Number(id)).select('*').single()
  if (error) return json({ error: error.message }, { status: 400 })
  return json({ market: data })
}
