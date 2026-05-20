'use client'

import { useCallback, useState } from 'react'
import type { Address, Hex } from 'viem'
import { cctpBurnAndMint, cctpBurnWithForwarding, cctpReceiveMessage, pollAttestationApi } from '@/lib/cctp'

export type CctpStatus = 'idle' | 'approving' | 'burning' | 'attesting' | 'minting' | 'minted' | 'error'

type WalletClientLike = {
  sendTransaction: (args: { to: Address; data: Hex }) => Promise<Hex>
}

type WaitForReceipt = (hash: Hex) => Promise<unknown>

export function useCCTP() {
  const [status, setStatus] = useState<CctpStatus>('idle')
  const [message, setMessage] = useState('')
  const [burnTx, setBurnTx] = useState<Hex | null>(null)
  const [mintTx, setMintTx] = useState<Hex | null>(null)

  const startDirectTransfer = useCallback(
    async (
      sourceChainId: number,
      amount: string,
      recipient: Address,
      sourceWalletClient: WalletClientLike,
      getArcWalletClient: () => Promise<WalletClientLike>,
      waitForSourceReceipt?: WaitForReceipt,
      waitForArcReceipt?: WaitForReceipt
    ) => {
      setStatus('approving')
      setMessage('Approving source-chain USDC...')
      setBurnTx(null)
      setMintTx(null)
      try {
        setStatus('burning')
        setMessage('Burning USDC through TokenMessengerV2...')
        const result = await cctpBurnAndMint(sourceChainId, amount, recipient, sourceWalletClient, waitForSourceReceipt)
        setBurnTx(result.burnTx)

        setStatus('attesting')
        setMessage('Waiting for Circle attestation...')
        const attestation = await pollAttestationApi(sourceChainId, result.burnTx)

        setStatus('minting')
        setMessage('Submitting receiveMessage on Arc...')
        const arcWalletClient = await getArcWalletClient()
        const nextMintTx = await cctpReceiveMessage(attestation.message, attestation.attestation, arcWalletClient)
        if (waitForArcReceipt) await waitForArcReceipt(nextMintTx)
        setMintTx(nextMintTx)

        setStatus('minted')
        setMessage(`Mint submitted: ${nextMintTx.slice(0, 10)}...${nextMintTx.slice(-6)}`)
        return { ...result, attestation, mintTx: nextMintTx }
      } catch (error) {
        setStatus('error')
        setMessage(error instanceof Error ? error.message : String(error))
        return null
      }
    },
    []
  )

  const startForwardedTransfer = useCallback(
    async (sourceChainId: number, amount: string, recipient: Address, walletClient: WalletClientLike, waitForSourceReceipt?: WaitForReceipt) => {
      setStatus('approving')
      setMessage('Approving source-chain USDC plus forwarding fee...')
      setBurnTx(null)
      setMintTx(null)
      try {
        setStatus('burning')
        setMessage('Burning USDC with Arc forwarding hook...')
        const result = await cctpBurnWithForwarding(sourceChainId, amount, recipient, walletClient, waitForSourceReceipt)
        setBurnTx(result.burnTx)

        setStatus('attesting')
        setMessage('Waiting for Circle attestation and forwarder execution...')
        const attestation = await pollAttestationApi(sourceChainId, result.burnTx)

        setStatus('minted')
        setMintTx(attestation.forwardTxHash ?? null)
        setMessage(attestation.forwardTxHash ? `Forwarded mint: ${attestation.forwardTxHash.slice(0, 10)}...${attestation.forwardTxHash.slice(-6)}` : 'Attestation complete')
        return { ...result, attestation }
      } catch (error) {
        setStatus('error')
        setMessage(error instanceof Error ? error.message : String(error))
        return null
      }
    },
    []
  )

  return { status, message, burnTx, mintTx, startDirectTransfer, startForwardedTransfer }
}
