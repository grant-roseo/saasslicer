"use client";
import { useState } from "react";
import { T, card, badge, btn } from "@/lib/design";
import type { ContentItem, ICP, FunnelStage, ContentAction } from "@/lib/types";

function Tag({ label, color }: { label: string; color: string }) {
  return <span style={badge(color)}>{label}</span>;
}

function actionColor(a: ContentAction): string { return T.action[a] || T.muted; }
function funnelColor(f: FunnelStage): string   { return T.funnel[f] || T.muted; }

export default function PlanTab({ items, icps }: { items: ContentItem[]; icps: ICP[] }) {
  const [filterFunnel, setFilterFunnel]   = useState("all");
  const [filterAction, setFilterAction]   = useState("all");
  const [filterType,   setFilterType]     = useState("all");
  const [filterIcp,    setFilterIcp]      = useState("all");
  const [search,       setSearch]         = useState("");
  const [expanded,     setExpanded]       = useState<number | null>(null);

  const types = [...new Set(items.map(i => i.contentType).filter(Boolean))];

  const filtered = items.filter(item => {
    if (filterFunnel !== "all" && item.funnelStage !== filterFunnel) return false;
    if (filterAction !== "all" && item.action !== filterAction) return false;
    if (filterType   !== "all" && item.contentType !== filterType) return false;
    if (filterIcp    !== "all" && !(item.icpIds || []).includes(filterIcp)) return false;
    if (search) {
      const s = search.toLowerCase();
      return (item.pageTitle + item.targetQuery + (item.contentType || "") + item.coreAngle).toLowerCase().includes(s);
    }
    return true;
  });

  const stats: [string, number, string][] = [
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 10, marginBottom: 20 }}>
        {stats.map(([label, count, color]) => (
          <div key={label} style={{ ...card(), textAlign: "center", padding: "12px 8px" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color }}>{count}</div>
            <div style={{ fontSize: 10.5, color: T.muted, textTransform: "uppercase", letterSpacing: "0.3px" }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input
          style={{ background: T.surface, border: "1px solid " + T.border, borderRadius: 7, padding: "6px 12px", fontSize: 13, fontFamily: "inherit", width: 220 }}
          placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
        {[
          { value: filterFunnel, setter: setFilterFunnel, opts: ["all", "TOFU", "MOFU", "BOFU"], label: "Funnel" },
          { value: filterAction, setter: setFilterAction, opts: ["all", "net_new", "refresh", "repurpose"], label: "Action" },
        ].map(({ value, setter, opts, label }) => (
          <select key={label}
            style={{ background: T.surface, border: "1px solid " + T.border, borderRadius: 7, padding: "6px 12px", fontSize: 13, fontFamily: "inherit", cursor: "pointer" }}
            value={value} onChange={e => setter(e.target.value)}>
            {opts.map(o => <option key={o} value={o}>{o === "all" ? `All ${label}s` : o.replace(/_/g, " ")}</option>)}
          </select>
        ))}
        {types.length > 0 && (
          <select
            style={{ background: T.surface, border: "1px solid " + T.border, borderRadius: 7, padding: "6px 12px", fontSize: 13, fontFamily: "inherit", cursor: "pointer" }}
            value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="all">All types ({items.length})</option>
            {types.map(t => <option key={t} value={t}>{t} ({items.filter(i => i.contentType === t).length})</option>)}
          </select>
        )}
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
                {["#", "Page Title", "URL", "Query", "Type", "Funnel", "Action", "Effort", "ICPs", ""].map(h => (
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
                    <td style={{ padding: "9px 12px", borderBottom: "1px solid " + T.borderLight, maxWidth: 260 }}>
                      <div style={{ fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.pageTitle}</div>
                      {item.coreAngle && <div style={{ fontSize: 11, color: T.dim, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.coreAngle}</div>}
                    </td>
                    <td style={{ padding: "9px 12px", borderBottom: "1px solid " + T.borderLight, maxWidth: 180 }}>
                      <div style={{ fontFamily: "monospace", fontSize: 10.5, color: T.info, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.urlSuggestion}</div>
                    </td>
                    <td style={{ padding: "9px 12px", borderBottom: "1px solid " + T.borderLight, maxWidth: 200 }}>
                      <div style={{ fontSize: 12, color: T.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.targetQuery}</div>
                    </td>
                    <td style={{ padding: "9px 12px", borderBottom: "1px solid " + T.borderLight, whiteSpace: "nowrap" }}>
                      <Tag label={(item.contentType || "").replace(/_/g, " ")} color={T.purple} />
                    </td>
                    <td style={{ padding: "9px 12px", borderBottom: "1px solid " + T.borderLight, whiteSpace: "nowrap" }}>
                      <Tag label={item.funnelStage} color={funnelColor(item.funnelStage)} />
                    </td>
                    <td style={{ padding: "9px 12px", borderBottom: "1px solid " + T.borderLight, whiteSpace: "nowrap" }}>
                      <Tag label={item.action.replace(/_/g, " ")} color={actionColor(item.action)} />
                    </td>
                    <td style={{ padding: "9px 12px", borderBottom: "1px solid " + T.borderLight, whiteSpace: "nowrap" }}>
                      <Tag label={item.estimatedEffort || "medium"} color={item.estimatedEffort === "low" ? T.success : item.estimatedEffort === "medium" ? T.accent : T.error} />
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
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: T.accentDark, textTransform: "uppercase", marginBottom: 4 }}>Reasoning</div>
                            <div style={{ fontSize: 13, color: T.text, lineHeight: 1.65 }}>{item.reasoning}</div>
                            {item.gapAddressed && (
                              <>
                                <div style={{ fontSize: 11, fontWeight: 700, color: T.accentDark, textTransform: "uppercase", marginBottom: 4, marginTop: 12 }}>Gap Addressed</div>
                                <div style={{ fontSize: 13, color: T.text }}>{item.gapAddressed}</div>
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
                              ~{item.wordCountTarget?.toLocaleString() || "1,200"} words · {item.intent}
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

