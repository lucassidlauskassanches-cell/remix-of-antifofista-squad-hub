// Runs in the browser. For each .autofit page, binary-search the per-page --s scale
// so the flowing body fills the available height of the fixed A4 page without
// overflowing. Short pages grow, full pages shrink — kills the empty void and clipping.
//
// Takes an optional Document so it can run against an <iframe> preview as well as the
// puppeteer page. With no argument it falls back to the global `document`, so
// `page.evaluate(autoFit)` keeps working serverside.
export function autoFit(doc: Document = document): void {
  const pages = Array.from(doc.querySelectorAll<HTMLElement>(".page.autofit"));
  for (const pg of pages) {
    const body = pg.querySelector<HTMLElement>(".body");
    if (!body) continue;
    // Intrinsic height of the body's content (independent of the flex centering).
    const contentHeight = (): number => {
      const kids = Array.from(body.children) as HTMLElement[];
      if (!kids.length) return 0;
      let top = Infinity;
      let bottom = -Infinity;
      for (const k of kids) {
        const r = k.getBoundingClientRect();
        top = Math.min(top, r.top);
        bottom = Math.max(bottom, r.bottom);
      }
      return bottom - top;
    };
    // Largest scale (within a tasteful range) that still fits the available band.
    // Floor is low (0.42) so even the densest page (acompanhamento: intro + 5
    // rules + disclaimer) shrinks enough to fit instead of overflowing. Combined
    // with the top-aligned body, content is never clipped.
    let lo = 0.42;
    let hi = 1.28;
    let best = lo;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      pg.style.setProperty("--s", String(mid));
      if (contentHeight() <= body.clientHeight * 0.985) {
        best = mid;
        lo = mid;
      } else {
        hi = mid;
      }
    }
    pg.style.setProperty("--s", String(best));
  }
}
