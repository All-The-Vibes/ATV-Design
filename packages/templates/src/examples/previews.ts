/**
 * Real rendered HTML previews for the examples gallery.
 *
 * Unlike `thumbnails.ts` (abstract SVG placeholders), each entry here is a
 * self-contained HTML document that renders an actual, believable canvas for
 * the example. The hub's ExampleCard mounts these in a scaled, sandboxed,
 * animation-frozen iframe — the same technique DesignCardPreview uses for real
 * user designs — so the gallery shows what each prompt produces rather than a
 * decorative stand-in.
 *
 * Authoring rules:
 *   - Fully self-contained: inline <style>, no external fonts/scripts/network.
 *   - Design for a 1280x800 (16:10) canvas; the card scales it down.
 *   - Use the app's own type feel (DM Sans / system stack) so previews read as
 *     product screenshots, not clip art.
 *   - Keep each under ~4 KB; these ship in the renderer bundle.
 */

const FONT = `-apple-system,'DM Sans','Segoe UI',Roboto,sans-serif`;

// Shared document shell so every preview starts from the same reset + canvas box.
function doc(body: string, bg: string, extraCss = ''): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{width:1280px;height:800px;overflow:hidden;font-family:${FONT};background:${bg};color:#111}
${extraCss}
</style></head><body>${body}</body></html>`;
}

const cosmicAnimation = doc(
  `<div class="wrap">
    <div class="sun"></div>
    <div class="ring r1"></div><div class="ring r2"></div><div class="ring r3"></div>
    <div class="star" style="top:12%;left:18%"></div><div class="star" style="top:22%;left:74%"></div>
    <div class="star" style="top:70%;left:26%"></div><div class="star" style="top:80%;left:82%"></div>
    <div class="star" style="top:40%;left:8%"></div><div class="star" style="top:60%;left:92%"></div>
    <p class="eyebrow">OUTER FRAME</p>
    <h1>Beyond the visible spectrum.</h1>
    <button>Explore the mission</button>
  </div>`,
  'radial-gradient(60% 60% at 50% 46%,#1b1340 0%,#05010f 100%)',
  `.wrap{position:relative;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:#f5edff}
  .eyebrow{position:absolute;top:14%;letter-spacing:.5em;font-size:20px;color:#ffd27a;font-weight:600}
  h1{font-size:64px;font-weight:600;max-width:820px;line-height:1.08;margin-bottom:36px;text-shadow:0 2px 30px rgba(0,0,0,.5)}
  button{background:transparent;border:1.5px solid rgba(255,255,255,.4);color:#f5edff;padding:16px 34px;border-radius:999px;font:inherit;font-size:20px}
  .sun{position:absolute;width:200px;height:200px;border-radius:50%;background:radial-gradient(circle at 40% 38%,#ffe6a8,#ff9a5a 55%,#e0632c);box-shadow:0 0 120px 30px rgba(255,150,80,.5)}
  .ring{position:absolute;border-radius:50%;border:1px solid rgba(167,139,250,.45)}
  .r1{width:340px;height:340px}.r2{width:500px;height:500px;border-color:rgba(249,198,107,.35)}.r3{width:680px;height:680px;border-color:rgba(167,139,250,.25)}
  .star{position:absolute;width:3px;height:3px;border-radius:50%;background:#fff;box-shadow:0 0 6px #fff}`,
);

const landingPage = doc(
  `<nav><span class="brand">Field Notes</span><span class="links"><a>Features</a><a>Pricing</a><a>About</a><b>Get started</b></span></nav>
  <section class="hero">
    <div><p class="tag">PRODUCTIVITY, DISTILLED</p>
      <h1>Capture ideas the moment they strike.</h1>
      <p class="sub">A calm home for your notes, tasks, and half-formed thoughts — organized without the busywork.</p>
      <span class="cta"><b>Start free</b><i>Watch demo →</i></span>
    </div>
    <div class="shot"></div>
  </section>
  <section class="feat"><div class="card"><span class="dot" style="background:#b4551e"></span><h3>Instant capture</h3><p>From keystroke to saved note in under a second.</p></div>
  <div class="card"><span class="dot" style="background:#3b7d5a"></span><h3>Smart linking</h3><p>Related notes surface themselves as you write.</p></div>
  <div class="card"><span class="dot" style="background:#4338ca"></span><h3>Anywhere sync</h3><p>Desktop, mobile, web — always in step.</p></div></section>`,
  '#fbfaf6',
  `nav{display:flex;justify-content:space-between;align-items:center;padding:30px 72px}
  .brand{font-size:26px;font-weight:700;color:#1f2937}
  .links{display:flex;gap:34px;align-items:center;color:#4b5563;font-size:19px}
  .links b{background:#111827;color:#fff;padding:12px 24px;border-radius:8px}
  .hero{display:flex;gap:56px;align-items:center;padding:40px 72px 60px}
  .tag{color:#b4551e;letter-spacing:.22em;font-size:15px;font-weight:600;margin-bottom:20px}
  h1{font-size:62px;line-height:1.05;color:#111827;max-width:560px;letter-spacing:-.02em}
  .sub{font-size:22px;color:#6b7280;margin:26px 0 34px;max-width:520px;line-height:1.5}
  .cta{display:flex;gap:26px;align-items:center}
  .cta b{background:#111827;color:#fff;padding:16px 34px;border-radius:10px;font-size:20px}
  .cta i{color:#374151;font-style:normal;font-size:20px}
  .shot{flex:1;height:340px;border-radius:16px;background:linear-gradient(135deg,#eef1f6,#dfe4ee);box-shadow:0 30px 60px -20px rgba(20,30,60,.25),inset 0 0 0 1px rgba(0,0,0,.04)}
  .feat{display:flex;gap:28px;padding:0 72px}
  .card{flex:1;background:#fff;border:1px solid #eee;border-radius:14px;padding:30px}
  .dot{display:block;width:14px;height:14px;border-radius:50%;margin-bottom:20px}
  .card h3{font-size:24px;color:#111827;margin-bottom:10px}
  .card p{font-size:18px;color:#6b7280;line-height:1.5}`,
);

const dashboard = doc(
  `<aside><span class="logo"></span><span class="ni act"></span><span class="ni"></span><span class="ni"></span><span class="ni"></span></aside>
  <main>
    <header><h2>Overview</h2><span class="date">Last 30 days ▾</span></header>
    <div class="kpis"><div class="kpi"><p>Revenue</p><h3>$48.2k</h3><b class="up">▲ 12.4%</b></div>
      <div class="kpi"><p>Active users</p><h3>9,318</h3><b class="up">▲ 4.1%</b></div>
      <div class="kpi"><p>Churn</p><h3>1.8%</h3><b class="dn">▼ 0.3%</b></div></div>
    <div class="row"><div class="chart"><p class="ct">Revenue trend</p><svg viewBox="0 0 520 180" preserveAspectRatio="none"><polyline points="0,150 70,120 140,132 210,90 280,104 350,60 420,74 520,30" fill="none" stroke="#34d399" stroke-width="3"/><polyline points="0,160 70,150 140,150 210,130 280,138 350,120 420,124 520,110" fill="none" stroke="#60a5fa" stroke-width="3" opacity=".7"/></svg></div>
      <div class="donut"><p class="ct">By channel</p><div class="ring"></div></div></div>
  </main>`,
  '#0b1020',
  `body{display:flex;color:#e5e9f5}
  aside{width:96px;background:#0e1730;display:flex;flex-direction:column;align-items:center;gap:26px;padding:32px 0}
  .logo{width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#60a5fa,#a855f7)}
  .ni{width:44px;height:44px;border-radius:12px;background:#17223f}.ni.act{background:#25376b}
  main{flex:1;padding:40px 48px}
  header{display:flex;justify-content:space-between;align-items:center;margin-bottom:34px}
  h2{font-size:34px;color:#fff}.date{color:#8ea0c6;font-size:18px;background:#141d38;padding:10px 18px;border-radius:8px}
  .kpis{display:flex;gap:24px;margin-bottom:28px}
  .kpi{flex:1;background:#111a33;border:1px solid #1c2949;border-radius:14px;padding:26px}
  .kpi p{color:#8ea0c6;font-size:17px}.kpi h3{font-size:40px;color:#fff;margin:12px 0 8px}
  .up{color:#34d399;font-size:17px}.dn{color:#f87171;font-size:17px}
  .row{display:flex;gap:24px}
  .chart{flex:2;background:#111a33;border:1px solid #1c2949;border-radius:14px;padding:24px;height:260px}
  .donut{flex:1;background:#111a33;border:1px solid #1c2949;border-radius:14px;padding:24px;height:260px}
  .ct{color:#8ea0c6;font-size:18px;margin-bottom:18px}
  .chart svg{width:100%;height:190px}
  .ring{width:150px;height:150px;border-radius:50%;margin:14px auto 0;background:conic-gradient(#60a5fa 0 45%,#a855f7 45% 72%,#34d399 72% 100%);mask:radial-gradient(circle 44px at center,transparent 98%,#000 100%)}`,
);

const organicLoaders = doc(
  `<header><h1>Organic loaders</h1><p>Six hand-drawn indicators, pure CSS &amp; SVG.</p></header>
  <div class="grid">
    ${[
      ['Blob morph', '#e7c8ff', '<div class="blob"></div>'],
      ['Leaf sway', '#bfe8d3', '<div class="leaf"></div>'],
      ['Ink drop', '#ffd6c2', '<div class="ink"></div>'],
      ['Breathing', '#c7d2fe', '<div class="breathe"></div>'],
      ['Soft pulse', '#fde68a', '<div class="pulse"></div>'],
      ['Ribbon', '#fbcfe8', '<div class="ribbon"></div>'],
    ]
      .map(
        ([t, c, m]) =>
          `<div class="card"><div class="stage" style="--c:${c}">${m}</div><b>${t}</b><i>Loading state</i></div>`,
      )
      .join('')}
  </div>`,
  '#f4efe6',
  `header{padding:44px 64px 20px}h1{font-size:48px;color:#3b2f4a}header p{font-size:22px;color:#8a7f95;margin-top:10px}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:26px;padding:20px 64px}
  .card{background:#fff;border-radius:18px;padding:30px;box-shadow:0 10px 24px -14px rgba(60,40,80,.3)}
  .stage{height:150px;display:flex;align-items:center;justify-content:center}
  .card b{display:block;font-size:22px;color:#3b2f4a;margin-top:8px}.card i{font-style:normal;color:#a99fb4;font-size:16px}
  .blob{width:76px;height:76px;background:var(--c);border-radius:42% 58% 63% 37%/45% 40% 60% 55%}
  .leaf{width:70px;height:70px;background:var(--c);border-radius:0 100% 0 100%}
  .ink{width:64px;height:64px;background:var(--c);border-radius:50%;box-shadow:0 20px 0 -8px var(--c)}
  .breathe{width:80px;height:80px;border-radius:50%;border:10px solid var(--c)}
  .pulse{width:72px;height:72px;border-radius:50%;background:var(--c);box-shadow:0 0 0 14px color-mix(in srgb,var(--c) 40%,transparent)}
  .ribbon{width:96px;height:26px;background:var(--c);border-radius:999px;transform:rotate(-12deg)}`,
);

const caseStudy = doc(
  `<p class="ey">CASE STUDY · 2025</p>
  <h1>How Northwind cut onboarding time by 63%.</h1>
  <div class="meta"><span>Fintech</span><span>·</span><span>Product design</span><span>·</span><span>8 min read</span></div>
  <div class="metrics">
    <div class="m"><b>63%</b><i>faster onboarding</i></div>
    <div class="m"><b>2.1×</b><i>activation rate</i></div>
    <div class="m"><b>−41%</b><i>support tickets</i></div>
  </div>
  <div class="body"><div class="col"><p>We rebuilt the first-run experience around a single guided flow, stripping six screens down to two.</p><p>The result was a measurable lift in activation within the first week of release.</p></div>
  <div class="shot"></div></div>`,
  '#0e0f12',
  `body{color:#f4f4f5;padding:56px 72px}
  .ey{color:#fbbf24;letter-spacing:.24em;font-size:16px;font-weight:600}
  h1{font-size:56px;line-height:1.08;max-width:900px;margin:22px 0 18px;letter-spacing:-.02em}
  .meta{display:flex;gap:14px;color:#9ca3af;font-size:19px;margin-bottom:44px}
  .metrics{display:flex;gap:24px;margin-bottom:44px}
  .m{flex:1;background:#17181d;border:1px solid #26272e;border-radius:16px;padding:28px}
  .m b{font-size:52px;display:block}.m:nth-child(1) b{color:#fbbf24}.m:nth-child(2) b{color:#34d399}.m:nth-child(3) b{color:#60a5fa}
  .m i{font-style:normal;color:#9ca3af;font-size:19px}
  .body{display:flex;gap:40px}.col{flex:1;display:flex;flex-direction:column;gap:20px}
  .col p{font-size:22px;line-height:1.6;color:#d4d4d8}
  .shot{flex:1;height:220px;border-radius:14px;background:linear-gradient(135deg,#1f2937,#111827)}`,
);

const pitchSlide = doc(
  `<div class="slide">
    <p class="ey">02 / MARKET</p>
    <h1>The workflow tax nobody budgets for.</h1>
    <p class="sub">Teams lose an average of 6.4 hours a week to tool-switching and manual handoffs.</p>
    <div class="stat"><div><b>$1.2T</b><i>lost to context-switching / yr</i></div><div><b>6.4h</b><i>per person / week</i></div></div>
    <span class="foot">Meridian · Series A</span>
  </div>`,
  '#fffaf0',
  `.slide{position:relative;width:100%;height:100%;background:#fff;border:1px solid #eadfca;padding:72px 84px;display:flex;flex-direction:column}
  .ey{color:#f97316;letter-spacing:.2em;font-weight:700;font-size:18px}
  h1{font-size:66px;line-height:1.05;color:#1f2937;max-width:820px;margin:26px 0 22px;letter-spacing:-.02em}
  .sub{font-size:26px;color:#6b7280;max-width:720px;line-height:1.5}
  .stat{display:flex;gap:80px;margin-top:auto}
  .stat b{font-size:64px;color:#1f2937;display:block}.stat i{font-style:normal;color:#9ca3af;font-size:20px}
  .foot{position:absolute;bottom:40px;right:84px;color:#c2b8a5;font-size:18px;letter-spacing:.1em}`,
);

const email = doc(
  `<div class="mail">
    <div class="top"></div>
    <div class="pad">
      <span class="logo">◆ Orbit</span>
      <h1>Welcome aboard, Sam 👋</h1>
      <p>Your workspace is ready. Here are three things to try in your first five minutes.</p>
      <div class="steps"><div><b>1</b><span>Invite your team</span></div><div><b>2</b><span>Connect a data source</span></div><div><b>3</b><span>Build your first board</span></div></div>
      <a class="btn">Open my workspace</a>
      <p class="fine">Sent by Orbit · 500 Harrison St · Unsubscribe</p>
    </div>
  </div>`,
  '#eef2ff',
  `body{display:flex;align-items:center;justify-content:center}
  .mail{width:600px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 30px 60px -24px rgba(40,40,120,.4)}
  .top{height:14px;background:linear-gradient(90deg,#4338ca,#6366f1)}
  .pad{padding:48px 52px}
  .logo{color:#4338ca;font-weight:700;font-size:24px}
  h1{font-size:40px;color:#1e1b4b;margin:26px 0 16px}
  p{font-size:21px;color:#4b5563;line-height:1.55}
  .steps{display:flex;flex-direction:column;gap:14px;margin:30px 0}
  .steps div{display:flex;align-items:center;gap:16px;background:#eef2ff;border-radius:10px;padding:16px 20px}
  .steps b{background:#4338ca;color:#fff;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px}
  .steps span{font-size:20px;color:#312e81}
  .btn{display:inline-block;background:#4338ca;color:#fff;padding:16px 32px;border-radius:10px;font-size:21px;margin:8px 0 26px}
  .fine{font-size:15px;color:#9ca3af}`,
);

const mobileApp = doc(
  `<div class="phone"><div class="screen">
    <div class="sb"><span>9:41</span><span>▂▄▆ 5G ▮</span></div>
    <h1>Good morning,<br>Alex</h1>
    <div class="bal"><p>Total balance</p><b>$12,480.22</b><span>▲ 3.2% this month</span></div>
    <div class="acts"><div><span>↑</span>Send</div><div><span>↓</span>Request</div><div><span>⇄</span>Swap</div><div><span>+</span>Top up</div></div>
    <p class="lbl">Recent</p>
    <div class="tx"><div class="ic" style="background:#dcfce7"></div><div class="t"><b>Figma</b><i>Subscription</i></div><b class="am">−$15.00</b></div>
    <div class="tx"><div class="ic" style="background:#dbeafe"></div><div class="t"><b>Payroll</b><i>Acme Inc</i></div><b class="am pos">+$3,200</b></div>
    <div class="tx"><div class="ic" style="background:#fef3c7"></div><div class="t"><b>Whole Foods</b><i>Groceries</i></div><b class="am">−$62.40</b></div>
    <div class="tab"><span class="on">◉</span><span>▤</span><span>◇</span><span>◯</span></div>
  </div></div>`,
  '#0f172a',
  `body{display:flex;align-items:center;justify-content:center;background:radial-gradient(60% 50% at 50% 40%,#1e293b,#0f172a)}
  .phone{width:400px;height:760px;background:#000;border-radius:52px;padding:12px;box-shadow:0 40px 80px -20px rgba(0,0,0,.6)}
  .screen{width:100%;height:100%;background:#f8fafc;border-radius:42px;padding:26px 26px 0;position:relative;overflow:hidden}
  .sb{display:flex;justify-content:space-between;font-size:16px;color:#334155;margin-bottom:18px}
  h1{font-size:38px;color:#0f172a;line-height:1.1}
  .bal{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;border-radius:20px;padding:24px;margin:22px 0}
  .bal p{font-size:16px;opacity:.85}.bal b{font-size:42px;display:block;margin:6px 0}.bal span{font-size:16px;color:#c7f9cc}
  .acts{display:flex;justify-content:space-between;margin-bottom:24px}
  .acts div{display:flex;flex-direction:column;align-items:center;gap:8px;font-size:15px;color:#475569}
  .acts span{width:52px;height:52px;border-radius:16px;background:#eef2ff;display:flex;align-items:center;justify-content:center;font-size:22px;color:#4f46e5}
  .lbl{font-size:18px;color:#64748b;margin-bottom:10px}
  .tx{display:flex;align-items:center;gap:14px;padding:12px 0}
  .ic{width:44px;height:44px;border-radius:12px}
  .t{flex:1}.t b{font-size:19px;color:#0f172a;display:block}.t i{font-style:normal;font-size:15px;color:#94a3b8}
  .am{font-size:19px;color:#0f172a}.am.pos{color:#16a34a}
  .tab{position:absolute;left:0;right:0;bottom:0;height:74px;background:#fff;border-top:1px solid #e2e8f0;display:flex;justify-content:space-around;align-items:center;font-size:24px;color:#cbd5e1}
  .tab .on{color:#4f46e5}`,
);

const pricingPage = doc(
  `<header><h1>Simple, honest pricing.</h1><p>Start free. Upgrade when your team grows.</p></header>
  <div class="tiers">
    <div class="tier"><p class="n">Starter</p><b class="p">$0</b><i>/mo</i><ul><li>✓ Up to 3 projects</li><li>✓ Community support</li><li>✓ 1 GB storage</li></ul><a class="g">Get started</a></div>
    <div class="tier hi"><span class="badge">MOST POPULAR</span><p class="n">Pro</p><b class="p">$24</b><i>/mo</i><ul><li>✓ Unlimited projects</li><li>✓ Priority support</li><li>✓ 100 GB storage</li><li>✓ Advanced analytics</li></ul><a class="f">Start Pro trial</a></div>
    <div class="tier"><p class="n">Team</p><b class="p">$79</b><i>/mo</i><ul><li>✓ Everything in Pro</li><li>✓ SSO &amp; SAML</li><li>✓ Audit logs</li><li>✓ Dedicated manager</li></ul><a class="g">Contact sales</a></div>
  </div>`,
  '#faf9f7',
  `header{text-align:center;padding:56px 0 30px}h1{font-size:54px;color:#111827;letter-spacing:-.02em}header p{font-size:24px;color:#6b7280;margin-top:14px}
  .tiers{display:flex;gap:26px;justify-content:center;padding:20px 64px;align-items:stretch}
  .tier{flex:1;max-width:360px;background:#fff;border:1px solid #ececec;border-radius:20px;padding:38px 34px;position:relative}
  .tier.hi{background:#111827;color:#fff;border:none;transform:translateY(-14px);box-shadow:0 30px 60px -24px rgba(0,0,0,.4)}
  .badge{position:absolute;top:-13px;left:50%;transform:translateX(-50%);background:#a5b4fc;color:#1e1b4b;font-size:13px;font-weight:700;letter-spacing:.12em;padding:7px 16px;border-radius:999px}
  .n{font-size:22px;color:#6b7280}.tier.hi .n{color:#c7d2fe}
  .p{font-size:60px;font-weight:700}.tier i{font-size:20px;color:#9ca3af}
  ul{list-style:none;margin:26px 0 30px}li{font-size:19px;padding:9px 0;color:#374151}.tier.hi li{color:#e5e7eb}
  a{display:block;text-align:center;padding:16px;border-radius:10px;font-size:20px}
  .g{background:#f3f4f6;color:#111827}.f{background:#6366f1;color:#fff}`,
);

const blogArticle = doc(
  `<article>
    <p class="ey">ENGINEERING · JUL 2025</p>
    <h1>Designing for the moment before the click.</h1>
    <p class="dek">Micro-interactions carry more intent than we give them credit for. Here's how we rebuilt ours.</p>
    <div class="by"><span class="av"></span><div><b>Rae Molina</b><i>Principal Designer · 8 min</i></div></div>
    <div class="hero"></div>
    <p class="p">The gap between a user's intent and the interface's response is where trust is won or lost. When we audited our product, we found dozens of places where nothing acknowledged the user at all.</p>
    <p class="p">So we started small: a single button that knew it had been pressed.</p>
  </article>`,
  '#ffffff',
  `article{max-width:820px;margin:0 auto;padding:60px 40px}
  .ey{color:#6366f1;letter-spacing:.2em;font-weight:600;font-size:15px}
  h1{font-size:58px;line-height:1.08;color:#111827;margin:20px 0 18px;letter-spacing:-.02em}
  .dek{font-size:26px;color:#6b7280;line-height:1.5}
  .by{display:flex;align-items:center;gap:14px;margin:30px 0}
  .av{width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#a78bfa,#f0abfc)}
  .by b{font-size:19px;color:#111827;display:block}.by i{font-style:normal;color:#9ca3af;font-size:16px}
  .hero{height:280px;border-radius:16px;background:linear-gradient(135deg,#eef2ff,#e0e7ff);margin-bottom:34px}
  .p{font-size:23px;line-height:1.65;color:#374151;margin-bottom:22px}`,
);

const eventCalendar = doc(
  `<div class="cal">
    <header><h1>October 2025</h1><span class="nav">‹ Today ›</span></header>
    <div class="dow">${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => `<span>${d}</span>`).join('')}</div>
    <div class="grid">${Array.from({ length: 35 }, (_, i) => {
      const day = i - 2;
      const events =
        i === 9
          ? '<b class="e a">Standup</b>'
          : i === 14
            ? '<b class="e b">Launch 🚀</b><b class="e c">Review</b>'
            : i === 20
              ? '<b class="e c">1:1 Priya</b>'
              : i === 24
                ? '<b class="e a">Design crit</b>'
                : '';
      return `<div class="cell${i === 14 ? ' today' : ''}${day < 1 || day > 31 ? ' off' : ''}"><span class="d">${day >= 1 && day <= 31 ? day : ''}</span>${events}</div>`;
    }).join('')}</div>
  </div>`,
  '#fefce8',
  `body{padding:40px 56px}
  header{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px}
  h1{font-size:42px;color:#1f2937}.nav{font-size:20px;color:#6b7280;background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:10px 20px}
  .dow{display:grid;grid-template-columns:repeat(7,1fr);gap:8px;margin-bottom:8px}
  .dow span{font-size:15px;color:#9ca3af;text-align:center;text-transform:uppercase;letter-spacing:.08em}
  .grid{display:grid;grid-template-columns:repeat(7,1fr);grid-auto-rows:118px;gap:8px}
  .cell{background:#fff;border:1px solid #f0eede;border-radius:10px;padding:10px}
  .cell.off{background:#faf9f0;border-color:#f5f3e6}
  .cell.today{outline:2px solid #f59e0b}
  .d{font-size:17px;color:#374151}
  .e{display:block;font-size:13px;color:#fff;border-radius:5px;padding:3px 7px;margin-top:5px;font-weight:600}
  .e.a{background:#60a5fa}.e.b{background:#f59e0b}.e.c{background:#34d399}`,
);

const chatInterface = doc(
  `<div class="app">
    <aside><span class="h">Messages</span>
      <div class="conv on"><span class="av" style="background:#a78bfa"></span><div><b>Design team</b><i>Priya: shipping today ✨</i></div></div>
      <div class="conv"><span class="av" style="background:#34d399"></span><div><b>Marcus Lee</b><i>Sounds good — thanks!</i></div></div>
      <div class="conv"><span class="av" style="background:#f59e0b"></span><div><b>Support</b><i>Ticket #4821 resolved</i></div></div>
    </aside>
    <main>
      <header><span class="av" style="background:#a78bfa"></span><b>Design team</b><span class="on-dot">● 4 online</span></header>
      <div class="thread">
        <div class="msg them"><p>Can we get the new hero live before the demo?</p></div>
        <div class="msg me"><p>Already merged — deploying now 🚀</p></div>
        <div class="msg them"><p>Legend. I'll grab screenshots for the deck.</p></div>
        <div class="msg me"><p>Perfect. Ping me if anything looks off.</p></div>
      </div>
      <div class="composer"><span>Message Design team…</span><b>↑</b></div>
    </main>
  </div>`,
  '#f8fafc',
  `body{display:flex}
  aside{width:340px;background:#fff;border-right:1px solid #e2e8f0;padding:24px}
  .h{font-size:26px;font-weight:700;color:#0f172a;display:block;margin-bottom:22px}
  .conv{display:flex;gap:12px;align-items:center;padding:14px;border-radius:12px}
  .conv.on{background:#eef2ff}
  .av{width:46px;height:46px;border-radius:50%;flex:none}
  .conv b{font-size:18px;color:#0f172a;display:block}.conv i{font-style:normal;font-size:15px;color:#94a3b8}
  main{flex:1;display:flex;flex-direction:column;background:#f8fafc}
  header{display:flex;align-items:center;gap:12px;padding:20px 28px;background:#fff;border-bottom:1px solid #e2e8f0}
  header .av{width:40px;height:40px}header b{font-size:20px;color:#0f172a}.on-dot{margin-left:auto;color:#16a34a;font-size:16px}
  .thread{flex:1;padding:28px;display:flex;flex-direction:column;gap:16px}
  .msg{max-width:60%}.msg p{font-size:20px;padding:14px 20px;border-radius:18px;line-height:1.4}
  .them{align-self:flex-start}.them p{background:#fff;color:#0f172a;border:1px solid #e2e8f0}
  .me{align-self:flex-end}.me p{background:#3b82f6;color:#fff}
  .composer{margin:0 28px 28px;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:18px 22px;display:flex;align-items:center;color:#94a3b8;font-size:19px}
  .composer b{margin-left:auto;background:#3b82f6;color:#fff;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center}`,
);

const portfolioGallery = doc(
  `<header><div><span class="mk">Studio Vault</span><p>Selected work · 2021–2025</p></div><span class="menu">Work · About · Contact</span></header>
  <div class="grid">
    ${[
      ['#a78bfa', '#6d28d9', 'Aurora', 'Brand identity'],
      ['#fb923c', '#c2410c', 'Ember', 'Web design'],
      ['#34d399', '#047857', 'Fathom', 'Product'],
      ['#60a5fa', '#1d4ed8', 'Tidal', 'Motion'],
      ['#f472b6', '#be185d', 'Bloom', 'Packaging'],
      ['#fbbf24', '#b45309', 'Kiln', 'Art direction'],
    ]
      .map(
        ([a, b, t, k]) =>
          `<figure><div class="art" style="background:linear-gradient(135deg,${a},${b})"></div><figcaption><b>${t}</b><i>${k}</i></figcaption></figure>`,
      )
      .join('')}
  </div>`,
  '#18181b',
  `body{padding:44px 56px;color:#fff}
  header{display:flex;justify-content:space-between;align-items:center;margin-bottom:36px}
  .mk{font-size:30px;font-weight:700}header p{color:#a1a1aa;font-size:17px;margin-top:4px}
  .menu{color:#a1a1aa;font-size:19px}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}
  figure{margin:0}
  .art{height:210px;border-radius:14px}
  figcaption{padding:14px 4px}figcaption b{font-size:22px;display:block}figcaption i{font-style:normal;color:#a1a1aa;font-size:16px}`,
);

const receiptInvoice = doc(
  `<div class="inv">
    <div class="top"><div><span class="logo">◑ Studio Neon</span><p>123 Palette Ave · Brooklyn NY</p></div><div class="rt"><h1>INVOICE</h1><p>#SN-0042 · Jul 14, 2025</p></div></div>
    <div class="parties"><div><p class="lbl">Billed to</p><b>Meridian Labs</b><span>500 Harrison St<br>San Francisco, CA</span></div><div><p class="lbl">Due</p><b>Aug 1, 2025</b><span>Net 30</span></div></div>
    <table><thead><tr><th>Description</th><th>Qty</th><th>Rate</th><th class="r">Amount</th></tr></thead><tbody>
      <tr><td>Brand identity system</td><td>1</td><td>$6,000</td><td class="r">$6,000</td></tr>
      <tr><td>Landing page design</td><td>3</td><td>$1,200</td><td class="r">$3,600</td></tr>
      <tr><td>Motion guidelines</td><td>1</td><td>$2,400</td><td class="r">$2,400</td></tr>
      <tr><td>Design QA</td><td>8</td><td>$150</td><td class="r">$1,200</td></tr>
    </tbody></table>
    <div class="totals"><div><span>Subtotal</span><b>$13,200</b></div><div><span>Tax (8.5%)</span><b>$1,122</b></div><div class="grand"><span>Total</span><b>$14,322</b></div></div>
    <p class="ty">Thank you for your business.</p>
  </div>`,
  '#f5f5f4',
  `body{display:flex;align-items:center;justify-content:center}
  .inv{width:780px;background:#fff;border:1px solid #e7e5e4;border-radius:14px;padding:52px 56px;box-shadow:0 24px 50px -28px rgba(0,0,0,.25)}
  .top{display:flex;justify-content:space-between;margin-bottom:38px}
  .logo{font-size:26px;font-weight:700;color:#1c1917}.top p{color:#a8a29e;font-size:16px;margin-top:6px}
  .rt{text-align:right}.rt h1{font-size:34px;letter-spacing:.1em;color:#e11d48}
  .parties{display:flex;justify-content:space-between;margin-bottom:34px}
  .lbl{font-size:14px;text-transform:uppercase;letter-spacing:.1em;color:#a8a29e;margin-bottom:6px}
  .parties b{font-size:20px;color:#1c1917;display:block;margin-bottom:4px}.parties span{color:#78716c;font-size:16px}
  table{width:100%;border-collapse:collapse;margin-bottom:26px}
  th{text-align:left;font-size:15px;color:#a8a29e;border-bottom:2px solid #e7e5e4;padding:12px 8px;text-transform:uppercase;letter-spacing:.06em}
  td{padding:14px 8px;font-size:19px;color:#292524;border-bottom:1px solid #f5f5f4}
  .r{text-align:right}
  .totals{margin-left:auto;width:300px}
  .totals div{display:flex;justify-content:space-between;padding:9px 8px;font-size:19px;color:#57534e}
  .grand{border-top:2px solid #e7e5e4;margin-top:6px;color:#1c1917;font-size:24px;font-weight:700}
  .ty{margin-top:30px;color:#a8a29e;font-size:18px}`,
);

const settingsPanel = doc(
  `<div class="app">
    <aside><span class="h">Settings</span>
      <span class="i on">Profile</span><span class="i">Notifications</span><span class="i">Security</span><span class="i">Billing</span><span class="i">Team</span><span class="i">Integrations</span></aside>
    <main>
      <div class="bc">Settings › Profile</div>
      <h1>Profile</h1>
      <div class="field"><label>Full name</label><div class="input">Alex Rivera</div></div>
      <div class="field"><label>Email</label><div class="input">alex@meridian.io</div></div>
      <div class="field row"><div><label>Two-factor auth</label><i>Extra security at sign-in</i></div><span class="tog on"><b></b></span></div>
      <div class="field row"><div><label>Product emails</label><i>News &amp; feature updates</i></div><span class="tog"><b></b></span></div>
      <div class="danger"><div><b>Delete account</b><i>Permanently remove your workspace and data.</i></div><a>Delete account</a></div>
    </main>
  </div>`,
  '#fafafa',
  `body{display:flex}
  aside{width:260px;background:#fff;border-right:1px solid #ececec;padding:28px 20px}
  .h{font-size:24px;font-weight:700;color:#111827;display:block;margin-bottom:22px;padding:0 12px}
  .i{display:block;padding:13px 16px;border-radius:10px;font-size:19px;color:#6b7280;margin-bottom:4px}
  .i.on{background:#eff6ff;color:#2563eb;font-weight:600}
  main{flex:1;padding:40px 56px;max-width:760px}
  .bc{color:#9ca3af;font-size:16px;margin-bottom:10px}
  h1{font-size:38px;color:#111827;margin-bottom:34px}
  .field{margin-bottom:26px}
  label{font-size:18px;color:#374151;display:block;margin-bottom:10px}
  .input{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:16px 18px;font-size:19px;color:#111827}
  .field.row{display:flex;justify-content:space-between;align-items:center}
  .field.row i{font-style:normal;font-size:16px;color:#9ca3af;display:block;margin-top:2px}
  .tog{width:56px;height:32px;border-radius:999px;background:#d1d5db;position:relative;flex:none}
  .tog.on{background:#2563eb}.tog b{position:absolute;top:3px;left:3px;width:26px;height:26px;border-radius:50%;background:#fff}
  .tog.on b{left:27px}
  .danger{margin-top:40px;border:1px solid #fecaca;background:#fef2f2;border-radius:12px;padding:24px;display:flex;justify-content:space-between;align-items:center}
  .danger b{font-size:20px;color:#b91c1c;display:block}.danger i{font-style:normal;color:#ef4444;font-size:16px}
  .danger a{background:#dc2626;color:#fff;padding:12px 22px;border-radius:9px;font-size:18px}`,
);

const authSignin = doc(
  `<div class="star" style="top:14%;left:20%"></div><div class="star" style="top:24%;left:78%"></div><div class="star" style="top:66%;left:16%"></div><div class="star" style="top:78%;left:84%"></div><div class="star" style="top:40%;left:88%"></div>
  <div class="card">
    <span class="wm">✦ Lumen</span>
    <h1>Welcome back</h1>
    <p class="s">Sign in to your workspace</p>
    <label>Email</label><div class="in">you@company.com</div>
    <div class="lr"><label>Password</label><i>Forgot password?</i></div><div class="in">••••••••••</div>
    <a class="pri">Sign in</a>
    <div class="or"><span></span>OR<span></span></div>
    <div class="soc"><b>G</b><b></b><b>Apple</b></div>
    <p class="foot">Don't have an account? <i>Sign up</i></p>
  </div>`,
  '#0f172a',
  `body{display:flex;align-items:center;justify-content:center;background:radial-gradient(70% 60% at 50% 30%,#1e293b,#0f172a)}
  .star{position:absolute;width:3px;height:3px;border-radius:50%;background:#fff;opacity:.7;box-shadow:0 0 6px #fff}
  .card{width:460px;background:#fff;border-radius:22px;padding:44px 46px;box-shadow:0 40px 80px -24px rgba(0,0,0,.6)}
  .wm{font-size:24px;font-weight:700;color:#4f46e5}
  h1{font-size:38px;color:#0f172a;margin:24px 0 6px}.s{color:#94a3b8;font-size:19px;margin-bottom:28px}
  label{font-size:16px;color:#475569;display:block;margin-bottom:8px}
  .in{border:1px solid #e2e8f0;border-radius:11px;padding:15px 16px;font-size:18px;color:#64748b;margin-bottom:18px}
  .lr{display:flex;justify-content:space-between}.lr i{font-style:normal;color:#6366f1;font-size:16px}
  .pri{display:block;text-align:center;background:#4f46e5;color:#fff;padding:16px;border-radius:11px;font-size:20px;margin:8px 0 22px}
  .or{display:flex;align-items:center;gap:14px;color:#cbd5e1;font-size:15px;margin-bottom:22px}
  .or span{flex:1;height:1px;background:#e2e8f0}
  .soc{display:flex;gap:12px}.soc b{flex:1;border:1px solid #e2e8f0;border-radius:11px;padding:14px;text-align:center;font-size:18px;color:#334155}
  .foot{text-align:center;color:#94a3b8;font-size:17px;margin-top:24px}.foot i{font-style:normal;color:#6366f1}`,
);

const kanbanBoard = doc(
  `<header><div><h1>Nebula App</h1><span class="sub">Sprint 24 · 12 tasks</span></div><span class="tools"><i>Board</i><i>List</i><b>+ Add task</b></span></header>
  <div class="cols">
    ${[
      [
        'Backlog',
        '#f59e0b',
        '#fef3c7',
        ['Audit onboarding flow', 'Refactor auth module', 'Spike: offline mode'],
      ],
      ['In progress', '#3b82f6', '#dbeafe', ['New hero section', 'Billing page redesign']],
      ['Done', '#10b981', '#d1fae5', ['Dark mode tokens', 'Fix nav overflow', 'Ship changelog']],
    ]
      .map(
        ([t, c, bg, cards]) =>
          `<div class="col"><div class="ch"><span class="bar" style="background:${c}"></span><b>${t}</b><span class="pill">${(cards as string[]).length}</span></div>${(
            cards as string[]
          )
            .map(
              (card) =>
                `<div class="card"><span class="tag" style="background:${bg};color:${c}">${t === 'Done' ? 'Shipped' : t === 'In progress' ? 'Active' : 'Todo'}</span><b>${card}</b><div class="foot"><span class="av" style="background:${c}"></span><span class="av" style="background:#c4b5fd"></span></div></div>`,
            )
            .join('')}</div>`,
      )
      .join('')}
  </div>`,
  '#f1f5f9',
  `body{padding:36px 44px}
  header{display:flex;justify-content:space-between;align-items:center;margin-bottom:28px}
  h1{font-size:36px;color:#0f172a}.sub{color:#94a3b8;font-size:18px}
  .tools{display:flex;gap:10px;align-items:center}.tools i{font-style:normal;padding:10px 18px;border-radius:9px;font-size:18px;color:#475569;background:#fff;border:1px solid #e2e8f0}
  .tools b{background:#0f172a;color:#fff;padding:11px 22px;border-radius:9px;font-size:18px}
  .cols{display:grid;grid-template-columns:repeat(3,1fr);gap:22px}
  .col{background:#e9eef5;border-radius:16px;padding:16px}
  .ch{display:flex;align-items:center;gap:10px;margin-bottom:14px;padding:4px}
  .bar{width:12px;height:12px;border-radius:4px}.ch b{font-size:20px;color:#334155}
  .pill{margin-left:auto;background:#fff;color:#64748b;font-size:15px;padding:2px 11px;border-radius:999px}
  .card{background:#fff;border-radius:12px;padding:16px;margin-bottom:12px;box-shadow:0 2px 6px rgba(15,23,42,.06)}
  .tag{font-size:13px;font-weight:600;padding:4px 10px;border-radius:6px}
  .card b{display:block;font-size:19px;color:#1e293b;margin:12px 0}
  .card .foot{display:flex}.av{width:28px;height:28px;border-radius:50%;margin-right:-8px;border:2px solid #fff}`,
);

const aiProductHero = doc(
  `<div class="glow"></div><div class="ring r1"></div><div class="ring r2"></div><div class="ring r3"></div>
  <div class="star" style="top:16%;left:12%"></div><div class="star" style="top:28%;left:30%"></div><div class="star" style="top:70%;left:22%"></div><div class="star" style="top:82%;left:60%"></div>
  <nav><span class="mk">✒ Inkwell</span><span class="nl">Product · Pricing · Docs <b>Try free</b></span></nav>
  <div class="hero">
    <p class="ey">AI WRITING ASSISTANT</p>
    <h1>Write like you mean it.<span class="car"></span></h1>
    <p class="sub">Inkwell drafts, edits, and refines alongside you — so the blank page never wins.</p>
    <span class="cta"><b>Start writing free</b><i>See it in action →</i></span>
  </div>`,
  '#0f172a',
  `body{background:linear-gradient(125deg,#0f172a 0%,#3b0764 100%);overflow:hidden;color:#f5f3ff}
  .glow{position:absolute;right:-60px;top:20%;width:520px;height:520px;border-radius:50%;background:radial-gradient(circle,rgba(167,139,250,.45),transparent 60%)}
  .ring{position:absolute;right:120px;top:32%;border-radius:50%;border:1px solid rgba(196,181,253,.5)}
  .r1{width:220px;height:220px;margin:-110px}.r2{width:360px;height:360px;margin:-180px;border-color:rgba(167,139,250,.35)}.r3{width:500px;height:500px;margin:-250px;border-color:rgba(139,92,246,.25)}
  .star{position:absolute;width:3px;height:3px;border-radius:50%;background:#fff;opacity:.8}
  nav{display:flex;justify-content:space-between;align-items:center;padding:32px 64px;position:relative}
  .mk{font-size:26px;font-weight:700}.nl{color:#c4b5fd;font-size:19px}.nl b{background:#a78bfa;color:#1e1b4b;padding:11px 22px;border-radius:9px;margin-left:16px;font-weight:600}
  .hero{padding:80px 64px;position:relative;max-width:760px}
  .ey{color:#c4b5fd;letter-spacing:.24em;font-weight:600;font-size:17px}
  h1{font-size:78px;line-height:1.02;margin:22px 0 24px;letter-spacing:-.03em}
  .car{display:inline-block;width:5px;height:64px;background:#a78bfa;margin-left:8px;vertical-align:middle;border-radius:2px}
  .sub{font-size:26px;color:#ddd6fe;line-height:1.5;max-width:600px;margin-bottom:38px}
  .cta{display:flex;gap:26px;align-items:center}
  .cta b{background:linear-gradient(135deg,#a78bfa,#818cf8);color:#fff;padding:18px 38px;border-radius:12px;font-size:21px}
  .cta i{font-style:normal;color:#c4b5fd;font-size:21px}`,
);

const weatherCard = doc(
  `<div class="phone"><div class="screen">
    <div class="sb"><span>9:41</span><span>San Francisco</span><span>▮</span></div>
    <div class="glass main">
      <p class="city">San Francisco</p>
      <div class="now"><b>23°</b><span class="ic">⛅</span></div>
      <p class="cond">Partly cloudy · H:26° L:17°</p>
      <div class="hours">${[
        ['Now', '23°'],
        ['1PM', '24°'],
        ['2PM', '25°'],
        ['3PM', '25°'],
        ['4PM', '24°'],
        ['5PM', '22°'],
      ]
        .map(([h, t]) => `<div><i>${h}</i><span>☀</span><b>${t}</b></div>`)
        .join('')}</div>
    </div>
    <div class="glass week"><p class="lbl">Next 7 days</p>
      ${[
        ['Mon', 68, '18°', '26°'],
        ['Tue', 74, '17°', '25°'],
        ['Wed', 60, '16°', '22°'],
      ]
        .map(
          ([d, w, lo, hi]) =>
            `<div class="drow"><span>${d}</span><i>${lo}</i><span class="bar"><b style="width:${w}%"></b></span><i>${hi}</i></div>`,
        )
        .join('')}
    </div>
  </div></div>`,
  '#1e3a8a',
  `body{display:flex;align-items:center;justify-content:center;background:linear-gradient(180deg,#60a5fa,#1e3a8a)}
  .phone{width:400px;height:760px;background:#000;border-radius:52px;padding:12px}
  .screen{width:100%;height:100%;border-radius:42px;padding:28px 24px;background:linear-gradient(180deg,#7cb0f5,#3b5fc0);overflow:hidden}
  .sb{display:flex;justify-content:space-between;color:#fff;font-size:16px;margin-bottom:22px;opacity:.9}
  .glass{background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.28);border-radius:24px;padding:26px;color:#fff;backdrop-filter:blur(6px)}
  .main{text-align:center;margin-bottom:20px}
  .city{font-size:22px;opacity:.85}
  .now{display:flex;align-items:center;justify-content:center;gap:14px;margin:8px 0}
  .now b{font-size:96px;font-weight:200}.now .ic{font-size:56px}
  .cond{font-size:19px;opacity:.85;margin-bottom:22px}
  .hours{display:flex;justify-content:space-between;border-top:1px solid rgba(255,255,255,.25);padding-top:18px}
  .hours div{display:flex;flex-direction:column;align-items:center;gap:8px;font-size:16px}
  .hours span{font-size:22px}.hours b{font-weight:600}
  .lbl{font-size:16px;opacity:.8;margin-bottom:14px}
  .drow{display:flex;align-items:center;gap:14px;padding:10px 0;font-size:19px}
  .drow span:first-child{width:52px}.drow i{font-style:normal;opacity:.8;width:44px}
  .bar{flex:1;height:6px;border-radius:3px;background:rgba(255,255,255,.25);position:relative}
  .bar b{position:absolute;left:0;top:0;height:100%;border-radius:3px;background:linear-gradient(90deg,#fde68a,#fb923c)}`,
);

const timelineChangelog = doc(
  `<header><h1>Changelog</h1><span class="rss">◉ Subscribe</span></header>
  <div class="filters"><b class="on">All</b><b>Features</b><b>Fixes</b><b>Breaking</b></div>
  <div class="tl">
    ${[
      [
        '#059669',
        'v2.4.0',
        'Jul 2025',
        'Real-time collaboration',
        'Multiple cursors, presence, and live comments now ship in every workspace.',
        'feature',
      ],
      [
        '#0284c7',
        'v2.3.1',
        'Jun 2025',
        'Faster board loading',
        'Large boards now render up to 3× faster with virtualized columns.',
        'fix',
      ],
      [
        '#7c3aed',
        'v2.3.0',
        'Jun 2025',
        'New API surface',
        'A redesigned REST API with cursor pagination. Legacy endpoints deprecated.',
        'breaking',
      ],
    ]
      .map(
        ([c, v, d, h, p, tag]) =>
          `<div class="entry"><span class="dot" style="background:${c}"></span><div class="content"><div class="row"><span class="date">${d}</span><span class="ver" style="color:${c};border-color:${c}">${v}</span><span class="mt mt-${tag}">${tag}</span></div><h3>${h}</h3><p>${p}</p></div></div>`,
      )
      .join('')}
  </div>`,
  '#fafaf9',
  `body{padding:52px 72px}
  header{display:flex;justify-content:space-between;align-items:center;margin-bottom:26px}
  h1{font-size:50px;color:#1c1917;letter-spacing:-.02em}
  .rss{background:#fff;border:1px solid #e7e5e4;border-radius:999px;padding:11px 22px;font-size:18px;color:#57534e}
  .filters{display:flex;gap:10px;margin-bottom:36px}
  .filters b{padding:9px 20px;border-radius:999px;font-size:18px;color:#78716c;background:#fff;border:1px solid #e7e5e4;font-weight:500}
  .filters b.on{background:#1c1917;color:#fff;border-color:#1c1917}
  .tl{border-left:2px solid #e7e5e4;margin-left:8px;padding-left:0}
  .entry{position:relative;padding:0 0 40px 40px}
  .dot{position:absolute;left:-9px;top:4px;width:16px;height:16px;border-radius:50%;border:3px solid #fafaf9}
  .row{display:flex;align-items:center;gap:12px;margin-bottom:10px}
  .date{color:#a8a29e;font-size:17px}
  .ver{border:1px solid;border-radius:7px;padding:3px 10px;font-size:15px;font-weight:600}
  .mt{font-size:14px;padding:3px 10px;border-radius:6px;text-transform:capitalize}
  .mt-feature{background:#d1fae5;color:#047857}.mt-fix{background:#e0f2fe;color:#0369a1}.mt-breaking{background:#ede9fe;color:#6d28d9}
  h3{font-size:26px;color:#1c1917;margin-bottom:8px}
  .entry p{font-size:20px;color:#57534e;line-height:1.55;max-width:720px}`,
);

const statsCounter = doc(
  `<div class="head"><p class="ey">TRUSTED WORLDWIDE</p><h1>Numbers that keep growing.</h1></div>
  <div class="row">
    <div class="card sky"><b>2.4M</b><i>ACTIVE USERS</i></div>
    <div class="card violet"><b>99.8%</b><i>UPTIME SLA</i></div>
    <div class="card green"><b>180</b><i>COUNTRIES</i></div>
  </div>`,
  '#020617',
  `body{background:radial-gradient(70% 60% at 50% 30%,#0f172a,#020617);display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff}
  .head{text-align:center;margin-bottom:56px}
  .ey{color:#64748b;letter-spacing:.3em;font-size:17px;font-weight:600;margin-bottom:16px}
  h1{font-size:52px;letter-spacing:-.02em}
  .row{display:flex;gap:36px}
  .card{width:300px;padding:48px 30px;border-radius:22px;text-align:center;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);position:relative;overflow:hidden}
  .card::before{content:'';position:absolute;inset:0;top:auto;height:60%;filter:blur(50px);opacity:.35}
  .sky::before{background:#38bdf8}.violet::before{background:#a855f7}.green::before{background:#22c55e}
  .card b{font-size:82px;font-weight:700;display:block;position:relative}
  .sky b{color:#38bdf8}.violet b{color:#a855f7}.green b{color:#22c55e}
  .card i{font-style:normal;color:#94a3b8;font-size:17px;letter-spacing:.18em;position:relative}`,
);

export const EXAMPLE_PREVIEWS: Record<string, string> = {
  'cosmic-animation': cosmicAnimation,
  'organic-loaders': organicLoaders,
  'landing-page': landingPage,
  'case-study': caseStudy,
  dashboard,
  'pitch-slide': pitchSlide,
  email,
  'mobile-app': mobileApp,
  'pricing-page': pricingPage,
  'blog-article': blogArticle,
  'event-calendar': eventCalendar,
  'chat-interface': chatInterface,
  'portfolio-gallery': portfolioGallery,
  'receipt-invoice': receiptInvoice,
  'settings-panel': settingsPanel,
  'auth-signin': authSignin,
  'kanban-board': kanbanBoard,
  'ai-product-hero': aiProductHero,
  'weather-card': weatherCard,
  'timeline-changelog': timelineChangelog,
  'stats-counter': statsCounter,
};

export function getExamplePreview(id: string): string | undefined {
  return EXAMPLE_PREVIEWS[id];
}
