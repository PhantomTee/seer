'use client'

import { useState } from 'react'
import { parseUnits } from 'viem'
import { useAccount, useChainId, usePublicClient, useSwitchChain, useWriteContract } from 'wagmi'
import { AlertTriangle, CheckCircle, Gavel, ShieldAlert } from 'lucide-react'
import type { Market } from '@/types/market'
import { ARC_TESTNET } from '@/constants/arc'
import { erc20Abi, getContractAddresses, oracleResolverAbi } from '@/lib/contracts'
import type { Hex } from 'viem'

type Phase = 'idle' | 'approving' | 'proposing' | 'disputing' | 'settling' | 'done' | 'error'

// 500 USDC proposal bond (6 decimals)
const PROPOSAL_BOND = parseUnits('500', 6)

interface DisputePanelProps {
  market: Market
}

export function DisputePanel({ market }: DisputePanelProps) {
  const addresses = getContractAddresses()
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const publicClient = usePublicClient()
  const { switchChainAsync } = useSwitchChain()
  const { writeContractAsync } = useWriteContract()

  const [phase, setPhase] = useState<Phase>('idle')
  const [message, setMessage] = useState('')
  const [selectedOutcome, setSelectedOutcome] = useState<number>(0)

  const oracleAddr = addresses.oracleResolver
  const usdcAddr = addresses.usdc

  async function waitFor(hash: Hex) {
    if (!publicClient) throw new Error('Arc public client is not ready')
    return publicClient.waitForTransactionReceipt({ hash })
  }

  async function ensureChain() {
    if (chainId !== ARC_TESTNET.chainId) {
      await switchChainAsync({ chainId: ARC_TESTNET.chainId })
    }
  }

  async function handlePropose() {
    if (!isConnected || !address) { setMessage('Connect a wallet first'); return }
    if (!oracleAddr) { setMessage('OracleResolver contract not deployed yet'); return }
    try {
      await ensureChain()

      // Approve the 500 USDC bond
      setPhase('approving')
      setMessage('Approving 500 USDC proposal bond…')
      const approvalHash = await writeContractAsync({
        address: usdcAddr,
        abi: erc20Abi,
        functionName: 'approve',
        args: [oracleAddr, PROPOSAL_BOND]
      })
      await waitFor(approvalHash)

      // Propose outcome
      setPhase('proposing')
      setMessage('Submitting outcome proposal…')
      const proposeHash = await writeContractAsync({
        address: oracleAddr,
        abi: oracleResolverAbi,
        functionName: 'proposeOutcome',
        args: [BigInt(market.id), BigInt(selectedOutcome)]
      })
      await waitFor(proposeHash)

      setPhase('done')
      setMessage(`Outcome proposed: ${market.outcome_labels[selectedOutcome] ?? selectedOutcome}. The 48-hour dispute window has started.`)
    } catch (err) {
      setPhase('error')
      setMessage(err instanceof Error ? err.message : 'Transaction failed')
    }
  }

  async function handleDispute() {
    if (!isConnected || !address) { setMessage('Connect a wallet first'); return }
    if (!oracleAddr) { setMessage('OracleResolver contract not deployed yet'); return }
    try {
      await ensureChain()

      setPhase('disputing')
      setMessage('Filing dispute on-chain…')
      const disputeHash = await writeContractAsync({
        address: oracleAddr,
        abi: oracleResolverAbi,
        functionName: 'disputeOutcome',
        args: [BigInt(market.id), BigInt(selectedOutcome)]
      })
      await waitFor(disputeHash)

      setPhase('done')
      setMessage('Dispute filed. The market will enter arbitration.')
    } catch (err) {
      setPhase('error')
      setMessage(err instanceof Error ? err.message : 'Transaction failed')
    }
  }

  async function handleSettle() {
    if (!isConnected || !address) { setMessage('Connect a wallet first'); return }
    if (!oracleAddr) { setMessage('OracleResolver contract not deployed yet'); return }
    try {
      await ensureChain()

      setPhase('settling')
      setMessage('Settling undisputed market…')
      const settleHash = await writeContractAsync({
        address: oracleAddr,
        abi: oracleResolverAbi,
        functionName: 'settleUndisputed',
        args: [BigInt(market.id)]
      })
      await waitFor(settleHash)

      setPhase('done')
      setMessage('Market settled on-chain.')
    } catch (err) {
      setPhase('error')
      setMessage(err instanceof Error ? err.message : 'Transaction failed')
    }
  }

  const isBusy = ['approving', 'proposing', 'disputing', 'settling'].includes(phase)

  return (
    <div className="border-2 border-amber/30 bg-amber/[0.04] p-5 shadow-hard">
      <div className="mb-4 flex items-center gap-2">
        <Gavel className="h-5 w-5 text-amber" />
        <h2 className="font-display text-xl tracking-wider text-amber">DISPUTE / RESOLUTION</h2>
      </div>

      <p className="mb-4 text-sm leading-6 text-white/55">
        {market.oracle_mode === 'OPTIMISTIC'
          ? 'Optimistic markets require a 500 USDC bond to propose an outcome. Anyone may dispute within 48 hours.'
          : 'Trigger Chainlink resolution or propose an outcome if the oracle feed is unavailable.'}
      </p>

      {/* Outcome selector */}
      <div className="mb-4">
        <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-white/40">
          Proposed Outcome
        </label>
        <div className="flex flex-wrap gap-2">
          {market.outcome_labels.map((label, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setSelectedOutcome(idx)}
              className={`border-2 px-4 py-1.5 text-sm font-bold transition-colors btn-press ${
                selectedOutcome === idx
                  ? idx === 0
                    ? 'border-black bg-mint text-black shadow-hard'
                    : 'border-black bg-danger text-white shadow-hard-danger'
                  : 'border-white/15 bg-white/[0.04] text-white/55 hover:border-white/30'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {market.oracle_mode === 'OPTIMISTIC' && (
          <button
            type="button"
            onClick={handlePropose}
            disabled={isBusy || !isConnected}
            className="focus-ring inline-flex h-10 items-center gap-2 border-2 border-black bg-amber px-4 text-sm font-bold text-black shadow-hard btn-press disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckCircle className="h-4 w-4" />
            {phase === 'approving' ? 'Approving…' : phase === 'proposing' ? 'Proposing…' : 'Propose Outcome'}
          </button>
        )}

        <button
          type="button"
          onClick={handleDispute}
          disabled={isBusy || !isConnected}
          className="focus-ring inline-flex h-10 items-center gap-2 border-2 border-danger/60 bg-danger/10 px-4 text-sm font-bold text-danger shadow-hard btn-press disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ShieldAlert className="h-4 w-4" />
          {phase === 'disputing' ? 'Disputing…' : 'Dispute Outcome'}
        </button>

        <button
          type="button"
          onClick={handleSettle}
          disabled={isBusy || !isConnected}
          className="focus-ring inline-flex h-10 items-center gap-2 border-2 border-white/15 bg-white/[0.04] px-4 text-sm font-bold text-white/60 shadow-hard btn-press disabled:cursor-not-allowed disabled:opacity-50 hover:border-white/30"
        >
          {phase === 'settling' ? 'Settling…' : 'Settle Undisputed'}
        </button>
      </div>

      {/* Status message */}
      {message && (
        <div
          className={`mt-4 flex items-start gap-2 border-2 p-3 text-sm ${
            phase === 'error'
              ? 'border-danger/40 bg-danger/10 text-danger'
              : phase === 'done'
                ? 'border-mint/30 bg-mint/10 text-mint'
                : 'border-amber/30 bg-amber/10 text-amber'
          }`}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      <p className="mt-4 text-[11px] text-white/25">
        Proposing requires a 500 USDC bond. Bond is returned if your outcome is accepted.
      </p>
    </div>
  )
}
