'use client'

import { ArrowRightLeft, CheckCircle2, Flame, Loader2, RadioTower, WalletCards } from 'lucide-react'
import { useMemo, useState } from 'react'
import { formatUnits, type Address, type Hex } from 'viem'
import { getWalletClient, waitForTransactionReceipt } from 'wagmi/actions'
import { useAccount, useBalance, useSwitchChain } from 'wagmi'
import { ARC_CONTRACTS, ARC_TESTNET } from '@/constants/arc'
import { CCTP_SOURCE_CHAINS, getUsdcAddress } from '@/lib/cctp'
import { wagmiConfig } from '@/lib/wagmiConfig'
import { useCCTP, type CctpStatus } from '@/hooks/useCCTP'

const stages = [
  { key: 'burning', label: 'Burn', icon: Flame },
  { key: 'attesting', label: 'Attest', icon: RadioTower },
  { key: 'minted', label: 'Mint', icon: CheckCircle2 }
] as const

type SourceChainId = (typeof CCTP_SOURCE_CHAINS)[number]['chainId']
type ConfiguredChainId = SourceChainId | typeof ARC_TESTNET.chainId

function stageState(status: CctpStatus, stage: (typeof stages)[number]['key']) {
  if (status === 'error') return 'Error'
  if (status === 'idle') return 'Waiting'
  if (stage === 'burning') return status === 'burning' || status === 'approving' ? 'Active' : 'Done'
  if (stage === 'attesting') {
    if (status === 'approving' || status === 'burning') return 'Waiting'
    return status === 'attesting' ? 'Active' : 'Done'
  }
  if (status === 'minting') return 'Active'
  return status === 'minted' ? 'Done' : 'Waiting'
}

