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

    // Build enriched context for Claude
    const clusterSummaries = clusters.map(c => {
      const samplePages = c.crawledPages.filter(p => p.title || p.h1).slice(0, 5);
      const pageDetails = samplePages.length > 0
        ? samplePages.map(p => `    • ${p.title || p.h1} — ${p.metaDescription?.slice(0,80) || "no meta"}`).join("\n")
        : c.urls.slice(0, 5).map(u => `    • ${u}`).join("\n");
      return `[${c.name} — ${c.urls.length} pages, priority: ${c.priority}]\n${pageDetails}`;
    }).join("\n\n");

    const result = await callAIJson<SiteAnalysis>(
      `You are an expert SEO and content strategist. Analyze a site's content strategy from URL patterns and page metadata.
Return ONLY valid JSON matching this shape exactly (no markdown):
{
  "siteId":"","siteName":"","domain":"","isClient":false,"totalUrls":0,"clusters":[],
  "contentStrategySum":"2-3 sentence summary",
  "searchArchitecture":"how they structure content for search",
  "keyThemes":["theme1","theme2"],
  "strengths":["strength1","strength2","strength3"],
  "notableGaps":["gap1","gap2"],
  "contentVelocitySignal":"publishing cadence inference",
  "schemaTypesFound":[]
}`,
      `Analyze this ${site.role.toUpperCase()} site: ${site.name} (${site.domain})
Total URLs: ${site.urls.length}

CONTENT CLUSTERS WITH PAGE METADATA:
${clusterSummaries}

Identify the site's content strategy, architecture, strengths and gaps. Set isClient=${site.role === "client"}, siteId="${site.id}", siteName="${site.name}", domain="${site.domain}", totalUrls=${site.urls.length}.
Include the clusters array with the category types you've identified.`,
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
    return callAIJson<GapAnalysis>(
      `You are a senior SEO strategist. Return ONLY valid JSON:
{"narrative":"string","competitorStrengths":[{"competitor":"","advantage":""}],"clientAdvantages":[""],"gaps":[{"id":"g1","title":"","gapType":"content_category","description":"","priority":"high","opportunity":"","reasoning":"","estimatedPages":0,"funnelStage":"TOFU","competitorsDoing":[],"icpRelevance":[]}]}`,
      `CLIENT: ${clientAn.siteName}
Categories: ${clientAn.clusters.map(c => `${c.name}(${c.urls.length})`).join(", ")}
Strengths: ${clientAn.strengths.join("; ")}
Gaps: ${clientAn.notableGaps.join("; ")}

COMPETITORS:
${compAns.map(c => `${c.siteName}: ${c.clusters.map(cl => `${cl.name}(${cl.urls.length})`).join(", ")}\nStrengths: ${c.strengths.join("; ")}`).join("\n\n")}

Identify ALL significant content gaps. For icpRelevance, use ICP role/industry hints like "VP Legal", "Marketing Manager", "SMB Owner". Keep descriptions under 25 words, opportunities under 20 words.`,
      2000,
      { narrative: "", competitorStrengths: [], clientAdvantages: [], gaps: [] }
    );
  }

  // ─── Content plan (3 batches × 1800 tokens) ─────────────────────────────────
  async function generatePlan(
    clientAn: SiteAnalysis,
    gaps: GapAnalysis,
    notes: string
  ): Promise<ContentItem[]> {
    // Lean system prompt — schema moved to user message to save system token space
    const SYS = `You are a senior content strategist. Return ONLY valid JSON with no markdown fences. Keep page titles under 8 words and coreAngle under 15 words.`;
    const SCHEMA = `{"priority":1,"pageTitle":"","urlSuggestion":"/path","contentType":"","targetQuery":"","funnelStage":"TOFU","intent":"informational","coreAngle":"","action":"net_new","reasoning":"","gapAddressed":"","estimatedEffort":"medium","wordCountTarget":1200,"icpIds":[],"problemsSolved":[]}`;
    const cats = clientAn.clusters.map(c => c.name).join(", ");

    const critical = gaps.gaps.filter(g => g.priority === "critical");
    const high     = gaps.gaps.filter(g => g.priority === "high");
    const other    = gaps.gaps.filter(g => g.priority === "medium" || g.priority === "low");

    function extractItems(resp: string): ContentItem[] {
      const clean = resp.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      // Try direct parse
      try { const p = JSON.parse(clean); return p.items || p || []; } catch {}
      // Try extracting {...}
      const obj = clean.match(/\{[\s\S]+\}/);
      if (obj) { try { const p = JSON.parse(obj[0]); return p.items || []; } catch {} }
      // Try extracting [...]
      const arr = clean.match(/\[[\s\S]+\]/);
      if (arr) { try { return JSON.parse(arr[0]); } catch {} }
      return [];
    }

    async function batch(label: string, batchGaps: typeof gaps.gaps, startAt: number, skip: string[]): Promise<ContentItem[]> {
      if (!batchGaps.length) return [];
      try {
        const resp = await callAI(SYS,
          `Generate 8-10 content plan items for these gaps.
GAPS: ${batchGaps.slice(0, 6).map(g => `${g.title}: ${g.opportunity}`).join(" | ")}
CLIENT CATEGORIES: ${cats}
${skip.length ? `SKIP (already covered): ${skip.join(", ")}` : ""}
NOTES: ${notes || "None"}
Start priority numbering at ${startAt}.
icpIds should be short strings like "vp_legal", "marketing_manager", "smb_owner".
Return ONLY this JSON structure, no commentary:
{"items":[${SCHEMA}]}`,
          1800
        );
        const items = extractItems(resp);
        if (!items.length) addLog(`  ⚠ ${label}: response parsed but returned 0 items`, "warn");
        return items;
      } catch (e: any) {
        addLog(`  ⚠ ${label} failed: ${e.message}`, "warn");
        return [];
      }
    }

    addLog("  Batch 1: critical gaps…");
    const b1 = await batch("Batch 1", critical, 1, []);
    addLog(`  Batch 1: ${b1.length} items`);

    addLog("  Batch 2: high-priority gaps…");
    const b2 = await batch("Batch 2", high, b1.length + 1, b1.slice(0,6).map(i => i.pageTitle));
    addLog(`  Batch 2: ${b2.length} items`);

    addLog("  Batch 3: medium/low gaps…");
    const b3 = await batch("Batch 3", other, b1.length + b2.length + 1, [...b1,...b2].slice(0,6).map(i => i.pageTitle));
    addLog(`  Batch 3: ${b3.length} items`);

    const all = [...b1, ...b2, ...b3];
    if (!all.length) throw new Error("Content plan returned no items. Check that NEXT_PUBLIC_ANTHROPIC_API_KEY is set in Vercel env vars, then retry.");
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

    // Two calls: first 10 ICPs, then up to 10 more
    async function icpBatch(batchNum: number, existingNames: string[]): Promise<ICP[]> {
      const skip = existingNames.length ? `\nSKIP (already defined): ${existingNames.join(", ")}` : "";
      return callAIJson<{ icps: ICP[] }>(
        `You are a B2B content strategist and customer research expert.
Identify distinct ICPs (Ideal Customer Profiles) that competitor sites are serving but the client is missing or underserving.
Return ONLY valid JSON: {"icps":[${ICP_SCHEMA}]}
Generate 8-10 DISTINCT ICPs. Each must have a unique role+industry combination.
Scoring: clientCoverageScore=how well client currently serves them (0-100), priorityScore=strategic importance (0-100), gapScore=size of content gap (0-100).`,
        `CLIENT: ${clientAn.siteName}
Client categories: ${clientAn.clusters.map(c => c.name).join(", ")}
Client strengths: ${clientAn.strengths.join("; ")}
Client gaps: ${clientAn.notableGaps.join("; ")}

COMPETITORS AND THEIR CONTENT FOCUS:
${compAns.map(c => `${c.siteName}: ${c.clusters.map(cl => `${cl.name}(${cl.urls.length})`).join(", ")} | ${c.searchArchitecture}`).join("\n")}

TOP CONTENT GAPS:
${gaps.gaps.slice(0, 10).map(g => `- ${g.title} [${g.priority}]: ${g.opportunity}`).join("\n")}

ANALYST NOTES: ${notes || "None"}
${skip}

Identify ${batchNum === 1 ? "the first 8-10 most important" : "8-10 more distinct"} ICPs these competitors are clearly targeting that the client should also be serving. Focus on: industry × role combinations, specific pain points, actual search queries and AI prompts they would use.`,
        2500,
        { icps: [] }
      ).then(r => r.icps || []);
    }

    addLog("  Generating ICP batch 1 (up to 10 ICPs)…");
    const batch1 = await icpBatch(1, []);
    addLog(`  ${batch1.length} ICPs identified`, "success");

    addLog("  Generating ICP batch 2 (additional ICPs)…");
    const batch2 = await icpBatch(2, batch1.map(i => i.name));
    addLog(`  ${batch2.length} additional ICPs identified`, "success");

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
