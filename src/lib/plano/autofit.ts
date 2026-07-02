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

    // Real layout height including collapsed vertical margins on first/last
    // children (which getBoundingClientRect would drop, causing autofit to
    // pick a scale that overflows on print and clips the last lines).
    const contentHeight = (): number => body.scrollHeight;

    // 4% headroom for sub-pixel differences between screen and Chrome's
    // print engine. Cap the upper bound so short pages don't inflate fonts.
    const available = body.clientHeight * 0.96;

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

    // Sinal para dev: se a página bateu no piso, ainda tem risco de estourar
    // — vale editar o conteúdo pra encurtar.
    if (best <= 0.43 && typeof console !== "undefined") {
      console.warn(
        "[autoFit] página muito densa, considere reduzir o texto:",
        pg.querySelector(".badge")?.textContent?.trim() ?? "(sem badge)",
      );
    }
  }
}
