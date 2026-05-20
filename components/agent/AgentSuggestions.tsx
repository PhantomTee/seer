'use client'

import { Lightbulb, Loader2, PlusCircle, RefreshCcw, Sparkles, ThumbsUp } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import type { MarketSuggestion } from '@/types/agent'

export function AgentSuggestions() {
  const [suggestions, setSuggestions] = useState<MarketSuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  const fetchSuggestions = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/agent/suggest')
      if (!res.ok) throw new Error(`Agent returned ${res.status}`)
      const payload = (await res.json()) as { suggestions?: MarketSuggestion[] }
      setSuggestions(payload.suggestions ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load suggestions')
    } finally {
      setLoading(false)
    }
  }, [])

  const generateSuggestions = useCallback(async () => {
    setGenerating(true)
    setError('')
    try {
      const res = await fetch('/api/agent/suggest', { method: 'POST' })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `Generate returned ${res.status}`)
      }
      const payload = (await res.json()) as { suggestions?: MarketSuggestion[] }
      // Merge new into existing (server already persisted them; re-fetch to get IDs)
      if ((payload.suggestions?.length ?? 0) > 0) {
        await fetchSuggestions()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate suggestions')
    } finally {
      setGenerating(false)
    }
  }, [fetchSuggestions])

  // On mount: load existing suggestions; auto-generate if none exist
  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')

    fetch('/api/agent/suggest')
      .then((res) => {
        if (!res.ok) throw new Error(`Agent returned ${res.status}`)
        return res.json() as Promise<{ suggestions?: MarketSuggestion[] }>
      })
      .then((payload) => {
        if (!active) return
        const list = payload.suggestions ?? []
        setSuggestions(list)
        setLoading(false)
        // Auto-generate if DB is empty
        if (list.length === 0 && active) {
          setGenerating(true)
          fetch('/api/agent/suggest', { method: 'POST' })
            .then((r) => r.json() as Promise<{ suggestions?: MarketSuggestion[] }>)
            .then((p) => {
              if (!active) return
              return fetch('/api/agent/suggest')
                .then((r) => r.json() as Promise<{ suggestions?: MarketSuggestion[] }>)
                .then((final) => { if (active) setSuggestions(final.suggestions ?? []) })
            })
            .catch(() => undefined)
            .finally(() => { if (active) setGenerating(false) })
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to load suggestions')
          setLoading(false)
        }
      })

    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const busy = loading || generating

  return (
    <div>
      {/* Header row */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-sm text-white/45">
          AI-generated markets ready to deploy on-chain
        </p>
        <button
          type="button"
          onClick={generating ? undefined : generateSuggestions}
          disabled={busy}
          className="focus-ring inline-flex h-9 items-center gap-2 border border-white/15 px-3 text-xs font-semibold text-white/60 hover:border-mint/40 hover:text-mint disabled:opacity-40 btn-press"
        >
          {generating
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Sparkles className="h-3.5 w-3.5" />}
          {generating ? 'Generating…' : 'Generate new'}
        </button>
      </div>

      {/* States */}
      {error && (
        <div className="mb-4 border border-danger/20 bg-danger/5 p-4 text-sm text-danger/80">
          {error}
        </div>
      )}

      {loading && !generating && (
        <div className="flex items-center gap-3 py-10 text-white/40">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading suggestions…</span>
        </div>
      )}

      {generating && suggestions.length === 0 && (
        <div className="flex items-center gap-3 py-10 text-white/40">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">AI is generating market ideas…</span>
        </div>
      )}

      {!busy && !error && suggestions.length === 0 && (
        <div className="border-2 border-white/10 bg-white/[0.025] p-10 text-center">
          <p className="text-sm text-white/40">No suggestions yet.</p>
          <button
            type="button"
            onClick={generateSuggestions}
            className="focus-ring mt-4 inline-flex h-9 items-center gap-2 border border-white/15 px-4 text-sm font-semibold text-white/60 hover:border-mint/40 hover:text-mint btn-press"
          >
            <Sparkles className="h-4 w-4" />
            Generate now
          </button>
        </div>
      )}

      {/* Suggestions grid */}
      {suggestions.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {suggestions.map((suggestion) => (
            <article
              key={suggestion.id ?? suggestion.question}
              className="border-2 border-white/10 bg-white/[0.04] p-4 shadow-hard"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 bg-amber/12 px-2 py-1 text-xs text-amber">
                  <Lightbulb className="h-3.5 w-3.5" />
                  {suggestion.suggested_oracle ?? suggestion.oracle_type ?? 'OPTIMISTIC'}
                </span>
                <span className="inline-flex items-center gap-1 border border-white/10 px-2 py-1 text-xs text-white/40">
                  <ThumbsUp className="h-3.5 w-3.5" />
                  {suggestion.upvotes ?? 0}
                </span>
              </div>
              <h3 className="text-base font-semibold leading-5 text-white">{suggestion.question}</h3>
              <p className="mt-3 text-sm leading-6 text-white/58">{suggestion.rationale}</p>
              <Link
                href={`/create?question=${encodeURIComponent(suggestion.question)}`}
                className="focus-ring mt-4 inline-flex h-9 items-center gap-2 border-2 border-black bg-mint px-3 text-sm font-bold text-black btn-press"
              >
                <PlusCircle className="h-4 w-4" />
                Create market
              </Link>
            </article>
          ))}
        </div>
      )}

      {/* Refresh at bottom when suggestions are showing */}
      {suggestions.length > 0 && (
        <div className="mt-5 flex justify-center">
          <button
            type="button"
            onClick={fetchSuggestions}
            disabled={busy}
            className="focus-ring inline-flex items-center gap-2 text-xs text-white/30 hover:text-white/55 disabled:opacity-40"
          >
            <RefreshCcw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      )}
    </div>
  )
}
