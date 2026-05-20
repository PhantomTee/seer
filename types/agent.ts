import type { OracleMode } from './market'

export interface MarketSuggestion {
  id?: string
  question: string
  resolution_criteria: string
  suggested_oracle?: OracleMode | string
  oracle_type?: OracleMode
  resolution_days?: number
  resolution_time?: string
  rationale: string
  upvotes?: number
  created_at?: string
}

export interface AgentLog {
  id: string
  action: 'resolve' | 'suggest' | 'alert' | 'monitor' | 'context'
  market_id?: number | null
  details?: Record<string, unknown> | null
  tx_hash?: string | null
  created_at: string
}
