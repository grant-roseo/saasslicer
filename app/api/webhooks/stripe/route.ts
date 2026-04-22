import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripe, getServiceRoleSupabase, findPlanByPriceId } from "@/lib/stripe";

// Webhook must always run server-side, never prerendered, never cached.
export const dynamic = "force-dynamic";

// ─── Raw body requirement ──────────────────────────────────────────────────
// Stripe signature verification requires the EXACT raw request body bytes.
// In Next 15 App Router, calling request.text() returns the raw body string
// without any Next middleware parsing. Do NOT call request.json() here — it
// mutates the payload enough that signature verification fails.

export async function POST(request: NextRequest) {
  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    console.warn("[stripe-webhook] Missing stripe-signature header");
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET not set — webhook processing disabled");
    // Return 200 so Stripe doesn't retry until we fix the env var. A 5xx
    // would queue retries that will keep failing until the secret is set.
    return NextResponse.json({ received: false, reason: "webhook secret not configured" }, { status: 200 });
  }

  const stripe = getStripe();

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch (err: any) {
    console.error("[stripe-webhook] Failed to read raw body:", err?.message);
    return NextResponse.json({ error: "Could not read body" }, { status: 400 });
  }

  // Verify signature — rejects forged events from non-Stripe sources
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err: any) {
    console.warn("[stripe-webhook] Signature verification failed:", err?.message);
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }

  const supabase = getServiceRoleSupabase();

  // ─── Idempotency: short-circuit replays ─────────────────────────────────
  // Stripe retries webhooks with exponential backoff if we don't return 2xx.
  // We record every event ID in stripe_webhook_events and refuse to re-process.
  // This lets us safely return 5xx on transient errors — Stripe will retry
  // until we succeed, but we'll only process it once.
  const { data: existing } = await supabase
    .from("stripe_webhook_events")
    .select("id, processed_at")
    .eq("id", event.id)
    .maybeSingle();

  if (existing?.processed_at) {
    return NextResponse.json({ received: true, idempotent: true });
  }

  // Record that we received it (payload column for debugging)
  if (!existing) {
    await supabase.from("stripe_webhook_events").insert({
      id:         event.id,
      event_type: event.type,
      payload:    event as unknown as Record<string, unknown>,
    });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case "invoice.payment_succeeded":
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case "customer.subscription.updated":
      case "customer.subscription.created":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      default:
        // Unhandled event type — still record it as processed so Stripe stops retrying
        break;
    }

    // Mark processed
    await supabase
      .from("stripe_webhook_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("id", event.id);

    return NextResponse.json({ received: true });
  } catch (err: any) {
    const msg = err?.message || String(err);
    console.error(`[stripe-webhook] Failed to process ${event.type} (${event.id}):`, msg);

    // Record the error on the event row
    await supabase
      .from("stripe_webhook_events")
      .update({ processing_error: msg })
      .eq("id", event.id);

    // Return 500 so Stripe retries. Our idempotency check at the top prevents
    // duplicate work on eventual success.
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}

// ─── Event handlers ─────────────────────────────────────────────────────────

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  // The subscription created by Checkout is on session.subscription
  const subscriptionId = typeof session.subscription === "string"
    ? session.subscription
    : session.subscription?.id;

  if (!subscriptionId) {
    console.warn("[stripe-webhook] checkout.session.completed had no subscription ID — ignoring");
    return;
  }

  // Fetch the full subscription so we have period bounds, price ID, etc.
  const stripe = getStripe();
  const sub = await stripe.subscriptions.retrieve(subscriptionId);

  // Pull the user ID either from client_reference_id (always set on checkout)
  // or as a fallback from subscription metadata (we set this too for safety)
  const userId = session.client_reference_id
    || (sub.metadata?.saasslicer_user_id as string | undefined)
    || null;

  if (!userId) {
    console.error("[stripe-webhook] checkout.session.completed: missing user ID linkage", {
      sessionId: session.id, subscriptionId,
    });
    throw new Error("Cannot link checkout to user — no client_reference_id or metadata");
  }

  // Use the generic subscription-updated handler since it does the right thing
  // for both initial creation and renewal updates. Credits are granted by the
  // shared helper called from there.
  await upsertSubscriptionAndGrantCredits(sub, userId);
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  // This event fires on initial payment AND every renewal. We only want to
  // grant additional credits on renewal — the initial grant is already handled
  // by checkout.session.completed. We distinguish using billing_reason.
  //
  // billing_reason values:
  //   - 'subscription_create'  → first invoice of a new sub (skip, already granted)
  //   - 'subscription_cycle'   → renewal (GRANT credits for new period)
  //   - 'subscription_update'  → plan change mid-cycle (no new period, proration handled elsewhere)
  //   - 'manual', 'upcoming'   → other cases we don't act on here
  if (invoice.billing_reason !== "subscription_cycle") {
    return;
  }

  // invoice.subscription is the sub ID
  const subscriptionId = typeof invoice.subscription === "string"
    ? invoice.subscription
    : invoice.subscription?.id;
  if (!subscriptionId) return;

  const stripe = getStripe();
  const sub = await stripe.subscriptions.retrieve(subscriptionId);

  const userId = (sub.metadata?.saasslicer_user_id as string | undefined) || null;
  if (!userId) {
    console.error("[stripe-webhook] invoice.payment_succeeded: subscription has no user metadata", {
      subscriptionId,
    });
    throw new Error("Cannot link renewal to user — missing subscription metadata");
  }

  await upsertSubscriptionAndGrantCredits(sub, userId);
}

