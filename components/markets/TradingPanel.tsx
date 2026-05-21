'use client'

import { ChevronDown, ChevronUp, Info, LockKeyhole, TrendingDown, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { createWalletClient, formatUnits, http, parseUnits, zeroAddress, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { useAccount, useChainId, usePublicClient, useReadContract, useSwitchChain, useWriteContract } from 'wagmi'
import { ConfidentialPositionPanel } from '@/components/privacy/ConfidentialPositionPanel'
import { TransactionStatus } from '@/components/shared/TransactionStatus'
import { ARC_TESTNET } from '@/constants/arc'
import { useFairblock } from '@/hooks/useFairblock'
import { usePrivacyWallet } from '@/hooks/usePrivacyWallet'
import { arcTestnet } from '@/lib/arc'
import { cpmmAbi, erc20Abi, getContractAddresses, getPublicClient, orderBookAbi } from '@/lib/contracts'
import type { Market, Trade } from '@/types/market'

async function syncTradeToSupabase(params: {
  marketId: number
  walletAddress: string
  outcomeIndex: number
  price: number
  amount: string
  txHash: string
  orderType: 'market' | 'limit'
}) {
  try {
    await fetch('/api/trades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        market_id: params.marketId,
        wallet_address: params.walletAddress,
        outcome_index: params.outcomeIndex,
        price: params.price,
        amount: Number(params.amount),
        tx_hash: params.txHash,
        order_type: params.orderType,
        status: 'filled',
      }),
    })
  } catch {
    // Sync is best-effort — the on-chain trade already succeeded
  }
}

const QUICK_AMOUNTS = ['10', '50', '100']
const PRICE_SCALE = 1_000_000n

type TxStatus = 'idle' | 'pending' | 'success' | 'error'

/** Returns latest YES price from real trade data, or null if no trades exist. */
function latestYesPrice(trades: Trade[]): number | null {
  const yesTrades = trades
    .filter((t) => t.outcome_index === 0)
    .slice()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  return yesTrades.length ? Number(yesTrades[0].price) : null
}

function parseUsdcInput(value: string) {
  if (!value || Number(value) <= 0) return 0n
  return parseUnits(value, 6)
}

function parsePriceInput(value: string) {
  if (!value || Number(value) <= 0 || Number(value) > 1) return 0n
  return parseUnits(value, 6)
}

