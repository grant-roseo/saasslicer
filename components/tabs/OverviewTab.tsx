"use client";
import { useState } from "react";
import { T, card, badge, btn } from "@/lib/design";
import type { SiteAnalysis, GapAnalysis, ContentItem, ICP } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/cluster";

// ─── Shared small components ──────────────────────────────────────────────────
function Tag({ label, color }: { label: string; color: string }) {
  return <span style={badge(color)}>{label}</span>;
}

// ─── OverviewTab ──────────────────────────────────────────────────────────────
export function OverviewTab({ siteAnalyses }: { siteAnalyses: Record<string, SiteAnalysis> }) {
  const sites = Object.values(siteAnalyses);
  const client = sites.find(s => s.isClient);
  const comps  = sites.filter(s => !s.isClient);

  // Build category × site matrix
  const allCats = [...new Set(sites.flatMap(s => s.clusters.map(c => c.categoryType)))];

  return (
    <div>
      {/* Site cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:14, marginBottom:28 }}>
        {sites.map(s => (
          <div key={s.siteId} style={{ ...card(), borderTop:`3px solid ${s.isClient ? T.accent : T.purple}` }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
              <div style={{ fontWeight:800, fontSize:14, color:T.text }}>{s.siteName}</div>
              <Tag label={s.isClient?"Client":"Competitor"} color={s.isClient?T.accent:T.purple} />
            </div>
            <div style={{ fontSize:12.5, color:T.muted, marginBottom:10, lineHeight:1.6 }}>{s.contentStrategySum}</div>
            <div style={{ display:"flex", gap:16, fontSize:12 }}>
              <span style={{ color:T.text, fontWeight:700 }}>{s.totalUrls.toLocaleString()}</span>
              <span style={{ color:T.muted }}>URLs</span>
              <span style={{ color:T.text, fontWeight:700 }}>{s.clusters.length}</span>
              <span style={{ color:T.muted }}>categories</span>
            </div>
            {s.strengths.length > 0 && (
              <div style={{ marginTop:10, fontSize:12, color:T.success }}>
                ✓ {s.strengths.slice(0,2).join(" · ")}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Category matrix */}
      {allCats.length > 0 && (
        <div style={{ ...card(), padding:0, overflow:"hidden", marginBottom:20 }}>
          <div style={{ padding:"12px 16px", borderBottom:"1px solid "+T.border, fontWeight:700, fontSize:13.5, color:T.text }}>
            Content Category Matrix
          </div>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12.5 }}>
              <thead>
                <tr style={{ background:T.bg }}>
                  <th style={{ textAlign:"left", padding:"8px 14px", borderBottom:"1px solid "+T.border, color:T.muted, fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.4px" }}>Category</th>
                  {sites.map(s => (
                    <th key={s.siteId} style={{ textAlign:"center", padding:"8px 14px", borderBottom:"1px solid "+T.border, color:s.isClient?T.accent:T.purple, fontSize:11, fontWeight:700, whiteSpace:"nowrap" }}>
                      {s.siteName.slice(0,18)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allCats.map((cat, i) => (
                  <tr key={cat} style={{ background: i%2===0 ? T.surface : T.bg }}>
                    <td style={{ padding:"8px 14px", borderBottom:"1px solid "+T.borderLight, color:T.text, fontWeight:600, fontSize:12.5 }}>
                      {CATEGORY_LABELS[cat] || cat}
                    </td>
                    {sites.map(s => {
                      const cluster = s.clusters.find(c => c.categoryType === cat);
                      return (
                        <td key={s.siteId} style={{ padding:"8px 14px", textAlign:"center", borderBottom:"1px solid "+T.borderLight }}>
                          {cluster ? (
                            <div>
                              <div style={{ fontSize:14, fontWeight:700, color:s.isClient?T.accent:T.text }}>{cluster.urls.length}</div>
                              <div style={{ fontSize:10, color:T.dim }}>pages</div>
                            </div>
                          ) : (
                            <div style={{ color:T.dim, fontSize:16 }}>—</div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── GapTab ───────────────────────────────────────────────────────────────────
export function GapTab({ gapAnalysis }: { gapAnalysis: GapAnalysis | null }) {
  const [filter, setFilter] = useState("all");
  if (!gapAnalysis) return <div style={{ color:T.muted, padding:20 }}>No gap analysis yet.</div>;

  const { gaps } = gapAnalysis;
  const filtered = filter === "all" ? gaps : gaps.filter(g => g.priority === filter);
  const counts: Record<string, number> = { all: gaps.length, critical:0, high:0, medium:0, low:0 };
  for (const g of gaps) { if (g.priority in counts) counts[g.priority]++; }

  return (
    <div>
      {gapAnalysis.narrative && (
        <div style={{ ...card(), marginBottom:20, background:T.infoBg, borderColor:T.infoBdr }}>
          <div style={{ fontSize:13.5, color:T.info, lineHeight:1.7 }}>{gapAnalysis.narrative}</div>
        </div>
      )}

      <div style={{ display:"flex", gap:6, marginBottom:16, flexWrap:"wrap" }}>
        {["all","critical","high","medium","low"].map(p => {
          const col = p === "all" ? T.muted : T.priority[p as keyof typeof T.priority] || T.muted;
          const active = filter === p;
          return (
            <button key={p} onClick={() => setFilter(p)}
              style={{ padding:"5px 14px", fontSize:12.5, borderRadius:7, border:`1.5px solid ${active?col:T.border}`, background:active?col:"transparent", color:active?"#fff":T.muted, cursor:"pointer", fontFamily:"inherit", fontWeight:600, transition:"all 0.15s" }}>
              {p.charAt(0).toUpperCase()+p.slice(1)} ({counts[p]||0})
            </button>
          );
        })}
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {filtered.map(gap => {
          const col = T.priority[gap.priority as keyof typeof T.priority] || T.muted;
          return (
            <div key={gap.id} style={{ ...card(), borderLeft:`3px solid ${col}`, padding:"14px 18px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
                <div style={{ fontSize:14, fontWeight:700, color:T.text, flex:1, marginRight:12 }}>{gap.title}</div>
                <div style={{ display:"flex", gap:5, flexShrink:0 }}>
                  <Tag label={gap.priority} color={col} />
                  <Tag label={gap.funnelStage} color={T.funnel[gap.funnelStage]||T.muted} />
                </div>
              </div>
              <p style={{ fontSize:13.5, color:T.muted, margin:"0 0 10px", lineHeight:1.65 }}>{gap.description}</p>
              <div style={{ background:T.accentBg, borderRadius:7, padding:"8px 12px", marginBottom:8, border:"1px solid "+T.accent+"33" }}>
                <span style={{ fontSize:11, fontWeight:700, color:T.accentDark, textTransform:"uppercase", letterSpacing:"0.4px" }}>Action: </span>
                <span style={{ fontSize:13.5, color:T.text }}>{gap.opportunity}</span>
              </div>
              <div style={{ fontSize:12, color:T.dim, display:"flex", gap:16, flexWrap:"wrap" }}>
                <span>~{gap.estimatedPages} pages</span>
                <span>{(gap.gapType||"").replace(/_/g," ")}</span>
                {gap.competitorsDoing?.length > 0 && <span>Competitors: {gap.competitorsDoing.join(", ")}</span>}
                {gap.icpRelevance?.length > 0 && <span style={{ color:T.purple }}>ICPs: {gap.icpRelevance.join(", ")}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── PlanTab ──────────────────────────────────────────────────────────────────
export function PlanTab({ items, icps }: { items: ContentItem[]; icps: ICP[] }) {
  const [filterType,   setFilterType]   = useState("all");
  const [filterFunnel, setFilterFunnel] = useState("all");
  const [filterAction, setFilterAction] = useState("all");
  const [search,       setSearch]       = useState("");
  const [expanded,     setExpanded]     = useState<number|null>(null);

  const types = [...new Set(items.map(i => i.contentType).filter(Boolean))];
  const filtered = items.filter(item => {
    if (filterType   !== "all" && item.contentType  !== filterType)   return false;
    if (filterFunnel !== "all" && item.funnelStage   !== filterFunnel) return false;
    if (filterAction !== "all" && item.action        !== filterAction) return false;
    if (search) {
      const s = search.toLowerCase();
      return (item.pageTitle+item.targetQuery+(item.contentType||"")).toLowerCase().includes(s);
    }
    return true;
  });

  const stats: { label:string; count:number; color:string }[] = [
    { label:"Net New",   count:items.filter(i=>i.action==="net_new").length,   color:T.success },
    { label:"Refresh",   count:items.filter(i=>i.action==="refresh").length,   color:T.info    },
    { label:"Repurpose", count:items.filter(i=>i.action==="repurpose").length, color:T.accent  },
    { label:"TOFU",      count:items.filter(i=>i.funnelStage==="TOFU").length, color:T.success },
    { label:"MOFU",      count:items.filter(i=>i.funnelStage==="MOFU").length, color:T.accent  },
    { label:"BOFU",      count:items.filter(i=>i.funnelStage==="BOFU").length, color:T.error   },
  ];

  function icpName(id: string) {
    return icps.find(i => i.id === id)?.name || id;
  }

  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:10, marginBottom:16 }}>
        {stats.map(s => (
          <div key={s.label} style={{ ...card(), textAlign:"center", padding:"12px 8px" }}>
            <div style={{ fontSize:22, fontWeight:800, color:s.color }}>{s.count}</div>
            <div style={{ fontSize:10.5, color:T.muted, textTransform:"uppercase", letterSpacing:"0.3px" }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap", alignItems:"center" }}>
        <input style={{ background:T.surface, border:"1px solid "+T.border, borderRadius:7, padding:"7px 12px", fontSize:13.5, fontFamily:"inherit", maxWidth:200 }} placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)} />
        <select style={{ background:T.surface, border:"1px solid "+T.border, borderRadius:7, padding:"7px 10px", fontSize:13, fontFamily:"inherit", cursor:"pointer" }} value={filterType} onChange={e=>setFilterType(e.target.value)}>
          <option value="all">All types ({items.length})</option>
          {types.map(t=><option key={t} value={t}>{t} ({items.filter(i=>i.contentType===t).length})</option>)}
        </select>
        <select style={{ background:T.surface, border:"1px solid "+T.border, borderRadius:7, padding:"7px 10px", fontSize:13, fontFamily:"inherit", cursor:"pointer" }} value={filterFunnel} onChange={e=>setFilterFunnel(e.target.value)}>
          <option value="all">All funnel</option>
          {["TOFU","MOFU","BOFU","Mixed"].map(f=><option key={f} value={f}>{f}</option>)}
        </select>
        <select style={{ background:T.surface, border:"1px solid "+T.border, borderRadius:7, padding:"7px 10px", fontSize:13, fontFamily:"inherit", cursor:"pointer" }} value={filterAction} onChange={e=>setFilterAction(e.target.value)}>
          <option value="all">All actions</option>
          {["net_new","refresh","repurpose"].map(a=><option key={a} value={a}>{a}</option>)}
        </select>
        <div style={{ fontSize:12.5, color:T.muted, marginLeft:"auto" }}>{filtered.length} items</div>
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {filtered.map((item) => (
          <div key={item.priority} style={{ ...card(), padding:"12px 16px", cursor:"pointer" }} onClick={() => setExpanded(expanded === item.priority ? null : item.priority)}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div style={{ display:"flex", gap:10, alignItems:"baseline", flex:1, minWidth:0, marginRight:10 }}>
                <span style={{ fontSize:11, fontWeight:700, color:T.dim, flexShrink:0 }}>#{item.priority}</span>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:T.text }}>{item.pageTitle}</div>
                  {item.targetQuery && <div style={{ fontSize:12, color:T.dim, fontFamily:"monospace" }}>{item.targetQuery}</div>}
                </div>
              </div>
              <div style={{ display:"flex", gap:5, flexShrink:0, flexWrap:"wrap", justifyContent:"flex-end" }}>
                <Tag label={item.funnelStage}    color={T.funnel[item.funnelStage]||T.muted} />
                <Tag label={item.action.replace("_"," ")} color={T.action[item.action]||T.muted} />
                <Tag label={item.estimatedEffort||"medium"} color={item.estimatedEffort==="low"?T.success:item.estimatedEffort==="high"?T.error:T.accent} />
              </div>
            </div>

            {expanded === item.priority && (
              <div style={{ marginTop:14, paddingTop:12, borderTop:"1px solid "+T.borderLight }}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                  <div>
                    <div style={{ fontSize:11, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:4 }}>Core Angle</div>
                    <div style={{ fontSize:13.5, color:T.text }}>{item.coreAngle}</div>
                  </div>
                  <div>
                    <div style={{ fontSize:11, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:4 }}>Reasoning</div>
                    <div style={{ fontSize:13.5, color:T.muted }}>{item.reasoning}</div>
                  </div>
                  <div>
                    <div style={{ fontSize:11, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:4 }}>URL</div>
                    <div style={{ fontSize:13, color:T.info, fontFamily:"monospace" }}>{item.urlSuggestion}</div>
                  </div>
                  <div>
                    <div style={{ fontSize:11, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:4 }}>Gap Addressed</div>
                    <div style={{ fontSize:13.5, color:T.muted }}>{item.gapAddressed}</div>
                  </div>
                </div>
                {(item.icpIds||[]).length > 0 && (
                  <div style={{ marginTop:10 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:6 }}>Serves ICPs</div>
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                      {item.icpIds.map(id => <Tag key={id} label={icpName(id)} color={T.purple} />)}
                    </div>
                  </div>
                )}
                {(item.problemsSolved||[]).length > 0 && (
                  <div style={{ marginTop:10 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:6 }}>Problems Solved</div>
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                      {item.problemsSolved.map((p,i) => <Tag key={i} label={p} color={T.teal} />)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default OverviewTab;
