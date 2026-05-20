'use client'

import { CircleDollarSign } from 'lucide-react'
import { formatUnits } from 'viem'
import { useAccount, useReadContract } from 'wagmi'
import { ARC_CONTRACTS } from '@/constants/arc'
import { erc20Abi } from '@/lib/contracts'

export function USDCBalance() {
  const { address } = useAccount()
  const { data } = useReadContract({
    address: ARC_CONTRACTS.USDC,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) }
  })

  return (
    <div className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/75">
      <CircleDollarSign className="h-4 w-4 text-mint" />
      {data ? `${Number(formatUnits(data, 6)).toFixed(2)} USDC` : '0.00 USDC'}
    </div>
  )
}