async function handleSubscriptionUpdated(sub: Stripe.Subscription) {
  const userId = (sub.metadata?.saasslicer_user_id as string | undefined) || null;
  if (!userId) {
    console.warn("[stripe-webhook] subscription.updated: no user metadata; skipping");
    return;
  }
  // Upsert the subscription row — plan changes, cancel flags, status transitions
  // all flow through here. We only grant NEW credits if this update crossed
  // into a new billing period (the UNIQUE constraint on report_credits prevents
  // double-granting).
  await upsertSubscriptionAndGrantCredits(sub, userId);
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  const supabase = getServiceRoleSupabase();
  await supabase
    .from("subscriptions")
    .update({
      status:      "canceled",
      canceled_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", sub.id);
  // Credits are NOT revoked — user keeps access until period_end as designed.
  // The credit_row's period_end handles natural expiry.
}

// ─── Shared helper ──────────────────────────────────────────────────────────
// Upserts the subscription row based on the Stripe subscription object, then
// grants credits for the current period if none exist yet.
async function upsertSubscriptionAndGrantCredits(
  sub: Stripe.Subscription,
  userId: string,
) {
  const supabase = getServiceRoleSupabase();

  // Price ID lives on the first item of the subscription
  const priceId = sub.items.data[0]?.price.id;
  if (!priceId) throw new Error("Subscription has no price_id");

  const plan = await findPlanByPriceId(priceId);
  if (!plan) throw new Error(`No plan found for price_id ${priceId}`);

  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  // Map Stripe status to our enum. Stripe has more statuses than we do, but
  // the ones we care about (active/trialing/past_due/canceled/incomplete/unpaid)
  // match 1:1.
  const statusMap: Record<string, string> = {
    trialing:           "trialing",
    active:             "active",
    past_due:           "past_due",
    canceled:           "canceled",
    incomplete:         "incomplete",
    incomplete_expired: "incomplete_expired",
    unpaid:             "unpaid",
  };
  const status = statusMap[sub.status] || "incomplete";

  const periodStart = new Date(sub.current_period_start * 1000).toISOString();
  const periodEnd   = new Date(sub.current_period_end   * 1000).toISOString();

  // Upsert the subscription row — keyed by stripe_subscription_id
  const { data: subRow, error: subErr } = await supabase
    .from("subscriptions")
    .upsert({
      user_id:                userId,
      plan_id:                plan.id,
      stripe_subscription_id: sub.id,
      stripe_customer_id:     customerId,
      status,
      current_period_start:   periodStart,
      current_period_end:     periodEnd,
      cancel_at_period_end:   sub.cancel_at_period_end,
      canceled_at:            sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
    }, { onConflict: "stripe_subscription_id" })
    .select("id")
    .single();

  if (subErr || !subRow) {
    throw new Error(`Failed to upsert subscription: ${subErr?.message || "no row returned"}`);
  }

  // Grant credits for this period — unique constraint (subscription_id, period_start)
  // prevents double-granting on replays. Only grant if status is active or
  // trialing (don't front credits to past_due / incomplete subs).
  if (status !== "active" && status !== "trialing") {
    return;
  }

  const { data: existingCredit } = await supabase
    .from("report_credits")
    .select("id")
    .eq("subscription_id", subRow.id)
    .eq("period_start", periodStart)
    .maybeSingle();

  if (existingCredit) {
    // Already granted for this period — nothing to do
    return;
  }

  const { data: creditRow, error: creditErr } = await supabase
    .from("report_credits")
    .insert({
      user_id:         userId,
      subscription_id: subRow.id,
      plan_id:         plan.id,
      period_start:    periodStart,
      period_end:      periodEnd,
      granted:         plan.reports_per_period,
      adjustments:     0,
      consumed:        0,
    })
    .select("id")
    .single();

  if (creditErr || !creditRow) {
    throw new Error(`Failed to grant credits: ${creditErr?.message || "no row returned"}`);
  }

  // Log the grant event for the audit ledger
  const { error: evtErr } = await supabase
    .from("credit_events")
    .insert({
      user_id:         userId,
      credit_row_id:   creditRow.id,
      event_type:      "grant",
      amount:          plan.reports_per_period,
      stripe_event_id: sub.latest_invoice ? String(sub.latest_invoice) : null,
    });

  if (evtErr) {
    // Non-fatal — credits already granted, just log the audit failure
    console.warn("[stripe-webhook] Could not write credit_events row:", evtErr.message);
  }
}
