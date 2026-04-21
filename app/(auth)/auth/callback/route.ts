import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Handles the ?code= exchange from:
//   - email confirmation links (signup)
//   - password reset links
//   - (future) OAuth redirects
//
// Supabase's hosted auth redirects to this URL with a short-lived code
// that we exchange for a session cookie.

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") || "/app";

  // Open-redirect protection — only allow same-origin paths
  const safeNext = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/app";

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
    // If exchange failed, send them to signin with a generic error
    return NextResponse.redirect(`${origin}/signin?error=callback_failed`);
  }

  return NextResponse.redirect(`${origin}/signin`);
}
