import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase auth session on every request if needed. Without this,
// JWT access tokens (1-hour lifetime) expire and users get silently signed out
// even when they have valid refresh tokens in their cookies.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: request.headers } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: this call refreshes the session if the JWT is expired.
  // Do not remove — it's the entire reason this middleware exists.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    // Match everything EXCEPT static files, image optimisation, and API routes.
    // API routes do their own auth via createSupabaseServerClient.
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2|ttf)$).*)",
  ],
};
