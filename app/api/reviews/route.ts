import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 20;

// ─── G2 / Capterra review scraper ────────────────────────────────────────────
// Fetches public review pages and extracts buyer language for ICP prompts.
// Fails gracefully — returns empty data if blocked or not found.

function slugify(name: string): string {
  return name.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

const PROXIES = [
  "https://api.allorigins.win/raw?url=",
  "https://corsproxy.io/?",
];

async function fetchViaProxy(url: string): Promise<string> {
  for (const proxy of PROXIES) {
    try {
      const res = await fetch(`${proxy}${encodeURIComponent(url)}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const text = await res.text();
        if (text.length > 500) return text; // skip empty/error responses
      }
    } catch {}
  }
  return "";
}

function extractTextBetweenTags(html: string, patterns: RegExp[]): string[] {
  const results: string[] = [];
  for (const pattern of patterns) {
    const matches = html.matchAll(pattern);
    for (const m of matches) {
      if (m[1]) {
        const clean = m[1]
          .replace(/<[^>]+>/g, " ")
          .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
          .replace(/\s+/g, " ").trim();
        if (clean.length > 30 && clean.length < 1000) results.push(clean);
      }
    }
    if (results.length >= 30) break;
  }
  return results;
}

async function scrapeG2Reviews(productName: string): Promise<{ snippets: string[]; found: boolean }> {
  const slugs = [
    slugify(productName),
    slugify(productName).replace(/-/g, ""),
  ];

  for (const slug of slugs) {
    const url = `https://www.g2.com/products/${slug}/reviews`;
    const html = await fetchViaProxy(url);
    if (!html || html.includes("Page Not Found") || html.length < 2000) continue;

    // G2 embeds review text in several different ways depending on their A/B testing
    const patterns = [
      /itemprop="reviewBody"[^>]*>([\s\S]{30,800}?)<\/[a-z]/gi,
      /class="[^"]*review[^"]*"[^>]*>([\s\S]{30,600}?)<\/p>/gi,
      /data-testid="review-body"[^>]*>([\s\S]{30,600}?)<\//gi,
      /"body":"([^"]{30,600})"/g,
      /class="[^"]*c-midnight[^"]*"[^>]*>\s*<p>([\s\S]{30,500}?)<\/p>/gi,
    ];

    const snippets = extractTextBetweenTags(html, patterns);
    if (snippets.length >= 3) {
      return { snippets: snippets.slice(0, 25), found: true };
    }
  }

  return { snippets: [], found: false };
}

async function scrapeCapterraReviews(productName: string): Promise<{ snippets: string[]; found: boolean }> {
  const slug = slugify(productName);
  const url = `https://www.capterra.com/reviews/search?query=${encodeURIComponent(productName)}`;
  const html = await fetchViaProxy(url);
  if (!html || html.length < 2000) return { snippets: [], found: false };

  const patterns = [
    /class="[^"]*review-text[^"]*"[^>]*>([\s\S]{30,600}?)<\/[a-z]/gi,
    /class="[^"]*ReviewBody[^"]*"[^>]*>([\s\S]{30,600}?)<\/[a-z]/gi,
    /"pros":"([^"]{20,500})"/g,
    /"cons":"([^"]{20,500})"/g,
  ];

  const snippets = extractTextBetweenTags(html, patterns);
  return { snippets: snippets.slice(0, 15), found: snippets.length >= 2 };
}

export async function POST(req: NextRequest) {
  const { productName, domain } = await req.json() as { productName: string; domain: string };
  if (!productName) return NextResponse.json({ error: "productName required" }, { status: 400 });

  // Try G2 first, then Capterra
  const g2 = await scrapeG2Reviews(productName);
  const capterra = g2.found ? { snippets: [], found: false } : await scrapeCapterraReviews(productName);

  const allSnippets = [...g2.snippets, ...capterra.snippets];
  const source = g2.found ? "g2" : capterra.found ? "capterra" : "none";

  return NextResponse.json({
    source,
    productName,
    reviewSnippets: allSnippets,
    count: allSnippets.length,
    found: allSnippets.length > 0,
  });
}
