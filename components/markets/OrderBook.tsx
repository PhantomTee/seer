'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

interface OrderBookEntry {
  price: number
  size: number
  outcome: 'YES' | 'NO'
}

export function OrderBookDepth({ marketId }: { marketId?: string }) {
  const [bids, setBids] = useState<OrderBookEntry[]>([])
  const [asks, setAsks] = useState<OrderBookEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabaseUrl || !supabaseAnonKey || !marketId) {
      setLoading(false)
      return
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // Load open limit orders from trades table (order_type = 'limit', status = 'open')
    async function load() {
      const { data } = await supabase
        .from('trades')
        .select('outcome, price, amount, order_type, status')
        .eq('market_id', marketId)
        .eq('order_type', 'limit')
        .eq('status', 'open')
        .order('price', { ascending: false })

      if (data && data.length > 0) {
        const yesBids: OrderBookEntry[] = []
        const noAsks: OrderBookEntry[] = []
        for (const row of data) {
          if (row.outcome === 'YES') {
            yesBids.push({ price: row.price, size: row.amount, outcome: 'YES' })
          } else {
            noAsks.push({ price: row.price, size: row.amount, outcome: 'NO' })
          }
        }
        setBids(yesBids)
        setAsks(noAsks)
      }

      setLoading(false)
    }

    load()

    // Realtime subscription
    const channel = supabase
      .channel(`orderbook-${marketId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trades', filter: `market_id=eq.${marketId}` }, () => {
        load()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [marketId])

  if (loading) {
    return (
      <div className="border border-white/10 bg-white/[0.035] p-4 shadow-hard">
        <h2 className="mb-3 text-sm font-semibold text-white">Order Book</h2>
        <div className="py-6 text-center text-xs text-white/30">Loading…</div>
      </div>
    )
  }

  const empty = bids.length === 0 && asks.length === 0

  return (
    <div className="border border-white/10 bg-white/[0.035] p-4 shadow-hard">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Order Book</h2>
        <span className="text-xs text-white/45">On-chain CLOB</span>
      </div>

      {empty ? (
        <div className="py-6 text-center text-xs text-white/30">
          No open limit orders
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <DepthTable title="Bids" rows={bids} tone="text-mint" />
          <DepthTable title="Asks" rows={asks} tone="text-danger" />
        </div>
      )}
    </div>
  )
}

function DepthTable({ title, rows, tone }: { title: string; rows: OrderBookEntry[]; tone: string }) {
  if (rows.length === 0) {
    return (
      <div>
        <div className="mb-2 text-xs uppercase text-white/35">{title}</div>
        <div className="py-4 text-center text-xs text-white/25">—</div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-2 grid grid-cols-2 text-xs uppercase text-white/35">
        <span>{title}</span>
        <span className="text-right">Size</span>
      </div>
      <div className="space-y-1">
        {rows.map((row, i) => (
          <div key={i} className="grid grid-cols-2 bg-white/[0.035] px-2 py-1.5 text-sm">
            <span className={tone}>{(row.price * 100).toFixed(0)}%</span>
            <span className="text-right text-white/65">{row.size.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
