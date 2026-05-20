import type { Address } from 'viem'
import { getAgentWalletClient, getContractAddresses, getPublicClient, oracleResolverAbi } from '@/lib/contracts'
import { readChainlinkPrice } from '@/lib/chainlink'
import { createServiceSupabase } from '@/lib/supabase'
import { assertCron, json } from '../../_utils'

export async function POST(request: Request) {
  if (!assertCron(request)) return json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceSupabase()
  if (!supabase) return json({ error: 'Supabase is not configured' }, { status: 503 })

  const { data: markets, error } = await supabase
    .from('markets')
    .select('*')
    .eq('oracle_mode', 'CHAINLINK')
    .eq('state', 'OPEN')
    .lt('resolution_time', new Date().toISOString())

  if (error) return json({ error: error.message }, { status: 500 })

  const walletClient = getAgentWalletClient()
  const publicClient = getPublicClient()
  const addresses = getContractAddresses()
  const results = []

  for (const market of markets ?? []) {
    if (!market.chainlink_feed) continue
    const price = await readChainlinkPrice(market.chainlink_feed as Address)
    if (!walletClient || !addresses.oracleResolver) {
      results.push({ marketId: market.id, dryRun: true, price })
      await supabase.from('agent_logs').insert({
        action: 'resolve',
        market_id: market.id,
        details: { dryRun: true, price, reason: 'Missing AGENT_PRIVATE_KEY or resolver address' }
      })
      continue
    }

    const { request: contractRequest } = await publicClient.simulateContract({
      account: walletClient.account,
      address: addresses.oracleResolver,
      abi: oracleResolverAbi,
      functionName: 'triggerChainlinkResolution',
      args: [BigInt(market.id)]
    })
    const txHash = await walletClient.writeContract(contractRequest)
    await supabase.from('agent_logs').insert({
      action: 'resolve',
      market_id: market.id,
      tx_hash: txHash,
      details: { price }
    })
    results.push({ marketId: market.id, txHash, price })
  }

  return json({ checked: markets?.length ?? 0, results })
}
