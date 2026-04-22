import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { T, card } from "@/lib/design";
import type { PlanRow } from "@/lib/stripe";
import SubscribeButton from "./SubscribeButton";

export const metadata = {
  title: "Pricing — SaaS Slicer",
  description: "Pick a plan for your competitive content strategy analysis.",
};

// Pricing page needs to read user session (to show 'Current plan' badge if
// they're already subscribed). Must be dynamic.
export const dynamic = "force-dynamic";

// Plan cards are ordered by sort_order from the DB. The middle tier is
// highlighted as "Most popular" — classic pricing anchor.
const FEATURED_PLAN_ID = "scale";

export default async function PricingPage() {
  const supabase = await createSupabaseServerClient();

  // Load plans from the DB — source of truth for prices and descriptions.
  // Uses anon key with RLS; the plans table is public-readable.
  const { data: plansRaw } = await supabase
    .from("plans")
    .select("id, name, description, reports_per_period, price_cents, currency, stripe_product_id, stripe_price_id, is_active, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const plans: PlanRow[] = (plansRaw || []) as PlanRow[];

  // Check auth + active subscription (so we can show the right CTA per plan)
  const { data: { user } } = await supabase.auth.getUser();

  let currentPlanId: string | null = null;
  if (user) {
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("plan_id, status")
      .eq("user_id", user.id)
      .in("status", ["active", "trialing", "past_due"])
      .maybeSingle();
    currentPlanId = sub?.plan_id || null;
  }

  return (
    <div style={{
      minHeight: "100vh", background: T.bg,
      fontFamily: "Inter, system-ui, -apple-system, sans-serif",
    }}>
      {/* Header */}
      <div style={{
        padding: "16px 24px",
        borderBottom: `1px solid ${T.border}`,
        background: T.surface,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <Link href="/" style={{
          display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none",
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, background: T.accent,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 17, fontWeight: 900, color: "#fff",
          }}>⌖</div>
          <div style={{
            fontSize: 16, fontWeight: 800, color: T.text, letterSpacing: "-0.5px",
          }}>
            SaaS<span style={{ color: T.accent }}>Slicer</span>
          </div>
        </Link>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {user ? (
            <>
              <Link href="/account" style={linkStyle}>Account</Link>
              <Link href="/app" style={{ ...linkStyle, background: T.accent, color: "#fff", border: `1px solid ${T.accent}` }}>Open app →</Link>
            </>
          ) : (
            <>
              <Link href="/signin" style={linkStyle}>Sign in</Link>
              <Link href="/signup" style={{ ...linkStyle, background: T.accent, color: "#fff", border: `1px solid ${T.accent}` }}>Sign up</Link>
            </>
          )}
        </div>
      </div>

      {/* Hero */}
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "52px 20px 20px", textAlign: "center" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.accent, textTransform: "uppercase", letterSpacing: "1.2px", marginBottom: 10 }}>Pricing</div>
        <h1 style={{
          fontSize: 38, fontWeight: 900, color: T.text,
          margin: "0 0 14px", letterSpacing: "-1px", lineHeight: 1.15,
        }}>
          Choose your plan
        </h1>
        <p style={{ fontSize: 16, color: T.muted, maxWidth: 540, margin: "0 auto", lineHeight: 1.55 }}>
          Every plan includes the full analysis pipeline, ICP profiles, expert review, and all exports. Pick the volume that matches your content cadence.
        </p>
      </div>

      {/* Plan cards */}
      <div style={{
        maxWidth: 1080, margin: "0 auto", padding: "28px 20px 60px",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: 16,
      }}>
        {plans.map(plan => {
          const isFeatured = plan.id === FEATURED_PLAN_ID;
          const isCurrent  = currentPlanId === plan.id;
          return (
            <PlanCard
              key={plan.id}
              plan={plan}
              isFeatured={isFeatured}
              isCurrent={isCurrent}
              userSignedIn={!!user}
            />
          );
        })}
      </div>

      {/* Manage subscription link if user already has one */}
      {user && currentPlanId && (
        <div style={{ maxWidth: 560, margin: "0 auto 40px", textAlign: "center" }}>
          <p style={{ fontSize: 13.5, color: T.muted, marginBottom: 10 }}>
            Already subscribed to <strong style={{ color: T.text }}>
              {plans.find(p => p.id === currentPlanId)?.name}
            </strong>. Change plan or update billing through the Customer Portal.
          </p>
          <Link href="/account" style={{
            fontSize: 13.5, fontWeight: 600, color: T.accent, textDecoration: "none",
          }}>
            Manage subscription on your account page →
          </Link>
        </div>
      )}

      {/* FAQ */}
      <div style={{ maxWidth: 720, margin: "0 auto 64px", padding: "0 20px" }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: T.text, margin: "0 0 20px", textAlign: "center", letterSpacing: "-0.3px" }}>
          Frequently asked
        </h2>
        <div style={{ ...card(), padding: 0 }}>
          <Faq
            q="Do unused reports roll over?"
            a="No. Credits reset at the start of each billing period. This keeps pricing simple and predictable — you always know exactly what you can run in a given month."
          />
          <Faq
            q="Can I change plans?"
            a="Yes. Upgrade or downgrade anytime from your account page — we use Stripe's customer portal so changes take effect immediately with prorated billing."
          />
          <Faq
            q="Can I cancel anytime?"
            a="Yes. Cancellation is self-service through the customer portal. You keep full access until the end of the current billing period, then the subscription stops."
          />
          <Faq
            q="What counts as a report?"
            a="One completed analysis run — from start through strategy and ICP narratives. Failed runs don't count against your credits. Neither does reloading a saved JSON from a previous run."
            last
          />
        </div>
      </div>
    </div>
  );
}

