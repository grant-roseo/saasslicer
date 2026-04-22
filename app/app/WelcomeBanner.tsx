"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { T } from "@/lib/design";

// Renders a one-time welcome banner above the SlicerApp on first arrival
// after email confirmation. Two reasons it's a Client Component:
//   1. Needs to call router.replace() to clean the welcome=1 param from the
//      URL so a page refresh doesn't re-show the banner
//   2. Needs the dismiss (×) interaction
//
// The parent (Server Component /app/page.tsx) reads searchParams.welcome
// and passes the flag down — so the banner element doesn't render at all
// for repeat visits, which is the cheapest possible defense against flicker.
export default function WelcomeBanner({ show }: { show: boolean }) {
  const router = useRouter();
  // Local visibility — lets the user dismiss without waiting on a server
  // round-trip. The router.replace below also handles the URL cleanup
  // so future refreshes won't re-show.
  const [visible, setVisible] = useState(show);

  useEffect(() => {
    if (!show) return;
    // Strip the welcome=1 param from the URL without adding a history entry.
    // After this, refreshing the page won't re-show the banner.
    router.replace("/app");
  }, [show, router]);

  if (!visible) return null;

  return (
    <div style={{
      // Sits above the SlicerApp inside its own constrained container
      maxWidth: 1180,
      margin: "20px auto 0",
      padding: "0 20px",
    }}>
      <div style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 14,
        padding: "16px 20px",
        background: T.accentBg,
        border: `1px solid ${T.successBdr}`,
        borderRadius: 12,
        position: "relative",
      }}>
        <div style={{
          fontSize: 26,
          lineHeight: 1,
          marginTop: -2,
          flexShrink: 0,
        }}>
          🎉
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 15,
            fontWeight: 700,
            color: T.accent,
            marginBottom: 4,
            letterSpacing: "-0.2px",
          }}>
            Welcome to SaaS Slicer!
          </div>
          <div style={{
            fontSize: 13.5,
            color: T.text,
            lineHeight: 1.55,
            opacity: 0.85,
          }}>
            Your account is ready. Add your client site and a few competitors below to start your first competitive content analysis &mdash; results in 5&ndash;10 minutes.
          </div>
        </div>
        <button
          onClick={() => setVisible(false)}
          aria-label="Dismiss welcome banner"
          title="Dismiss"
          style={{
            background: "transparent",
            border: "none",
            color: T.muted,
            fontSize: 20,
            lineHeight: 1,
            cursor: "pointer",
            padding: "2px 8px",
            borderRadius: 6,
            fontFamily: "inherit",
            flexShrink: 0,
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}
