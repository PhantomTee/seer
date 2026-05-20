import type { Address } from 'viem'
import { aggregatorV3Abi, getPublicClient } from './contracts'

export async function readChainlinkPrice(feed: Address) {
  const publicClient = getPublicClient()
  const [decimals, round] = await Promise.all([
    publicClient.readContract({ address: feed, abi: aggregatorV3Abi, functionName: 'decimals' }),
    publicClient.readContract({ address: feed, abi: aggregatorV3Abi, functionName: 'latestRoundData' })
  ])

  const answer = round[1]
  return {
    decimals,
    answer,
    value: Number(answer) / 10 ** decimals,
    updatedAt: Number(round[3])
  }
}
