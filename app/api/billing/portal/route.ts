import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStripe, getSiteUrl, getServiceRoleSupabase } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST(_request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // Find the user's stripe_customer_id from their active subscription row.
  // We use service role because subscriptions are RLS-readable by the user
  // already, but using service role here is consistent with the pattern.
  const sRoleSupabase = getServiceRoleSupabase();
  const { data: sub } = await sRoleSupabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sub?.stripe_customer_id) {
    return NextResponse.json({
      error: "No subscription found. Subscribe first via the pricing page.",
    }, { status: 404 });
  }

  const stripe = getStripe();
  const site   = getSiteUrl();

  try {
    const portal = await stripe.billingPortal.sessions.create({
      customer:    sub.stripe_customer_id,
      return_url:  `${site}/account`,
    });
    return NextResponse.json({ url: portal.url });
  } catch (err: any) {
    console.error("[portal] Stripe error:", err?.message || err);
    return NextResponse.json({
      error: "Could not open billing portal. Please try again in a moment.",
    }, { status: 500 });
  }
}
