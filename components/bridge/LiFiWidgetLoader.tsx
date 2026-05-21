'use client'

import dynamic from 'next/dynamic'

// @lifi/widget uses browser-only APIs — must not SSR.
// This client wrapper owns the dynamic import so the Server Component
// bridge page can remain server-rendered.
const LiFiBridgeWidget = dynamic(
  () => import('./LiFiWidget').then((m) => m.LiFiBridgeWidget),
  { ssr: false }
)

export function LiFiWidgetLoader() {
  return <LiFiBridgeWidget />
}
