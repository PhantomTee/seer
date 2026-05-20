import { encodeFunctionData, pad, parseUnits, type Address, type Hex } from 'viem'
import { ARC_CONTRACTS } from '@/constants/arc'

export const TOKEN_MESSENGER_V2_ABI = [
  {
    type: 'function',
    name: 'depositForBurn',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'destinationDomain', type: 'uint32' },
      { name: 'mintRecipient', type: 'bytes32' },
      { name: 'burnToken', type: 'address' },
      { name: 'destinationCaller', type: 'bytes32' },
      { name: 'maxFee', type: 'uint256' },
      { name: 'minFinalityThreshold', type: 'uint32' }
    ],
    outputs: []
  },
  {
    type: 'function',
    name: 'depositForBurnWithHook',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'destinationDomain', type: 'uint32' },
      { name: 'mintRecipient', type: 'bytes32' },
      { name: 'burnToken', type: 'address' },
      { name: 'destinationCaller', type: 'bytes32' },
      { name: 'maxFee', type: 'uint256' },
      { name: 'minFinalityThreshold', type: 'uint32' },
      { name: 'hookData', type: 'bytes' }
    ],
    outputs: []
  }
] as const

export const MESSAGE_TRANSMITTER_V2_ABI = [
  {
    type: 'function',
    name: 'receiveMessage',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'message', type: 'bytes' },
      { name: 'attestation', type: 'bytes' }
    ],
    outputs: []
  }
] as const

export const ERC20_APPROVE_ABI = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ type: 'bool' }]
  }
] as const

const IRIS_API = 'https://iris-api-sandbox.circle.com'
const FORWARDING_SERVICE_HOOK_DATA = '0x636374702d666f72776172640000000000000000000000000000000000000000' as Hex

const sourceDomains: Record<number, number> = {
  1: 0,
  11155111: 0,
  42161: 3,
  421614: 3,
  8453: 6,
  84532: 6,
  137: 7,
  80002: 7
}

const tokenMessengers: Record<number, Address> = {
  11155111: '0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa',
  1: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
  42161: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
  8453: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
  137: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d'
}

const usdcAddresses: Record<number, Address> = {
  1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  11155111: '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238',
  42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  421614: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
  8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  84532: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  137: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  80002: '0x9999f7fea5938fd3b1e26a12c3f2f1d4c9b6f4b'
}

export const CCTP_SOURCE_CHAINS = [
  { chainId: 11155111, name: 'Ethereum Sepolia' }
] as const

export type CctpMessage = {
  status: string
  message: Hex
  attestation: Hex
  forwardTxHash?: Hex
}

export function getCctpSourceDomain(chainId: number) {
  const domain = sourceDomains[chainId]
  if (domain === undefined) throw new Error(`Unsupported CCTP source chain: ${chainId}`)
  return domain
}

export function getTokenMessengerAddress(chainId: number) {
  const address = tokenMessengers[chainId]
  if (!address) throw new Error(`Unsupported TokenMessengerV2 source chain: ${chainId}`)
  return address
}

export function getUsdcAddress(chainId: number) {
  const address = usdcAddresses[chainId]
  if (!address) throw new Error(`Unsupported USDC source chain: ${chainId}`)
  return address
}

