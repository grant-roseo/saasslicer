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
      if (res.ok) {
        const text = await res.text();
        // Skip binary/compressed responses (e.g. .gz that wasn't decompressed)
        if (text.charCodeAt(0) === 31 && text.charCodeAt(1) === 139) continue; // gzip magic bytes
        return text;
      }
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

// Normalise domain for URL matching — strips www, handles http/https
function normaliseDomain(domain: string): string {
  try {
    const hostname = new URL(domain).hostname.replace(/^www\./, "");
    return hostname;
  } catch { return domain; }
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
  // Normalise: match regardless of www prefix or http/https
  const targetHost = normaliseDomain(domain);
  return urls.filter(url => {
    try {
      const urlHost = new URL(url).hostname.replace(/^www\./, "");
      if (urlHost !== targetHost) return false;
      const path = new URL(url).pathname;
      if (!path || path === "/") return false;
      return !NOISE_RE.some(p => p.test(url));
    } catch { return false; }
  });
}

export function sampleUrls(urls: string[], max = 600): { urls: string[]; total: number } {
  if (urls.length <= max) return { urls, total: urls.length };
  const sorted = [...urls].sort();
  const step = Math.ceil(sorted.length / max);
  return { urls: sorted.filter((_, i) => i % step === 0).slice(0, max), total: urls.length };
}

// ─── Sitemap discovery ────────────────────────────────────────────────────────
// Well-known paths checked in priority order — robots.txt first, then these.
// RSS/Atom and Google filetype lookup are future features — not implemented yet.
const SITEMAP_PATHS = [
  "/sitemap.xml",         // most common
  "/sitemap_index.xml",   // RankMath, Yoast index
  "/sitemap-index.xml",   // hyphenated variant
  "/sitemapindex.xml",    // no separator variant
  "/wp-sitemap.xml",      // WordPress 5.5+ core
  "/sitemap1.xml",        // numbered first shard
  "/sitemap/sitemap.xml", // subdirectory pattern
  "/sitemap/index.xml",   // subdirectory index
  "/sitemap/",            // bare directory (may redirect)
  "/sitemap.php",         // PHP-generated
  "/sitemap.txt",         // plain text sitemap
  "/feed/sitemap.xml",    // feed-based
  "/sitemap.xml.gz",      // compressed (proxy may decompress)
];

function looksLikeSitemap(text: string): boolean {
  return (
    text.includes("<loc>") ||
    text.includes("<urlset") ||
    text.includes("<sitemapindex") ||
    // Plain text sitemap: starts with http on first line
    /^https?:\/\//m.test(text.slice(0, 500))
  );
}

function parsePlainTextSitemap(text: string): string[] {
  return text
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.startsWith("http"));
}

export async function discoverSitemapUrls(
  domain: string,
  manualUrl?: string,
  onProgress?: (msg: string) => void
): Promise<{ urls: string[]; total: number }> {
  const log = (msg: string) => onProgress?.(msg);
  let sitemapUrl: string | null = manualUrl?.trim() || null;
  let foundVia = "";

  // ── Step 1: robots.txt ─────────────────────────────────────────────────────
  if (!sitemapUrl) {
    log("Checking robots.txt…");
    try {
      const robots = await fetchViaProxy(`${domain}/robots.txt`);
      const matches = Array.from(robots.matchAll(/Sitemap:\s*(\S+)/gi));
      if (matches.length > 0) {
        sitemapUrl = matches[0][1].trim();
        foundVia = "robots.txt";
        log(`✓ Found sitemap URL in robots.txt`);
        if (matches.length > 1) log(`  (${matches.length} sitemaps listed — using first)`);
      }
    } catch { log("robots.txt unavailable — checking well-known paths…"); }
  }

  // ── Step 2: Well-known paths ───────────────────────────────────────────────
  if (!sitemapUrl) {
    log("Checking well-known sitemap paths…");
    for (const path of SITEMAP_PATHS) {
      const candidate = `${domain}${path}`;
      try {
        const text = await fetchViaProxy(candidate, 7000);
        if (looksLikeSitemap(text)) {
          sitemapUrl = candidate;
          foundVia = path;
          log(`✓ Found at ${path}`);
          break;
        }
      } catch {}
    }
  }

  if (!sitemapUrl) {
    throw new Error(
      "No sitemap found at robots.txt or any standard path. " +
      "Try pasting the sitemap URL directly, or use the URL List tab to paste URLs."
    );
  }

  // ── Step 3: Fetch and parse ────────────────────────────────────────────────
  log(`Fetching sitemap from ${foundVia || "provided URL"}…`);
  const sitemapText = await fetchViaProxy(sitemapUrl);
  let allUrls: string[] = [];

  // Plain-text sitemap (.txt)
  if (sitemapUrl.endsWith(".txt") || (!sitemapText.includes("<") && sitemapText.includes("http"))) {
    allUrls = parsePlainTextSitemap(sitemapText);
    log(`Plain text sitemap: ${allUrls.length} URLs`);
  } else {
    const parsed = parseXml(sitemapText);
    if (parsed.type === "index") {
      log(`Sitemap index: ${parsed.urls.length} child sitemaps`);
      for (const child of parsed.urls.slice(0, 15)) {
        try {
          const childText = await fetchViaProxy(child, 8000);
          const childParsed = parseXml(childText);
          allUrls = [...allUrls, ...childParsed.urls];
          log(`  ↳ ${child.split("/").pop()} — ${childParsed.urls.length} URLs`);
        } catch { log(`  ↳ skipped: ${child.split("/").pop()}`); }
      }
      if (parsed.urls.length > 15) log(`  (${parsed.urls.length - 15} child sitemaps skipped — capped at 15)`);
    } else {
      allUrls = parsed.urls;
    }
  }

  log(`${allUrls.length} raw URLs found`);

  const filtered = filterUrls(allUrls, domain);
  log(`${filtered.length} signal URLs after filtering`);

  if (!filtered.length && allUrls.length > 0) {
    log(`⚠ All URLs filtered out — domain mismatch? Returning unfiltered sample.`);
    const sampled = sampleUrls(allUrls);
    return sampled;
  }

  const sampled = sampleUrls(filtered);
  if (filtered.length > 600) log(`Sampled 600 from ${filtered.length} total`);
  return sampled;
}
