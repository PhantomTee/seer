import type { AgentLog, MarketSuggestion } from '@/types/agent'
import type { Market, Trade } from '@/types/market'
import type { Position, UserAlert } from '@/types/position'

export const mockMarkets: Market[] = [
  {
    id: 1,
    creator_address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    question: 'Will BTC exceed $200k by Dec 31 2026?',
    ipfs_metadata_cid: 'ipfs://btc-200k-criteria',
    resolution_time: '2026-12-31T23:59:59.000Z',
    oracle_mode: 'CHAINLINK',
    market_type: 'BINARY',
    state: 'OPEN',
    outcome_labels: ['YES', 'NO'],
    chainlink_feed: '0x0000000000000000000000000000000000000000',
    chainlink_threshold: 20000000000000,
    chainlink_above: true,
    total_volume_usdc: 48200,
    tx_hash: '0xabc',
    created_at: new Date(Date.now() - 86400000).toISOString()
  },
  {
    id: 2,
    creator_address: '0x1111111111111111111111111111111111111111',
    question: 'Will Arc Testnet process more than 10 million transactions before Q4 2026?',
    ipfs_metadata_cid: 'ipfs://arc-volume-criteria',
    resolution_time: '2026-10-01T00:00:00.000Z',
    oracle_mode: 'OPTIMISTIC',
    market_type: 'BINARY',
    state: 'OPEN',
    outcome_labels: ['YES', 'NO'],
    total_volume_usdc: 12150,
    created_at: new Date(Date.now() - 172800000).toISOString()
  },
  {
    id: 3,
    creator_address: '0x2222222222222222222222222222222222222222',
    question: 'Which stablecoin payment network will announce the largest enterprise pilot by September 2026?',
    ipfs_metadata_cid: 'ipfs://stablecoin-pilot-criteria',
    resolution_time: '2026-09-30T23:59:59.000Z',
    oracle_mode: 'OPTIMISTIC',
    market_type: 'CATEGORICAL',
    state: 'RESOLVING',
    outcome_labels: ['Arc', 'Tempo', 'Plasma', 'Other'],
    total_volume_usdc: 30900,
    created_at: new Date(Date.now() - 259200000).toISOString()
  }
]

export const mockTrades: Trade[] = [
  {
    id: 'trade-1',
    market_id: 1,
    trader_address: '0x3333333333333333333333333333333333333333',
    outcome_index: 0,
    side: 'BUY',
    amount_tokens: 1200,
    usdc_amount: 804,
    price: 0.67,
    trade_source: 'CPMM',
    created_at: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: 'trade-2',
    market_id: 1,
    trader_address: '0x4444444444444444444444444444444444444444',
    outcome_index: 1,
    side: 'BUY',
    amount_tokens: 600,
    usdc_amount: 198,
    price: 0.33,
    trade_source: 'ORDER_BOOK',
    created_at: new Date(Date.now() - 1800000).toISOString()
  }
]

export const mockPositions: Position[] = [
  {
    id: 'position-1',
    user_address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    market_id: 1,
    outcome_index: 0,
    token_amount: 1250,
    avg_price_usdc: 0.58,
    is_confidential: true,
    created_at: new Date(Date.now() - 7200000).toISOString()
  }
]

export const mockAlerts: UserAlert[] = [
  {
    id: 'alert-1',
    user_address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    market_id: 1,
    alert_type: 'price_move',
    message: 'YES price moved more than 5% in the last hour.',
    read: false,
    created_at: new Date(Date.now() - 1200000).toISOString()
  }
]

export const mockSuggestions: MarketSuggestion[] = [
  {
    id: 'suggestion-1',
    question: 'Will ETH close above $8,000 on any major spot exchange before Dec 31 2026?',
    resolution_criteria: 'Resolve YES if ETH/USD trades above $8,000 on Coinbase, Kraken, or Binance before the deadline.',
    suggested_oracle: 'CHAINLINK',
    resolution_days: 227,
    rationale: 'High-liquidity crypto price event with objective oracle criteria.',
    upvotes: 18,
    created_at: new Date().toISOString()
  },
  {
    id: 'suggestion-2',
    question: 'Will a US spot Solana ETF begin trading before Dec 31 2026?',
    resolution_criteria: 'Resolve YES when a US exchange-listed spot Solana ETF has its first official trading day.',
    suggested_oracle: 'OPTIMISTIC',
    resolution_days: 227,
    rationale: 'Regulatory event with clear public-source evidence and high market interest.',
    upvotes: 11,
    created_at: new Date().toISOString()
  }
]

export const mockAgentLogs: AgentLog[] = [
  {
    id: 'log-1',
    action: 'monitor',
    market_id: 3,
    details: { message: 'Dispute window checked; 1 market resolving.' },
    created_at: new Date(Date.now() - 900000).toISOString()
  },
  {
    id: 'log-2',
    action: 'suggest',
    details: { count: 5 },
    created_at: new Date(Date.now() - 3600000).toISOString()
  }
]