export function CCTPPanel() {
  const { address, isConnected } = useAccount()
  const { switchChainAsync } = useSwitchChain()
  const cctp = useCCTP()
  const [amount, setAmount] = useState('100.00')
  const [sourceChainId, setSourceChainId] = useState<SourceChainId>(CCTP_SOURCE_CHAINS[0].chainId)
  const [mode, setMode] = useState<'forwarded' | 'manual'>('forwarded')
  const [localError, setLocalError] = useState('')

  const sourceUsdc = useMemo(() => getUsdcAddress(sourceChainId), [sourceChainId])
  const { data: sourceBalance } = useBalance({
    address,
    token: sourceUsdc,
    chainId: sourceChainId,
    query: { enabled: Boolean(address) }
  })

  async function waitFor(chainId: ConfiguredChainId, hash: Hex) {
    return waitForTransactionReceipt(wagmiConfig, { chainId, hash })
  }

  async function startTransfer() {
    setLocalError('')
    try {
      if (!isConnected || !address) throw new Error('Connect a wallet first')
      if (!amount || Number(amount) <= 0) throw new Error('Enter a USDC amount')

      await switchChainAsync({ chainId: sourceChainId })
      const sourceWalletClient = await getWalletClient(wagmiConfig, { chainId: sourceChainId })
      const waitForSourceReceipt = (hash: Hex) => waitFor(sourceChainId, hash)

      if (mode === 'forwarded') {
        await cctp.startForwardedTransfer(sourceChainId, amount, address as Address, sourceWalletClient, waitForSourceReceipt)
        return
      }

      await cctp.startDirectTransfer(
        sourceChainId,
        amount,
        address as Address,
        sourceWalletClient,
        async () => {
          await switchChainAsync({ chainId: ARC_TESTNET.chainId })
          return getWalletClient(wagmiConfig, { chainId: ARC_TESTNET.chainId })
        },
        waitForSourceReceipt,
        (hash: Hex) => waitFor(ARC_TESTNET.chainId, hash)
      )
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'CCTP transfer failed')
    }
  }

  const balanceText = sourceBalance ? `${formatUnits(sourceBalance.value, 6)} USDC` : isConnected ? 'Loading...' : 'Connect wallet'
  const busy = !['idle', 'minted', 'error'].includes(cctp.status)

  return (
    <div className="rounded-md border border-white/10 bg-white/[0.035] p-5 shadow-hard">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
          <ArrowRightLeft className="h-4 w-4 text-mint" />
          Manual CCTP V2
        </h2>
        <a href="https://developers.circle.com/cctp" target="_blank" rel="noreferrer" className="text-xs text-blue hover:text-white">
          Circle docs
        </a>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className="mb-1 block text-xs text-white/45">Source Chain</span>
          <select
            value={sourceChainId}
            onChange={(event) => setSourceChainId(Number(event.target.value) as SourceChainId)}
            className="focus-ring h-10 w-full rounded-md border border-white/10 bg-ink px-3 text-sm text-white"
          >
            {CCTP_SOURCE_CHAINS.map((chain) => (
              <option key={chain.chainId} value={chain.chainId}>{chain.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-xs text-white/45">Amount</span>
          <input value={amount} onChange={(event) => setAmount(event.target.value)} className="focus-ring h-10 w-full rounded-md border border-white/10 bg-ink px-3 text-sm text-white" />
        </label>
        <label>
          <span className="mb-1 block text-xs text-white/45">Destination</span>
          <input value={address ?? ''} readOnly className="focus-ring h-10 w-full rounded-md border border-white/10 bg-ink px-3 font-mono text-xs text-white/70" />
        </label>
        <div className="rounded-md border border-white/10 bg-ink/70 p-3">
          <div className="mb-1 flex items-center gap-2 text-xs text-white/45">
            <WalletCards className="h-3.5 w-3.5 text-mint" />
            Source USDC balance
          </div>
          <div className="text-sm font-semibold text-white">{balanceText}</div>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {(['forwarded', 'manual'] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setMode(item)}
            className={`focus-ring h-10 rounded-md text-sm font-semibold ${
              mode === item ? 'bg-mint text-ink' : 'border border-white/10 text-white/65 hover:bg-white/8'
            }`}
          >
            {item === 'forwarded' ? 'Fast Forwarded Mint' : 'Manual receiveMessage'}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {stages.map((stage) => {
          const state = stageState(cctp.status, stage.key)
          return (
            <div key={stage.label} className="rounded-md border border-white/10 bg-ink/70 p-3">
              {state === 'Active' ? <Loader2 className="mb-2 h-4 w-4 animate-spin text-blue" /> : <stage.icon className="mb-2 h-4 w-4 text-mint" />}
              <div className="text-sm font-medium text-white">{stage.label}</div>
              <div className="text-xs text-white/45">{state}</div>
            </div>
          )
        })}
      </div>

      <div className="mt-4 rounded-md border border-white/10 bg-white/[0.035] p-3 text-xs leading-5 text-white/58">
        Arc Testnet CCTP domain is <span className="font-mono text-white">{ARC_CONTRACTS.CCTP_ARC_DOMAIN}</span>. MessageTransmitterV2:{' '}
        <span className="font-mono text-white">{ARC_CONTRACTS.CCTP_MESSAGE_TRANSMITTER}</span>.
        {cctp.burnTx && <div className="mt-2">Burn tx: <span className="font-mono text-white">{cctp.burnTx}</span></div>}
        {cctp.mintTx && <div className="mt-1">Mint tx: <span className="font-mono text-white">{cctp.mintTx}</span></div>}
      </div>

      {(cctp.message || localError) && (
        <div className={`mt-3 rounded-md border px-3 py-2 text-xs ${cctp.status === 'error' || localError ? 'border-danger/25 bg-danger/10 text-danger' : 'border-blue/20 bg-blue/10 text-blue'}`}>
          {localError || cctp.message}
        </div>
      )}

      <button
        type="button"
        onClick={startTransfer}
        disabled={busy || !isConnected}
        className="focus-ring mt-4 h-10 w-full rounded-md bg-mint text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-55"
      >
        {busy ? 'Transfer in progress' : isConnected ? 'Start Direct Transfer' : 'Connect wallet to transfer'}
      </button>
    </div>
  )
}
