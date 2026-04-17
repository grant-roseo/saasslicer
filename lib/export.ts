import * as XLSX from "xlsx";
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, PageBreak,
} from "docx";
import type { AnalysisState } from "./types";

// ─── Slug date ────────────────────────────────────────────────────────────────
function slugDate() { return new Date().toISOString().slice(0, 10); }

function dl(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ─── XLSX Export (no narrative tab) ──────────────────────────────────────────
export function exportXLSX(state: AnalysisState) {
  const wb = XLSX.utils.book_new();
  const clientName = state.sites.find(s => s.role === "client")?.name || "client";

  // Sheet 1: Content Plan
  if (state.contentPlan.length > 0) {
    const ws1 = XLSX.utils.aoa_to_sheet([
      ["Priority","Page Title","URL Suggestion","Content Type","Target Query",
       "Funnel Stage","Intent","Core Angle","Action","Reasoning","Gap Addressed",
       "Estimated Effort","Word Count Target","ICPs Served","Problems Solved"],
      ...state.contentPlan.map(i => [
        i.priority, i.pageTitle, i.urlSuggestion, i.contentType, i.targetQuery,
        i.funnelStage, i.intent, i.coreAngle, i.action, i.reasoning, i.gapAddressed,
        i.estimatedEffort, i.wordCountTarget,
        (i.icpIds || []).join(", "),
        (i.problemsSolved || []).join("; "),
      ]),
    ]);
    ws1["!cols"] = [6,42,36,22,42,12,16,52,12,55,36,14,14,30,50].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws1, "Content Plan");
  }

  // Sheet 2: Gap Analysis
  if (state.gapAnalysis?.gaps) {
    const ws2 = XLSX.utils.aoa_to_sheet([
      ["Title","Type","Priority","Description","Opportunity","Reasoning","Est. Pages","Funnel","Competitors","ICP Relevance"],
      ...state.gapAnalysis.gaps.map(g => [
        g.title, g.gapType, g.priority, g.description, g.opportunity, g.reasoning,
        g.estimatedPages, g.funnelStage,
        (g.competitorsDoing || []).join(", "),
        (g.icpRelevance || []).join(", "),
      ]),
    ]);
    ws2["!cols"] = [36,20,10,55,55,55,12,10,28,30].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws2, "Gap Analysis");
  }

  // Sheet 3: Site Overview
  const ws3 = XLSX.utils.aoa_to_sheet([
    ["Site","Role","URLs Analyzed","Categories","Strategy Summary","Strengths","Notable Gaps"],
    ...Object.values(state.siteAnalyses).map(a => [
      a.siteName, a.isClient ? "Client" : "Competitor",
      a.totalUrls, a.clusters.length,
      a.contentStrategySum,
      (a.strengths || []).join(" | "),
      (a.notableGaps || []).join(" | "),
    ]),
  ]);
  ws3["!cols"] = [22,12,14,12,60,60,60].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws3, "Site Overview");

  // Sheet 4: ICP Profiles
  if (state.icpAnalysis?.icps.length) {
    const ws4 = XLSX.utils.aoa_to_sheet([
      ["ICP Name","Role","Industry","Company Size","Primary Pains","Jobs to be Done",
       "Search Queries","AI Prompts","TOFU Needs","MOFU Needs","BOFU Needs",
       "Client Coverage Score","Priority Score","Gap Score","Source"],
      ...state.icpAnalysis.icps.map(icp => [
        icp.name, icp.role, icp.industry, icp.companySizeProfile,
        (icp.primaryPains || []).join("; "),
        (icp.jobsToBeDone || []).join("; "),
        (icp.searchQueries || []).join("; "),
        (icp.aiPrompts || []).join("; "),
        (icp.tofuContentNeeds || []).join("; "),
        (icp.mofuContentNeeds || []).join("; "),
        (icp.bofuContentNeeds || []).join("; "),
        icp.clientCoverageScore, icp.priorityScore, icp.gapScore,
        icp.sourceCompetitor,
      ]),
    ]);
    ws4["!cols"] = [40,30,25,30,60,60,60,60,50,50,50,15,15,15,25].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws4, "ICP Profiles");
  }

  // Sheet 5: Content → ICP Mapping
  if (state.contentPlan.length && state.icpAnalysis?.icps.length) {
    const rows: (string | number)[][] = [["ICP Name","ICP Role","Industry","Funnel Stage","Page Title","URL","Content Type","Action"]];
    for (const icp of state.icpAnalysis.icps) {
      const mapped = state.contentPlan.filter(c => (c.icpIds || []).includes(icp.id));
      for (const item of mapped) {
        rows.push([icp.name, icp.role, icp.industry, item.funnelStage, item.pageTitle, item.urlSuggestion, item.contentType, item.action]);
      }
    }
    const ws5 = XLSX.utils.aoa_to_sheet(rows);
    ws5["!cols"] = [40,28,22,12,42,36,22,12].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws5, "Content ICP Map");
  }

  XLSX.writeFile(wb, `saas-slicer-${clientName}-${slugDate()}.xlsx`);
}

