// Runs in the browser. For each .autofit page, binary-search the per-page --s scale
// so the flowing body fills the available height of the fixed A4 page without
// overflowing. Short pages grow, full pages shrink — kills the empty void and clipping.
//
// Takes an optional Document so it can run against an <iframe> preview as well as the
// puppeteer page. With no argument it falls back to the global `document`, so
// `page.evaluate(autoFit)` keeps working serverside.
export function autoFit(doc: Document = document): void {
  const win = doc.defaultView;
  const pages = Array.from(doc.querySelectorAll<HTMLElement>(".page.autofit"));
  for (const pg of pages) {
    const body = pg.querySelector<HTMLElement>(".body");
    if (!body) continue;

    // Extent from top of the first child to bottom of the last child, plus the
    // margin-top of the first child and margin-bottom of the last child — those
    // margins are outside the bounding box and would otherwise be ignored by
    // getBoundingClientRect(), making the fit optimistic and clipping the last
    // lines in print. In a flex column the sibling margins between children DO
    // occupy real space (no collapsing), so they're already accounted for by
    // (last.bottom - first.top).
    const contentHeight = (): number => {
      const kids = Array.from(body.children) as HTMLElement[];
      if (!kids.length) return 0;
      const first = kids[0];
      const last = kids[kids.length - 1];
      const top = first.getBoundingClientRect().top;
      const bottom = last.getBoundingClientRect().bottom;
      const cs = win?.getComputedStyle;
      const mt = cs ? parseFloat(cs(first).marginTop) || 0 : 0;
      const mb = cs ? parseFloat(cs(last).marginBottom) || 0 : 0;
      return bottom - top + mt + mb;
    };

    // 6% headroom para diferenças sub-pixel entre tela e motor de impressão do
    // Chrome + variação de métrica quando as webfonts substituem o fallback.
    const available = body.clientHeight * 0.94;

    let lo = 0.42;
    let hi = 1.15;
    let best = lo;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      pg.style.setProperty("--s", String(mid));
      if (contentHeight() <= available) {
        best = mid;
        lo = mid;
      } else {
        hi = mid;
      }
    }
    pg.style.setProperty("--s", String(best));

    if (best <= 0.43 && typeof console !== "undefined") {
      console.warn(
        "[autoFit] página muito densa, considere reduzir o texto:",
        pg.querySelector(".badge")?.textContent?.trim() ?? "(sem badge)",
      );
    }
  }
}
