"use client";
import { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { T, card, btn, btnDisabled, inputStyle, labelStyle } from "@/lib/design";

// Opt out of static prerendering — see signin/page.tsx for rationale.
// This is the page that originally triggered the prerender failure during
// the Phase 2A deploy attempt because PASSWORD_RECOVERY auth events imply
// runtime-only Supabase interaction.
export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  // Optional ?email= prefill — used by the duplicate-signup CTA and the
  // sign-in error reset link so users land here with their email already filled.
  const initialEmail = searchParams.get("email") || "";

  // "request": user types email to receive reset link
  // "update":  user clicked link in email and is now setting new password
  const [mode, setMode] = useState<"request" | "update">("request");
  const [email, setEmail] = useState(initialEmail);
  const [newPassword, setNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Supabase fires PASSWORD_RECOVERY when user lands here from a reset email link
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("update");
        setError(null);
        setSuccessMessage(null);
      }
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  async function handleRequestReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setSubmitting(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setSubmitting(false);
    if (error) { setError(error.message); return; }
    setSuccessMessage(`If an account exists for ${email}, we sent a reset link.`);
  }

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    setSubmitting(false);
    if (error) { setError(error.message); return; }

    setSuccessMessage("Password updated. Redirecting to sign-in…");
    setTimeout(() => { router.push("/signin"); router.refresh(); }, 1500);
  }

  if (mode === "update") {
    const passwordOk = newPassword.length >= 8;
    return (
      <>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: T.text, margin: "0 0 8px", letterSpacing: "-0.5px" }}>
          Set a new password
        </h1>
        <p style={{ fontSize: 13.5, color: T.muted, margin: "0 0 24px" }}>
          Choose a new password for your account.
        </p>

        <div style={{ ...card(), padding: 24 }}>
          <form onSubmit={handleUpdatePassword}>
            <div style={{ marginBottom: 16 }}>
              <div style={labelStyle}>New password</div>
              <input
                type="password" autoComplete="new-password" required
                value={newPassword} onChange={e => setNewPassword(e.target.value)}
                style={inputStyle} placeholder="At least 8 characters"
              />
            </div>

            {error && (
              <div style={{
                fontSize: 13, color: T.error, padding: "8px 12px",
                background: T.errorBg, border: `1px solid ${T.errorBdr}`,
                borderRadius: 7, marginBottom: 14,
              }}>{error}</div>
            )}
            {successMessage && (
              <div style={{
                fontSize: 13, color: T.success, padding: "8px 12px",
                background: "#ECFDF5", border: `1px solid ${T.success}33`,
                borderRadius: 7, marginBottom: 14,
              }}>{successMessage}</div>
            )}

            <button
              type="submit" disabled={!passwordOk || submitting}
              style={(passwordOk && !submitting)
                ? { ...btn("primary"), width: "100%", padding: "12px" }
                : { ...btnDisabled(), width: "100%", padding: "12px" }}
            >
              {submitting ? "Updating…" : "Update password"}
            </button>
          </form>
        </div>
      </>
    );
  }

  // request mode
  const canSubmit = email.length > 0 && !submitting;
  return (
    <>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: T.text, margin: "0 0 8px", letterSpacing: "-0.5px" }}>
        Reset password
      </h1>
      <p style={{ fontSize: 13.5, color: T.muted, margin: "0 0 24px" }}>
        Enter your email and we&rsquo;ll send you a link to reset your password.
      </p>

      <div style={{ ...card(), padding: 24 }}>
        <form onSubmit={handleRequestReset}>
          <div style={{ marginBottom: 16 }}>
            <div style={labelStyle}>Email</div>
            <input
              type="email" autoComplete="email" required
              value={email} onChange={e => setEmail(e.target.value)}
              style={inputStyle} placeholder="you@example.com"
            />
          </div>

          {error && (
            <div style={{
              fontSize: 13, color: T.error, padding: "8px 12px",
              background: T.errorBg, border: `1px solid ${T.errorBdr}`,
              borderRadius: 7, marginBottom: 14,
            }}>{error}</div>
          )}
          {successMessage && (
            <div style={{
              fontSize: 13, color: T.success, padding: "8px 12px",
              background: "#ECFDF5", border: `1px solid ${T.success}33`,
              borderRadius: 7, marginBottom: 14,
            }}>{successMessage}</div>
          )}

          <button
            type="submit" disabled={!canSubmit}
            style={canSubmit
              ? { ...btn("primary"), width: "100%", padding: "12px" }
              : { ...btnDisabled(), width: "100%", padding: "12px" }}
          >
            {submitting ? "Sending…" : "Send reset link"}
          </button>
        </form>
      </div>

      <p style={{ textAlign: "center", marginTop: 18, fontSize: 13, color: T.muted }}>
        Remembered it?{" "}
        <Link href="/signin" style={{ color: T.accent, fontWeight: 600, textDecoration: "none" }}>
          Sign in
        </Link>
      </p>
    </>
  );
}
