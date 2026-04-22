import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

// ─── Stripe singleton ───────────────────────────────────────────────────────
// Build-time safety: Vercel bundles env vars at build time. If the secret isn't
// present (e.g. first deploy before env vars are set), return a Proxy stub that
// throws clearly if anyone tries to use it, letting the build complete instead
// of dying at prerender. Same pattern as lib/supabase/client.ts.
//
// This module is SERVER-ONLY. Never import it from a "use client" component.
// The lack of NEXT_PUBLIC_ prefix on STRIPE_SECRET_KEY is what enforces this —
// Next.js will refuse to expose the key to client bundles.

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return new Proxy({}, {
      get() {
        throw new Error(
          "Stripe called without STRIPE_SECRET_KEY set. Add it in your Vercel " +
          "project environment variables (server-only, no NEXT_PUBLIC_ prefix)."
        );
      },
    }) as unknown as Stripe;
  }

  _stripe = new Stripe(secret, {
    // Pin to the SDK's latest supported API version. Upgrading Stripe SDK
    // will bump this automatically as part of the package upgrade.
    apiVersion: "2025-02-24.acacia",
    appInfo: { name: "SaaS Slicer", version: "3.2.0" },
  });
  return _stripe;
}

// ─── Service-role Supabase for webhook ──────────────────────────────────────
// Webhooks come from Stripe with no user session. We need RLS-bypassing writes
// to insert subscriptions, grant credits, etc. Using the service role for this
// path is correct; it should NEVER be used from user-facing code paths.
export function getServiceRoleSupabase() {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !sRole) {
    return new Proxy({}, {
      get() {
        throw new Error(
          "Service-role Supabase client called without NEXT_PUBLIC_SUPABASE_URL " +
          "or SUPABASE_SERVICE_ROLE_KEY. Both are required for webhook processing."
        );
      },
    }) as ReturnType<typeof createClient>;
  }

  return createClient(url, sRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// ─── Plan helpers ───────────────────────────────────────────────────────────
// Looks up a plan row by its Stripe price ID. Used by the webhook to figure
// out which plan a subscription event is for.
export type PlanRow = {
  id: string;
  name: string;
  description: string | null;
  reports_per_period: number;
  price_cents: number;
  currency: string;
  stripe_product_id: string;
  stripe_price_id: string;
  is_active: boolean;
  sort_order: number;
};

export async function findPlanByPriceId(priceId: string): Promise<PlanRow | null> {
  const supabase = getServiceRoleSupabase();
  const { data, error } = await supabase
    .from("plans")
    .select("id, name, description, reports_per_period, price_cents, currency, stripe_product_id, stripe_price_id, is_active, sort_order")
    .eq("stripe_price_id", priceId)
    .maybeSingle();
  if (error) {
    console.error("[stripe] findPlanByPriceId failed:", error.message);
    return null;
  }
  return (data as PlanRow | null);
}

export async function findPlanById(planId: string): Promise<PlanRow | null> {
  const supabase = getServiceRoleSupabase();
  const { data, error } = await supabase
    .from("plans")
    .select("id, name, description, reports_per_period, price_cents, currency, stripe_product_id, stripe_price_id, is_active, sort_order")
    .eq("id", planId)
    .maybeSingle();
  if (error) {
    console.error("[stripe] findPlanById failed:", error.message);
    return null;
  }
  return (data as PlanRow | null);
}

// ─── Where to come back to after Stripe flows ───────────────────────────────
// We build absolute URLs for Stripe's success/cancel/return_url params using
// a single source of truth. Vercel provides NEXT_PUBLIC_SITE_URL if set;
// otherwise we fall back to NEXT_PUBLIC_VERCEL_URL (auto-injected on Vercel)
// or finally localhost. Always produces a `https://` URL on Vercel.
export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  const vercel = process.env.NEXT_PUBLIC_VERCEL_URL;
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;

  return "http://localhost:3000";
}
