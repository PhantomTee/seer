'use client'

import { CalendarClock, CheckCircle2, FileText, Loader2, Settings2, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isAddress, parseEventLogs, parseUnits, zeroAddress, type Hex } from 'viem'
import { useAccount, useChainId, usePublicClient, useReadContract, useSwitchChain, useWriteContract } from 'wagmi'
import { ConnectButton } from '@/components/shared/ConnectButton'
import { TransactionStatus } from '@/components/shared/TransactionStatus'
import { ARC_TESTNET } from '@/constants/arc'
import { erc20Abi, getContractAddresses, marketFactoryAbi } from '@/lib/contracts'
import { CHAINLINK_FEEDS, FEED_CATEGORIES, getFeedsByCategory, type FeedCategory } from '@/lib/chainlink-feeds'
import { toIsoInDays } from '@/lib/utils'
import type { MarketDraft, MarketType, OracleMode } from '@/types/market'

const oracleModes: OracleMode[] = ['CHAINLINK', 'OPTIMISTIC', 'ADMIN']
const CREATION_BOND = 5_000_000n
const ORACLE_INDEX: Record<OracleMode, number> = { CHAINLINK: 0, OPTIMISTIC: 1, ADMIN: 2 }
const MARKET_TYPE_INDEX: Record<MarketType, number> = { BINARY: 0, CATEGORICAL: 1 }

type TxStatus = 'idle' | 'pending' | 'success' | 'error'

