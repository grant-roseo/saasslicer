import { T } from "@/lib/design";
import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: "100vh",
      background: T.bg,
      display: "flex",
      flexDirection: "column",
      fontFamily: "Inter, system-ui, -apple-system, sans-serif",
    }}>
      {/* Minimal header */}
      <div style={{
        padding: "16px 24px",
        borderBottom: `1px solid ${T.border}`,
        background: T.surface,
      }}>
        <Link href="/" style={{
          display: "inline-flex", alignItems: "center", gap: 10,
          textDecoration: "none",
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, background: T.accent,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 17, fontWeight: 900, color: "#fff",
          }}>⌖</div>
          <div>
            <div style={{
              fontSize: 16, fontWeight: 800, color: T.text, letterSpacing: "-0.5px",
            }}>
              SaaS<span style={{ color: T.accent }}>Slicer</span>
            </div>
            <div style={{
              fontSize: 10, color: T.dim, letterSpacing: "0.6px", textTransform: "uppercase",
            }}>
              Competitive Content Intelligence
            </div>
          </div>
        </Link>
      </div>

      {/* Centered card */}
      <div style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
      }}>
        <div style={{ width: "100%", maxWidth: 420 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
