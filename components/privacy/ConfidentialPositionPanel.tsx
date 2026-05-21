'use client'

import { AlertTriangle, CheckCircle2, Copy, Eye, EyeOff, KeyRound, Lock, RefreshCcw, ShieldCheck, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { usePrivacyWallet } from '@/hooks/usePrivacyWallet'
import { ARC_TESTNET } from '@/constants/arc'

function shortAddr(addr: string) {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : ''
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="focus-ring inline-flex items-center gap-1 border border-white/10 px-2 py-1 text-[11px] text-white/50 hover:text-white btn-press"
    >
      {copied ? <CheckCircle2 className="h-3 w-3 text-mint" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copied!' : (label ?? 'Copy')}
    </button>
  )
}

export function ConfidentialPositionPanel({ compact = false }: { compact?: boolean }) {
  const pw = usePrivacyWallet()
  const [amount, setAmount] = useState('10')
  const [showKey, setShowKey] = useState(false)
  const [keySaved, setKeySaved] = useState(false)
  const [importMode, setImportMode] = useState(false)
  const [importValue, setImportValue] = useState('')
  const [importError, setImportError] = useState('')

  // Sync step with wallet state on mount
  const effectiveStep = pw.isReady ? (keySaved ? 'ready' : 'warning') : 'idle'

  function handleSetup() {
    pw.setup()
    setKeySaved(false)
    setShowKey(false)
    setImportMode(false)
  }

  function handleImport() {
    setImportError('')
    const err = pw.importKey(importValue)
    if (err) {
      setImportError(err)
      return
    }
    setImportValue('')
    setImportMode(false)
    setKeySaved(true) // they already have the key — skip warning
  }

  function handleConfirmSaved() {
    setKeySaved(true)
  }

  return (
    <div className="border border-white/10 bg-white/[0.035] p-4 shadow-hard">
      {/* Header */}
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-white">
        <ShieldCheck className="h-4 w-4 text-mint" />
        Confidential Position
      </h2>
      <p className="mb-3 text-xs leading-5 text-white/50">
        A dedicated privacy wallet encrypts your USDC on-chain via Fairblock Stabletrust.
        Balance and transfers are hidden from block explorers.
      </p>

      {/* Error */}
      {pw.error && (
        <div className="mb-3 border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
          {pw.error}
        </div>
      )}

      {!compact && (
        <>
          {/* ── STEP 1: Not set up ─────────────────────────────── */}
          {effectiveStep === 'idle' && (
            <div className="space-y-3">
              <div className="border border-white/10 bg-ink/40 p-3 text-xs leading-5 text-white/50">
                <span className="font-semibold text-mint/80">How it works: </span>
                A fresh keypair is generated locally in your browser. Fund it with USDC,
                then deposit to encrypt your balance. Powered by Fairblock Stabletrust
                on Arc Testnet (chain 5042002).
              </div>

              {/* Tab toggle */}
              <div className="grid grid-cols-2 gap-1 border border-white/10 bg-ink/40 p-1">
                <button
                  type="button"
                  onClick={() => { setImportMode(false); setImportError('') }}
                  className={`py-1.5 text-xs font-semibold transition-colors ${!importMode ? 'bg-mint text-black' : 'text-white/40 hover:text-white'}`}
                >
                  Generate new
                </button>
                <button
                  type="button"
                  onClick={() => { setImportMode(true); setImportError('') }}
                  className={`py-1.5 text-xs font-semibold transition-colors ${importMode ? 'bg-mint text-black' : 'text-white/40 hover:text-white'}`}
                >
                  Import existing
                </button>
              </div>

              {!importMode ? (
                <button
                  type="button"
                  onClick={handleSetup}
                  className="focus-ring inline-flex w-full items-center justify-center gap-2 border-2 border-black bg-mint py-2.5 text-sm font-bold text-black btn-press"
                >
                  <KeyRound className="h-4 w-4" />
                  Generate privacy wallet
                </button>
              ) : (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-white/50">
                    Paste your saved private key
                  </label>
                  <textarea
                    value={importValue}
                    onChange={(e) => { setImportValue(e.target.value); setImportError('') }}
                    placeholder="0x…"
                    rows={3}
                    className="focus-ring w-full border border-white/10 bg-ink px-3 py-2 font-mono text-xs text-white placeholder:text-white/20 resize-none"
                  />
                  {importError && (
                    <p className="text-xs text-danger">{importError}</p>
                  )}
                  <button
                    type="button"
                    onClick={handleImport}
                    disabled={!importValue.trim()}
                    className="focus-ring inline-flex w-full items-center justify-center gap-2 border-2 border-black bg-mint py-2.5 text-sm font-bold text-black disabled:opacity-50 btn-press"
                  >
                    <KeyRound className="h-4 w-4" />
                    Restore wallet
                  </button>
                  <p className="text-[10px] text-white/28">
                    Your key never leaves your browser — it is only used locally to derive your wallet address and sign transactions.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 2: Key warning ────────────────────────────── */}
          {(effectiveStep === 'warning' || (pw.isReady && !keySaved)) && (
            <div className="space-y-3">
              {/* Big red warning */}
              <div className="border-2 border-danger/60 bg-danger/10 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-danger" />
                  <span className="text-sm font-bold text-danger">Save your private key now</span>
                </div>
                <p className="text-xs leading-5 text-danger/80">
                  This key exists <strong>only in your browser session</strong>. If you close or refresh
                  this tab without saving it, you will <strong>permanently lose access</strong> to any
                  USDC deposited under this wallet. We cannot recover it for you.
                </p>
              </div>

              {/* Private key display */}
              <div className="border border-white/15 bg-ink p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/35">
                    Private Key
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setShowKey((v) => !v)}
                      className="focus-ring inline-flex items-center gap-1 border border-white/10 px-2 py-1 text-[11px] text-white/50 hover:text-white btn-press"
                    >
                      {showKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      {showKey ? 'Hide' : 'Reveal'}
                    </button>
                    <CopyButton text={pw.privateKey} label="Copy key" />
                  </div>
                </div>
                <div className="break-all font-mono text-[11px] leading-5">
                  {showKey
                    ? <span className="text-amber">{pw.privateKey}</span>
                    : <span className="text-white/20">{'•'.repeat(64)}</span>
                  }
                </div>
              </div>

              {/* Wallet address */}
              <div className="flex items-center justify-between border border-white/10 bg-ink/40 px-3 py-2">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-white/30">Wallet address</div>
                  <div className="mt-0.5 font-mono text-xs text-mint">{pw.address}</div>
                </div>
                <CopyButton text={pw.address} label="Copy" />
              </div>

              {/* Confirm saved */}
              <button
                type="button"
                onClick={handleConfirmSaved}
                className="focus-ring inline-flex w-full items-center justify-center gap-2 border-2 border-mint/60 bg-mint/10 py-2.5 text-sm font-bold text-mint hover:bg-mint/20 btn-press"
              >
                <CheckCircle2 className="h-4 w-4" />
                I have saved my private key — continue
              </button>

              <p className="text-[10px] leading-4 text-white/28">
                Store it in a password manager or write it down. You can import it back by
                pasting it when prompted on a future session.
              </p>
            </div>
          )}

          {/* ── STEP 3: Ready ──────────────────────────────────── */}
          {effectiveStep === 'ready' && keySaved && (
            <div className="space-y-3">

              {/* Address row */}
              <div className="flex items-center justify-between border border-white/10 bg-ink/40 px-3 py-2">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-white/30">Privacy wallet</div>
                  <div className="mt-0.5 font-mono text-xs text-mint">{shortAddr(pw.address)}</div>
                </div>
                <div className="flex gap-1">
                  <CopyButton text={pw.address} label="Copy addr" />
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    title={showKey ? 'Hide key' : 'Show key'}
                    className="focus-ring border border-white/10 p-1.5 text-white/40 hover:text-white btn-press"
                  >
                    {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => { pw.clear(); setKeySaved(false) }}
                    title="Clear wallet from session"
                    className="focus-ring border border-danger/20 p-1.5 text-danger/50 hover:text-danger btn-press"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Link to faucet to fund the privacy wallet */}
              <a
                href={ARC_TESTNET.faucetUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/50 hover:text-white transition-colors"
              >
                Fund via faucet ↗
              </a>

              {/* Show key inline when toggled */}
              {showKey && (
                <div className="border border-amber/20 bg-amber/[0.04] p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-amber/50">Private Key</span>
                    <CopyButton text={pw.privateKey} label="Copy key" />
                  </div>
                  <div className="break-all font-mono text-[11px] text-amber/80">{pw.privateKey}</div>
                </div>
              )}

              {/* Balance */}
              {pw.balance ? (
                <div className="border border-mint/20 bg-mint/[0.05] px-3 py-2">
                  <div className="flex items-baseline gap-2">
                    <span className="font-bold text-mint">{pw.balance.available} USDC</span>
                    <span className="text-[11px] text-white/35">available</span>
                  </div>
                  {Number(pw.balance.pending) > 0 && (
                    <div className="mt-0.5 text-[11px] text-amber">
                      +{pw.balance.pending} USDC pending
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={pw.revealBalance}
                    disabled={pw.busy}
                    className="focus-ring mt-2 inline-flex items-center gap-1.5 text-[11px] text-white/30 hover:text-white/55 disabled:opacity-40"
                  >
                    <RefreshCcw className={`h-3 w-3 ${pw.busy ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={pw.revealBalance}
                  disabled={pw.busy}
                  className="focus-ring inline-flex items-center gap-2 border border-white/10 px-3 py-2 text-sm text-white/60 hover:bg-white/8 disabled:opacity-50 btn-press"
                >
                  <Eye className="h-4 w-4" />
                  {pw.busy ? 'Loading…' : 'Reveal balance'}
                </button>
              )}

              {/* Amount + actions */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-white/30">$</span>
                  <input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    className="focus-ring h-10 w-full border border-white/10 bg-ink pl-7 pr-3 text-sm text-white"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => pw.deposit(amount)}
                  disabled={pw.busy || !amount || Number(amount) <= 0}
                  className="focus-ring border-2 border-black bg-mint px-3 text-sm font-bold text-black disabled:opacity-50 btn-press"
                >
                  {pw.busy ? '…' : 'Deposit'}
                </button>
                {pw.balance && Number(pw.balance.available) > 0 && (
                  <button
                    type="button"
                    onClick={() => pw.withdraw(amount)}
                    disabled={pw.busy}
                    className="focus-ring inline-flex items-center gap-1.5 border border-white/15 px-3 py-2 text-sm text-white/60 hover:bg-white/8 disabled:opacity-50 btn-press"
                  >
                    <Lock className="h-3.5 w-3.5" />
                    Withdraw
                  </button>
                )}
              </div>

              <p className="text-[10px] leading-4 text-white/28">
                Fund this address with USDC on Arc Testnet, then deposit to encrypt.
                Key is session-only — paste it back to restore on a new session.
              </p>
            </div>
          )}
        </>
      )}

      {/* Compact mode — just show status */}
      {compact && (
        <div className="mt-1">
          {pw.isReady
            ? <p className="text-[11px] text-mint/70">Privacy wallet active · {shortAddr(pw.address)}</p>
            : <p className="text-[11px] text-white/30">Not set up · go to Portfolio to enable</p>
          }
        </div>
      )}
    </div>
  )
}
