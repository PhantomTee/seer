'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Market } from '@/types/market'
import { getBrowserSupabase } from '@/lib/supabase'

export function useMarkets(filter?: { state?: string }) {
  const [markets, setMarkets] = useState<Market[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    fetch('/api/markets')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<{ markets?: Market[] }>
      })
      .then((payload) => {
        if (active) setMarkets(payload.markets ?? [])
      })
      .catch(() => {
        // Network error — keep empty state
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    const supabase = getBrowserSupabase()
    const channel = supabase
      ?.channel('markets-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'markets' }, (payload) => {
        setMarkets((prev) => {
          if (payload.eventType === 'INSERT') return [payload.new as Market, ...prev]
          if (payload.eventType === 'UPDATE') return prev.map((market) => (market.id === payload.new.id ? (payload.new as Market) : market))
          if (payload.eventType === 'DELETE') return prev.filter((market) => market.id !== payload.old.id)
          return prev
        })
      })
      .subscribe()

    return () => {
      active = false
      if (supabase && channel) void supabase.removeChannel(channel)
    }
  }, [])

  const filtered = useMemo(() => {
    if (!filter?.state) return markets
    return markets.filter((market) => market.state === filter.state)
  }, [filter?.state, markets])

  return { markets: filtered, allMarkets: markets, loading }
}
