export type OracleMode = 'CHAINLINK' | 'OPTIMISTIC' | 'ADMIN'
export type MarketType = 'BINARY' | 'CATEGORICAL'
export type MarketState = 'OPEN' | 'RESOLVING' | 'RESOLVED' | 'INVALID'

export interface Market {
  id: number
  creator_address: string
  question: string
  ipfs_metadata_cid?: string | null
  resolution_time: string
  oracle_mode: OracleMode
  market_type: MarketType
  state: MarketState
  outcome_labels: string[]
  chainlink_feed?: string | null
  chainlink_threshold?: number | null
  chainlink_above?: boolean | null
  winning_outcome?: number | null
  total_volume_usdc: number
  tx_hash?: string | null
  created_at: string
  updated_at?: string
}

export interface Trade {
  id: string
  market_id: number
  trader_address: string
  outcome_index: number
  side: 'BUY' | 'SELL'
  amount_tokens: number
  usdc_amount: number
  price: number
  tx_hash?: string | null
  block_number?: number | null
  trade_source: 'ORDER_BOOK' | 'CPMM'
  created_at: string
}

export interface MarketDraft {
  question: string
  resolutionCriteria: string
  oracleMode: OracleMode
  marketType: MarketType
  outcomeLabels: string[]
  resolutionTime: string
  chainlinkFeed?: string
  chainlinkThreshold?: string
  chainlinkAbove?: boolean
}
