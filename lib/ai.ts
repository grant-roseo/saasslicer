// ─── AI Layer ────────────────────────────────────────────────────────────────
// As of April 2026:
//   Primary model:    Claude Opus 4.7  (claude-opus-4-7)    — $5 in / $25 out per 1M
//   Fallback model:   Claude Sonnet 4.6 (claude-sonnet-4-6-20260220) — $3 in / $15 out
//
// The app used to support user-selectable Anthropic/OpenAI/Gemini providers.
// That choice has been removed — Opus is the only primary, Sonnet is the only
// fallback. The OpenAI and Gemini code paths below are kept but unreachable; we
// leave them in place so a future "batch tier" or cost-conscious fallback can
// be re-enabled with a one-line config change instead of a git archaeology dig.
//
// Fallback semantics:
//   - Transient Opus failures (429/503/529/overload): retry 3× on Opus with
//     backoff. These are Anthropic-side and usually resolve within seconds.
//   - Non-transient Opus failures (all retries exhausted, auth errors, etc.):
//     fall back to Sonnet once. If Sonnet also fails, throw to caller.
//   - Opus JSON parse failures (AIParseError): fall back to Sonnet immediately.
//     Opus is more literal than Sonnet and sometimes returns verbose shapes
//     that break our JSON schema. Sonnet is more forgiving.
//   - Opus quality failures (valid JSON, empty items): do NOT fall back.
//     Auto-retrying on Sonnet would mask real prompt bugs. The caller sees
//     an empty result and can surface it in the log panel.
//
// Callers can opt out of fallback by passing { fallback: false } to either
// callAI or callAIJsonStrict.

import type { AIProvider } from "./types";

// ─── Model strings ───────────────────────────────────────────────────────────
export const MODEL_PRIMARY  = "claude-opus-4-7";
export const MODEL_FALLBACK = "claude-sonnet-4-6-20260220";

// ─── Provider — retained for compatibility, always "anthropic" now ───────────
let _provider: AIProvider = "anthropic";
export const setProvider = (p: AIProvider) => { _provider = p; };
export const getProvider = () => _provider;

// ─── API keys (only Anthropic is actually read) ──────────────────────────────
const ANTHROPIC_KEY = typeof process !== "undefined" ? (process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || "") : "";
const OPENAI_KEY    = typeof process !== "undefined" ? (process.env.NEXT_PUBLIC_OPENAI_API_KEY    || "") : "";
const GEMINI_KEY    = typeof process !== "undefined" ? (process.env.NEXT_PUBLIC_GEMINI_API_KEY    || "") : "";

// ─── Error class ─────────────────────────────────────────────────────────────
export class AIParseError extends Error {
  rawResponse: string;
  constructor(message: string, rawResponse: string) {
    super(message);
    this.name = "AIParseError";
    this.rawResponse = rawResponse;
  }
}

// Opus failed and we recovered on Sonnet. Still thrown when the caller wants to
// know this happened (e.g. for logging), but the caller usually catches it
// because the call actually succeeded — see the dual-path wrappers below.
export interface FallbackInfo {
  triggered: boolean;
  reason?: string;
}

// ─── Fallback notification channel ───────────────────────────────────────────
// When a fallback fires inside callAI, we need to surface it to the UI log
// panel without changing every caller's signature. Rather than bubble through
// returns (which would break dozens of call sites), we use a subscriber
// pattern: SlicerApp registers a listener at mount, AI layer pushes events.
type FallbackListener = (info: { reason: string; phase?: string; model: string }) => void;
let _fallbackListener: FallbackListener | null = null;
export function onFallback(listener: FallbackListener | null) { _fallbackListener = listener; }
function notifyFallback(reason: string, model: string, phase?: string) {
  if (_fallbackListener) { try { _fallbackListener({ reason, model, phase }); } catch {} }
}

// ─── Phase tagging — used for nicer fallback log messages ────────────────────
// Callers can set a phase context; fallback notifications include it so the
// UI log can say "🔄 Gap Batch 1 fell back to Sonnet" instead of generic.
let _currentPhase: string | undefined;
export function setAICallPhase(phase: string | undefined) { _currentPhase = phase; }

// ─── Low-level Anthropic call ────────────────────────────────────────────────
// Pure API call — no fallback logic. Returns the text or throws.
// Used by both callAI (primary path) and the Sonnet retry (fallback path).
async function callAnthropic(
  model: string,
  system: string,
  user: string,
  maxTokens: number
): Promise<string> {
  const MAX_RETRIES = 3;
  const DELAYS = [4000, 10000, 20000];

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const body = { model, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] };
    let res: Response;

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
    const isTransient = res.status === 529 || res.status === 429 || res.status === 503
      || msg.toLowerCase().includes("overload");

    if (isTransient && attempt < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, DELAYS[attempt]));
      continue;
    }
    throw new Error(msg);
  }
  throw new Error("Max retries exceeded");
}

