"use client";
import { useState } from "react";
import { T } from "@/lib/design";

export default function ManageSubscriptionButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.url) {
        throw new Error(data?.error || "Could not open the billing portal.");
      }
      window.location.href = data.url;
    } catch (err: any) {
      setError(err?.message || "Something went wrong opening the portal.");
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", gap: 6 }}>
      <button
        onClick={handleClick}
        disabled={loading}
        style={{
          fontSize: 13, fontWeight: 700, color: "#fff",
          background: T.accent, border: `1px solid ${T.accent}`,
          padding: "8px 16px", borderRadius: 7,
          cursor: loading ? "wait" : "pointer",
          opacity: loading ? 0.7 : 1,
          fontFamily: "inherit",
        }}
      >
        {loading ? "Opening…" : "Manage subscription"}
      </button>
      {error && (
        <div style={{
          fontSize: 12, color: T.error, padding: "4px 10px",
          background: T.errorBg, border: `1px solid ${T.errorBdr}`, borderRadius: 6,
        }}>
          {error}
        </div>
      )}
    </div>
  );
}
