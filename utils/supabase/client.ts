import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "https://pkcjqqcmpryvrpglgdsu.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_wMyBaheThOIqw4-9UzM_PA_ZoanIQyt";

export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