// ─── Plan card ──────────────────────────────────────────────────────────────
function PlanCard({
  plan, isFeatured, isCurrent, userSignedIn,
}: {
  plan: PlanRow;
  isFeatured: boolean;
  isCurrent: boolean;
  userSignedIn: boolean;
}) {
  const priceDollars = Math.floor(plan.price_cents / 100);
  const perReportDollars = (plan.price_cents / 100 / plan.reports_per_period).toFixed(0);

  // Full feature list — same across tiers except report count
  const features = [
    `${plan.reports_per_period} complete ${plan.reports_per_period === 1 ? "report" : "reports"} per month`,
    "1 client + up to 5 competitors per run",
    "Up to 20 ICP profiles with buyer language",
    "Content plan (net new / refresh / repurpose)",
    "Human-in-the-loop expert review",
    "Excel + Word + Markdown + JSON exports",
    "Save & reload analyses anytime",
  ];

  const priceBreakdownLabel = plan.reports_per_period > 1
    ? `$${perReportDollars} per report`
    : "Single strategy per month";

  return (
    <div style={{
      ...card(),
      padding: 28,
      position: "relative",
      border: isFeatured ? `2px solid ${T.accent}` : `1px solid ${T.border}`,
      background: T.surface,
      display: "flex", flexDirection: "column", gap: 14,
      transform: isFeatured ? "translateY(-6px)" : "none",
      boxShadow: isFeatured ? "0 10px 24px rgba(22, 163, 74, 0.12)" : "none",
    }}>
      {isFeatured && (
        <div style={{
          position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
          background: T.accent, color: "#fff",
          fontSize: 11, fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase",
          padding: "4px 14px", borderRadius: 999,
        }}>
          Most popular
        </div>
      )}
      {isCurrent && (
        <div style={{
          position: "absolute", top: -12, right: 16,
          background: T.info, color: "#fff",
          fontSize: 11, fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase",
          padding: "4px 12px", borderRadius: 999,
        }}>
          Current plan
        </div>
      )}

      <div>
        <div style={{
          fontSize: 13, fontWeight: 700, color: T.muted,
          textTransform: "uppercase", letterSpacing: "0.6px",
        }}>
          {plan.name}
        </div>
        <div style={{ fontSize: 12.5, color: T.muted, marginTop: 4, lineHeight: 1.45, minHeight: 36 }}>
          {plan.description || ""}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 42, fontWeight: 900, color: T.text, letterSpacing: "-1.5px", lineHeight: 1 }}>
          ${priceDollars}
          <span style={{ fontSize: 15, fontWeight: 500, color: T.muted, letterSpacing: 0 }}> /month</span>
        </div>
        <div style={{ fontSize: 12.5, color: T.accent, fontWeight: 600, marginTop: 6 }}>
          {priceBreakdownLabel}
        </div>
      </div>

      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {features.map((f, i) => (
          <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: T.text, lineHeight: 1.5 }}>
            <span style={{ color: T.success, fontSize: 14, fontWeight: 700, marginTop: 0 }}>✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>

      {/* CTA — three states depending on user session + current plan */}
      {isCurrent ? (
        <div style={{
          padding: "12px 14px", borderRadius: 8,
          background: T.infoBg, border: `1px solid ${T.infoBdr}`,
          color: T.info, fontSize: 13, fontWeight: 600, textAlign: "center",
        }}>
          You&rsquo;re on this plan
        </div>
      ) : userSignedIn ? (
        <SubscribeButton planId={plan.id} featured={isFeatured} />
      ) : (
        <Link
          href={`/signup?next=${encodeURIComponent(`/pricing?plan=${plan.id}`)}`}
          style={{
            display: "block", textAlign: "center",
            padding: "12px 14px", borderRadius: 8,
            textDecoration: "none", fontWeight: 700, fontSize: 14,
            background: isFeatured ? T.accent : T.surface,
            color: isFeatured ? "#fff" : T.text,
            border: isFeatured ? `1px solid ${T.accent}` : `1px solid ${T.border}`,
          }}
        >
          Sign up to start
        </Link>
      )}
    </div>
  );
}

function Faq({ q, a, last }: { q: string; a: string; last?: boolean }) {
  return (
    <div style={{
      padding: "18px 20px",
      borderBottom: last ? "none" : `1px solid ${T.borderLight}`,
    }}>
      <div style={{ fontSize: 14.5, fontWeight: 700, color: T.text, marginBottom: 6 }}>{q}</div>
      <div style={{ fontSize: 13.5, color: T.muted, lineHeight: 1.65 }}>{a}</div>
    </div>
  );
}

const linkStyle = {
  fontSize: 13, fontWeight: 600, color: T.text, textDecoration: "none",
  padding: "6px 14px", borderRadius: 7,
  border: `1px solid ${T.border}`, background: "transparent",
} as const;
