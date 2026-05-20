import { generateMarketSuggestions } from '@/lib/agent'
import { createServiceSupabase } from '@/lib/supabase'
import { assertCron, json } from '../../_utils'

export async function GET() {
  const supabase = createServiceSupabase()
  if (!supabase) return json({ error: 'Database not configured' }, { status: 503 })
  const { data, error } = await supabase.from('agent_suggestions').select('*').order('created_at', { ascending: false }).limit(25)
  if (error) return json({ error: error.message }, { status: 500 })
  return json({ suggestions: data ?? [] })
}

export async function POST(request: Request) {
  if (!assertCron(request)) return json({ error: 'Unauthorized' }, { status: 401 })
  const suggestions = await generateMarketSuggestions()
  const supabase = createServiceSupabase()

  if (supabase && suggestions.length > 0) {
    const rows = suggestions.map((suggestion) => ({
      question: suggestion.question,
      rationale: suggestion.rationale,
      suggested_oracle: suggestion.oracle_type ?? suggestion.suggested_oracle,
      resolution_time: new Date(Date.now() + Number(suggestion.resolution_days ?? 30) * 86400000).toISOString()
    }))
    const { error } = await supabase.from('agent_suggestions').insert(rows)
    if (error) return json({ error: error.message }, { status: 500 })
    await supabase.from('agent_logs').insert({ action: 'suggest', details: { count: rows.length } })
  }

  return json({ suggestions, inserted: suggestions.length })
}
