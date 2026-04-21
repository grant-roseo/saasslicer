"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { T, card, btn, btnDisabled, inputStyle, labelStyle } from "@/lib/design";

function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createSupabaseBrowserClient();

  const rawNext = searchParams.get("next") || "/app";
  const safeNext = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/app";

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.replace(safeNext);
    });
  }, [router, safeNext, supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext)}`,
        data: { full_name: fullName || undefined },
      },
    });

    if (error) {
      setError(error.message);
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

  if (confirmationSent) {
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

        <p style={{ textAlign: "center", marginTop: 18, fontSize: 13, color: T.muted }}>
          Already confirmed?{" "}
          <Link href="/signin" style={{ color: T.accent, fontWeight: 600, textDecoration: "none" }}>
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
