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
  blog:              9,
  product_service:   10,
  industry_vertical: 8,
  solution:          9,
  who_we_serve:      8,
  use_case:          7,
  comparison:        8,
  case_study:        7,
  resource_guide:    6,
  landing_page:      5,
  pricing:           5,
  docs_support:      2,
  other:             1,
};

// ─── Crawled Page ─────────────────────────────────────────────────────────────
export interface CrawledPage {
  url: string;
  title: string;
  metaDescription: string;
  h1: string;
  schemaTypes: string[];    // JSON-LD @type values found
  wordCountEstimate: number;
  crawlMethod: "fetch" | "skipped" | "failed";
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
  icpRelevance: string[];   // which ICP ids this gap affects
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

export interface ContentItem {
  priority: number;
  pageTitle: string;
  urlSuggestion: string;
  contentType: string;
  targetQuery: string;
  funnelStage: FunnelStage;
  intent: ContentIntent;
  coreAngle: string;
  action: ContentAction;
  reasoning: string;
  gapAddressed: string;
  estimatedEffort: EffortLevel;
  wordCountTarget: number;
  icpIds: string[];           // which ICPs this content serves
  problemsSolved: string[];   // specific problems addressed
}

// ─── ICP System ──────────────────────────────────────────────────────────────
export interface ICP {
  id: string;
  name: string;               // e.g. "VP of Legal at Mid-Market SaaS"
  role: string;               // job title / function
  industry: string;           // vertical
  companySizeProfile: string; // e.g. "50-500 employees, Series B-D"
  sourceCompetitor: string;   // which site surfaced this ICP (or "inferred")

  // Pain & motivation
  primaryPains: string[];
  secondaryPains: string[];
  jobsToBeDone: string[];     // JTBD framework

  // Search & AI behavior
  searchQueries: string[];    // what they'd Google
  aiPrompts: string[];        // what they'd ask Claude/ChatGPT/Gemini

  // Content needs by funnel stage
  tofuContentNeeds: string[];
  mofuContentNeeds: string[];
  bofuContentNeeds: string[];

  // Scoring
  clientCoverageScore: number;  // 0-100 how well client currently serves this ICP
  priorityScore: number;        // 0-100 strategic importance
  gapScore: number;             // 0-100 how big the content gap is
}

export interface ICPAnalysis {
  icps: ICP[];
  narrativeSummary: string;
  topUnservedICPs: string[];   // ICP ids client is missing most
  quickWinICPs: string[];      // easiest to address
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
