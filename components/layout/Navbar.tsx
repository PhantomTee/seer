'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { ArrowLeftRight, BrainCircuit, Compass, Landmark, Menu, Moon, PlusCircle, ShieldAlert, Sun, X } from 'lucide-react'
import { useAccount, useChainId } from 'wagmi'
import { ConnectButton } from '@/components/shared/ConnectButton'
import { FaucetButton } from '@/components/shared/FaucetButton'
import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'
import { ARC_TESTNET } from '@/constants/arc'

// Hardcoded — never expose via env var so it doesn't leak to clients
const ADMIN_ADDRESS = '0xf869c7b8a19146a4bbd5466e83c3b785ae7ee148'

const navItems = [
  { href: '/markets',   label: 'Markets',   icon: Compass },
  { href: '/create',    label: 'Create',    icon: PlusCircle },
  { href: '/bridge',    label: 'Bridge',    icon: ArrowLeftRight },
  { href: '/portfolio', label: 'Portfolio', icon: Landmark },
  { href: '/agent',     label: 'Agent',     icon: BrainCircuit },
] as const

/* ── Seer Eye SVG ─────────────────────────────────────────── */
function SeerEye({ size = 38 }: { size?: number }) {
  const h = Math.round(size * 0.6)
  return (
    <svg width={size} height={h} viewBox="0 0 38 24" fill="none" aria-hidden="true">
      {/* outer almond / eyelid shape */}
      <path
        d="M1.5 12 C6 3.5 32 3.5 36.5 12 C32 20.5 6 20.5 1.5 12Z"
        fill="#FFD600"
        stroke="#000"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {/* iris */}
      <circle cx="19" cy="12" r="5.8" fill="#000" />
      {/* inner gold iris ring */}
      <circle cx="19" cy="12" r="4.2" fill="#FFD600" />
      {/* vertical slit pupil */}
      <ellipse cx="19" cy="12" rx="1.5" ry="3.8" fill="#000" />
      {/* top catchlight */}
      <circle cx="21" cy="9.5" r="1" fill="#fff" opacity="0.55" />
    </svg>
  )
}

export function Navbar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { theme, toggle } = useTheme()
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const onArc = isConnected && chainId === ARC_TESTNET.chainId
  const isAdmin = isConnected && address?.toLowerCase() === ADMIN_ADDRESS

  function isActive(href: string) {
    return pathname === href || pathname?.startsWith(href + '/')
  }

  return (
    <header className="sticky top-0 z-40 border-b-2 border-white/15 bg-ink shadow-[0_4px_0_0_rgba(0,0,0,0.6)]">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">

        {/* ── Logo ──────────────────────────────────────── */}
        <Link href="/" className="focus-ring flex shrink-0 items-center gap-2.5">
          <SeerEye size={40} />
          <span className="font-display text-2xl tracking-wide text-mint">SEER</span>
        </Link>

        {/* ── Desktop nav ───────────────────────────────── */}
        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = isActive(href)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'focus-ring inline-flex items-center gap-1.5 border-2 px-4 py-1.5 text-sm font-semibold transition-all duration-100',
                  active
                    ? 'border-mint bg-mint text-black shadow-hard btn-press'
                    : 'border-white/15 bg-white/[0.04] text-white/55 hover:border-white/35 hover:bg-white/[0.08] hover:text-white'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* ── Right controls ────────────────────────────── */}
        <div className="flex items-center gap-2">
          {/* Admin link — only for the admin wallet */}
          {isAdmin && (
            <Link
              href="/admin"
              className={cn(
                'focus-ring inline-flex h-9 items-center gap-1.5 border-2 px-3 text-xs font-bold transition-all btn-press',
                pathname === '/admin'
                  ? 'border-mint bg-mint text-black shadow-hard'
                  : 'border-amber/40 bg-amber/10 text-amber hover:bg-amber/20'
              )}
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              Admin
            </Link>
          )}

          {/* Faucet — only when on Arc */}
          {onArc && address && (
            <FaucetButton
              address={address}
              variant="compact"
              label="Faucet"
            />
          )}

          {/* Theme toggle */}
          <button
            type="button"
            aria-label="Toggle theme"
            onClick={toggle}
            className="focus-ring flex h-9 w-9 items-center justify-center border-2 border-white/15 bg-white/[0.04] text-white/50 hover:border-mint/50 hover:text-mint btn-press"
          >
            {theme === 'dark'
              ? <Sun className="h-4 w-4" />
              : <Moon className="h-4 w-4" />
            }
          </button>

          <ConnectButton />

          {/* Mobile hamburger */}
          <button
            type="button"
            aria-label="Toggle navigation"
            onClick={() => setMobileOpen((v) => !v)}
            className="focus-ring flex h-9 w-9 items-center justify-center border-2 border-white/15 bg-white/[0.04] text-white/50 hover:border-white/35 hover:text-white md:hidden"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* ── Mobile nav ────────────────────────────────── */}
      {mobileOpen && (
        <div className="animate-fade-slide-in border-t-2 border-white/10 bg-ink px-4 pb-4 pt-2 md:hidden">
          <nav className="space-y-1">
            {navItems.map(({ href, label, icon: Icon }) => {
              const active = isActive(href)
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'flex items-center gap-3 border-2 px-3 py-2.5 text-sm font-semibold transition-colors',
                    active
                      ? 'border-mint bg-mint text-black shadow-hard'
                      : 'border-white/10 bg-white/[0.03] text-white/50 hover:border-white/25 hover:text-white'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              )
            })}
          </nav>
        </div>
      )}
    </header>
  )
}
