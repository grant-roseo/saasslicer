import { NextRequest, NextResponse } from "next/server";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const provider = body._provider;

  if (provider === "openai" || body.model?.startsWith("gpt")) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
    const { _provider, ...fwd } = body;
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
      body: JSON.stringify(fwd),
    });
    return NextResponse.json(await res.json(), { status: res.status });

  } else if (provider === "gemini" || body.model?.startsWith("gemini")) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
    const { _provider, ...fwd } = body;
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
      body: JSON.stringify(fwd),
    });
    return NextResponse.json(await res.json(), { status: res.status });

  } else {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });
    return NextResponse.json(await res.json(), { status: res.status });
  }
}
