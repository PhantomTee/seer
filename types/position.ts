export interface Position {
  id: string
  user_address: string
  market_id: number
  outcome_index: number
  token_amount: number
  avg_price_usdc?: number | null
  is_confidential: boolean
  created_at: string
  updated_at?: string
}

export interface UserAlert {
  id: string
  user_address: string
  market_id: number
  alert_type: 'price_move' | 'dispute_filed' | 'resolution' | 'suggestion'
  message: string
  read: boolean
  created_at: string
}
