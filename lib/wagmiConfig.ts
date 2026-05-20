'use client'

import { QueryClient } from '@tanstack/react-query'
import { createConfig, http } from 'wagmi'
import { arbitrum, base, mainnet, polygon, sepolia } from 'wagmi/chains'
import { coinbaseWallet, injected, metaMask } from 'wagmi/connectors'
import { arcTestnet } from './arc'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Prevent aggressive reconnect-on-mount RPC calls from spamming the console
      retry: 1,
      retryDelay: 2000,
      staleTime: 4_000,
    },
    mutations: {
      retry: 0,
    },
  },
})

export const supportedChains = [arcTestnet, sepolia, mainnet, arbitrum, base, polygon] as const

export const wagmiConfig = createConfig({
  chains: supportedChains,
  connectors: [
    injected(),
    metaMask(),
    coinbaseWallet({ appName: 'Seer' })
  ],
  transports: {
    [arcTestnet.id]: http(process.env.NEXT_PUBLIC_ARC_RPC_URL || arcTestnet.rpcUrls.default.http[0], {
      timeout: 10_000,
      retryCount: 1,
    }),
    [sepolia.id]: http(),
    [mainnet.id]: http(),
    [arbitrum.id]: http(),
    [base.id]: http(),
    [polygon.id]: http()
  },
  ssr: true
})
