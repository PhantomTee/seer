/**
 * Curated Chainlink price feed registry.
 *
 * Arc Testnet inherits mainnet feed addresses — add Arc-specific ones once
 * the oracle bridge is deployed.  Until then these are the canonical Ethereum
 * Mainnet addresses used for reference / simulation.
 */

export interface ChainlinkFeed {
  name: string
  pair: string
  address: `0x${string}`
  decimals: 8
  category: 'crypto' | 'forex' | 'commodity' | 'equity'
}

export const CHAINLINK_FEEDS: ChainlinkFeed[] = [
  // ── Crypto ──────────────────────────────────────────────────────────────
  {
    name: 'BTC / USD',
    pair: 'BTC/USD',
    address: '0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88b',
    decimals: 8,
    category: 'crypto'
  },
  {
    name: 'ETH / USD',
    pair: 'ETH/USD',
    address: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
    decimals: 8,
    category: 'crypto'
  },
  {
    name: 'SOL / USD',
    pair: 'SOL/USD',
    address: '0x4ffC43a60e009B551865A93d232E33Fce9f01507',
    decimals: 8,
    category: 'crypto'
  },
  {
    name: 'LINK / USD',
    pair: 'LINK/USD',
    address: '0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c',
    decimals: 8,
    category: 'crypto'
  },
  {
    name: 'BNB / USD',
    pair: 'BNB/USD',
    address: '0x14e613AC84a31f709eadbEF3bf98bEFf2564c3fb',
    decimals: 8,
    category: 'crypto'
  },
  {
    name: 'MATIC / USD',
    pair: 'MATIC/USD',
    address: '0x7bAC85A8a13A4d761D081B83e9A4e813082E41b8',
    decimals: 8,
    category: 'crypto'
  },
  {
    name: 'AVAX / USD',
    pair: 'AVAX/USD',
    address: '0xFF3EEb22B5E3dE6e705b44749C2559d704923FD7',
    decimals: 8,
    category: 'crypto'
  },
  {
    name: 'ARB / USD',
    pair: 'ARB/USD',
    address: '0xb2A824043730FE05F3DA2efaFa1CBbe83fa548D6',
    decimals: 8,
    category: 'crypto'
  },
  {
    name: 'OP / USD',
    pair: 'OP/USD',
    address: '0x0D276FC14719f9292D5C1eA2198673d1f4269246',
    decimals: 8,
    category: 'crypto'
  },

  // ── Forex ────────────────────────────────────────────────────────────────
  {
    name: 'EUR / USD',
    pair: 'EUR/USD',
    address: '0xb49f677943BC038e9857d61E7d053CaA2C1734C1',
    decimals: 8,
    category: 'forex'
  },
  {
    name: 'GBP / USD',
    pair: 'GBP/USD',
    address: '0x5c0Ab2d9b5a7ed9f470386e82BB36A3613cDd4b5',
    decimals: 8,
    category: 'forex'
  },
  {
    name: 'JPY / USD',
    pair: 'JPY/USD',
    address: '0xBcE206caE7f0ec07b545EddE332A47C2F75bbeb3',
    decimals: 8,
    category: 'forex'
  },

  // ── Commodities ──────────────────────────────────────────────────────────
  {
    name: 'XAU / USD (Gold)',
    pair: 'XAU/USD',
    address: '0x214eD9Da11D2fbe465a6fc601a91E62EbEc1a0D6',
    decimals: 8,
    category: 'commodity'
  },
  {
    name: 'XAG / USD (Silver)',
    pair: 'XAG/USD',
    address: '0x379589227b15F1a12195D3f2d90bBc9F31f95235',
    decimals: 8,
    category: 'commodity'
  }
]

export const FEED_CATEGORIES = ['all', 'crypto', 'forex', 'commodity'] as const
export type FeedCategory = (typeof FEED_CATEGORIES)[number]

export function getFeedsByCategory(category: FeedCategory): ChainlinkFeed[] {
  if (category === 'all') return CHAINLINK_FEEDS
  return CHAINLINK_FEEDS.filter((f) => f.category === category)
}

export function getFeedByAddress(address: string): ChainlinkFeed | undefined {
  return CHAINLINK_FEEDS.find((f) => f.address.toLowerCase() === address.toLowerCase())
}
