'use client'

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Market, Trade } from '@/types/market'
import { getBrowserSupabase } from '@/lib/supabase'
import { formatUsdc, shortAddress } from '@/lib/utils'
import { AgentChat } from '@/components/agent/AgentChat'
import { OrderBookDepth } from './OrderBook'
import { PriceChart } from './PriceChart'
import { TradingPanel } from './TradingPanel'
import { DisputePanel } from './DisputePanel'
import { CheckCircle, Clock, ExternalLink, Shield, TrendingUp } from 'lucide-react'

/** Derive YES probability from the most recent YES-outcome trade price, or null if no data. */
function latestYesPrice(trades: Trade[]): number | null {
  const yesTrades = trades.filter((t) => t.outcome_index === 0).slice().sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
  if (!yesTrades.length) return null
  return Number(yesTrades[0].price)
}

export function MarketDetail({ marketId }: { marketId: number }) {
  const [market, setMarket] = useState<Market | null>(null)
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // ── Initial fetch ─────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true)
    setNotFound(false)
    fetch(`/api/markets/${marketId}`)
      .then(async (res) => {
        if (res.status === 404) { setNotFound(true); return }
        if (!res.ok) return
        const payload = await res.json() as { market?: Market; trades?: Trade[] }
        if (payload.market) setMarket(payload.market)
        if (payload.trades) setTrades(payload.trades)
      })
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [marketId])

  // ── Supabase realtime — new trades ────────────────────────────────────────
  useEffect(() => {
    const supabase = getBrowserSupabase()
    if (!supabase) return

    const channel = supabase
      .channel(`trades-${marketId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'trades', filter: `market_id=eq.${marketId}` },
        (payload) => setTrades((prev) => [...prev, payload.new as Trade])
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'markets', filter: `id=eq.${marketId}` },
        (payload) => setMarket((prev) => prev ? { ...prev, ...(payload.new as Partial<Market>) } : prev)
      )
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [marketId])

  if (loading) {
    return (
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <div className="h-48 animate-pulse border-2 border-white/8 bg-white/[0.03]" />
          <div className="h-64 animate-pulse border-2 border-white/8 bg-white/[0.03]" />
        </div>
        <div className="h-96 animate-pulse border-2 border-white/8 bg-white/[0.03]" />
      </div>
    )
  }

  if (notFound || !market) {
    return (
      <div className="border-2 border-white/10 bg-white/[0.035] p-8 text-white/55 shadow-hard">
        Market not found.
      </div>
    )
  }

  const yesPrice = latestYesPrice(trades)
  const yesPct = yesPrice !== null ? Math.round(yesPrice * 100) : null

  const stateColor =
    market.state === 'OPEN'
      ? 'bg-mint text-black border-black'
      : market.state === 'RESOLVING'
        ? 'bg-amber text-black border-black'
        : 'bg-white/10 text-white/45 border-white/20'

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="space-y-5">

        {/* ── Market header ─────────────────────────────────────── */}
        <div className="border-2 border-white/15 bg-white/[0.04] p-5 shadow-hard">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className={`border-2 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${stateColor}`}>
              {market.state}
            </span>
            <span className="border border-blue/30 bg-blue/12 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-blue">
              {market.oracle_mode}
            </span>
            <span className="border border-white/15 bg-white/8 px-2.5 py-0.5 text-[11px] text-white/45">
              {market.market_type}
            </span>
          </div>

          <h1 className="max-w-3xl text-xl font-bold leading-snug text-white md:text-2xl">
            {market.question}
          </h1>

          {/* Probability */}
          <div className="mt-6 flex flex-wrap items-end gap-6">
            <div>
              {yesPct !== null ? (
                <>
                  <div className="font-display text-6xl leading-none tracking-wider text-mint">{yesPct}%</div>
                  <div className="mt-1.5 text-sm text-white/45">
                    chance YES · <span className="font-bold text-mint/80">{yesPct}¢</span> per contract
                  </div>
                </>
              ) : (
                <>
                  <div className="font-display text-4xl leading-none tracking-wider text-white/30">—</div>
                  <div className="mt-1.5 text-sm text-white/35">No trades yet</div>
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-4 pb-1 text-sm text-white/50">
              <span className="flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-mint/50" />
                Vol {formatUsdc(market.total_volume_usdc, 0)}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-white/25" />
                Resolves {new Date(market.resolution_time).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        {/* ── Resolution criteria ────────────────────────────────── */}
        <div className="border-2 border-mint/25 bg-mint/[0.04] p-5 shadow-hard-gold">
          <div className="mb-3 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-mint" />
            <h2 className="font-display text-xl tracking-wider text-mint">RESOLUTION CRITERIA</h2>
          </div>
          <p className="text-sm leading-6 text-white/65">
            {market.ipfs_metadata_cid && !market.ipfs_metadata_cid.startsWith('ipfs://')
              ? market.ipfs_metadata_cid
              : 'The outcome is determined by the designated oracle and cannot be altered once set. All resolutions are final after the dispute window closes.'}
          </p>
          <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
            <TrustPill icon={<Shield className="h-3.5 w-3.5 text-mint" />} label="Oracle" value={market.oracle_mode} />
            <TrustPill icon={<CheckCircle className="h-3.5 w-3.5 text-blue" />} label="Dispute window" value="48 h after resolution" />
            <TrustPill icon={<ExternalLink className="h-3.5 w-3.5 text-white/35" />} label="Settlement" value="On-chain, automatic" />
          </div>
        </div>

        {/* ── Probability timeline ───────────────────────────────── */}
        <PriceChart trades={trades} />

        {/* ── Order book ────────────────────────────────────────── */}
        <OrderBookDepth marketId={String(marketId)} />

        {/* ── Recent trades ─────────────────────────────────────── */}
        <div className="border-2 border-white/10 bg-white/[0.035] p-5 shadow-hard">
          <h2 className="mb-4 font-display text-2xl tracking-wider text-white">RECENT TRADES</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-white/35">
                <tr className="border-b-2 border-white/10">
                  <th className="pb-3">Side</th>
                  <th>Outcome</th>
                  <th>Amount</th>
                  <th>Probability</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.055]">
                {trades.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-sm text-white/35">
                      No trades yet.
                    </td>
                  </tr>
                ) : (
                  trades
                    .slice()
                    .reverse()
                    .slice(0, 20)
                    .map((trade) => (
                      <tr key={trade.id} className="text-white/60">
                        <td className={`py-3 font-bold ${trade.side === 'BUY' ? 'text-mint' : 'text-danger'}`}>
                          {trade.side}
                        </td>
                        <td className="font-medium">
                          {market.outcome_labels[trade.outcome_index] ?? trade.outcome_index}
                        </td>
                        <td className="tabular-nums">{Number(trade.amount_tokens).toLocaleString()}</td>
                        <td className="tabular-nums font-semibold">
                          {(Number(trade.price) * 100).toFixed(0)}%
                        </td>
                        <td className="text-white/30">{trade.trade_source}</td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Dispute panel ─────────────────────────────────────── */}
        {(market.state === 'RESOLVING' || market.state === 'OPEN') && (
          <DisputePanel market={market} />
        )}
      </section>

      {/* ── Sidebar ───────────────────────────────────────────── */}
      <aside className="space-y-5">
        <TradingPanel market={market} trades={trades} />
        <AgentChat market={market} compact />

        {/* Market info */}
        <div className="border-2 border-white/10 bg-white/[0.035] p-4 text-sm shadow-hard">
          <h2 className="mb-3 font-display text-xl tracking-wider text-white">MARKET INFO</h2>
          <dl className="space-y-2.5">
            <InfoRow label="Creator" value={<span className="font-mono text-xs">{shortAddress(market.creator_address)}</span>} />
            <InfoRow label="Resolution" value={<span className="text-xs">{new Date(market.resolution_time).toLocaleString()}</span>} />
            <InfoRow label="Creation bond" value="5 USDC" />
            <InfoRow label="Oracle" value={market.oracle_mode} />
            {market.tx_hash && (
              <InfoRow
                label="Contract"
                value={<span className="font-mono text-xs text-blue/70">{market.tx_hash.slice(0, 10)}…</span>}
              />
            )}
          </dl>
        </div>
      </aside>
    </div>
  )
}

function TrustPill({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5 border border-white/10 bg-ink/55 p-3">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-white/30">{label}</div>
        <div className="mt-0.5 text-xs font-semibold text-white/70">{value}</div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] pb-2.5 last:border-0 last:pb-0">
      <dt className="text-white/35 shrink-0">{label}</dt>
      <dd className="text-white/65 text-right">{value}</dd>
    </div>
  )
}
