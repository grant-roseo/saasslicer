"use client";
import { useState, useEffect } from "react";
import { T, card, btn } from "@/lib/design";

function MDView({ text }: { text: string }) {
  const fmt = (t: string) => t
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");

  const els: React.ReactNode[] = [];
  const lines = text.split("\n");
  let listBuf: string[] = [];
  const flushList = () => {
    if (!listBuf.length) return;
    els.push(<ul key={"ul"+els.length} style={{ margin:"6px 0 14px", paddingLeft:22 }}>
      {listBuf.map((item,i) => <li key={i} style={{ fontSize:14, color:T.muted, lineHeight:1.75, marginBottom:4 }} dangerouslySetInnerHTML={{ __html:item }} />)}
    </ul>);
    listBuf = [];
  };

  lines.forEach((line, i) => {
    const t = line.trim();
    if (!t) { flushList(); els.push(<div key={i} style={{ height:8 }} />); return; }
    if (t.startsWith("## ")) {
      flushList();
      els.push(<div key={i} style={{ marginTop:28, marginBottom:10 }}>
        <h2 style={{ fontSize:18, fontWeight:800, color:T.text, margin:0 }} dangerouslySetInnerHTML={{ __html:fmt(t.slice(3)) }} />
        <div style={{ height:2, background:`linear-gradient(90deg,${T.accent},${T.accentBg})`, marginTop:6, borderRadius:2 }} />
      </div>);
    } else if (t.startsWith("### ")) {
      flushList();
      els.push(<h3 key={i} style={{ fontSize:15, fontWeight:700, color:T.accentDark, marginTop:16, marginBottom:4 }} dangerouslySetInnerHTML={{ __html:fmt(t.slice(4)) }} />);
    } else if (t.startsWith("- ") || t.startsWith("• ")) {
      listBuf.push(fmt(t.slice(2)));
    } else if (t === "---") {
      flushList(); els.push(<hr key={i} style={{ border:"none", borderTop:"1px solid "+T.border, margin:"20px 0" }} />);
    } else {
      flushList();
      els.push(<p key={i} style={{ fontSize:14, color:T.muted, lineHeight:1.8, margin:"0 0 8px" }} dangerouslySetInnerHTML={{ __html:fmt(t) }} />);
    }
  });
  flushList();
  return <div>{els}</div>;
}

export default function NarrativeTab({
  strategyNarrative,
  icpNarrative,
  onUpdateStrategy,
  onUpdateIcp,
  onExportDoc,
}: {
  strategyNarrative: string;
  icpNarrative:      string;
  onUpdateStrategy:  (s: string) => void;
  onUpdateIcp:       (s: string) => void;
  onExportDoc:       () => void;
}) {
  const [activeNarr, setActiveNarr] = useState<"strategy" | "icp">("strategy");
  const [editing,    setEditing]    = useState(false);
  const [draft,      setDraft]      = useState("");

  const current = activeNarr === "strategy" ? strategyNarrative : icpNarrative;
  const words = (current||"").split(/\s+/).filter(Boolean).length;

  useEffect(() => { setDraft(current); }, [current]);

  function save() {
    if (activeNarr === "strategy") onUpdateStrategy(draft);
    else onUpdateIcp(draft);
    setEditing(false);
  }

  return (
    <div>
      {/* Narrative switcher */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20, flexWrap:"wrap", gap:10 }}>
        <div style={{ display:"flex", gap:6 }}>
          {[
            { id:"strategy" as const, label:"Strategy Narrative" },
            { id:"icp"      as const, label:"ICP Narrative" },
          ].map(opt => (
            <button key={opt.id} onClick={()=>{ setActiveNarr(opt.id); setEditing(false); }}
              style={{ padding:"8px 18px", fontFamily:"inherit", fontWeight:700, fontSize:13.5, border:"none", cursor:"pointer", background: activeNarr===opt.id ? T.accent : "transparent", color: activeNarr===opt.id ? "#fff" : T.muted, borderRadius:8, transition:"all 0.15s" }}>
              {opt.label}
            </button>
          ))}
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <span style={{ fontSize:12.5, color:T.dim, alignSelf:"center" }}>{words.toLocaleString()} words</span>
          {!editing && (
            <button onClick={() => { setDraft(current); setEditing(true); }} style={{ ...btn("ghost"), fontSize:13 }}>
              ✎ Edit
            </button>
          )}
          {editing && (
            <>
              <button onClick={save}             style={{ ...btn("success"), fontSize:13 }}>✓ Save</button>
              <button onClick={() => setEditing(false)} style={{ ...btn("ghost"), fontSize:13 }}>Cancel</button>
            </>
          )}
          <button onClick={onExportDoc} style={{ ...btn("primary"), fontSize:13 }}>⬇ Word Docs</button>
        </div>
      </div>

      {/* Content */}
      {editing ? (
        <textarea
          style={{ background:T.surface, border:"1px solid "+T.border, borderRadius:10, color:T.text, padding:"16px 20px", fontSize:14, width:"100%", fontFamily:"'Inter',sans-serif", height:600, resize:"vertical", lineHeight:1.8 }}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          autoFocus
        />
      ) : (
        <div style={{ ...card(), minHeight:400, padding:"24px 28px" }}>
          {current ? <MDView text={current} /> : (
            <div style={{ color:T.dim, fontStyle:"italic" }}>No narrative generated yet.</div>
          )}
        </div>
      )}

      <div style={{ marginTop:12, fontSize:12.5, color:T.dim }}>
        Both narratives are exported together as a single Word document. The Strategy narrative covers overall competitive positioning; the ICP narrative covers content recommendations by audience.
      </div>
    </div>
  );
}
