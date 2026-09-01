/**
 * The rules guides, rendered as static pages a search engine can read.
 *
 * The guide itself is hub content and stays that way. It lives in the bundle so
 * the Guide tab opens with no signal, which is why it moved out of `public/` in
 * the first place. But `/hub` is `noindex`, so six guides written from the RFU's
 * own rules of play sit where nothing can find them. Meanwhile "u10 rugby
 * rules" is a question a coach types into Google in August.
 *
 * So these are the drills cluster's shape applied to the rules: a static page
 * per grade that ranks, points its chrome at the product and links into the hub
 * guide. The hub tab does not move. Nothing here is written twice either: every
 * word comes out of `hub/content/guides.ts`, so a page cannot drift from the
 * guide the way a hand-written copy of it would.
 *
 * Emitted at build time by the `rulesPages` plugin in `vite.config.ts`, into
 * `dist/` rather than into `public/`. A copy in `public/` would be a second
 * source of truth sitting in the repository going stale, which is the thing
 * `landing-pages.test.ts` has a guard against.
 */

import { esc } from "../lib/esc.js";
import {
  AGE_GROUPS,
  AGE_GROUP_LABELS,
  REGULATION_15_URL,
  RULES_OF_PLAY,
  type AgeGroup,
} from "../hub/content/types.js";
import {
  ARRIVALS,
  GUIDES,
  GUIDE_BLURB,
  type Guide,
  type GuideBlock,
  type GuideTable,
} from "../hub/content/guides.js";

const ORIGIN = "https://equalplay.io";

/** Where a grade's page lives. One place, so the sitemap and the links agree. */
export function rulesPath(age: AgeGroup): string {
  return `/rugby-rules-${age}`;
}

export const RULES_INDEX_PATH = "/rugby-rules-by-age-group";

/** Every page this module emits, for the sitemap and for the tests. */
export function rulesPagePaths(): string[] {
  return [RULES_INDEX_PATH, ...AGE_GROUPS.map(rulesPath)];
}

// ---- Chrome ----

