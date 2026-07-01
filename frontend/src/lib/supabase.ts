import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseConfigured = !!(supabaseUrl && supabaseAnonKey)

if (!supabaseConfigured && import.meta.env.DEV) {
  console.warn('[Bukra] Supabase env vars missing — create frontend/.env with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. Auth will not work.')
}

export const supabase = supabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null
