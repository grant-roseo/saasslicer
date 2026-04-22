"use client";
import { useState } from "react";
import { T, card, badge } from "@/lib/design";
import type { ContentItem, ICP, FunnelStage, ContentAction, ContentCluster, PriorityTier } from "@/lib/types";
import { CLUSTER_LABELS } from "@/lib/types";

function Tag({ label, color }: { label: string; color: string }) {
  return <span style={badge(color)}>{label}</span>;
}

function actionColor(a: ContentAction): string { return T.action[a] || T.muted; }
function funnelColor(f: FunnelStage): string   { return T.funnel[f] || T.muted; }

function tierColor(t?: PriorityTier): string {
  if (t === "P1") return T.error;        // high stakes — red-ish accent
  if (t === "P2") return T.info;
  if (t === "P3") return T.muted;
  return T.muted;
}

function clusterColor(c?: ContentCluster): string {
  // Distinct, legible color per cluster — helps scanning large plans
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

export default function PlanTab({ items, icps }: { items: ContentItem[]; icps: ICP[] }) {
  const [filterFunnel,  setFilterFunnel]  = useState("all");
  const [filterAction,  setFilterAction]  = useState("all");
  const [filterCluster, setFilterCluster] = useState<string>("all");
  const [filterTier,    setFilterTier]    = useState<string>("all");
  const [filterIcp,     setFilterIcp]     = useState("all");
  const [search,        setSearch]        = useState("");
  const [expanded,      setExpanded]      = useState<number | null>(null);

  const clusters = [...new Set(items.map(i => i.cluster).filter(Boolean) as ContentCluster[])];

  const filtered = items.filter(item => {
    if (filterFunnel !== "all" && item.funnelStage !== filterFunnel) return false;
    if (filterAction !== "all" && item.action !== filterAction) return false;
    if (filterCluster !== "all" && item.cluster !== filterCluster) return false;
    if (filterTier !== "all" && item.priorityTier !== filterTier) return false;
    if (filterIcp !== "all" && !(item.icpIds || []).includes(filterIcp)) return false;
    if (search) {
      const s = search.toLowerCase();
      return (item.pageTitle + item.targetQuery + (item.contentType || "") + item.coreAngle + (item.cluster || "")).toLowerCase().includes(s);
    }
    return true;
  });

  const stats: [string, number, string][] = [
    ["P1",        items.filter(i => i.priorityTier === "P1").length,  T.error],
    ["Net New",   items.filter(i => i.action === "net_new").length,   T.success],
    ["Refresh",   items.filter(i => i.action === "refresh").length,   T.info],
    ["Repurpose", items.filter(i => i.action === "repurpose").length, T.accent],
    ["TOFU",      items.filter(i => i.funnelStage === "TOFU").length, T.success],
    ["MOFU",      items.filter(i => i.funnelStage === "MOFU").length, T.accent],
    ["BOFU",      items.filter(i => i.funnelStage === "BOFU").length, T.error],
  ];

  return (
    <div>
      {/* Stat chips */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${stats.length},1fr)`, gap: 10, marginBottom: 14 }}>
        {stats.map(([label, count, color]) => (
          <div key={label} style={{ ...card(), textAlign: "center", padding: "12px 8px" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color }}>{count}</div>
            <div style={{ fontSize: 10.5, color: T.muted, textTransform: "uppercase", letterSpacing: "0.3px" }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Cluster breakdown strip */}
      {clusters.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
          {clusters.map(c => {
            const count = items.filter(i => i.cluster === c).length;
            const active = filterCluster === c;
            return (
              <button key={c}
                onClick={() => setFilterCluster(active ? "all" : c)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 16,
                  border: `1px solid ${active ? clusterColor(c) : T.border}`,
                  background: active ? clusterColor(c) + "22" : T.surface,
                  color: active ? clusterColor(c) : T.muted,
                  fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer",
                  whiteSpace: "nowrap",
                }}>
                {CLUSTER_LABELS[c]} · {count}
              </button>
            );
          })}
          {filterCluster !== "all" && (
            <button onClick={() => setFilterCluster("all")}
              style={{ padding: "6px 10px", borderRadius: 16, border: "1px solid " + T.border, background: T.surface, color: T.dim, fontSize: 12, fontFamily: "inherit", cursor: "pointer" }}>
              ✕ clear
            </button>
          )}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input
          style={{ background: T.surface, border: "1px solid " + T.border, borderRadius: 7, padding: "6px 12px", fontSize: 13, fontFamily: "inherit", width: 220 }}
          placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
        {[
          { value: filterFunnel, setter: setFilterFunnel, opts: ["all", "TOFU", "MOFU", "BOFU"], label: "Funnel" },
          { value: filterAction, setter: setFilterAction, opts: ["all", "net_new", "refresh", "repurpose"], label: "Action" },
          { value: filterTier,   setter: setFilterTier,   opts: ["all", "P1", "P2", "P3"],             label: "Tier" },
        ].map(({ value, setter, opts, label }) => (
          <select key={label}
            style={{ background: T.surface, border: "1px solid " + T.border, borderRadius: 7, padding: "6px 12px", fontSize: 13, fontFamily: "inherit", cursor: "pointer" }}
            value={value} onChange={e => setter(e.target.value)}>
            {opts.map(o => <option key={o} value={o}>{o === "all" ? `All ${label}s` : o.replace(/_/g, " ")}</option>)}
          </select>
        ))}
        {icps.length > 0 && (
          <select
            style={{ background: T.surface, border: "1px solid " + T.border, borderRadius: 7, padding: "6px 12px", fontSize: 13, fontFamily: "inherit", cursor: "pointer" }}
            value={filterIcp} onChange={e => setFilterIcp(e.target.value)}>
            <option value="all">All ICPs</option>
            {icps.map(icp => <option key={icp.id} value={icp.id}>{icp.name}</option>)}
          </select>
        )}
        <span style={{ fontSize: 12.5, color: T.dim, marginLeft: "auto" }}>
          {filtered.length} of {items.length} items
        </span>
      </div>

      {/* Table */}
      <div style={{ ...card(), padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: T.bg }}>
                {["#", "Tier", "Cluster", "Page Title", "URL", "Type", "Funnel", "Action", "ICPs", ""].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 12px", color: T.muted, fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.4px", borderBottom: "1px solid " + T.border, whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, idx) => (
                <>
                  <tr key={idx}
                    style={{ background: idx % 2 === 0 ? T.surface : T.bg, cursor: "pointer", transition: "background 0.1s" }}
                    onClick={() => setExpanded(expanded === idx ? null : idx)}>
                    <td style={{ padding: "9px 12px", color: T.dim, fontWeight: 700, fontSize: 11.5, borderBottom: "1px solid " + T.borderLight }}>{item.priority}</td>
                    <td style={{ padding: "9px 12px", borderBottom: "1px solid " + T.borderLight, whiteSpace: "nowrap" }}>
                      <Tag label={item.priorityTier || "P2"} color={tierColor(item.priorityTier)} />
                    </td>
                    <td style={{ padding: "9px 12px", borderBottom: "1px solid " + T.borderLight, whiteSpace: "nowrap" }}>
                      {item.cluster
                        ? <Tag label={CLUSTER_LABELS[item.cluster]} color={clusterColor(item.cluster)} />
                        : <span style={{ fontSize: 11, color: T.dim }}>—</span>}
                    </td>
                    <td style={{ padding: "9px 12px", borderBottom: "1px solid " + T.borderLight, maxWidth: 280 }}>
                      <div title={item.pageTitle} style={{ fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.pageTitle}</div>
                      {item.coreAngle && <div title={item.coreAngle} style={{ fontSize: 11, color: T.dim, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.coreAngle}</div>}
                    </td>
                    <td style={{ padding: "9px 12px", borderBottom: "1px solid " + T.borderLight, maxWidth: 200 }}>
                      <div title={item.urlSuggestion} style={{ fontFamily: "monospace", fontSize: 10.5, color: T.info, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.urlSuggestion}</div>
                      {item.targetQuery && <div title={item.targetQuery} style={{ fontSize: 10.5, color: T.muted, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.targetQuery}</div>}
                    </td>
                    <td style={{ padding: "9px 12px", borderBottom: "1px solid " + T.borderLight, whiteSpace: "nowrap" }}>
                      <Tag label={(item.pageTypeCategory || item.contentType || "").replace(/_/g, " ")} color={T.purple} />
                    </td>
                    <td style={{ padding: "9px 12px", borderBottom: "1px solid " + T.borderLight, whiteSpace: "nowrap" }}>
                      <Tag label={item.funnelStage} color={funnelColor(item.funnelStage)} />
                    </td>
                    <td style={{ padding: "9px 12px", borderBottom: "1px solid " + T.borderLight, whiteSpace: "nowrap" }}>
                      <Tag label={item.action.replace(/_/g, " ")} color={actionColor(item.action)} />
                    </td>
                    <td style={{ padding: "9px 12px", borderBottom: "1px solid " + T.borderLight }}>
                      {(item.icpIds || []).slice(0, 2).map(id => {
                        const icp = icps.find(i => i.id === id);
                        return icp ? <div key={id} style={{ fontSize: 10.5, color: T.purple, whiteSpace: "nowrap" }}>{icp.role}</div> : null;
                      })}
                      {(item.icpIds || []).length > 2 && <div style={{ fontSize: 10.5, color: T.dim }}>+{item.icpIds.length - 2} more</div>}
                    </td>
                    <td style={{ padding: "9px 12px", borderBottom: "1px solid " + T.borderLight, color: T.dim, fontSize: 12 }}>
                      {expanded === idx ? "▲" : "▼"}
                    </td>
                  </tr>
                  {expanded === idx && (
                    <tr key={idx + "_exp"}>
                      <td colSpan={10} style={{ padding: "14px 18px", background: T.accentBg, borderBottom: "2px solid " + T.accent + "44" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: T.accentDark, textTransform: "uppercase", marginBottom: 4 }}>Reasoning</div>
                            <div style={{ fontSize: 13, color: T.text, lineHeight: 1.65 }}>{item.reasoning}</div>
                            {item.gapAddressed && (
                              <>
                                <div style={{ fontSize: 11, fontWeight: 700, color: T.accentDark, textTransform: "uppercase", marginBottom: 4, marginTop: 14 }}>Gap Addressed</div>
                                <div style={{ fontSize: 13, color: T.text }}>{item.gapAddressed}</div>
                              </>
                            )}
                            {item.sourceMaterial && item.sourceMaterial.action !== "none" && (
                              <>
                                <div style={{ fontSize: 11, fontWeight: 700, color: T.accentDark, textTransform: "uppercase", marginBottom: 4, marginTop: 14 }}>
                                  Source Material <span style={{ fontWeight: 400, color: T.dim }}>— {item.sourceMaterial.action.replace(/_/g, " ")}</span>
                                </div>
                                {(item.sourceMaterial.urls || []).length > 0 && (
                                  <ul style={{ paddingLeft: 16, margin: 0 }}>
                                    {item.sourceMaterial.urls.map((u, i) => (
                                      <li key={i} style={{ fontSize: 12, color: T.info, fontFamily: "monospace", lineHeight: 1.7 }}>{u}</li>
                                    ))}
                                  </ul>
                                )}
                                {item.sourceMaterial.note && (
                                  <div style={{ fontSize: 12.5, color: T.text, marginTop: 6, fontStyle: "italic" }}>{item.sourceMaterial.note}</div>
                                )}
                              </>
                            )}
                          </div>
                          <div>
                            {(item.problemsSolved || []).length > 0 && (
                              <>
                                <div style={{ fontSize: 11, fontWeight: 700, color: T.accentDark, textTransform: "uppercase", marginBottom: 4 }}>Problems Solved</div>
                                <ul style={{ paddingLeft: 16, margin: 0 }}>
                                  {item.problemsSolved.map((p, i) => <li key={i} style={{ fontSize: 13, color: T.text, lineHeight: 1.7 }}>{p}</li>)}
                                </ul>
                              </>
                            )}
                            {(item.icpIds || []).length > 0 && (
                              <>
                                <div style={{ fontSize: 11, fontWeight: 700, color: T.accentDark, textTransform: "uppercase", marginBottom: 4, marginTop: 12 }}>Serves ICPs</div>
                                {item.icpIds.map(id => {
                                  const icp = icps.find(i => i.id === id);
                                  return icp ? <div key={id} style={{ fontSize: 12.5, color: T.purple, marginBottom: 2 }}>• {icp.name}</div> : null;
                                })}
                              </>
                            )}
                            <div style={{ marginTop: 10, fontSize: 12, color: T.dim }}>
                              ~{item.wordCountTarget?.toLocaleString() || "1,200"} words · {item.intent} · effort: {item.estimatedEffort || "medium"}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
