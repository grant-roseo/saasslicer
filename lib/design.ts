// ─── Design Tokens — SaaS Slicer pale green ───────────────────────────────────
export const T = {
  bg:           "#F0FDF4",   // pale green page background
  surface:      "#FFFFFF",
  card:         "#FFFFFF",
  border:       "#D1FAE5",   // green-tinted border
  borderLight:  "#ECFDF5",   // very soft green border
  accent:       "#16A34A",   // green-600
  accentDark:   "#14532D",   // green-900
  accentMid:    "#15803D",   // green-700
  accentBg:     "#DCFCE7",   // green-100
  accentText:   "#15803D",   // green-700
  text:         "#1C1917",
  muted:        "#78716C",
  dim:          "#A8A29E",
  success:      "#059669",
  successBg:    "#ECFDF5",
  successBdr:   "#A7F3D0",
  error:        "#DC2626",
  errorBg:      "#FEF2F2",
  errorBdr:     "#FECACA",
  warn:         "#D97706",   // keep amber — semantic warning colour
  warnBg:       "#FFFBEB",
  warnBdr:      "#FDE68A",
  info:         "#2563EB",
  infoBg:       "#EFF6FF",
  infoBdr:      "#BFDBFE",
  purple:       "#7C3AED",
  purpleBg:     "#F5F3FF",
  purpleBdr:    "#DDD6FE",
  teal:         "#0D9488",
  tealBg:       "#F0FDFA",
  tealBdr:      "#99F6E4",

  // Semantic maps
  priority: {
    critical: "#DC2626",
    high:     "#D97706",   // amber stays — semantic priority signal
    medium:   "#2563EB",
    low:      "#6B7280",
  },
  funnel: {
    TOFU:  "#059669",
    MOFU:  "#2563EB",      // blue for mid-funnel (was amber — freed for warnings only)
    BOFU:  "#DC2626",
    Mixed: "#7C3AED",
  },
  action: {
    net_new:   "#16A34A",  // green — new content
    refresh:   "#2563EB",  // blue — updating existing
    repurpose: "#D97706",  // amber — format change
  },
  provider: {
    anthropic: "#16A34A",  // green — matches SaaS Slicer brand
    openai:    "#10a37f",
    gemini:    "#4285f4",
  },
  category: {
    blog:              "#2563EB",
    product_service:   "#16A34A",
    industry_vertical: "#7C3AED",
    solution:          "#059669",
    who_we_serve:      "#0D9488",
    use_case:          "#DC2626",
    comparison:        "#6B7280",
    resource_guide:    "#2563EB",
    case_study:        "#16A34A",
    pricing:           "#059669",
    landing_page:      "#7C3AED",
    docs_support:      "#6B7280",
    other:             "#A8A29E",
  } as Record<string, string>,
} as const;

// ─── CSS helpers ──────────────────────────────────────────────────────────────
import type React from "react";

export function badge(color: string): React.CSSProperties {
  return {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 5,
    fontSize: 11,
    fontWeight: 700,
    background: color + "1A",
    color,
    textTransform: "uppercase",
    letterSpacing: "0.4px",
    whiteSpace: "nowrap",
    border: "1px solid " + color + "33",
  };
}

export function card(extra?: React.CSSProperties): React.CSSProperties {
  return {
    background: T.card,
    border: "1px solid " + T.border,
    borderRadius: 12,
    padding: 20,
    ...extra,
  };
}

export function btn(
  variant: "primary" | "ghost" | "success" | "danger" | "default" = "primary",
  extra?: React.CSSProperties
): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: "8px 18px",
    borderRadius: 7,
    border: "none",
    cursor: "pointer",
    fontFamily: "inherit",
    fontWeight: 600,
    fontSize: 13.5,
    transition: "all 0.15s",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    whiteSpace: "nowrap",
  };
  const variants: Record<string, React.CSSProperties> = {
    primary: { background: T.accentMid, color: "#fff" },  // green-700 — better contrast on pale green bg
    ghost:   { background: "transparent", color: T.muted, border: "1px solid " + T.border },
    success: { background: T.successBg, color: T.success, border: "1px solid " + T.successBdr },
    danger:  { background: T.errorBg,   color: T.error,   border: "1px solid " + T.errorBdr },
    default: { background: T.surface,   color: T.text,    border: "1px solid " + T.border },
  };
  return { ...base, ...variants[variant], ...extra };
}

export const inputStyle: React.CSSProperties = {
  background: T.surface,
  border: "1px solid " + T.border,
  borderRadius: 8,
  color: T.text,
  padding: "9px 13px",
  fontSize: 14,
  width: "100%",
  fontFamily: "inherit",
  transition: "border-color 0.15s, box-shadow 0.15s",
  outline: "none",
};

export const labelStyle: React.CSSProperties = {
  fontSize: 11.5,
  fontWeight: 700,
  color: T.muted,
  textTransform: "uppercase",
  letterSpacing: "0.6px",
  marginBottom: 6,
  display: "block",
};
