import { MarketList } from '@/components/markets/MarketList'

export default function MarketsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Markets</h1>
        <p className="mt-1 text-sm text-white/38">
          Browse, filter, and trade Arc-native prediction markets.
        </p>
      </div>
      <MarketList />
    </div>
  )
}