// ─── High-level callAI with automatic Sonnet fallback ────────────────────────
// This is the primary entry point for plain-text calls. Tries Opus; on
// non-transient failure, retries once on Sonnet.
export interface CallAIOptions {
  fallback?: boolean;   // default true — set false to force Opus only
  phase?: string;       // optional phase tag for log clarity
}

export async function callAI(
  system: string,
  user: string,
  maxTokens = 2000,
  opts: CallAIOptions = {}
): Promise<string> {
  const { fallback = true, phase } = opts;
  const tagPhase = phase || _currentPhase;

  try {
    return await callAnthropic(MODEL_PRIMARY, system, user, maxTokens);
  } catch (err: any) {
    if (!fallback) throw err;
    const reason = err?.message || "unknown error";
    notifyFallback(reason, MODEL_FALLBACK, tagPhase);
    // One attempt on Sonnet 4.6 — fallback model failures are not retried-to-Opus
    return await callAnthropic(MODEL_FALLBACK, system, user, maxTokens);
  }
}

// ─── JSON parsing helpers ────────────────────────────────────────────────────
function tryParseJson<T>(text: string): T | null {
  const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  try { return JSON.parse(clean) as T; } catch {}
  const m = clean.match(/\{[\s\S]+\}/);
  if (m) { try { return JSON.parse(m[0]) as T; } catch {} }
  const a = clean.match(/\[[\s\S]+\]/);
  if (a) { try { return JSON.parse(a[0]) as T; } catch {} }
  const repaired = repairJson<T>(clean);
  if (repaired !== null) return repaired;
  return null;
}

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

// ─── Strict JSON with fallback on API failure OR parse failure ──────────────
// Tries Opus; on any failure (API or parse), tries Sonnet once; on Sonnet parse
// failure throws AIParseError with the Sonnet response; on Sonnet API failure
// throws the underlying error. Callers see a crystal-clear failure if both fail.
export async function callAIJsonStrict<T>(
  system: string,
  user: string,
  maxTokens = 2000,
  opts: CallAIOptions = {}
): Promise<T> {
  const { fallback = true, phase } = opts;
  const tagPhase = phase || _currentPhase;

  // Try Opus
  let opusText = "";
  let opusApiError: Error | null = null;
  try {
    opusText = await callAnthropic(MODEL_PRIMARY, system, user, maxTokens);
    const parsed = tryParseJson<T>(opusText);
    if (parsed !== null) return parsed;
    // Opus returned but parse failed
    if (!fallback) {
      throw new AIParseError(
        `JSON parse failed on Opus after ${opusText.length} chars. Output-token truncation or schema drift likely.`,
        opusText
      );
    }
    notifyFallback("Opus JSON parse failed — retrying on Sonnet", MODEL_FALLBACK, tagPhase);
  } catch (err: any) {
    if (err instanceof AIParseError) throw err;  // already thrown above, no fallback wanted
    opusApiError = err;
    if (!fallback) throw err;
    notifyFallback(err?.message || "Opus error", MODEL_FALLBACK, tagPhase);
  }

  // Try Sonnet fallback
  let sonnetText = "";
  try {
    sonnetText = await callAnthropic(MODEL_FALLBACK, system, user, maxTokens);
  } catch (sonnetErr: any) {
    // Both models failed on the API. Prefer reporting the Opus error since that's
    // the primary — Sonnet being down too is correlated, not independent info.
    if (opusApiError) throw opusApiError;
    throw sonnetErr;
  }

  const parsedSonnet = tryParseJson<T>(sonnetText);
  if (parsedSonnet !== null) return parsedSonnet;
  throw new AIParseError(
    `JSON parse failed on BOTH Opus and Sonnet fallback. Response lengths: Opus=${opusText.length} Sonnet=${sonnetText.length}.`,
    sonnetText || opusText
  );
}

// ─── Legacy JSON helper with fallback value (kept for backward compat) ───────
// Used by non-critical paths like confidence scoring where a fallback value is
// acceptable. Still tries Opus → Sonnet, but returns `fallback` instead of
// throwing if both fail.
export async function callAIJson<T>(
  system: string,
  user: string,
  maxTokens = 2000,
  fallback: T,
  opts: CallAIOptions = {}
): Promise<T> {
  try {
    return await callAIJsonStrict<T>(system, user, maxTokens, opts);
  } catch (err: any) {
    console.error(
      "[ai] JSON call failed on both models — returning fallback value.",
      "\nError:", err?.message,
      "\nPreview:", (err?.rawResponse || "").slice(0, 400)
    );
    return fallback;
  }
}

// ─── Unused: OpenAI / Gemini code paths (kept for future use) ────────────────
// The app no longer exposes model selection to users. These paths are preserved
// so a future "batch discount tier" or a non-Anthropic fallback can be wired in
// without rewriting this file. Reference `OPENAI_KEY` and `GEMINI_KEY` elsewhere
// to avoid unused-variable warnings.
void OPENAI_KEY; void GEMINI_KEY;
