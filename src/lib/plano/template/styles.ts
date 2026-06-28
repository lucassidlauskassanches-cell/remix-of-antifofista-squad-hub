// Layout CSS for the Plano de Ação document. Faithful to the Antifofista model.
// Image refs use placeholders (__LOGO__/__COVER__) injected at render time.
export const LAYOUT_CSS = `
  :root{
    --bg: #0b0b0b;
    --bg-2: #141414;
    --ink: #f4f4f0;
    --ink-dim: #8c8c86;
    --rule: #232321;
    --rule-2: #3a3a36;
    --pageW: 1240px;
    --pageH: 1754px;
    --s: 1; /* per-page auto-fit scale, set at render time */
  }
  *{ box-sizing: border-box; }
  html, body{
    margin:0; padding:0;
    background:#1a1a1a;
    color:var(--ink);
    font-family:'Inter', system-ui, sans-serif;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .doc{ display:flex; flex-direction:column; align-items:center; gap:24px; padding:24px 0; }
  .page{
    width: var(--pageW); height: var(--pageH);
    background: var(--bg); color: var(--ink);
    position: relative; overflow: hidden;
    page-break-after: always; break-after: page;
  }
  .page:last-child{ page-break-after: auto; break-after: auto; }
  @media screen{ .page{ box-shadow: 0 8px 40px rgba(0,0,0,0.55); } }

  .frame{ position:absolute; inset:0; padding: 150px 80px 124px 80px; display:flex; flex-direction:column; justify-content:flex-start; }
  /* Auto-fit: pages marked .autofit get a per-page --s scale set at render time so
     the content fills the page without overflowing (short pages grow, full shrink).
     The body grows to take the space between the section badge and the footer and is
     TOP-aligned: leftover space falls to the bottom and, crucially, dense content can
     never be clipped at the top (centering used to cut the opening lines). */
  .body{ flex:1; display:flex; flex-direction:column; justify-content:flex-start; min-height:0; }

  /* Running header — pinned to the top so the body can center between it and the foot */
  .runhead{
    position:absolute; top:78px; left:80px; right:80px;
    display:flex; align-items:center; justify-content:space-between;
    border-bottom:1px solid var(--rule); padding-bottom:16px; margin-bottom:0;
  }
  .runhead .l{
    font-family:'Oswald', sans-serif; font-weight:700; font-size:16px;
    letter-spacing:0.1em; text-transform:uppercase; color:var(--ink);
    display:flex; align-items:center; gap:14px;
  }
  .runhead .l .mk{
    width:26px; height:26px; background:url("__LOGO__") center/contain no-repeat;
    mix-blend-mode:screen;
  }
  .runhead .r{
    font-family:'JetBrains Mono', monospace; font-size:12px;
    letter-spacing:0.26em; text-transform:uppercase; color:var(--ink-dim);
  }

  /* Section badge */
  .sec{ display:flex; align-items:center; margin-bottom: 30px; }
  .sec .sq{ width:13px; height:13px; background:var(--ink); margin-right:18px; flex-shrink:0; }
  .sec .badge{
    background:var(--ink); color:#0b0b0b;
    font-family:'Oswald', sans-serif; font-weight:700; text-transform:uppercase;
    font-size:21px; letter-spacing:0.1em; padding:11px 24px 9px; white-space:nowrap;
    flex-shrink:0;
  }
  .sec .line{ flex:1; height:1px; background:var(--rule-2); margin-left:20px; position:relative; }
  .sec .line::after{ content:''; position:absolute; right:0; top:-3.5px; width:8px; height:8px; border-radius:50%; background:var(--ink); }

  /* Foot */
  .foot{
    position:absolute; left:80px; right:80px; bottom:42px;
    display:flex; align-items:center; justify-content:space-between;
    font-family:'JetBrains Mono', monospace; font-size:12px;
    letter-spacing:0.2em; text-transform:uppercase; color:var(--ink-dim);
    border-top:1px solid var(--rule); padding-top:16px;
  }

  /* Type */
  .eyebrow{ font-family:'JetBrains Mono', monospace; font-size:13px; letter-spacing:0.28em; text-transform:uppercase; color:var(--ink-dim); display:block; }
  h2.ttl{ font-family:'Oswald', sans-serif; font-weight:700; text-transform:uppercase; letter-spacing:0.02em; line-height:0.98; font-size:46px; margin:0 0 18px 0; color:var(--ink); }
  p.tx{ font-family:'Inter', sans-serif; font-size:calc(16.5px * var(--s)); line-height:1.62; color:#cfcfca; margin:0 0 calc(16px * var(--s)) 0; max-width:680px; }
  p.tx strong{ color:var(--ink); font-weight:600; }
  .lead{ font-size:calc(18px * var(--s)); color:#e2e2dd; }

  /* Subhead with tick */
  .subh{ display:flex; align-items:center; gap:14px; margin: calc(26px * var(--s)) 0 calc(14px * var(--s)); }
  .subh .bar{ width:5px; height:calc(26px * var(--s)); background:var(--ink); }
  .subh h3{ font-family:'Oswald', sans-serif; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; font-size:calc(26px * var(--s)); margin:0; color:var(--ink); }

  /* Cover */
  .cover-photo{ position:absolute; inset:0; background:url("__COVER__") 72% 16% / cover no-repeat; }
  .cover-fade{ position:absolute; inset:0;
    background:
      linear-gradient(90deg, rgba(8,8,8,0.99) 0%, rgba(8,8,8,0.95) 30%, rgba(8,8,8,0.55) 55%, rgba(8,8,8,0.15) 80%, rgba(8,8,8,0.35) 100%),
      linear-gradient(0deg, rgba(8,8,8,0.98) 4%, rgba(8,8,8,0) 32%),
      linear-gradient(180deg, rgba(8,8,8,0.6) 0%, rgba(8,8,8,0) 16%);
  }
  .cover-top{ position:absolute; top:70px; left:80px; right:80px; display:flex; align-items:flex-start; justify-content:space-between; }
  .cover-logo{ width:200px; height:200px; background:url("__LOGO__") left center/contain no-repeat; mix-blend-mode:screen; }
  .cover-mid{ position:absolute; left:80px; right:80px; top:430px; }
  .cover-kick{ font-family:'JetBrains Mono', monospace; font-size:15px; letter-spacing:0.3em; text-transform:uppercase; color:var(--ink-dim); margin-bottom:24px; display:block; }
  .cover-title{ font-family:'Oswald', sans-serif; font-weight:700; text-transform:uppercase; line-height:0.84; letter-spacing:0.005em; font-size:150px; margin:0; color:var(--ink); }
  .cover-rule{ width:120px; height:4px; background:var(--ink); margin:34px 0 26px; }
  .cover-sub{ font-family:'Inter', sans-serif; font-size:19px; line-height:1.5; color:#d8d8d3; max-width:560px; }
  .cover-aluno{
    position:absolute; left:80px; right:80px; bottom:78px;
    border:1px solid var(--rule-2); background:rgba(10,10,10,0.55);
    backdrop-filter: blur(2px);
    display:flex; align-items:center; gap:20px; padding:22px 28px;
  }
  .cover-aluno .ic{ width:42px; height:42px; border:1.5px solid var(--ink); border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .cover-aluno .ic svg{ width:22px; height:22px; stroke:var(--ink); fill:none; stroke-width:1.6; }
  .cover-aluno .k{ font-family:'JetBrains Mono', monospace; font-size:13px; letter-spacing:0.24em; text-transform:uppercase; color:var(--ink-dim); }
  .cover-aluno .n{ font-family:'Oswald', sans-serif; font-weight:700; text-transform:uppercase; font-size:30px; letter-spacing:0.02em; color:var(--ink); line-height:1; margin-top:3px; }

  /* Manifesto / dark statement */
  .stmt{ flex:1; display:flex; flex-direction:column; justify-content:center; }
  .stmt .big{ font-family:'Oswald', sans-serif; font-weight:700; text-transform:uppercase; font-size:30px; line-height:1.32; letter-spacing:0.005em; color:var(--ink); }
  .stmt .big .out{ -webkit-text-stroke:1.2px var(--ink); color:transparent; }

  /* Cards */
  .card{ border:1px solid var(--rule-2); background:var(--bg-2); padding:calc(24px * var(--s)) calc(26px * var(--s)); }
  .card .k{ font-family:'JetBrains Mono', monospace; font-size:calc(12px * var(--s)); letter-spacing:0.18em; text-transform:uppercase; color:var(--ink-dim); display:block; margin-bottom:calc(10px * var(--s)); }
  .card .h{ font-family:'Oswald', sans-serif; font-weight:700; text-transform:uppercase; font-size:calc(23px * var(--s)); line-height:1.08; letter-spacing:0.02em; color:var(--ink); margin-bottom:calc(8px * var(--s)); }
  .card .b{ font-family:'Inter', sans-serif; font-size:calc(14.5px * var(--s)); line-height:1.5; color:#cfcfca; }
  .g2{ display:grid; grid-template-columns:1fr 1fr; gap:16px; }
  .g3{ display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px; }

  /* Numbered list */
  ol.num{ list-style:none; counter-reset:n; padding:0; margin:0; }
  ol.num li{ counter-increment:n; display:grid; grid-template-columns:42px 1fr; gap:18px; padding:calc(15px * var(--s)) 0; border-top:1px solid var(--rule); align-items:start; }
  ol.num li:last-child{ border-bottom:1px solid var(--rule); }
  ol.num li::before{ content:counter(n,decimal-leading-zero); font-family:'Oswald', sans-serif; font-weight:700; font-size:calc(26px * var(--s)); color:var(--ink); line-height:1; }
  ol.num li .h{ font-family:'Oswald', sans-serif; font-weight:600; text-transform:uppercase; font-size:calc(18px * var(--s)); letter-spacing:0.03em; color:var(--ink); margin-bottom:4px; }
  ol.num li .d{ font-family:'Inter', sans-serif; font-size:calc(14.5px * var(--s)); line-height:1.5; color:#cfcfca; }

  /* Timeline / fases */
  .phase{ display:grid; grid-template-columns: 44px 1fr 150px; gap:22px; padding:calc(22px * var(--s)) 0; border-top:1px solid var(--rule-2); align-items:start; }
  .phase:last-child{ border-bottom:1px solid var(--rule-2); }
  .phase .num{ font-family:'Oswald', sans-serif; font-weight:700; font-size:calc(40px * var(--s)); line-height:0.9; color:var(--ink); -webkit-text-stroke:1px var(--ink); }
  .phase .pk{ font-family:'JetBrains Mono', monospace; font-size:calc(12px * var(--s)); letter-spacing:0.2em; text-transform:uppercase; color:var(--ink-dim); display:block; margin-bottom:4px; }
  .phase .pn{ font-family:'Oswald', sans-serif; font-weight:700; text-transform:uppercase; font-size:calc(30px * var(--s)); letter-spacing:0.02em; color:var(--ink); line-height:1; margin-bottom:8px; }
  .phase .po{ font-family:'Inter', sans-serif; font-size:calc(14.5px * var(--s)); line-height:1.5; color:#cfcfca; }
  .phase .mo{ font-family:'JetBrains Mono', monospace; font-size:calc(14px * var(--s)); letter-spacing:0.12em; text-transform:uppercase; color:var(--ink-dim); text-align:right; line-height:1.7; }

  /* Photo analysis */
  .shots{ display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-bottom:26px; }
  .shot{ aspect-ratio:3/4; border:1px solid var(--rule-2); background:var(--bg-2);
    display:flex; flex-direction:column; align-items:center; justify-content:center; gap:14px;
    position:relative; overflow:hidden; }
  .shot .ic{ width:46px; height:46px; stroke:var(--ink-dim); fill:none; stroke-width:1.4; }
  .shot .lb{ font-family:'JetBrains Mono', monospace; font-size:12px; letter-spacing:0.2em; text-transform:uppercase; color:var(--ink-dim); }
  .shot .no{ font-family:'Inter', sans-serif; font-size:11px; color:#6a6a64; }
  .shot img{ position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
  .shot .tag{ position:absolute; left:0; right:0; bottom:0; padding:8px 0; text-align:center;
    background:linear-gradient(0deg, rgba(8,8,8,0.85), rgba(8,8,8,0));
    font-family:'JetBrains Mono', monospace; font-size:11px; letter-spacing:0.2em; text-transform:uppercase; color:var(--ink); }

  /* Disclaimer box */
  .disc{ display:grid; grid-template-columns:54px 1fr; gap:20px; border:1px solid var(--rule-2); background:var(--bg-2); padding:calc(22px * var(--s)) 26px; margin-bottom:0; align-items:start; }
  .disc .st{ width:46px; height:46px; border:1.5px solid var(--ink); border-radius:50%; display:flex; align-items:center; justify-content:center; }
  .disc .st svg{ width:24px; height:24px; fill:var(--ink); }
  .disc .b{ font-family:'Inter', sans-serif; font-size:calc(15px * var(--s)); line-height:1.55; color:#cfcfca; }
  .disc .b strong{ color:var(--ink); font-weight:700; }

  /* Closer */
  .closer{ position:absolute; inset:0; background:#070707; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; gap:34px; }
  .closer .mk{ width:200px; height:200px; background:url("__LOGO__") center/contain no-repeat; }
  .closer .bora{ font-family:'Oswald', sans-serif; font-weight:700; text-transform:uppercase; font-size:80px; letter-spacing:0.01em; color:var(--ink); line-height:0.95; }
  .closer .bora .out{ -webkit-text-stroke:1.4px var(--ink); color:transparent; }
  .closer .sub{ font-family:'JetBrains Mono', monospace; font-size:13px; letter-spacing:0.4em; text-transform:uppercase; color:var(--ink-dim); }
  .closer .dash{ display:flex; align-items:center; gap:16px; color:var(--ink-dim); }
  .closer .dash span{ width:60px; height:1px; background:var(--rule-2); }
  .closer .dash .d{ width:6px;height:6px;border-radius:50%;background:var(--ink); }

  .mani{ flex:1; display:flex; flex-direction:column; justify-content:center; }
  .mani p{ font-family:'Oswald', sans-serif; font-weight:600; text-transform:uppercase; font-size:30px; line-height:1.34; letter-spacing:0.005em; color:var(--ink); margin:0 0 26px 0; }
  .mani p.end{ font-size:70px; -webkit-text-stroke:1.3px var(--ink); color:transparent; margin-top:16px; line-height:1; }

  @media print{
    /* Print page MUST match the screen design box (1240x1754px) exactly. autoFit
       measures the body against that pixel box; if print remapped to 210mm/297mm
       (~793x1122px) while padding and fonts stay in fixed px, content would occupy
       proportionally more space and overflow/clip even though autoFit thought it
       fit. Same proportions as A4 (1240/1754 = 210/297), so it prints to A4 cleanly. */
    @page{ size:1240px 1754px; margin:0; }
    html, body{ background:#000; }
    .doc{ gap:0; padding:0; }
    .page{ width:var(--pageW); height:var(--pageH); box-shadow:none; }
  }
`;
