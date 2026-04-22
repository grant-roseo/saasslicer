"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { T, inputStyle, labelStyle, btn } from "@/lib/design";

export default function ProfileCompletionForm({
  initialFullName, initialCompany,
}: {
  initialFullName: string;
  initialCompany: string;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [fullName, setFullName] = useState(initialFullName);
  const [company,  setCompany]  = useState(initialCompany);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [saved,    setSaved]    = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const { error: upErr } = await supabase
        .from("profiles")
        .update({
          full_name:    fullName.trim() || null,
          company_name: company.trim() || null,
        })
        .eq("id", user.id);
      if (upErr) throw upErr;

      setSaved(true);
      // Refresh the server component so the new values display
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Could not save your profile.");
      setSaving(false);
    }
  }

  if (saved) {
    return (
      <div style={{
        padding: "10px 14px",
        background: T.accent + "11", border: `1px solid ${T.accent}44`, borderRadius: 8,
        fontSize: 13, color: T.accent, fontWeight: 600,
      }}>
        ✓ Profile saved. Thank you.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label style={labelStyle}>Full name</label>
          <input
            type="text"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder="Grant Simmonet"
            style={inputStyle}
            required
            autoFocus
          />
        </div>
        <div>
          <label style={labelStyle}>Company</label>
          <input
            type="text"
            value={company}
            onChange={e => setCompany(e.target.value)}
            placeholder="Roseo"
            style={inputStyle}
            required
          />
        </div>
      </div>
      {error && (
        <div style={{
          fontSize: 12.5, color: T.error, padding: "6px 10px",
          background: T.errorBg, border: `1px solid ${T.errorBdr}`, borderRadius: 6,
        }}>
          {error}
        </div>
      )}
      <div>
        <button
          type="submit"
          disabled={saving}
          style={{ ...btn("primary"), fontSize: 13, padding: "8px 16px", opacity: saving ? 0.7 : 1, cursor: saving ? "wait" : "pointer" }}
        >
          {saving ? "Saving…" : "Save profile"}
        </button>
      </div>
    </form>
  );
}
