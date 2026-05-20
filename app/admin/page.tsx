'use client'

import { CheckCircle2, Loader2, ShieldAlert, Zap } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAccount, useChainId, useSignMessage, useSwitchChain } from 'wagmi'
import { ARC_TESTNET } from '@/constants/arc'
import type { Market } from '@/types/market'

// Hardcoded — intentionally not in env vars
const ADMIN_ADDRESS = '0xf869c7b8a19146a4bbd5466e83c3b785ae7ee148'

type ResolveStatus = 'idle' | 'signing' | 'pending' | 'done' | 'error'

interface MarketStatus {
  state: ResolveStatus
  message: string
}

export default function AdminPage() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChainAsync } = useSwitchChain()
  const { signMessageAsync } = useSignMessage()

  const [markets, setMarkets] = useState<Market[]>([])
  const [loading, setLoading] = useState(true)
  const [statuses, setStatuses] = useState<Record<number, MarketStatus>>({})

  const isAdmin = isConnected && address?.toLowerCase() === ADMIN_ADDRESS

  useEffect(() => {
    if (!isAdmin) return
    fetch('/api/markets')
      .then((r) => r.json() as Promise<{ markets?: Market[] }>)
      .then((d) => setMarkets((d.markets ?? []).filter((m) => m.state === 'OPEN' || m.state === 'RESOLVING')))
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [isAdmin])

  function setStatus(marketId: number, state: ResolveStatus, message: string) {
    setStatuses((s) => ({ ...s, [marketId]: { state, message } }))
  }

  async function handleResolve(market: Market, outcomeIndex: number) {
    const st = statuses[market.id]
    if (st?.state === 'pending' || st?.state === 'signing') return

    try {
      // Ensure on Arc
      if (chainId !== ARC_TESTNET.chainId) {
        setStatus(market.id, 'signing', 'Switching to Arc Testnet…')
        await switchChainAsync({ chainId: ARC_TESTNET.chainId })
      }

      // Build deterministic message (server will verify exact string)
      const message = `SEER Admin: resolve market ${market.id} as outcome ${outcomeIndex}`
      setStatus(market.id, 'signing', 'Sign in MetaMask to confirm…')

      const signature = await signMessageAsync({ message })

      setStatus(market.id, 'pending', 'Submitting on-chain…')
      const res = await fetch('/api/admin/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketId: market.id, outcomeIndex, message, signature }),
      })
      const data = await res.json() as { success?: boolean; txHash?: string; error?: string }

      if (!res.ok || data.error) {
        setStatus(market.id, 'error', data.error ?? 'Resolution failed')
        return
      }

      setStatus(market.id, 'done', `Resolved → ${market.outcome_labels[outcomeIndex] ?? outcomeIndex} · ${data.txHash?.slice(0, 10)}…`)

      // Optimistically update local market state
      setMarkets((prev) =>
        prev.map((m) =>
          m.id === market.id ? { ...m, state: 'RESOLVING', winning_outcome: outcomeIndex } : m
        )
      )
    } catch (err) {
      setStatus(market.id, 'error', err instanceof Error ? err.message : 'Failed')
    }
  }

  // ── Not admin (or not connected) — look like a generic 404 ──────────────
  if (!isAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="max-w-sm text-center">
          <p className="font-display text-6xl text-white/10">404</p>
          <p className="mt-3 text-sm text-white/30">Page not found.</p>
        </div>
      </div>
    )
  }

  // ── Admin panel ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3 border-b-2 border-white/10 pb-5">
        <div className="flex h-10 w-10 items-center justify-center border-2 border-mint bg-mint/10">
          <ShieldAlert className="h-5 w-5 text-mint" />
        </div>
        <div>
          <h1 className="font-display text-4xl tracking-wider text-white">ADMIN</h1>
          <p className="text-xs text-white/35">
            Signed in as <span className="font-mono text-mint/70">{address}</span>
          </p>
        </div>
      </div>

      {/* Cron triggers */}
      <section className="border-2 border-white/10 bg-white/[0.035] p-5 shadow-hard">
        <h2 className="mb-4 font-display text-xl tracking-wider text-white">AGENT TRIGGERS</h2>
        <div className="flex flex-wrap gap-3">
          <CronButton label="Run resolve" endpoint="/api/agent/resolve" secret={null} />
          <CronButton label="Run monitor" endpoint="/api/agent/monitor" secret={null} />
          <CronButton label="Run suggest" endpoint="/api/agent/suggest" secret={null} />
        </div>
        <p className="mt-3 text-[11px] text-white/30">
          Manually trigger the agent cron jobs. In production these fire via GitHub Actions.
        </p>
      </section>

      {/* Market resolution */}
      <section className="border-2 border-white/10 bg-white/[0.035] p-5 shadow-hard">
        <h2 className="mb-1 font-display text-xl tracking-wider text-white">RESOLVE MARKETS</h2>
        <p className="mb-5 text-xs text-white/40">
          ADMIN and OPTIMISTIC markets. Sign with your admin wallet to resolve on-chain.
        </p>

        {loading ? (
          <div className="flex items-center gap-3 py-8 text-white/35">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading markets…</span>
          </div>
        ) : markets.length === 0 ? (
          <div className="border border-white/10 bg-ink/40 p-6 text-center text-sm text-white/35">
            No open or resolving markets.
          </div>
        ) : (
          <div className="space-y-3">
            {markets.map((market) => {
              const st = statuses[market.id]
              const busy = st?.state === 'signing' || st?.state === 'pending'
              const done = st?.state === 'done'

              return (
                <div
                  key={market.id}
                  className={`border-2 p-4 transition-colors ${
                    done ? 'border-mint/30 bg-mint/[0.04]' : 'border-white/10 bg-ink/40'
                  }`}
                >
                  {/* Market header */}
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">
                          #{market.id}
                        </span>
                        <span className={`border px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                          market.state === 'OPEN'
                            ? 'border-mint/40 text-mint'
                            : 'border-amber/40 text-amber'
                        }`}>
                          {market.state}
                        </span>
                        <span className="border border-white/15 px-1.5 py-0.5 text-[10px] text-white/40">
                          {market.oracle_mode}
                        </span>
                      </div>
                      <p className="text-sm font-semibold leading-5 text-white">{market.question}</p>
                      <p className="mt-0.5 text-[11px] text-white/35">
                        Resolves {new Date(market.resolution_time).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Status message */}
                  {st?.message && (
                    <div className={`mb-3 text-xs font-semibold ${
                      st.state === 'error' ? 'text-danger' :
                      st.state === 'done' ? 'text-mint' : 'text-amber'
                    }`}>
                      {st.state === 'signing' || st.state === 'pending'
                        ? <span className="flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" />{st.message}</span>
                        : st.state === 'done'
                          ? <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3" />{st.message}</span>
                          : st.message
                      }
                    </div>
                  )}

                  {/* Outcome buttons */}
                  {!done && (
                    <div className="flex flex-wrap gap-2">
                      {market.outcome_labels.map((label, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleResolve(market, i)}
                          disabled={busy}
                          className={`focus-ring inline-flex items-center gap-2 border-2 px-4 py-2 text-sm font-bold btn-press disabled:opacity-50 transition-colors ${
                            i === 0
                              ? 'border-mint/60 bg-mint/10 text-mint hover:bg-mint hover:text-black hover:border-black'
                              : i === 1
                                ? 'border-danger/60 bg-danger/10 text-danger hover:bg-danger hover:text-white hover:border-black'
                                : 'border-white/20 bg-white/[0.04] text-white/70 hover:bg-white/[0.1]'
                          }`}
                        >
                          <Zap className="h-3.5 w-3.5" />
                          Resolve as {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

// ── Cron trigger button ─────────────────────────────────────────────────────
function CronButton({ label, endpoint }: { label: string; endpoint: string; secret: null }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [result, setResult] = useState('')

  async function run() {
    setState('loading')
    setResult('')
    try {
      const res = await fetch(endpoint, { method: 'POST' })
      const data = await res.json() as Record<string, unknown>
      if (!res.ok) {
        setState('error')
        setResult((data.error as string) ?? `HTTP ${res.status}`)
      } else {
        setState('done')
        setResult(JSON.stringify(data).slice(0, 120))
      }
    } catch (err) {
      setState('error')
      setResult(err instanceof Error ? err.message : 'Failed')
    }
    setTimeout(() => setState('idle'), 5000)
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={run}
        disabled={state === 'loading'}
        className={`focus-ring inline-flex items-center gap-2 border px-3 py-2 text-xs font-semibold btn-press transition-colors disabled:opacity-50 ${
          state === 'done' ? 'border-mint/40 bg-mint/10 text-mint' :
          state === 'error' ? 'border-danger/40 bg-danger/10 text-danger' :
          'border-white/15 bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white'
        }`}
      >
        {state === 'loading' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {state === 'done' && <CheckCircle2 className="h-3.5 w-3.5" />}
        {(state === 'idle' || state === 'error') && <Zap className="h-3.5 w-3.5" />}
        {label}
      </button>
      {result && (
        <p className={`max-w-xs truncate text-[10px] ${state === 'error' ? 'text-danger/70' : 'text-white/35'}`}>
          {result}
        </p>
      )}
    </div>
  )
}
