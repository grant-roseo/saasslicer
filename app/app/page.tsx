import { redirect } from "next/navigation";
import SlicerApp from "@/components/SlicerApp";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import WelcomeBanner from "./WelcomeBanner";

export const metadata = {
  title: "SaaS Slicer — Competitive Content Analysis",
  description: "AI-powered competitive content strategy for SaaS.",
};

// Auth-gated route — inherently dynamic (depends on user session cookies).
// Explicit dynamic flag prevents Next from attempting prerender at build time.
export const dynamic = "force-dynamic";

// ─── Auth gate ──────────────────────────────────────────────────────────────
// This Server Component checks the user's Supabase session before rendering
// the SlicerApp. Signed-out users get bounced to /signin?next=/app.
//
// This is the ONLY blocking change Phase 2A introduces to existing v3
// functionality. Everything else is additive (new pages, new routes).
// To roll back Phase 2A: revert this file to its v3 state and the app
// becomes public again.
//
// Note: SlicerApp itself still calls Anthropic directly from the browser in
// Phase 2A. The server-side AI proxy arrives in Phase 2C.
//
// ─── Welcome flag ───────────────────────────────────────────────────────────
// Phase 2B auth polish: the signup flow appends `welcome=1` to the email
// confirmation redirect. We detect it here and render a one-time banner above
// the SlicerApp. The WelcomeBanner client component is responsible for
// stripping the param from the URL after first paint so refreshes don't
// re-show. We don't render <WelcomeBanner /> at all when the flag is absent —
// no flicker risk on normal repeat visits.
export default async function AppPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/signin?next=/app");
  }

  const params = await searchParams;
  const welcome = params.welcome === "1";

  return (
    <>
      {welcome && <WelcomeBanner show />}
      <SlicerApp />
    </>
  );
}
