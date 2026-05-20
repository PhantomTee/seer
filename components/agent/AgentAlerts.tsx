'use client'

import { BellRing } from 'lucide-react'
import type { AgentLog } from '@/types/agent'

export function AgentAlerts({ logs }: { logs: AgentLog[] }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.035] p-4 shadow-hard">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
        <BellRing className="h-4 w-4 text-mint" />
        Activity Log
      </h2>
      <div className="space-y-3">
        {logs.map((log) => (
          <div key={log.id} className="rounded-md border border-white/10 bg-ink/70 p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-white">{log.action}</span>
              <span className="text-xs text-white/40">{new Date(log.created_at).toLocaleTimeString()}</span>
            </div>
            <p className="mt-1 text-xs text-white/50">{JSON.stringify(log.details ?? {})}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
