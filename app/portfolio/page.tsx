'use client'

import { useEffect, useMemo, useState } from 'react'
import { Bell, Eye, TrendingUp, WalletCards } from 'lucide-react'
import { useAccount } from 'wagmi'
import { ConfidentialPositionPanel } from '@/components/privacy/ConfidentialPositionPanel'
import { USDCBalance } from '@/components/shared/USDCBalance'
import { ClaimWinnings } from '@/components/portfolio/ClaimWinnings'
import { usePositions } from '@/hooks/usePositions'
import { formatUsdc, shortAddress } from '@/lib/utils'
import type { Market } from '@/types/market'

export default function PortfolioPage() {
  const { address, isConnected } = useAccount()
  const { positions, alerts, loading } = usePositions(address)

  // Fetch market states for the markets the user holds positions in
  const [markets, setMarkets] = useState<Market[]>([])
  useEffect(() => {
    if (!positions.length) return
    fetch('/api/markets')
      .then((r) => r.ok ? r.json() as Promise<{ markets?: Market[] }> : Promise.resolve({ markets: [] }))
      .then((d) => setMarkets(d.markets ?? []))
      .catch(() => undefined)
  }, [positions.length])

  // Map of market_id → winning_outcome for resolved markets the user participates in
  const resolvedMarkets = useMemo(() => {
    const map = new Map<number, number>()
    for (const m of markets) {
      if (m.state === 'RESOLVED' && m.winning_outcome != null) {
        map.set(m.id, m.winning_outcome)
      }
    }
    return map
  }, [markets])

  // Total USDC staked across all positions
  const invested = positions.reduce(
    (sum, p) => sum + Number(p.token_amount) * Number(p.avg_price_usdc ?? 0),
    0
  )

  // Realised value: resolved positions only (winners pay $1/token, losers pay $0)
  // Open positions can't be valued without live price data — excluded
  const realisedValue = positions.reduce((sum, p) => {
    const mkt = markets.find((m) => m.id === p.market_id)
    if (mkt?.state !== 'RESOLVED') return sum
    const isWinner = mkt.winning_outcome === p.outcome_index
    return sum + (isWinner ? Number(p.token_amount) : 0)
  }, 0)

  const realisedInvested = positions.reduce((sum, p) => {
    const mkt = markets.find((m) => m.id === p.market_id)
    if (mkt?.state !== 'RESOLVED') return sum
    return sum + Number(p.token_amount) * Number(p.avg_price_usdc ?? 0)
  }, 0)

  const hasResolved = realisedInvested > 0
  const pnl = realisedValue - realisedInvested
  const pnlPct = hasResolved ? ((pnl / realisedInvested) * 100).toFixed(1) : null

  if (!isConnected) {
    return (
      <div className="border-2 border-white/15 bg-white/[0.04] p-12 text-center shadow-hard">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center border-2 border-mint/40 bg-mint/10">
          <WalletCards className="h-7 w-7 text-mint" />
        </div>
        <h1 className="font-display text-4xl tracking-wider text-white">CONNECT WALLET</h1>
        <p className="mt-3 text-base text-white/45">
          Portfolio positions are loaded by wallet address.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-5xl tracking-wider text-white">PORTFOLIO</h1>
          <p className="mt-1 text-sm text-white/40">
            Connected as{' '}
            <span className="font-mono font-semibold text-white/60">{shortAddress(address)}</span>
          </p>
        </div>
        <USDCBalance />
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 md:grid-cols-3">
        <SummaryCard
          label="Total Staked"
          value={invested > 0 ? formatUsdc(invested) : '—'}
          icon={<WalletCards className="h-5 w-5 text-white/40" />}
        />
        <SummaryCard
          label="Resolved Payout"
          value={hasResolved ? formatUsdc(realisedValue) : '—'}
          sub={hasResolved ? undefined : 'No resolved markets yet'}
          icon={<TrendingUp className="h-5 w-5 text-mint/60" />}
          accent
        />
        <SummaryCard
          label="Realised P&L"
          value={hasResolved ? `${pnl >= 0 ? '+' : ''}${formatUsdc(pnl)}` : '—'}
          sub={pnlPct !== null ? `${pnl >= 0 ? '+' : ''}${pnlPct}% on resolved` : 'Resolves when markets close'}
          icon={<TrendingUp className="h-5 w-5 text-mint/60" />}
          accent
          positive={pnl > 0}
        />
      </div>

      {/* Claim Winnings — only rendered when there are winning positions */}
      {positions.length > 0 && (
        <ClaimWinnings positions={positions} resolvedMarkets={resolvedMarkets} />
      )}

      {/* Positions table */}
      <section className="border-2 border-white/15 bg-white/[0.035] p-5 shadow-hard">
        <h2 className="mb-5 font-display text-2xl tracking-wider text-white">OPEN POSITIONS</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-widest text-white/35">
              <tr className="border-b-2 border-white/10">
                <th className="pb-3">Market</th>
                <th>Outcome</th>
                <th>Tokens</th>
                <th>Avg price</th>
                <th>Privacy</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.055]">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={6} className="py-3">
                      <div className="h-4 w-full animate-pulse bg-white/8" />
                    </td>
                  </tr>
                ))
              ) : positions.length ? (
                positions.map((position) => {
                  const mkt = markets.find((m) => m.id === position.market_id)
                  const isResolved = mkt?.state === 'RESOLVED'
                  const isWinner =
                    isResolved && mkt?.winning_outcome === position.outcome_index

                  return (
                    <tr key={position.id} className="text-white/60">
                      <td className="py-3 font-semibold text-white/80">Market #{position.market_id}</td>
                      <td>
                        <span className={`border-2 px-2 py-0.5 text-[11px] font-bold ${
                          position.outcome_index === 0
                            ? 'border-black bg-mint text-black'
                            : 'border-black bg-danger text-white'
                        }`}>
                          {position.outcome_index === 0 ? 'YES' : 'NO'}
                        </span>
                      </td>
                      <td className="tabular-nums font-medium">
                        {position.is_confidential ? (
                          <span className="text-white/30 italic">Encrypted</span>
                        ) : (
                          Number(position.token_amount).toLocaleString()
                        )}
                      </td>
                      <td className="tabular-nums font-medium">
                        {position.avg_price_usdc
                          ? `${(Number(position.avg_price_usdc) * 100).toFixed(0)}¢`
                          : '—'}
                      </td>
                      <td>
                        <span className={`text-[11px] font-bold ${
                          position.is_confidential ? 'text-mint' : 'text-white/35'
                        }`}>
                          {position.is_confidential ? 'Fairblock' : 'Public'}
                        </span>
                      </td>
                      <td>
                        {isResolved ? (
                          <span className={`border px-2 py-0.5 text-[11px] font-bold ${
                            isWinner
                              ? 'border-mint/40 bg-mint/10 text-mint'
                              : 'border-danger/30 bg-danger/10 text-danger'
                          }`}>
                            {isWinner ? 'Won ✓' : 'Lost'}
                          </span>
                        ) : (
                          <span className="border border-mint/30 bg-mint/10 px-2 py-0.5 text-[11px] font-bold text-mint">
                            Open
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-base text-white/35">
                    No positions yet.{' '}
                    <span className="font-semibold text-mint">Browse markets</span> to make your first prediction.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Bottom panels */}
      <div className="grid gap-5 xl:grid-cols-2">
        <ConfidentialPositionPanel />

        {/* Alerts */}
        <section className="border-2 border-white/15 bg-white/[0.035] p-5 shadow-hard">
          <h2 className="mb-5 flex items-center gap-2 font-display text-2xl tracking-wider text-white">
            <Bell className="h-5 w-5 text-mint" />
            POSITION ALERTS
          </h2>
          <div className="space-y-2">
            {alerts.length ? (
              alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-start gap-3 border border-white/10 bg-ink/55 p-3 text-sm text-white/60"
                >
                  <Eye className="mt-0.5 h-4 w-4 shrink-0 text-mint/60" />
                  <span>{alert.message}</span>
                </div>
              ))
            ) : (
              <div className="border border-white/10 bg-ink/40 p-5 text-center text-sm text-white/35">
                No alerts yet. Alerts fire when your positions move &gt;5%.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  sub,
  icon,
  accent = false,
  positive = false,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ReactNode
  accent?: boolean
  positive?: boolean
}) {
  return (
    <div className={`border-2 p-5 shadow-hard ${positive ? 'border-mint/40 bg-mint/[0.06]' : 'border-white/15 bg-white/[0.04]'}`}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-widest text-white/35">{label}</span>
        {icon}
      </div>
      <div className={`font-display text-3xl tracking-wider tabular-nums ${positive ? 'text-mint' : accent ? 'text-white' : 'text-white/80'}`}>
        {value}
      </div>
      {sub && (
        <div className={`mt-0.5 text-sm font-bold ${positive ? 'text-mint/70' : 'text-white/40'}`}>
          {sub} all time
        </div>
      )}
    </div>
  )
}
