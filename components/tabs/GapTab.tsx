"use client";
import { useState } from "react";
import { T, card, badge, btn } from "@/lib/design";
import type { GapAnalysis, Gap, GapPriority } from "@/lib/types";

function Tag({ label, color }: { label: string; color: string }) {
  return <span style={badge(color)}>{label}</span>;
}

function priorityColor(p: GapPriority): string {
  return T.priority[p] || T.muted;
}

export default function GapTab({ gapAnalysis }: { gapAnalysis: GapAnalysis | null }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  if (!gapAnalysis) {
    return <div style={{ color: T.muted, fontSize: 14 }}>No gap analysis available.</div>;
  }

  const gaps = gapAnalysis.gaps || [];
  const counts = {
    all:      gaps.length,
    critical: gaps.filter(g => g.priority === "critical").length,
    high:     gaps.filter(g => g.priority === "high").length,
    medium:   gaps.filter(g => g.priority === "medium").length,
    low:      gaps.filter(g => g.priority === "low").length,
  };

  const filtered = gaps.filter(g => {
    if (filter !== "all" && g.priority !== filter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (g.title + g.description + g.opportunity + g.gapType).toLowerCase().includes(s);
    }
    return true;
  });

  return (
    <div>
      {/* Narrative */}
      {gapAnalysis.narrative && (
        <div style={{ ...card(), marginBottom: 20, borderLeft: `3px solid ${T.accent}`, background: T.accentBg }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.accentDark, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 6 }}>Summary</div>
          <div style={{ fontSize: 14, color: T.accentText, lineHeight: 1.7 }}>{gapAnalysis.narrative}</div>
        </div>
      )}

      {/* Competitor strengths + client advantages */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
        {(gapAnalysis.competitorStrengths || []).length > 0 && (
          <div style={card()}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 10 }}>Competitor Strengths</div>
            {gapAnalysis.competitorStrengths.slice(0, 5).map((cs, i) => (
              <div key={i} style={{ padding: "7px 0", borderBottom: `1px solid ${T.borderLight}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.purple }}>{cs.competitor}</div>
                <div style={{ fontSize: 13, color: T.muted, marginTop: 2 }}>{cs.advantage}</div>
              </div>
            ))}
          </div>
        )}
        {(gapAnalysis.clientAdvantages || []).length > 0 && (
          <div style={card()}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 10 }}>Client Advantages</div>
            {gapAnalysis.clientAdvantages.slice(0, 5).map((a, i) => (
              <div key={i} style={{ display: "flex", gap: 8, padding: "7px 0", borderBottom: `1px solid ${T.borderLight}` }}>
                <span style={{ color: T.success, fontSize: 13, flexShrink: 0 }}>✓</span>
                <span style={{ fontSize: 13, color: T.muted }}>{a}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <input
          style={{ background: T.surface, border: "1px solid " + T.border, borderRadius: 7, padding: "6px 12px", fontSize: 13, fontFamily: "inherit", width: 220 }}
          placeholder="Search gaps…" value={search} onChange={e => setSearch(e.target.value)}
        />
        {(["all", "critical", "high", "medium", "low"] as const).map(p => {
          const pColor = p === "all" ? T.accent : (T.priority[p as keyof typeof T.priority] || T.accent);
          return (
            <button key={p} onClick={() => setFilter(p)}
              style={{ padding: "5px 14px", borderRadius: 6, border: `1px solid ${filter === p ? pColor : T.border}`, background: filter === p ? pColor + "18" : "transparent", color: filter === p ? pColor : T.muted, fontFamily: "inherit", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
              {p.charAt(0).toUpperCase() + p.slice(1)} ({counts[p] || gaps.length})
            </button>
          );
        })}
      </div>

      {/* Gap cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map((gap, i) => (
          <div key={i} style={{ ...card(), borderLeft: `3px solid ${priorityColor(gap.priority)}`, padding: "14px 18px", animation: "fadeIn 0.2s ease" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: T.text, flex: 1, marginRight: 14 }}>{gap.title}</div>
              <div style={{ display: "flex", gap: 5, flexShrink: 0, flexWrap: "wrap" }}>
                <Tag label={gap.priority} color={priorityColor(gap.priority)} />
                <Tag label={gap.funnelStage} color={T.funnel[gap.funnelStage] || T.muted} />
                <Tag label={(gap.gapType || "").replace(/_/g, " ")} color={T.dim} />
              </div>
            </div>
            <p style={{ fontSize: 13.5, color: T.muted, margin: "0 0 10px", lineHeight: 1.65 }}>{gap.description}</p>
            <div style={{ background: T.accentBg, borderRadius: 7, padding: "8px 13px", marginBottom: 8, border: `1px solid ${T.accent}33` }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: T.accentDark, textTransform: "uppercase", letterSpacing: "0.4px" }}>Action: </span>
              <span style={{ fontSize: 13.5, color: T.text }}>{gap.opportunity}</span>
            </div>
            <div style={{ fontSize: 12, color: T.dim, display: "flex", gap: 16, flexWrap: "wrap" }}>
              <span>~{gap.estimatedPages} pages</span>
              {(gap.competitorsDoing || []).length > 0 && <span>Competitors doing this: {gap.competitorsDoing.join(", ")}</span>}
              {(gap.icpRelevance || []).length > 0 && <span style={{ color: T.purple }}>ICPs: {gap.icpRelevance.join(", ")}</span>}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 0", color: T.muted, fontSize: 14 }}>No gaps match your filters.</div>
        )}
      </div>
    </div>
  );
}

