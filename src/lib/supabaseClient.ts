import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const rawUrl = String(import.meta.env.VITE_SUPABASE_URL ?? '')
const rawKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? '')

const fallbackUrl = 'https://abcdefghijklmnopqrst.supabase.co'
const fallbackKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24ifQ.dummy'

export const isSupabaseConfigured = rawUrl.startsWith('http') && rawKey.length > 20

if (!isSupabaseConfigured) {
  console.warn(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in your project values.',
  )
}

export const supabase = createClient<Database>(isSupabaseConfigured ? rawUrl : fallbackUrl, isSupabaseConfigured ? rawKey : fallbackKey, {
  auth: {
    persistSession: isSupabaseConfigured,
    autoRefreshToken: isSupabaseConfigured,
    detectSessionInUrl: isSupabaseConfigured,
  },
})
