import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { T, card } from "@/lib/design";

export const metadata = {
  title: "Account — SaaS Slicer",
};

export default async function AccountPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/signin?next=/account");
  }

  // Read the profile row (auto-created on signup via the handle_new_user() trigger)
  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name, company_name, created_at")
    .eq("id", user.id)
    .single();

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString(undefined, {
        year: "numeric", month: "long", day: "numeric",
      })
    : "—";

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
          Your profile information.
        </p>

        <div style={{ ...card(), padding: 24 }}>
          <ProfileRow label="Email" value={profile?.email || user.email || "—"} />
          <ProfileRow label="Full name" value={profile?.full_name || "—"} />
          <ProfileRow label="Company" value={profile?.company_name || "—"} />
          <ProfileRow label="Member since" value={memberSince} />
        </div>

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

        <div style={{ marginTop: 32, fontSize: 12, color: T.dim }}>
          Billing and subscription management will be added in a future update.
        </div>
      </div>
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "140px 1fr",
      padding: "10px 0",
      borderBottom: `1px solid ${T.borderLight}`,
      fontSize: 14,
    }}>
      <div style={{ color: T.muted, fontWeight: 500 }}>{label}</div>
      <div style={{ color: T.text }}>{value}</div>
    </div>
  );
}
