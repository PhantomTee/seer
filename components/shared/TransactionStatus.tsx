import { CheckCircle2, Loader2, XCircle } from 'lucide-react'

export function TransactionStatus({ status, message }: { status: 'idle' | 'pending' | 'success' | 'error'; message?: string }) {
  if (status === 'idle') return null
  const icon =
    status === 'pending' ? (
      <Loader2 className="h-4 w-4 animate-spin text-blue" />
    ) : status === 'success' ? (
      <CheckCircle2 className="h-4 w-4 text-mint" />
    ) : (
      <XCircle className="h-4 w-4 text-danger" />
    )

  return (
    <div className="mt-3 flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/70">
      {icon}
      <span>{message ?? status}</span>
    </div>
  )
}
