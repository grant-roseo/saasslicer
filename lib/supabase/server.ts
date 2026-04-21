import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server-side Supabase client for Server Components, Route Handlers, Server Actions.
// Uses the anon key — all queries subject to RLS, scoped via auth.uid().
// Service-role usage (webhook handler, admin RPCs) will be added in Phase 2B.
//
// Next 15: cookies() is async — must be awaited.
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          // setAll() throws if called from a Server Component (cookies are
          // read-only there). Middleware refreshes the session, so this is
          // fine — cookies will be set on the next request through middleware
          // or a Route Handler.
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // no-op for Server Component reads
          }
        },
      },
    }
  );
}
