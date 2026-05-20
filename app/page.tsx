import Link from 'next/link'
import { ArrowRight, BarChart3, LockKeyhole, Scale, TrendingUp } from 'lucide-react'
import { createServiceSupabase } from '@/lib/supabase'
import { formatUsdc } from '@/lib/utils'
import { MarketCard } from '@/components/markets/MarketCard'
import { AnimatedDice } from '@/components/shared/AnimatedDice'
import type { Market } from '@/types/market'

const howItWorks = [
  {
    icon: ArrowRight,
    title: 'Bridge',
    desc: 'Bring USDC from any chain to Arc Testnet via LiFi or CCTP.',
    num: '01',
  },
  {
    icon: TrendingUp,
    title: 'Predict',
    desc: 'Buy YES or NO at the live probability price.',
    num: '02',
  },
  {
    icon: LockKeyhole,
    title: 'Protect',
    desc: 'Fairblock encrypts your position amount on-chain.',
    num: '03',
  },
  {
    icon: Scale,
    title: 'Redeem',
    desc: 'Collect your USDC payout once the market resolves.',
    num: '04',
  },
]

async function getFeaturedMarkets(): Promise<{ markets: Market[]; totalVolume: number }> {
  try {
    const supabase = createServiceSupabase()
    if (!supabase) return { markets: [], totalVolume: 0 }
    const { data } = await supabase
      .from('markets')
      .select('*')
      .eq('state', 'OPEN')
      .order('total_volume_usdc', { ascending: false })
      .limit(3)
    const all = data ?? []
    const totalVolume = all.reduce((s, m) => s + Number(m.total_volume_usdc ?? 0), 0)
    return { markets: all, totalVolume }
  } catch {
    return { markets: [], totalVolume: 0 }
  }
}

