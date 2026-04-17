"use client";
import { useState } from "react";
import { T, btn, badge } from "@/lib/design";
import type { SiteAnalysis, GapAnalysis, ContentItem, ICPAnalysis } from "@/lib/types";
import OverviewTab    from "../tabs/OverviewTab";
import GapTab         from "../tabs/GapTab";
import PlanTab        from "../tabs/PlanTab";
import ICPTab         from "../tabs/ICPTab";
import ContentICPTab  from "../tabs/ContentICPTab";
import NarrativeTab   from "../tabs/NarrativeTab";

interface Props {
  siteAnalyses:      Record<string, SiteAnalysis>;
  gapAnalysis:       GapAnalysis | null;
  contentPlan:       ContentItem[];
  icpAnalysis:       ICPAnalysis | null;
  strategyNarrative: string;
  icpNarrative:      string;
  onUpdateStratNarr: (s: string) => void;
  onUpdateIcpNarr:   (s: string) => void;
  onExportXLSX:      () => void;
  onExportDoc:       () => void;
  onSaveJson:        () => void;
  onReset:           () => void;
}

export default function ResultsPhase({
  siteAnalyses, gapAnalysis, contentPlan, icpAnalysis,
  strategyNarrative, icpNarrative,
  onUpdateStratNarr, onUpdateIcpNarr,
  onExportXLSX, onExportDoc, onSaveJson, onReset,
}: Props) {
  const [tab, setTab] = useState("overview");

  const tabs = [
    { key:"overview",   label:"Overview" },
    { key:"gaps",       label:`Gaps (${(gapAnalysis?.gaps||[]).length})` },
    { key:"plan",       label:`Content Plan (${contentPlan.length})` },
    { key:"icp",        label:`ICP Profiles (${icpAnalysis?.icps?.length||0})` },
    { key:"content_icp",label:"Content → ICP" },
    { key:"narrative",  label:"Narratives ✎" },
  ];

  const clientAn = Object.values(siteAnalyses).find(a => a.isClient);
  const compAns  = Object.values(siteAnalyses).filter(a => !a.isClient);

  return (
    <div style={{ maxWidth:1180, margin:"0 auto" }}>
      {/* Results header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
        <div>
          <h2 style={{ fontSize:22, fontWeight:800, color:T.text, margin:"0 0 4px" }}>Analysis complete</h2>
          <p style={{ color:T.muted, fontSize:13.5, margin:0 }}>
            {Object.keys(siteAnalyses).length} sites ·{" "}
            {(gapAnalysis?.gaps||[]).length} gaps ·{" "}
            {contentPlan.length} recommendations ·{" "}
            {icpAnalysis?.icps?.length||0} ICPs
          </p>
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", justifyContent:"flex-end" }}>
          <button onClick={onReset}      style={btn("ghost")}>← New Analysis</button>
          <button onClick={onSaveJson}   style={btn("default")}>⬇ Save .json</button>
          <button onClick={onExportDoc}  style={btn("default")}>⬇ Word Docs</button>
          <button onClick={onExportXLSX} style={btn("primary")}>⬇ Export XLSX</button>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display:"flex", gap:2, borderBottom:"2px solid "+T.border, marginBottom:24, overflowX:"auto" }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ background:"transparent", border:"none", cursor:"pointer", fontFamily:"inherit", padding:"9px 18px", fontSize:13.5, fontWeight:tab===t.key?700:500, color:tab===t.key?T.accent:T.muted, borderBottom:`2px solid ${tab===t.key?T.accent:"transparent"}`, marginBottom:-2, transition:"all 0.12s", whiteSpace:"nowrap" }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab==="overview"    && <OverviewTab siteAnalyses={siteAnalyses} />}
      {tab==="gaps"        && <GapTab gapAnalysis={gapAnalysis} />}
      {tab==="plan"        && <PlanTab items={contentPlan} icps={icpAnalysis?.icps||[]} />}
      {tab==="icp"         && <ICPTab icpAnalysis={icpAnalysis} clientName={clientAn?.siteName||""} />}
      {tab==="content_icp" && <ContentICPTab contentPlan={contentPlan} icps={icpAnalysis?.icps||[]} />}
      {tab==="narrative"   && (
        <NarrativeTab
          strategyNarrative={strategyNarrative}
          icpNarrative={icpNarrative}
          onUpdateStrategy={onUpdateStratNarr}
          onUpdateIcp={onUpdateIcpNarr}
          onExportDoc={onExportDoc}
        />
      )}
    </div>
  );
}
