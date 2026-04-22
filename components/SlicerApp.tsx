"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { callAI, callAIJson, callAIJsonStrict, AIParseError, onFallback, setAICallPhase } from "@/lib/ai";
import { clusterUrls } from "@/lib/cluster";
import { exportXLSX, exportStrategyDoc, exportMarkdown, saveJson } from "@/lib/export";
import { T } from "@/lib/design";
import type {
  SiteInput, SiteAnalysis, UrlCluster, CrawledPage,
  GapAnalysis, ContentItem, ICPAnalysis, ICP, AnalysisState, LogEntry,
  ContentCluster, PlanDelta,
} from "@/lib/types";
import { hydrateContentItem, linkPlanToICPs, CLUSTER_LABELS } from "@/lib/types";

import InputPhase   from "./phases/InputPhase";
import AnalysisPhase from "./phases/AnalysisPhase";
import ReviewPhase  from "./phases/ReviewPhase";
import ResultsPhase from "./phases/ResultsPhase";

type AppPhase = "input" | "analyzing" | "reviewing" | "results";

export type SubPhase = "cluster" | "crawl" | "analyze" | "gap" | "plan" | "icp" | "narrative";

const CRAWL_BATCH = 5;
const CONFIDENCE_THRESHOLD = 75;
const MAX_CRAWL_PER_CLUSTER = 20;

// ═══════════════════════════════════════════════════════════════════════════════
// Cluster-by-cluster content plan generation.
// Each entry defines one of the 8 content plan batches the pipeline will run.
// ═══════════════════════════════════════════════════════════════════════════════
interface ClusterBatchSpec {
  cluster: ContentCluster;
  label: string;
  focus: string;
  allowedPageTypes: string[];
  targetCount: number;          // items per batch target
  funnelGuidance: string;
  pageTypeGuidance: string;
}

const CLUSTER_BATCHES: ClusterBatchSpec[] = [
  {
    cluster: "core_platform",
    label: "Core Platform Pillars",
    focus: "Primary product/solution pillar pages — the commercial anchors that must exist for category ownership",
    allowedPageTypes: ["product_pillar", "solution_landing_page"],
    targetCount: 6,
    funnelGuidance: "Primarily BOFU (commercial investigation). These are the pages buyers land on when they know what they need.",
    pageTypeGuidance: "Use product_pillar for the canonical product category page, solution_landing_page for specific solution/capability pages.",
  },
  {
    cluster: "role_solutions",
    label: "Role / Persona Pages",
    focus: "Dedicated pages for each buyer role the client should own (VP Legal, Procurement, Ops, CFO, etc.)",
    allowedPageTypes: ["role_page", "solution_landing_page"],
    targetCount: 6,
    funnelGuidance: "Primarily BOFU (commercial investigation). Written for the role's specific jobs-to-be-done and pain framing.",
    pageTypeGuidance: "Use role_page for persona-specific landing pages. Every item in this batch MUST cluster=role_solutions.",
  },
  {
    cluster: "industry_verticals",
    label: "Industry Vertical Pages",
    focus: "Industry-specific pages (healthcare, financial services, manufacturing, construction, SaaS, etc.)",
    allowedPageTypes: ["industry_page"],
    targetCount: 7,
    funnelGuidance: "Primarily BOFU. Each page targets 'X software/platform/solution for [industry]' buyer queries.",
    pageTypeGuidance: "Use industry_page for every item. Target verticals competitors serve that client is missing or underserving.",
  },
  {
    cluster: "topic_guides",
    label: "Topic & Subject-Matter Guides",
    focus: "Durable topic-cluster guides that capture informational and mid-funnel search (contract guides, clause guides, workflow guides, concept guides)",
    allowedPageTypes: ["topic_guide"],
    targetCount: 8,
    funnelGuidance: "Primarily MOFU (informational + commercial). These are long-lived evergreen assets that convert both by depth and by link-building.",
    pageTypeGuidance: "Use topic_guide for subject-matter pillar content. Name each guide after the specific subject.",
  },
  {
    cluster: "services_led",
    label: "Services-Led Offerings",
    focus: "Managed services, implementation packages, consulting, hybrid software+service offerings — the true product differentiators",
    allowedPageTypes: ["service_page"],
    targetCount: 4,
    funnelGuidance: "BOFU (transactional). These are conversion assets for buyers who want the outcome, not just the tool.",
    pageTypeGuidance: "Use service_page. Only recommend services-led pages if the client appears to offer managed/hybrid services. If they're software-only, recommend fewer items or skip.",
  },
  {
    cluster: "commercial_education",
    label: "Commercial Education — Comparisons & Buyer Guides",
    focus: "Comparison pages (vs competitors, vs alternatives, vs adjacent categories), best-of lists, buyer guides, ROI frameworks",
    allowedPageTypes: ["comparison_page", "gated_guide"],
    targetCount: 7,
    funnelGuidance: "BOFU and late MOFU (commercial investigation). Target 'best X', 'X alternative', 'X vs Y', 'X buyers guide' queries.",
    pageTypeGuidance: "comparison_page for vs/alternative pages; gated_guide for buyer-guide-style assets.",
  },
  {
    cluster: "proof_and_hubs",
    label: "Proof & Customer Story Hubs",
    focus: "Customer story hubs organized by industry/role/outcome, case study landing pages, trust/security pages, results showcases",
    allowedPageTypes: ["customer_story_hub"],
    targetCount: 4,
    funnelGuidance: "MOFU to BOFU. Proof assets that convert evaluators.",
    pageTypeGuidance: "Use customer_story_hub. Organize by segment (industry/role/outcome) rather than scattering stories individually.",
  },
  {
    cluster: "interactive_tools",
    label: "Interactive Tools & Resources",
    focus: "Calculators (ROI, cost, risk), self-assessments, configurators, templates, downloadable frameworks",
    allowedPageTypes: ["interactive_tool", "template_resource"],
    targetCount: 4,
    funnelGuidance: "Mixed TOFU/MOFU. Link-magnet assets that also serve as lead-capture surfaces.",
    pageTypeGuidance: "interactive_tool for calculators/assessments; template_resource for downloadable frameworks.",
  },
];

