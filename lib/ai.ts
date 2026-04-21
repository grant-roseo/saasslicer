import type { AIProvider } from "./types";

let _provider: AIProvider = "anthropic";
export const setProvider = (p: AIProvider) => { _provider = p; };
export const getProvider = () => _provider;

const ANTHROPIC_KEY = typeof process !== "undefined" ? (process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || "") : "";
const OPENAI_KEY    = typeof process !== "undefined" ? (process.env.NEXT_PUBLIC_OPENAI_API_KEY    || "") : "";
const GEMINI_KEY    = typeof process !== "undefined" ? (process.env.NEXT_PUBLIC_GEMINI_API_KEY    || "") : "";

// Error class that carries the raw response text so callers can log it
export class AIParseError extends Error {
  rawResponse: string;
  constructor(message: string, rawResponse: string) {
    super(message);
    this.name = "AIParseError";
    this.rawResponse = rawResponse;
  }
}

export async function callAI(
  system: string,
  user: string,
  maxTokens = 2000
): Promise<string> {
  const MAX_RETRIES = 3;
  const DELAYS = [4000, 10000, 20000];
  const p = _provider;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let res: Response;

    if (p === "openai") {
      const body = {
        model: "gpt-4o-mini",
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: system },
          { role: "user",   content: user },
        ],
      };
      if (OPENAI_KEY) {
        res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_KEY}` },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, _provider: "openai" }),
        });
      }
      const d = await res.json().catch(() => ({}));
      if (res.ok && !d.error) return d.choices[0].message.content;
      const msg = d?.error?.message || `OpenAI error ${res.status}`;
      const isQuotaError = msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("billing");
      const isRateLimit  = (res.status === 429 && !isQuotaError) || res.status === 503;
      if (isRateLimit && attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, DELAYS[attempt])); continue;
      }
      if (isQuotaError) {
        throw new Error("OpenAI quota exceeded — check your billing at platform.openai.com/settings/billing");
      }
      throw new Error(msg);

    } else if (p === "gemini") {
      const body = {
        model: "gemini-2.5-pro",
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: system },
          { role: "user",   content: user },
        ],
      };
      if (GEMINI_KEY) {
        res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GEMINI_KEY}` },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, _provider: "gemini" }),
        });
      }
      const d = await res.json().catch(() => ({}));
      if (res.ok && !d.error) return d.choices[0].message.content;
      const msg = d?.error?.message || `Gemini error ${res.status}`;
      if ((res.status === 429 || res.status === 503) && attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, DELAYS[attempt])); continue;
      }
      throw new Error(msg);

    } else {
      // Anthropic Claude
      const body = {
        model: "claude-sonnet-4-20250514",
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: user }],
      };
      if (ANTHROPIC_KEY) {
        res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": ANTHROPIC_KEY,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
          },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      const d = await res.json().catch(() => ({}));
      if (res.ok && !d.error) return d.content[0].text;
      const msg = d?.error?.message || d?.message || `API error ${res.status}`;
      const isRetry = res.status === 529 || res.status === 429 || res.status === 503
        || msg.toLowerCase().includes("overload");
      if (isRetry && attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, DELAYS[attempt])); continue;
      }
      throw new Error(msg);
    }
  }
  throw new Error("Max retries exceeded");
}

// ─── JSON parsing helpers ────────────────────────────────────────────────────
// Shared by both strict and legacy variants. Returns null if all tiers fail.
function tryParseJson<T>(text: string): T | null {
  const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  // Tier 1: direct parse
  try { return JSON.parse(clean) as T; } catch {}

  // Tier 2: extract outermost {...}
  const m = clean.match(/\{[\s\S]+\}/);
  if (m) { try { return JSON.parse(m[0]) as T; } catch {} }

  // Tier 3: extract outermost [...]
  const a = clean.match(/\[[\s\S]+\]/);
  if (a) { try { return JSON.parse(a[0]) as T; } catch {} }

  // Tier 4: repair truncated arrays
  const repaired = repairJson<T>(clean);
  if (repaired !== null) return repaired;

  return null;
}

// Repair a truncated JSON response by extracting complete {...} items.
// Useful when max_tokens cuts off the response mid-array.
function repairJson<T>(text: string): T | null {
  const arrStart = text.indexOf('"items"');
  const bracketIdx = arrStart >= 0 ? text.indexOf("[", arrStart) : text.indexOf("[{");
  if (bracketIdx < 0) return null;

  const items: unknown[] = [];
  let i = bracketIdx + 1;
  while (i < text.length) {
    while (i < text.length && /[\s,]/.test(text[i])) i++;
    if (text[i] !== "{") break;
    let depth = 0, j = i;
    let inStr = false, esc = false;
    while (j < text.length) {
      const ch = text[j];
      if (esc) { esc = false; j++; continue; }
      if (ch === "\\" && inStr) { esc = true; j++; continue; }
      if (ch === '"') { inStr = !inStr; j++; continue; }
      if (!inStr) {
        if (ch === "{") depth++;
        if (ch === "}") { depth--; if (depth === 0) { j++; break; } }
      }
      j++;
    }
    if (depth === 0) {
      try { items.push(JSON.parse(text.slice(i, j))); } catch {}
    }
    i = j;
  }
  if (!items.length) return null;
  return (arrStart >= 0 ? { items } : items) as T;
}

// ─── STRICT: throws on parse failure with response preview ────────────────────
// Use this for critical calls where the caller needs to know when things fail.
// The thrown AIParseError includes the raw response for logging.
export async function callAIJsonStrict<T>(
  system: string,
  user: string,
  maxTokens = 2000
): Promise<T> {
  const text = await callAI(system, user, maxTokens);
  const parsed = tryParseJson<T>(text);
  if (parsed !== null) return parsed;
  throw new AIParseError(
    `JSON parse failed after ${text.length} chars returned. Likely output-token truncation or schema drift.`,
    text
  );
}

// ─── LEGACY: returns fallback on parse failure (kept for backward compat) ────
// Callers that use this MUST log explicitly — the function no longer silently
// swallows failures. A console.error is emitted so debugging is possible.
export async function callAIJson<T>(
  system: string,
  user: string,
  maxTokens = 2000,
  fallback: T
): Promise<T> {
  const text = await callAI(system, user, maxTokens);
  const parsed = tryParseJson<T>(text);
  if (parsed !== null) return parsed;

  // Louder than console.warn — this is surfaced in browser devtools for debugging
  // but callers should ideally use callAIJsonStrict and handle failures explicitly.
  console.error(
    "[ai] JSON parse failed — returning fallback. Response length:",
    text.length,
    "\nPreview:", text.slice(0, 400),
    "\nTail:", text.slice(-200)
  );
  return fallback;
}
