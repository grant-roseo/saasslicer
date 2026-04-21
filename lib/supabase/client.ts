import { createBrowserClient } from "@supabase/ssr";

// Singleton browser client. Reads cookies via the @supabase/ssr browser adapter
// so auth state stays in sync with the server.
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
