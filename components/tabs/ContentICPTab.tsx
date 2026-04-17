"use client";
import { useState } from "react";
import { T, card, badge, btn } from "@/lib/design";
import type { ContentItem, ICP } from "@/lib/types";

function Tag({ label, color }: { label: string; color: string }) {
  return <span style={badge(color)}>{label}</span>;
}

export default function ContentICPTab({
  contentPlan,
  icps,
}: {
  contentPlan: ContentItem[];
  icps: ICP[];
}) {
  const [view, setView] = useState<"by_icp" | "by_funnel">("by_icp");
  const [selectedIcp, setSelectedIcp] = useState<string | null>(null);

  if (!icps.length) {
    return <div style={{ color:T.muted, padding:20 }}>No ICPs generated yet.</div>;
  }

  // Map: ICP id → content items
  const icpContentMap: Record<string, ContentItem[]> = {};
  for (const icp of icps) {
    icpContentMap[icp.id] = contentPlan.filter(c => (c.icpIds||[]).includes(icp.id));
  }

  const unmapped = contentPlan.filter(c => !c.icpIds?.length);

  function actionCol(a: string) {
    if (a === "net_new") return T.success;
    if (a === "refresh") return T.info;
    return T.accent;
  }

  const viewTab: string = view;

  if (view === "by_icp") {
    const displayIcps = selectedIcp ? icps.filter(i => i.id === selectedIcp) : icps;

    return (
      <div>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:10 }}>
          <div style={{ display:"flex", gap:6 }}>
            <button onClick={()=>setView("by_icp")}    style={{ padding:"5px 12px", fontSize:12.5, borderRadius:6, border:`1px solid ${viewTab==="by_icp"?T.accent:T.border}`, background:viewTab==="by_icp"?T.accent:"transparent", color:viewTab==="by_icp"?"#fff":T.muted, cursor:"pointer", fontFamily:"inherit" }}>By ICP</button>
            <button onClick={()=>setView("by_funnel")} style={{ padding:"5px 12px", fontSize:12.5, borderRadius:6, border:`1px solid ${viewTab==="by_funnel"?T.accent:T.border}`, background:viewTab==="by_funnel"?T.accent:"transparent", color:viewTab==="by_funnel"?"#fff":T.muted, cursor:"pointer", fontFamily:"inherit" }}>By Funnel Stage</button>
          </div>
          <select
            style={{ background:T.surface, border:"1px solid "+T.border, borderRadius:7, padding:"7px 10px", fontSize:13, fontFamily:"inherit", cursor:"pointer" }}
            value={selectedIcp || "all"}
            onChange={e => setSelectedIcp(e.target.value === "all" ? null : e.target.value)}
          >
            <option value="all">All ICPs ({icps.length})</option>
            {icps.map(icp => <option key={icp.id} value={icp.id}>{icp.name} ({(icpContentMap[icp.id]||[]).length} items)</option>)}
          </select>
        </div>

        {displayIcps.map(icp => {
          const items = icpContentMap[icp.id] || [];
          const gapColor = icp.gapScore >= 70 ? T.error : icp.gapScore >= 40 ? T.accent : T.success;

          return (
            <div key={icp.id} style={{ ...card(), marginBottom:16 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
                <div>
                  <div style={{ fontSize:15, fontWeight:800, color:T.text, marginBottom:4 }}>{icp.name}</div>
                  <div style={{ fontSize:12.5, color:T.muted }}>{icp.role} · {icp.industry} · {icp.companySizeProfile}</div>
                </div>
                <div style={{ display:"flex", gap:12, flexShrink:0 }}>
                  <div style={{ textAlign:"center" }}>
                    <div style={{ fontSize:16, fontWeight:800, color:gapColor }}>{icp.gapScore}</div>
                    <div style={{ fontSize:10, color:T.dim }}>Gap</div>
                  </div>
                  <div style={{ textAlign:"center" }}>
                    <div style={{ fontSize:16, fontWeight:800, color:T.info }}>{items.length}</div>
                    <div style={{ fontSize:10, color:T.dim }}>Items</div>
                  </div>
                </div>
              </div>

              {items.length === 0 ? (
                <div style={{ fontSize:13, color:T.dim, fontStyle:"italic", padding:"8px 0" }}>No content items mapped to this ICP yet.</div>
              ) : (
                <div>
                  {["TOFU","MOFU","BOFU"].map(stage => {
                    const stageItems = items.filter(i => i.funnelStage === stage);
                    if (!stageItems.length) return null;
                    return (
                      <div key={stage} style={{ marginBottom:10 }}>
                        <div style={{ fontSize:11, fontWeight:700, color:T.funnel[stage as keyof typeof T.funnel]||T.muted, textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:6 }}>
                          {stage}
                        </div>
                        {stageItems.map(item => (
                          <div key={item.priority} style={{ display:"flex", gap:10, alignItems:"baseline", padding:"5px 0", borderBottom:"1px solid "+T.borderLight }}>
                            <span style={{ fontSize:11, color:T.dim, fontWeight:700, width:20, flexShrink:0 }}>#{item.priority}</span>
                            <div style={{ flex:1, minWidth:0 }}>
                              <span style={{ fontSize:13.5, fontWeight:600, color:T.text }}>{item.pageTitle}</span>
                              {item.targetQuery && <span style={{ fontSize:12, color:T.dim, marginLeft:8, fontFamily:"monospace" }}>{item.targetQuery}</span>}
                            </div>
                            <Tag label={item.action.replace("_"," ")} color={actionCol(item.action)} />
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {unmapped.length > 0 && !selectedIcp && (
          <div style={{ ...card(), marginBottom:16, opacity:0.7 }}>
            <div style={{ fontSize:13.5, fontWeight:700, color:T.dim, marginBottom:10 }}>Unassigned ({unmapped.length} items)</div>
            {unmapped.slice(0,5).map(item => (
              <div key={item.priority} style={{ fontSize:13, color:T.dim, padding:"3px 0" }}>
                #{item.priority} {item.pageTitle}
              </div>
            ))}
            {unmapped.length > 5 && <div style={{ fontSize:12, color:T.dim, marginTop:4 }}>+{unmapped.length-5} more</div>}
          </div>
        )}
      </div>
    );
  }

  // By funnel stage view
  return (
    <div>
      <div style={{ display:"flex", gap:6, marginBottom:16 }}>
        <button onClick={()=>setView("by_icp")}    style={{ padding:"5px 12px", fontSize:12.5, borderRadius:6, border:`1px solid ${T.border}`, background:"transparent", color:T.muted, cursor:"pointer", fontFamily:"inherit" }}>By ICP</button>
        <button onClick={()=>setView("by_funnel")} style={{ padding:"5px 12px", fontSize:12.5, borderRadius:6, border:`1px solid ${T.accent}`, background:T.accent, color:"#fff", cursor:"pointer", fontFamily:"inherit" }}>By Funnel Stage</button>
      </div>
      {["TOFU","MOFU","BOFU"].map(stage => {
        const stageItems = contentPlan.filter(i => i.funnelStage === stage);
        const stageCol = T.funnel[stage as keyof typeof T.funnel] || T.muted;
        return (
          <div key={stage} style={{ ...card(), marginBottom:16, borderTop:`3px solid ${stageCol}` }}>
            <div style={{ fontSize:14, fontWeight:800, color:stageCol, marginBottom:14 }}>{stage} — {stageItems.length} items</div>
            {stageItems.map(item => (
              <div key={item.priority} style={{ display:"flex", gap:10, alignItems:"baseline", padding:"6px 0", borderBottom:"1px solid "+T.borderLight }}>
                <span style={{ fontSize:11, color:T.dim, fontWeight:700, width:22, flexShrink:0 }}>#{item.priority}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13.5, fontWeight:600, color:T.text }}>{item.pageTitle}</div>
                  {(item.icpIds||[]).length > 0 && (
                    <div style={{ display:"flex", gap:4, marginTop:3, flexWrap:"wrap" }}>
                      {item.icpIds.map(id => {
                        const icp = icps.find(i => i.id === id);
                        return icp ? <Tag key={id} label={icp.name.split(" ").slice(0,3).join(" ")} color={T.purple} /> : null;
                      })}
                    </div>
                  )}
                </div>
                <Tag label={item.action.replace("_"," ")} color={actionCol(item.action)} />
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
