'use client'

import { useCallback, useState } from 'react'
import { parseUnits } from 'viem'
import { useAccount, useChainId, usePublicClient, useSwitchChain, useWriteContract } from 'wagmi'
import { Coins, Trophy } from 'lucide-react'
import type { Position } from '@/types/position'
import { ARC_TESTNET } from '@/constants/arc'
import { conditionalTokenAbi, getContractAddresses } from '@/lib/contracts'
import type { Hex } from 'viem'

interface ClaimWinningsProps {
  positions: Position[]
  /** Map of market_id → winning_outcome_index (from the markets the user holds positions in) */
  resolvedMarkets: Map<number, number>
}

type ClaimState = 'idle' | 'pending' | 'done' | 'error'

interface ClaimStatus {
  [marketId: number]: { state: ClaimState; message: string }
}

export function ClaimWinnings({ positions, resolvedMarkets }: ClaimWinningsProps) {
  const addresses = getContractAddresses()
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const publicClient = usePublicClient()
  const { switchChainAsync } = useSwitchChain()
  const { writeContractAsync } = useWriteContract()

  const [statuses, setStatuses] = useState<ClaimStatus>({})

  // Winning positions = position in a RESOLVED market where outcome matches winning_outcome
  const winningPositions = positions.filter((p) => {
    const win = resolvedMarkets.get(p.market_id)
    return win !== undefined && win === p.outcome_index && Number(p.token_amount) > 0
  })

  async function waitFor(hash: Hex) {
    if (!publicClient) throw new Error('Arc public client is not ready')
    return publicClient.waitForTransactionReceipt({ hash })
  }

  const claimOne = useCallback(
    async (position: Position) => {
      if (!isConnected || !address) return
      if (!addresses.conditionalToken) {
        setStatuses((s) => ({ ...s, [position.market_id]: { state: 'error', message: 'ConditionalToken not deployed yet' } }))
        return
      }

      setStatuses((s) => ({ ...s, [position.market_id]: { state: 'pending', message: 'Waiting for wallet…' } }))

      try {
        if (chainId !== ARC_TESTNET.chainId) {
          await switchChainAsync({ chainId: ARC_TESTNET.chainId })
        }

        // token_amount is stored with 6 decimals (USDC-pegged tokens)
        const amount = parseUnits(String(position.token_amount), 6)

        const hash = await writeContractAsync({
          address: addresses.conditionalToken,
          abi: conditionalTokenAbi,
          functionName: 'redeem',
          args: [BigInt(position.market_id), amount]
        })

        setStatuses((s) => ({ ...s, [position.market_id]: { state: 'pending', message: 'Confirming…' } }))
        await waitFor(hash)

        setStatuses((s) => ({
          ...s,
          [position.market_id]: {
            state: 'done',
            message: `Claimed ${Number(position.token_amount).toLocaleString()} USDC · ${hash.slice(0, 10)}…`
          }
        }))
      } catch (err) {
        setStatuses((s) => ({
          ...s,
          [position.market_id]: {
            state: 'error',
            message: err instanceof Error ? err.message : 'Claim failed'
          }
        }))
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [address, isConnected, chainId, addresses.conditionalToken]
  )

  if (winningPositions.length === 0) return null

  return (
    <section className="border-2 border-mint/40 bg-mint/[0.04] p-5 shadow-hard-gold">
      <div className="mb-4 flex items-center gap-2">
        <Trophy className="h-5 w-5 text-mint" />
        <h2 className="font-display text-2xl tracking-wider text-mint">CLAIM WINNINGS</h2>
      </div>
      <p className="mb-5 text-sm text-white/55">
        You have {winningPositions.length} winning position{winningPositions.length > 1 ? 's' : ''}.
        Redeem your tokens for USDC at 1:1 after the dispute window closes.
      </p>

      <div className="space-y-3">
        {winningPositions.map((position) => {
          const status = statuses[position.market_id]
          const isBusy = status?.state === 'pending'
          const isDone = status?.state === 'done'

          return (
            <div
              key={`${position.market_id}-${position.outcome_index}`}
              className="flex flex-col gap-3 border-2 border-white/15 bg-white/[0.035] p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="text-sm font-semibold text-white">Market #{position.market_id}</div>
                <div className="mt-0.5 text-xs text-white/45">
                  <span className="mr-2 border border-mint/40 bg-mint/10 px-1.5 py-0.5 font-bold text-mint">
                    {position.outcome_index === 0 ? 'YES' : 'NO'}
                  </span>
                  {Number(position.token_amount).toLocaleString()} winning tokens
                </div>
                {status?.message && (
                  <div className={`mt-1 text-xs font-semibold ${
                    status.state === 'error' ? 'text-danger' :
                    status.state === 'done' ? 'text-mint' : 'text-amber'
                  }`}>
                    {status.message}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => claimOne(position)}
                disabled={isBusy || isDone || !isConnected}
                className="focus-ring inline-flex h-10 shrink-0 items-center gap-2 border-2 border-black bg-mint px-4 text-sm font-bold text-black shadow-hard btn-press disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Coins className="h-4 w-4" />
                {isDone ? 'Claimed ✓' : isBusy ? 'Claiming…' : 'Claim USDC'}
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}