interface PageParts {
  path: string;
  title: string;
  description: string;
  /** Trail after Home. The last one is this page. */
  breadcrumb: Array<{ name: string; path: string }>;
  faqs: Array<{ question: string; answer: string }>;
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
function page(parts: PageParts): string {
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
          <li><a href="/rugby-drills-by-age-group">Rugby drills by age group</a></li>
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

// ---- Guide content, as page markup ----

function table(t: GuideTable): string {
  // Blank only when the content leaves it blank. See the note in `guide.ts`:
  // the arrivals table on the index names its first column Grade.
  const head = t.head
    .map((h, i) =>
      i === 0 && !h
        ? `<th scope="col"><span class="sr-only">Row</span></th>`
        : `<th scope="col">${esc(h)}</th>`,
    )
    .join("");
  const rows = t.rows
    .map(
      (row) =>
        `<tr><th scope="row">${esc(row[0])}</th>${row
          .slice(1)
          .map((cell) => `<td>${esc(cell)}</td>`)
          .join("")}</tr>`,
    )
    .join("");
  return `        <div class="scroll-x">
          <table>
            <caption class="calc-detail">${esc(t.caption)}</caption>
            <thead><tr>${head}</tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
}

/**
 * `h4` in the hub becomes `h3` here, because a static page starts at `h1` while
 * a hub route starts at `h2` under the app's own heading.
 */
function block(b: GuideBlock): string {
  if ("subheading" in b) return `        <h3>${esc(b.subheading)}</h3>`;
  if ("text" in b) return `        <p>${esc(b.text)}</p>`;
  if ("table" in b) return table(b.table);
  return `        <ul>${b.items
    .map((item) => `<li>${item.lead ? `<strong>${esc(item.lead)}</strong> ` : ""}${esc(item.text)}</li>`)
    .join("")}</ul>`;
}

function rulesLink(text: string, href: string): string {
  return `<a href="${esc(href)}" rel="noopener">${esc(text)}</a>`;
}

/** The disclaimer every page in this cluster carries, in one place. */
function sourceNote(label: string, href: string): string {
  return `        <div class="note">
          <p>
            Equal Play is not affiliated with the RFU. Regulation 15 is theirs. This page
            puts it in our own words, so it is a summary rather than the thing itself. It
            is reissued every summer as well, so read this season's there rather than
            trusting a copy on somebody else's website. Ours included. If a referee on
            Sunday says something different to this page, they are right.
          </p>
          <p>${rulesLink(label, href)}</p>
        </div>`;
}

function neighbours(age: AgeGroup): string {
  const others = AGE_GROUPS.filter((other) => other !== age);
  return `        <h2>The other age grades</h2>
        <ul>
${others
  .map(
    (other) =>
      `          <li><a href="${rulesPath(other)}">What ${AGE_GROUP_LABELS[other]} rugby looks like</a></li>`,
  )
  .join("\n")}
        </ul>
        <p>
          <a href="${RULES_INDEX_PATH}">Every grade side by side</a> is the whole progression
          on one page. <a href="/rugby-drills-${age}">${AGE_GROUP_LABELS[age]} rugby drills</a>
          are the ones written for an ${AGE_GROUP_LABELS[age]} grade.
        </p>`;
}

function guideBody(guide: Guide): string {
  const label = AGE_GROUP_LABELS[guide.ageGroup];

  return `        <h1>${esc(guide.title)}</h1>
        <p class="standfirst">${esc(guide.standfirst)}</p>

        <p><a class="cta" href="/hub#/guide/${guide.ageGroup}">Read it in the app</a></p>
        <p class="home-microcopy">
          Free to read with no account. It works at a pitch with no signal too.
        </p>

${guide.sections
  .map((section) => `        <h2>${esc(section.heading)}</h2>\n${section.blocks.map(block).join("\n")}`)
  .join("\n\n")}

        <h2>Common questions</h2>
${guide.faqs.map((faq) => `        <h3>${esc(faq.question)}</h3>\n        <p>${esc(faq.answer)}</p>`).join("\n")}

${sourceNote(`The RFU's own ${label} rules of play`, RULES_OF_PLAY[guide.ageGroup])}

${neighbours(guide.ageGroup)}`;
}

// ---- Pages ----

export function rulesPageHtml(age: AgeGroup): string {
  const guide = GUIDES[age];
  const label = AGE_GROUP_LABELS[age];

  return page({
    path: rulesPath(age),
    title: `${label} Rugby Rules, What the Age Grade Allows`,
    // Raw, like every other field here. `page()` escapes it. Escaping it twice
    // would put &amp;#39; into three meta tags the first time a blurb is written
    // with an apostrophe in it.
    description: `${GUIDE_BLURB[age]} What an ${label} grade may and may not do at training and on a Sunday, written from RFU Regulation 15.`,
    breadcrumb: [
      { name: "Rugby rules by age group", path: RULES_INDEX_PATH },
      { name: `${label} rugby rules`, path: rulesPath(age) },
    ],
    faqs: guide.faqs,
    body: guideBody(guide),
  });
}

export function rulesIndexHtml(): string {
  const cards = AGE_GROUPS.map(
    (age) =>
      `          <li>
            <a href="${rulesPath(age)}"><strong>${AGE_GROUP_LABELS[age]}. ${esc(GUIDES[age].title)}</strong></a>
            ${esc(GUIDE_BLURB[age])}
          </li>`,
  ).join("\n");

  const body = `        <h1>Rugby rules by age group</h1>
        <p class="standfirst">
          RFU Regulation 15 decides what a minis grade may do rather than a coach's
          judgement. One page per grade from U7 to U12, saying what arrives, what goes
          and what to get in before the season starts.
        </p>

        <p><a class="cta" href="/hub#/guide">Read them in the app</a></p>
        <p class="home-microcopy">
          Free to read with no account. They work at a pitch with no signal too.
        </p>

        <h2>When each part of the game arrives</h2>
${table(ARRIVALS)}
        <p>
          There is no lineout at any minis grade. It turns up at U14, with lifting held
          back until U15, so nothing between here and then needs a throw practised at
          training.
        </p>

        <h2>Pick a grade</h2>
        <ul>
${cards}
        </ul>

        <h2>The same at every grade</h2>
        <ul>
          <li><strong>The Half Game rule.</strong> Every player gets at least half of every
            match. It is the one clubs get wrong most often.
            <a href="/planner">Match day</a> works it out for you on the touchline.</li>
          <li><strong>Rolling substitutions, unlimited.</strong> Only when the ball is dead,
            always with the referee's permission. A player who comes off can go back on.</li>
          <li><strong>No sin bin anywhere in minis.</strong> The referee sorts it out with the
            coaches on the touchline and the sides stay even.</li>
          <li><strong>Coaches stay off the pitch</strong> while the ball is in play. The referee
            is expected to talk the players through it instead.</li>
          <li><strong>Pitch sizes are maximums.</strong> A referee and both coaches can agree
            something smaller whenever they think it is safer.</li>
          <li><strong>Squeezeball is banned</strong> and no coach may teach it, at any grade.</li>
        </ul>

${sourceNote("Regulation 15 in full", REGULATION_15_URL)}

        <h2>What each grade trains</h2>
        <p>
          <a href="/rugby-drills-by-age-group">Rugby drills by age group</a> is the same
          split applied to training. Every drill is matched to the grade, so a ruck drill
          cannot reach an U8 session.
        </p>`;

  return page({
    path: RULES_INDEX_PATH,
    title: "Rugby Rules by Age Group, U7 to U12",
    description:
      "What each RFU minis age grade plays, U7 to U12. Tackling at U9, rucks and scrums at U10, no lineout at any of them. Written from Regulation 15.",
    breadcrumb: [{ name: "Rugby rules by age group", path: RULES_INDEX_PATH }],
    faqs: [],
    body,
  });
}

/** Every page, keyed by the path it belongs at. What the build writes out. */
export function rulesPages(): Array<{ path: string; html: string }> {
  return [
    { path: RULES_INDEX_PATH, html: rulesIndexHtml() },
    ...AGE_GROUPS.map((age) => ({ path: rulesPath(age), html: rulesPageHtml(age) })),
  ];
}
