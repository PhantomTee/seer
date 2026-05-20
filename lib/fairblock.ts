import { ethers } from 'ethers'

// ---------------------------------------------------------------------------
// Fairblock / Stabletrust — two separate chain IDs, two separate transports
//
// SDK (@fairblock/stabletrust) — browser/MetaMask path
//   Supported chains by SDK: 1244, 2201, 84532, 11155111, 421614, 42431
//   Arc Testnet SDK chain ID: 1244  (Fairblock's Arc layer — separate from the EVM chain)
//   RPC: https://rpc.arc.xyz
//
// REST API (stabletrust-api.fairblock.network) — server-side / agent path
//   Supported chains by API: includes 5042002 (Arc Testnet EVM)
//   Use for: AI agent wallets that hold their own private keys server-side
//
// Prediction market contracts live on Arc EVM chain 5042002.
// Confidential USDC via SDK lives on Fairblock's Arc layer 1244.
// ---------------------------------------------------------------------------

const SDK_CHAIN_ID = 1244               // Fairblock's Arc layer — what the SDK expects
const SDK_RPC = 'https://rpc.arc.xyz'  // RPC for chain 1244

const ARC_CHAIN_ID = 5042002            // Arc Testnet EVM — for REST API calls
const STABLETRUST_API = 'https://stabletrust-api.fairblock.network'

// ---- REST API client (used server-side / for agent wallet operations) -----

export interface StabletrustBalance {
  total: string
  available: string
  pending: string
}

/** Decode raw balance units (6-decimal USDC) to human-readable strings */
function decodeBalance(raw: { total: string; available: string; pending: string }): StabletrustBalance {
  return {
    total: ethers.formatUnits(BigInt(raw.total), 6),
    available: ethers.formatUnits(BigInt(raw.available), 6),
    pending: ethers.formatUnits(BigInt(raw.pending), 6),
  }
}

/** Get confidential balance via REST API (server-side / agent use) */
export async function apiGetBalance(privateKey: string, tokenAddress: string, chainId = ARC_CHAIN_ID): Promise<StabletrustBalance> {
  const res = await fetch(`${STABLETRUST_API}/balance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ privateKey, tokenAddress, chainId }),
  })
  const data = await res.json() as { success: boolean; balance?: { total: string; available: string; pending: string }; error?: string }
  if (!data.success) throw new Error(data.error ?? 'Stabletrust balance failed')
  return decodeBalance(data.balance!)
}

/** Deposit USDC into confidential layer via REST API (server-side / agent use) */
export async function apiDeposit(privateKey: string, tokenAddress: string, amountUsdc: string, chainId = ARC_CHAIN_ID) {
  const amount = ethers.parseUnits(amountUsdc, 6).toString()
  const res = await fetch(`${STABLETRUST_API}/deposit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ privateKey, tokenAddress, amount, chainId, waitForFinalization: true }),
  })
  const data = await res.json() as { success: boolean; tx?: string; error?: string }
  if (!data.success) throw new Error(data.error ?? 'Stabletrust deposit failed')
  return data.tx!
}

/** Transfer USDC privately via REST API (server-side / agent use) */
export async function apiTransfer(privateKey: string, recipientAddress: string, tokenAddress: string, amountUsdc: number, chainId = ARC_CHAIN_ID) {
  const res = await fetch(`${STABLETRUST_API}/transfer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ privateKey, recipientAddress, tokenAddress, amount: amountUsdc, chainId, waitForFinalization: true }),
  })
  const data = await res.json() as { success: boolean; tx?: string; error?: string }
  if (!data.success) throw new Error(data.error ?? 'Stabletrust transfer failed')
  return data.tx!
}

/** Withdraw USDC from confidential layer via REST API (server-side / agent use) */
export async function apiWithdraw(privateKey: string, tokenAddress: string, amountUsdc: number, chainId = ARC_CHAIN_ID) {
  const res = await fetch(`${STABLETRUST_API}/withdraw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ privateKey, tokenAddress, amount: amountUsdc, chainId, waitForFinalization: true }),
  })
  const data = await res.json() as { success: boolean; tx?: string; error?: string }
  if (!data.success) throw new Error(data.error ?? 'Stabletrust withdraw failed')
  return data.tx!
}

