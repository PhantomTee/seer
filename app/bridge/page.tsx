import { ExternalLink } from 'lucide-react'
import { CCTPPanel } from '@/components/bridge/CCTPPanel'
import { LiFiWidgetLoader } from '@/components/bridge/LiFiWidgetLoader'
import { ARC_TESTNET } from '@/constants/arc'

export default function BridgePage() {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">Bridge USDC</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/58">
            LI.FI routes USDC from supported source chains into Arc Testnet and prefers CCTP routes when available.
          </p>
        </div>
        <a
          href={ARC_TESTNET.faucetUrl}
          target="_blank"
          rel="noreferrer"
          className="focus-ring inline-flex h-10 items-center gap-2 rounded-md bg-mint px-3 text-sm font-semibold text-ink"
        >
          Faucet
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <LiFiWidgetLoader />
        <div className="space-y-5">
          <CCTPPanel />
          <div className="rounded-md border border-white/10 bg-white/[0.035] p-4 text-sm leading-6 text-white/58 shadow-hard">
            Arc is a USDC-native chain. Bridge or faucet USDC first, then the same asset pays gas and acts as collateral. Fast CCTP V2 transfers generally complete in seconds when source-chain finality and allowance are available.
          </div>
        </div>
      </div>
    </div>
  )
}
