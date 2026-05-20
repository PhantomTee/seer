import { Activity, Bot, Clock3, Wallet } from 'lucide-react'
import { AgentAlerts } from '@/components/agent/AgentAlerts'
import { AgentChat } from '@/components/agent/AgentChat'
import { AgentSuggestions } from '@/components/agent/AgentSuggestions'
import { createServiceSupabase } from '@/lib/supabase'
import type { AgentLog } from '@/types/agent'

async function getAgentLogs(): Promise<AgentLog[]> {
  try {
    const supabase = createServiceSupabase()
    if (!supabase) return []
    const { data } = await supabase
      .from('agent_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)
    return data ?? []
  } catch {
    return []
  }
}

export default async function AgentPage() {
  const logs = await getAgentLogs()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-white">Agent Dashboard</h1>
        <p className="mt-2 text-sm text-white/58">Monitors resolvable markets, dispute windows, suggestions, and context.</p>
      </div>
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Bot className="h-5 w-5 text-mint" />
          <h2 className="text-xl font-semibold text-white">Market Suggestions</h2>
        </div>
        <AgentSuggestions />
      </section>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <AgentChat />
        <div className="space-y-5">
          <AgentAlerts logs={logs} />
          <section className="border-2 border-white/10 bg-white/[0.035] p-4 shadow-hard">
            <h2 className="mb-4 text-sm font-semibold text-white">Status</h2>
            <StatusRow icon={Activity} label="Auto-resolution" value="Every 5 min" />
            <StatusRow icon={Clock3} label="Dispute monitor" value="Every 15 min" />
            <StatusRow icon={Clock3} label="Suggestions" value="08:00 UTC" />
            <StatusRow icon={Wallet} label="Agent wallet" value="Fund via faucet" />
          </section>
        </div>
      </div>
    </div>
  )
}

function StatusRow({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: string }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3 border border-white/10 bg-ink/70 px-3 py-2 text-sm">
      <span className="inline-flex items-center gap-2 text-white/65">
        <Icon className="h-4 w-4 text-mint" />
        {label}
      </span>
      <span className="text-white">{value}</span>
    </div>
  )
}
