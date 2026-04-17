import type { UrlCluster, CategoryType, CategoryPriority } from "./types";
import { CATEGORY_PRIORITY } from "./types";

// ─── Slug tokenizer ───────────────────────────────────────────────────────────
function tokenize(url: string): string[] {
  try {
    const path = new URL(url).pathname;
    return path
      .toLowerCase()
      .replace(/[^a-z0-9/]/g, " ")
      .split(/[/\s-_]+/)
      .filter(t => t.length > 2 && !STOPWORDS.has(t));
  } catch { return []; }
}

const STOPWORDS = new Set([
  "the","and","for","with","from","this","that","have","been",
  "will","your","more","also","about","page","post","article",
  "www","com","net","org","html","htm","php","asp",
]);

// ─── Category detection patterns ─────────────────────────────────────────────
const CATEGORY_PATTERNS: { type: CategoryType; keywords: string[]; urlPatterns: RegExp[] }[] = [
  {
    type: "blog",
    keywords: ["blog","post","article","news","insight","thought","update","content","resource","learn","guide","tip","how","what","why","when"],
    urlPatterns: [/\/blog\//i, /\/posts?\//i, /\/articles?\//i, /\/news\//i, /\/insights?\//i, /\/resources?\//i, /\/learn\//i],
  },
  {
    type: "product_service",
    keywords: ["product","service","feature","solution","platform","software","tool","app","suite","module","capability","function"],
    urlPatterns: [/\/products?\//i, /\/services?\//i, /\/features?\//i, /\/platform\//i, /\/software\//i, /\/tools?\//i],
  },
  {
    type: "industry_vertical",
    keywords: ["industry","vertical","sector","market","healthcare","finance","retail","manufacturing","education","legal","insurance","real","estate","government","nonprofit"],
    urlPatterns: [/\/industries\//i, /\/verticals?\//i, /\/sectors?\//i, /\/markets?\//i],
  },
  {
    type: "solution",
    keywords: ["solution","solve","challenge","problem","answer","approach","strategy","method","way","how"],
    urlPatterns: [/\/solutions?\//i, /\/use-cases?\//i, /\/challenges?\//i],
  },
  {
    type: "who_we_serve",
    keywords: ["team","role","persona","customer","client","user","professional","manager","director","vp","cto","cfo","cmo","legal","procurement","sales","marketing","operations","enterprise","startup","smb","midmarket"],
    urlPatterns: [/\/for-\w+/i, /\/teams?\//i, /\/roles?\//i, /\/customers?\//i, /\/by-role\//i],
  },
  {
    type: "use_case",
    keywords: ["usecase","workflow","automation","process","task","scenario","example","demo","template"],
    urlPatterns: [/\/use-cases?\//i, /\/workflows?\//i, /\/templates?\//i, /\/demos?\//i],
  },
  {
    type: "comparison",
    keywords: ["vs","versus","compare","alternative","competitor","best","top","review","ranking","choice","switch","migrate"],
    urlPatterns: [/\/vs-/i, /-vs-/i, /\/compare\//i, /\/alternatives?\//i, /\/best-/i, /\/top-/i],
  },
  {
    type: "case_study",
    keywords: ["case","study","success","story","customer","example","result","roi","outcome","testimonial","win"],
    urlPatterns: [/\/case-studies?\//i, /\/customers?\//i, /\/success-stories?\//i, /\/testimonials?\//i],
  },
  {
    type: "resource_guide",
    keywords: ["guide","ebook","whitepaper","report","download","checklist","template","playbook","handbook","toolkit","glossary","definition","what"],
    urlPatterns: [/\/guides?\//i, /\/ebooks?\//i, /\/whitepapers?\//i, /\/reports?\//i, /\/downloads?\//i, /\/glossary\//i],
  },
  {
    type: "pricing",
    keywords: ["pricing","price","plan","tier","cost","subscription","free","trial","enterprise","quote"],
    urlPatterns: [/\/pricing\//i, /\/plans?\//i, /\/cost\//i],
  },
  {
    type: "docs_support",
    keywords: ["docs","documentation","help","support","faq","knowledge","base","api","reference","tutorial","getting","started"],
    urlPatterns: [/\/docs\//i, /\/documentation\//i, /\/help\//i, /\/support\//i, /\/faq\//i, /\/api\//i],
  },
  {
    type: "landing_page",
    keywords: ["landing","campaign","offer","promo","promotion","signup","demo","trial","start","request"],
    urlPatterns: [/\/lp\//i, /\/landing\//i, /\/demo\//i, /\/trial\//i, /\/signup\//i, /\/request\//i],
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
    // URL pattern match (high weight)
    const urlMatch = pattern.urlPatterns.some(re => re.test(urlLower));
    // Keyword overlap (lower weight)
    const kwOverlap = pattern.keywords.filter(k => tokens.has(k) || urlLower.includes(k)).length;
    const score = (urlMatch ? 5 : 0) + kwOverlap;
    if (score > bestScore) { bestScore = score; bestType = pattern.type; }
  }

  const confidence = Math.min(100, bestScore * 15);
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

  // Sort: critical first, then high, normal, low — then by URL count descending
  const ORDER: Record<CategoryPriority, number> = { critical: 0, high: 1, normal: 2, low: 3 };
  return clusters.sort((a, b) => {
    const pd = ORDER[a.priority] - ORDER[b.priority];
    return pd !== 0 ? pd : b.urls.length - a.urls.length;
  });
}

export const CATEGORY_LABELS: Record<CategoryType, string> = {
  blog:              "Blog & Articles",
  product_service:   "Products & Services",
  industry_vertical: "Industries & Verticals",
  solution:          "Solutions",
  who_we_serve:      "Who We Serve",
  use_case:          "Use Cases",
  comparison:        "Comparisons & Alternatives",
  case_study:        "Case Studies & Customers",
  resource_guide:    "Resources & Guides",
  pricing:           "Pricing & Plans",
  docs_support:      "Docs & Support",
  landing_page:      "Landing Pages",
  other:             "Other",
};

// ─── Stats ────────────────────────────────────────────────────────────────────
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