export async function getFastTransferFee(sourceChainId: number, amount: string, forward = false) {
  const sourceDomain = getCctpSourceDomain(sourceChainId)
  const url = `${IRIS_API}/v2/burn/USDC/fees/${sourceDomain}/${ARC_CONTRACTS.CCTP_ARC_DOMAIN}${forward ? '?forward=true' : ''}`
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to fetch CCTP fee: ${await response.text()}`)
  const fees = (await response.json()) as Array<{ finalityThreshold: number; minimumFee: number; forwardFee?: { med: number } }>
  const fastFee = fees.find((fee) => fee.finalityThreshold <= 1000) ?? fees[0]
  const parsedAmount = parseUnits(amount, 6)
  const protocolFee = (parsedAmount * BigInt(Math.round(fastFee.minimumFee * 100))) / 1_000_000n
  const forwardFee = BigInt(fastFee.forwardFee?.med ?? 0)
  return {
    maxFee: ((protocolFee + forwardFee) * 120n) / 100n,
    protocolFee,
    forwardFee,
    raw: fastFee
  }
}

type WalletClientLike = {
  sendTransaction: (args: { to: Address; data: Hex }) => Promise<Hex>
}

type WaitForReceipt = (hash: Hex) => Promise<unknown>

export async function cctpBurnAndMint(
  sourceChainId: number,
  amount: string,
  recipient: Address,
  walletClient: WalletClientLike,
  waitForReceipt?: WaitForReceipt
) {
  const parsedAmount = parseUnits(amount, 6)
  const tokenMessenger = getTokenMessengerAddress(sourceChainId)
  const usdc = getUsdcAddress(sourceChainId)
  const { maxFee } = await getFastTransferFee(sourceChainId, amount)
  const recipientBytes32 = pad(recipient, { size: 32 })
  const destinationCaller = pad('0x', { size: 32 })

  const approveTx = await walletClient.sendTransaction({
    to: usdc,
    data: encodeFunctionData({
      abi: ERC20_APPROVE_ABI,
      functionName: 'approve',
      args: [tokenMessenger, parsedAmount]
    })
  })
  if (waitForReceipt) await waitForReceipt(approveTx)

  const burnTx = await walletClient.sendTransaction({
    to: tokenMessenger,
    data: encodeFunctionData({
      abi: TOKEN_MESSENGER_V2_ABI,
      functionName: 'depositForBurn',
      args: [parsedAmount, ARC_CONTRACTS.CCTP_ARC_DOMAIN, recipientBytes32, usdc, destinationCaller, maxFee, 1000]
    })
  })
  if (waitForReceipt) await waitForReceipt(burnTx)

  return { approveTx, burnTx }
}

export async function cctpReceiveMessage(message: Hex, attestation: Hex, walletClient: {
  sendTransaction: (args: { to: Address; data: Hex }) => Promise<Hex>
}) {
  return walletClient.sendTransaction({
    to: ARC_CONTRACTS.CCTP_MESSAGE_TRANSMITTER as Address,
    data: encodeFunctionData({
      abi: MESSAGE_TRANSMITTER_V2_ABI,
      functionName: 'receiveMessage',
      args: [message, attestation]
    })
  })
}

export async function cctpBurnWithForwarding(
  sourceChainId: number,
  amount: string,
  recipient: Address,
  walletClient: WalletClientLike,
  waitForReceipt?: WaitForReceipt
) {
  const parsedAmount = parseUnits(amount, 6)
  const tokenMessenger = getTokenMessengerAddress(sourceChainId)
  const usdc = getUsdcAddress(sourceChainId)
  const { maxFee, forwardFee, protocolFee } = await getFastTransferFee(sourceChainId, amount, true)
  const totalAmount = parsedAmount + maxFee

  const approveTx = await walletClient.sendTransaction({
    to: usdc,
    data: encodeFunctionData({
      abi: ERC20_APPROVE_ABI,
      functionName: 'approve',
      args: [tokenMessenger, totalAmount]
    })
  })
  if (waitForReceipt) await waitForReceipt(approveTx)

  const burnTx = await walletClient.sendTransaction({
    to: tokenMessenger,
    data: encodeFunctionData({
      abi: TOKEN_MESSENGER_V2_ABI,
      functionName: 'depositForBurnWithHook',
      args: [
        totalAmount,
        ARC_CONTRACTS.CCTP_ARC_DOMAIN,
        pad(recipient, { size: 32 }),
        usdc,
        pad('0x', { size: 32 }),
        maxFee,
        1000,
        FORWARDING_SERVICE_HOOK_DATA
      ]
    })
  })
  if (waitForReceipt) await waitForReceipt(burnTx)

  return { approveTx, burnTx, totalAmount, forwardFee, protocolFee }
}

export async function pollAttestationApi(sourceChainId: number, burnTx: Hex) {
  const sourceDomain = getCctpSourceDomain(sourceChainId)
  const url = `${IRIS_API}/v2/messages/${sourceDomain}?transactionHash=${burnTx}`
  for (;;) {
    const response = await fetch(url)
    if (response.ok) {
      const data = (await response.json()) as {
        messages?: CctpMessage[]
      }
      const message = data.messages?.[0]
      if (message?.status === 'complete' || message?.forwardTxHash) return message
    }
    await new Promise((resolve) => setTimeout(resolve, 5000))
  }
}
