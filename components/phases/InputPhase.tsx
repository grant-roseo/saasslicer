"use client";
import { useState, useRef } from "react";
import { T, card, btn, btnDisabled, inputStyle, labelStyle, badge } from "@/lib/design";
import { getDomain, filterUrls, sampleUrls, parseMultipleXml, discoverSitemapUrls } from "@/lib/sitemap";
import type { SiteInput, AnalysisState } from "@/lib/types";

function mkSite(id: string, role: "client" | "competitor"): SiteInput {
  return { id, role, name: "", domain: "", rawInput: "", inputMethod: "auto", urls: [], totalUrls: 0, status: "idle", errorMsg: "" };
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={labelStyle}>{children}</div>;
}

interface SiteCardProps {
  site: SiteInput;
  index: number;
  isClient: boolean;
  allSites: SiteInput[];
  onChange: (p: Partial<SiteInput>) => void;
  onRemove?: () => void;
}

function SiteCard({ site, index, isClient, allSites, onChange, onRemove }: SiteCardProps) {
  const [pasteTab, setPasteTab] = useState<"url" | "xml">("url");
  const [isVerifying, setIsVerifying] = useState(false);
  const accentCol = isClient ? T.accent : T.purple;
  const confirmed = site.status === "ready";

  async function handleVerify() {
    const domain = getDomain(site.domain || site.rawInput);
    if (!domain) { onChange({ errorMsg: "Enter a valid URL first", status: "error" }); return; }
    onChange({ domain, status: "loading", errorMsg: "" });
    setIsVerifying(true);
    try {
      const { urls, total } = await discoverSitemapUrls(domain, undefined, msg => {
        console.log(msg);
      });
      onChange({ urls, totalUrls: total, status: "ready", inputMethod: "auto", domain });
    } catch (e: any) {
      onChange({ status: "error", errorMsg: e.message });
    }
    setIsVerifying(false);
  }

  function handleUrlPaste() {
    const raw = site.rawInput.split("\n").map(u => u.trim()).filter(u => u.startsWith("http"));
    if (!raw.length) return;
    const domain = getDomain(raw[0]);
    const filtered = domain ? filterUrls(raw, domain) : raw;
    const { urls, total } = sampleUrls(filtered.length ? filtered : raw);
    onChange({ urls, totalUrls: total, status: "ready", inputMethod: "url_list", domain: domain || "" });
  }

  function handleXmlPaste() {
    const urls = parseMultipleXml(site.rawInput);
    if (!urls.length) return;
    const domain = getDomain(urls[0]);
    const filtered = domain ? filterUrls(urls, domain) : urls;
    const { urls: sampled, total } = sampleUrls(filtered.length ? filtered : urls);
    onChange({ urls: sampled, totalUrls: total, status: "ready", inputMethod: "xml_paste", domain: domain || "" });
  }

  const urlCount = site.rawInput.split("\n").filter(l => l.trim().startsWith("http")).length;
  const xmlCount = (() => {
    const m = site.rawInput.matchAll(/<loc[^>]*>([^<]+)<\/loc>/gi);
    return [...m].length;
  })();
  const looksLikeXml = site.rawInput.includes("<loc>");

  const readySites = allSites.filter(s => s.status === "ready" && s.id !== site.id);

  return (
    <div style={{ ...card(), marginBottom: 16, borderLeft: `3px solid ${confirmed ? T.success : accentCol}`, padding: "18px 20px" }}>
      {/* Card header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: 16 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={badge(accentCol)}>{isClient ? "Client" : `Competitor ${index}`}</span>
          {confirmed && (
            <span style={{ fontSize: 12.5, color: T.success, fontWeight: 600 }}>
              ✓ {site.name || site.domain} — {site.urls.length.toLocaleString()} URLs
            </span>
          )}
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          {confirmed && (
            <button onClick={() => onChange({ status: "idle", urls: [], totalUrls: 0, rawInput: "" })} style={{ ...btn("ghost"), fontSize:12, padding:"4px 10px" }}>
              Edit
            </button>
          )}
          {onRemove && !isClient && (
            <button onClick={onRemove} style={{ background:"transparent", border:"none", cursor:"pointer", color:T.dim, fontSize:16, lineHeight:1 }}>×</button>
          )}
        </div>
      </div>

      {!confirmed && (
        <>
          {/* Domain + name row */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
            <div>
              <Label>Website URL</Label>
              <input
                style={inputStyle}
                placeholder="https://example.com"
                value={site.domain || ""}
                onChange={e => onChange({ domain: e.target.value, errorMsg: "" })}
              />
            </div>
            <div>
              <Label>Display Name</Label>
              <input
                style={inputStyle}
                placeholder={isClient ? "My Company" : `Competitor ${index}`}
                value={site.name}
                onChange={e => onChange({ name: e.target.value })}
              />
            </div>
          </div>

          {/* Input method tabs */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display:"flex", borderBottom:`1px solid ${T.border}`, marginBottom:12 }}>
              {[
                { id:"auto",     label:"🔍 Auto-discover" },
                { id:"url_list", label:"🔗 Paste URLs" },
                { id:"xml_paste",label:"📄 Paste XML" },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => onChange({ inputMethod: tab.id as SiteInput["inputMethod"] })}
                  style={{ padding:"8px 14px", fontFamily:"inherit", fontWeight:600, fontSize:12.5, border:"none", cursor:"pointer", background:"transparent", color: site.inputMethod === tab.id ? accentCol : T.muted, borderBottom:`2px solid ${site.inputMethod === tab.id ? accentCol : "transparent"}`, marginBottom:-1, transition:"all 0.15s" }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {site.inputMethod === "auto" && (
              <div>
                <div style={{ fontSize:13, color:T.muted, marginBottom:10 }}>
                  Auto-discovers your sitemap via robots.txt, sitemap.xml, sitemap_index.xml, and wp-sitemap.xml.
                </div>
                <button
                  onClick={handleVerify}
                  disabled={isVerifying || !site.domain}
                  style={ (isVerifying || !site.domain) ? btnDisabled() : btn("primary") }
                >
                  {isVerifying ? "⟳ Discovering…" : "Discover Sitemap"}
                </button>
                {site.status === "loading" && (
                  <div style={{ fontSize:12, color:T.muted, marginTop:8 }}>Fetching robots.txt and sitemap…</div>
                )}
              </div>
            )}

            {site.inputMethod === "url_list" && (
              <div>
                <div style={{ fontSize:12.5, color:T.info, marginBottom:8 }}>
                  Paste one URL per line. Export from Screaming Frog, a crawl tool, or Google Search Console.
                </div>
                <textarea
                  style={{ ...inputStyle, height:140, resize:"vertical", lineHeight:1.6, fontSize:12.5, fontFamily:"'Courier New',monospace" }}
                  placeholder={"https://example.com/solutions/contract-review\nhttps://example.com/industries/healthcare\nhttps://example.com/blog/ai-review"}
                  value={site.rawInput}
                  onChange={e => onChange({ rawInput: e.target.value })}
                />
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:8 }}>
                  <div style={{ fontSize:12, color: looksLikeXml ? T.error : urlCount > 0 ? T.success : T.muted }}>
                    {looksLikeXml ? "⚠ Looks like XML — use Paste XML tab" : urlCount > 0 ? `✓ ${urlCount} URLs ready` : "Paste one URL per line"}
                  </div>
                  <button onClick={handleUrlPaste} disabled={urlCount === 0 || looksLikeXml} style={ urlCount > 0 && !looksLikeXml ? btn("primary") : btnDisabled() }>
                    Use these URLs
                  </button>
                </div>
              </div>
            )}

            {site.inputMethod === "xml_paste" && (
              <div>
                <div style={{ fontSize:12.5, color:T.info, marginBottom:8 }}>
                  Paste the raw XML from sitemap.xml. Multiple sitemaps can be concatenated together.
                </div>
                <textarea
                  style={{ ...inputStyle, height:140, resize:"vertical", lineHeight:1.4, fontSize:11, fontFamily:"'Courier New',monospace" }}
                  placeholder='<?xml version="1.0" encoding="UTF-8"?>&#10;<urlset>&#10;  <url><loc>https://example.com/page1</loc></url>&#10;  ...'
                  value={site.rawInput}
                  onChange={e => onChange({ rawInput: e.target.value })}
                />
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:8 }}>
                  <div style={{ fontSize:12, color: xmlCount > 0 ? T.success : T.muted }}>
                    {xmlCount > 0 ? `✓ ${xmlCount} URLs found in XML` : "Paste raw sitemap XML"}
                  </div>
                  <button onClick={handleXmlPaste} disabled={xmlCount === 0} style={ xmlCount > 0 ? btn("primary") : btnDisabled() }>
                    Use these URLs
                  </button>
                </div>
              </div>
            )}
          </div>

          {site.errorMsg && (
            <div style={{ fontSize:12.5, color:T.error, padding:"6px 10px", background:T.errorBg, borderRadius:6 }}>
              {site.errorMsg}
            </div>
          )}
        </>
      )}

      {/* Sites already added sidebar */}
      {readySites.length > 0 && !confirmed && (
        <div style={{ marginTop:12, padding:"10px 12px", background:T.bg, borderRadius:8, border:`1px solid ${T.borderLight}` }}>
          <div style={{ fontSize:11, color:T.dim, textTransform:"uppercase", letterSpacing:"0.5px", fontWeight:700, marginBottom:6 }}>Added so far</div>
          {readySites.map(s => (
            <div key={s.id} style={{ display:"flex", justifyContent:"space-between", fontSize:12.5, padding:"3px 0" }}>
              <span style={{ color:T.text, fontWeight:600 }}>{s.name || s.domain}</span>
              <span style={{ color:T.muted }}>{s.urls.length.toLocaleString()} URLs</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function InputPhase({
  onStart,
  onLoadJson,
}: {
  onStart: (sites: SiteInput[], notes: string) => void;
  onLoadJson: (state: AnalysisState) => void;
}) {
  const [client,    setClient]    = useState<SiteInput>(mkSite("client","client"));
  const [comps,     setComps]     = useState<SiteInput[]>([mkSite("c1","competitor")]);
  const [notes,     setNotes]     = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const allSites = [client, ...comps];
  const readySites = allSites.filter(s => s.status === "ready");
  const clientReady = client.status === "ready";
  const compReady = comps.some(c => c.status === "ready");
  const canStart = clientReady && compReady;

  function updateComp(id: string, p: Partial<SiteInput>) {
    setComps(cs => cs.map(c => c.id === id ? { ...c, ...p } : c));
  }

  function addComp() {
    if (comps.length >= 5) return;
    setComps(cs => [...cs, mkSite(`c${cs.length + 1}`, "competitor")]);
  }

  function removeComp(id: string) {
    setComps(cs => cs.filter(c => c.id !== id));
  }

  function handleFileLoad(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const state = JSON.parse(evt.target?.result as string) as AnalysisState;
        onLoadJson(state);
      } catch { alert("Invalid JSON file"); }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function handleStart() {
    const sites = allSites.filter(s => s.status === "ready").map(s => ({
      ...s,
      name: s.name || s.domain,
    }));
    onStart(sites, notes);
  }

  return (
    <div style={{ maxWidth: 820, margin: "0 auto" }}>
      {/* Hero */}
      <div style={{ marginBottom: 28, textAlign:"center" }}>
        <h1 style={{ fontSize: 32, fontWeight: 900, color: T.text, margin: "0 0 10px", letterSpacing:"-1px" }}>
          Competitive Content <span style={{ color: T.accent }}>Intelligence</span>
        </h1>
        <p style={{ fontSize: 15, color: T.muted, maxWidth: 520, margin:"0 auto" }}>
          Deep site analysis with ICP mapping, gap identification, and strategic content recommendations.
        </p>
      </div>

      {/* ─── Model info strip (replaces the old provider selector) ─────────────
          Opus 4.7 is the only primary model; Sonnet 4.6 acts as a silent
          fallback. The user no longer has a choice — we just tell them what's
          running so they know what quality tier the output reflects. */}
      <div style={{
        ...card(),
        marginBottom: 22,
        padding: "11px 16px",
        display: "flex", alignItems: "center", gap: 12,
        borderLeft: `3px solid ${T.accent}`,
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: T.accent,
          textTransform: "uppercase", letterSpacing: "0.6px",
          whiteSpace: "nowrap",
        }}>
          Powered by
        </div>
        <div style={{ fontSize: 13.5, color: T.text, fontWeight: 600 }}>
          Claude Opus 4.7
        </div>
        <div style={{ fontSize: 12, color: T.muted, flex: 1 }}>
          · automatic Sonnet 4.6 fallback if needed
        </div>
      </div>

      {/* Client */}
      <div style={{ fontSize:11, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:"0.6px", marginBottom:8 }}>
        Your Client Site
      </div>
      <SiteCard
        site={client}
        index={0}
        isClient
        allSites={allSites}
        onChange={p => setClient(s => ({ ...s, ...p }))}
      />

      {/* Competitors */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8, marginTop:8 }}>
        <div style={{ fontSize:11, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:"0.6px" }}>
          Competitors (up to 5)
        </div>
        {comps.length < 5 && (
          <button onClick={addComp} style={{ ...btn("ghost"), fontSize:12, padding:"5px 12px" }}>
            + Add competitor
          </button>
        )}
      </div>
      {comps.map((c, i) => (
        <SiteCard
          key={c.id}
          site={c}
          index={i + 1}
          isClient={false}
          allSites={allSites}
          onChange={p => updateComp(c.id, p)}
          onRemove={comps.length > 1 ? () => removeComp(c.id) : undefined}
        />
      ))}

      {/* Context notes */}
      <div style={{ ...card(), marginBottom:20, marginTop:8 }}>
        <Label>Analyst Context <span style={{ color:T.dim, fontWeight:400, textTransform:"none", letterSpacing:0 }}>— optional</span></Label>
        <textarea
          style={{ ...inputStyle, height:90, resize:"vertical", lineHeight:1.7 }}
          placeholder="Industry context, target personas, key differentiators, anything that would help Claude write a more tailored strategy…"
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />
      </div>

      {/* Summary + CTA */}
      {readySites.length > 0 && (
        <div style={{ background:T.infoBg, border:`1px solid ${T.infoBdr}`, borderRadius:8, padding:"10px 16px", marginBottom:20, fontSize:13, color:T.info }}>
          ℹ {readySites.length} site{readySites.length > 1 ? "s" : ""} ready ·
          {" "}{readySites.reduce((s,c) => s + c.urls.length, 0).toLocaleString()} total URLs ·
          Est. <strong>6–14 min</strong> with crawling
        </div>
      )}

      <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
        <button
          onClick={handleStart}
          disabled={!canStart}
          style={ canStart ? { ...btn("primary"), fontSize:15, padding:"13px 40px" } : btnDisabled("lg") }
        >
          ⚡ Run Analysis
        </button>
        {!clientReady && <span style={{ fontSize:12.5, color:T.error }}>Add your client site first</span>}
        {clientReady && !compReady && <span style={{ fontSize:12.5, color:T.error }}>Add at least one competitor</span>}
        <button onClick={() => fileRef.current?.click()} style={{ ...btn("ghost"), fontSize:13 }}>
          ↑ Load saved analysis
        </button>
        <input ref={fileRef} type="file" accept=".json" style={{ display:"none" }} onChange={handleFileLoad} />
      </div>
    </div>
  );
}
