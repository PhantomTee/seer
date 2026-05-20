import { createBrowserClient } from '@supabase/ssr'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Never cache null — re-attempt on every call until env vars are present
let browserClient: SupabaseClient | null = null
let serviceClient: SupabaseClient | null = null

export function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export function getBrowserSupabase(): SupabaseClient | null {
  if (!hasSupabaseEnv()) return null
  if (!browserClient) {
    try {
      browserClient = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ) as unknown as SupabaseClient
    } catch {
      return null
    }
  }
  return browserClient
}

export function createServiceSupabase(): SupabaseClient | null {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  if (!serviceClient) {
    try {
      serviceClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false, autoRefreshToken: false } }
      )
    } catch {
      return null
    }
  }
  return serviceClient
}
