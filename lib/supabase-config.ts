// The one place that decides which Supabase project the app talks to.
// Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY per environment
// (.env.local on a laptop, Vercel environment variables for deployments).
// Next.js only inlines these values when they are written out in full, so do not
// read them through a variable name.
// Only the public anon key belongs here. Never put a service_role key in a NEXT_PUBLIC_ variable.

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, "");
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}
