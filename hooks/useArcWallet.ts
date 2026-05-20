'use client'

import { useMemo } from 'react'
import { formatUnits } from 'viem'
import { useAccount, useBalance, useChainId, useSwitchChain } from 'wagmi'
import { ARC_CONTRACTS, ARC_TESTNET } from '@/constants/arc'

export function useArcWallet() {
  const account = useAccount()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  const { data: usdcBalance } = useBalance({
    address: account.address,
    token: ARC_CONTRACTS.USDC,
    chainId: ARC_TESTNET.chainId,
    query: { enabled: Boolean(account.address) }
  })

  return useMemo(
    () => ({
      ...account,
      chainId,
      isArc: chainId === ARC_TESTNET.chainId,
      switchToArc: () => switchChain({ chainId: ARC_TESTNET.chainId }),
      usdcBalance: usdcBalance ? Number(formatUnits(usdcBalance.value, 6)) : 0
    }),
    [account, chainId, switchChain, usdcBalance]
  )
}
