'use client'

import { AlertTriangle } from 'lucide-react'
import { useEffect, useState, type ComponentType } from 'react'
import type { WidgetConfig } from '@lifi/widget'
import { ARC_CONTRACTS, ARC_TESTNET } from '@/constants/arc'

type LiFiWidgetComponent = ComponentType<{ config: WidgetConfig; integrator?: string }>

// Suppress LI.FI analytics SDK noise — it tries to phone home and fails in dev/testnet
// environments, flooding the console with "Analytics SDK: Failed to fetch".
if (typeof window !== 'undefined') {
  const _origError = console.error.bind(console)
  console.error = (...args: unknown[]) => {
    const msg = typeof args[0] === 'string' ? args[0] : ''
    if (msg.includes('Analytics SDK') || msg.includes('analytics')) return
    _origError(...args)
  }
}

function makeConfig(dark: boolean): WidgetConfig {
  return {
    integrator: 'seer',
    toChain: ARC_TESTNET.chainId,
    toToken: ARC_CONTRACTS.USDC,
    appearance: dark ? 'dark' : 'light',
    // Disable LI.FI's analytics pings — they fail in isolated/testnet environments
    sdkConfig: { disableAnalytics: true } as never,
    theme: dark
      ? {
          palette: {
            primary:    { main: '#FFD600' },
            secondary:  { main: '#4A9EFF' },
            background: { default: '#0c0c0f', paper: '#161618' },
            text:       { primary: '#f0f0f0', secondary: 'rgba(240,240,240,0.55)' },
            grey: { 200: '#1e1e22', 300: '#2a2a30', 700: '#3a3a42', 800: '#1e1e22' },
          },
          shape: { borderRadius: 0, borderRadiusSecondary: 0 },
          typography: { fontFamily: 'inherit' },
        }
      : {
          palette: {
            primary:    { main: '#b89100' },
            secondary:  { main: '#2276e0' },
            background: { default: '#f7f3ea', paper: '#ede9de' },
            text:       { primary: '#151210', secondary: 'rgba(21,18,16,0.55)' },
            grey: { 200: '#e5e0d5', 300: '#d8d3c8', 700: '#8a8070', 800: '#e5e0d5' },
          },
          shape: { borderRadius: 0, borderRadiusSecondary: 0 },
          typography: { fontFamily: 'inherit' },
        },
    bridges: { allow: ['cctp', 'cctpV2'] },
  } as WidgetConfig
}

export function LiFiBridgeWidget() {
  const [Widget, setWidget] = useState<LiFiWidgetComponent | null>(null)
  const [loadError, setLoadError] = useState('')
  const [isDark, setIsDark] = useState(true)

  // Sync with Seer's data-theme attribute
  useEffect(() => {
    const check = () =>
      setIsDark(document.documentElement.getAttribute('data-theme') !== 'light')
    check()
    const obs = new MutationObserver(check)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    let mounted = true
    import('@lifi/widget')
      .then((m) => { if (mounted) setWidget(() => m.LiFiWidget as LiFiWidgetComponent) })
      .catch((e) => { if (mounted) setLoadError(e instanceof Error ? e.message : 'Widget failed to load') })
    return () => { mounted = false }
  }, [])

  return (
    <div className="overflow-hidden border-2 border-white/10 bg-white/[0.035] p-2 shadow-hard">
      {Widget ? (
        <Widget config={makeConfig(isDark)} integrator="seer" />
      ) : loadError ? (
        <div className="flex min-h-[520px] flex-col items-center justify-center gap-3 px-6 text-center text-sm text-white/55">
          <AlertTriangle className="h-5 w-5 text-danger" />
          <div className="font-semibold text-white">Bridge widget unavailable</div>
          <div className="mt-1 max-w-md text-xs">{loadError}</div>
        </div>
      ) : (
        <div className="flex min-h-[520px] items-center justify-center text-sm text-white/50">
          Loading bridge…
        </div>
      )}
    </div>
  )
}
