import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const { urls } = await req.json() as { urls: string[] };
  if (!urls?.length) return NextResponse.json({ pages: [] });

  const results = await Promise.allSettled(urls.map(url => crawlPage(url)));

  const pages = results.map((r, i) =>
    r.status === "fulfilled" ? r.value : {
      url: urls[i], title: "", metaDescription: "", h1: "",
      h2s: [] as string[], h3s: [] as string[],
      schemaTypes: [] as string[], wordCount: 0,
      publishedDate: "", integrationsWith: [] as string[],
      crawlMethod: "failed" as const,
    }
  );

  return NextResponse.json({ pages });
}

async function crawlPage(url: string) {
  const failed = {
    url, title: "", metaDescription: "", h1: "",
    h2s: [] as string[], h3s: [] as string[],
    schemaTypes: [] as string[], wordCount: 0,
    publishedDate: "", integrationsWith: [] as string[],
    crawlMethod: "failed" as const,
  };

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SaaSSlicer/1.0; +https://saasslicer.com)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) return failed;

    const html = await res.text();
    const $ = cheerio.load(html);

    // ── Title & meta ──────────────────────────────────────────────────────────
    const title = $("title").first().text().trim()
      || $('meta[property="og:title"]').attr("content")?.trim()
      || "";

    const metaDescription = $('meta[name="description"]').attr("content")?.trim()
      || $('meta[property="og:description"]').attr("content")?.trim()
      || "";

    const h1 = $("h1").first().text().trim() || "";

    // ── H2/H3 headings — key topic coverage signal ────────────────────────────
    const h2s: string[] = [];
    $("h2").each((_, el) => {
      const t = $(el).text().replace(/\s+/g, " ").trim();
      if (t.length > 3 && t.length < 200) h2s.push(t);
    });

    const h3s: string[] = [];
    $("h3").each((_, el) => {
      const t = $(el).text().replace(/\s+/g, " ").trim();
      if (t.length > 3 && t.length < 150) h3s.push(t);
    });

    // ── Deep word count — body content only, strip navigation boilerplate ─────
    // Remove known non-content elements before counting
    $("nav, header, footer, .nav, .header, .footer, .menu, .sidebar, .cookie, script, style, noscript").remove();
    const contentSelectors = ["main", "article", '[role="main"]', ".content", ".post-content", ".entry-content", ".page-content", "section"];
    let contentText = "";
    for (const sel of contentSelectors) {
      const el = $(sel).first();
      if (el.length) { contentText = el.text(); break; }
    }
    if (!contentText) contentText = $("body").text();
    const wordCount = contentText
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .filter(w => w.length > 1).length;

    // ── Published date — check multiple sources ───────────────────────────────
    let publishedDate = "";
    const dateSources = [
      $('meta[property="article:published_time"]').attr("content"),
      $('meta[name="date"]').attr("content"),
      $('meta[name="publish_date"]').attr("content"),
      $('meta[property="og:article:published_time"]').attr("content"),
      $("time[datetime]").attr("datetime"),
      $('[itemprop="datePublished"]').attr("content"),
    ];
    for (const d of dateSources) {
      if (d && /\d{4}/.test(d)) { publishedDate = d; break; }
    }
    // Try JSON-LD if no meta date found
    if (!publishedDate) {
      $('script[type="application/ld+json"]').each((_, el) => {
        if (publishedDate) return;
        try {
          const json = JSON.parse($(el).html() || "{}");
          const date = json.datePublished || json.dateCreated || json.uploadDate;
          if (date && /\d{4}/.test(date)) publishedDate = date;
        } catch {}
      });
    }

    // ── Schema types ──────────────────────────────────────────────────────────
    const schemaTypes: string[] = [];
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).html() || "{}");
        const types = Array.isArray(json)
          ? json.map((j: any) => j["@type"]).flat()
          : [json["@type"]];
        types.filter(Boolean).forEach((t: string) => schemaTypes.push(t));
      } catch {}
    });

    // ── Integration names — extract from integration pages ────────────────────
    const integrationsWith: string[] = [];
    const urlLower = url.toLowerCase();
    if (urlLower.includes("integrat") || urlLower.includes("connect") || urlLower.includes("ecosystem")) {
      // Extract integration partner names from headings and title
      const allText = [title, h1, ...h2s, ...h3s].join(" ");
      const integrationPatterns = [
        /\b(salesforce|hubspot|slack|microsoft|teams|google|zendesk|jira|asana|notion|zapier|workday|netsuite|sap|oracle|servicenow|okta|docusign|adobe|box|dropbox|sharepoint|dynamics|zoho|pipedrive|intercom|freshdesk|github|gitlab|stripe|quickbooks|xero|sage|concur)\b/gi,
      ];
      for (const pattern of integrationPatterns) {
        const matches = allText.match(pattern) || [];
        matches.forEach(m => {
          const name = m.charAt(0).toUpperCase() + m.slice(1).toLowerCase();
          if (!integrationsWith.includes(name)) integrationsWith.push(name);
        });
      }
      // Also try: "X Integration" pattern in headings
      [...h2s, ...h3s, h1, title].forEach(text => {
        const m = text.match(/^([A-Z][A-Za-z0-9\s]{2,30})\s+[Ii]ntegration/);
        if (m && m[1] && !integrationsWith.includes(m[1].trim())) {
          integrationsWith.push(m[1].trim());
        }
      });
    }

    return {
      url, title, metaDescription, h1,
      h2s: h2s.slice(0, 12),     // cap at 12 H2s
      h3s: h3s.slice(0, 20),     // cap at 20 H3s
      schemaTypes: [...new Set(schemaTypes)],
      wordCount,
      publishedDate,
      integrationsWith: [...new Set(integrationsWith)],
      crawlMethod: "fetch" as const,
    };
  } catch {
    return failed;
  }
}
