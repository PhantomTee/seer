import Link from 'next/link'
import { Compass, Home } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      {/* Big 404 */}
      <div className="relative mb-6 select-none">
        <span className="font-display text-[120px] leading-none tracking-widest text-white/[0.05] md:text-[180px]">
          404
        </span>
        <span className="absolute inset-0 flex items-center justify-center font-display text-[48px] leading-none tracking-wider text-mint md:text-[72px]">
          404
        </span>
      </div>

      <h1 className="font-display text-4xl tracking-wider text-white md:text-5xl">PAGE NOT FOUND</h1>
      <p className="mt-4 max-w-sm text-base text-white/45">
        This market doesn&apos;t exist — yet. Maybe you can create it.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/markets"
          className="focus-ring inline-flex h-11 items-center gap-2 border-2 border-black bg-mint px-5 font-bold text-black shadow-hard btn-press"
        >
          <Compass className="h-4 w-4" />
          Browse Markets
        </Link>
        <Link
          href="/"
          className="focus-ring inline-flex h-11 items-center gap-2 border-2 border-white/20 bg-white/[0.06] px-5 font-bold text-white/70 shadow-hard btn-press hover:border-white/35 hover:text-white"
        >
          <Home className="h-4 w-4" />
          Home
        </Link>
      </div>
    </div>
  )
}
