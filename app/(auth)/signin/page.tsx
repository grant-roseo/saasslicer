"use client";
import { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { T, card, btn, btnDisabled, inputStyle, labelStyle } from "@/lib/design";

// Opt out of static prerendering. This page is interactive auth UI — it has
// no useful static representation and any prerender attempt would fail
// because the Supabase client construction needs runtime env vars.
export const dynamic = "force-dynamic";

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Memoize so the client is constructed once per mount, not per render.
  // The empty dep array also defers construction past prerender.
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  // Sanitize the `next` param: only allow same-origin paths starting with /,
  // not protocol-relative URLs like //evil.com or full URLs. Open-redirect protection.
  const rawNext = searchParams.get("next") || "/app";
  const safeNext = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/app";

  // Optional ?email= prefill — used by the duplicate-signup CTA on the
  // signup page so users land here with their email already filled.
  const initialEmail = searchParams.get("email") || "";

  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already signed in, redirect away
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.replace(safeNext);
    });
  }, [router, safeNext, supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setSubmitting(false);
      return;
    }
    router.push(safeNext);
    router.refresh();
  }

  const canSubmit = email.length > 0 && password.length > 0 && !submitting;

  return (
    <>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: T.text, margin: "0 0 8px", letterSpacing: "-0.5px" }}>
        Sign in
      </h1>
      <p style={{ fontSize: 13.5, color: T.muted, margin: "0 0 24px" }}>
        Welcome back to SaaS Slicer.
      </p>

      <div style={{ ...card(), padding: 24 }}>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <div style={labelStyle}>Email</div>
            <input
              type="email" autoComplete="email" required
              value={email} onChange={e => setEmail(e.target.value)}
              style={inputStyle} placeholder="you@example.com"
            />
          </div>

          <div style={{ marginBottom: 6 }}>
            <div style={labelStyle}>Password</div>
            <input
              type="password" autoComplete="current-password" required
              value={password} onChange={e => setPassword(e.target.value)}
              style={inputStyle} placeholder="••••••••"
            />
          </div>

          <div style={{ textAlign: "right", marginBottom: 16 }}>
            <Link href="/reset-password" style={{ fontSize: 12, color: T.info, textDecoration: "none" }}>
              Forgot password?
            </Link>
          </div>

          {error && (
            <div style={{
              fontSize: 13, color: T.error, padding: "10px 12px",
              background: T.errorBg, border: `1px solid ${T.errorBdr}`,
              borderRadius: 7, marginBottom: 14,
            }}>
              <div>{error}</div>
              <div style={{ marginTop: 6, fontSize: 12, color: T.muted }}>
                Forgot your password?{" "}
                <Link
                  href={`/reset-password?email=${encodeURIComponent(email)}`}
                  style={{ color: T.error, fontWeight: 700, textDecoration: "underline" }}
                >
                  Reset it
                </Link>.
              </div>
            </div>
          )}

          <button
            type="submit" disabled={!canSubmit}
            style={canSubmit
              ? { ...btn("primary"), width: "100%", padding: "12px" }
              : { ...btnDisabled(), width: "100%", padding: "12px" }}
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>

      <p style={{ textAlign: "center", marginTop: 18, fontSize: 13, color: T.muted }}>
        Don&rsquo;t have an account?{" "}
        <Link
          href={`/signup${rawNext !== "/app" ? `?next=${encodeURIComponent(safeNext)}` : ""}`}
          style={{ color: T.accent, fontWeight: 600, textDecoration: "none" }}
        >
          Sign up
        </Link>
      </p>
    </>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}
