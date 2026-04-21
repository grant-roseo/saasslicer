// ─── AI Provider ─────────────────────────────────────────────────────────────
export type AIProvider = "anthropic" | "openai" | "gemini";

// ─── Input / Site Entry ───────────────────────────────────────────────────────
export type SiteRole = "client" | "competitor";

export interface SiteInput {
  id: string;
  role: SiteRole;
  name: string;
  domain: string;          // https://example.com
  rawInput: string;        // whatever the user pasted / typed
  inputMethod: "auto" | "url_list" | "xml_paste" | "sitemap_url";
  urls: string[];          // filtered signal URLs
  totalUrls: number;
  status: "idle" | "loading" | "ready" | "error";
  errorMsg: string;
}

// ─── URL Cluster ─────────────────────────────────────────────────────────────
export type CategoryPriority = "critical" | "high" | "normal" | "low";

export interface UrlCluster {
  id: string;
  name: string;             // inferred category name e.g. "Blog Posts"
  categoryType: CategoryType;
  priority: CategoryPriority;
  urls: string[];
  crawledPages: CrawledPage[];
  confidence: number;       // 0-100 — how certain we are of category classification
  crawlStatus: "pending" | "sampling" | "done" | "skipped";
}

export type CategoryType =
  | "blog"
  | "product_service"
  | "industry_vertical"
  | "solution"
  | "who_we_serve"
  | "use_case"
  | "comparison"
  | "resource_guide"
  | "case_study"
  | "pricing"
  | "docs_support"
  | "landing_page"
  | "other";

// Priority order — higher index = higher crawl priority
export const CATEGORY_PRIORITY: Record<CategoryType, number> = {
  product_service:   10,
  industry_vertical: 10,
  who_we_serve:      10,
  comparison:        10,
  solution:          9,
  blog:              9,
  case_study:        9,
  resource_guide:    6,
  landing_page:      5,
  pricing:           5,
  use_case:          4,
  docs_support:      2,
  other:             1,
};

// ─── Crawled Page ─────────────────────────────────────────────────────────────
export interface CrawledPage {
  url: string;
  title: string;
  metaDescription: string;
  h1: string;
  h2s: string[];
  h3s: string[];
  schemaTypes: string[];
  wordCount: number;
  publishedDate: string;
  integrationsWith: string[];
  crawlMethod: "fetch" | "skipped" | "failed";
}

// ─── Review Data ──────────────────────────────────────────────────────────────
export interface ReviewData {
  source: string;
  productSlug: string;
  reviewSnippets: string[];
  painThemes: string[];
  praiseThemes: string[];
  fetchedAt: string;
}

// ─── Site Analysis ────────────────────────────────────────────────────────────
export interface SiteAnalysis {
  siteId: string;
  siteName: string;
  domain: string;
  isClient: boolean;
  totalUrls: number;
  clusters: UrlCluster[];
  contentStrategySum: string;
  searchArchitecture: string;
  keyThemes: string[];
  strengths: string[];
  notableGaps: string[];
  contentVelocitySignal: string;
  schemaTypesFound: string[];
  integrationsEcosystem: string[];
  contentDepthProfile: string;
}

// ─── Gap Analysis ─────────────────────────────────────────────────────────────
export type GapPriority = "critical" | "high" | "medium" | "low";
export type GapType =
  | "content_category"
  | "industry_vertical"
  | "role_page"
  | "product_service"
  | "use_case"
  | "comparison"
  | "resource"
  | "icp_coverage"
  | "format_gap"
  | "depth_gap";

export interface Gap {
  id: string;
  title: string;
  gapType: GapType;
  description: string;
  priority: GapPriority;
  opportunity: string;
  reasoning: string;
  estimatedPages: number;
  funnelStage: FunnelStage;
  competitorsDoing: string[];
  icpRelevance: string[];
}

export interface GapAnalysis {
  narrative: string;
  competitorStrengths: { competitor: string; advantage: string }[];
  clientAdvantages: string[];
  gaps: Gap[];
}

// ─── Content Plan ─────────────────────────────────────────────────────────────
export type FunnelStage = "TOFU" | "MOFU" | "BOFU" | "Mixed";
export type ContentAction = "net_new" | "refresh" | "repurpose";
export type ContentIntent = "informational" | "commercial" | "navigational" | "transactional";
export type EffortLevel = "low" | "medium" | "high";

// ─── NEW: Strategic Cluster ───────────────────────────────────────────────────
// 8 generic clusters modelled on the structure of high-quality strategy decks.
// These group items into a strategic narrative rather than a flat list.
export type ContentCluster =
  | "core_platform"         // Product pillar, solution landing, pricing
  | "role_solutions"        // Role/persona-specific pages
  | "industry_verticals"    // Industry-specific pages
  | "topic_guides"          // Subject-matter deep dives (contract/clause/topic guides)
  | "services_led"          // Managed services, consulting, hybrid offerings
  | "commercial_education"  // Comparisons, buyer guides, category education
  | "proof_and_hubs"        // Customer stories, case study hubs
  | "interactive_tools";    // Calculators, assessments, gated tools

export const CLUSTER_LABELS: Record<ContentCluster, string> = {
  core_platform:        "Core Platform",
  role_solutions:       "Role Solutions",
  industry_verticals:   "Industry Verticals",
  topic_guides:         "Topic Guides",
  services_led:         "Services-Led",
  commercial_education: "Commercial Education",
  proof_and_hubs:       "Proof & Hubs",
  interactive_tools:    "Interactive Tools",
};

