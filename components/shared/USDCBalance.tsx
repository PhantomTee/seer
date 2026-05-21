'use client'

import { CircleDollarSign } from 'lucide-react'
import { formatUnits } from 'viem'
import { useAccount, useBalance, useReadContract } from 'wagmi'
import { ARC_CONTRACTS, ARC_TESTNET } from '@/constants/arc'
import { erc20Abi } from '@/lib/contracts'

export function USDCBalance() {
  const { address } = useAccount()

  // Primary: native USDC balance (Arc's gas token, 18 decimals) — pinned to Arc chain
  const { data: nativeBalance } = useBalance({
    address,
    chainId: ARC_TESTNET.chainId,
    query: { enabled: Boolean(address) },
  })

  // Fallback: ERC-20 balanceOf (6 decimals) — pinned to Arc chain
  const { data: erc20Balance } = useReadContract({
    address: ARC_CONTRACTS.USDC,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: ARC_TESTNET.chainId,
    query: { enabled: Boolean(address) },
  })

  // Prefer native balance; fall back to ERC-20 if native is zero/missing
  let display = '—'
  if (nativeBalance && nativeBalance.value > 0n) {
    display = `${Number(formatUnits(nativeBalance.value, 18)).toFixed(2)} USDC`
  } else if (erc20Balance && (erc20Balance as bigint) > 0n) {
    display = `${Number(formatUnits(erc20Balance as bigint, 6)).toFixed(2)} USDC`
  } else if (address) {
    display = '0.00 USDC'
  }

  return (
    <div className="inline-flex items-center gap-2 border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/75">
      <CircleDollarSign className="h-4 w-4 text-mint" />
      {display}
    </div>
  )
}