export default function SlicerApp() {
  const [appPhase,    setAppPhase]    = useState<AppPhase>("input");
  const [subPhase,    setSubPhase]    = useState<SubPhase>("cluster");
  const [progress,    setProgress]    = useState(0);
  const [log,         setLog]         = useState<LogEntry[]>([]);
  const [error,       setError]       = useState<string | null>(null);
  const [isRefining,  setIsRefining]  = useState(false);

  const [siteAnalyses, setSiteAnalyses] = useState<Record<string, SiteAnalysis>>({});
  const [gapAnalysis,  setGapAnalysis]  = useState<GapAnalysis | null>(null);
  const [contentPlan,  setContentPlan]  = useState<ContentItem[]>([]);
  const [icpAnalysis,  setIcpAnalysis]  = useState<ICPAnalysis | null>(null);
  const [stratNarr,    setStratNarr]    = useState("");
  const [icpNarr,      setIcpNarr]      = useState("");

  const sitesRef      = useRef<SiteInput[]>([]);
  const notesRef      = useRef("");
  const analysesRef   = useRef<Record<string, SiteAnalysis>>({});
  const gapRef        = useRef<GapAnalysis | null>(null);
  const planRef       = useRef<ContentItem[]>([]);
  const icpRef        = useRef<ICPAnalysis | null>(null);

  const addLog = useCallback((msg: string, type: LogEntry["type"] = "info") => {
    setLog(p => [...p, { msg, type, ts: Date.now() }]);
  }, []);

  // ─── Centralized error surfacing ─────────────────────────────────────────────
  // Every caller that encounters an AI/JSON failure funnels through here so the
  // user sees a consistent, loud error in the log panel with response preview.
  const logAIFailure = useCallback((phase: string, err: unknown) => {
    if (err instanceof AIParseError) {
      addLog(`❌ ${phase}: JSON parse failed — ${err.message}`, "error");
      addLog(`   Response preview: ${err.rawResponse.slice(0, 240).replace(/\s+/g, " ")}…`, "error");
    } else if (err instanceof Error) {
      addLog(`❌ ${phase}: ${err.message}`, "error");
    } else {
      addLog(`❌ ${phase}: unknown error`, "error");
    }
  }, [addLog]);

  // ─── Fallback listener ──────────────────────────────────────────────────────
  // Surfaces Opus→Sonnet fallback events in the log panel. Fired when Opus
  // fails (API error or JSON parse) and ai.ts silently recovers on Sonnet 4.6.
  // Users see that the system self-healed — not a silent black box.
  useEffect(() => {
    onFallback((info) => {
      const label = info.phase ? `${info.phase} — ` : "";
      // Truncate long error messages to keep log tidy
      const reason = info.reason.length > 120 ? info.reason.slice(0, 117) + "…" : info.reason;
      addLog(`🔄 ${label}Opus failed, retrying on Sonnet 4.6: ${reason}`, "warn");
    });
    return () => { onFallback(null); };
  }, [addLog]);

  // ─── Adaptive crawl loop ────────────────────────────────────────────────────
  async function adaptiveCrawl(
    cluster: UrlCluster,
    siteName: string
  ): Promise<CrawledPage[]> {
    const { urls, priority } = cluster;
    const pages: CrawledPage[] = [];

    if (priority === "low" || urls.length === 0) return pages;

    let initialSample: number;
    if (priority === "critical") {
      initialSample = urls.length <= 5 ? urls.length : 5;
    } else if (priority === "high") {
      initialSample = urls.length <= 8 ? urls.length : 5;
    } else {
      initialSample = urls.length <= 10 ? urls.length : Math.min(Math.ceil(urls.length * 0.3), 15);
    }

    const firstBatch = urls.slice(0, initialSample);
    const firstPages = await crawlBatch(firstBatch);
    pages.push(...firstPages);

    if (priority !== "critical" && priority !== "high") return pages;

    let confidence = await scoreConfidence(cluster, pages, siteName);
    addLog(`  ${cluster.name}: ${pages.length} pages, confidence ${confidence}/100`, confidence >= CONFIDENCE_THRESHOLD ? "success" : "info");

    if (confidence < CONFIDENCE_THRESHOLD && pages.length < MAX_CRAWL_PER_CLUSTER) {
      const nextBatch = urls.slice(pages.length, pages.length + CRAWL_BATCH);
      if (nextBatch.length > 0) {
        pages.push(...await crawlBatch(nextBatch));
        confidence = await scoreConfidence(cluster, pages, siteName);
        addLog(`  ${cluster.name}: ${pages.length} pages after retry, confidence ${confidence}/100`, confidence >= CONFIDENCE_THRESHOLD ? "success" : "warn");
      }
    }

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
        500,
        { confidence: 60, reasoning: "default" }
      );
      return Math.max(0, Math.min(100, result.confidence || 60));
    } catch { return 60; }
  }

  // ─── Site analysis ──────────────────────────────────────────────────────────
  async function analyzeSite(site: SiteInput): Promise<SiteAnalysis> {
    const clusters = clusterUrls(site.urls);
    addLog(`  Clustered into ${clusters.length} categories`, "info");

    setSubPhase("crawl");
    for (const cluster of clusters) {
      addLog(`  Crawling ${cluster.name} (${cluster.urls.length} URLs)…`);
      cluster.crawledPages = await adaptiveCrawl(cluster, site.name);
      cluster.crawlStatus = "done";
    }

    setSubPhase("analyze");

    const clusterSummaries = clusters.map(c => {
      const crawled = c.crawledPages.filter(p => p.title || p.h1).slice(0, 6);
      if (!crawled.length) {
        return `[${c.name} — ${c.urls.length} pages | not crawled]\n${c.urls.slice(0, 4).map(u => `    • ${u}`).join("\n")}`;
      }
      const pageLines = crawled.map(p => {
        const heading = p.title || p.h1;
        const depth = p.wordCount > 1500 ? "deep" : p.wordCount > 600 ? "medium" : "thin";
        const h2Preview = (p.h2s || []).slice(0, 4).join(" · ");
        const date = p.publishedDate ? ` [${p.publishedDate.slice(0,7)}]` : "";
        return `    • ${heading}${date} (${depth}, ~${p.wordCount}w)${h2Preview ? "\n      Topics: " + h2Preview : ""}`;
      }).join("\n");
      return `[${c.name} — ${c.urls.length} pages | crawled: ${crawled.length}]\n${pageLines}`;
    }).join("\n\n");

    const allIntegrations = clusters
      .flatMap(c => c.crawledPages.flatMap(p => p.integrationsWith || []))
      .filter(Boolean);
    const integrationsEcosystem = [...new Set(allIntegrations)];

    const totalCrawled = clusters.reduce((s, c) => s + c.crawledPages.length, 0);
    const datedPages = clusters.flatMap(c => c.crawledPages.filter(p => p.publishedDate));
    const dateConfidence = totalCrawled > 0 ? Math.round((datedPages.length / totalCrawled) * 100) : 0;
    const recentPages = datedPages.filter(p => {
      const d = new Date(p.publishedDate);
      const sixMonthsAgo = new Date(); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      return d > sixMonthsAgo;
    }).length;

    const wordCounts = clusters.flatMap(c => c.crawledPages.map(p => p.wordCount || 0)).filter(w => w > 0);
    const avgWordCount = wordCounts.length > 0 ? Math.round(wordCounts.reduce((a,b) => a+b, 0) / wordCounts.length) : 0;
    const wordCountConfidence = totalCrawled > 0 ? Math.round((wordCounts.length / totalCrawled) * 100) : 0;
    const integrationPageCount = clusters.flatMap(c => c.urls).filter(u => u.toLowerCase().includes("integrat")).length;

    const contentDepthProfile = [
      `Crawled ${totalCrawled} pages total.`,
      dateConfidence >= 30
        ? `Publication dates: ${datedPages.length}/${totalCrawled} pages (${dateConfidence}% coverage). ${recentPages} published in last 6 months. COMPARABLE.`
        : `Publication dates: ${datedPages.length}/${totalCrawled} pages (${dateConfidence}% coverage). NOT ENOUGH FOR VELOCITY COMPARISON — observe only.`,
      wordCountConfidence >= 40
        ? `Avg content depth: ~${avgWordCount} words (${wordCounts.length} pages measured). COMPARABLE.`
        : `Content depth: ${wordCounts.length} pages measured (${wordCountConfidence}% coverage). NOT ENOUGH FOR DEPTH COMPARISON — observe only.`,
      integrationPageCount > 0
        ? `Integration pages found: ${integrationPageCount}. COMPARABLE.`
        : `Integration pages: none detected. OBSERVE ONLY.`,
    ].join(" ");

    const presentTypes = new Set(clusters.map(c => c.categoryType));
    const allTypes = ["industry_vertical","who_we_serve","comparison","case_study","solution","product_service","resource_guide","landing_page","pricing"];
    const missingTypes = allTypes.filter(t => !presentTypes.has(t as any));

    setAICallPhase(`Site analysis: ${site.name}`);
    try {
      const result = await callAIJsonStrict<SiteAnalysis>(
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

CONTENT ARCHITECTURE WITH DEPTH SIGNALS:
${clusterSummaries}

INTEGRATION ECOSYSTEM:
${integrationsEcosystem.length ? integrationsEcosystem.join(", ") : "none detected"}

CONTENT DEPTH PROFILE:
${contentDepthProfile}

CONTENT TAXONOMY GAPS (categories with zero pages):
${missingTypes.join(", ")}

For notableGaps be VERY SPECIFIC: name exact verticals, roles, and page types absent.
For strengths be SPECIFIC: mention category names, page counts, and content depth where evident.
For contentVelocitySignal: ONLY estimate publishing frequency if dateConfidence >= 30% (marked COMPARABLE above). Otherwise state "insufficient date data to assess velocity."
For notableGaps/strengths referencing word count or content depth: ONLY include if wordCountConfidence >= 40%.
RULE: If a signal is marked "OBSERVE ONLY" — report it but do NOT make a comparative claim.
Set: isClient=${site.role === "client"}, siteId="${site.id}", siteName="${site.name}", domain="${site.domain}", totalUrls=${site.urls.length}`,
        4000
      );

      return {
        ...result,
        siteId: site.id, siteName: site.name, domain: site.domain,
        isClient: site.role === "client", totalUrls: site.urls.length,
        clusters, integrationsEcosystem, contentDepthProfile,
      };
    } catch (err) {
      logAIFailure(`Site analysis (${site.name})`, err);
      // Return minimal viable analysis so pipeline can continue for competitor sites.
      // For client, the orchestrator will re-throw and abort.
      return {
        siteId: site.id, siteName: site.name, domain: site.domain,
        isClient: site.role === "client", totalUrls: site.urls.length,
        clusters, contentStrategySum: "Analysis failed — see log.",
        searchArchitecture: "", keyThemes: [],
        strengths: [], notableGaps: [], contentVelocitySignal: "",
        schemaTypesFound: [], integrationsEcosystem, contentDepthProfile,
      };
    }
  }

  // ─── Gap analysis — 2 batches for reliability ───────────────────────────────
  // Batch 1: structural gaps (missing categories, verticals, roles) — always reliable
  // Batch 2: comparison/depth gaps — requires richer reasoning
  async function runGapAnalysis(
    clientAn: SiteAnalysis,
    compAns: SiteAnalysis[]
  ): Promise<GapAnalysis> {
    function siteInventory(an: SiteAnalysis) {
      return an.clusters.map(c => {
        const sample = c.crawledPages.filter(p => p.title).slice(0, 4).map(p => p.title).join("; ");
        return `  ${c.name}: ${c.urls.length} pages${sample ? " | e.g. " + sample : ""}`;
      }).join("\n");
    }

    const clientInventory = siteInventory(clientAn);
    const compInventories = compAns.map(c => `${c.siteName} (${c.totalUrls} URLs):\n${siteInventory(c)}`).join("\n\n");

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

    const context = `CLIENT SITE: ${clientAn.siteName} (${clientAn.totalUrls} URLs)
Content strategy: ${clientAn.contentStrategySum}
Search architecture: ${clientAn.searchArchitecture}

WHAT CLIENT HAS:
${clientInventory}

CLIENT STRENGTHS: ${clientAn.strengths.join(" | ")}
CLIENT NOTABLE GAPS: ${clientAn.notableGaps.join(" | ")}

COMPETITOR SITES:
${compInventories}

CONTENT CATEGORIES COMPETITORS HAVE THAT CLIENT IS MISSING:
${missingCats || "(analyse the inventories above to identify gaps)"}

ANALYST NOTES: ${notesRef.current || "None"}`;

    async function gapBatch(
      batchName: string,
      focus: string,
      targetCount: string,
      existingTitles: string[]
    ): Promise<{ gaps: GapAnalysis["gaps"]; narrative?: string; competitorStrengths?: any[]; clientAdvantages?: string[] }> {
      const skipClause = existingTitles.length
        ? `\nSKIP gaps already covered (do not duplicate these): ${existingTitles.slice(0, 15).join(" | ")}`
        : "";
      addLog(`  ${batchName}: requesting ${targetCount}…`);
      setAICallPhase(batchName);
      try {
        const result = await callAIJsonStrict<{
          narrative: string;
          competitorStrengths: { competitor: string; advantage: string }[];
          clientAdvantages: string[];
          gaps: GapAnalysis["gaps"];
        }>(
          `You are a senior B2B SaaS content strategist. Identify significant content gaps the client has vs competitors.
Focus for THIS batch: ${focus}
Return ONLY valid JSON:
{"narrative":"3-4 sentence strategic summary","competitorStrengths":[{"competitor":"","advantage":""}],"clientAdvantages":[""],"gaps":[{"id":"g1","title":"","gapType":"content_category","description":"","priority":"critical|high|medium|low","opportunity":"","reasoning":"","estimatedPages":0,"funnelStage":"TOFU|MOFU|BOFU","competitorsDoing":[],"icpRelevance":[]}]}
Priority guide: critical=major category with 0 client pages, high=underdeveloped vs competitors, medium=behind on depth/breadth, low=nice to have.`,
          `${context}

BATCH FOCUS: ${focus}
TARGET: ${targetCount}
${skipClause}

For each gap:
- title: specific page type (e.g. "Construction Industry Landing Page", "VP Legal Role Page", "vs Competitor X")
- icpRelevance: specific roles affected
- Keep descriptions under 20 words, opportunities under 15 words

CONFIDENCE RULES:
- Structural gaps (missing category/page type): always valid — absence provable by URL inventory
- Depth gaps (competitor has deeper content): ONLY if wordCountConfidence COMPARABLE on both sides
- Velocity gaps: ONLY if publication dates COMPARABLE on both sides
- Integration gaps: ONLY if both sides show CONFIRMED integrations`,
          4000
        );
        addLog(`  ${batchName}: ${result.gaps?.length || 0} gaps`, (result.gaps?.length || 0) > 0 ? "success" : "warn");
        return result;
      } catch (err) {
        logAIFailure(`Gap ${batchName}`, err);
        return { gaps: [] };
      }
    }

    // Batch 1 — structural gaps (missing categories, verticals, roles, comparison pages)
    const b1 = await gapBatch(
      "Gap Batch 1 — Structural",
      "structural gaps: missing content categories, missing industry verticals, missing role/persona pages, missing comparison/vs pages, missing customer-proof content. These are provable by URL-inventory absence. Target 10-14 gaps.",
      "10-14 structural gaps",
      []
    );

    // Batch 2 — depth/format/ICP gaps (more subjective, run separately so b1 is safe)
    const b2 = await gapBatch(
      "Gap Batch 2 — Depth & Format",
      "depth/format/ICP gaps: topics where competitors have deeper content, formats client lacks (calculators, buyer guides, gated assets), ICP coverage gaps, resource/education gaps. Target 6-10 gaps.",
      "6-10 depth/format/ICP gaps",
      (b1.gaps || []).map(g => g.title).slice(0, 15)
    );

    const allGaps = [...(b1.gaps || []), ...(b2.gaps || [])].map((g, i) => ({
      ...g,
      id: g.id || `g${i + 1}`,
    }));

    return {
      narrative: b1.narrative || b2.narrative || "",
      competitorStrengths: b1.competitorStrengths || b2.competitorStrengths || [],
      clientAdvantages: b1.clientAdvantages || b2.clientAdvantages || [],
      gaps: allGaps,
    };
  }

  // ─── Content plan — 8 cluster batches with source material enrichment ───────
  async function generatePlan(
    clientAn: SiteAnalysis,
    gaps: GapAnalysis,
    notes: string
  ): Promise<ContentItem[]> {
    // Build detailed client URL inventory with titles where available.
    // This is what Claude uses to populate sourceMaterial on refresh/repurpose items.
    const clientUrlInventory: Array<{ path: string; title: string; category: string }> = [];
    for (const c of clientAn.clusters) {
      const crawledByUrl: Record<string, string> = {};
      for (const p of c.crawledPages) {
        try {
          crawledByUrl[new URL(p.url).pathname] = p.title || p.h1 || "";
        } catch {}
      }
      for (const u of c.urls) {
        try {
          const path = new URL(u).pathname;
          if (path && path !== "/") {
            clientUrlInventory.push({
              path,
              title: crawledByUrl[path] || "",
              category: c.name,
            });
          }
        } catch {}
      }
    }
    // Sort to prioritize URLs with titles (crawled pages)
    clientUrlInventory.sort((a, b) => (b.title ? 1 : 0) - (a.title ? 1 : 0));

    // Compact the inventory for prompt inclusion — keep top ~120
    const inventoryForPrompt = clientUrlInventory
      .slice(0, 120)
      .map(e => e.title ? `  ${e.path} → "${e.title.slice(0, 80)}"` : `  ${e.path}`)
      .join("\n");

    addLog(`  Inventory prepared: ${clientUrlInventory.length} client URLs (${clientUrlInventory.filter(e => e.title).length} with titles)`);

    const catsSummary = clientAn.clusters.map(c => `${c.name}(${c.urls.length})`).join(", ");
    const topGaps = (gaps.gaps || []).slice(0, 20).map(g => `${g.title}: ${g.opportunity}`).join(" | ");

    async function planBatch(spec: ClusterBatchSpec, existingTitles: string[]): Promise<ContentItem[]> {
      const skipClause = existingTitles.length
        ? `\nSKIP titles already planned (don't duplicate): ${existingTitles.slice(0, 8).join(" | ")}`
        : "";

      const SCHEMA = `{
  "priorityTier":"P1|P2|P3",
  "cluster":"${spec.cluster}",
  "pageTitle":"≤10 words",
  "urlSuggestion":"/suggested/path",
  "contentType":"short descriptor",
  "pageTypeCategory":"one of: ${spec.allowedPageTypes.join("|")}",
  "targetQuery":"primary SEO query (3-6 words)",
  "funnelStage":"TOFU|MOFU|BOFU",
  "intent":"informational|commercial|navigational|transactional",
  "coreAngle":"≤14 words — strategic positioning",
  "action":"net_new|refresh|repurpose",
  "sourceMaterial":{
    "action":"consolidate|upgrade|pull_from|none",
    "urls":["/existing/client/path"],
    "note":"≤20 words instruction — e.g. 'Consolidate overlap from /blog/a, /blog/b, /blog/c'"
  },
  "reasoning":"≤25 words — why this page earns placement in the plan",
  "gapAddressed":"which gap title this closes, or 'category-ownership' if structural",
  "estimatedEffort":"low|medium|high",
  "wordCountTarget":1200,
  "icpIds":["role_slug1","role_slug2"],
  "problemsSolved":["specific buyer problem 1","specific buyer problem 2"]
}`;

      addLog(`  ▸ ${spec.label}…`);
      setAICallPhase(spec.label);
      try {
        const result = await callAIJsonStrict<{ items: ContentItem[] }>(
          `You are a senior B2B SaaS content strategist generating ONE cluster of a multi-batch content plan.
This batch covers ONLY the "${spec.label}" cluster. Every item MUST set cluster="${spec.cluster}".
Return ONLY valid JSON, no markdown: {"items":[${SCHEMA}]}`,
          `CLUSTER: ${spec.cluster} — ${spec.label}
CLUSTER FOCUS: ${spec.focus}
FUNNEL GUIDANCE: ${spec.funnelGuidance}
PAGE TYPE GUIDANCE: ${spec.pageTypeGuidance}
TARGET COUNT: ${spec.targetCount} items (range: ${Math.max(2, spec.targetCount - 2)}-${spec.targetCount + 2})

CLIENT: ${clientAn.siteName}
CLIENT CATEGORIES: ${catsSummary}
CLIENT STRENGTHS: ${clientAn.strengths.slice(0, 3).join(" | ")}
CLIENT NOTABLE GAPS: ${clientAn.notableGaps.slice(0, 4).join(" | ")}

IDENTIFIED GAPS (all clusters): ${topGaps.slice(0, 900)}

CLIENT EXISTING URL INVENTORY (use this for sourceMaterial lookup on refresh/repurpose items):
${inventoryForPrompt}

ANALYST NOTES: ${notes || "None"}
${skipClause}

ACTION RULES:
- "refresh" when a CLOSELY matching URL exists in the inventory above — set sourceMaterial.action="upgrade" and sourceMaterial.urls=[the existing path]
- "repurpose" when relevant blog/content exists but needs a new format — set sourceMaterial.action="pull_from" and sourceMaterial.urls=[relevant existing paths]
- "net_new" when no relevant existing URL — set sourceMaterial.action="none", urls=[], note=""
- CRITICAL: if 2+ overlapping blog posts exist on the same topic, recommend "refresh" with sourceMaterial.action="consolidate" and list ALL overlapping URLs. Example note: "Consolidate overlap from /blog/foo, /blog/bar, /blog/baz into canonical page."

PRIORITY TIER:
- P1: primary strategic pages this cluster must own for category/vertical/role leadership
- P2: important secondary pages that reinforce the P1 foundation
- P3: nice-to-have coverage

icpIds use snake_case role slugs like: vp_legal, procurement_manager, in_house_counsel, compliance_officer, sales_ops, cfo, it_security, contract_manager, legal_ops, operations_manager
problemsSolved: 2 specific buyer problems max.
Every item MUST have pageTypeCategory from this allowed list: ${spec.allowedPageTypes.join(", ")}.`,
          4500
        );
        const items = (result.items || []).map(raw => {
          // Hydrate with defaults to guard against missing fields in Claude output
          const h = hydrateContentItem(raw);
          // Force cluster consistency — Claude sometimes drifts
          h.cluster = spec.cluster;
          return h;
        });
        addLog(`  ✓ ${spec.label}: ${items.length} items`, items.length > 0 ? "success" : "warn");
        return items;
      } catch (err) {
        logAIFailure(`Plan batch: ${spec.label}`, err);
        return [];
      }
    }

    const allItems: ContentItem[] = [];
    for (let i = 0; i < CLUSTER_BATCHES.length; i++) {
      const spec = CLUSTER_BATCHES[i];
      // Rate-limit spacer between batches (Anthropic + prompt size = polite pacing helps)
      if (i > 0) await new Promise(r => setTimeout(r, 1500));
      const existingTitles = allItems.slice(-12).map(i => i.pageTitle);
      const items = await planBatch(spec, existingTitles);
      allItems.push(...items);
    }

    if (!allItems.length) {
      throw new Error("Content plan produced 0 items across all 8 clusters. Check the log panel for per-batch errors. Ensure NEXT_PUBLIC_ANTHROPIC_API_KEY is set in Vercel.");
    }

    // Assign sequential priority numbers while preserving cluster-batch ordering
    return allItems.map((item, idx) => ({ ...item, priority: idx + 1 }));
  }

  // ─── ICP generation — 4 smaller batches for reliability ────────────────────
  async function generateICPs(
    clientAn: SiteAnalysis,
    compAns: SiteAnalysis[],
    gaps: GapAnalysis,
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

    const clientCats = clientAn.clusters.map(c => `${c.name}(${c.urls.length})`).join(", ");

    // Parallel review fetch, non-blocking
    addLog("  Fetching buyer reviews (parallel, non-blocking)…");
    const reviewMap: Record<string, string> = {};
    const allSites = [...compAns, clientAn];
    const reviewResults = await Promise.allSettled(
      allSites.map(comp =>
        Promise.race([
          fetch("/api/reviews", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productName: comp.siteName, domain: comp.domain }),
          }).then(r => r.json()).then(data => ({ siteName: comp.siteName, data })),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 12000)),
        ])
      )
    );
    for (const result of reviewResults) {
      if (result.status === "fulfilled") {
        const { siteName, data } = result.value as { siteName: string; data: any };
        if (data?.found && data.reviewSnippets?.length) {
          reviewMap[siteName] = data.reviewSnippets.slice(0, 12).join(" ||| ");
          addLog(`  ✓ ${siteName}: ${data.reviewSnippets.length} reviews from ${data.source}`, "success");
        } else {
          addLog(`  ${siteName}: no reviews found`, "info");
        }
      } else {
        addLog(`  Review fetch skipped (timeout) — continuing without`, "info");
      }
    }
    addLog(`  Reviews: ${Object.keys(reviewMap).length}/${allSites.length} sites had data`);

    const compDetails = compAns.map(c => {
      const cats = c.clusters.map(cl => `${cl.name}(${cl.urls.length})`).join(", ");
      const rolePages = c.clusters.filter(cl => cl.categoryType === "who_we_serve")
        .flatMap(cl => cl.crawledPages.filter(p => p.title).slice(0,6).map(p => {
          const h2s = (p.h2s || []).slice(0,3).join(", ");
          return p.title + (h2s ? ` [topics: ${h2s}]` : "");
        }));
      const vertPages = c.clusters.filter(cl => cl.categoryType === "industry_vertical")
        .flatMap(cl => cl.crawledPages.filter(p => p.title).slice(0,6).map(p => {
          const h2s = (p.h2s || []).slice(0,3).join(", ");
          return p.title + (h2s ? ` [topics: ${h2s}]` : "");
        }));
      const compPages = c.clusters.filter(cl => cl.categoryType === "comparison")
        .flatMap(cl => cl.crawledPages.filter(p => p.title).slice(0,4).map(p => p.title));
      const integrations = (c.integrationsEcosystem || []).slice(0, 10);
      const reviews = reviewMap[c.siteName] || "";
      const integrationsNote = integrations.length > 0
        ? `CONFIRMED: ${integrations.join(", ")}`
        : "NOT DETECTED";
      return `${c.siteName}:
  Categories: ${cats}
  Strategy: ${c.contentStrategySum}
  Integrations: ${integrationsNote}
  Role pages: ${rolePages.slice(0,6).join(" | ") || "none"}
  Vertical pages: ${vertPages.slice(0,6).join(" | ") || "none"}
  Comparison pages: ${compPages.slice(0,4).join(" | ") || "none"}
  Reviews: ${reviews ? "CONFIRMED — " + reviews.slice(0, 350) : "NOT AVAILABLE"}`;
    }).join("\n\n");

    const clientIntegrations = (clientAn.integrationsEcosystem || []);
    const clientIntegrationNote = clientIntegrations.length > 0
      ? `CONFIRMED: ${clientIntegrations.join(", ")}`
      : "NOT DETECTED";
    const clientReviews = reviewMap[clientAn.siteName] || "";

    const baseContext = `CLIENT: ${clientAn.siteName}
Categories: ${clientCats}
Strengths: ${clientAn.strengths.join("; ")}
Gaps: ${clientAn.notableGaps.join("; ")}
Integrations: ${clientIntegrationNote}
Reviews: ${clientReviews ? "CONFIRMED: " + clientReviews.slice(0, 300) : "NOT AVAILABLE"}

COMPETITOR CONTENT ANALYSIS:
${compDetails}

TOP CONTENT GAPS:
${gaps.gaps.slice(0, 10).map(g => `- ${g.title} [${g.priority}] → ${g.opportunity} | Affects: ${(g.icpRelevance||[]).join(", ")}`).join("\n")}

ANALYST NOTES: ${notes || "None"}`;

    async function icpBatch(batchLabel: string, focus: string, targetCount: number, existingNames: string[]): Promise<ICP[]> {
      const skip = existingNames.length ? `\nDO NOT duplicate these existing ICPs: ${existingNames.join(", ")}` : "";
      addLog(`  ▸ ${batchLabel}…`);
      setAICallPhase(batchLabel);
      try {
        const result = await callAIJsonStrict<{ icps: ICP[] }>(
          `You are a B2B SaaS content strategist and ICP researcher.
Identify DISTINCT Ideal Customer Profiles (ICPs) — each a unique role × industry combination.
This batch focuses on: ${focus}
Return ONLY valid JSON: {"icps":[${ICP_SCHEMA}]}
Scoring: clientCoverageScore=how well client serves them now (0-100), priorityScore=strategic value (0-100), gapScore=content gap size (0-100).`,
          `${baseContext}
${skip}

BATCH FOCUS: ${focus}
TARGET: ${targetCount} ICPs

CONFIDENCE RULES (apply to every ICP):
- Use reviewer language for pains only if reviews CONFIRMED for a site. If NOT AVAILABLE, infer from page titles/H2s and note as "inferred from content".
- Integration-based inferences only if integrations CONFIRMED.
- Content depth comparisons only if contentDepthProfile COMPARABLE.
- One-sided observations valid as observations, NOT as comparisons.

For each ICP:
- primaryPains: use CONFIRMED review language where available, else infer with note
- searchQueries: 4-6 specific long-tail queries
- aiPrompts: 3-4 conversational problem-framed prompts
- tofu/mofu/bofuContentNeeds: specific content formats + topics
- sourceCompetitor: which competitor's content/reviews surfaced this ICP

Focus on role × industry combinations visible in competitor content but ABSENT from client content.`,
          4500
        );
        const icps = result.icps || [];
        addLog(`  ✓ ${batchLabel}: ${icps.length} ICPs`, icps.length > 0 ? "success" : "warn");
        return icps;
      } catch (err) {
        logAIFailure(`ICP ${batchLabel}`, err);
        return [];
      }
    }

    // 4 smaller batches by role-type theme — lower per-batch output pressure
    const b1 = await icpBatch(
      "ICP Batch 1 — Legal/Compliance Roles",
      "legal, compliance, privacy, risk, and governance roles (VP Legal, General Counsel, Chief Compliance Officer, Privacy Officer, etc.) across industries visible in competitor content",
      5,
      []
    );
    await new Promise(r => setTimeout(r, 1500));
    const b2 = await icpBatch(
      "ICP Batch 2 — Operations & Ops-Adjacent Roles",
      "operations roles: legal ops, sales ops, procurement, contract managers, finance ops, revenue ops, process owners",
      5,
      b1.map(i => i.name)
    );
    await new Promise(r => setTimeout(r, 1500));
    const b3 = await icpBatch(
      "ICP Batch 3 — Executive Buyers",
      "executive-level buyers: CFO, COO, CIO/CTO, CEO at mid-market, VP roles that hold buying authority",
      4,
      [...b1, ...b2].map(i => i.name)
    );
    await new Promise(r => setTimeout(r, 1500));
    const b4 = await icpBatch(
      "ICP Batch 4 — Industry-Specific Specialists",
      "industry-specific specialist ICPs that emerge from competitor verticals — e.g. 'Healthcare Compliance Director', 'Manufacturing Procurement Director', 'SaaS Revenue Operations Lead'",
      5,
      [...b1, ...b2, ...b3].map(i => i.name)
    );

    const allICPs = [...b1, ...b2, ...b3, ...b4]
      .slice(0, 20)
      .map((icp, idx) => ({ ...icp, id: icp.id || `icp_${idx + 1}` }));

    if (!allICPs.length) {
      addLog("⚠ All 4 ICP batches returned 0 ICPs. See per-batch errors above.", "error");
    }

    const topUnserved = [...allICPs]
      .sort((a, b) => b.gapScore - a.gapScore)
      .slice(0, 5)
      .map(i => i.id);

    const quickWins = allICPs
      .filter(i => i.priorityScore > 70 && i.clientCoverageScore < 30)
      .slice(0, 3)
      .map(i => i.id);

    const narrativeSummary = allICPs.length
      ? `${allICPs.length} ICPs identified across ${new Set(allICPs.map(i => i.industry)).size} industries. Top unserved: ${allICPs.slice(0,3).map(i => i.name).join(", ")}.`
      : "No ICPs identified — see log panel for per-batch errors.";

    return { icps: allICPs, narrativeSummary, topUnservedICPs: topUnserved, quickWinICPs: quickWins };
  }

  // ─── Narrative generation ───────────────────────────────────────────────────
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
PLAN SUMMARY: ${plan.length} items across ${new Set(plan.map(i => i.cluster)).size} strategic clusters
TOP PLAN ITEMS: ${plan.slice(0, 8).map(i => `${i.priority}.${i.pageTitle}`).join(", ")}
NOTES: ${notes || "None"}`;

    const SYS_STRATEGY = `You are a senior content strategist writing an internal strategic playbook. Use Markdown: ## sections, **bold**, - bullets. Be direct, opinionated, specific. Reference real category names, cluster names, and URL patterns.`;
    const SYS_ICP = `You are a B2B content strategist writing an ICP-focused content strategy. Use Markdown. Be specific about search queries, pain points, and content formats for each audience.`;

    addLog("  Writing strategy narrative…");
    setAICallPhase("Strategy narrative");
    let strategy = "";
    try {
      strategy = await callAI(SYS_STRATEGY,
        `${context}

Write:
## Executive Summary
## What Competitors Are Doing Well
## What the Client Has to Build From
## The Strategic Gap
## Recommended Content Strategy — By Cluster
(cover each of: Core Platform, Role Solutions, Industry Verticals, Topic Guides, Services-Led, Commercial Education, Proof & Hubs, Interactive Tools)
## Priority Sequence and Rationale
## Bottom Line`,
        2500
      );
    } catch (err) {
      logAIFailure("Strategy narrative", err);
    }

    addLog("  Writing ICP narrative…");
    setAICallPhase("ICP narrative");
    let icpNarrative = "";
    try {
      icpNarrative = await callAI(SYS_ICP,
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
        2500
      );
    } catch (err) {
      logAIFailure("ICP narrative", err);
    }

    return { strategy, icp: icpNarrative };
  }

  // ─── Master orchestrator ────────────────────────────────────────────────────
  // Model selection removed: Opus 4.7 is the only primary, Sonnet 4.6 is the
  // only fallback. Provider selection is no longer exposed to the user.
  async function startAnalysis(sites: SiteInput[], notes: string) {
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

    const totalSteps = sites.length + 5;
    let step = 0;

    try {
      // Phase 1: per-site analysis
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

      // Phase 2: gap analysis (2 batches for reliability)
      setSubPhase("gap");
      addLog("\n━━━ PHASE 2: GAP ANALYSIS (2 batches) ━━━", "header");
      const gaps = await runGapAnalysis(clientAn, compAns);
      gapRef.current = gaps;
      setGapAnalysis(gaps);
      if (gaps.gaps.length === 0) {
        addLog("⚠ Gap analysis produced 0 gaps across both batches. Check errors above — likely an AI parse failure. Continuing with empty gap list.", "error");
      } else {
        addLog(`✅ ${gaps.gaps.length} gaps identified`, "success");
      }
      setProgress((++step / totalSteps) * 100);

      // Phase 3: content plan (8 cluster batches)
      setSubPhase("plan");
      addLog("\n━━━ PHASE 3: CONTENT PLAN (8 cluster batches) ━━━", "header");
      const plan = await generatePlan(clientAn, gaps, notes);
      planRef.current = plan;
      setContentPlan(plan);
      const byCluster = plan.reduce((acc, i) => {
        const k = i.cluster || "unknown";
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      addLog(`✅ ${plan.length} items across ${Object.keys(byCluster).length} clusters: ${Object.entries(byCluster).map(([k,v]) => `${CLUSTER_LABELS[k as ContentCluster] || k}=${v}`).join(", ")}`, "success");
      setProgress((++step / totalSteps) * 100);

      // Expert review gate
      addLog("\n📋 Plan ready for expert review…", "success");
      setProgress(75);
      setTimeout(() => setAppPhase("reviewing"), 400);

    } catch (err: any) {
      setError(err.message);
      addLog(`\n💥 ${err.message}`, "error");
    }
  }

  // ─── Expert review → delta merge (kills the wipe bug structurally) ─────────
  // Instead of asking Claude to return the full updated plan (which truncates),
  // we ask for a delta: {add, modify, remove}. Client-side TS applies the delta
  // to the existing plan. Items not explicitly touched are preserved by default.
  async function applyPlanDelta(existing: ContentItem[], feedback: string): Promise<ContentItem[]> {
    const DELTA_SCHEMA = `{
  "add":[/* new ContentItem objects to APPEND — only for genuinely new ideas not already in plan */],
  "modify":[{"priority":<existing priority number>,"changes":{/* field subset to overwrite */},"reason":"why"}],
  "remove":[{"priority":<existing priority number>,"reason":"why"}],
  "summary":"one-sentence description of net changes"
}`;

    // Compact representation of existing plan — titles + priorities only, not full serialization
    const existingCompact = existing.map(i =>
      `${i.priority}. [${i.cluster || "?"} / ${i.funnelStage}] ${i.pageTitle} (${i.action})`
    ).join("\n");

    const itemSchema = `{
  "priorityTier":"P1|P2|P3","cluster":"core_platform|role_solutions|industry_verticals|topic_guides|services_led|commercial_education|proof_and_hubs|interactive_tools",
  "pageTitle":"","urlSuggestion":"/path","contentType":"","pageTypeCategory":"product_pillar|solution_landing_page|role_page|industry_page|topic_guide|service_page|comparison_page|customer_story_hub|gated_guide|interactive_tool|blog_article|glossary|template_resource",
  "targetQuery":"","funnelStage":"TOFU|MOFU|BOFU","intent":"informational|commercial|transactional|navigational",
  "coreAngle":"","action":"net_new|refresh|repurpose",
  "sourceMaterial":{"action":"consolidate|upgrade|pull_from|none","urls":[],"note":""},
  "reasoning":"","gapAddressed":"","estimatedEffort":"low|medium|high","wordCountTarget":1200,
  "icpIds":[],"problemsSolved":[]
}`;

    addLog("  Computing plan delta…");
    setAICallPhase("Plan delta (expert feedback)");
    const delta = await callAIJsonStrict<PlanDelta>(
      `You are refining a content plan based on expert feedback.
You DO NOT return the full plan. You return only a DELTA describing what to add, modify, or remove.
Untouched items remain as-is — that's the default.

CRITICAL RULES:
1. If feedback says "add X" → return add:[new items]. Do NOT include existing items in add.
2. If feedback says "remove X" → return remove:[{priority,reason}] listing the specific priorities.
3. If feedback says "change X's field to Y" → return modify:[{priority, changes:{field:value}, reason}].
4. If feedback is purely additive ("consider also..." / "also include..."), use add ONLY — no removals.
5. Be conservative: only touch items the feedback explicitly calls out.
6. If unsure whether feedback applies to a specific item, DO NOT remove or modify it. Prefer adding clarifying items.

Return ONLY valid JSON matching this schema: ${DELTA_SCHEMA}
Where add items match this ContentItem shape: ${itemSchema}`,
      `EXISTING PLAN (${existing.length} items):
${existingCompact}

EXPERT FEEDBACK:
${feedback}

Produce the minimal delta to apply this feedback.
For additive feedback ("consider more roles/verticals/topics"), return add items with full ContentItem schema. Each new item must include cluster, pageTypeCategory, priorityTier, sourceMaterial, funnelStage, etc.
For removal feedback, return remove:[{priority, reason}] with brief justification.
For modification feedback, return modify:[{priority, changes, reason}] with only the fields that change.`,
      5000
    );

    addLog(`  Delta: +${delta.add?.length || 0} add, ~${delta.modify?.length || 0} modify, -${delta.remove?.length || 0} remove`);
    if (delta.summary) addLog(`  "${delta.summary}"`, "info");

    // Apply the delta client-side — this is where we GUARANTEE preservation
    let result = [...existing];

    // Apply modifications first
    for (const mod of delta.modify || []) {
      const idx = result.findIndex(i => i.priority === mod.priority);
      if (idx >= 0) {
        result[idx] = hydrateContentItem({ ...result[idx], ...mod.changes });
        addLog(`    modify #${mod.priority}: ${mod.reason.slice(0, 80)}`, "info");
      } else {
        addLog(`    ⚠ modify #${mod.priority}: target not found — skipped`, "warn");
      }
    }

    // Apply removals
    const removeSet = new Set((delta.remove || []).map(r => r.priority));
    const removalReasons = new Map((delta.remove || []).map(r => [r.priority, r.reason]));
    const beforeRemove = result.length;
    result = result.filter(i => !removeSet.has(i.priority));
    for (const p of removeSet) {
      const reason = removalReasons.get(p) || "";
      addLog(`    remove #${p}: ${reason.slice(0, 80)}`, "info");
    }
    const removed = beforeRemove - result.length;

    // SAFETY CAP: refuse deltas that remove more than 40% of items.
    // This is the structural guarantee against catastrophic wipes even if
    // Claude misinterprets feedback.
    if (removed > Math.ceil(beforeRemove * 0.4)) {
      throw new Error(`Delta would remove ${removed} of ${beforeRemove} items (>40%). Refusing to apply — review feedback wording. Original plan is preserved.`);
    }

    // Apply additions
    const existingPriorityMax = Math.max(0, ...result.map(i => i.priority));
    const newItems = (delta.add || []).map((raw, idx) => {
      const h = hydrateContentItem(raw);
      h.priority = existingPriorityMax + idx + 1;
      return h;
    });
    for (const ni of newItems) {
      addLog(`    add: [${ni.cluster || "?"}] ${ni.pageTitle}`, "info");
    }
    result = [...result, ...newItems];

    // Renumber sequentially so UI displays clean 1..N
    return result.map((i, idx) => ({ ...i, priority: idx + 1 }));
  }

  async function handleReviewContinue(feedback: string, removedPriorities: number[] = []) {
    setIsRefining(true);
    const clientAn = Object.values(analysesRef.current).find(a => a.isClient)!;
    const compAns  = Object.values(analysesRef.current).filter(a => !a.isClient);

    try {
      let finalPlan = planRef.current;

      // ── Build combined feedback: free-text is authoritative, removals are
      //    appended as directive context. Both can be empty (user just clicked
      //    "Looks Good" without any input) — in that case we skip the delta
      //    entirely and jump straight to ICP analysis.
      const trimmedFeedback = feedback.trim();
      const hasRemovals     = removedPriorities.length > 0;
      const hasAnyInput     = trimmedFeedback.length > 0 || hasRemovals;

      // Compose the prompt text sent to the delta generator. The ordering
      // matters — free-text comes FIRST so Claude treats it as the dominant
      // instruction; the removal list follows as secondary direction that
      // the free-text can override.
      let combinedFeedback = trimmedFeedback;
      if (hasRemovals) {
        // Look up the page titles so the prompt is self-documenting
        const removedTitles = removedPriorities
          .map(p => {
            const item = planRef.current.find(i => i.priority === p);
            return item ? `#${p} "${item.pageTitle}"` : `#${p}`;
          })
          .join(", ");
        const removalNote = [
          "",
          `ANALYST REMOVAL QUEUE: The analyst has flagged these priorities for removal: ${removedPriorities.join(", ")} (${removedTitles}).`,
          "Treat this as direction to tighten the plan around stronger items. Remove them unless the free-text feedback above supersedes this decision.",
        ].join("\n");
        combinedFeedback = combinedFeedback
          ? combinedFeedback + "\n" + removalNote
          : removalNote.trim();
      }

      if (hasAnyInput) {
        setAppPhase("analyzing");
        setSubPhase("plan");
        addLog("\n━━━ APPLYING EXPERT FEEDBACK (delta merge) ━━━", "header");
        if (trimmedFeedback) {
          addLog(`  text: ${trimmedFeedback.slice(0, 120)}${trimmedFeedback.length > 120 ? "…" : ""}`);
        }
        if (hasRemovals) {
          addLog(`  queued for removal: ${removedPriorities.length} item${removedPriorities.length > 1 ? "s" : ""} (#${removedPriorities.join(", #")})`);
        }
        try {
          const before = planRef.current.length;
          finalPlan = await applyPlanDelta(planRef.current, combinedFeedback);

          // ── Renumber priorities sequentially after delta completes. ──
          // Delta removals leave gaps in the numbering (e.g. #1, #2, #3, #7, #15).
          // Users expect contiguous numbering. Preserve tier/cluster/content —
          // only the numeric priority display value shifts.
          finalPlan = finalPlan.map((item, idx) => ({ ...item, priority: idx + 1 }));

          planRef.current = finalPlan;
          setContentPlan(finalPlan);
          const delta = finalPlan.length - before;
          addLog(
            `✅ Plan revised: ${finalPlan.length} items ` +
            (delta === 0 ? "(same count)" : delta > 0 ? `(+${delta})` : `(${delta})`) +
            " — priorities renumbered",
            "success"
          );
        } catch (err) {
          logAIFailure("Plan delta", err);
          addLog("⚠ Keeping original plan — delta failed to apply safely", "warn");
          finalPlan = planRef.current;
        }
      }

      if (appPhase !== "analyzing") setAppPhase("analyzing");
      setSubPhase("icp");
      addLog("\n━━━ PHASE 4: ICP ANALYSIS (4 batches) ━━━", "header");
      const icps = await generateICPs(clientAn, compAns, gapRef.current!, notesRef.current);
      icpRef.current = icps;
      setIcpAnalysis(icps);
      if (icps.icps.length === 0) {
        addLog("⚠ ICP analysis produced 0 ICPs. Narratives will proceed without ICP input.", "error");
      } else {
        addLog(`✅ ${icps.icps.length} ICPs across ${new Set(icps.icps.map(i => i.industry)).size} industries`, "success");
      }
      setProgress(90);

      // ── Plan ↔ ICP linking ──────────────────────────────────────────────
      // Plan icpIds are role slugs (vp_legal, cfo, compliance_officer) because
      // plan generation runs BEFORE ICPs exist. Now that ICPs are available,
      // resolve those slugs to real ICP IDs so UI filters, Content→ICP map,
      // and XLSX export all work correctly.
      if (icps.icps.length && finalPlan.length) {
        const linked = linkPlanToICPs(finalPlan, icps.icps);
        const linkedCount   = linked.filter(i => (i.icpIds || []).length > 0).length;
        const unlinkedCount = linked.length - linkedCount;
        const totalMappings = linked.reduce((s, i) => s + (i.icpIds || []).length, 0);
        finalPlan = linked;
        planRef.current = linked;
        setContentPlan(linked);
        addLog(
          `🔗 Linked ${linkedCount}/${linked.length} plan items to ICPs (${totalMappings} total mappings)` +
          (unlinkedCount > 0 ? ` — ${unlinkedCount} items had no ICP match` : ""),
          "success"
        );
      }

      setSubPhase("narrative");
      addLog("\n━━━ PHASE 5: NARRATIVES ━━━", "header");
      const { strategy, icp } = await generateNarratives(clientAn, compAns, gapRef.current!, finalPlan, icps, notesRef.current);
      setStratNarr(strategy);
      setIcpNarr(icp);
      addLog(strategy ? "✅ Strategy narrative complete" : "⚠ Strategy narrative empty", strategy ? "success" : "warn");
      addLog(icp ? "✅ ICP narrative complete" : "⚠ ICP narrative empty", icp ? "success" : "warn");
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
    // Hydrate each content item so old saves (without cluster/priorityTier/etc.) still render
    planRef.current     = (state.contentPlan || []).map(i => hydrateContentItem(i as any));
    icpRef.current      = state.icpAnalysis;
    notesRef.current    = state.analystNotes;
    setSiteAnalyses(state.siteAnalyses);
    setGapAnalysis(state.gapAnalysis);
    setContentPlan(planRef.current);
    setIcpAnalysis(state.icpAnalysis);
    setStratNarr(state.strategyNarrative);
    setIcpNarr(state.icpNarrative);
    setAppPhase("results");
  }

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
            onExportMarkdown={() => exportMarkdown(buildState())}
            onSaveJson={() => saveJson(buildState())}
            onReset={resetApp}
          />
        )}
      </div>
    </div>
  );
}
