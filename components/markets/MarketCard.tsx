import Link from 'next/link'
import { Clock3, TrendingDown, TrendingUp } from 'lucide-react'
import type { Market } from '@/types/market'
import { cn, formatUsdc } from '@/lib/utils'

function timeRemaining(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now()
  if (diff <= 0) return 'Expired'
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  if (days > 0) return `${days}d left`
  if (hours > 0) return `${hours}h left`
  return 'Ending soon'
}

export function MarketCard({ market }: { market: Market }) {
  const stateColor =
    market.state === 'OPEN'
      ? 'bg-mint text-black border-black'
      : market.state === 'RESOLVING'
        ? 'bg-amber text-black border-black'
        : 'bg-white/15 text-white/60 border-white/20'

  // Use the market's stored volume as the only real number we have on the card
  const hasResolved = market.state === 'RESOLVED'

  return (
    <Link
      href={`/markets/${market.id}`}
      className="group block border-2 border-white/20 bg-panel p-5 shadow-hard transition-all duration-150 hover:-translate-y-0.5 hover:border-mint hover:shadow-hard-gold"
    >
      {/* Header row */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className={cn('border-2 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider', stateColor)}>
          {market.state}
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-white/40">
          <Clock3 className="h-3 w-3" />
          {timeRemaining(market.resolution_time)}
        </span>
      </div>

      {/* Question */}
      <h3 className="mb-5 line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-white/85 transition-colors group-hover:text-white">
        {market.question}
      </h3>

      {/* Probability — show resolved outcome or "Trade to discover price" */}
      {hasResolved ? (
        <div className="mb-4">
          <div className="font-display text-3xl leading-none tracking-wider text-white/50">
            {market.winning_outcome === 0 ? 'YES' : 'NO'}
          </div>
          <div className="mt-1 text-[11px] text-white/35">Resolved outcome</div>
        </div>
      ) : (
        <div className="mb-4 flex items-end justify-between">
          <div>
            <div className="font-display text-4xl leading-none tracking-wider text-mint">
              <TrendingUp className="mb-0.5 inline h-5 w-5 text-mint/50" /> YES
            </div>
            <div className="mt-1 text-[11px] text-white/35">Trade to set price</div>
          </div>
          <div className="text-right">
            <div className="font-display text-2xl leading-none tracking-wider text-danger">
              NO <TrendingDown className="mb-0.5 inline h-4 w-4 text-danger/50" />
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between text-[11px]">
        <span className="font-medium text-white/40">Vol {formatUsdc(market.total_volume_usdc, 0)}</span>
        <span className="border border-blue/30 bg-blue/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue/80">
          {market.oracle_mode}
        </span>
      </div>
    </Link>
  )
}
