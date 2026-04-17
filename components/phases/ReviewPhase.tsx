"use client";
import { useState } from "react";
import { T, card, btn, badge } from "@/lib/design";
import type { ContentItem } from "@/lib/types";

const EXAMPLES = [
  "Remove card review pages — they exist at /credit-cards/[issuer]/[card]/",
  "Client doesn't serve law firms — remove those items",
  "Add pages for the construction vertical — it was missed",
  "Change comparison pages to refresh — drafts exist",
];

export default function ReviewPhase({
  contentPlan,
  onContinue,
  isRefining,
}: {
  contentPlan: ContentItem[];
  onContinue: (feedback: string) => void;
  isRefining: boolean;
}) {
  const [feedback, setFeedback] = useState("");
  const [showAll, setShowAll]   = useState(false);

  const displayed  = showAll ? contentPlan : contentPlan.slice(0, 25);
  const netNew     = contentPlan.filter(i => i.action === "net_new").length;
  const refresh    = contentPlan.filter(i => i.action === "refresh").length;
  const repurpose  = contentPlan.filter(i => i.action === "repurpose").length;

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

  return (
    <div style={{ maxWidth:960, margin:"0 auto" }}>
      <div style={{ marginBottom:28 }}>
        <div style={{ fontSize:12, fontWeight:700, color:T.accent, textTransform:"uppercase", letterSpacing:"1px", marginBottom:8 }}>Expert Review</div>
        <h2 style={{ fontSize:26, fontWeight:800, color:T.text, margin:"0 0 10px", letterSpacing:"-0.5px" }}>Review before finalising</h2>
        <p style={{ fontSize:14, color:T.muted, maxWidth:660, lineHeight:1.65 }}>
          Review the content plan below. Provide feedback to remove duplicates, flag existing pages, add missed gaps, or adjust priorities — then Claude will revise and generate the ICP analysis and narrative.
        </p>
      </div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:20 }}>
        {[
          { label:"Total Items", count:contentPlan.length, color:T.text },
          { label:"Net New",     count:netNew,             color:T.success },
          { label:"Refresh",     count:refresh,            color:T.info },
          { label:"Repurpose",   count:repurpose,          color:T.accent },
        ].map(stat => (
          <div key={stat.label} style={{ ...card(), textAlign:"center", padding:"12px 8px" }}>
            <div style={{ fontSize:24, fontWeight:800, color:stat.color }}>{stat.count}</div>
            <div style={{ fontSize:11, color:T.muted, textTransform:"uppercase", letterSpacing:"0.3px" }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Plan table */}
      <div style={{ ...card(), marginBottom:20, padding:0, overflow:"hidden" }}>
        <div style={{ padding:"14px 18px", borderBottom:"1px solid "+T.border, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontSize:13.5, fontWeight:700, color:T.text }}>Content Plan</div>
          <div style={{ fontSize:12, color:T.muted }}>{displayed.length} of {contentPlan.length} items</div>
        </div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12.5 }}>
            <thead>
              <tr style={{ background:T.bg }}>
                {["#","Page Title","URL","Funnel","Action","Effort"].map(h => (
                  <th key={h} style={{ textAlign:"left", padding:"8px 12px", color:T.muted, fontWeight:600, fontSize:11, textTransform:"uppercase", letterSpacing:"0.4px", borderBottom:"1px solid "+T.border, whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.map((item, idx) => (
                <tr key={idx} style={{ background: idx % 2 === 0 ? T.surface : T.bg }}>
                  <td style={{ padding:"7px 12px", color:T.dim, fontWeight:700, borderBottom:"1px solid "+T.borderLight, fontSize:11 }}>{item.priority}</td>
                  <td style={{ padding:"7px 12px", color:T.text, fontWeight:600, borderBottom:"1px solid "+T.borderLight, maxWidth:260 }}>
                    <div style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.pageTitle}</div>
                    {item.targetQuery && <div style={{ fontSize:11, color:T.dim, marginTop:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.targetQuery}</div>}
                  </td>
                  <td style={{ padding:"7px 12px", borderBottom:"1px solid "+T.borderLight, maxWidth:180 }}>
                    <div style={{ fontFamily:"monospace", fontSize:10.5, color:T.info, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.urlSuggestion}</div>
                  </td>
                  <td style={{ padding:"7px 12px", borderBottom:"1px solid "+T.borderLight, whiteSpace:"nowrap" }}>
                    <span style={badge(T.funnel[item.funnelStage] || T.muted)}>{item.funnelStage}</span>
                  </td>
                  <td style={{ padding:"7px 12px", borderBottom:"1px solid "+T.borderLight, whiteSpace:"nowrap" }}>
                    <span style={badge(actionCol(item.action))}>{item.action.replace("_"," ")}</span>
                  </td>
                  <td style={{ padding:"7px 12px", borderBottom:"1px solid "+T.borderLight, whiteSpace:"nowrap" }}>
                    <span style={badge(effortCol(item.estimatedEffort || "medium"))}>{item.estimatedEffort}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {contentPlan.length > 25 && (
          <div style={{ padding:"10px 18px", borderTop:"1px solid "+T.border }}>
            <button onClick={() => setShowAll(!showAll)} style={{ ...btn("ghost"), fontSize:12.5 }}>
              {showAll ? "Show fewer" : "Show all "+contentPlan.length+" items"}
            </button>
          </div>
        )}
      </div>

      {/* Feedback */}
      <div style={{ ...card(), marginBottom:20 }}>
        <div style={{ fontSize:11.5, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:"0.6px", marginBottom:8 }}>
          Expert Feedback <span style={{ color:T.dim, fontWeight:400, textTransform:"none", letterSpacing:0 }}>— optional</span>
        </div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:10 }}>
          {EXAMPLES.map((ex, i) => (
            <button key={i} onClick={() => setFeedback(f => f ? f+"\n"+ex : ex)}
              style={{ fontSize:11.5, padding:"4px 10px", borderRadius:6, border:"1px solid "+T.border, background:T.bg, color:T.muted, cursor:"pointer", fontFamily:"inherit" }}>
              + {ex.length > 52 ? ex.slice(0,52)+"…" : ex}
            </button>
          ))}
        </div>
        <textarea
          style={{ background:T.surface, border:"1px solid "+T.border, borderRadius:8, color:T.text, padding:"9px 13px", fontSize:14, width:"100%", fontFamily:"inherit", height:110, resize:"vertical", lineHeight:1.7 }}
          placeholder="e.g. Remove credit card review pages — they exist at /credit-cards/[issuer]/[card]/ so mark those as refresh not net new"
          value={feedback}
          onChange={e => setFeedback(e.target.value)}
        />
        {feedback.trim() && (
          <div style={{ fontSize:12, color:T.info, marginTop:6 }}>
            Claude will revise the plan (~15s), then generate ICPs and both narrative documents.
          </div>
        )}
      </div>

      {/* CTA */}
      <div style={{ display:"flex", gap:12, alignItems:"center" }}>
        <button
          onClick={() => onContinue(feedback)}
          disabled={isRefining}
          style={{ ...btn("primary"), fontSize:15, padding:"13px 40px", opacity:isRefining ? 0.5 : 1, cursor:isRefining ? "not-allowed" : "pointer" }}
        >
          {isRefining ? "Refining…" : feedback.trim() ? "⚡ Apply Feedback & Continue" : "⚡ Looks Good — Generate ICPs & Narrative"}
        </button>
        {isRefining && <div style={{ fontSize:13, color:T.muted }}>Applying feedback and generating ICPs…</div>}
      </div>
      {feedback.trim() && !isRefining && (
        <div style={{ marginTop:10, fontSize:12.5, color:T.muted }}>
          Plan revision (~15s) → ICP analysis (~60s) → Strategy narrative (~30s) → ICP narrative (~30s)
        </div>
      )}
    </div>
  );
}