export function TradingPanel({ market, trades = [] }: { market: Market; trades?: Trade[] }) {
  const addresses = getContractAddresses()
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const publicClient = usePublicClient()
  const { switchChainAsync } = useSwitchChain()
  const { writeContractAsync } = useWriteContract()
  const fairblock = useFairblock()
  const pw = usePrivacyWallet()

  const rawYesProb = latestYesPrice(trades)
  const yesProb = rawYesProb ?? 0.5
  const noProb = 1 - yesProb
  const [outcome, setOutcome] = useState<'YES' | 'NO'>('YES')
  const [amount, setAmount] = useState('50')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [mode, setMode] = useState<'AMM' | 'ORDER_BOOK'>('AMM')
  const [limitPrice, setLimitPrice] = useState('0.67')
  const [privateTrade, setPrivateTrade] = useState(false)
  const [txStatus, setTxStatus] = useState<TxStatus>('idle')
  const [txMessage, setTxMessage] = useState('')

  const price = outcome === 'YES' ? yesProb : noProb
  const stake = Number(amount || 0)
  const payout = useMemo(() => (stake > 0 ? (stake / price).toFixed(2) : '0.00'), [stake, price])
  const profit = useMemo(() => (stake > 0 ? (stake / price - stake).toFixed(2) : '0.00'), [stake, price])
  const returnPct = useMemo(() => (stake > 0 ? ((1 / price - 1) * 100).toFixed(0) : '0'), [price, stake])

  const amountUnits = useMemo(() => {
    try { return parseUsdcInput(amount) } catch { return 0n }
  }, [amount])

  const limitPriceUnits = useMemo(() => {
    try { return parsePriceInput(limitPrice) } catch { return 0n }
  }, [limitPrice])

  const spender = mode === 'AMM' ? addresses.cpmm : addresses.orderBook

  // MetaMask wallet allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: addresses.usdc,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [address ?? zeroAddress, spender ?? zeroAddress],
    chainId: ARC_TESTNET.chainId,
    query: { enabled: Boolean(address && spender && !privateTrade) }
  })

  // Privacy wallet on-chain USDC balance (shown in panel when privateTrade is on)
  const { data: pwBalanceRaw } = useReadContract({
    address: addresses.usdc,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [pw.address as `0x${string}`],
    chainId: ARC_TESTNET.chainId,
    query: { enabled: Boolean(pw.isReady && privateTrade) }
  })
  const pwUsdcBalance = pwBalanceRaw ? Number(formatUnits(pwBalanceRaw as bigint, 6)) : 0

  const usePrivacy = privateTrade && pw.isReady

  const isClosed = market.state !== 'OPEN'
  const isBusy = txStatus === 'pending' || fairblock.busy
  const hasDeployedRoute = Boolean(spender)
  const requiresApproval = !usePrivacy && amountUnits > ((allowance as bigint | undefined) ?? 0n)
  const canExecute = !isClosed && hasDeployedRoute && amountUnits > 0n && !isBusy &&
    (usePrivacy || (isConnected && Boolean(address)))

  const accentYes = 'bg-mint border-black text-black shadow-hard'
  const accentNo = 'bg-danger border-black text-white shadow-hard-danger'

  async function handleExecute() {
    try {
      setTxStatus('pending')
      setTxMessage('Preparing transaction…')

      if (!spender) throw new Error('Deploy contracts and fill the route address in .env.local')
      if (amountUnits === 0n) throw new Error('Enter a USDC amount')

      if (usePrivacy) {
        // ── Private path: sign with privacy wallet key, no MetaMask needed ──
        const account = privateKeyToAccount(pw.privateKey as `0x${string}`)
        const privClient = createWalletClient({
          account,
          chain: arcTestnet,
          transport: http(process.env.NEXT_PUBLIC_ARC_RPC_URL || arcTestnet.rpcUrls.default.http[0])
        })
        const pubClient = getPublicClient()

        // Check privacy wallet allowance on-chain
        const currentAllowance = await pubClient.readContract({
          address: addresses.usdc,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [account.address, spender]
        }) as bigint

        if (currentAllowance < amountUnits) {
          setTxMessage('Approving USDC from privacy wallet…')
          const approvalHash = await privClient.writeContract({
            address: addresses.usdc,
            abi: erc20Abi,
            functionName: 'approve',
            args: [spender, amountUnits],
            chain: arcTestnet
          })
          await pubClient.waitForTransactionReceipt({ hash: approvalHash })
        }

        const outcomeIndex = outcome === 'YES' ? 0n : 1n
        let hash: Hex

        if (mode === 'AMM') {
          if (!addresses.cpmm) throw new Error('CPMM address is missing')
          const priceUnits = BigInt(Math.max(1, Math.round(price * 1_000_000)))
          const expectedOut = (amountUnits * PRICE_SCALE) / priceUnits
          const minOut = (expectedOut * 99n) / 100n
          setTxMessage(`Buying ${outcome} from privacy wallet…`)
          hash = await privClient.writeContract({
            address: addresses.cpmm,
            abi: cpmmAbi,
            functionName: 'buyOutcome',
            args: [BigInt(market.id), outcomeIndex, amountUnits, minOut],
            chain: arcTestnet
          })
        } else {
          if (!addresses.orderBook) throw new Error('OrderBook address is missing')
          const orderBookPrice = limitPriceUnits
          const orderBookSize = orderBookPrice > 0n ? (amountUnits * PRICE_SCALE) / orderBookPrice : 0n
          if (orderBookPrice === 0n || orderBookSize === 0n) throw new Error('Enter a valid limit price')
          setTxMessage(`Placing ${outcome} limit order from privacy wallet…`)
          hash = await privClient.writeContract({
            address: addresses.orderBook,
            abi: orderBookAbi,
            functionName: 'placeOrder',
            args: [BigInt(market.id), outcomeIndex, 0, orderBookPrice, orderBookSize],
            chain: arcTestnet
          })
        }

        await pubClient.waitForTransactionReceipt({ hash })
        await syncTradeToSupabase({
          marketId: market.id,
          walletAddress: account.address,
          outcomeIndex: outcome === 'YES' ? 0 : 1,
          price: outcome === 'YES' ? yesProb : noProb,
          amount,
          txHash: hash,
          orderType: mode === 'AMM' ? 'market' : 'limit',
        })
        setTxStatus('success')
        setTxMessage(`Confirmed: ${hash.slice(0, 10)}…${hash.slice(-6)}`)

      } else {
        // ── Standard MetaMask path ────────────────────────────────────────
        if (!isConnected || !address) throw new Error('Connect a wallet first')
        if (chainId !== ARC_TESTNET.chainId) {
          setTxMessage('Switching to Arc Testnet…')
          await switchChainAsync({ chainId: ARC_TESTNET.chainId })
        }

        const orderBookPrice = limitPriceUnits
        const orderBookSize = orderBookPrice > 0n ? (amountUnits * PRICE_SCALE) / orderBookPrice : 0n
        const approvalAmount = mode === 'AMM' ? amountUnits : (orderBookSize * orderBookPrice) / PRICE_SCALE
        const currentAllowance = (allowance as bigint | undefined) ?? 0n

        if (currentAllowance < approvalAmount) {
          setTxMessage('Approving USDC…')
          const approvalHash = await writeContractAsync({
            address: addresses.usdc,
            abi: erc20Abi,
            functionName: 'approve',
            args: [spender, approvalAmount]
          })
          await publicClient!.waitForTransactionReceipt({ hash: approvalHash })
          await refetchAllowance()
        }

        const outcomeIndex = outcome === 'YES' ? 0n : 1n
        let hash: Hex
        if (mode === 'AMM') {
          if (!addresses.cpmm) throw new Error('CPMM address is missing')
          const priceUnits = BigInt(Math.max(1, Math.round(price * 1_000_000)))
          const expectedOut = (amountUnits * PRICE_SCALE) / priceUnits
          const minOut = (expectedOut * 99n) / 100n
          setTxMessage(`Buying ${outcome} through the CPMM…`)
          hash = await writeContractAsync({
            address: addresses.cpmm,
            abi: cpmmAbi,
            functionName: 'buyOutcome',
            args: [BigInt(market.id), outcomeIndex, amountUnits, minOut]
          })
        } else {
          if (!addresses.orderBook) throw new Error('OrderBook address is missing')
          if (orderBookPrice === 0n || orderBookSize === 0n) throw new Error('Enter a valid limit price')
          setTxMessage(`Placing ${outcome} limit order…`)
          hash = await writeContractAsync({
            address: addresses.orderBook,
            abi: orderBookAbi,
            functionName: 'placeOrder',
            args: [BigInt(market.id), outcomeIndex, 0, orderBookPrice, orderBookSize]
          })
        }

        await publicClient!.waitForTransactionReceipt({ hash })
        await syncTradeToSupabase({
          marketId: market.id,
          walletAddress: address,
          outcomeIndex: outcome === 'YES' ? 0 : 1,
          price: outcome === 'YES' ? yesProb : noProb,
          amount,
          txHash: hash,
          orderType: mode === 'AMM' ? 'market' : 'limit',
        })
        setTxStatus('success')
        setTxMessage(`Confirmed: ${hash.slice(0, 10)}…${hash.slice(-6)}`)
        await refetchAllowance()
      }
    } catch (error) {
      setTxStatus('error')
      setTxMessage(error instanceof Error ? error.message : 'Transaction failed')
    }
  }

  return (
    <div className="border-2 border-white/15 bg-white/[0.04] p-5 shadow-hard">
      {/* Header */}
      <div className="mb-5 border-b-2 border-white/10 pb-4">
        <h2 className="font-display text-2xl tracking-wider text-white">PLACE PREDICTION</h2>
        <p className="mt-0.5 text-xs text-white/40">
          {rawYesProb !== null
            ? <>Last price: <span className="font-bold text-mint">{Math.round(yesProb * 100)}% chance YES</span></>
            : <span className="text-white/30">No trades yet — prices form once trading begins</span>
          }
        </p>
      </div>

      {/* YES / NO selector */}
      <div className="mb-5 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setOutcome('YES')}
          className={`border-2 py-4 transition-all duration-100 btn-press ${
            outcome === 'YES' ? accentYes : 'border-white/10 bg-white/[0.03] hover:border-mint/30 hover:bg-mint/5'
          }`}
        >
          <div className="flex flex-col items-center gap-0.5">
            <div className="flex items-center gap-1.5">
              <TrendingUp className={`h-3.5 w-3.5 ${outcome === 'YES' ? 'text-black' : 'text-white/35'}`} />
              <span className={`text-sm font-bold ${outcome === 'YES' ? 'text-black' : 'text-white/55'}`}>YES</span>
            </div>
            <span className={`font-display text-3xl leading-none tracking-wider ${outcome === 'YES' ? 'text-black' : 'text-white/40'}`}>
              {rawYesProb !== null ? `${Math.round(yesProb * 100)}%` : '—'}
            </span>
            <span className={`text-[10px] font-semibold ${outcome === 'YES' ? 'text-black/60' : 'text-white/22'}`}>
              {rawYesProb !== null ? `${Math.round(yesProb * 100)}c per contract` : 'no trades yet'}
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setOutcome('NO')}
          className={`border-2 py-4 transition-all duration-100 btn-press ${
            outcome === 'NO' ? accentNo : 'border-white/10 bg-white/[0.03] hover:border-danger/30 hover:bg-danger/5'
          }`}
        >
          <div className="flex flex-col items-center gap-0.5">
            <div className="flex items-center gap-1.5">
              <TrendingDown className={`h-3.5 w-3.5 ${outcome === 'NO' ? 'text-white' : 'text-white/35'}`} />
              <span className={`text-sm font-bold ${outcome === 'NO' ? 'text-white' : 'text-white/55'}`}>NO</span>
            </div>
            <span className={`font-display text-3xl leading-none tracking-wider ${outcome === 'NO' ? 'text-white' : 'text-white/40'}`}>
              {rawYesProb !== null ? `${Math.round(noProb * 100)}%` : '—'}
            </span>
            <span className={`text-[10px] font-semibold ${outcome === 'NO' ? 'text-white/70' : 'text-white/22'}`}>
              {rawYesProb !== null ? `${Math.round(noProb * 100)}c per contract` : 'no trades yet'}
            </span>
          </div>
        </button>
      </div>

      {/* Stake input */}
      <div className="mb-4">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wide text-white/50">Stake (USDC)</span>
          <div className="flex gap-1">
            {QUICK_AMOUNTS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setAmount(value)}
                className={`h-6 border px-2 text-[10px] font-bold transition-colors btn-press ${
                  amount === value
                    ? 'border-mint bg-mint/20 text-mint'
                    : 'border-white/15 text-white/35 hover:border-white/30 hover:text-white/60'
                }`}
              >
                ${value}
              </button>
            ))}
          </div>
        </div>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-white/30">$</span>
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            type="number"
            min="0"
            step="1"
            className="focus-ring h-11 w-full border-2 border-white/15 bg-ink/80 pl-7 pr-3 text-sm font-bold text-white placeholder:text-white/25"
            placeholder="0.00"
          />
        </div>
      </div>

      {/* Payout summary */}
      <div className={`mb-4 border-2 p-4 ${outcome === 'YES' ? 'border-mint/25 bg-mint/[0.07]' : 'border-danger/25 bg-danger/[0.07]'}`}>
        <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-white/40">
          If {outcome} resolves correctly
        </div>
        <div className="flex items-end justify-between">
          <div>
            <div className="mb-0.5 text-[10px] text-white/35">You stake</div>
            <div className="font-display text-2xl leading-none text-white">${stake > 0 ? stake.toFixed(2) : '0.00'}</div>
          </div>
          <div className="mb-1 text-white/25 text-lg">→</div>
          <div className="text-right">
            <div className="mb-0.5 text-[10px] text-white/35">You receive</div>
            <div className={`font-display text-2xl leading-none ${outcome === 'YES' ? 'text-mint' : 'text-danger'}`}>${payout}</div>
          </div>
          <div className={`mb-1 border-2 px-2.5 py-1.5 text-xs font-bold ${outcome === 'YES' ? 'border-mint/40 bg-mint/15 text-mint' : 'border-danger/40 bg-danger/15 text-danger'}`}>
            +{returnPct}%
          </div>
        </div>
        <div className="mt-2 text-[10px] text-white/30">
          Profit: +${profit} · {(price * 100).toFixed(0)}c cost per $1 payout
        </div>
      </div>

      {/* Privacy wallet toggle */}
      <label className="mb-4 flex cursor-pointer items-center gap-2.5 border border-white/10 bg-white/[0.025] px-3 py-2.5 transition-colors hover:bg-white/[0.04]">
        <input type="checkbox" checked={privateTrade} onChange={(e) => setPrivateTrade(e.target.checked)} className="h-4 w-4 accent-mint" />
        <LockKeyhole className="h-3.5 w-3.5 shrink-0 text-mint" />
        <span className="text-xs font-medium text-white/55">Bet with privacy wallet</span>
      </label>

      {privateTrade && (
        <div className="mb-4 animate-fade-slide-in space-y-2">
          {pw.isReady ? (
            <div className="border border-mint/20 bg-mint/[0.04] p-3 text-[11px] leading-5">
              <div className="flex items-center justify-between">
                <span className="text-white/50">Privacy wallet</span>
                <span className="font-mono text-mint/80">{pw.address.slice(0, 8)}…{pw.address.slice(-6)}</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-white/50">On-chain USDC</span>
                <span className={`font-bold ${pwUsdcBalance >= stake && stake > 0 ? 'text-mint' : 'text-amber'}`}>
                  {pwUsdcBalance.toFixed(2)} USDC
                </span>
              </div>
              {pwUsdcBalance < stake && stake > 0 && (
                <p className="mt-1.5 text-amber/80">
                  Need {(stake - pwUsdcBalance).toFixed(2)} more USDC. Withdraw from your vault or fund via faucet.
                </p>
              )}
            </div>
          ) : (
            <div className="border border-white/10 bg-white/[0.025] p-3 text-[11px] text-white/45">
              Set up your privacy wallet in Portfolio first.
            </div>
          )}
          <ConfidentialPositionPanel compact />
        </div>
      )}

      {/* Advanced toggle */}
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="mb-3 flex w-full items-center justify-between text-xs font-semibold text-white/30 transition-colors hover:text-white/55"
      >
        <span>Advanced options</span>
        {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {showAdvanced && (
        <div className="mb-4 animate-fade-slide-in space-y-3 border-2 border-white/10 bg-ink/50 p-3.5">
          <div className="grid grid-cols-2 gap-2">
            {(['AMM', 'ORDER_BOOK'] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setMode(item)}
                className={`h-8 border-2 text-xs font-bold transition-colors btn-press ${
                  mode === item
                    ? 'border-mint bg-mint/20 text-mint'
                    : 'border-white/15 text-white/38 hover:border-white/30 hover:text-white/60'
                }`}
              >
                {item === 'AMM' ? 'AMM' : 'Order Book'}
              </button>
            ))}
          </div>
          {mode === 'ORDER_BOOK' && (
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-white/40">Limit Price (USDC)</span>
              <input
                value={limitPrice}
                onChange={(event) => setLimitPrice(event.target.value)}
                className="focus-ring h-9 w-full border-2 border-white/15 bg-ink px-3 text-sm font-medium text-white"
              />
            </label>
          )}
          {mode === 'AMM' && (
            <div className="flex items-center justify-between text-xs text-white/40">
              <span className="font-medium">Max slippage</span>
              <span className="font-bold text-white/60">1.0%</span>
            </div>
          )}
        </div>
      )}

      {/* Risk warning */}
      <div className="mb-4 flex items-start gap-2 border border-amber/20 bg-amber/[0.06] p-3 text-[11px] leading-5 text-amber/70">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>Prediction markets involve risk. You may lose your full stake. Only trade what you can afford to lose.</span>
      </div>

      {/* Execute button */}
      <button
        type="button"
        onClick={handleExecute}
        disabled={!canExecute}
        className={`focus-ring h-13 w-full border-2 py-3 text-base font-bold transition-all btn-press ${
          !canExecute
            ? 'cursor-not-allowed border-white/10 bg-white/8 text-white/28'
            : outcome === 'YES'
              ? 'border-black bg-mint text-black shadow-hard hover:bg-mint/90'
              : 'border-black bg-danger text-white shadow-hard-danger hover:bg-danger/90'
        }`}
      >
        {isBusy
          ? 'Waiting…'
          : isClosed
            ? 'Market Closed'
            : !hasDeployedRoute
              ? 'Deploy contracts first'
              : usePrivacy
                ? `Buy ${outcome} (Private) — $${stake > 0 ? stake.toFixed(2) : '0.00'}`
                : !isConnected
                  ? 'Connect wallet to trade'
                  : requiresApproval
                    ? `Approve & Buy ${outcome} — $${stake > 0 ? stake.toFixed(2) : '0.00'}`
                    : `Buy ${outcome} — $${stake > 0 ? stake.toFixed(2) : '0.00'}`}
      </button>
      {usePrivacy && (
        <p className="mt-2 text-[11px] leading-4 text-white/35">
          Trade is signed by your privacy wallet — your main wallet address is never exposed on-chain.
          USDC must be at the privacy wallet address (withdraw from vault first if needed).
        </p>
      )}
      <TransactionStatus status={txStatus} message={txMessage} />
    </div>
  )
}
