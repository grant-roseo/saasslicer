"use client";
import { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { T, card, btn, btnDisabled, inputStyle, labelStyle } from "@/lib/design";

// Opt out of static prerendering — see signin/page.tsx for rationale.
export const dynamic = "force-dynamic";

function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const rawNext = searchParams.get("next") || "/app";
  const safeNext = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/app";

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);
  // Set when Supabase returns a "successful" signup but the email is actually
  // already registered — see comment below in handleSubmit.
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.replace(safeNext);
    });
  }, [router, safeNext, supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAlreadyRegistered(false);
    setSubmitting(true);

    // Build the post-confirmation redirect URL. We append `welcome=1` so /app
    // can show a one-time welcome banner when this is a fresh signup hitting
    // the app for the first time. Done with URL parsing so we don't break
    // any existing query string in `safeNext` (e.g. `/pricing?plan=scale`).
    const redirectUrl = (() => {
      const u = new URL("/auth/callback", window.location.origin);
      // Inner next URL must include welcome=1
      const innerNext = new URL(safeNext, window.location.origin);
      innerNext.searchParams.set("welcome", "1");
      // Strip origin from inner so callback's safeNext check accepts it
      u.searchParams.set("next", innerNext.pathname + innerNext.search);
      return u.toString();
    })();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { full_name: fullName || undefined },
      },
    });

    if (error) {
      setError(error.message);
      setSubmitting(false);
      return;
    }

    // ─── Duplicate-email detection ──────────────────────────────────────────
    // Supabase silently swallows duplicate-email signups (anti-enumeration
    // defense — prevents attackers from probing the user list). When the email
    // is already registered, Supabase still returns a "user" object but with
    // an empty `identities` array. Genuine new signups have at least one
    // identity entry. We use this signal to give users a useful next step
    // (sign in or reset password) instead of silently waiting for an email
    // that will never arrive.
    //
    // This is documented Supabase behavior, not a hack. See:
    //   github.com/supabase/auth/issues/1517 (and many docs PRs since)
    const identities = data?.user?.identities;
    const isDuplicate = !data.session && Array.isArray(identities) && identities.length === 0;

    if (isDuplicate) {
      setAlreadyRegistered(true);
      setSubmitting(false);
      return;
    }

    // If Supabase returns a session immediately, email confirmation is off — redirect.
    // Otherwise, show the "check your inbox" screen.
    if (data.session) {
      router.push(safeNext);
      router.refresh();
    } else {
      setConfirmationSent(true);
      setSubmitting(false);
    }
  }

  const passwordOk = password.length >= 8;
  const canSubmit = email.length > 0 && passwordOk && !submitting;

  // ─── "You already have an account" screen ───────────────────────────────
  // Shown when Supabase signaled (via empty identities) that this email is
  // already registered. We don't show this for unconfirmed accounts because
  // Supabase's signup endpoint will resend the confirmation in that case —
  // the empty-identities signal only fires for fully registered accounts.
  if (alreadyRegistered) {
    const resetHref = `/reset-password?email=${encodeURIComponent(email)}`;
    const signinHref = `/signin?email=${encodeURIComponent(email)}${rawNext !== "/app" ? `&next=${encodeURIComponent(safeNext)}` : ""}`;
    return (
      <>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: T.text, margin: "0 0 8px", letterSpacing: "-0.5px" }}>
          You already have an account
        </h1>
        <p style={{ fontSize: 14, color: T.muted, margin: "0 0 24px", lineHeight: 1.6 }}>
          An account with <strong style={{ color: T.text }}>{email}</strong> already exists.
          Sign in or reset your password.
        </p>

        <div style={{ ...card(), padding: 20 }}>
          <Link
            href={signinHref}
            style={{
              display: "block", textAlign: "center",
              ...btn("primary"), padding: "12px",
              textDecoration: "none", marginBottom: 10,
            }}
          >
            Sign in to {email}
          </Link>
          <Link
            href={resetHref}
            style={{
              display: "block", textAlign: "center",
              padding: "10px 12px",
              fontSize: 13.5, fontWeight: 600, color: T.text,
              textDecoration: "none",
              border: `1px solid ${T.border}`, borderRadius: 8,
              background: T.surface,
            }}
          >
            Reset password
          </Link>
        </div>

        <p style={{ textAlign: "center", marginTop: 18, fontSize: 13, color: T.muted }}>
          Wrong email?{" "}
          <button
            type="button"
            onClick={() => { setAlreadyRegistered(false); setEmail(""); setPassword(""); }}
            style={{
              background: "none", border: "none", padding: 0,
              color: T.accent, fontWeight: 600, fontFamily: "inherit",
              fontSize: 13, cursor: "pointer", textDecoration: "none",
            }}
          >
            Try a different one
          </button>
        </p>
      </>
    );
  }

  if (confirmationSent) {
    const signinHref = `/signin?email=${encodeURIComponent(email)}${rawNext !== "/app" ? `&next=${encodeURIComponent(safeNext)}` : ""}`;
    const resetHref = `/reset-password?email=${encodeURIComponent(email)}`;
    return (
      <>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: T.text, margin: "0 0 8px", letterSpacing: "-0.5px" }}>
          Check your inbox
        </h1>
        <p style={{ fontSize: 14, color: T.muted, margin: "0 0 24px", lineHeight: 1.6 }}>
          We sent a confirmation link to <strong style={{ color: T.text }}>{email}</strong>.
          Click it to finish setting up your account.
        </p>

        <div style={{ ...card(), padding: 20 }}>
          <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.6 }}>
            Don&rsquo;t see it? Check your spam folder. If it still doesn&rsquo;t arrive in
            a couple of minutes, you can{" "}
            <button
              type="button"
              onClick={() => { setConfirmationSent(false); setEmail(""); setPassword(""); }}
              style={{
                background: "none", border: "none", padding: 0,
                color: T.info, cursor: "pointer", fontFamily: "inherit",
                fontSize: 13, fontWeight: 600, textDecoration: "underline",
              }}
            >
              try a different email
            </button>.
          </div>
        </div>

        {/* Already-have-account hint — explicit acknowledgment that no email is
            sent for already-registered emails (anti-enumeration behavior) */}
        <div style={{
          marginTop: 14,
          padding: "12px 16px",
          background: T.infoBg, border: `1px solid ${T.infoBdr}`, borderRadius: 8,
        }}>
          <div style={{ fontSize: 12.5, color: T.info, lineHeight: 1.6 }}>
            <strong>Already have an account?</strong> If {email} is already registered,
            we don&rsquo;t send a duplicate confirmation. Try{" "}
            <Link href={signinHref} style={{ color: T.info, fontWeight: 700, textDecoration: "underline" }}>signing in</Link>
            {" "}or{" "}
            <Link href={resetHref} style={{ color: T.info, fontWeight: 700, textDecoration: "underline" }}>resetting your password</Link>.
          </div>
        </div>

        <p style={{ textAlign: "center", marginTop: 18, fontSize: 13, color: T.muted }}>
          Already confirmed?{" "}
          <Link href={signinHref} style={{ color: T.accent, fontWeight: 600, textDecoration: "none" }}>
            Sign in
          </Link>
        </p>
      </>
    );
  }

  return (
    <>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: T.text, margin: "0 0 8px", letterSpacing: "-0.5px" }}>
        Create your account
      </h1>
      <p style={{ fontSize: 13.5, color: T.muted, margin: "0 0 24px" }}>
        Get started with SaaS Slicer.
      </p>

      <div style={{ ...card(), padding: 24 }}>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <div style={labelStyle}>
              Full name{" "}
              <span style={{ color: T.dim, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                — optional
              </span>
            </div>
            <input
              type="text" autoComplete="name"
              value={fullName} onChange={e => setFullName(e.target.value)}
              style={inputStyle} placeholder="Your name"
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={labelStyle}>Email</div>
            <input
              type="email" autoComplete="email" required
              value={email} onChange={e => setEmail(e.target.value)}
              style={inputStyle} placeholder="you@example.com"
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={labelStyle}>Password</div>
            <input
              type="password" autoComplete="new-password" required
              value={password} onChange={e => setPassword(e.target.value)}
              style={inputStyle} placeholder="At least 8 characters"
            />
            {password.length > 0 && !passwordOk && (
              <div style={{ fontSize: 11.5, color: T.warn, marginTop: 4 }}>
                Password must be at least 8 characters.
              </div>
            )}
          </div>

          {error && (
            <div style={{
              fontSize: 13, color: T.error, padding: "8px 12px",
              background: T.errorBg, border: `1px solid ${T.errorBdr}`,
              borderRadius: 7, marginBottom: 14,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit" disabled={!canSubmit}
            style={canSubmit
              ? { ...btn("primary"), width: "100%", padding: "12px" }
              : { ...btnDisabled(), width: "100%", padding: "12px" }}
          >
            {submitting ? "Creating account…" : "Create account"}
          </button>
        </form>
      </div>

      <p style={{ textAlign: "center", marginTop: 18, fontSize: 13, color: T.muted }}>
        Already have an account?{" "}
        <Link
          href={`/signin${rawNext !== "/app" ? `?next=${encodeURIComponent(safeNext)}` : ""}`}
          style={{ color: T.accent, fontWeight: 600, textDecoration: "none" }}
        >
          Sign in
        </Link>
      </p>
    </>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={null}>
      <SignUpForm />
    </Suspense>
  );
}
