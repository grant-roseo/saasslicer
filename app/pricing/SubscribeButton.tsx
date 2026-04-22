"use client";
import { useState } from "react";
import { T } from "@/lib/design";

export default function SubscribeButton({
  planId, featured,
}: {
  planId: string;
  featured: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.url) {
        throw new Error(data?.error || "Could not start checkout. Please try again.");
      }
      // Redirect to Stripe-hosted checkout page
      window.location.href = data.url;
    } catch (err: any) {
      setError(err?.message || "Something went wrong starting checkout.");
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <button
        onClick={handleClick}
        disabled={loading}
        style={{
          display: "block", textAlign: "center", width: "100%",
          padding: "12px 14px", borderRadius: 8,
          fontWeight: 700, fontSize: 14, fontFamily: "inherit",
          cursor: loading ? "wait" : "pointer",
          background: featured ? T.accent : T.surface,
          color: featured ? "#fff" : T.text,
          border: featured ? `1px solid ${T.accent}` : `1px solid ${T.border}`,
          opacity: loading ? 0.7 : 1,
          transition: "opacity 0.15s",
        }}
      >
        {loading ? "Starting checkout…" : "Subscribe"}
      </button>
      {error && (
        <div style={{
          fontSize: 12, color: T.error, lineHeight: 1.45,
          padding: "6px 10px", background: T.errorBg, border: `1px solid ${T.errorBdr}`, borderRadius: 6,
        }}>
          {error}
        </div>
      )}
    </div>
  );
}