export default async function HomePage() {
  const { markets, totalVolume } = await getFeaturedMarkets()

  return (
    <div>

      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="relative flex flex-col items-center overflow-hidden pb-20 pt-12 text-center">

        {/* Decorative — animated 3D dice, left */}
        <div className="pointer-events-none absolute left-12 top-44 hidden lg:block opacity-90">
          <AnimatedDice />
        </div>

        {/* Decorative — second dice, smaller, offset timing */}
        <div className="pointer-events-none absolute right-10 top-32 hidden lg:block opacity-70 scale-75">
          <AnimatedDice style={{ animationDelay: '2.1s' }} />
        </div>

        {/* Chart SVG stays — it's just decorative geometry, not lightning/star */}
        <div className="pointer-events-none absolute right-2 bottom-12 hidden xl:block">
          <ChartSVG className="animate-float" style={{ '--rot': '10deg', animationDelay: '0.5s' } as React.CSSProperties} />
        </div>

        {/* Badge */}
        <div className="mb-6 inline-flex items-center gap-2 border-2 border-mint bg-mint/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-mint shadow-hard-gold">
          ⚡ See the Future. Trade With Certainty.
        </div>

        {/* Headline */}
        <h1 className="font-display max-w-3xl text-6xl leading-none tracking-wider text-white sm:text-7xl lg:text-8xl">
          <span className="text-mint">PREDICT</span>{' '}
          <span className="relative inline-block">
            MARKET
            <span className="absolute -bottom-2 left-0 right-0 h-2 bg-mint" />
          </span>
          <br />
          OUTCOMES
        </h1>

        {/* Subtitle */}
        <p className="mt-8 max-w-lg text-lg leading-7 text-white/60">
          High-stakes prediction markets on Arc Testnet.
          <br />
          <span className="font-semibold text-white/80">USDC-native · Chainlink-resolved · Fairblock-private.</span>
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link
            href="/markets"
            className="focus-ring inline-flex h-12 items-center gap-2 border-2 border-black bg-mint px-7 text-base font-bold text-black shadow-hard-lg btn-press transition-all"
          >
            Explore Markets
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/create"
            className="focus-ring inline-flex h-12 items-center border-2 border-white/25 bg-white/[0.05] px-7 text-base font-semibold text-white/70 shadow-hard transition-all hover:border-white/40 hover:text-white btn-press"
          >
            Create Market
          </Link>
        </div>

        {/* Stats — only shown when real data exists */}
        {totalVolume > 0 && (
          <div className="mt-16 grid w-full max-w-2xl gap-4 sm:grid-cols-2">
            <StatCard
              icon={<BarChart3 className="h-5 w-5 text-black" />}
              label="Total Volume"
              value={formatUsdc(totalVolume, 0)}
            />
            <StatCard
              icon={<TrendingUp className="h-5 w-5 text-black" />}
              label="Open Markets"
              value={String(markets.length)}
            />
          </div>
        )}
      </section>

      {/* ── Featured Markets ─────────────────────────────── */}
      <section className="mb-16">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h2 className="font-display text-4xl tracking-wider text-white">
              OPEN MARKETS
            </h2>
            <p className="mt-1 text-sm text-white/45">
              {markets.length > 0 ? 'Highest volume markets right now' : 'No markets yet — be the first to create one'}
            </p>
          </div>
          <Link
            href="/markets"
            className="inline-flex items-center gap-1.5 border-2 border-mint/40 bg-mint/10 px-3 py-1.5 text-sm font-bold text-mint shadow-hard-gold transition-colors hover:bg-mint hover:text-black btn-press"
          >
            View all
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {markets.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-3">
            {markets.map((market) => (
              <MarketCard key={market.id} market={market} />
            ))}
          </div>
        ) : (
          <div className="border-2 border-white/10 bg-white/[0.025] p-12 text-center shadow-hard">
            <p className="text-base font-medium text-white/40">No open markets yet.</p>
            <Link
              href="/create"
              className="mt-5 inline-flex items-center gap-2 border-2 border-mint/40 bg-mint/10 px-5 py-2.5 text-sm font-bold text-mint shadow-hard-gold transition-colors hover:bg-mint hover:text-black btn-press"
            >
              Create the first market
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </section>

      {/* ── How it works ─────────────────────────────────── */}
      <section className="mb-8 border-2 border-white/15 bg-white/[0.025] p-8 shadow-hard-lg">
        <div className="mb-10 text-center">
          <h2 className="font-display text-4xl tracking-wider text-white">HOW IT WORKS</h2>
          <p className="mt-2 text-sm text-white/40">Four steps from zero to your first prediction</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {howItWorks.map((step) => (
            <div
              key={step.title}
              className="group border-2 border-white/15 bg-white/[0.03] p-5 shadow-hard transition-all hover:border-mint/40 hover:bg-white/[0.06]"
            >
              <div className="font-display mb-3 text-5xl leading-none text-mint/20 transition-colors group-hover:text-mint/35">
                {step.num}
              </div>
              <div className="mb-3 flex h-10 w-10 items-center justify-center border-2 border-mint/30 bg-mint/10">
                <step.icon className="h-5 w-5 text-mint" />
              </div>
              <div className="mb-1 text-base font-bold text-white">{step.title}</div>
              <p className="text-sm leading-5 text-white/45">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

    </div>
  )
}

/* ── Stat Card ──────────────────────────────────────────── */
function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="border-2 border-black bg-mint p-5 text-left shadow-hard-lg">
      <div className="mb-3 flex h-9 w-9 items-center justify-center border-2 border-black bg-black/10">
        {icon}
      </div>
      <p className="text-xs font-semibold text-black/60">{label}</p>
      <p className="mt-1 font-display text-3xl tracking-wider text-black">{value}</p>
    </div>
  )
}

/* ── Decorative SVG illustrations ───────────────────────── */
function ChartSVG({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg width="72" height="56" viewBox="0 0 72 56" fill="none" className={className} style={style}>
      <rect x="1" y="1" width="70" height="54" fill="#161618" stroke="#FFD600" strokeWidth="2" />
      <rect x="8" y="36" width="10" height="14" fill="#4A9EFF" stroke="#000" strokeWidth="1.5" />
      <rect x="22" y="26" width="10" height="24" fill="#4A9EFF" stroke="#000" strokeWidth="1.5" />
      <rect x="36" y="18" width="10" height="32" fill="#FFD600" stroke="#000" strokeWidth="1.5" />
      <rect x="50" y="10" width="10" height="40" fill="#FFD600" stroke="#000" strokeWidth="1.5" />
      <polyline points="13,36 27,26 41,18 55,10" stroke="#FF2D6B" strokeWidth="2.5" strokeLinejoin="round" fill="none" />
      <circle cx="55" cy="10" r="3.5" fill="#FF2D6B" stroke="#000" strokeWidth="1.5" />
    </svg>
  )
}

