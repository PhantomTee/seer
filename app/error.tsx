'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[ArcPredict] Unhandled error:', error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center border-2 border-danger/50 bg-danger/10 shadow-hard-danger">
        <AlertTriangle className="h-9 w-9 text-danger" />
      </div>

      <h1 className="font-display text-5xl tracking-wider text-danger">SOMETHING BROKE</h1>

      <p className="mt-4 max-w-md text-base text-white/55">
        {error.message
          ? error.message.slice(0, 200)
          : 'An unexpected error occurred. Try refreshing — if it persists, check the console.'}
      </p>

      {error.digest && (
        <p className="mt-2 font-mono text-xs text-white/25">Error ID: {error.digest}</p>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="focus-ring inline-flex h-11 items-center gap-2 border-2 border-black bg-mint px-5 font-bold text-black shadow-hard btn-press"
        >
          <RefreshCw className="h-4 w-4" />
          Try Again
        </button>
        <a
          href="/"
          className="focus-ring inline-flex h-11 items-center gap-2 border-2 border-white/20 bg-white/[0.06] px-5 font-bold text-white/70 shadow-hard btn-press hover:border-white/35 hover:text-white"
        >
          Go Home
        </a>
      </div>
    </div>
  )
}
