import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServiceRoleSupabase } from "@/lib/stripe";
import { T, card } from "@/lib/design";
import ManageSubscriptionButton from "./ManageSubscriptionButton";
import ProfileCompletionForm from "./ProfileCompletionForm";

export const metadata = {
  title: "Account — SaaS Slicer",
};

export const dynamic = "force-dynamic";

// Currency formatter — price_cents comes from the plans table in cents
function formatPrice(cents: number, currency: string = "usd") {
  return new Intl.NumberFormat("en-US", {
    style:    "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric", month: "long", day: "numeric",
  });
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; session_id?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/signin?next=/account");
  }

  const params = await searchParams;
  const showCheckoutSuccess = params.checkout === "success";

  // Profile row (auto-created on signup via trigger)
  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name, company_name, created_at")
    .eq("id", user.id)
    .single();

  // Subscription + credits — RLS-readable so the anon client works
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("id, plan_id, status, current_period_end, cancel_at_period_end, canceled_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // If subscription exists, look up plan details for display
  let planName:   string | null = null;
  let priceCents: number | null = null;
  let currency:   string        = "usd";
  let reportsPerPeriod: number | null = null;

  if (sub?.plan_id) {
    // Use service role here — plans is public-readable via anon too, so this is
    // just consistency. Could also be done via anon supabase.
    const sRole = getServiceRoleSupabase();
    const { data: plan } = await sRole
      .from("plans")
      .select("name, price_cents, currency, reports_per_period")
      .eq("id", sub.plan_id)
      .single();
    if (plan) {
      planName         = plan.name;
      priceCents       = plan.price_cents;
      currency         = plan.currency || "usd";
      reportsPerPeriod = plan.reports_per_period;
    }
  }

  // Current-period credits (via v_current_credits view — RLS restricts to self)
  const { data: credits } = await supabase
    .from("v_current_credits")
    .select("granted, consumed, balance_remaining, period_end")
    .eq("user_id", user.id)
    .maybeSingle();

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString(undefined, {
        year: "numeric", month: "long", day: "numeric",
      })
    : "—";

  const needsProfileCompletion = !profile?.full_name || !profile?.company_name;

  // Derive subscription state for display
  const hasActiveSub    = sub?.status === "active" || sub?.status === "trialing";
  const hasPastDue      = sub?.status === "past_due";
  const cancelingAtEnd  = hasActiveSub && sub?.cancel_at_period_end;

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
        <Link
          href="/app"
          style={{
            fontSize: 13, fontWeight: 600, color: T.text,
            textDecoration: "none",
            padding: "6px 14px",
            borderRadius: 7,
            border: `1px solid ${T.border}`,
          }}
        >
          Open app →
        </Link>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 640, margin: "40px auto", padding: "0 20px" }}>
        <h1 style={{
          fontSize: 26, fontWeight: 800, color: T.text,
          margin: "0 0 6px", letterSpacing: "-0.5px",
        }}>
          Account
        </h1>
        <p style={{ fontSize: 13.5, color: T.muted, margin: "0 0 28px" }}>
          Your profile, subscription, and usage.
        </p>

        {/* Checkout success banner */}
        {showCheckoutSuccess && (
          <div style={{
            ...card(),
            background: T.successBg || T.accent + "11",
            border: `1px solid ${T.accent}44`,
            padding: "14px 18px",
            marginBottom: 18,
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <div style={{ fontSize: 22 }}>🎉</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.accent }}>Welcome aboard!</div>
              <div style={{ fontSize: 12.5, color: T.muted, marginTop: 2 }}>
                Your subscription is active. Credits may take a few seconds to appear below.
              </div>
            </div>
          </div>
        )}

        {/* ─── Subscription card ────────────────────────────────────── */}
        <div style={{ ...card(), padding: 24, marginBottom: 18 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: T.muted,
            textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 14,
          }}>
            Subscription
          </div>

          {!sub ? (
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: T.text, marginBottom: 6 }}>
                No active plan
              </div>
              <div style={{ fontSize: 13.5, color: T.muted, marginBottom: 16, lineHeight: 1.55 }}>
                Choose a plan to start running competitive content analyses. You can cancel anytime.
              </div>
              <Link
                href="/pricing"
                style={{
                  display: "inline-block",
                  background: T.accent, color: "#fff",
                  fontSize: 13.5, fontWeight: 700,
                  padding: "10px 20px", borderRadius: 8,
                  textDecoration: "none",
                }}
              >
                View plans →
              </Link>
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: T.text, letterSpacing: "-0.3px" }}>
                    {planName || sub.plan_id} {priceCents !== null && (
                      <span style={{ fontSize: 14, fontWeight: 500, color: T.muted, letterSpacing: 0 }}>
                        · {formatPrice(priceCents, currency)}/mo
                      </span>
                    )}
                  </div>
                  <div style={{ marginTop: 4, display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span style={{
                      display: "inline-block", width: 8, height: 8, borderRadius: 999,
                      background: hasActiveSub ? T.success : hasPastDue ? T.error : T.muted,
                    }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: T.text, textTransform: "capitalize" }}>
                      {hasActiveSub ? "Active" : (sub.status || "").replace(/_/g, " ")}
                    </span>
                    {cancelingAtEnd && (
                      <span style={{ fontSize: 12, color: T.error, marginLeft: 6 }}>
                        — canceling at period end
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Credits meter */}
              {credits && typeof credits.granted === "number" && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12.5, color: T.muted, fontWeight: 600 }}>
                    <span>Reports this period</span>
                    <span style={{ color: T.text }}>
                      {credits.consumed} / {credits.granted} used
                    </span>
                  </div>
                  <div style={{
                    height: 8, background: T.borderLight, borderRadius: 999, overflow: "hidden",
                  }}>
                    <div style={{
                      height: "100%",
                      width: `${Math.min(100, (credits.consumed / Math.max(1, credits.granted)) * 100)}%`,
                      background: T.accent,
                      transition: "width 0.3s",
                    }} />
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12, color: T.muted }}>
                    {credits.balance_remaining} remaining — resets {formatDate(credits.period_end)}
                  </div>
                </div>
              )}

              {/* Billing period info when no credits row yet (edge: webhook hasn't landed) */}
              {!credits && hasActiveSub && (
                <div style={{ fontSize: 12.5, color: T.muted, marginBottom: 16, fontStyle: "italic" }}>
                  Credits syncing from Stripe… if this persists more than a minute, refresh the page.
                </div>
              )}

              {reportsPerPeriod !== null && credits && credits.granted !== reportsPerPeriod && (
                <div style={{ fontSize: 11.5, color: T.dim, marginBottom: 12, fontStyle: "italic" }}>
                  Next period will grant {reportsPerPeriod} reports.
                </div>
              )}

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <ManageSubscriptionButton />
                <Link
                  href="/pricing"
                  style={{
                    fontSize: 13, fontWeight: 600, color: T.text,
                    textDecoration: "none",
                    padding: "8px 16px", borderRadius: 7,
                    border: `1px solid ${T.border}`, background: T.surface,
                  }}
                >
                  Change plan
                </Link>
              </div>

              <div style={{ marginTop: 14, fontSize: 11.5, color: T.dim, lineHeight: 1.55 }}>
                Current period ends {formatDate(sub.current_period_end)}.
                {cancelingAtEnd && " Access continues until then."}
              </div>
            </div>
          )}
        </div>

        {/* ─── Profile card ─────────────────────────────────────────── */}
        <div style={{ ...card(), padding: 24, marginBottom: 18 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: T.muted,
            textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 14,
          }}>
            Profile
          </div>

          {needsProfileCompletion && (
            <div style={{ marginBottom: 18 }}>
              <div style={{
                padding: "10px 14px",
                background: T.infoBg, border: `1px solid ${T.infoBdr}`, borderRadius: 8,
                fontSize: 12.5, color: T.info, marginBottom: 12, lineHeight: 1.55,
              }}>
                <strong>Tell us a bit about you.</strong> Takes a few seconds and helps with invoicing and support.
              </div>
              <ProfileCompletionForm
                initialFullName={profile?.full_name || ""}
                initialCompany={profile?.company_name || ""}
              />
              <div style={{ marginTop: 16, borderTop: `1px solid ${T.borderLight}` }} />
            </div>
          )}

          <ProfileRow label="Email"        value={profile?.email || user.email || "—"} />
          <ProfileRow label="Full name"    value={profile?.full_name || "—"} />
          <ProfileRow label="Company"      value={profile?.company_name || "—"} />
          <ProfileRow label="Member since" value={memberSince} isLast />
        </div>

        {/* Sign out */}
        <div style={{ marginTop: 20 }}>
          <form action="/api/auth/signout" method="POST">
            <button
              type="submit"
              style={{
                background: T.surface,
                border: `1px solid ${T.errorBdr}`,
                color: T.error,
                padding: "10px 18px",
                borderRadius: 8,
                fontSize: 13.5,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function ProfileRow({ label, value, isLast }: { label: string; value: string; isLast?: boolean }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "140px 1fr",
      padding: "10px 0",
      borderBottom: isLast ? "none" : `1px solid ${T.borderLight}`,
      fontSize: 14,
    }}>
      <div style={{ color: T.muted, fontWeight: 500 }}>{label}</div>
      <div style={{ color: T.text }}>{value}</div>
    </div>
  );
}
