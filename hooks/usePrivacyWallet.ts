'use client'

import { useCallback, useEffect, useState } from 'react'
import { ethers } from 'ethers'

// ---------------------------------------------------------------------------
// usePrivacyWallet — manages a throwaway keypair for Stabletrust confidential
// positions on Arc Testnet (chain 5042002).
//
// The keypair is generated in-browser with ethers.Wallet.createRandom().
// The private key is stored in sessionStorage (cleared on tab close).
// All Stabletrust calls are proxied through /api/privacy so the private key
// never leaves the browser via the network in plaintext (it goes to OUR
// Next.js server, which proxies to Stabletrust).
//
// This is separate from the user's MetaMask wallet — it's a dedicated
// "privacy wallet" whose only purpose is to hold confidential USDC.
// ---------------------------------------------------------------------------

const SESSION_KEY = 'arc_privacy_wallet'
const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS ?? '0x3600000000000000000000000000000000000000'

export interface PrivacyBalance {
  total: string
  available: string
  pending: string
}

async function callProxy(
  action: 'balance' | 'deposit' | 'withdraw' | 'transfer',
  privateKey: string,
  extra: Record<string, unknown> = {}
) {
  const res = await fetch('/api/privacy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, privateKey, tokenAddress: USDC_ADDRESS, ...extra }),
  })
  const data = await res.json() as Record<string, unknown>
  if (!res.ok) throw new Error((data.error as string) ?? `Privacy ${action} failed`)
  return data
}

export function usePrivacyWallet() {
  const [privateKey, setPrivateKey] = useState<string>('')
  const [address, setAddress]       = useState<string>('')
  const [balance, setBalance]       = useState<PrivacyBalance | null>(null)
  const [busy, setBusy]             = useState(false)
  const [error, setError]           = useState<string | null>(null)

  // Restore from sessionStorage on mount
  useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_KEY)
    if (stored) {
      try {
        const { pk, addr } = JSON.parse(stored) as { pk: string; addr: string }
        setPrivateKey(pk)
        setAddress(addr)
      } catch {
        sessionStorage.removeItem(SESSION_KEY)
      }
    }
  }, [])

  /** Generate (or restore) the privacy keypair */
  const setup = useCallback(() => {
    const stored = sessionStorage.getItem(SESSION_KEY)
    if (stored) {
      try {
        const { pk, addr } = JSON.parse(stored) as { pk: string; addr: string }
        setPrivateKey(pk)
        setAddress(addr)
        return
      } catch { /* fall through to generate */ }
    }
    const wallet = ethers.Wallet.createRandom()
    const pk   = wallet.privateKey
    const addr = wallet.address
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ pk, addr }))
    setPrivateKey(pk)
    setAddress(addr)
  }, [])

  /** Import an existing private key (paste-to-restore flow) */
  const importKey = useCallback((rawKey: string): string | null => {
    try {
      const key = rawKey.trim().startsWith('0x') ? rawKey.trim() : `0x${rawKey.trim()}`
      const wallet = new ethers.Wallet(key)
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ pk: wallet.privateKey, addr: wallet.address }))
      setPrivateKey(wallet.privateKey)
      setAddress(wallet.address)
      setBalance(null)
      return null // no error
    } catch {
      return 'Invalid private key — make sure you copied it correctly.'
    }
  }, [])

  /** Clear the keypair from memory and session */
  const clear = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY)
    setPrivateKey('')
    setAddress('')
    setBalance(null)
  }, [])

  const revealBalance = useCallback(async () => {
    if (!privateKey) throw new Error('Setup privacy wallet first')
    setBusy(true)
    setError(null)
    try {
      const data = await callProxy('balance', privateKey)
      const b = data.balance as PrivacyBalance
      setBalance(b)
      return b
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      throw err
    } finally {
      setBusy(false)
    }
  }, [privateKey])

  const deposit = useCallback(async (amountUsdc: string) => {
    if (!privateKey) throw new Error('Setup privacy wallet first')
    setBusy(true)
    setError(null)
    try {
      await callProxy('deposit', privateKey, { amount: Number(amountUsdc) })
      await revealBalance()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      throw err
    } finally {
      setBusy(false)
    }
  }, [privateKey, revealBalance])

  const withdraw = useCallback(async (amountUsdc: string) => {
    if (!privateKey) throw new Error('Setup privacy wallet first')
    setBusy(true)
    setError(null)
    try {
      await callProxy('withdraw', privateKey, { amount: Number(amountUsdc) })
      await revealBalance()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      throw err
    } finally {
      setBusy(false)
    }
  }, [privateKey, revealBalance])

  return {
    privateKey,
    address,
    balance,
    busy,
    error,
    isReady: Boolean(privateKey),
    setup,
    importKey,
    clear,
    deposit,
    withdraw,
    revealBalance,
  }
}
