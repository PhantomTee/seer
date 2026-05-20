import { getAgentWalletClient, getContractAddresses, getPublicClient, oracleResolverAbi } from '@/lib/contracts'
import { createServiceSupabase } from '@/lib/supabase'
import { assertCron, json } from '../../_utils'

export async function POST(request: Request) {
  if (!assertCron(request)) return json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceSupabase()
  if (!supabase) return json({ error: 'Supabase is not configured' }, { status: 503 })

  const { data: disputes, error } = await supabase
    .from('disputes')
    .select('*')
    .is('challenger', null)
    .lt('dispute_deadline', new Date().toISOString())
    .is('resolved_outcome', null)

  if (error) return json({ error: error.message }, { status: 500 })

  const walletClient = getAgentWalletClient()
  const publicClient = getPublicClient()
  const addresses = getContractAddresses()
  const results = []

  for (const dispute of disputes ?? []) {
    if (walletClient && addresses.oracleResolver) {
      const { request: contractRequest } = await publicClient.simulateContract({
        account: walletClient.account,
        address: addresses.oracleResolver,
        abi: oracleResolverAbi,
        functionName: 'settleUndisputed',
        args: [BigInt(dispute.market_id)]
      })
      const txHash = await walletClient.writeContract(contractRequest)
      await supabase.from('disputes').update({ resolution_tx: txHash, resolved_outcome: dispute.proposed_outcome }).eq('id', dispute.id)
      results.push({ marketId: dispute.market_id, txHash })
    } else {
      results.push({ marketId: dispute.market_id, dryRun: true })
    }

    await supabase.from('user_alerts').insert({
      user_address: dispute.proposer.toLowerCase(),
      market_id: dispute.market_id,
      alert_type: 'resolution',
      message: `Optimistic proposal window expired for market ${dispute.market_id}.`
    })
  }

  await supabase.from('agent_logs').insert({ action: 'monitor', details: { checked: disputes?.length ?? 0, results } })
  return json({ checked: disputes?.length ?? 0, results })
}
