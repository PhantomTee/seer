'use client'

import { useEffect, useState } from 'react'
import type { Position, UserAlert } from '@/types/position'
import { getBrowserSupabase } from '@/lib/supabase'

export function usePositions(userAddress?: string) {
  const [positions, setPositions] = useState<Position[]>([])
  const [alerts, setAlerts] = useState<UserAlert[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!userAddress) return
    let active = true
    setLoading(true)

    fetch(`/api/positions?user=${userAddress}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<{ positions?: Position[]; alerts?: UserAlert[] }>
      })
      .then((payload) => {
        if (!active) return
        setPositions(payload.positions ?? [])
        setAlerts(payload.alerts ?? [])
      })
      .catch(() => {
        if (active) { setPositions([]); setAlerts([]) }
      })
      .finally(() => { if (active) setLoading(false) })

    const supabase = getBrowserSupabase()
    const channel = supabase
      ?.channel(`alerts-${userAddress}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_alerts' }, (payload) => {
        const alert = payload.new as UserAlert
        if (alert.user_address.toLowerCase() === userAddress.toLowerCase()) {
          setAlerts((prev) => [alert, ...prev])
        }
      })
      .subscribe()

    return () => {
      active = false
      if (supabase && channel) void supabase.removeChannel(channel)
    }
  }, [userAddress])

  return { positions, alerts, loading }
}
