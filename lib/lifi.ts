import type { RouteExtended } from '@lifi/sdk'
import { ARC_CONTRACTS, ARC_TESTNET } from '@/constants/arc'

let configured = false

export async function initLiFi(getWalletClient?: () => Promise<unknown>) {
  if (configured) return
  const { createConfig, EVM } = await import('@lifi/sdk')
  createConfig({
    integrator: process.env.NEXT_PUBLIC_LIFI_INTEGRATOR ?? 'seer',
    apiKey: process.env.NEXT_PUBLIC_LIFI_API_KEY || undefined,
    rpcUrls: {
      [ARC_TESTNET.chainId]: [process.env.NEXT_PUBLIC_ARC_RPC_URL || ARC_TESTNET.rpcUrl]
    },
    providers: getWalletClient
      ? [
          EVM({
            getWalletClient: getWalletClient as never
          })
        ]
      : undefined
  } as never)
  configured = true
}

export async function getBridgeRoute(fromChainId: number, fromTokenAddr: string, amountIn: string, fromAddress?: string, toAddress?: string) {
  await initLiFi()
  const { getRoutes } = await import('@lifi/sdk')
  const routes = await getRoutes({
    fromChainId,
    toChainId: ARC_TESTNET.chainId,
    fromTokenAddress: fromTokenAddr,
    toTokenAddress: ARC_CONTRACTS.USDC,
    fromAmount: amountIn,
    fromAddress,
    toAddress,
    options: {
      integrator: process.env.NEXT_PUBLIC_LIFI_INTEGRATOR ?? 'seer',
      order: 'RECOMMENDED',
      bridges: { allow: ['cctp', 'cctpV2'] }
    }
  } as never)
  return routes.routes[0] ?? null
}

export async function executeBridgeRoute(route: RouteExtended) {
  const { executeRoute } = await import('@lifi/sdk')
  return executeRoute(route, {
    updateRouteHook(_updatedRoute) {
      // Route status updates handled silently — surface via UI state only
    }
  })
}
