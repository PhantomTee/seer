'use client'

import { useCallback, useMemo, useState } from 'react'
import { BrowserProvider, type Eip1193Provider } from 'ethers'
import { confidentialDeposit, confidentialWithdraw, ensureFairblockAccount, getConfidentialBalance, getFairblockStatus } from '@/lib/fairblock'

export function useFairblock() {
  const [enabled, setEnabled] = useState(false)
  const [privateKey, setPrivateKey] = useState('')
  const [publicKey, setPublicKey] = useState('')
  const [balance, setBalance] = useState<{ total: string; available: string; pending: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [sdkError, setSdkError] = useState<string | null>(null)
  const status = useMemo(() => getFairblockStatus(), [])

  const getSigner = useCallback(async () => {
    const ethereum = (window as unknown as { ethereum?: unknown }).ethereum
    if (!ethereum) throw new Error('Wallet provider not found')
    const provider = new BrowserProvider(ethereum as Eip1193Provider)
    return provider.getSigner()
  }, [])

  const ensureAccount = useCallback(async () => {
    setBusy(true)
    setSdkError(null)
    try {
      const signer = await getSigner()
      const keys = await ensureFairblockAccount(signer)
      setPrivateKey(keys.privateKey)
      setPublicKey(keys.publicKey)
      return keys
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setSdkError(msg)
      throw err
    } finally {
      setBusy(false)
    }
  }, [getSigner])

  const deposit = useCallback(
    async (amount: string) => {
      setBusy(true)
      try {
        const signer = await getSigner()
        if (!privateKey) await ensureAccount()
        return confidentialDeposit(signer, amount)
      } finally {
        setBusy(false)
      }
    },
    [ensureAccount, getSigner, privateKey]
  )

  const revealBalance = useCallback(async () => {
    if (!privateKey) throw new Error('Fairblock private key is required for this session')
    setBusy(true)
    try {
      const signer = await getSigner()
      const result = await getConfidentialBalance(signer, privateKey)
      setBalance(result)
      return result
    } finally {
      setBusy(false)
    }
  }, [getSigner, privateKey])

  const withdraw = useCallback(
    async (amount: string) => {
      setBusy(true)
      try {
        const signer = await getSigner()
        return confidentialWithdraw(signer, amount)
      } finally {
        setBusy(false)
      }
    },
    [getSigner]
  )

  return {
    enabled,
    setEnabled,
    privateKey,
    setPrivateKey,
    publicKey,
    balance,
    busy,
    sdkError,
    status,
    ensureAccount,
    deposit,
    revealBalance,
    withdraw
  }
}
