'use client'

import { CircleDollarSign } from 'lucide-react'
import { formatUnits } from 'viem'
import { useAccount, useBalance, useChainId } from 'wagmi'
import { ARC_TESTNET } from '@/constants/arc'

export function USDCBalance() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const onArc = chainId === ARC_TESTNET.chainId

  // Read native USDC balance on Arc (USDC is Arc's native gas token, 18 decimals)
  const { data: balance } = useBalance({
    address,
    chainId: ARC_TESTNET.chainId,
    query: { enabled: isConnected && Boolean(address) },
  })

  if (!isConnected || !address) return null

  if (!onArc) {
    return (
      <div className="inline-flex items-center gap-2 border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/40">
        <CircleDollarSign className="h-4 w-4 text-white/25" />
        Switch to Arc
      </div>
    )
  }

  const formatted = balance
    ? Number(formatUnits(balance.value, balance.decimals)).toFixed(2)
    : '0.00'

  return (
    <div className="inline-flex items-center gap-2 border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/75">
      <CircleDollarSign className="h-4 w-4 text-mint" />
      {formatted} USDC
    </div>
  )
}
