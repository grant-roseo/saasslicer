import "./landing.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SaaS Slicer — Competitive Content Strategy Intelligence",
  description: "AI-powered competitive content strategy for SaaS. Map competitor content, identify gaps, build ICP profiles, and get a prioritised content plan in minutes.",
};

export default function HomePage() {
  return (
    <div className="landing">
      <nav className="l-family-nav">
        <a href="https://appslicer.com">App Slicer</a>
        <div className="l-divider" />
        <a href="https://schemaslicer.com">Schema Slicer</a>
        <div className="l-divider" />
        <a href="https://queryslicer.com">Query Slicer</a>
        <div className="l-divider" />
        <a href="https://trafficslicer.com">Traffic Slicer</a>
        <div className="l-divider" />
        <a href="https://curveslicer.com">Curve Slicer</a>
        <div className="l-divider" />
        <a href="https://saasslicer.com" className="active">SaaS Slicer</a>
      </nav>
      <nav className="l-main-nav">
        <a href="/" className="l-nav-logo">
          <div className="l-nav-logo-mark">Ss</div>
          <div className="l-nav-logo-text">SaaS<span>Slicer</span></div>
        </a>
        <div className="l-nav-links">
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
          <a href="#who-its-for">Who it&apos;s for</a>
          <a href="#pricing">Pricing</a>
        </div>
        <div className="l-nav-cta">
          <a href="/app" className="l-btn l-btn-primary">Start now &rarr;</a>
        </div>
      </nav>
      <div className="l-hero">
        <div className="l-hero-inner">
          <div>
            <div className="l-eyebrow">AI-Powered Content Strategy</div>
            <h1 className="l-h1">Know exactly what<br />content <em>wins</em><br />in your market.</h1>
            <p className="l-hero-sub">SaaS Slicer maps every competitor&apos;s content architecture, finds the gaps costing you pipeline, builds ICP profiles, and hands you a prioritised content plan &mdash; in minutes.</p>
            <div className="l-hero-actions">
              <a href="/app" className="l-btn l-btn-dark l-btn-lg">Start your analysis &rarr;</a>
              <a href="#how-it-works" className="l-btn l-btn-outline l-btn-lg">See how it works</a>
            </div>
            <div className="l-trust">
              <span>Up to 5 competitors</span>
              <span>Up to 20 ICP profiles</span>
              <span>Word &amp; Excel exports</span>
            </div>
          </div>
          <div className="l-widget">
            <div className="l-widget-hdr">
              <div className="l-dots"><div className="l-dot" /><div className="l-dot" /><div className="l-dot" /></div>
              <div className="l-widget-title">SaaS Slicer &mdash; Running analysis&hellip;</div>
            </div>
            <div className="l-widget-body">
              <div className="l-wstep"><div className="l-wnum done">&#10003;</div><div><div className="l-wlabel">Clustering URLs</div><div className="l-wdetail">12 categories found <span className="l-wbadge badge-g">Done</span></div></div></div>
              <div className="l-wstep"><div className="l-wnum done">&#10003;</div><div><div className="l-wlabel">Crawling pages</div><div className="l-wdetail">68 pages crawled, 94/100 confidence <span className="l-wbadge badge-g">Done</span></div></div></div>
              <div className="l-wstep"><div className="l-wnum done">&#10003;</div><div><div className="l-wlabel">Gap analysis</div><div className="l-wdetail">17 gaps &middot; 6 critical <span className="l-wbadge badge-a">Ready</span></div></div></div>
              <div className="l-wstep"><div className="l-wnum active">4</div><div><div className="l-wlabel">Building ICP profiles&hellip;</div><div className="l-wdetail" style={{color:"#16a34a"}}>&#8987; Identifying audience gaps across 3 competitors</div></div></div>
              <div className="l-wstep" style={{opacity:0.4}}><div className="l-wnum">5</div><div><div className="l-wlabel">Strategy narrative</div><div className="l-wdetail">Word docs pending&hellip;</div></div></div>
            </div>
            <div className="l-widget-icp">
              <div className="l-icp-label">ICPs identified so far</div>
              <div className="l-icp-strip">
                <div className="l-icp-chip"><span>VP Legal &middot; SaaS</span><span className="l-score l-score-high">Gap 82</span></div>
                <div className="l-icp-chip"><span>Head of Procurement</span><span className="l-score">Gap 71</span></div>
                <div className="l-icp-chip"><span>In-House Counsel</span><span className="l-score l-score-high">Gap 78</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="l-stat-band">
        <div className="l-stat-inner">
          <div className="l-stat"><div className="l-stat-num">5</div><p>Competitors analysed simultaneously with full URL clustering and meta crawling per site</p></div>
          <div className="l-stat"><div className="l-stat-num">20</div><p>Ideal Customer Profiles identified &mdash; by industry, role, pain points, and content needs</p></div>
          <div className="l-stat"><div className="l-stat-num">7</div><p>Deliverables: XLSX with 5 sheets, two Word doc narratives, and a saveable JSON session</p></div>
        </div>
      </div>
      <section id="features" className="l-section" style={{background:"white"}}>
        <div className="l-section-inner">
          <div className="l-label">What it does</div>
          <h2 className="l-h2">Everything you need to<br /><em>outrank and outwrite</em> your competitors.</h2>
          <p className="l-section-sub">Most content audits tell you what exists. SaaS Slicer tells you what&apos;s missing, who it&apos;s missing for, and exactly what to build next.</p>
          <div className="l-grid-3">
            <div className="l-card l-card-accent"><span className="l-card-icon">&#128300;</span><h3>Deep URL Clustering</h3><p>Every competitor URL is tokenised and grouped into content categories &mdash; blog, solutions, industries, use cases, comparisons, and more. Prioritised by strategic importance before analysis begins.</p></div>
            <div className="l-card"><span className="l-card-icon">&#128375;</span><h3>Adaptive Meta Crawling</h3><p>SaaS Slicer fetches page titles, H1s, meta descriptions and schema types for each category. It samples intelligently &mdash; more depth on high-signal categories, faster passes on boilerplate pages.</p></div>
            <div className="l-card"><span className="l-card-icon">&#127919;</span><h3>Gap Analysis</h3><p>Every significant content gap &mdash; missing verticals, role pages, comparison content, use cases, and proof pages &mdash; is identified, prioritised, and explained with a clear action and rationale.</p></div>
            <div className="l-card"><span className="l-card-icon">&#128101;</span><h3>ICP Profiles (up to 20)</h3><p>Each competitor&apos;s content signals what audiences they&apos;re targeting. SaaS Slicer extracts the ICPs your competitors are serving that you&apos;re not &mdash; with pain points, JTBD, search queries, and AI prompts.</p></div>
            <div className="l-card"><span className="l-card-icon">&#128203;</span><h3>Content Plan</h3><p>A prioritised list of page recommendations &mdash; net new, refresh, or repurpose &mdash; each with a URL suggestion, target query, funnel stage, core angle, and the ICPs it serves.</p></div>
            <div className="l-card"><span className="l-card-icon">&#9997;&#65039;</span><h3>Strategy Narratives</h3><p>Two AI-written Word documents: an overall content strategy playbook and an ICP-specific narrative. Editable, exportable, and ready to share with clients or leadership.</p></div>
          </div>
        </div>
      </section>
      <section id="how-it-works" className="l-section" style={{background:"var(--lc)"}}>
        <div className="l-section-inner">
          <div className="l-label">How it works</div>
          <h2 className="l-h2">From sitemap to strategy<br /><em>in under 10 minutes.</em></h2>
          <p className="l-section-sub">Add your client and up to five competitors. SaaS Slicer handles the rest.</p>
          <div className="l-steps">
            <div className="l-step"><div className="l-step-num">1</div><h3>Add sites</h3><p>Paste a URL list, drop in an XML sitemap, or let auto-discovery find it. Works with any CMS. Up to 6 sites total.</p></div>
            <div className="l-step"><div className="l-step-num">2</div><h3>Choose your AI</h3><p>Claude Sonnet, GPT-4o, or Gemini 2.5 Pro. Pick the model that fits your workflow and budget.</p></div>
            <div className="l-step"><div className="l-step-num">3</div><h3>Review the plan</h3><p>Before the narrative is written, you get a human-in-the-loop review. Flag pages that already exist, add gaps that were missed.</p></div>
            <div className="l-step"><div className="l-step-num">4</div><h3>Download everything</h3><p>XLSX with 5 tabs, two Word doc narratives, and a saveable JSON session. Share with your client the same day.</p></div>
          </div>
        </div>
      </section>
      <section id="who-its-for" className="l-section" style={{background:"white"}}>
        <div className="l-section-inner">
          <div className="l-label">Who uses SaaS Slicer</div>
          <h2 className="l-h2">Built for every stage of<br />the <em>SEO engagement.</em></h2>
          <div className="l-grid-2" style={{marginTop:0}}>
            <div className="l-audience-card"><h3><div className="l-aud-dot" />SEO managers &amp; consultants</h3><ul><li>Walk into a new client with a complete competitor map on day one</li><li>Show exactly what content gaps are costing pipeline &mdash; with evidence</li><li>Deliver a prioritised content plan the client can act on immediately</li><li>Export a Word narrative ready for the strategy presentation</li></ul></div>
            <div className="l-audience-card"><h3><div className="l-aud-dot" />In-house content teams</h3><ul><li>Understand which ICPs your content isn&apos;t serving &mdash; and why</li><li>Build a content calendar mapped to audience pain points, not guesses</li><li>Compare your architecture against category leaders quarterly</li><li>Give sales the pages they need to close deals in each vertical</li></ul></div>
            <div className="l-audience-card"><h3><div className="l-aud-dot" />Digital marketing agencies</h3><ul><li>Run full competitive content audits in a fraction of the usual time</li><li>Produce client-ready deliverables &mdash; Word docs, Excel, JSON saves</li><li>Build a repeatable onboarding workflow for every new SaaS client</li><li>Show ROI of content strategy with clear, data-backed gap identification</li></ul></div>
            <div className="l-audience-card"><h3><div className="l-aud-dot" />Growth &amp; product marketing</h3><ul><li>Identify which customer segments competitors are winning content for</li><li>Map ICP pain points to TOFU, MOFU, and BOFU content needs</li><li>Validate your messaging against what&apos;s working in the market</li><li>Build the business case for content investment with concrete gap data</li></ul></div>
          </div>
        </div>
      </section>
      <section className="l-section" style={{background:"var(--lc)"}}>
        <div className="l-section-inner">
          <div className="l-label">What you get</div>
          <h2 className="l-h2">Every deliverable you need.<br /><em>Nothing you don&apos;t.</em></h2>
          <p className="l-section-sub">Five views in the app, two Word docs, and a full Excel export. Everything is editable before you download.</p>
          <div className="l-outputs">
            <div className="l-output"><div className="l-output-icon">&#128202;</div><h3>Excel Workbook (5 sheets)</h3><p>Content Plan with ICP columns, Gap Analysis with ICP relevance, Site Overview, ICP Profiles with JTBD and search queries, and Content &rarr; ICP mapping.</p><div className="l-output-tags"><span className="l-output-tag">Content Plan</span><span className="l-output-tag">Gap Analysis</span><span className="l-output-tag">ICP Profiles</span><span className="l-output-tag">ICP Map</span></div></div>
            <div className="l-output"><div className="l-output-icon">&#128196;</div><h3>Word Doc Narratives (2)</h3><p>A content strategy playbook covering competitive analysis, strategic gaps, and recommended sequence &mdash; plus a separate ICP narrative with audience-specific recommendations.</p><div className="l-output-tags"><span className="l-output-tag">Strategy Playbook</span><span className="l-output-tag">ICP Narrative</span><span className="l-output-tag">Editable</span></div></div>
            <div className="l-output"><div className="l-output-icon">&#128260;</div><h3>Saved Session (.json)</h3><p>Save and reload any analysis. Return to the results, regenerate the narrative, or export to a new format &mdash; without re-running the full analysis.</p><div className="l-output-tags"><span className="l-output-tag">Resumable</span><span className="l-output-tag">Re-export</span><span className="l-output-tag">Share</span></div></div>
          </div>
        </div>
      </section>
      <section id="pricing" className="l-section" style={{background:"white"}}>
        <div className="l-section-inner">
          <div className="l-label">Pricing</div>
          <h2 className="l-h2">Affordable by design.</h2>
          <p className="l-section-sub">Pay for what you use. Each analysis draws on your own API keys &mdash; no markup, no hidden usage fees.</p>
          <div className="l-pricing-grid">
            <div className="l-price-card"><div className="l-tier">Starter</div><div className="l-price">Free <span style={{fontSize:14}}>to try</span></div><div className="l-price-sub">Bring your own API key. No account needed.</div><ul><li>1 client + up to 5 competitors</li><li>Full analysis pipeline</li><li>ICP profiles (up to 20)</li><li>Excel + Word doc exports</li><li>Claude, GPT-4o, or Gemini</li><li>Human-in-the-loop review step</li></ul><a href="/app" className="l-btn l-btn-outline" style={{width:"100%",justifyContent:"center"}}>Start analysing</a></div>
            <div className="l-price-card featured"><div className="l-price-badge">Coming soon</div><div className="l-tier">Pro</div><div className="l-price">TBD <span>/ month</span></div><div className="l-price-sub">Managed credits, saved history, team sharing.</div><ul><li>Everything in Starter</li><li>Managed API credits &mdash; no keys needed</li><li>Saved analysis history</li><li>Team sharing and collaboration</li><li>Bulk competitor runs</li><li>Priority support</li></ul><a href="#" className="l-btn l-btn-primary" style={{width:"100%",justifyContent:"center"}}>Join the waitlist</a></div>
          </div>
          <p className="l-price-note">Typical analysis cost: ~$0.50&ndash;$2.00 in AI API credits per run. You pay your API provider directly.</p>
        </div>
      </section>
      <div className="l-cta-band">
        <div className="l-cta-inner">
          <h2 className="l-h2">Ready to see what your<br />competitors have built?</h2>
          <p className="l-cta-p">Add your client site and a competitor. SaaS Slicer will map the landscape, find the gaps, and write the strategy &mdash; in one run.</p>
          <a href="/app" className="l-btn l-btn-primary l-btn-lg" style={{fontSize:16,padding:"15px 36px"}}>Start your analysis &rarr;</a>
          <div className="l-cta-sub">Bring your own API key &middot; No account needed &middot; Results in 5&ndash;10 minutes</div>
        </div>
      </div>
      <footer className="l-footer">
        <div className="l-footer-inner">
          <a href="/" className="l-footer-logo"><div className="l-footer-mark">Ss</div><div className="l-footer-wordmark">SaaS<span>Slicer</span></div></a>
          <div className="l-footer-links">
            <a href="https://appslicer.com">App Slicer</a>
            <a href="https://schemaslicer.com">Schema Slicer</a>
            <a href="https://queryslicer.com">Query Slicer</a>
            <a href="https://trafficslicer.com">Traffic Slicer</a>
            <a href="https://curveslicer.com">Curve Slicer</a>
          </div>
          <div style={{fontSize:11.5,color:"#a8a29e"}}>Part of the Slicer app family</div>
        </div>
        <div className="l-footer-copy">&copy; 2025 SaaS Slicer</div>
      </footer>
    </div>
  );
}
