"use client";
import { useState, useRef, useCallback } from "react";
import { setProvider } from "@/lib/ai";
import { callAIJson, callAI } from "@/lib/ai";
import { clusterUrls } from "@/lib/cluster";
import { exportXLSX, exportStrategyDoc, saveJson } from "@/lib/export";
import { T } from "@/lib/design";
import type {
  AIProvider, SiteInput, SiteAnalysis, UrlCluster, CrawledPage,
  GapAnalysis, ContentItem, ICPAnalysis, ICP, AnalysisState, LogEntry,
} from "@/lib/types";

import InputPhase   from "./phases/InputPhase";
import AnalysisPhase from "./phases/AnalysisPhase";
import ReviewPhase  from "./phases/ReviewPhase";
import ResultsPhase from "./phases/ResultsPhase";

type AppPhase = "input" | "analyzing" | "reviewing" | "results";

// ─── Analysis sub-phases shown in the progress screen ─────────────────────────
export type SubPhase = "cluster" | "crawl" | "analyze" | "gap" | "plan" | "icp" | "narrative";

const CRAWL_BATCH = 5;          // pages per crawl request
const CONFIDENCE_THRESHOLD = 75; // 0-100
const MAX_CRAWL_PER_CLUSTER = 20;

export default function SlicerApp() {
  const [appPhase,    setAppPhase]    = useState<AppPhase>("input");
  const [subPhase,    setSubPhase]    = useState<SubPhase>("cluster");
  const [progress,    setProgress]    = useState(0);
  const [log,         setLog]         = useState<LogEntry[]>([]);
  const [error,       setError]       = useState<string | null>(null);
  const [isRefining,  setIsRefining]  = useState(false);

  // Analysis results
  const [siteAnalyses, setSiteAnalyses] = useState<Record<string, SiteAnalysis>>({});
  const [gapAnalysis,  setGapAnalysis]  = useState<GapAnalysis | null>(null);
  const [contentPlan,  setContentPlan]  = useState<ContentItem[]>([]);
  const [icpAnalysis,  setIcpAnalysis]  = useState<ICPAnalysis | null>(null);
  const [stratNarr,    setStratNarr]    = useState("");
  const [icpNarr,      setIcpNarr]      = useState("");

  // Refs for cross-function access
  const sitesRef      = useRef<SiteInput[]>([]);
  const notesRef      = useRef("");
  const analysesRef   = useRef<Record<string, SiteAnalysis>>({});
  const gapRef        = useRef<GapAnalysis | null>(null);
  const planRef       = useRef<ContentItem[]>([]);
  const icpRef        = useRef<ICPAnalysis | null>(null);

  const addLog = useCallback((msg: string, type: LogEntry["type"] = "info") => {
    setLog(p => [...p, { msg, type, ts: Date.now() }]);
  }, []);

  // ─── Adaptive crawl loop ────────────────────────────────────────────────────
  async function adaptiveCrawl(
    cluster: UrlCluster,
    siteName: string
  ): Promise<CrawledPage[]> {
    const { urls, priority, categoryType } = cluster;
    const pages: CrawledPage[] = [];

    // Low-priority or tiny clusters — skip crawl
    if (priority === "low" || urls.length === 0) return pages;

    // Determine initial sample size based on category size and priority
    let initialSample: number;
    if (priority === "critical") {
      initialSample = urls.length <= 5 ? urls.length : 5;
    } else if (priority === "high") {
      initialSample = urls.length <= 8 ? urls.length : 5;
    } else {
      // Normal priority: crawl all if ≤10, else 30%
      initialSample = urls.length <= 10 ? urls.length : Math.min(Math.ceil(urls.length * 0.3), 15);
    }

    // Crawl initial sample
    const firstBatch = urls.slice(0, initialSample);
    const firstPages = await crawlBatch(firstBatch);
    pages.push(...firstPages);

    // Only confidence-loop for critical/high priority categories
    if (priority !== "critical" && priority !== "high") return pages;

    // Score confidence
    let confidence = await scoreConfidence(cluster, pages, siteName);
    addLog(`  ${cluster.name}: ${pages.length} pages, confidence ${confidence}/100`, confidence >= CONFIDENCE_THRESHOLD ? "success" : "info");

    // If low confidence, fetch 5 more
    if (confidence < CONFIDENCE_THRESHOLD && pages.length < MAX_CRAWL_PER_CLUSTER) {
      const nextBatch = urls.slice(pages.length, pages.length + CRAWL_BATCH);
      if (nextBatch.length > 0) {
        pages.push(...await crawlBatch(nextBatch));
        confidence = await scoreConfidence(cluster, pages, siteName);
        addLog(`  ${cluster.name}: ${pages.length} pages after retry, confidence ${confidence}/100`, confidence >= CONFIDENCE_THRESHOLD ? "success" : "warn");
      }
    }

    // Still low confidence — crawl remaining up to cap
    if (confidence < CONFIDENCE_THRESHOLD) {
      const remaining = urls.slice(pages.length, MAX_CRAWL_PER_CLUSTER);
      if (remaining.length > 0) {
        pages.push(...await crawlBatch(remaining));
        addLog(`  ${cluster.name}: extended to ${pages.length} pages`, "info");
      }
    }

    return pages;
  }

  async function crawlBatch(urls: string[]): Promise<CrawledPage[]> {
    try {
      const res = await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls }),
      });
      const data = await res.json();
      return data.pages || [];
    } catch { return []; }
  }

  async function scoreConfidence(
    cluster: UrlCluster,
    pages: CrawledPage[],
    siteName: string
  ): Promise<number> {
    const sample = pages.filter(p => p.title || p.h1).slice(0, 8);
    if (!sample.length) return 40;
    try {
      const result = await callAIJson<{ confidence: number; reasoning: string }>(
        `You assess whether crawled pages match an expected content category.
Return ONLY JSON: {"confidence": 0-100, "reasoning": "brief explanation"}`,
        `Category: "${cluster.name}" (${cluster.categoryType})
Site: ${siteName}
Pages crawled:
${sample.map(p => `- ${p.url}\n  Title: ${p.title}\n  H1: ${p.h1}`).join("\n")}
How confident are you these pages represent the "${cluster.name}" category? 0=wrong category, 100=perfect match.`,
        400,
        { confidence: 60, reasoning: "default" }
      );
      return Math.max(0, Math.min(100, result.confidence || 60));
    } catch { return 60; }
  }

  // ─── Site analysis with enriched meta ──────────────────────────────────────
  async function analyzeSite(site: SiteInput): Promise<SiteAnalysis> {
    const clusters = clusterUrls(site.urls);
    addLog(`  Clustered into ${clusters.length} categories`, "info");

    // Adaptive crawl each cluster
    setSubPhase("crawl");
    for (const cluster of clusters) {
      addLog(`  Crawling ${cluster.name} (${cluster.urls.length} URLs)…`);
      cluster.crawledPages = await adaptiveCrawl(cluster, site.name);
      cluster.crawlStatus = "done";
    }

    setSubPhase("analyze");

    // Build rich per-cluster context including crawled page titles
    const clusterSummaries = clusters.map(c => {
      const crawled = c.crawledPages.filter(p => p.title || p.h1).slice(0, 6);
      const sampleLines = crawled.length > 0
        ? crawled.map(p => `    • ${p.title || p.h1}${p.metaDescription ? " — " + p.metaDescription.slice(0, 90) : ""}`).join("\n")
        : c.urls.slice(0, 6).map(u => `    • ${u}`).join("\n");
      return `[${c.name} — ${c.urls.length} pages | crawled: ${crawled.length}]\n${sampleLines}`;
    }).join("\n\n");

    // Infer which SaaS content taxonomy categories are present vs missing
    const presentTypes = new Set(clusters.map(c => c.categoryType));
    const allTypes = ["industry_vertical","who_we_serve","comparison","case_study","solution","product_service","resource_guide","landing_page","pricing"];
    const missingTypes = allTypes.filter(t => !presentTypes.has(t as any));

    const result = await callAIJson<SiteAnalysis>(
      `You are an expert SaaS content strategist. Analyze this site's content architecture from URL patterns and page metadata.
Return ONLY valid JSON (no markdown):
{
  "siteId":"","siteName":"","domain":"","isClient":false,"totalUrls":0,"clusters":[],
  "contentStrategySum":"2-3 sentences on overall content strategy approach",
  "searchArchitecture":"describe how they structure content for organic search — verticals, roles, use cases etc",
  "keyThemes":["theme1","theme2","theme3"],
  "strengths":["specific strength 1","specific strength 2","specific strength 3","specific strength 4"],
  "notableGaps":["specific missing content type 1","specific missing vertical 2","specific missing role page 3","specific missing content type 4"],
  "contentVelocitySignal":"estimate publishing frequency from blog/resource page count",
  "schemaTypesFound":[]
}`,
      `Analyze this ${site.role.toUpperCase()} site: ${site.name} (${site.domain})
Total URLs: ${site.urls.length}

CONTENT ARCHITECTURE (what they actually have):
${clusterSummaries}

CONTENT TAXONOMY GAPS (categories with zero pages):
${missingTypes.join(", ")}

For notableGaps be SPECIFIC: name exact verticals, roles, and page types that are absent.
For strengths be SPECIFIC: mention actual category names and page counts.
Set: isClient=${site.role === "client"}, siteId="${site.id}", siteName="${site.name}", domain="${site.domain}", totalUrls=${site.urls.length}`,
      3000,
      {
        siteId: site.id, siteName: site.name, domain: site.domain,
        isClient: site.role === "client", totalUrls: site.urls.length,
        clusters, contentStrategySum: "", searchArchitecture: "",
        keyThemes: [], strengths: [], notableGaps: [],
        contentVelocitySignal: "", schemaTypesFound: [],
      }
    );

    return { ...result, siteId: site.id, siteName: site.name, domain: site.domain, isClient: site.role === "client", totalUrls: site.urls.length, clusters };
  }

  // ─── Gap analysis ───────────────────────────────────────────────────────────
  async function runGapAnalysis(
    clientAn: SiteAnalysis,
    compAns: SiteAnalysis[]
  ): Promise<GapAnalysis> {

    // Build a detailed content inventory for each site
    function siteInventory(an: SiteAnalysis) {
      return an.clusters.map(c => {
        const sample = c.crawledPages.filter(p => p.title).slice(0, 4).map(p => p.title).join("; ");
        return `  ${c.name}: ${c.urls.length} pages${sample ? " | e.g. " + sample : ""}`;
      }).join("\n");
    }

    const clientInventory = siteInventory(clientAn);
    const compInventories = compAns.map(c => `${c.siteName} (${c.totalUrls} URLs):\n${siteInventory(c)}`).join("\n\n");

    // Identify which taxonomy categories each competitor has that client is missing
    const clientTypes = new Set(clientAn.clusters.map(c => c.categoryType));
    const compTypeMap: Record<string, string[]> = {};
    for (const comp of compAns) {
      for (const cl of comp.clusters) {
        if (!clientTypes.has(cl.categoryType) && cl.urls.length > 2) {
          compTypeMap[cl.name] = compTypeMap[cl.name] || [];
          if (!compTypeMap[cl.name].includes(comp.siteName)) compTypeMap[cl.name].push(comp.siteName);
        }
      }
    }
    const missingCats = Object.entries(compTypeMap).map(([cat, comps]) => `  ${cat}: ${comps.join(", ")}`).join("\n");

    return callAIJson<GapAnalysis>(
      `You are a senior B2B SaaS content strategist. Identify every significant content gap the client has vs competitors.
Return ONLY valid JSON:
{"narrative":"3-4 sentence strategic summary","competitorStrengths":[{"competitor":"","advantage":""}],"clientAdvantages":[""],"gaps":[{"id":"g1","title":"","gapType":"content_category","description":"","priority":"critical|high|medium|low","opportunity":"","reasoning":"","estimatedPages":0,"funnelStage":"TOFU|MOFU|BOFU","competitorsDoing":[],"icpRelevance":[]}]}
Priority guide: critical=major category with 0 client pages, high=underdeveloped vs competitors, medium=behind on depth/breadth, low=nice to have.
Target 15-25 gaps across these types: industry verticals, role/persona pages, comparison/alternative pages, customer proof, solution/use-case pages, resource gaps, conversion pages.`,
      `CLIENT SITE: ${clientAn.siteName} (${clientAn.totalUrls} URLs)
Content strategy: ${clientAn.contentStrategySum}
Search architecture: ${clientAn.searchArchitecture}

WHAT CLIENT HAS:
${clientInventory}

CLIENT STRENGTHS: ${clientAn.strengths.join(" | ")}
CLIENT NOTABLE GAPS: ${clientAn.notableGaps.join(" | ")}

COMPETITOR SITES:
${compInventories}

CONTENT CATEGORIES COMPETITORS HAVE THAT CLIENT IS MISSING:
${missingCats || "  (analyse the inventories above to identify gaps)"}

ANALYST NOTES: ${notesRef.current || "None"}

Identify 15-25 gaps. For each gap:
- title: specific page type (e.g. "Construction Industry Landing Page", "VP Legal Role Page", "vs Competitor X")
- icpRelevance: specific roles affected (e.g. ["VP Legal", "Procurement Manager", "In-House Counsel"])
- Keep descriptions under 20 words, opportunities under 15 words
- Be specific about WHICH verticals, roles, and page types are missing`,
      3000,
      { narrative: "", competitorStrengths: [], clientAdvantages: [], gaps: [] }
    );
  }

  // ─── Content plan — 3 funnel-stage batches ───────────────────────────────────
  // Batch A = TOFU (awareness/education), B = MOFU (solution/vertical/role), C = BOFU (conversion/proof)
  // Each batch 1800 tokens — safe under Vercel 60s limit even via proxy
  async function generatePlan(
    clientAn: SiteAnalysis,
    gaps: GapAnalysis,
    notes: string
  ): Promise<ContentItem[]> {
    const SYS = `You are a senior B2B SaaS content strategist. Return ONLY valid JSON, no markdown fences.`;
    const SCHEMA = `{"priority":1,"pageTitle":"","urlSuggestion":"/path","contentType":"","targetQuery":"","funnelStage":"TOFU","intent":"informational","coreAngle":"","action":"net_new","reasoning":"","gapAddressed":"","estimatedEffort":"medium","wordCountTarget":1200,"icpIds":[],"problemsSolved":[]}`;

    const cats = clientAn.clusters.map(c => `${c.name}(${c.urls.length})`).join(", ");
    const allGaps = (gaps.gaps || []).map(g => ({ ...g, priority: (g.priority || "medium").toLowerCase() as typeof g.priority }));
    const topGaps = allGaps.slice(0, 20).map(g => `${g.title}: ${g.opportunity}`).join(" | ");

    addLog(`  Planning from ${allGaps.length} gaps across ${clientAn.clusters.length} categories`);

    function extractItems(resp: string): ContentItem[] {
      const clean = resp.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      try { const p = JSON.parse(clean); return p.items || p || []; } catch {}
      const obj = clean.match(/\{[\s\S]+\}/);
      if (obj) { try { const p = JSON.parse(obj[0]); return p.items || []; } catch {} }
      const arr = clean.match(/\[[\s\S]+\]/);
      if (arr) { try { return JSON.parse(arr[0]); } catch {} }
      return [];
    }

    async function planBatch(label: string, focus: string, funnelFocus: string, startAt: number, skip: string[]): Promise<ContentItem[]> {
      try {
        const resp = await callAI(SYS,
          `Generate 12-15 content plan items. Focus: ${focus}

CONTENT GAPS TO ADDRESS: ${topGaps}
CLIENT EXISTING CATEGORIES: ${cats}
${skip.length ? `SKIP (already in plan): ${skip.slice(0,8).join(", ")}` : ""}
ANALYST NOTES: ${notes || "None"}

FUNNEL FOCUS FOR THIS BATCH: ${funnelFocus}
Start priority numbering at ${startAt}.
icpIds: short role strings like "vp_legal", "procurement_manager", "in_house_counsel", "compliance_officer", "sales_ops"
action: "net_new" for missing pages, "refresh" for existing pages needing update, "repurpose" for content format changes
problemsSolved: 2-3 specific problems this page addresses

Return ONLY: {"items":[${SCHEMA}]}`,
          1800
        );
        const items = extractItems(resp);
        addLog(`  ${label}: ${items.length} items`, items.length > 0 ? "success" : "warn");
        if (!items.length) addLog(`  ⚠ ${label}: 0 items returned — response: ${resp.slice(0,200)}`, "warn");
        return items;
      } catch (e: any) {
        addLog(`  ⚠ ${label} failed: ${e.message}`, "warn");
        return [];
      }
    }

    // Batch A: TOFU — awareness, education, thought leadership
    addLog("  Batch A: TOFU awareness & education pages…");
    const bA = await planBatch(
      "Batch A",
      "TOFU awareness content: educational guides, blog series, resource pages, glossary pages, industry trend reports, explainer content",
      "TOFU (informational): target early-stage buyers researching the problem, not yet solution-aware. Mix of blog posts, guides, calculators, templates.",
      1,
      []
    );

    // Batch B: MOFU — solution, vertical, role, use-case pages
    addLog("  Batch B: MOFU solution & vertical pages…");
    const bB = await planBatch(
      "Batch B",
      "MOFU consideration content: industry vertical pages, role/persona pages, solution pages, use-case pages, integration pages, benefit pages",
      "MOFU (commercial): target buyers evaluating solutions. Prioritise missing industry verticals (construction, finance, life sciences, etc), role pages (VP Legal, Procurement, etc), and solution/use-case pages.",
      bA.length + 1,
      bA.slice(0,6).map(i => i.pageTitle)
    );

    // Batch C: BOFU — comparison, proof, conversion pages
    addLog("  Batch C: BOFU conversion & proof pages…");
    const bC = await planBatch(
      "Batch C",
      "BOFU conversion content: comparison pages (vs competitors), case studies, ROI calculators, demo landing pages, customer success stories, security/trust pages",
      "BOFU (transactional): target buyers ready to decide. Prioritise comparison pages, customer proof content, and conversion pages.",
      bA.length + bB.length + 1,
      [...bA,...bB].slice(0,8).map(i => i.pageTitle)
    );

    const all = [...bA, ...bB, ...bC];
    if (!all.length) throw new Error("Content plan returned no items. Ensure NEXT_PUBLIC_ANTHROPIC_API_KEY is set in Vercel env vars, then retry.");
    addLog(`  Total: ${all.length} items (${bA.length} TOFU + ${bB.length} MOFU + ${bC.length} BOFU)`);
    return all.map((item, idx) => ({ ...item, priority: idx + 1 }));
  }

  // ─── ICP generation (up to 20 ICPs) ────────────────────────────────────────
  async function generateICPs(
    clientAn: SiteAnalysis,
    compAns: SiteAnalysis[],
    gaps: GapAnalysis,
    plan: ContentItem[],
    notes: string
  ): Promise<ICPAnalysis> {
    const ICP_SCHEMA = `{
      "id":"string","name":"VP of Legal at Mid-Market SaaS","role":"VP Legal","industry":"SaaS",
      "companySizeProfile":"200-2000 employees","sourceCompetitor":"Competitor Name or inferred",
      "primaryPains":["pain1","pain2","pain3"],
      "secondaryPains":["pain1","pain2"],
      "jobsToBeDone":["jtbd1","jtbd2","jtbd3"],
      "searchQueries":["query1","query2","query3","query4"],
      "aiPrompts":["prompt1","prompt2","prompt3"],
      "tofuContentNeeds":["content type 1","content type 2"],
      "mofuContentNeeds":["content type 1","content type 2"],
      "bofuContentNeeds":["content type 1","content type 2"],
      "clientCoverageScore":20,
      "priorityScore":85,
      "gapScore":80
    }`;

    // Build richer context from crawled page data
    const clientCats = clientAn.clusters.map(c => `${c.name}(${c.urls.length})`).join(", ");
    const compDetails = compAns.map(c => {
      const cats = c.clusters.map(cl => `${cl.name}(${cl.urls.length})`).join(", ");
      const rolePages = c.clusters.filter(cl => cl.categoryType === "who_we_serve").flatMap(cl => cl.crawledPages.filter(p => p.title).slice(0,4).map(p => p.title));
      const vertPages = c.clusters.filter(cl => cl.categoryType === "industry_vertical").flatMap(cl => cl.crawledPages.filter(p => p.title).slice(0,4).map(p => p.title));
      return `${c.siteName}:\n  Categories: ${cats}\n  Role pages: ${rolePages.slice(0,4).join("; ") || "none found"}\n  Vertical pages: ${vertPages.slice(0,4).join("; ") || "none found"}\n  Strategy: ${c.contentStrategySum}`;
    }).join("\n\n");

    async function icpBatch(batchNum: number, existingNames: string[]): Promise<ICP[]> {
      const skip = existingNames.length ? `\nSKIP ICPs already defined: ${existingNames.join(", ")}` : "";
      try {
        const result = await callAIJson<{ icps: ICP[] }>(
          `You are a B2B SaaS content strategist and ICP researcher.
Identify DISTINCT Ideal Customer Profiles (ICPs) that competitor sites are clearly serving that the client is missing or underserving.
Each ICP must have a unique role+industry combination.
Return ONLY valid JSON: {"icps":[${ICP_SCHEMA}]}
Scoring: clientCoverageScore=how well client serves them now (0=not at all, 100=fully), priorityScore=strategic business value (0-100), gapScore=content gap size (0-100).`,
          `CLIENT: ${clientAn.siteName}
What client currently has: ${clientCats}
Client strengths: ${clientAn.strengths.join("; ")}
Client content gaps: ${clientAn.notableGaps.join("; ")}

COMPETITOR CONTENT ANALYSIS:
${compDetails}

KEY CONTENT GAPS IDENTIFIED:
${gaps.gaps.slice(0, 12).map(g => `- ${g.title} [${g.priority}] → ${g.opportunity} | Affects: ${(g.icpRelevance||[]).join(", ")}`).join("\n")}

ANALYST NOTES: ${notes || "None"}
${skip}

Generate ${batchNum === 1 ? "the 8-10 most important" : "8-10 additional distinct"} ICPs.
For each ICP provide: realistic search queries they would use (4+), AI prompts they would ask ChatGPT/Claude (3+), specific content needs at each funnel stage, and exact pain points.
Focus on role × industry combinations visible in competitor content that are absent or weak in the client's content.`,
          2500,
          { icps: [] }
        );
        const icps = result.icps || [];
        if (!icps.length) addLog(`  ⚠ ICP batch ${batchNum} returned 0 ICPs`, "warn");
        return icps;
      } catch (e: any) {
        addLog(`  ⚠ ICP batch ${batchNum} failed: ${e.message}`, "warn");
        return [];
      }
    }

    addLog("  ICP batch 1: identifying primary ICPs from competitor content…");
    const batch1 = await icpBatch(1, []);
    addLog(`  Batch 1: ${batch1.length} ICPs identified`, batch1.length > 0 ? "success" : "warn");

    addLog("  ICP batch 2: identifying additional ICPs…");
    const batch2 = await icpBatch(2, batch1.map(i => i.name));
    addLog(`  Batch 2: ${batch2.length} additional ICPs`, batch2.length > 0 ? "success" : "info");

    const allICPs = [...batch1, ...batch2]
      .slice(0, 20)
      .map((icp, idx) => ({ ...icp, id: icp.id || `icp_${idx + 1}` }));

    const topUnserved = allICPs
      .sort((a, b) => b.gapScore - a.gapScore)
      .slice(0, 5)
      .map(i => i.id);

    const quickWins = allICPs
      .filter(i => i.priorityScore > 70 && i.clientCoverageScore < 30)
      .slice(0, 3)
      .map(i => i.id);

    const narrativeSummary = `${allICPs.length} ICPs identified across ${new Set(allICPs.map(i => i.industry)).size} industries. Top unserved: ${allICPs.slice(0,3).map(i => i.name).join(", ")}.`;

    return { icps: allICPs, narrativeSummary, topUnservedICPs: topUnserved, quickWinICPs: quickWins };
  }

  // ─── Narrative generation (2 calls) ────────────────────────────────────────
  async function generateNarratives(
    clientAn: SiteAnalysis,
    compAns: SiteAnalysis[],
    gaps: GapAnalysis,
    plan: ContentItem[],
    icps: ICPAnalysis,
    notes: string
  ): Promise<{ strategy: string; icp: string }> {
    const context = `CLIENT: ${clientAn.siteName}
Categories: ${clientAn.clusters.map(c => c.name).join(", ")}
Strengths: ${clientAn.strengths.join("; ")}
COMPETITORS: ${compAns.map(c => `${c.siteName} (${c.clusters.map(cl => cl.name).join(", ")})`).join(" | ")}
TOP GAPS: ${gaps.gaps.slice(0, 8).map(g => `${g.title}[${g.priority}]`).join(", ")}
TOP PLAN: ${plan.slice(0, 8).map(i => `${i.priority}.${i.pageTitle}`).join(", ")}
NOTES: ${notes || "None"}`;

    const SYS_STRATEGY = `You are a senior content strategist writing an internal strategic playbook. Use Markdown: ## sections, **bold**, - bullets. Be direct, opinionated, specific. Reference real category names and URL patterns.`;
    const SYS_ICP = `You are a B2B content strategist writing an ICP-focused content strategy. Use Markdown. Be specific about search queries, pain points, and content formats for each audience.`;

    addLog("  Writing strategy narrative…");
    const strategy = await callAI(SYS_STRATEGY,
      `${context}

Write:
## Executive Summary
## What Competitors Are Doing Well
## What the Client Has to Build From
## The Strategic Gap
## Recommended Content Strategy
## Priority Sequence and Rationale
## Bottom Line`,
      1800
    );

    addLog("  Writing ICP narrative…");
    const icpNarrative = await callAI(SYS_ICP,
      `${context}

ICP OVERVIEW: ${icps.narrativeSummary}
TOP ICPs:
${icps.icps.slice(0, 6).map(i => `- ${i.name}: ${i.primaryPains.slice(0,2).join("; ")} | Gap: ${i.gapScore}/100`).join("\n")}

Write:
## ICP Strategy Overview
## Priority Audiences and Why
## Content Recommendations by ICP
## Quick Wins — Highest Gap, Lowest Effort
## Measuring ICP Coverage Over Time`,
      1800
    );

    return { strategy, icp: icpNarrative };
  }

  // ─── Master orchestrator ────────────────────────────────────────────────────
  async function startAnalysis(sites: SiteInput[], notes: string, provider: AIProvider) {
    setProvider(provider);
    setAppPhase("analyzing");
    setSubPhase("cluster");
    setLog([]); setError(null);
    setSiteAnalyses({}); setGapAnalysis(null);
    setContentPlan([]); setIcpAnalysis(null);
    setStratNarr(""); setIcpNarr("");
    setProgress(0);
    sitesRef.current = sites;
    notesRef.current = notes;
    analysesRef.current = {};

    const totalSteps = sites.length + 5; // N sites + gap + plan + ICP + narr + done
    let step = 0;

    try {
      // ── Phase 1: Cluster + Crawl + Analyze each site ─────────────────────
      for (let i = 0; i < sites.length; i++) {
        const site = sites[i];
        if (i > 0) {
          addLog(`Waiting 3s (rate limit)…`, "info");
          await new Promise(r => setTimeout(r, 3000));
        }
        addLog(`\n━━━ ANALYZING: ${site.name.toUpperCase()} (${site.urls.length} URLs) ━━━`, "header");
        setSubPhase("cluster");
        try {
          const an = await analyzeSite(site);
          analysesRef.current[site.id] = an;
          setSiteAnalyses(p => ({ ...p, [site.id]: an }));
          addLog(`✅ ${an.clusters.length} categories, ${an.clusters.reduce((s,c) => s + c.crawledPages.length, 0)} pages crawled`, "success");
        } catch (err: any) {
          addLog(`❌ ${site.name}: ${err.message}`, "error");
          if (site.role === "client") throw new Error(`Client analysis failed: ${err.message}`);
        }
        setProgress((++step / totalSteps) * 100);
      }

      const clientAn = Object.values(analysesRef.current).find(a => a.isClient);
      const compAns  = Object.values(analysesRef.current).filter(a => !a.isClient);
      if (!clientAn) throw new Error("Client analysis not completed");
      if (!compAns.length) throw new Error("No competitor analyses completed");

      // ── Phase 2: Gap analysis ─────────────────────────────────────────────
      setSubPhase("gap");
      addLog("\n━━━ PHASE 2: GAP ANALYSIS ━━━", "header");
      addLog(`Comparing ${clientAn.siteName} vs ${compAns.map(c => c.siteName).join(", ")}…`);
      const gaps = await runGapAnalysis(clientAn, compAns);
      gapRef.current = gaps;
      setGapAnalysis(gaps);
      addLog(`✅ ${gaps.gaps.length} gaps identified`, "success");
      setProgress((++step / totalSteps) * 100);

      // ── Phase 3: Content plan ─────────────────────────────────────────────
      setSubPhase("plan");
      addLog("\n━━━ PHASE 3: CONTENT PLAN ━━━", "header");
      addLog("Generating in 3 priority batches…");
      const plan = await generatePlan(clientAn, gaps, notes);
      planRef.current = plan;
      setContentPlan(plan);
      addLog(`✅ ${plan.length} items across ${gaps.gaps.length} gaps`, "success");
      setProgress((++step / totalSteps) * 100);

      // ── Pause for expert review ───────────────────────────────────────────
      addLog("\n📋 Plan ready for expert review…", "success");
      setProgress(75);
      setTimeout(() => setAppPhase("reviewing"), 400);

    } catch (err: any) {
      setError(err.message);
      addLog(`\n💥 ${err.message}`, "error");
    }
  }

  // ─── Review → continue to ICP + narratives ─────────────────────────────────
  async function handleReviewContinue(feedback: string) {
    setIsRefining(true);
    const clientAn = Object.values(analysesRef.current).find(a => a.isClient)!;
    const compAns  = Object.values(analysesRef.current).filter(a => !a.isClient);

    try {
      let finalPlan = planRef.current;

      if (feedback.trim()) {
        setAppPhase("analyzing");
        setSubPhase("plan");
        addLog("\n━━━ APPLYING EXPERT FEEDBACK ━━━", "header");
        addLog(feedback.slice(0, 100) + (feedback.length > 100 ? "…" : ""));
        const revised = await callAIJson<{ items: ContentItem[] }>(
          `You are a content strategist refining a plan based on expert feedback.
Return ONLY valid JSON: {"items":[...same schema, fully revised...]}
Apply all feedback accurately. Re-number priority sequentially from 1.`,
          `CURRENT PLAN (${planRef.current.length} items):
${JSON.stringify(planRef.current.slice(0, 25), null, 1)}
${planRef.current.length > 25 ? `...and ${planRef.current.length - 25} more` : ""}

EXPERT FEEDBACK:
${feedback}

Return complete revised {"items":[...]} list.`,
          3000,
          { items: planRef.current }
        );
        finalPlan = (revised.items || planRef.current).map((item, idx) => ({ ...item, priority: idx + 1 }));
        planRef.current = finalPlan;
        setContentPlan(finalPlan);
        addLog(`✅ Plan revised: ${finalPlan.length} items`, "success");
      }

      // ── Phase 4: ICP analysis ─────────────────────────────────────────────
      if (appPhase !== "analyzing") setAppPhase("analyzing");
      setSubPhase("icp");
      addLog("\n━━━ PHASE 4: ICP ANALYSIS ━━━", "header");
      const icps = await generateICPs(clientAn, compAns, gapRef.current!, finalPlan, notesRef.current);
      icpRef.current = icps;
      setIcpAnalysis(icps);
      addLog(`✅ ${icps.icps.length} ICPs across ${new Set(icps.icps.map(i => i.industry)).size} industries`, "success");
      setProgress(90);

      // ── Phase 5: Narratives ───────────────────────────────────────────────
      setSubPhase("narrative");
      addLog("\n━━━ PHASE 5: NARRATIVES ━━━", "header");
      const { strategy, icp } = await generateNarratives(clientAn, compAns, gapRef.current!, finalPlan, icps, notesRef.current);
      setStratNarr(strategy);
      setIcpNarr(icp);
      addLog("✅ Strategy narrative complete", "success");
      addLog("✅ ICP narrative complete", "success");
      setProgress(100);
      addLog("\n🎉 ANALYSIS COMPLETE", "success");

      setTimeout(() => setAppPhase("results"), 600);

    } catch (err: any) {
      setError(err.message);
      addLog(`\n💥 ${err.message}`, "error");
      setAppPhase("analyzing");
    } finally {
      setIsRefining(false);
    }
  }

  function resetApp() {
    setAppPhase("input");
    setLog([]); setError(null); setProgress(0);
    setSiteAnalyses({}); setGapAnalysis(null);
    setContentPlan([]); setIcpAnalysis(null);
    setStratNarr(""); setIcpNarr("");
    analysesRef.current = {}; gapRef.current = null;
    planRef.current = []; icpRef.current = null;
  }

  function buildState(): AnalysisState {
    return {
      sites: sitesRef.current,
      siteAnalyses: analysesRef.current,
      gapAnalysis: gapRef.current,
      contentPlan: planRef.current,
      icpAnalysis: icpRef.current,
      strategyNarrative: stratNarr,
      icpNarrative: icpNarr,
      analystNotes: notesRef.current,
      provider: "anthropic",
      createdAt: new Date().toISOString(),
    };
  }

  function handleLoadJson(state: AnalysisState) {
    sitesRef.current    = state.sites;
    analysesRef.current = state.siteAnalyses;
    gapRef.current      = state.gapAnalysis;
    planRef.current     = state.contentPlan;
    icpRef.current      = state.icpAnalysis;
    notesRef.current    = state.analystNotes;
    setSiteAnalyses(state.siteAnalyses);
    setGapAnalysis(state.gapAnalysis);
    setContentPlan(state.contentPlan);
    setIcpAnalysis(state.icpAnalysis);
    setStratNarr(state.strategyNarrative);
    setIcpNarr(state.icpNarrative);
    setAppPhase("results");
  }

  // ─── Header ────────────────────────────────────────────────────────────────
  const Logo = () => (
    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
      <div style={{ width:32, height:32, borderRadius:8, background:T.accent, display:"flex", alignItems:"center", justifyContent:"center", fontSize:17, fontWeight:900, color:"#fff" }}>⌖</div>
      <div>
        <div style={{ fontSize:16, fontWeight:800, color:T.text, letterSpacing:"-0.5px" }}>
          SaaS<span style={{ color:T.accent }}>Slicer</span>
        </div>
        <div style={{ fontSize:10, color:T.dim, letterSpacing:"0.6px", textTransform:"uppercase" }}>Competitive Content Intelligence</div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:T.bg }}>
      {/* Sticky header */}
      <div style={{ borderBottom:`1px solid ${T.border}`, padding:"12px 24px", background:T.surface, display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:100, boxShadow:"0 1px 3px rgba(0,0,0,0.05)" }}>
        <Logo />
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          {appPhase === "results" && (
            <div style={{ fontSize:12.5, color:T.muted }}>
              <span style={{ color:T.success }}>●</span> Complete · {contentPlan.length} recommendations · {icpAnalysis?.icps.length || 0} ICPs
            </div>
          )}
          {appPhase === "reviewing" && (
            <div style={{ fontSize:12.5, color:T.accent }}>
              <span style={{ color:T.accent }}>●</span> Expert review · {contentPlan.length} items ready
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding:"36px 24px", maxWidth:1200, margin:"0 auto" }}>
        {appPhase === "input" && (
          <InputPhase onStart={startAnalysis} onLoadJson={handleLoadJson} />
        )}
        {(appPhase === "analyzing") && (
          <>
            <AnalysisPhase log={log} phase={subPhase} progress={progress} />
            {error && (
              <div style={{ maxWidth:680, margin:"18px auto 0", background:T.errorBg, border:`1px solid ${T.errorBdr}`, borderRadius:8, padding:"14px 18px" }}>
                <div style={{ fontWeight:700, color:T.error, marginBottom:8 }}>Error</div>
                <div style={{ fontSize:13.5, color:T.error }}>{error}</div>
                <button onClick={resetApp} style={{ marginTop:12, background:"transparent", border:`1px solid ${T.errorBdr}`, color:T.error, padding:"8px 16px", borderRadius:7, cursor:"pointer", fontFamily:"inherit", fontWeight:600 }}>
                  ← Back to Setup
                </button>
              </div>
            )}
          </>
        )}
        {appPhase === "reviewing" && (
          <ReviewPhase
            contentPlan={contentPlan}
            onContinue={handleReviewContinue}
            isRefining={isRefining}
          />
        )}
        {appPhase === "results" && (
          <ResultsPhase
            siteAnalyses={siteAnalyses}
            gapAnalysis={gapAnalysis}
            contentPlan={contentPlan}
            icpAnalysis={icpAnalysis}
            strategyNarrative={stratNarr}
            icpNarrative={icpNarr}
            onUpdateStratNarr={setStratNarr}
            onUpdateIcpNarr={setIcpNarr}
            onExportXLSX={() => exportXLSX(buildState())}
            onExportDoc={() => exportStrategyDoc(buildState())}
            onSaveJson={() => saveJson(buildState())}
            onReset={resetApp}
          />
        )}
      </div>
    </div>
  );
}