// ---- SDK client (used browser-side for MetaMask users) -------------------

type StabletrustClient = {
  ensureAccount: (signer: ethers.Signer) => Promise<{ privateKey: string; publicKey: string }>
  confidentialDeposit: (signer: ethers.Signer, token: string, amount: unknown, opts?: unknown) => Promise<unknown>
  confidentialTransfer: (signer: ethers.Signer, recipient: string, token: string, amount: unknown, opts?: unknown) => Promise<unknown>
  getConfidentialBalance: (address: string, privateKey: string, token: string) => Promise<{ amount: bigint; available: { amount: bigint }; pending: { amount: bigint } }>
  withdraw: (signer: ethers.Signer, token: string, amount: unknown, opts?: unknown) => Promise<unknown>
  confidentialWithdraw?: (signer: ethers.Signer, token: string, amount: unknown, opts?: unknown) => Promise<unknown>
}

type StabletrustCtor = new (rpcUrl: string, chainId: number) => StabletrustClient

async function loadStabletrustClient(): Promise<StabletrustCtor> {
  try {
    const module = await import('@fairblock/stabletrust')
    return module.ConfidentialTransferClient as unknown as StabletrustCtor
  } catch (err) {
    throw new Error(
      `Stabletrust SDK unavailable: ${err instanceof Error ? err.message : String(err)}`
    )
  }
}

export function getFairblockStatus() {
  return {
    sdkChainId: SDK_CHAIN_ID,
    sdkRpc: SDK_RPC,
    apiChainId: ARC_CHAIN_ID,
    apiBase: STABLETRUST_API,
    note: 'SDK uses chain 1244 (Fairblock Arc layer). REST API uses chain 5042002 (Arc EVM).',
  }
}

export async function getFairblockClient() {
  const ConfidentialTransferClient = await loadStabletrustClient()
  // SDK requires chain 1244 — the Fairblock Arc layer, not the EVM chain 5042002
  const rpc = process.env.FAIRBLOCK_RPC_URL ?? SDK_RPC
  const chainId = Number(process.env.FAIRBLOCK_CHAIN_ID ?? SDK_CHAIN_ID)
  return new ConfidentialTransferClient(rpc, chainId)
}

/** USDC address on Arc Testnet */
function getUsdcAddress() {
  return process.env.NEXT_PUBLIC_USDC_ADDRESS ?? '0x3600000000000000000000000000000000000000'
}

export async function ensureFairblockAccount(signer: ethers.Signer) {
  const client = await getFairblockClient()
  return client.ensureAccount(signer)
}

export async function confidentialDeposit(signer: ethers.Signer, amount: string) {
  const client = await getFairblockClient()
  return client.confidentialDeposit(signer, getUsdcAddress(), ethers.parseUnits(amount, 6), { waitForFinalization: true })
}

export async function confidentialTransfer(signer: ethers.Signer, recipientAddress: string, amount: string) {
  const client = await getFairblockClient()
  return client.confidentialTransfer(signer, recipientAddress, getUsdcAddress(), ethers.parseUnits(amount, 6), { waitForFinalization: true })
}

export async function getConfidentialBalance(signer: ethers.Signer, privateKey: string) {
  const client = await getFairblockClient()
  const balance = await client.getConfidentialBalance(await signer.getAddress(), privateKey, getUsdcAddress())
  return {
    total: ethers.formatUnits(balance.amount, 6),
    available: ethers.formatUnits(balance.available?.amount ?? 0n, 6),
    pending: ethers.formatUnits(balance.pending?.amount ?? 0n, 6),
  }
}

export async function confidentialWithdraw(signer: ethers.Signer, amount: string) {
  const client = await getFairblockClient()
  const fn = client.confidentialWithdraw ?? client.withdraw
  if (!fn) throw new Error('Stabletrust SDK: withdraw method not found')
  return fn.call(client, signer, getUsdcAddress(), ethers.parseUnits(amount, 6), { waitForFinalization: true })
}
