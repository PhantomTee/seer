'use client'

import { AlertTriangle, LogOut, Wallet } from 'lucide-react'
import { useAccount, useChainId, useConnect, useDisconnect } from 'wagmi'
import { ARC_TESTNET } from '@/constants/arc'
import { shortAddress } from '@/lib/utils'

async function addArcToMetaMask() {
  const ethereum = (window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum
  if (!ethereum) return
  try {
    // Try switching first — if the chain is already added, this is enough
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: ARC_TESTNET.chainIdHex }],
    })
  } catch (switchErr: unknown) {
    // Error 4902 = chain not added yet → add it
    if ((switchErr as { code?: number }).code === 4902) {
      await ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: ARC_TESTNET.chainIdHex,
          chainName: ARC_TESTNET.name,
          nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
          rpcUrls: [ARC_TESTNET.rpcUrl],
          blockExplorerUrls: [ARC_TESTNET.explorerUrl],
        }],
      })
    }
  }
}

export function ConnectButton() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()

  const isWrongNetwork = isConnected && chainId !== ARC_TESTNET.chainId

  if (isConnected) {
    return (
      <div className="flex items-center gap-2">
        {/* Wrong network warning */}
        {isWrongNetwork && (
          <button
            type="button"
            onClick={addArcToMetaMask}
            className="focus-ring inline-flex h-9 items-center gap-1.5 border-2 border-amber/60 bg-amber/10 px-3 text-xs font-bold text-amber hover:bg-amber/20 btn-press animate-pulse"
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Switch to Arc
          </button>
        )}

        {/* Address + network badge */}
        <button
          type="button"
          onClick={() => disconnect()}
          title="Disconnect wallet"
          className="focus-ring inline-flex h-9 items-center gap-2 border-2 border-white/20 bg-white/[0.06] px-4 text-sm font-semibold text-white/80 shadow-hard transition-colors hover:bg-white/[0.1] hover:text-white btn-press"
        >
          <Wallet className="h-3.5 w-3.5 text-mint" />
          <span className="hidden sm:inline">{shortAddress(address)}</span>
          {/* Network dot */}
          <span className={`h-2 w-2 rounded-full ${isWrongNetwork ? 'bg-amber' : 'bg-mint'}`} />
          <LogOut className="h-3.5 w-3.5 text-white/35" />
        </button>
      </div>
    )
  }

  const connector = connectors[0]
  return (
    <button
      type="button"
      disabled={!connector || isPending}
      onClick={() => connector && connect({ connector })}
      title="Connect wallet"
      className="focus-ring inline-flex h-9 items-center gap-2 border-2 border-black bg-mint px-4 text-sm font-bold text-black shadow-hard transition-all btn-press disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Wallet className="h-3.5 w-3.5" />
      {isPending ? 'Connecting…' : 'Connect Wallet'}
    </button>
  )
}
