import Link from 'next/link'
import { ARC_TESTNET } from '@/constants/arc'

export function Footer() {
  return (
    <footer className="border-t-2 border-white/10 bg-ink py-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 sm:px-6 md:flex-row md:items-start md:justify-between lg:px-8">

        {/* Brand */}
        <div>
          <p className="font-display text-2xl tracking-wider text-mint">SEER</p>
          <p className="mt-1.5 text-sm text-white/30">
            Confidential prediction markets on Arc Testnet
          </p>
          <p className="mt-1 text-xs text-white/18">
            USDC-native collateral · For testing purposes only
          </p>
        </div>

        {/* Links */}
        <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
          <a
            href="https://docs.arc.io/arc/references/rpc-endpoints"
            target="_blank"
            rel="noreferrer"
            className="border-b-2 border-transparent font-semibold text-white/40 transition-colors hover:border-mint hover:text-mint"
          >
            Arc docs
          </a>
          <a
            href={ARC_TESTNET.faucetUrl}
            target="_blank"
            rel="noreferrer"
            className="border-b-2 border-transparent font-semibold text-white/40 transition-colors hover:border-mint hover:text-mint"
          >
            Faucet
          </a>
          <a
            href={ARC_TESTNET.explorerUrl}
            target="_blank"
            rel="noreferrer"
            className="border-b-2 border-transparent font-semibold text-white/40 transition-colors hover:border-mint hover:text-mint"
          >
            Explorer
          </a>
          <Link
            href="/agent"
            className="border-b-2 border-transparent font-semibold text-white/40 transition-colors hover:border-mint hover:text-mint"
          >
            Agent
          </Link>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="mx-auto mt-8 max-w-7xl border-t border-white/8 px-4 pt-4 sm:px-6 lg:px-8">
        <p className="text-xs text-white/18">
          © 2026 Seer · Built on{' '}
          <span className="font-semibold text-white/30">Arc Testnet</span>
        </p>
      </div>
    </footer>
  )
}
