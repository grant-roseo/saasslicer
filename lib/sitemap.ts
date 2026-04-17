const PROXIES = [
  "https://api.allorigins.win/raw?url=",
  "https://corsproxy.io/?",
];

export async function fetchViaProxy(url: string, timeout = 14000): Promise<string> {
  for (const proxy of PROXIES) {
    try {
      const res = await fetch(`${proxy}${encodeURIComponent(url)}`, {
        signal: AbortSignal.timeout(timeout),
      });
      if (res.ok) return await res.text();
    } catch {}
  }
  throw new Error(`Could not fetch: ${url}`);
}

export function getDomain(url: string): string {
  try {
    const u = url.trim().startsWith("http") ? url.trim() : `https://${url.trim()}`;
    return new URL(u).origin;
  } catch { return ""; }
}

export function parseXml(xmlText: string): { type: string; urls: string[] } {
  try {
    const doc = new DOMParser().parseFromString(xmlText, "text/xml");
    const sitemapNodes = Array.from(doc.querySelectorAll("sitemap > loc"));
    if (sitemapNodes.length > 0)
      return { type: "index", urls: sitemapNodes.map(n => n.textContent!.trim()) };
    const urlNodes = Array.from(doc.querySelectorAll("url > loc"));
    return { type: "urlset", urls: urlNodes.map(n => n.textContent!.trim()) };
  } catch { return { type: "error", urls: [] }; }
}

// Parse multiple XML sitemaps pasted together
export function parseMultipleXml(text: string): string[] {
  const all: string[] = [];
  const locRe = /<loc[^>]*>([^<]+)<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = locRe.exec(text)) !== null) {
    const url = m[1].trim();
    if (url.startsWith("http")) all.push(url);
  }
  return [...new Set(all)];
}

const NOISE_RE = [
  /\/careers?\b/i, /\/jobs?\b/i, /\/about\b/i, /\/team\b/i, /\/our-team/i,
  /\/press\b/i, /\/contact\b/i, /\/privacy/i, /\/terms\b/i, /\/cookie/i,
  /\/tag\//i, /\/author\//i, /\/page\/\d/i, /[?#]/,
  /\.(pdf|jpg|jpeg|png|gif|svg|webp|css|js|woff|ico)$/i,
  /\/wp-json\//i, /\/sitemap/i, /\/login\b/i, /\/signup\b/i, /\/register\b/i,
  /\/404/i, /\/thank-you/i, /\/unsubscribe/i, /\/feed\b/i,
];

export function filterUrls(urls: string[], domain: string): string[] {
  return urls.filter(url => {
    if (!url.startsWith(domain)) return false;
    const path = url.slice(domain.length);
    if (!path || path === "/") return false;
    return !NOISE_RE.some(p => p.test(url));
  });
}

// Smart sample — keep a representative spread, not just first N
export function sampleUrls(urls: string[], max = 600): { urls: string[]; total: number } {
  if (urls.length <= max) return { urls, total: urls.length };
  const sorted = [...urls].sort();
  const step = Math.ceil(sorted.length / max);
  return { urls: sorted.filter((_, i) => i % step === 0).slice(0, max), total: urls.length };
}

export async function discoverSitemapUrls(
  domain: string,
  manualUrl?: string,
  onProgress?: (msg: string) => void
): Promise<{ urls: string[]; total: number }> {
  const log = (msg: string) => onProgress?.(msg);
  let sitemapUrl: string | null = manualUrl?.trim() || null;

  if (!sitemapUrl) {
    log("Checking robots.txt…");
    try {
      const robots = await fetchViaProxy(`${domain}/robots.txt`);
      const matches = Array.from(robots.matchAll(/Sitemap:\s*(\S+)/gi));
      if (matches.length > 0) {
        sitemapUrl = matches[0][1].trim();
        log(`Found in robots.txt`);
      }
    } catch { log("robots.txt unavailable"); }
  }

  const FALLBACKS = [
    "/sitemap.xml",
    "/sitemap_index.xml",
    "/wp-sitemap.xml",
    "/sitemap/sitemap.xml",
    "/sitemap/index.xml",
    "/news-sitemap.xml",
  ];

  if (!sitemapUrl) {
    for (const path of FALLBACKS) {
      try {
        const text = await fetchViaProxy(`${domain}${path}`);
        if (text.includes("<urlset") || text.includes("<sitemapindex") || text.includes("<loc")) {
          sitemapUrl = `${domain}${path}`;
          log(`Found at ${path}`);
          break;
        }
      } catch {}
    }
  }

  if (!sitemapUrl) throw new Error("No sitemap found. Use manual URL or paste URLs directly.");

  log("Fetching sitemap…");
  const sitemapText = await fetchViaProxy(sitemapUrl);
  const parsed = parseXml(sitemapText);
  let allUrls: string[] = [];

  if (parsed.type === "index") {
    log(`Sitemap index: ${parsed.urls.length} children`);
    for (const child of parsed.urls.slice(0, 10)) {
      try {
        const childText = await fetchViaProxy(child);
        allUrls = [...allUrls, ...parseXml(childText).urls];
      } catch { log(`Skipped child: ${child}`); }
    }
  } else {
    allUrls = parsed.urls;
  }

  log(`${allUrls.length} raw URLs`);
  const filtered = filterUrls(allUrls, domain);
  log(`${filtered.length} signal URLs after filtering`);
  const sampled = sampleUrls(filtered);
  if (filtered.length > 600) log(`Sampled 600 from ${filtered.length}`);
  return sampled;
}
