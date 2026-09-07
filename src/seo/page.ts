/**
 * The chrome every static page in the product wears.
 *
 * Two generators write pages into `dist/`: the rules guides in `rulesPage.ts`
 * and the drill catalogue in `drillPage.ts`. Both wear the head, the header and
 * the footer the hand-written pages under `public/` already wear, because a
 * coach arriving from a search should not be able to tell which of the three
 * wrote the page they landed on.
 *
 * It lives here rather than in either generator so the second one did not begin
 * life as a copy of the first. A duplicated `<head>` is where a canonical tag,
 * an Open Graph image or a colour scheme script goes stale in one place only.
 */

import { esc } from "../lib/esc.js";

export const ORIGIN = "https://equalplay.io";

/** The two cluster indexes, named here because the shared footer links both. */
export const RULES_INDEX_PATH = "/rugby-rules-by-age-group";
export const DRILLS_INDEX_PATH = "/rugby-drills-by-age-group";

// ---- Chrome ----

export interface PageParts {
  path: string;
  title: string;
  description: string;
  /** Trail after Home. The last one is this page. */
  breadcrumb: Array<{ name: string; path: string }>;
  faqs: Array<{ question: string; answer: string }>;
  /** Anything else this page has to say in schema.org terms, such as an ItemList. */
  graph?: unknown[];
  body: string;
}

/** JSON, not HTML, so it is serialised rather than escaped by hand. */
function structuredData(parts: PageParts): string {
  const graph: unknown[] = [
    {
      "@type": "BreadcrumbList",
      itemListElement: [{ name: "Home", path: "/" }, ...parts.breadcrumb].map(
        (crumb, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: crumb.name,
          item: `${ORIGIN}${crumb.path === "/" ? "/" : crumb.path}`,
        }),
      ),
    },
  ];

  if (parts.faqs.length > 0) {
    graph.push({
      "@type": "FAQPage",
      mainEntity: parts.faqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: { "@type": "Answer", text: faq.answer },
      })),
    });
  }

  if (parts.graph) graph.push(...parts.graph);

  // `<` cannot appear inside a script element. None of this is HTML anyway
  return JSON.stringify({ "@context": "https://schema.org", "@graph": graph }, null, 2).replace(
    /</g,
    "\\u003c",
  );
}

/**
 * The same chrome the drills pages wear, because they are the same cluster.
 *
 * The header points at `/hub` rather than at anything on this page. The chrome
 * belongs to the product rather than to whichever half a coach landed on.
 */
export function page(parts: PageParts): string {
  const url = `${ORIGIN}${parts.path}`;
  const title = `${parts.title} | Equal Play`;

  return `<!doctype html>
<html lang="en-GB">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(parts.description)}" />
    <link rel="canonical" href="${url}" />
    <meta name="theme-color" content="#000537" />

    <meta property="og:title" content="${esc(parts.title)}" />
    <meta property="og:description" content="${esc(parts.description)}" />
    <meta property="og:type" content="article" />
    <meta property="og:url" content="${url}" />
    <meta property="og:site_name" content="Equal Play" />
    <meta property="og:image" content="${ORIGIN}/og-image.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="Equal Play. A rugby coaching app for U7 to U12" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(parts.title)}" />
    <meta name="twitter:description" content="${esc(parts.description)}" />
    <meta name="twitter:image" content="${ORIGIN}/og-image.png" />
    <meta name="twitter:image:alt" content="Equal Play. A rugby coaching app for U7 to U12" />

    <script type="application/ld+json">
${structuredData(parts)}
    </script>

    <!-- The scheme a coach picked in the app, applied before the stylesheet so a
         footer link out of the hub does not land them in the other one. Same key
         and same shape as the entries. See src/lib/theme.ts for the rest. -->
    <script>
      try {
        var t = localStorage.getItem("equalplay_scheme");
        if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
      } catch (e) {}
    </script>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="apple-touch-icon" href="/icon-192.png" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="/pages.css" />
    <!-- Fonts loaded async. The page paints in a system font then swaps -->
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700&family=Outfit:wght@700&display=swap"
      media="print"
      onload="this.media='all'"
    />
    <noscript
      ><link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700&family=Outfit:wght@700&display=swap"
    /></noscript>
  </head>
  <body>
    <a href="#main-content" class="skip-link">Skip to main content</a>

    <div class="site-header">
      <div class="wrap">
        <a class="brand" href="/">
          <svg viewBox="0 0 100 90" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
            <g fill="#e75333">
              <path d="M42.429,85.098l-7.46-13.395l39.167-39.192c15.618-12.947,28.398,1.138,25.433,16.215C95.421,69.811,81.16,72.085,81.16,72.085C68.16,73.767,65,62.25,65,62.25L42.429,85.098z M38.669,85.52l-6.762-12.217L0,62.188l6.838,12.735L38.669,85.52z M68.111,69.697c-3.24-2.792-3.525-4.912-3.525-4.912l-3.014,2.736L68.111,69.697z M83.541,24.843c-6.641,0.041-11.96,5.519-11.96,5.519L32.454,69.811L0,58.846l37.747-38.21c9.375-9.49,18.786-4.784,18.786-4.784l5.539,1.844c3.655-4.917,11.055-3.07,12.762-1.761c3.643,2.793,2.587,6.035,2.193,6.74L83.541,24.843z M66.814,19.274l5.828,1.94C73.645,18.162,68.6,16.971,66.814,19.274z M60.6,35.187l-22.963-7.765l-8.13,8.088l22.962,7.765L60.6,35.187z" />
            </g>
          </svg>
          <span class="brand-text">Equal <span>Play</span></span>
        </a>
        <a class="header-cta" href="/hub">Open Equal Play</a>
      </div>
    </div>

    <main id="main-content">
      <div class="wrap">
${parts.body}
      </div>
    </main>

    <footer class="site-footer">
      <div class="wrap">
        <ul>
          <li><a href="/hub">Open Equal Play</a></li>
          <li><a href="${RULES_INDEX_PATH}">Rugby rules by age group</a></li>
          <li><a href="${DRILLS_INDEX_PATH}">Rugby drills by age group</a></li>
          <li><a href="/planner">Match day</a></li>
          <li><a href="/rugby-substitution-app">Rugby substitution app</a></li>
          <li><a href="/equal-playing-time-calculator">Equal playing time calculator</a></li>
          <li><a href="/rfu-regulation-15-playing-time">Regulation 15 playing time</a></li>
          <li><a href="/privacy">Privacy</a></li>
        </ul>
        <p>Built by a volunteer coach who got fed up doing this on the back of a team sheet.</p>
      </div>
    </footer>
  </body>
</html>
`;
}
