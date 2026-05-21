'use client'

import { useEffect } from 'react'

// Suppresses console.error noise from third-party SDKs (LI.FI analytics,
// Miden wallet) that fire "Failed to fetch" when they can't reach their
// own analytics/telemetry endpoints.
// This does NOT suppress errors from our own code.
const NOISE_PATTERNS = [
  'Analytics SDK',
  'Locize',
  'i18next',
]

export function SuppressThirdPartyErrors() {
  useEffect(() => {
    const original = console.error.bind(console)
    console.error = (...args: unknown[]) => {
      const msg = String(args[0] ?? '')
      if (NOISE_PATTERNS.some((p) => msg.includes(p))) return
      original(...args)
    }
    return () => {
      console.error = original
    }
  }, [])

  return null
}
