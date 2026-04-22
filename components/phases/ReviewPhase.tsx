"use client";
import { useState } from "react";
import { T, card, btn, badge } from "@/lib/design";
import type { ContentItem, ContentCluster } from "@/lib/types";
import { CLUSTER_LABELS } from "@/lib/types";

// Feedback examples oriented around ADDITIVE / MODIFYING / REMOVING phrasing.
// These are the patterns that work best with the delta-merge architecture.
const EXAMPLES = [
  "Add pages for the construction and financial services verticals — they were missed",
  "Also consider a Legal Ops role page and a Sales Ops role page",
  "Client already has a contract glossary — mark that item as 'refresh' not 'net new'",
  "Remove the comparison pages — client's legal team doesn't want head-to-head content",
  "Add a services-led page for managed contract redlining",
];

function clusterColor(c?: ContentCluster): string {
  switch (c) {
    case "core_platform":        return T.accent;
    case "role_solutions":       return T.info;
    case "industry_verticals":   return T.purple;
    case "topic_guides":         return T.success;
    case "services_led":         return T.accentDark;
    case "commercial_education": return T.error;
    case "proof_and_hubs":       return T.purple;
    case "interactive_tools":    return T.info;
    default:                     return T.muted;
  }
}

export default function ReviewPhase({
  contentPlan,
  onContinue,
  isRefining,
}: {
  contentPlan: ContentItem[];
  // New signature: receives free-text feedback AND the list of priorities
  // the analyst queued for removal. Either or both may be non-empty.
  onContinue: (feedback: string, removedPriorities: number[]) => void;
  isRefining: boolean;
}) {
  const [feedback, setFeedback] = useState("");
  const [showAll, setShowAll]   = useState(false);

  // Queued removals — set of `item.priority` values. Using priority rather than
  // index so the queue survives sort/filter changes to the displayed list.
  // (The actual items being targeted are identified by priority number in the
  // delta prompt too — keeping the identifier consistent end-to-end.)
  const [queuedRemoval, setQueuedRemoval] = useState<Set<number>>(new Set());

  function toggleRemoval(priority: number) {
    setQueuedRemoval(prev => {
      const next = new Set(prev);
      if (next.has(priority)) next.delete(priority);
      else next.add(priority);
      return next;
    });
  }

  function clearQueue() {
    setQueuedRemoval(new Set());
  }

  const displayed  = showAll ? contentPlan : contentPlan.slice(0, 30);
  const netNew     = contentPlan.filter(i => i.action === "net_new").length;
  const refresh    = contentPlan.filter(i => i.action === "refresh").length;
  const repurpose  = contentPlan.filter(i => i.action === "repurpose").length;

  const queuedCount = queuedRemoval.size;

  // Cluster breakdown — shows the strategic arc of the plan
  const clusterOrder: ContentCluster[] = [
    "core_platform", "role_solutions", "industry_verticals", "topic_guides",
    "services_led", "commercial_education", "proof_and_hubs", "interactive_tools",
  ];
  const clusterCounts: [ContentCluster, number][] = clusterOrder
    .map(c => [c, contentPlan.filter(i => i.cluster === c).length] as [ContentCluster, number])
    .filter(([, n]) => n > 0);

  function actionCol(a: string) {
    if (a === "net_new")   return T.success;
    if (a === "refresh")   return T.info;
    return T.accent;
  }

  function effortCol(e: string) {
    if (e === "low")    return T.success;
    if (e === "medium") return T.accent;
    return T.error;
  }

  // Button label adapts to context — free-text vs removals vs both vs neither.
  // Helps the analyst confirm they understand what will happen.
  const hasFeedback = feedback.trim().length > 0;
  const hasRemovals = queuedCount > 0;
  const ctaLabel = isRefining
    ? "Refining…"
    : hasFeedback && hasRemovals
      ? `⚡ Apply Feedback & Remove ${queuedCount}`
      : hasRemovals
        ? `⚡ Remove ${queuedCount} & Continue`
        : hasFeedback
          ? "⚡ Apply Feedback & Continue"
          : "⚡ Looks Good — Generate ICPs & Narrative";

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.accent, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8 }}>Expert Review</div>
        <h2 style={{ fontSize: 26, fontWeight: 800, color: T.text, margin: "0 0 10px", letterSpacing: "-0.5px" }}>Review before finalising</h2>
        <p style={{ fontSize: 14, color: T.muted, maxWidth: 720, lineHeight: 1.65 }}>
          Click <strong>×</strong> next to any row to queue it for removal, and/or type specific feedback below. Both work together: queued removals are sent to Claude with your feedback as a hint, and everything you don&rsquo;t touch is preserved exactly.
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 14 }}>
        {[
          { label: "Total Items", count: contentPlan.length, color: T.text },
          { label: "Net New",     count: netNew,             color: T.success },
          { label: "Refresh",     count: refresh,            color: T.info },
          { label: "Repurpose",   count: repurpose,          color: T.accent },
        ].map(stat => (
          <div key={stat.label} style={{ ...card(), textAlign: "center", padding: "12px 8px" }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: stat.color }}>{stat.count}</div>
            <div style={{ fontSize: 11, color: T.muted, textTransform: "uppercase", letterSpacing: "0.3px" }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Cluster breakdown */}
      {clusterCounts.length > 0 && (
        <div style={{ ...card(), marginBottom: 14, padding: "12px 16px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Strategic Clusters</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {clusterCounts.map(([c, count]) => (
              <div key={c} style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "5px 11px", borderRadius: 14,
                border: `1px solid ${clusterColor(c)}44`,
                background: clusterColor(c) + "14",
              }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: clusterColor(c) }}>{count}</span>
                <span style={{ fontSize: 12, color: T.text }}>{CLUSTER_LABELS[c]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Queued-for-removal banner — appears above the table when queue is non-empty */}
      {queuedCount > 0 && (
        <div style={{
          background: T.errorBg,
          border: `1px solid ${T.errorBdr}`,
          borderRadius: 8,
          padding: "10px 16px",
          marginBottom: 14,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 14,
        }}>
          <div style={{ fontSize: 13, color: T.error, fontWeight: 600 }}>
            {queuedCount} item{queuedCount > 1 ? "s" : ""} queued for removal
            <span style={{ fontWeight: 400, color: T.muted, marginLeft: 6 }}>
              — nothing is removed until you click Continue.
            </span>
          </div>
          <button
            onClick={clearQueue}
            style={{
              background: T.surface,
              border: `1px solid ${T.errorBdr}`,
              color: T.error,
              padding: "4px 10px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              whiteSpace: "nowrap",
            }}
          >
            Clear queue
          </button>
        </div>
      )}

      {/* Plan table */}
      <div style={{ ...card(), marginBottom: 20, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid " + T.border, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>Content Plan</div>
          <div style={{ fontSize: 12, color: T.muted }}>{displayed.length} of {contentPlan.length} items</div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: T.bg }}>
                {["", "#", "Tier", "Cluster", "Page Title", "URL", "Funnel", "Action", "Effort"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: T.muted, fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.4px", borderBottom: "1px solid " + T.border, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.map((item, idx) => {
                const isQueued = queuedRemoval.has(item.priority);
                // Queued rows get a muted/strikethrough look. Text fields with
                // strikethrough are applied via CSS on the key cells only.
                const rowBg = isQueued
                  ? T.errorBg
                  : idx % 2 === 0 ? T.surface : T.bg;
                const textDecoration = isQueued ? "line-through" : "none";
                const rowOpacity = isQueued ? 0.55 : 1;
                return (
                  <tr key={idx} style={{ background: rowBg, transition: "background 0.12s" }}>
                    {/* Remove / Undo icon column */}
                    <td style={{ padding: "7px 6px 7px 12px", borderBottom: "1px solid " + T.borderLight, width: 32 }}>
                      <button
                        onClick={() => toggleRemoval(item.priority)}
                        title={isQueued ? "Undo removal" : "Remove from final plan"}
                        style={{
                          width: 22, height: 22,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          background: isQueued ? T.success + "22" : "transparent",
                          color: isQueued ? T.success : T.dim,
                          border: `1px solid ${isQueued ? T.success + "55" : T.border}`,
                          borderRadius: 4,
                          cursor: "pointer",
                          fontSize: 12,
                          fontWeight: 700,
                          fontFamily: "inherit",
                          padding: 0,
                          lineHeight: 1,
                          transition: "all 0.12s",
                        }}
                        aria-label={isQueued ? "Undo removal" : "Remove from final plan"}
                      >
                        {isQueued ? "↶" : "×"}
                      </button>
                    </td>
                    <td style={{ padding: "7px 12px", color: T.dim, fontWeight: 700, borderBottom: "1px solid " + T.borderLight, fontSize: 11, opacity: rowOpacity }}>{item.priority}</td>
                    <td style={{ padding: "7px 12px", borderBottom: "1px solid " + T.borderLight, whiteSpace: "nowrap", opacity: rowOpacity }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: item.priorityTier === "P1" ? T.error : item.priorityTier === "P2" ? T.info : T.muted }}>
                        {item.priorityTier || "P2"}
                      </span>
                    </td>
                    <td style={{ padding: "7px 12px", borderBottom: "1px solid " + T.borderLight, whiteSpace: "nowrap", opacity: rowOpacity }}>
                      {item.cluster ? (
                        <span style={{ fontSize: 11, color: clusterColor(item.cluster), fontWeight: 600 }}>
                          {CLUSTER_LABELS[item.cluster]}
                        </span>
                      ) : <span style={{ fontSize: 11, color: T.dim }}>—</span>}
                    </td>
                    <td style={{ padding: "7px 12px", color: T.text, fontWeight: 600, borderBottom: "1px solid " + T.borderLight, maxWidth: 260, opacity: rowOpacity }}>
                      <div title={item.pageTitle} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration }}>{item.pageTitle}</div>
                      {item.targetQuery && <div title={item.targetQuery} style={{ fontSize: 11, color: T.dim, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration }}>{item.targetQuery}</div>}
                    </td>
                    <td style={{ padding: "7px 12px", borderBottom: "1px solid " + T.borderLight, maxWidth: 180, opacity: rowOpacity }}>
                      <div title={item.urlSuggestion} style={{ fontFamily: "monospace", fontSize: 10.5, color: T.info, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration }}>{item.urlSuggestion}</div>
                    </td>
                    <td style={{ padding: "7px 12px", borderBottom: "1px solid " + T.borderLight, whiteSpace: "nowrap", opacity: rowOpacity }}>
                      <span style={badge(T.funnel[item.funnelStage] || T.muted)}>{item.funnelStage}</span>
                    </td>
                    <td style={{ padding: "7px 12px", borderBottom: "1px solid " + T.borderLight, whiteSpace: "nowrap", opacity: rowOpacity }}>
                      <span style={badge(actionCol(item.action))}>{item.action.replace("_", " ")}</span>
                    </td>
                    <td style={{ padding: "7px 12px", borderBottom: "1px solid " + T.borderLight, whiteSpace: "nowrap", opacity: rowOpacity }}>
                      <span style={badge(effortCol(item.estimatedEffort || "medium"))}>{item.estimatedEffort}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {contentPlan.length > 30 && (
          <div style={{ padding: "10px 18px", borderTop: "1px solid " + T.border }}>
            <button onClick={() => setShowAll(!showAll)} style={{ ...btn("ghost"), fontSize: 12.5 }}>
              {showAll ? "Show fewer" : "Show all " + contentPlan.length + " items"}
            </button>
          </div>
        )}
      </div>

      {/* Feedback */}
      <div style={{ ...card(), marginBottom: 20 }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 8 }}>
          Expert Feedback <span style={{ color: T.dim, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>— optional, applied as a delta</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {EXAMPLES.map((ex, i) => (
            <button key={i} onClick={() => setFeedback(f => f ? f + "\n" + ex : ex)}
              style={{ fontSize: 11.5, padding: "4px 10px", borderRadius: 6, border: "1px solid " + T.border, background: T.bg, color: T.muted, cursor: "pointer", fontFamily: "inherit" }}>
              + {ex.length > 60 ? ex.slice(0, 60) + "…" : ex}
            </button>
          ))}
        </div>
        <textarea
          style={{ background: T.surface, border: "1px solid " + T.border, borderRadius: 8, color: T.text, padding: "9px 13px", fontSize: 14, width: "100%", fontFamily: "inherit", height: 120, resize: "vertical", lineHeight: 1.7 }}
          placeholder="e.g. Add role pages for Legal Ops and Sales Ops. The client already has content on /blog/contract-ai-guide — mark similar items as refresh."
          value={feedback}
          onChange={e => setFeedback(e.target.value)}
        />
        {(hasFeedback || hasRemovals) && (
          <div style={{ fontSize: 12, color: T.info, marginTop: 6, lineHeight: 1.6 }}>
            {hasFeedback && hasRemovals && "Free-text feedback is authoritative — if your text contradicts queued removals, the text wins. "}
            Items you don&rsquo;t mention or queue are preserved exactly. Any delta that would remove {'>'}40% of items is rejected automatically — the original plan is kept safe.
          </div>
        )}
      </div>

      {/* CTA */}
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button
          onClick={() => onContinue(feedback, Array.from(queuedRemoval))}
          disabled={isRefining}
          style={{ ...btn("primary"), fontSize: 15, padding: "13px 40px", opacity: isRefining ? 0.5 : 1, cursor: isRefining ? "not-allowed" : "pointer" }}
        >
          {ctaLabel}
        </button>
        {isRefining && <div style={{ fontSize: 13, color: T.muted }}>Applying delta and generating ICPs…</div>}
      </div>
      {(hasFeedback || hasRemovals) && !isRefining && (
        <div style={{ marginTop: 10, fontSize: 12.5, color: T.muted }}>
          Delta merge (~10s) → ICP analysis (4 batches, ~90s) → Strategy narrative (~30s) → ICP narrative (~30s)
        </div>
      )}
    </div>
  );
}