// ─── NEW: Crisp Page Type Taxonomy ────────────────────────────────────────────
export type PageTypeCategory =
  | "product_pillar"
  | "solution_landing_page"
  | "role_page"
  | "industry_page"
  | "topic_guide"
  | "service_page"
  | "comparison_page"
  | "customer_story_hub"
  | "gated_guide"
  | "interactive_tool"
  | "blog_article"
  | "glossary"
  | "template_resource";

// ─── NEW: Priority Tier ───────────────────────────────────────────────────────
// Coarse strategic priority independent of sequential numbering.
export type PriorityTier = "P1" | "P2" | "P3";

// ─── NEW: Source Material ─────────────────────────────────────────────────────
// For refresh/repurpose items, specifies which existing client URLs should be
// consolidated, upgraded, or pulled from. Mirrors the "Source Material / Notes"
// column in high-quality strategy decks.
export interface SourceMaterial {
  action: "consolidate" | "upgrade" | "pull_from" | "none";
  urls: string[];   // existing client URLs this item builds on (pathnames)
  note: string;     // human-readable instruction, e.g. "Consolidate overlap from X, Y, Z"
}

export interface ContentItem {
  priority: number;                      // sequential display order
  priorityTier?: PriorityTier;           // NEW — P1/P2/P3
  cluster?: ContentCluster;              // NEW — strategic grouping
  pageTitle: string;
  urlSuggestion: string;
  contentType: string;                   // legacy free-text (kept for backward compat)
  pageTypeCategory?: PageTypeCategory;   // NEW — crisp taxonomy
  targetQuery: string;
  funnelStage: FunnelStage;
  intent: ContentIntent;
  coreAngle: string;
  action: ContentAction;
  sourceMaterial?: SourceMaterial;       // NEW — existing content to leverage
  reasoning: string;
  gapAddressed: string;
  estimatedEffort: EffortLevel;
  wordCountTarget: number;
  icpIds: string[];
  problemsSolved: string[];
}

// ─── NEW: Plan Delta (for expert review) ─────────────────────────────────────
// Expert review returns a delta, not a full plan. Prevents truncation-induced
// data loss when the full plan would exceed output token budget.
export interface PlanDelta {
  add: ContentItem[];                    // items to append
  modify: {
    priority: number;                    // target existing item by priority
    changes: Partial<ContentItem>;       // fields to overwrite
    reason: string;                      // why this change
  }[];
  remove: { priority: number; reason: string }[]; // priorities to drop
  summary: string;                       // brief note on overall changes
}

// ─── ICP System ──────────────────────────────────────────────────────────────
export interface ICP {
  id: string;
  name: string;
  role: string;
  industry: string;
  companySizeProfile: string;
  sourceCompetitor: string;

  primaryPains: string[];
  secondaryPains: string[];
  jobsToBeDone: string[];

  searchQueries: string[];
  aiPrompts: string[];

  tofuContentNeeds: string[];
  mofuContentNeeds: string[];
  bofuContentNeeds: string[];

  clientCoverageScore: number;
  priorityScore: number;
  gapScore: number;
}

export interface ICPAnalysis {
  icps: ICP[];
  narrativeSummary: string;
  topUnservedICPs: string[];
  quickWinICPs: string[];
}

// ─── Full Analysis State ──────────────────────────────────────────────────────
export interface AnalysisState {
  sites: SiteInput[];
  siteAnalyses: Record<string, SiteAnalysis>;
  gapAnalysis: GapAnalysis | null;
  contentPlan: ContentItem[];
  icpAnalysis: ICPAnalysis | null;
  strategyNarrative: string;
  icpNarrative: string;
  analystNotes: string;
  provider: AIProvider;
  createdAt: string;
}

// ─── Log ─────────────────────────────────────────────────────────────────────
export type LogType = "info" | "success" | "error" | "warn" | "header" | "progress";

export interface LogEntry {
  msg: string;
  type: LogType;
  ts: number;
}

// ─── Export ──────────────────────────────────────────────────────────────────
export interface ExportOptions {
  includeContentPlan: boolean;
  includeGapAnalysis: boolean;
  includeSiteOverview: boolean;
  includeICPProfiles: boolean;
  includeContentICPMap: boolean;
}

// ─── Backward-compatible defaulter ───────────────────────────────────────────
// Applied when loading old JSON saves so new UI code doesn't crash on missing
// fields. Any item missing cluster/priorityTier/etc. gets sensible defaults.
export function hydrateContentItem(raw: Partial<ContentItem>): ContentItem {
  return {
    priority:         raw.priority ?? 0,
    priorityTier:     raw.priorityTier ?? "P2",
    cluster:          raw.cluster ?? "core_platform",
    pageTitle:        raw.pageTitle ?? "",
    urlSuggestion:    raw.urlSuggestion ?? "",
    contentType:      raw.contentType ?? "",
    pageTypeCategory: raw.pageTypeCategory ?? "blog_article",
    targetQuery:      raw.targetQuery ?? "",
    funnelStage:      raw.funnelStage ?? "TOFU",
    intent:           raw.intent ?? "informational",
    coreAngle:        raw.coreAngle ?? "",
    action:           raw.action ?? "net_new",
    sourceMaterial:   raw.sourceMaterial ?? { action: "none", urls: [], note: "" },
    reasoning:        raw.reasoning ?? "",
    gapAddressed:     raw.gapAddressed ?? "",
    estimatedEffort:  raw.estimatedEffort ?? "medium",
    wordCountTarget:  raw.wordCountTarget ?? 1200,
    icpIds:           raw.icpIds ?? [],
    problemsSolved:   raw.problemsSolved ?? [],
  };
}
