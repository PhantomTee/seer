'use client'

import { Bot, RefreshCcw, Send } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Market } from '@/types/market'

/** Render a line of text, converting **word** spans into <strong> elements */
function BoldLine({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**')
          ? <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>
          : <span key={i}>{part}</span>
      )}
    </>
  )
}

/** Render the full agent response with bold support and visual section breaks */
function AgentResponse({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div className="space-y-1 text-sm leading-6 text-white/70">
      {lines.map((line, i) => {
        if (line.trim() === '') return <div key={i} className="h-2" />
        // Section header lines (start with **) get slightly more emphasis
        const isSectionHeader = /^\*\*[^*]/.test(line.trim())
        return (
          <div key={i} className={isSectionHeader ? 'mt-3 first:mt-0' : ''}>
            <BoldLine text={line} />
          </div>
        )
      })}
    </div>
  )
}

const TIMEOUT_MS = 30_000

export function AgentChat({ market, compact = false }: { market?: Market; compact?: boolean }) {
  const [prompt, setPrompt] = useState(
    market ? `Analyze market ${market.id}` : 'What markets look mispriced today?'
  )
  const [analysis, setAnalysis] = useState('')
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const askAgent = useCallback(
    async (nextPrompt?: string) => {
      const question = nextPrompt ?? prompt
      // Abort any in-flight request before starting a new one
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

      setLoading(true)
      try {
        const response = await fetch('/api/agent/chat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            marketId: market?.id,
            question: market?.question ?? question,
            resolutionCriteria: market?.ipfs_metadata_cid ?? question,
          }),
          signal: controller.signal,
        })

        if (!response.ok) {
          setAnalysis(`Agent error (${response.status}): ${response.statusText}`)
          return
        }

        const payload = await response.json() as { analysis?: string; error?: string }
        setAnalysis(payload.analysis ?? payload.error ?? 'No response from agent.')
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          setAnalysis('Request timed out. Try again.')
        } else {
          setAnalysis(
            'Agent unavailable — check GROQ_API_KEY in .env.local or try again shortly.'
          )
        }
      } finally {
        clearTimeout(timer)
        setLoading(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [market?.id, market?.question, market?.ipfs_metadata_cid, prompt]
  )

  useEffect(() => {
    if (market) void askAgent()
    return () => abortRef.current?.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market?.id])

  return (
    <div className="border-2 border-white/10 bg-white/[0.035] p-4 shadow-hard">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-xl tracking-wider text-white">
          <Bot className="h-4 w-4 text-mint" />
          {compact ? 'AI Context' : 'Chat with Agent'}
        </h2>
        <button
          type="button"
          onClick={() => void askAgent()}
          disabled={loading}
          className="focus-ring inline-flex h-8 items-center gap-2 border border-white/10 px-2 text-xs font-semibold text-white/60 hover:bg-white/8 disabled:opacity-40"
        >
          <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {!compact && (
        <div className="mb-3 flex gap-2">
          <input
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && void askAgent()}
            className="focus-ring h-10 min-w-0 flex-1 border border-white/10 bg-ink px-3 text-sm text-white"
          />
          <button
            onClick={() => void askAgent()}
            type="button"
            disabled={loading}
            className="focus-ring flex h-10 w-10 items-center justify-center border-2 border-black bg-mint text-black disabled:opacity-40 btn-press"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="min-h-32 border border-white/10 bg-ink/80 p-3">
        {loading ? (
          <span className="text-sm text-white/40">Searching current context…</span>
        ) : analysis ? (
          <AgentResponse text={analysis} />
        ) : (
          <span className="text-sm text-white/40">Ask the agent for current probability, sources, and risks.</span>
        )}
      </div>
    </div>
  )
}
