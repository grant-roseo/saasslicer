import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const { urls } = await req.json() as { urls: string[] };
  if (!urls?.length) return NextResponse.json({ pages: [] });

  const results = await Promise.allSettled(
    urls.map(url => crawlPage(url))
  );

  const pages = results.map((r, i) =>
    r.status === "fulfilled" ? r.value : {
      url: urls[i],
      title: "",
      metaDescription: "",
      h1: "",
      schemaTypes: [] as string[],
      wordCountEstimate: 0,
      crawlMethod: "failed" as const,
    }
  );

  return NextResponse.json({ pages });
}

async function crawlPage(url: string) {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SitemapSlicer/3.0; +https://saasslicer.com)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return { url, title: "", metaDescription: "", h1: "", schemaTypes: [], wordCountEstimate: 0, crawlMethod: "failed" as const };
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    const title = $("title").first().text().trim()
      || $('meta[property="og:title"]').attr("content")?.trim()
      || "";

    const metaDescription = $('meta[name="description"]').attr("content")?.trim()
      || $('meta[property="og:description"]').attr("content")?.trim()
      || "";

    const h1 = $("h1").first().text().trim() || "";

    // Extract JSON-LD schema types
    const schemaTypes: string[] = [];
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).html() || "{}");
        const types = Array.isArray(json) ? json.map((j: any) => j["@type"]).flat() : [json["@type"]];
        types.filter(Boolean).forEach((t: string) => schemaTypes.push(t));
      } catch {}
    });

    // Rough word count from body text
    const bodyText = $("main, article, .content, body").first().text();
    const wordCountEstimate = bodyText.split(/\s+/).filter(w => w.length > 2).length;

    return {
      url,
      title,
      metaDescription,
      h1,
      schemaTypes: [...new Set(schemaTypes)],
      wordCountEstimate,
      crawlMethod: "fetch" as const,
    };
  } catch {
    return { url, title: "", metaDescription: "", h1: "", schemaTypes: [], wordCountEstimate: 0, crawlMethod: "failed" as const };
  }
}
