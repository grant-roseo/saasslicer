"use client";
import { useState, useEffect, useRef } from "react";
import { T } from "@/lib/design";
import type { LogEntry } from "@/lib/types";
import type { SubPhase } from "../SlicerApp";

const STEPS: { key: SubPhase; label: string }[] = [
  { key: "cluster",   label: "Cluster" },
  { key: "crawl",     label: "Crawl" },
  { key: "analyze",   label: "Analyze" },
  { key: "gap",       label: "Gaps" },
  { key: "plan",      label: "Plan" },
  { key: "icp",       label: "ICPs" },
  { key: "narrative", label: "Narrative" },
];

const MESSAGES: Record<SubPhase, string[]> = {
  cluster:   ["Tokenizing URL slugs into topic clusters…", "Classifying pages by category and intent…", "Sorting clusters by strategic priority…"],
  crawl:     ["Fetching page titles and meta descriptions…", "Sampling representative pages per category…", "Scoring confidence on category alignment…", "Extending crawl for low-confidence clusters…"],
  analyze:   ["Reading URL patterns and content architecture…", "Identifying funnel stages and search intent…", "Mapping content strategy from enriched page data…"],
  gap:       ["Comparing client content vs competitors…", "Identifying missing verticals and page types…", "Scoring gaps by priority and opportunity…"],
  plan:      ["Generating priority content recommendations…", "Assigning funnel stages and target queries…", "Mapping content items to strategic gaps…"],
  icp:       ["Identifying ICPs from competitor content patterns…", "Mapping jobs-to-be-done and pain points…", "Generating search queries and AI prompts per ICP…", "Scoring client coverage gaps by audience…"],
  narrative: ["Writing strategic playbook narrative…", "Structuring ICP-focused content strategy…", "Finalising recommendations and priority sequence…"],
};

function ProgressBar({ value }: { value: number }) {
  return (
    <div style={{ height:6, background:T.borderLight, borderRadius:6, overflow:"hidden" }}>
      <div style={{ height:"100%", width:`${Math.min(100,value)}%`, background:`linear-gradient(90deg,${T.accent},${T.accentDark})`, borderRadius:6, transition:"width 0.6s ease" }} />
    </div>
  );
}

export default function AnalysisPhase({
  log, phase, progress,
}: {
  log: LogEntry[];
  phase: SubPhase;
  progress: number;
}) {
  const logRef   = useRef<HTMLDivElement>(null);
  const startRef = useRef<number>(Date.now());

  const [elapsed, setElapsed] = useState(0);
  const [msgIdx,  setMsgIdx]  = useState(0);

  useEffect(() => {
    startRef.current = Date.now();
    setElapsed(0);
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setMsgIdx(0);
    const msgs = MESSAGES[phase] || [];
    if (msgs.length < 2) return;
    const id = setInterval(() => setMsgIdx(i => (i + 1) % msgs.length), 4000);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  const mins = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const secs = String(elapsed % 60).padStart(2, "0");
  const cur  = STEPS.findIndex(s => s.key === phase);
  const currentMsg = (MESSAGES[phase] || [])[msgIdx] || "";

  return (
    <div style={{ maxWidth: 700, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
        <h2 style={{ fontSize:22, fontWeight:800, color:T.text, margin:0 }}>Running analysis…</h2>
        <div style={{ textAlign:"right", flexShrink:0 }}>
          <div style={{ fontSize:22, fontWeight:800, color:T.accent, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.5px" }}>{mins}:{secs}</div>
          <div style={{ fontSize:10, color:T.dim, textTransform:"uppercase", letterSpacing:"0.6px" }}>elapsed</div>
        </div>
      </div>
      <p style={{ color:T.muted, fontSize:13.5, margin:"0 0 24px" }}>Leave this tab open. Typically 5–12 minutes with crawling.</p>

      {/* Step indicators */}
      <div style={{ display:"flex", alignItems:"center", marginBottom:20, flexWrap:"wrap", gap:"4px 0" }}>
        {STEPS.map((step, i) => {
          const done = i < cur, active = i === cur;
          return (
            <div key={step.key} style={{ display:"flex", alignItems:"center" }}>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                <div style={{ position:"relative", width:28, height:28, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  {active && (
                    <div style={{ position:"absolute", inset:-4, borderRadius:"50%", border:`2px solid ${T.accent}`, animation:"pulse-ring 1.8s ease-out infinite", opacity:0 }} />
                  )}
                  <div style={{ width:26, height:26, borderRadius:"50%", background:done?T.success:active?T.accent:T.surface, border:`2px solid ${done?T.success:active?T.accent:T.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700, color:done||active?"#fff":T.dim, transition:"all 0.3s", position:"relative", zIndex:1 }}>
                    {done ? "✓" : i+1}
                  </div>
                </div>
                <div style={{ fontSize:9.5, color:done?T.success:active?T.accent:T.dim, fontWeight:active?700:400, textTransform:"uppercase", letterSpacing:"0.4px", whiteSpace:"nowrap" }}>
                  {step.label}
                </div>
              </div>
              {i < STEPS.length-1 && (
                <div style={{ width:24, height:2, background:done?T.success:T.border, margin:"0 2px 16px", transition:"background 0.4s", flexShrink:0 }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Progress bars */}
      <div style={{ marginBottom:6 }}><ProgressBar value={progress} /></div>
      <div style={{ height:3, background:T.borderLight, borderRadius:3, overflow:"hidden", marginBottom:16, position:"relative" }}>
        <div style={{ position:"absolute", top:0, left:0, height:"100%", width:"40%", background:`linear-gradient(90deg,transparent,${T.accent}88,${T.accent},${T.accent}88,transparent)`, animation:"sweep 1.6s ease-in-out infinite" }} />
      </div>

      {/* Activity message */}
      {currentMsg && (
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14, padding:"9px 14px", background:T.accentBg, border:`1px solid ${T.accent}33`, borderRadius:8 }}>
          <span style={{ animation:"spin 2s linear infinite", display:"inline-block", fontSize:13, flexShrink:0 }}>⟳</span>
          <div style={{ fontSize:13, color:T.accentDark, fontWeight:500 }}>{currentMsg}</div>
        </div>
      )}

      {/* Log panel */}
      <div ref={logRef} style={{ background:T.bg, border:`1.5px solid ${T.border}`, borderRadius:10, padding:"14px 16px", fontFamily:"'Courier New',monospace", maxHeight:320, overflowY:"auto" }}>
        {log.length === 0
          ? <div style={{ color:T.dim, fontSize:12.5 }}>Initializing…</div>
          : log.map((e, i) => {
              const color = e.type==="success"?T.success : e.type==="error"?T.error : e.type==="warn"?T.warn : e.type==="header"?T.accentDark : T.muted;
              return <div key={i} style={{ fontSize:12, color, padding:"1px 0", fontWeight:e.type==="header"?700:400 }}>{e.msg}</div>;
            })
        }
      </div>
    </div>
  );
}
