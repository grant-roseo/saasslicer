"use client";
import { useState } from "react";
import { T, card, badge, btn } from "@/lib/design";
import type { ICPAnalysis, ICP } from "@/lib/types";

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
      <div style={{ flex:1, height:5, background:T.borderLight, borderRadius:3, overflow:"hidden" }}>
        <div style={{ height:"100%", width:value+"%", background:color, borderRadius:3, transition:"width 0.6s" }} />
      </div>
      <span style={{ fontSize:12, fontWeight:700, color, width:28, textAlign:"right" }}>{value}</span>
    </div>
  );
}

function Tag({ label, color }: { label: string; color: string }) {
  return <span style={{ ...badge(color), margin:"2px 3px 2px 0" }}>{label}</span>;
}

function ICPCard({ icp, expanded, onToggle }: { icp: ICP; expanded: boolean; onToggle: () => void }) {
  const coverageColor = icp.clientCoverageScore >= 60 ? T.success : icp.clientCoverageScore >= 30 ? T.accent : T.error;
  const gapColor      = icp.gapScore >= 70 ? T.error : icp.gapScore >= 40 ? T.accent : T.success;

  return (
    <div style={{ ...card(), marginBottom:12, borderLeft:`3px solid ${gapColor}` }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", cursor:"pointer" }} onClick={onToggle}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
            <div style={{ fontSize:15, fontWeight:800, color:T.text }}>{icp.name}</div>
            {icp.sourceCompetitor && icp.sourceCompetitor !== "inferred" && (
              <span style={badge(T.purple)}>from {icp.sourceCompetitor}</span>
            )}
          </div>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap", fontSize:12.5, color:T.muted }}>
            <span>📋 {icp.role}</span>
            <span>🏢 {icp.industry}</span>
            <span>📏 {icp.companySizeProfile}</span>
          </div>
        </div>
        <div style={{ display:"flex", gap:16, marginLeft:16, flexShrink:0 }}>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:11, color:T.muted, marginBottom:4 }}>Client Coverage</div>
            <div style={{ fontSize:18, fontWeight:800, color:coverageColor }}>{icp.clientCoverageScore}%</div>
          </div>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:11, color:T.muted, marginBottom:4 }}>Gap Score</div>
            <div style={{ fontSize:18, fontWeight:800, color:gapColor }}>{icp.gapScore}</div>
          </div>
          <div style={{ fontSize:18, color:T.dim, alignSelf:"center" }}>{expanded ? "▲" : "▼"}</div>
        </div>
      </div>

      {/* Preview: top 2 pains */}
      {!expanded && icp.primaryPains?.length > 0 && (
        <div style={{ marginTop:10, fontSize:12.5, color:T.muted, lineHeight:1.6 }}>
          {icp.primaryPains.slice(0,2).map((p,i) => <span key={i}>• {p} </span>)}
        </div>
      )}

      {expanded && (
        <div style={{ marginTop:16, paddingTop:16, borderTop:"1px solid "+T.borderLight }}>
          {/* Score bars */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:20 }}>
            <div>
              <div style={{ fontSize:11, color:T.muted, textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:6 }}>Client Coverage</div>
              <ScoreBar value={icp.clientCoverageScore} color={coverageColor} />
            </div>
            <div>
              <div style={{ fontSize:11, color:T.muted, textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:6 }}>Priority</div>
              <ScoreBar value={icp.priorityScore} color={T.info} />
            </div>
            <div>
              <div style={{ fontSize:11, color:T.muted, textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:6 }}>Gap Score</div>
              <ScoreBar value={icp.gapScore} color={gapColor} />
            </div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
            {/* Pains */}
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:T.error, textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:8 }}>Primary Pains</div>
              {(icp.primaryPains||[]).map((p,i) => <div key={i} style={{ fontSize:13, color:T.muted, padding:"3px 0", borderBottom:"1px solid "+T.borderLight }}>• {p}</div>)}
              {(icp.secondaryPains||[]).length > 0 && (
                <>
                  <div style={{ fontSize:11, fontWeight:700, color:T.accent, textTransform:"uppercase", letterSpacing:"0.5px", marginTop:10, marginBottom:6 }}>Secondary Pains</div>
                  {icp.secondaryPains.map((p,i) => <div key={i} style={{ fontSize:12.5, color:T.muted, padding:"2px 0" }}>• {p}</div>)}
                </>
              )}
            </div>

            {/* JTBD */}
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:T.success, textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:8 }}>Jobs to be Done</div>
              {(icp.jobsToBeDone||[]).map((j,i) => <div key={i} style={{ fontSize:13, color:T.muted, padding:"3px 0", borderBottom:"1px solid "+T.borderLight }}>• {j}</div>)}
            </div>

            {/* Search queries */}
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:T.info, textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:8 }}>🔍 Search Queries</div>
              <div style={{ display:"flex", flexWrap:"wrap" }}>
                {(icp.searchQueries||[]).map((q,i) => <Tag key={i} label={q} color={T.info} />)}
              </div>
            </div>

            {/* AI prompts */}
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:T.purple, textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:8 }}>🤖 AI Prompts</div>
              <div style={{ display:"flex", flexWrap:"wrap" }}>
                {(icp.aiPrompts||[]).map((p,i) => <Tag key={i} label={p} color={T.purple} />)}
              </div>
            </div>
          </div>

          {/* Content needs by funnel */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginTop:16 }}>
            {[
              { label:"TOFU — Awareness", items:icp.tofuContentNeeds||[], color:T.success },
              { label:"MOFU — Consideration", items:icp.mofuContentNeeds||[], color:T.accent },
              { label:"BOFU — Decision", items:icp.bofuContentNeeds||[], color:T.error },
            ].map(stage => (
              <div key={stage.label} style={{ background:T.bg, borderRadius:8, padding:"12px 14px", border:"1px solid "+T.borderLight }}>
                <div style={{ fontSize:11, fontWeight:700, color:stage.color, textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:8 }}>{stage.label}</div>
                {stage.items.map((item,i) => <div key={i} style={{ fontSize:12.5, color:T.muted, padding:"2px 0" }}>• {item}</div>)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ICPTab({
  icpAnalysis,
  clientName,
}: {
  icpAnalysis: ICPAnalysis | null;
  clientName: string;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"gap" | "priority" | "coverage">("gap");

  if (!icpAnalysis?.icps?.length) {
    return <div style={{ color:T.muted, padding:20 }}>No ICP analysis generated yet.</div>;
  }

  const sorted = [...icpAnalysis.icps].sort((a,b) => {
    if (sortBy === "gap")      return b.gapScore - a.gapScore;
    if (sortBy === "priority") return b.priorityScore - a.priorityScore;
    return a.clientCoverageScore - b.clientCoverageScore;
  });

  const avgGap = Math.round(icpAnalysis.icps.reduce((s,i) => s+i.gapScore,0) / icpAnalysis.icps.length);
  const avgCov = Math.round(icpAnalysis.icps.reduce((s,i) => s+i.clientCoverageScore,0) / icpAnalysis.icps.length);
  const industries = new Set(icpAnalysis.icps.map(i => i.industry));

  return (
    <div>
      {/* Summary */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 }}>
        {[
          { label:"Total ICPs",        value:icpAnalysis.icps.length,     color:T.text },
          { label:"Industries",        value:industries.size,             color:T.purple },
          { label:"Avg Gap Score",     value:avgGap+"/100",              color:T.error },
          { label:"Avg Client Coverage",value:avgCov+"%",                color:avgCov<30?T.error:avgCov<60?T.accent:T.success },
        ].map(s => (
          <div key={s.label} style={{ ...card(), textAlign:"center", padding:"14px 10px" }}>
            <div style={{ fontSize:24, fontWeight:800, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:11, color:T.muted, textTransform:"uppercase", letterSpacing:"0.3px" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {icpAnalysis.narrativeSummary && (
        <div style={{ ...card(), marginBottom:20, background:T.infoBg, borderColor:T.infoBdr, padding:"12px 16px" }}>
          <div style={{ fontSize:13.5, color:T.info }}>{icpAnalysis.narrativeSummary}</div>
        </div>
      )}

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <div style={{ fontSize:13, color:T.muted }}>{icpAnalysis.icps.length} ICPs identified for {clientName}</div>
        <div style={{ display:"flex", gap:6, alignItems:"center" }}>
          <span style={{ fontSize:12, color:T.muted }}>Sort:</span>
          {[
            { id:"gap" as const,      label:"Gap Score" },
            { id:"priority" as const, label:"Priority" },
            { id:"coverage" as const, label:"Least Covered" },
          ].map(opt => (
            <button key={opt.id} onClick={() => setSortBy(opt.id)}
              style={{ padding:"4px 10px", fontSize:12, borderRadius:6, border:"1px solid "+(sortBy===opt.id?T.accent:T.border), background:sortBy===opt.id?T.accent:"transparent", color:sortBy===opt.id?"#fff":T.muted, cursor:"pointer", fontFamily:"inherit" }}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {sorted.map(icp => (
        <ICPCard
          key={icp.id}
          icp={icp}
          expanded={expanded === icp.id}
          onToggle={() => setExpanded(expanded === icp.id ? null : icp.id)}
        />
      ))}
    </div>
  );
}
