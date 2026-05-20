'use client'

import { Search, SlidersHorizontal } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useMarkets } from '@/hooks/useMarkets'
import type { Market } from '@/types/market'
import { MarketCard } from './MarketCard'

const STATE_FILTERS = ['All', 'Open', 'Resolving', 'Resolved'] as const
const ORACLE_FILTERS = ['Chainlink', 'Optimistic'] as const
const SORTS = ['Volume', 'Newest', 'Ending Soon'] as const

type StateFilter = (typeof STATE_FILTERS)[number]
type SortOption = (typeof SORTS)[number]

function matchesState(market: Market, f: StateFilter) {
  if (f === 'All') return true
  return market.state === f.toUpperCase()
}

export function MarketList() {
  const { markets: source, loading } = useMarkets()
  const [query, setQuery] = useState('')
  const [stateFilter, setStateFilter] = useState<StateFilter>('All')
  const [oracleFilter, setOracleFilter] = useState<string>('All')
  const [sort, setSort] = useState<SortOption>('Volume')

  const visible = useMemo(() => {
    return source
      .filter((m) => {
        const q = query.toLowerCase()
        if (q && !m.question.toLowerCase().includes(q)) return false
        if (!matchesState(m, stateFilter)) return false
        if (oracleFilter !== 'All' && m.oracle_mode !== oracleFilter.toUpperCase()) return false
        return true
      })
      .sort((a, b) => {
        if (sort === 'Newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        if (sort === 'Ending Soon') return new Date(a.resolution_time).getTime() - new Date(b.resolution_time).getTime()
        return Number(b.total_volume_usdc) - Number(a.total_volume_usdc)
      })
  }, [source, query, stateFilter, oracleFilter, sort])

  return (
    <section className="space-y-5">

      {/* Search + filter bar */}
      <div className="border-2 border-white/15 bg-white/[0.03] p-4 shadow-hard">

        {/* Search */}
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search markets…"
            className="focus-ring h-11 w-full border-2 border-white/15 bg-ink/80 pl-9 pr-3 text-sm font-medium text-white placeholder:text-white/28"
          />
        </div>

        {/* Filter chips row */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {/* State chips */}
            {STATE_FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setStateFilter(f)}
                className={`focus-ring h-8 border-2 px-3 text-xs font-bold uppercase tracking-wide transition-all btn-press ${
                  stateFilter === f
                    ? 'border-black bg-mint text-black shadow-hard'
                    : 'border-white/15 bg-white/[0.04] text-white/50 hover:border-white/35 hover:text-white'
                }`}
              >
                {f}
              </button>
            ))}

            {/* Divider */}
            <span className="mx-1 w-px self-stretch bg-white/15" />

            {/* Oracle chips */}
            {ORACLE_FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setOracleFilter(oracleFilter === f ? 'All' : f)}
                className={`focus-ring h-8 border-2 px-3 text-xs font-bold uppercase tracking-wide transition-all btn-press ${
                  oracleFilter === f
                    ? 'border-blue/60 bg-blue/20 text-blue shadow-hard-blue'
                    : 'border-white/15 bg-white/[0.04] text-white/50 hover:border-white/35 hover:text-white'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2 text-xs text-white/40">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="focus-ring border-2 border-white/15 bg-ink px-2.5 py-1.5 text-xs font-semibold text-white/70"
            >
              {SORTS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Results count */}
      {!loading && (
        <p className="text-xs font-medium text-white/35">
          {visible.length} market{visible.length !== 1 ? 's' : ''}
          {query && <span> matching &ldquo;{query}&rdquo;</span>}
        </p>
      )}

      {/* Grid */}
      {loading && !source.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-48 animate-pulse border-2 border-white/8 bg-white/[0.03]"
            />
          ))}
        </div>
      ) : visible.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((market) => (
            <MarketCard key={market.id} market={market} />
          ))}
        </div>
      ) : (
        <div className="border-2 border-white/10 bg-white/[0.025] p-10 text-center shadow-hard">
          <p className="text-base font-medium text-white/45">No markets match your filters.</p>
          <button
            type="button"
            onClick={() => { setQuery(''); setStateFilter('All'); setOracleFilter('All') }}
            className="mt-4 border-2 border-mint/40 bg-mint/10 px-4 py-2 text-sm font-bold text-mint shadow-hard-gold transition-colors hover:bg-mint hover:text-black btn-press"
          >
            Clear filters
          </button>
        </div>
      )}
    </section>
  )
}
