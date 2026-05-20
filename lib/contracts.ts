import { createPublicClient, getContract, http, type Address } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { createWalletClient } from 'viem'
import { arcTestnet } from './arc'
import { ARC_CONTRACTS } from '@/constants/arc'

export const erc20Abi = [
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'allowance', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] }
] as const

export const marketFactoryAbi = [
  { type: 'event', name: 'MarketCreated', inputs: [
    { name: 'marketId', type: 'uint256', indexed: true },
    { name: 'creator', type: 'address', indexed: true },
    { name: 'question', type: 'string', indexed: false },
    { name: 'oracleMode', type: 'uint8', indexed: false },
    { name: 'resolutionTime', type: 'uint256', indexed: false }
  ] },
  { type: 'function', name: 'createMarket', stateMutability: 'nonpayable', inputs: [
    { name: 'question', type: 'string' },
    { name: 'ipfsMetadata', type: 'string' },
    { name: 'resolutionTime', type: 'uint256' },
    { name: 'oracleMode', type: 'uint8' },
    { name: 'marketType', type: 'uint8' },
    { name: 'chainlinkFeed', type: 'address' },
    { name: 'chainlinkThreshold', type: 'uint256' },
    { name: 'chainlinkAbove', type: 'bool' },
    { name: 'outcomeLabels', type: 'string[]' }
  ], outputs: [{ name: 'marketId', type: 'uint256' }] },
  { type: 'function', name: 'getAllMarketIds', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256[]' }] },
  { type: 'function', name: 'getMarket', stateMutability: 'view', inputs: [{ name: 'marketId', type: 'uint256' }], outputs: [{ type: 'tuple', components: [
    { name: 'id', type: 'uint256' },
    { name: 'creator', type: 'address' },
    { name: 'question', type: 'string' },
    { name: 'ipfsMetadata', type: 'string' },
    { name: 'resolutionTime', type: 'uint256' },
    { name: 'oracleMode', type: 'uint8' },
    { name: 'marketType', type: 'uint8' },
    { name: 'state', type: 'uint8' },
    { name: 'creationBond', type: 'uint256' },
    { name: 'createdAt', type: 'uint256' },
    { name: 'chainlinkFeed', type: 'address' },
    { name: 'chainlinkThreshold', type: 'uint256' },
    { name: 'chainlinkAbove', type: 'bool' },
    { name: 'outcomeLabels', type: 'string[]' }
  ] }] }
] as const

export const conditionalTokenAbi = [
  { type: 'function', name: 'split', stateMutability: 'nonpayable', inputs: [{ name: 'marketId', type: 'uint256' }, { name: 'amount', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'redeem', stateMutability: 'nonpayable', inputs: [{ name: 'marketId', type: 'uint256' }, { name: 'amount', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'setApprovalForAll', stateMutability: 'nonpayable', inputs: [{ name: 'operator', type: 'address' }, { name: 'approved', type: 'bool' }], outputs: [] },
  { type: 'function', name: 'tokenId', stateMutability: 'pure', inputs: [{ name: 'marketId', type: 'uint256' }, { name: 'outcomeIndex', type: 'uint256' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }, { name: 'id', type: 'uint256' }], outputs: [{ type: 'uint256' }] }
] as const

export const oracleResolverAbi = [
  { type: 'function', name: 'triggerChainlinkResolution', stateMutability: 'nonpayable', inputs: [{ name: 'marketId', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'proposeOutcome', stateMutability: 'nonpayable', inputs: [{ name: 'marketId', type: 'uint256' }, { name: 'outcomeIndex', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'disputeOutcome', stateMutability: 'nonpayable', inputs: [{ name: 'marketId', type: 'uint256' }, { name: 'counterOutcome', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'settleUndisputed', stateMutability: 'nonpayable', inputs: [{ name: 'marketId', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'adminResolve', stateMutability: 'nonpayable', inputs: [{ name: 'marketId', type: 'uint256' }, { name: 'outcomeIndex', type: 'uint256' }], outputs: [] }
] as const

export const cpmmAbi = [
  { type: 'function', name: 'getPrice', stateMutability: 'view', inputs: [{ name: 'marketId', type: 'uint256' }, { name: 'outcomeIndex', type: 'uint256' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'getReserves', stateMutability: 'view', inputs: [{ name: 'marketId', type: 'uint256' }], outputs: [{ type: 'uint256[]' }] },
  { type: 'function', name: 'buyOutcome', stateMutability: 'nonpayable', inputs: [{ name: 'marketId', type: 'uint256' }, { name: 'outcomeIndex', type: 'uint256' }, { name: 'usdcIn', type: 'uint256' }, { name: 'minOut', type: 'uint256' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'sellOutcome', stateMutability: 'nonpayable', inputs: [{ name: 'marketId', type: 'uint256' }, { name: 'outcomeIndex', type: 'uint256' }, { name: 'tokenIn', type: 'uint256' }, { name: 'minUsdcOut', type: 'uint256' }], outputs: [{ type: 'uint256' }] }
] as const

export const orderBookAbi = [
  { type: 'event', name: 'OrderPlaced', inputs: [
    { name: 'orderId', type: 'uint256', indexed: true },
    { name: 'maker', type: 'address', indexed: true },
    { name: 'marketId', type: 'uint256', indexed: false },
    { name: 'outcomeIndex', type: 'uint256', indexed: false },
    { name: 'side', type: 'uint8', indexed: false },
    { name: 'price', type: 'uint256', indexed: false },
    { name: 'size', type: 'uint256', indexed: false }
  ] },
  { type: 'function', name: 'placeOrder', stateMutability: 'nonpayable', inputs: [
    { name: 'marketId', type: 'uint256' },
    { name: 'outcomeIndex', type: 'uint256' },
    { name: 'side', type: 'uint8' },
    { name: 'price', type: 'uint256' },
    { name: 'size', type: 'uint256' }
  ], outputs: [{ name: 'orderId', type: 'uint256' }] },
  { type: 'function', name: 'cancelOrder', stateMutability: 'nonpayable', inputs: [{ name: 'orderId', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'getBestBid', stateMutability: 'view', inputs: [{ name: 'marketId', type: 'uint256' }, { name: 'outcomeIndex', type: 'uint256' }], outputs: [{ name: 'price', type: 'uint256' }, { name: 'size', type: 'uint256' }] },
  { type: 'function', name: 'getBestAsk', stateMutability: 'view', inputs: [{ name: 'marketId', type: 'uint256' }, { name: 'outcomeIndex', type: 'uint256' }], outputs: [{ name: 'price', type: 'uint256' }, { name: 'size', type: 'uint256' }] }
] as const

export const aggregatorV3Abi = [
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { type: 'function', name: 'latestRoundData', stateMutability: 'view', inputs: [], outputs: [
    { name: 'roundId', type: 'uint80' },
    { name: 'answer', type: 'int256' },
    { name: 'startedAt', type: 'uint256' },
    { name: 'updatedAt', type: 'uint256' },
    { name: 'answeredInRound', type: 'uint80' }
  ] }
] as const

export function getPublicClient() {
  return createPublicClient({
    chain: arcTestnet,
    transport: http(process.env.NEXT_PUBLIC_ARC_RPC_URL || arcTestnet.rpcUrls.default.http[0])
  })
}

export function getAgentWalletClient() {
  const privateKey = process.env.AGENT_PRIVATE_KEY as `0x${string}` | undefined
  if (!privateKey) return null
  const account = privateKeyToAccount(privateKey)
  return createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(process.env.NEXT_PUBLIC_ARC_RPC_URL || arcTestnet.rpcUrls.default.http[0])
  })
}

export function getContractAddresses() {
  return {
    usdc: (process.env.NEXT_PUBLIC_USDC_ADDRESS || ARC_CONTRACTS.USDC) as Address,
    marketFactory: process.env.NEXT_PUBLIC_MARKET_FACTORY as Address | undefined,
    conditionalToken: process.env.NEXT_PUBLIC_CONDITIONAL_TOKEN as Address | undefined,
    cpmm: process.env.NEXT_PUBLIC_CPMM as Address | undefined,
    orderBook: process.env.NEXT_PUBLIC_ORDER_BOOK as Address | undefined,
    oracleResolver: process.env.NEXT_PUBLIC_ORACLE_RESOLVER as Address | undefined,
    disputeModule: process.env.NEXT_PUBLIC_DISPUTE_MODULE as Address | undefined,
    treasuryVault: process.env.NEXT_PUBLIC_TREASURY_VAULT as Address | undefined
  }
}

export function getReadContract<TAbi extends readonly unknown[]>(address: Address, abi: TAbi) {
  return getContract({
    address,
    abi,
    client: getPublicClient()
  })
}
