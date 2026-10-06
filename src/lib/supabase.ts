import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && publishableKey);

// Only the public/publishable key is read by browser code. Privileged keys are
// intentionally never exposed here; admin operations run in Supabase Edge Functions.
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, publishableKey!, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null;
