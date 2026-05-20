import { getMarketContext } from '@/lib/agent'
import { createServiceSupabase } from '@/lib/supabase'
import { json } from '../../_utils'

export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const marketId = body.marketId ? Number(body.marketId) : null
  const question = String(body.question ?? '')
  const resolutionCriteria = String(body.resolutionCriteria ?? '')
  if (!question) return json({ error: 'Missing question' }, { status: 400 })

  try {
    const supabase = createServiceSupabase()
    const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString()

    // Return cached analysis if available (within last 30 min)
    if (supabase && marketId) {
      const { data } = await supabase
        .from('agent_logs')
        .select('*')
        .eq('action', 'context')
        .eq('market_id', marketId)
        .gte('created_at', cutoff)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const cachedAnalysis =
        data?.details && typeof data.details === 'object'
          ? (data.details as { analysis?: string }).analysis
          : null
      if (cachedAnalysis) {
        return json({ analysis: cachedAnalysis, timestamp: data.created_at, cached: true })
      }
    }

    const analysis = await getMarketContext(question, resolutionCriteria)
    const timestamp = new Date().toISOString()

    if (supabase && marketId) {
      await supabase.from('agent_logs').insert({
        action: 'context',
        market_id: marketId,
        details: { analysis, question, resolutionCriteria },
      })
    }

    return json({ analysis, timestamp, cached: false })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Agent error'
    return json({ error: message }, { status: 500 })
  }
}
