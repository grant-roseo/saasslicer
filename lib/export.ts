import * as XLSX from "xlsx";
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, PageBreak,
} from "docx";
import type { AnalysisState, ContentItem, ContentCluster } from "./types";
import { CLUSTER_LABELS } from "./types";

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

// ─── XLSX Export ──────────────────────────────────────────────────────────────
export function exportXLSX(state: AnalysisState) {
  const wb = XLSX.utils.book_new();
  const clientName = state.sites.find(s => s.role === "client")?.name || "client";

  // ── Sheet 1: Content Plan (expanded schema) ────────────────────────────────
  if (state.contentPlan.length > 0) {
    const header = [
      "#", "Priority Tier", "Cluster", "Page Type",
      "Page Title", "URL Suggestion",
      "Target Query", "Funnel Stage", "Intent",
      "Core Angle", "Action", "Source Material URLs", "Source Material Note",
      "Content Type", "Reasoning", "Gap Addressed",
      "Estimated Effort", "Word Count Target",
      "ICPs Served", "Problems Solved",
    ];
    const rows = state.contentPlan.map(i => [
      i.priority,
      i.priorityTier || "",
      i.cluster ? CLUSTER_LABELS[i.cluster] : "",
      i.pageTypeCategory || "",
      i.pageTitle,
      i.urlSuggestion,
      i.targetQuery,
      i.funnelStage,
      i.intent,
      i.coreAngle,
      i.action,
      (i.sourceMaterial?.urls || []).join(", "),
      i.sourceMaterial?.note || "",
      i.contentType,
      i.reasoning,
      i.gapAddressed,
      i.estimatedEffort,
      i.wordCountTarget,
      (i.icpIds || []).join(", "),
      (i.problemsSolved || []).join("; "),
    ]);
    const ws1 = XLSX.utils.aoa_to_sheet([header, ...rows]);
    ws1["!cols"] = [4, 10, 22, 22, 42, 36, 38, 12, 14, 48, 12, 45, 50, 22, 55, 34, 12, 14, 30, 50].map(w => ({ wch: w }));
    // Freeze header row
    ws1["!freeze"] = { xSplit: 0, ySplit: 1 };
    XLSX.utils.book_append_sheet(wb, ws1, "Content Plan");
  }

  // ── Sheet 2: Strategy by Cluster (NEW) ──────────────────────────────────────
  // Pivoted view — items grouped by cluster for strategic narrative reading.
  // Each cluster section shows its items in sequence. Matches the reference
  // strategy deck's cluster-by-cluster presentation.
  if (state.contentPlan.length > 0) {
    const byCluster = groupByCluster(state.contentPlan);
    const rows: (string | number)[][] = [];

    const header = [
      "Cluster", "Priority", "#",
      "Page Title", "URL Suggestion", "Page Type", "Target Query",
      "Funnel", "Intent", "Action", "Source Material",
      "Core Angle",
    ];
    rows.push(header);

    // Deterministic cluster order matching the strategic narrative
    const clusterOrder: ContentCluster[] = [
      "core_platform", "role_solutions", "industry_verticals", "topic_guides",
      "services_led", "commercial_education", "proof_and_hubs", "interactive_tools",
    ];

    for (const cluster of clusterOrder) {
      const items = byCluster.get(cluster) || [];
      if (!items.length) continue;
      // Section separator row with cluster label
      rows.push([`━━━ ${CLUSTER_LABELS[cluster]} (${items.length}) ━━━`, "", "", "", "", "", "", "", "", "", "", ""]);
      for (const i of items) {
        const sourceSummary = i.sourceMaterial && i.sourceMaterial.action !== "none"
          ? `[${i.sourceMaterial.action}] ${(i.sourceMaterial.urls || []).join(", ")}${i.sourceMaterial.note ? " — " + i.sourceMaterial.note : ""}`
          : "";
        rows.push([
          "",
          i.priorityTier || "",
          i.priority,
          i.pageTitle,
          i.urlSuggestion,
          i.pageTypeCategory || "",
          i.targetQuery,
          i.funnelStage,
          i.intent,
          i.action,
          sourceSummary,
          i.coreAngle,
        ]);
      }
    }

    // Include any items that don't match known clusters at the end
    const unclustered = state.contentPlan.filter(i => !i.cluster || !clusterOrder.includes(i.cluster as ContentCluster));
    if (unclustered.length) {
      rows.push([`━━━ Uncategorized (${unclustered.length}) ━━━`, "", "", "", "", "", "", "", "", "", "", ""]);
      for (const i of unclustered) {
        rows.push([
          "",
          i.priorityTier || "",
          i.priority,
          i.pageTitle,
          i.urlSuggestion,
          i.pageTypeCategory || "",
          i.targetQuery,
          i.funnelStage,
          i.intent,
          i.action,
          "",
          i.coreAngle,
        ]);
      }
    }

    const ws2 = XLSX.utils.aoa_to_sheet(rows);
    ws2["!cols"] = [24, 8, 4, 42, 36, 22, 38, 10, 14, 12, 55, 48].map(w => ({ wch: w }));
    ws2["!freeze"] = { xSplit: 0, ySplit: 1 };
    XLSX.utils.book_append_sheet(wb, ws2, "Strategy by Cluster");
  }

  // ── Sheet 3: Gap Analysis ───────────────────────────────────────────────────
  if (state.gapAnalysis?.gaps) {
    const ws3 = XLSX.utils.aoa_to_sheet([
      ["Title","Type","Priority","Description","Opportunity","Reasoning","Est. Pages","Funnel","Competitors","ICP Relevance"],
      ...state.gapAnalysis.gaps.map(g => [
        g.title, g.gapType, g.priority, g.description, g.opportunity, g.reasoning,
        g.estimatedPages, g.funnelStage,
        (g.competitorsDoing || []).join(", "),
        (g.icpRelevance || []).join(", "),
      ]),
    ]);
    ws3["!cols"] = [36,20,10,55,55,55,12,10,28,30].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws3, "Gap Analysis");
  }

  // ── Sheet 4: Site Overview ──────────────────────────────────────────────────
  const ws4 = XLSX.utils.aoa_to_sheet([
    ["Site","Role","URLs Analyzed","Categories","Strategy Summary","Strengths","Notable Gaps"],
    ...Object.values(state.siteAnalyses).map(a => [
      a.siteName, a.isClient ? "Client" : "Competitor",
      a.totalUrls, a.clusters.length,
      a.contentStrategySum,
      (a.strengths || []).join(" | "),
      (a.notableGaps || []).join(" | "),
    ]),
  ]);
  ws4["!cols"] = [22,12,14,12,60,60,60].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws4, "Site Overview");

  // ── Sheet 5: ICP Profiles ───────────────────────────────────────────────────
  if (state.icpAnalysis?.icps.length) {
    const ws5 = XLSX.utils.aoa_to_sheet([
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
    ws5["!cols"] = [40,30,25,30,60,60,60,60,50,50,50,15,15,15,25].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws5, "ICP Profiles");
  }

  // ── Sheet 6: Content → ICP Mapping ──────────────────────────────────────────
  if (state.contentPlan.length && state.icpAnalysis?.icps.length) {
    const rows: (string | number)[][] = [["ICP Name","ICP Role","Industry","Funnel Stage","Page Title","URL","Cluster","Page Type","Action"]];
    for (const icp of state.icpAnalysis.icps) {
      const mapped = state.contentPlan.filter(c => (c.icpIds || []).includes(icp.id));
      for (const item of mapped) {
        rows.push([
          icp.name, icp.role, icp.industry, item.funnelStage,
          item.pageTitle, item.urlSuggestion,
          item.cluster ? CLUSTER_LABELS[item.cluster] : "",
          item.pageTypeCategory || "",
          item.action,
        ]);
      }
    }
    const ws6 = XLSX.utils.aoa_to_sheet(rows);
    ws6["!cols"] = [40,28,22,12,42,36,22,22,12].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws6, "Content ICP Map");
  }

  XLSX.writeFile(wb, `saas-slicer-${clientName}-${slugDate()}.xlsx`);
}

function groupByCluster(items: ContentItem[]): Map<ContentCluster | "unknown", ContentItem[]> {
  const map = new Map<ContentCluster | "unknown", ContentItem[]>();
  for (const item of items) {
    const key = (item.cluster || "unknown") as ContentCluster | "unknown";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return map;
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
