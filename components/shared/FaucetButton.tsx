'use client'

import { Droplets, ExternalLink, Loader2 } from 'lucide-react'
import { useState } from 'react'

interface FaucetButtonProps {
  address: string
  /** Visual variant — 'default' for inline, 'compact' for icon-only style */
  variant?: 'default' | 'compact'
  label?: string
}

export function FaucetButton({ address, variant = 'default', label }: FaucetButtonProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [msg, setMsg] = useState('')

  async function handleDrip() {
    if (!address || status === 'loading') return
    setStatus('loading')
    setMsg('')

    try {
      const res = await fetch('/api/faucet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, native: true, usdc: true }),
      })
      const data = await res.json() as { success?: boolean; fallback?: string; error?: string }

      if (data.fallback) {
        // No API key configured — open faucet UI
        window.open(data.fallback, '_blank', 'noopener,noreferrer')
        setStatus('idle')
        return
      }

      if (!res.ok || data.error) {
        setStatus('error')
        setMsg(data.error ?? 'Faucet request failed')
        setTimeout(() => { setStatus('idle'); setMsg('') }, 4000)
        return
      }

      setStatus('success')
      setMsg('Tokens sent! May take ~30s to arrive.')
      setTimeout(() => { setStatus('idle'); setMsg('') }, 5000)
    } catch (err) {
      setStatus('error')
      setMsg(err instanceof Error ? err.message : 'Network error')
      setTimeout(() => { setStatus('idle'); setMsg('') }, 4000)
    }
  }

  const idle = status === 'idle'
  const loading = status === 'loading'
  const success = status === 'success'
  const error = status === 'error'

  if (variant === 'compact') {
    return (
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={handleDrip}
          disabled={loading}
          title="Request testnet USDC from faucet"
          className="focus-ring inline-flex items-center gap-1 border border-white/10 px-2 py-1 text-[11px] text-white/50 hover:text-white btn-press disabled:opacity-40"
        >
          {loading
            ? <Loader2 className="h-3 w-3 animate-spin" />
            : <Droplets className="h-3 w-3 text-sky-400" />
          }
          {loading ? 'Sending…' : (label ?? 'Faucet')}
          {idle && !loading && <ExternalLink className="h-2.5 w-2.5 opacity-40" />}
        </button>
        {msg && (
          <p className={`text-[10px] leading-4 ${success ? 'text-mint' : 'text-danger'}`}>{msg}</p>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={handleDrip}
        disabled={loading}
        className={`focus-ring inline-flex items-center gap-2 border px-3 py-2 text-sm font-semibold transition-colors btn-press disabled:opacity-50 ${
          success
            ? 'border-mint/40 bg-mint/10 text-mint'
            : error
              ? 'border-danger/40 bg-danger/10 text-danger'
              : 'border-white/15 bg-white/[0.04] text-white/70 hover:bg-white/[0.09] hover:text-white'
        }`}
      >
        {loading
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : <Droplets className={`h-4 w-4 ${success ? 'text-mint' : error ? 'text-danger' : 'text-sky-400'}`} />
        }
        {loading
          ? 'Requesting tokens…'
          : success
            ? 'Tokens requested!'
            : error
              ? 'Faucet failed'
              : (label ?? 'Get testnet USDC')}
        {idle && !loading && <ExternalLink className="h-3 w-3 opacity-30" />}
      </button>
      {msg && (
        <p className={`text-xs leading-4 ${success ? 'text-mint/70' : 'text-danger/80'}`}>{msg}</p>
      )}
    </div>
  )
}
