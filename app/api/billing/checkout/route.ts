import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStripe, findPlanById, getSiteUrl, getServiceRoleSupabase } from "@/lib/stripe";

// Auth-gated — never statically renderable.
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // Parse body
  let body: { planId?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const planId = body.planId;
  if (!planId) {
    return NextResponse.json({ error: "Missing planId" }, { status: 400 });
  }

  // Look up plan in DB
  const plan = await findPlanById(planId);
  if (!plan || !plan.is_active) {
    return NextResponse.json({ error: "Unknown plan" }, { status: 404 });
  }

  // If user already has an active subscription, send them to portal instead of
  // trying to subscribe again. This prevents double-charging accidents.
  const sRoleSupabase = getServiceRoleSupabase();
  const { data: existingSub } = await sRoleSupabase
    .from("subscriptions")
    .select("stripe_customer_id, status")
    .eq("user_id", user.id)
    .in("status", ["active", "trialing", "past_due"])
    .maybeSingle();

  if (existingSub?.stripe_customer_id) {
    return NextResponse.json({
      error: "You already have an active subscription. Use the customer portal to change plans.",
    }, { status: 409 });
  }

  // Load the user's profile so we can pass name to Stripe if available
  const { data: profile } = await sRoleSupabase
    .from("profiles")
    .select("email, full_name, company_name")
    .eq("id", user.id)
    .single();

  const stripe = getStripe();
  const site   = getSiteUrl();

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: plan.stripe_price_id, quantity: 1 }],

      // Pre-fill email — better UX
      customer_email: profile?.email || user.email || undefined,

      // Link back to our user so the webhook can tie the subscription to a profile
      client_reference_id: user.id,

      // Also store it as metadata on the subscription itself (safety net —
      // client_reference_id only appears on the checkout.session event, not
      // on downstream subscription events). Metadata is readable from every
      // subscription.retrieve() call.
      subscription_data: {
        metadata: {
          saasslicer_user_id: user.id,
          saasslicer_plan_id: plan.id,
        },
      },

      // Where Stripe sends the user after the payment flow
      success_url: `${site}/account?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${site}/pricing?checkout=cancelled`,

      // Allow promotion codes (Stripe defaults to false)
      allow_promotion_codes: true,

      // Ask Stripe to collect the billing address — useful for tax + invoicing
      billing_address_collection: "auto",
    });

    if (!session.url) {
      console.error("[checkout] Stripe returned a session without a URL", session.id);
      return NextResponse.json({ error: "Stripe did not return a checkout URL" }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("[checkout] Stripe error:", err?.message || err);
    return NextResponse.json({
      error: "Could not create checkout session. Please try again in a moment.",
    }, { status: 500 });
  }
}
