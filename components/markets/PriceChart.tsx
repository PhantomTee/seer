'use client'

import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useEffect, useMemo, useState } from 'react'
import type { Trade } from '@/types/market'

const RANGES = ['1H', '6H', '1D', '1W'] as const
type Range = (typeof RANGES)[number]

const RANGE_MS: Record<Range, number> = {
  '1H': 60 * 60 * 1000,
  '6H': 6 * 60 * 60 * 1000,
  '1D': 24 * 60 * 60 * 1000,
  '1W': 7 * 24 * 60 * 60 * 1000
}

function buildChartData(trades: Trade[], range: Range) {
  const cutoff = Date.now() - RANGE_MS[range]
  return trades
    .filter((t) => new Date(t.created_at).getTime() >= cutoff)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((t) => ({
      name: new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      yes: Math.round(Number(t.price) * 100)
    }))
}

export function PriceChart({ trades }: { trades: Trade[] }) {
  const [mounted, setMounted] = useState(false)
  const [range, setRange] = useState<Range>('1D')

  useEffect(() => setMounted(true), [])

  const data = useMemo(() => buildChartData(trades, range), [trades, range])

  const latest = data[data.length - 1]?.yes
  const first = data[0]?.yes
  const delta = latest !== undefined && first !== undefined ? latest - first : null
  const deltaSign = delta !== null && delta >= 0 ? '+' : ''

  return (
    <div className="border-2 border-white/15 bg-white/[0.035] p-5 shadow-hard">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl tracking-wider text-white">PROBABILITY CHART</h2>
          {latest !== undefined ? (
            <div className="mt-1.5 flex items-baseline gap-3">
              <span className="font-display text-4xl leading-none tracking-wider text-mint">
                {latest}%
              </span>
              {delta !== null && (
                <span className={`text-sm font-bold ${delta >= 0 ? 'text-mint/80' : 'text-danger/80'}`}>
                  {deltaSign}{delta}% in window
                </span>
              )}
            </div>
          ) : (
            <p className="mt-1.5 text-sm text-white/35">No trades yet in this window</p>
          )}
          <p className="mt-0.5 text-[11px] text-white/30">chance of YES resolving</p>
        </div>

        <div className="flex gap-1 border-2 border-white/10 bg-ink/60 p-1">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`h-7 border px-3 text-[11px] font-bold transition-colors btn-press ${
                range === r
                  ? 'border-mint bg-mint/20 text-mint'
                  : 'border-transparent text-white/30 hover:text-white/60'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {mounted && data.length > 1 ? (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="yesGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#FFD600" stopOpacity={0.22} />
                <stop offset="95%" stopColor="#FFD600" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="name"
              tick={{ fill: 'rgba(255,255,255,0.28)', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: 'rgba(255,255,255,0.28)', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <ReferenceLine
              y={50}
              stroke="rgba(255,255,255,0.08)"
              strokeDasharray="4 3"
              label={{ value: '50%', fill: 'rgba(255,255,255,0.18)', fontSize: 10 }}
            />
            <Tooltip
              contentStyle={{
                background: '#0c0c0f',
                border: '2px solid rgba(255,214,0,0.3)',
                borderRadius: 0,
                fontSize: 12,
                fontWeight: 600
              }}
              formatter={(value) => [`${value}% chance YES`, '']}
              labelStyle={{ color: 'rgba(255,255,255,0.45)' }}
              cursor={{ stroke: 'rgba(255,214,0,0.3)', strokeWidth: 1.5 }}
            />
            <Area
              type="monotone"
              dataKey="yes"
              stroke="#FFD600"
              strokeWidth={2.5}
              fill="url(#yesGradient)"
              dot={false}
              animationDuration={900}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-[200px] items-center justify-center border border-white/8 bg-white/[0.025]">
          <p className="text-sm text-white/30">
            {!mounted ? '' : data.length === 1 ? 'Need at least 2 trades to draw chart' : 'No trades in this time window'}
          </p>
        </div>
      )}

      {trades.length > 0 && (
        <p className="mt-2 text-right text-[10px] text-white/20">
          {trades.length} trade{trades.length !== 1 ? 's' : ''} recorded
        </p>
      )}
    </div>
  )
}