// ─── Word Doc Export ──────────────────────────────────────────────────────────
function mdToDocxParagraphs(md: string): Paragraph[] {
  const paras: Paragraph[] = [];
  const lines = md.split("\n");

  for (const line of lines) {
    const t = line.trim();
    if (!t) { paras.push(new Paragraph("")); continue; }

    if (t.startsWith("## ")) {
      paras.push(new Paragraph({ text: t.slice(3), heading: HeadingLevel.HEADING_2 }));
    } else if (t.startsWith("### ")) {
      paras.push(new Paragraph({ text: t.slice(4), heading: HeadingLevel.HEADING_3 }));
    } else if (t.startsWith("- ") || t.startsWith("• ")) {
      paras.push(new Paragraph({ text: t.slice(2), bullet: { level: 0 } }));
    } else if (/^\d+\.\s/.test(t)) {
      paras.push(new Paragraph({ text: t.replace(/^\d+\.\s/, ""), numbering: { reference: "numbered-list", level: 0 } }));
    } else {
      // Inline bold/italic
      const runs: TextRun[] = [];
      const parts = t.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
      for (const part of parts) {
        if (part.startsWith("**") && part.endsWith("**")) {
          runs.push(new TextRun({ text: part.slice(2,-2), bold: true }));
        } else if (part.startsWith("*") && part.endsWith("*")) {
          runs.push(new TextRun({ text: part.slice(1,-1), italics: true }));
        } else {
          runs.push(new TextRun(part));
        }
      }
      paras.push(new Paragraph({ children: runs }));
    }
  }
  return paras;
}

export async function exportStrategyDoc(state: AnalysisState) {
  const clientName = state.sites.find(s => s.role === "client")?.name || "Client";

  const doc = new Document({
    numbering: {
      config: [{
        reference: "numbered-list",
        levels: [{ level: 0, format: "decimal", text: "%1.", alignment: AlignmentType.START }],
      }],
    },
    sections: [{
      properties: {},
      children: [
        new Paragraph({ text: "Content Strategy Report", heading: HeadingLevel.TITLE }),
        new Paragraph({ text: clientName + " — " + slugDate(), heading: HeadingLevel.HEADING_3 }),
        new Paragraph(""),
        new Paragraph({ text: "Overall Content Strategy", heading: HeadingLevel.HEADING_1 }),
        ...mdToDocxParagraphs(state.strategyNarrative || "_No strategy narrative generated._"),
        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({ text: "ICP Analysis & Content Strategy by Audience", heading: HeadingLevel.HEADING_1 }),
        ...mdToDocxParagraphs(state.icpNarrative || "_No ICP narrative generated._"),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `saas-slicer-strategy-${clientName}-${slugDate()}.docx`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ─── JSON save/load ───────────────────────────────────────────────────────────
export function saveJson(state: AnalysisState) {
  const clientName = state.sites.find(s => s.role === "client")?.name || "analysis";
  dl(
    JSON.stringify(state, null, 2),
    `saas-slicer-${clientName}-${slugDate()}.json`,
    "application/json"
  );
}
