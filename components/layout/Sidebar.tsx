import Link from 'next/link'
import type { Route } from 'next'
import { Bot, CircleDollarSign, Compass, PlusCircle, ShieldCheck, WalletCards } from 'lucide-react'

const items: Array<{ href: Route; label: string; icon: typeof Compass }> = [
  { href: '/markets', label: 'Markets', icon: Compass },
  { href: '/create', label: 'Create', icon: PlusCircle },
  { href: '/portfolio', label: 'Portfolio', icon: WalletCards },
  { href: '/bridge', label: 'Bridge USDC', icon: CircleDollarSign },
  { href: '/agent', label: 'Agent', icon: Bot },
]

export function Sidebar() {
  return (
    <aside className="hidden w-52 shrink-0 lg:block">
      <div className="sticky top-24 space-y-3">

        {/* Confidential flow badge */}
        <div className="rounded-xl border border-mint/12 bg-mint/[0.05] p-3.5">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-mint/70">
            <ShieldCheck className="h-3.5 w-3.5" />
            Confidential flow
          </div>
          <p className="text-xs leading-5 text-white/50">
            USDC collateral. Fairblock encrypts position amounts. Wallet addresses stay public.
          </p>
        </div>

        {/* Nav links */}
        <nav className="space-y-0.5">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/50 transition-colors hover:bg-white/6 hover:text-white"
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </aside>
  )
}