export default function CreateMarketPage() {
  const router = useRouter()
  const addresses = getContractAddresses()
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const publicClient = usePublicClient()
  const { switchChainAsync } = useSwitchChain()
  const { writeContractAsync } = useWriteContract()
  const [step, setStep] = useState(0)
  const [txStatus, setTxStatus] = useState<TxStatus>('idle')
  const [txMessage, setTxMessage] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiSuggestion, setAiSuggestion] = useState('')
  const [feedCategory, setFeedCategory] = useState<FeedCategory>('all')
  const [draft, setDraft] = useState<MarketDraft>({
    question: 'Will BTC exceed $200k by Dec 31 2026?',
    resolutionCriteria: 'Resolve YES if the BTC/USD Chainlink feed is above $200,000 at the resolution timestamp.',
    oracleMode: 'CHAINLINK',
    marketType: 'BINARY',
    outcomeLabels: ['YES', 'NO'],
    resolutionTime: toIsoInDays(90),
    chainlinkFeed: '',
    chainlinkThreshold: '200000',
    chainlinkAbove: true
  })

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: addresses.usdc,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [address ?? zeroAddress, addresses.marketFactory ?? zeroAddress],
    chainId: ARC_TESTNET.chainId,
    query: { enabled: Boolean(address && addresses.marketFactory) }
  })

  useEffect(() => {
    const query = new URLSearchParams(window.location.search)
    const question = query.get('question')
    if (question) setDraft((prev) => ({ ...prev, question }))
  }, [])

  const steps = useMemo(
    () => [
      { label: 'Question', icon: FileText },
      { label: 'Configuration', icon: Settings2 },
      { label: 'Oracle', icon: Sparkles },
      { label: 'Review', icon: CheckCircle2 }
    ],
    []
  )

  const hasFactory = Boolean(addresses.marketFactory)
  const currentAllowance = (allowance as bigint | undefined) ?? 0n
  const needsApproval = currentAllowance < CREATION_BOND
  const isBusy = txStatus === 'pending'

  async function waitFor(hash: Hex) {
    if (!publicClient) throw new Error('Arc public client is not ready')
    return publicClient.waitForTransactionReceipt({ hash })
  }

  const handleAiHelp = useCallback(async () => {
    if (!draft.question.trim()) {
      setAiSuggestion('Enter a question first, then click Get AI Help.')
      return
    }
    setAiLoading(true)
    setAiSuggestion('')
    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          question: draft.question,
          resolutionCriteria: draft.resolutionCriteria
        })
      })
      const payload = (await res.json()) as { analysis?: string; error?: string }
      setAiSuggestion(payload.analysis ?? payload.error ?? 'No response from agent.')
    } catch {
      setAiSuggestion('Agent unavailable — add GROQ_API_KEY to .env.local to enable.')
    } finally {
      setAiLoading(false)
    }
  }, [draft.question, draft.resolutionCriteria])

  function validateDraft() {
    const labels = draft.outcomeLabels.map((label) => label.trim()).filter(Boolean)
    if (!draft.question.trim()) throw new Error('Question is required')
    if (draft.question.length > 512) throw new Error('Question must be 512 characters or less')
    if (labels.length < 2 || labels.length > 8) throw new Error('Markets need 2 to 8 outcomes')
    if (draft.marketType === 'BINARY' && labels.length !== 2) throw new Error('Binary markets need exactly 2 outcomes')
    const resolutionDate = new Date(draft.resolutionTime)
    if (!Number.isFinite(resolutionDate.getTime())) throw new Error('Resolution time is invalid')
    if (resolutionDate.getTime() <= Date.now() + 60 * 60 * 1000) throw new Error('Resolution must be at least 1 hour away')
    if (draft.oracleMode === 'CHAINLINK' && !isAddress(draft.chainlinkFeed ?? '')) throw new Error('Enter a Chainlink feed address')
    return labels
  }

  async function handleCreate() {
    try {
      setTxStatus('pending')
      setTxMessage('Validating market...')

      if (!isConnected || !address) throw new Error('Connect a wallet first')
      if (!addresses.marketFactory) throw new Error('Deploy contracts and fill NEXT_PUBLIC_MARKET_FACTORY in .env.local')
      if (chainId !== ARC_TESTNET.chainId) {
        setTxMessage('Switching to Arc Testnet...')
        await switchChainAsync({ chainId: ARC_TESTNET.chainId })
      }

      const labels = validateDraft()
      if (needsApproval) {
        setTxMessage('Approving the 5 USDC creation bond...')
        const approvalHash = await writeContractAsync({
          address: addresses.usdc,
          abi: erc20Abi,
          functionName: 'approve',
          args: [addresses.marketFactory, CREATION_BOND]
        })
        await waitFor(approvalHash)
        await refetchAllowance()
      }

      const resolutionTimestamp = BigInt(Math.floor(new Date(draft.resolutionTime).getTime() / 1000))
      const feedAddress = draft.oracleMode === 'CHAINLINK' ? (draft.chainlinkFeed as `0x${string}`) : zeroAddress
      const threshold = draft.oracleMode === 'CHAINLINK' ? parseUnits(draft.chainlinkThreshold || '0', 8) : 0n

      setTxMessage('Creating market on Arc...')
      const createHash = await writeContractAsync({
        address: addresses.marketFactory,
        abi: marketFactoryAbi,
        functionName: 'createMarket',
        args: [
          draft.question.trim(),
          draft.resolutionCriteria.trim(),
          resolutionTimestamp,
          ORACLE_INDEX[draft.oracleMode],
          MARKET_TYPE_INDEX[draft.marketType],
          feedAddress,
          threshold,
          Boolean(draft.chainlinkAbove),
          labels
        ]
      })
      const receipt = await waitFor(createHash)
      const logs = parseEventLogs({
        abi: marketFactoryAbi,
        eventName: 'MarketCreated',
        logs: receipt.logs
      })
      const marketId = logs[0]?.args.marketId ? Number(logs[0].args.marketId) : undefined

      if (marketId) {
        setTxMessage('Syncing market metadata...')
        await fetch('/api/markets', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            id: marketId,
            creator_address: address,
            question: draft.question.trim(),
            ipfs_metadata_cid: draft.resolutionCriteria.trim(),
            resolution_time: new Date(Number(resolutionTimestamp) * 1000).toISOString(),
            oracle_mode: draft.oracleMode,
            market_type: draft.marketType,
            outcome_labels: labels,
            chainlink_feed: draft.oracleMode === 'CHAINLINK' ? feedAddress : null,
            chainlink_threshold: draft.oracleMode === 'CHAINLINK' ? Number(threshold) : null,
            chainlink_above: draft.oracleMode === 'CHAINLINK' ? Boolean(draft.chainlinkAbove) : null,
            tx_hash: createHash
          })
        }).catch(() => undefined)
      }

      setTxStatus('success')
      setTxMessage(marketId ? `Market #${marketId} created` : `Created: ${createHash.slice(0, 10)}...${createHash.slice(-6)}`)
      if (marketId) router.push(`/markets/${marketId}`)
    } catch (error) {
      setTxStatus('error')
      setTxMessage(error instanceof Error ? error.message : 'Market creation failed')
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-white">Create Market</h1>
          <p className="mt-2 text-sm text-white/58">Define clear resolution criteria before locking the 5 USDC creation bond.</p>
        </div>
        <ConnectButton />
      </div>

      <div className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="rounded-md border border-white/10 bg-white/[0.035] p-3 shadow-hard">
          {steps.map((item, index) => (
            <button
              key={item.label}
              type="button"
              onClick={() => setStep(index)}
              className={`focus-ring mb-1 flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-sm ${
                step === index ? 'bg-mint text-ink' : 'text-white/65 hover:bg-white/8 hover:text-white'
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </aside>

        <section className="rounded-md border border-white/10 bg-white/[0.04] p-5 shadow-hard">
          {step === 0 && (
            <div className="space-y-4">
              <Field label="Question">
                <textarea
                  value={draft.question}
                  maxLength={512}
                  onChange={(event) => setDraft({ ...draft, question: event.target.value })}
                  className="focus-ring min-h-32 w-full rounded-md border border-white/10 bg-ink p-3 text-sm text-white"
                />
              </Field>
              <Field label="Resolution Criteria">
                <textarea
                  value={draft.resolutionCriteria}
                  onChange={(event) => setDraft({ ...draft, resolutionCriteria: event.target.value })}
                  className="focus-ring min-h-36 w-full rounded-md border border-white/10 bg-ink p-3 text-sm text-white"
                />
              </Field>
              <button
                type="button"
                onClick={handleAiHelp}
                disabled={aiLoading}
                className="focus-ring inline-flex h-10 items-center gap-2 rounded-md border border-white/10 px-3 text-sm text-white/70 hover:bg-white/8 disabled:opacity-50"
              >
                {aiLoading ? (
                  <Loader2 className="h-4 w-4 text-mint animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 text-mint" />
                )}
                {aiLoading ? 'Analysing…' : 'Get AI Help'}
              </button>
              {aiSuggestion && (
                <div className="mt-3 rounded-md border border-mint/25 bg-mint/[0.04] p-4 text-sm leading-6 text-white/70">
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-mint/70">
                    <Sparkles className="h-3.5 w-3.5" />
                    Agent Analysis
                  </div>
                  <p className="whitespace-pre-wrap">{aiSuggestion}</p>
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <Field label="Market Type">
                <div className="grid gap-2 sm:grid-cols-2">
                  {(['BINARY', 'CATEGORICAL'] as const).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setDraft({ ...draft, marketType: item, outcomeLabels: item === 'BINARY' ? ['YES', 'NO'] : draft.outcomeLabels })}
                      className={`focus-ring h-11 rounded-md text-sm font-semibold ${
                        draft.marketType === item ? 'bg-mint text-ink' : 'border border-white/10 text-white/70'
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Outcomes">
                <input
                  value={draft.outcomeLabels.join(', ')}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      outcomeLabels: event.target.value.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 8)
                    })
                  }
                  className="focus-ring h-11 w-full rounded-md border border-white/10 bg-ink px-3 text-sm text-white"
                />
              </Field>
              <Field label="Resolution Time">
                <input
                  type="datetime-local"
                  value={draft.resolutionTime.slice(0, 16)}
                  onChange={(event) => setDraft({ ...draft, resolutionTime: new Date(event.target.value).toISOString() })}
                  className="focus-ring h-11 w-full rounded-md border border-white/10 bg-ink px-3 text-sm text-white"
                />
              </Field>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <Field label="Oracle Type">
                <div className="grid gap-2 sm:grid-cols-3">
                  {oracleModes.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setDraft({ ...draft, oracleMode: item })}
                      className={`focus-ring h-11 rounded-md text-sm font-semibold ${
                        draft.oracleMode === item ? 'bg-mint text-ink' : 'border border-white/10 text-white/70'
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </Field>
              {draft.oracleMode === 'CHAINLINK' ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Price Feed">
                    {/* Category filter */}
                    <div className="mb-2 flex gap-1">
                      {FEED_CATEGORIES.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setFeedCategory(cat)}
                          className={`border px-2.5 py-1 text-[11px] font-bold capitalize transition-colors ${
                            feedCategory === cat
                              ? 'border-mint bg-mint/20 text-mint'
                              : 'border-white/15 text-white/40 hover:text-white/60'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                    <select
                      value={draft.chainlinkFeed ?? ''}
                      onChange={(e) => {
                        const val = e.target.value
                        // If custom chosen, clear so user can type
                        setDraft({ ...draft, chainlinkFeed: val })
                      }}
                      className="focus-ring h-11 w-full rounded-md border border-white/10 bg-ink px-3 font-mono text-sm text-white"
                    >
                      <option value="">Select a feed…</option>
                      {getFeedsByCategory(feedCategory).map((f) => (
                        <option key={f.address} value={f.address}>
                          {f.pair} — {f.address.slice(0, 10)}…
                        </option>
                      ))}
                      <option value="custom">Custom address…</option>
                    </select>
                    {/* Manual override if "custom" selected or address not in list */}
                    {(draft.chainlinkFeed === 'custom' ||
                      (draft.chainlinkFeed &&
                        !CHAINLINK_FEEDS.find((f) => f.address.toLowerCase() === draft.chainlinkFeed?.toLowerCase()))) && (
                      <input
                        value={draft.chainlinkFeed === 'custom' ? '' : (draft.chainlinkFeed ?? '')}
                        onChange={(e) => setDraft({ ...draft, chainlinkFeed: e.target.value })}
                        placeholder="0x…"
                        className="focus-ring mt-2 h-11 w-full rounded-md border border-white/10 bg-ink px-3 font-mono text-sm text-white"
                      />
                    )}
                  </Field>
                  <Field label="Threshold (8 decimal USD feed)">
                    <input
                      value={draft.chainlinkThreshold}
                      onChange={(event) => setDraft({ ...draft, chainlinkThreshold: event.target.value })}
                      className="focus-ring h-11 w-full rounded-md border border-white/10 bg-ink px-3 text-sm text-white"
                    />
                  </Field>
                  <Field label="Condition">
                    <select
                      value={draft.chainlinkAbove ? 'above' : 'below'}
                      onChange={(event) => setDraft({ ...draft, chainlinkAbove: event.target.value === 'above' })}
                      className="focus-ring h-11 w-full rounded-md border border-white/10 bg-ink px-3 text-sm text-white"
                    >
                      <option value="above">YES if price is above threshold</option>
                      <option value="below">YES if price is below threshold</option>
                    </select>
                  </Field>
                </div>
              ) : (
                <div className="rounded-md border border-amber/20 bg-amber/10 p-4 text-sm leading-6 text-amber">
                  Optimistic markets require a 5 USDC proposal bond and a 48-hour dispute window.
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="rounded-md border border-white/10 bg-ink/70 p-4">
                <h2 className="text-lg font-semibold text-white">{draft.question}</h2>
                <p className="mt-3 text-sm leading-6 text-white/58">{draft.resolutionCriteria}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Review label="Oracle" value={draft.oracleMode} />
                <Review label="Bond" value={needsApproval ? 'Approve 5 USDC' : '5 USDC ready'} />
                <Review label="Route" value={hasFactory ? 'MarketFactory set' : 'Deploy first'} />
              </div>
              <button
                type="button"
                onClick={handleCreate}
                disabled={isBusy || !hasFactory}
                className="focus-ring inline-flex h-11 items-center gap-2 rounded-md bg-mint px-4 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-55"
              >
                <CalendarClock className="h-4 w-4" />
                {isBusy ? 'Waiting for wallet' : needsApproval ? 'Approve USDC -> Create Market' : 'Create Market'}
              </button>
              <TransactionStatus status={txStatus} message={txMessage} />
            </div>
          )}

          <div className="mt-6 flex justify-between">
            <button type="button" disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))} className="focus-ring h-10 rounded-md border border-white/10 px-3 text-sm text-white/70 disabled:opacity-40">
              Back
            </button>
            <button type="button" disabled={step === 3} onClick={() => setStep((value) => Math.min(3, value + 1))} className="focus-ring h-10 rounded-md bg-mint px-3 text-sm font-semibold text-ink disabled:opacity-40">
              Next
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-white/75">{label}</span>
      {children}
    </label>
  )
}

function Review({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.035] p-3">
      <div className="text-xs uppercase text-white/35">{label}</div>
      <div className="mt-1 text-sm font-semibold text-white">{value}</div>
    </div>
  )
}
