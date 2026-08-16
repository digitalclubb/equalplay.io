/**
 * Rasterises the PWA icons and the Open Graph share image.
 * Run with: pnpm generate-icons
 *
 * Uses the Chromium that Playwright already installs for e2e tests, so the SVG
 * is rendered by a real browser engine. ImageMagick's built-in SVG renderer
 * clips the whistle path and aliases the rounded corners.
 *
 * Outputs are committed to public/ — this only needs re-running when the brand
 * marks change.
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { chromium } from "@playwright/test";

const NAVY = "#000537";
const BRAND = "#e75333";

const publicDir = join(import.meta.dirname, "..", "public");
const favicon = readFileSync(join(publicDir, "favicon.svg"), "utf8");

// The favicon already carries the rounded-square badge, so the icons are just
// the SVG scaled up. Chromium needs an explicit box to paint it into.
const iconPage = (size: number) => `
  <style>
    html, body { margin: 0; }
    svg { display: block; width: ${size}px; height: ${size}px; }
  </style>
  ${favicon}
`;

// The whistle glyph on its own, lifted out of the favicon's badge wrapper so it
// can sit at OG-image scale without the rounded rect around it.
const whistlePath = favicon.match(/<path d="([^"]+)"/)?.[1];
if (!whistlePath) throw new Error("Could not find the whistle path in favicon.svg");

const ogPage = `
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@500;700&family=Outfit:wght@700&display=swap">
  <style>
    html, body { margin: 0; }
    body {
      width: 1200px;
      height: 630px;
      background: ${NAVY};
      color: #fff;
      font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 28px;
      padding: 0 96px;
      box-sizing: border-box;
    }
    .mark { display: flex; align-items: center; gap: 28px; }
    .mark svg { width: 132px; height: 119px; flex: none; }
    .wordmark {
      font-family: 'Outfit', system-ui, sans-serif;
      font-weight: 700;
      font-size: 104px;
      letter-spacing: -0.02em;
      line-height: 1;
    }
    .wordmark span { color: ${BRAND}; }
    .tagline { font-size: 44px; font-weight: 700; line-height: 1.25; max-width: 20ch; }
    .footnote { font-size: 30px; font-weight: 500; color: ${BRAND}; }
  </style>
  <div class="mark">
    <svg viewBox="0 0 100 90" xmlns="http://www.w3.org/2000/svg">
      <g fill="${BRAND}"><path d="${whistlePath}"/></g>
    </svg>
    <div class="wordmark">Equal <span>Play</span></div>
  </div>
  <div class="tagline">Fair game time for every child, every match</div>
  <div class="footnote">equalplay.io — free, no sign-up</div>
`;

const browser = await chromium.launch();

try {
  for (const size of [192, 512]) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(iconPage(size));
    writeFileSync(join(publicDir, `icon-${size}.png`), await page.screenshot({ omitBackground: true }));
    await page.close();
  }

  const og = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  // Wait for load, not domcontentloaded: the Google Fonts stylesheet is remote,
  // and until it lands there are no @font-face rules, so document.fonts.ready
  // would resolve against an empty queue and we'd screenshot the fallback.
  // Bounded and caught so an unreachable CDN degrades instead of hanging.
  await og
    .setContent(ogPage, { waitUntil: "load", timeout: 15000 })
    .catch(() => console.warn("Page load timed out — continuing without web fonts"));

  // ready settles once pending loads finish, successfully or not, but never
  // settles if a request hangs — so bound it and carry on.
  await og.evaluate(() =>
    Promise.race([document.fonts.ready, new Promise((resolve) => setTimeout(resolve, 5000))]),
  );

  // Both faces matter: Outfit sets the wordmark, DM Sans the tagline. Running
  // this offline would otherwise quietly replace the committed share image with
  // a system-font render, so leave the good one in place and fail loudly.
  const missing = await og.evaluate(() =>
    ["700 104px Outfit", "700 44px 'DM Sans'"].filter((font) => !document.fonts.check(font)),
  );
  if (missing.length) {
    console.error(`Skipped og-image.png — web fonts unavailable: ${missing.join(", ")}`);
    process.exitCode = 1;
  } else {
    writeFileSync(join(publicDir, "og-image.png"), await og.screenshot());
  }
  await og.close();
} finally {
  await browser.close();
}

console.log("Wrote icon-192.png, icon-512.png and og-image.png to public/");
