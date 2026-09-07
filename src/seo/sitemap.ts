/**
 * The sitemap, built rather than kept by hand.
 *
 * It was a file under `public/` holding twenty URLs, which was fine while a
 * human could count them. The drill cluster takes the site past a hundred and
 * fifty, so a hand-written copy would be a list going quietly out of date the
 * first time somebody adds a drill. `drill-pages.test.ts` holds this to exactly
 * what the build emits, in both directions, so a page that exists but is not
 * listed fails just as loudly as one listed but never written.
 *
 * Emitted at build by the `staticPages` plugin in `vite.config.ts`, into
 * `dist/` rather than into `public/`, for the same reason the rules pages are.
 */

import { ORIGIN } from "./page.js";
import { drillPagePaths } from "./drillPage.js";
import { rulesPagePaths } from "./rulesPage.js";

/**
 * The pages written by hand under `public/`, plus the two app entries.
 *
 * Their dates are carried over from the sitemap this replaced. A hand-written
 * page changes when somebody edits it, so its date is worth stating. The
 * generated pages below deliberately carry none: theirs would move on every
 * deploy whether a word had changed or not, which is a signal a crawler learns
 * to ignore.
 */
const HAND_WRITTEN: Array<[path: string, lastmod: string]> = [
  ["/", "2026-08-27"],
  ["/rugby-drills-by-age-group", "2026-08-27"],
  ["/rugby-drills-u7", "2026-08-19"],
  ["/rugby-drills-u8", "2026-08-19"],
  ["/rugby-drills-u9", "2026-08-19"],
  ["/rugby-drills-u10", "2026-08-27"],
  ["/rugby-drills-u11", "2026-08-27"],
  ["/rugby-drills-u12", "2026-08-27"],
  ["/planner", "2026-08-19"],
  ["/rugby-substitution-app", "2026-08-27"],
  ["/equal-playing-time-calculator", "2026-08-27"],
  ["/rfu-regulation-15-playing-time", "2026-08-27"],
  ["/about", "2026-08-18"],
  ["/privacy", "2026-08-18"],
];

/** Every URL the site publishes, in the order a reader would meet them. */
export function sitemapPaths(): string[] {
  return [
    ...HAND_WRITTEN.map(([path]) => path),
    ...rulesPagePaths(),
    ...drillPagePaths(),
  ];
}

export function sitemapXml(): string {
  const dated = new Map(HAND_WRITTEN);
  const urls = sitemapPaths().map((path) => {
    const lastmod = dated.get(path);
    return `  <url>\n    <loc>${ORIGIN}${path === "/" ? "/" : path}</loc>${
      lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ""
    }\n  </url>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>
`;
}
