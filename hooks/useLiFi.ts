'use client'

import { useCallback, useState } from 'react'
import type { RouteExtended } from '@lifi/sdk'
import { executeBridgeRoute, getBridgeRoute } from '@/lib/lifi'

export function useLiFi() {
  const [route, setRoute] = useState<RouteExtended | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'executing' | 'done' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  const quote = useCallback(async (fromChainId: number, fromToken: string, amount: string, fromAddress?: string, toAddress?: string) => {
    setStatus('loading')
    setError(null)
    try {
      const nextRoute = await getBridgeRoute(fromChainId, fromToken, amount, fromAddress, toAddress)
      setRoute(nextRoute)
      setStatus(nextRoute ? 'ready' : 'idle')
      return nextRoute
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setStatus('error')
      return null
    }
  }, [])

  const execute = useCallback(async () => {
    if (!route) return null
    setStatus('executing')
    try {
      const result = await executeBridgeRoute(route)
      setStatus('done')
      return result
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setStatus('error')
      return null
    }
  }, [route])

  return { route, status, error, quote, execute }
}
