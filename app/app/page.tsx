import { redirect } from "next/navigation";
import SlicerApp from "@/components/SlicerApp";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = {
  title: "SaaS Slicer — Competitive Content Analysis",
  description: "AI-powered competitive content strategy for SaaS.",
};

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
export default async function AppPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/signin?next=/app");
  }

  return <SlicerApp />;
}
