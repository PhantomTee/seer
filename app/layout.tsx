import type { Metadata } from 'next'
import { Bangers, Space_Grotesk, Geist_Mono } from 'next/font/google'
import './globals.css'
import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'
import { SuppressThirdPartyErrors } from '@/components/shared/SuppressThirdPartyErrors'
import { Providers } from './providers'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  weight: ['300', '400', '500', '600', '700'],
})

const bangers = Bangers({
  subsets: ['latin'],
  variable: '--font-bangers',
  weight: '400',
})

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
})

export const metadata: Metadata = {
  title: 'Seer',
  description: 'Confidential USDC-native prediction markets on Arc Testnet.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="dark" className={`${spaceGrotesk.variable} ${bangers.variable} ${geistMono.variable}`}>
      <body className="font-sans antialiased">
        <Providers>
          <SuppressThirdPartyErrors />
          <div className="flex min-h-screen flex-col">
            <Navbar />
            <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
              {children}
            </main>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  )
}
