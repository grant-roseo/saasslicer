import type { UrlCluster, CategoryType, CategoryPriority } from "./types";
import { CATEGORY_PRIORITY } from "./types";

// ─── Slug tokenizer ───────────────────────────────────────────────────────────
function tokenize(url: string): string[] {
  try {
    const path = new URL(url).pathname;
    return path
      .toLowerCase()
      .replace(/[^a-z0-9/]/g, " ")
      .split(/[/\s\-_]+/)
      .filter(t => t.length > 2 && !STOPWORDS.has(t));
  } catch { return []; }
}

const STOPWORDS = new Set([
  "the","and","for","with","from","this","that","have","been",
  "will","your","more","also","about","page","post","article",
  "www","com","net","org","html","htm","php","asp",
]);

// ─── SaaS URL taxonomy patterns ───────────────────────────────────────────────
// Priority order matches CATEGORY_PRIORITY in types.ts
const CATEGORY_PATTERNS: { type: CategoryType; keywords: string[]; urlPatterns: RegExp[] }[] = [
  // Highest priority — these drive content strategy gaps
  {
    type: "industry_vertical",
    keywords: ["industry","vertical","sector","construction","finance","healthcare","legal","insurance","manufacturing","retail","education","government","nonprofit","realestate","logistics","transportation","pharma","biotech","lifesciences","fintech","banking","private","equity","procurement","hospitality"],
    urlPatterns: [/\/industr/i, /\/vertical/i, /\/sector/i, /\/markets?\//i, /for-construction/i, /for-finance/i, /for-healthcare/i, /for-legal/i, /for-manufacturing/i, /for-retail/i],
  },
  {
    type: "who_we_serve",
    keywords: ["for","team","role","persona","counsel","lawyer","cfo","cto","cmo","vp","director","manager","procurement","legal","operations","compliance","sales","finance","hr","it","security","executive","enterprise","startup","smb","midmarket","agency","consultant"],
    urlPatterns: [/\/for-\w+/i, /\/roles?\//i, /\/personas?\//i, /\/audiences?\//i, /\/by-role/i, /\/teams?\//i, /for-legal/i, /for-compliance/i, /for-procurement/i, /for-finance/i, /for-sales/i],
  },
  {
    type: "comparison",
    keywords: ["vs","versus","compare","alternative","competitor","best","top","review","ranking","switch","migrate","replace","choice"],
    urlPatterns: [/\/vs[-\/]/i, /-vs-/i, /\/compare/i, /\/alternatives?\//i, /\/best-/i, /\/top-\d/i, /\/versus/i],
  },
  {
    type: "case_study",
    keywords: ["case","study","success","story","customer","testimonial","result","roi","outcome","win","saved","reduced","improved"],
    urlPatterns: [/\/case-stud/i, /\/success-stor/i, /\/testimonial/i, /\/customers?\/[a-z]/i, /\/wins?\//i, /\/stories?\//i],
  },
  {
    type: "solution",
    keywords: ["solution","solve","challenge","problem","workflow","automation","use","case","scenario","approach"],
    urlPatterns: [/\/solutions?\//i, /\/use-cases?\//i, /\/challenges?\//i, /\/workflows?\//i],
  },
  {
    type: "product_service",
    keywords: ["product","feature","platform","software","tool","app","capability","module","function","how","works","overview"],
    urlPatterns: [/\/product/i, /\/features?\//i, /\/platform\//i, /\/how-it-works/i, /\/overview/i, /\/capabilities/i],
  },
  {
    type: "resource_guide",
    keywords: ["guide","ebook","whitepaper","report","template","checklist","playbook","handbook","toolkit","glossary","definition","calculator","webinar","podcast","event","research","survey"],
    urlPatterns: [/\/guides?\//i, /\/ebooks?\//i, /\/whitepapers?\//i, /\/reports?\//i, /\/templates?\//i, /\/resources?\//i, /\/glossary/i, /\/calculators?\//i, /\/webinars?\//i],
  },
  {
    type: "blog",
    keywords: ["blog","post","news","insight","thought","update","content","learn","tip","how","what","why","when","trend","opinion","analysis"],
    urlPatterns: [/\/blog\//i, /\/posts?\//i, /\/articles?\//i, /\/news\//i, /\/insights?\//i, /\/learn\//i],
  },
  {
    type: "landing_page",
    keywords: ["demo","trial","free","start","signup","register","request","get","schedule","book","contact","quote","pricing"],
    urlPatterns: [/\/demo\//i, /\/free-trial/i, /\/get-started/i, /\/request-demo/i, /\/book-demo/i, /\/lp\//i, /\/signup/i, /\/register/i],
  },
  {
    type: "pricing",
    keywords: ["pricing","price","plan","tier","cost","subscription","enterprise","quote"],
    urlPatterns: [/\/pricing/i, /\/plans?\//i, /\/cost\b/i],
  },
  {
    type: "docs_support",
    keywords: ["docs","documentation","help","support","faq","knowledge","api","reference","tutorial","getting","started","onboard","setup","install"],
    urlPatterns: [/\/docs\//i, /\/documentation/i, /\/help\//i, /\/support\//i, /\/faq\//i, /\/api\//i, /\/developers?\//i],
  },
  {
    type: "other",
    keywords: [],
    urlPatterns: [],
  },
];

// ─── Priority mapping ─────────────────────────────────────────────────────────
function getCategoryPriority(type: CategoryType): CategoryPriority {
  const score = CATEGORY_PRIORITY[type];
  if (score >= 9) return "critical";
  if (score >= 7) return "high";
  if (score >= 4) return "normal";
  return "low";
}

// ─── Classify a single URL ────────────────────────────────────────────────────
function classifyUrl(url: string): { type: CategoryType; confidence: number } {
  const urlLower = url.toLowerCase();
  const tokens = new Set(tokenize(url));

  let bestType: CategoryType = "other";
  let bestScore = 0;

  for (const pattern of CATEGORY_PATTERNS) {
    if (pattern.type === "other") continue;
    const urlMatch = pattern.urlPatterns.some(re => re.test(urlLower));
    const kwOverlap = pattern.keywords.filter(k => tokens.has(k) || urlLower.includes(k)).length;
    const score = (urlMatch ? 6 : 0) + kwOverlap;
    if (score > bestScore) { bestScore = score; bestType = pattern.type; }
  }

  const confidence = Math.min(100, bestScore * 12);
  return { type: bestType, confidence };
}

// ─── Main clustering function ─────────────────────────────────────────────────
export function clusterUrls(urls: string[]): UrlCluster[] {
  const groups: Record<CategoryType, string[]> = {
    blog: [], product_service: [], industry_vertical: [], solution: [],
    who_we_serve: [], use_case: [], comparison: [], case_study: [],
    resource_guide: [], pricing: [], docs_support: [], landing_page: [], other: [],
  };

  for (const url of urls) {
    const { type } = classifyUrl(url);
    groups[type].push(url);
  }

  const clusters: UrlCluster[] = [];

  for (const [typeStr, clusterUrls] of Object.entries(groups)) {
    if (!clusterUrls.length) continue;
    const type = typeStr as CategoryType;
    const label = CATEGORY_LABELS[type];
    const priority = getCategoryPriority(type);

    clusters.push({
      id: type,
      name: label,
      categoryType: type,
      priority,
      urls: clusterUrls,
      crawledPages: [],
      confidence: 0,
      crawlStatus: "pending",
    });
  }

  const ORDER: Record<CategoryPriority, number> = { critical: 0, high: 1, normal: 2, low: 3 };
  return clusters.sort((a, b) => {
    const pd = ORDER[a.priority] - ORDER[b.priority];
    return pd !== 0 ? pd : b.urls.length - a.urls.length;
  });
}

export const CATEGORY_LABELS: Record<CategoryType, string> = {
  blog:              "Blog & Articles",
  product_service:   "Product & Platform",
  industry_vertical: "Industries & Verticals",
  solution:          "Solutions & Use Cases",
  who_we_serve:      "Roles & Audiences",
  use_case:          "Use Cases",
  comparison:        "Comparisons & Alternatives",
  case_study:        "Case Studies & Customer Proof",
  resource_guide:    "Resources & Guides",
  pricing:           "Pricing & Plans",
  docs_support:      "Docs, Support & API",
  landing_page:      "Conversion & Demo Pages",
  other:             "Other",
};

export function clusterStats(clusters: UrlCluster[]) {
  return {
    total: clusters.reduce((s, c) => s + c.urls.length, 0),
    byPriority: {
      critical: clusters.filter(c => c.priority === "critical").reduce((s, c) => s + c.urls.length, 0),
      high:     clusters.filter(c => c.priority === "high").reduce((s, c) => s + c.urls.length, 0),
      normal:   clusters.filter(c => c.priority === "normal").reduce((s, c) => s + c.urls.length, 0),
      low:      clusters.filter(c => c.priority === "low").reduce((s, c) => s + c.urls.length, 0),
    },
    categoryCount: clusters.length,
  };
}
