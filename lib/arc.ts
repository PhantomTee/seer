import { defineChain } from 'viem'
import { ARC_TESTNET } from '@/constants/arc'

export const arcTestnet = defineChain({
  id: ARC_TESTNET.chainId,
  name: ARC_TESTNET.name,
  nativeCurrency: ARC_TESTNET.nativeCurrency,
  rpcUrls: {
    default: {
      http: [ARC_TESTNET.rpcUrl],
      webSocket: [ARC_TESTNET.wsUrl]
    }
  },
  blockExplorers: {
    default: {
      name: 'ArcScan',
      url: ARC_TESTNET.explorerUrl
    }
  },
  testnet: true
})
