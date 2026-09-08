import { existsSync, readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import {
  drillPageHtml,
  drillPagePaths,
  drillPath,
  drillPages,
  drillsFor,
  themeGrades,
  themePageHtml,
  themePath,
} from "../seo/drillPage.js";
import { rulesPagePaths } from "../seo/rulesPage.js";
import { sitemapPaths, sitemapXml } from "../seo/sitemap.js";
import { DRILLS } from "../hub/content/drills.js";
import { esc } from "../lib/esc.js";
import {
  AGE_GROUPS,
  AGE_GROUP_LABELS,
  THEMES,
  THEME_MIN_AGE,
  ageAtLeast,
  isAvailableAt,
} from "../hub/content/types.js";

/**
 * The drill catalogue, published where a search engine can read it.
 *
 * The hub is `noindex` and a hash route is one URL to a crawler, so 120 drills
 * written from scratch were invisible until these pages existed. Rendered here
 * from the same functions the build calls, so this checks the pages that
 * actually ship rather than a copy of them.
 *
 * The load bearing part is the first block. Every other route drill copy takes
 * to a screen is gated by `filterDrills` or by `isAvailableAt`. A static page is
 * gated by nothing at all once it is written, so the gate has to be checked at
 * the point the file is emitted. A page called "U8 rugby ruck drills" is the age
 * gate failing in public, on the one surface we cannot take back down quickly.
 */

const page = (path: string): string => readFileSync(path, "utf8");

describe("the age gate holds on a page nobody signed in for", () => {
  it("writes no theme page below the grade Regulation 15 allows it at", () => {
    for (const { theme, age } of themeGrades()) {
      expect(
        ageAtLeast(age, THEME_MIN_AGE[theme]),
        `${themePath(theme, age)} is below the ${theme} floor of ${THEME_MIN_AGE[theme]}`,
      ).toBe(true);
    }
  });

  it("puts no drill on a grade's page that the grade cannot do", () => {
    for (const { theme, age, drills } of themeGrades()) {
      for (const drill of drills) {
        expect(isAvailableAt(drill, age), `${drill.id} on ${themePath(theme, age)}`).toBe(true);
        expect(drill.themes, `${drill.id} is not a ${theme} drill`).toContain(theme);
      }
    }
  });

  it("leaves a theme with no page at all until its grade arrives", () => {
    for (const theme of THEMES) {
      for (const age of AGE_GROUPS) {
        if (ageAtLeast(age, THEME_MIN_AGE[theme])) continue;
        expect(drillPagePaths(), `${theme} at ${age}`).not.toContain(themePath(theme, age));
      }
    }
  });

  it("says on a theme page which grade the work starts at", () => {
    // A coach landing from a search has not picked a grade, so the page has to
    // say what it is claiming rather than assume the reader knows.
    for (const { theme, age, drills } of themeGrades()) {
      const html = themePageHtml(theme, age, drills);
      expect(html, themePath(theme, age)).toContain(`What ${AGE_GROUP_LABELS[age]} is allowed here`);
      expect(html, themePath(theme, age)).toContain(`href="/rugby-rules-${age}"`);
    }
  });

  it("hands no minis grade a lineout", () => {
    // Reg 15 has the lineout arriving at U14. Seven pages claimed U12 until
    // August 2026. Saying "no lineout" is fine, so this bans the claim rather
    // than the word, the same way `landing-pages.test.ts` does.
    const CLAIMS =
      /(?<!no )(?<!not )lineouts? (?:from |at |arrives? at |starts? at |is introduced at )u(?:7|8|9|1[0-3])\b/i;
    for (const { path, html } of drillPages()) {
      const flat = html.replace(/\s+/g, " ");
      expect(CLAIMS.test(flat), `${path}: ${flat.match(CLAIMS)?.[0]}`).toBe(false);
      expect(flat, `${path} offers a lineout drill`).not.toContain("lineout drills");
    }
  });
});

describe("one page per drill", () => {
  it("writes every drill out exactly once, at its own address", () => {
    const paths = DRILLS.map(drillPath);
    // The `drill-` and `warmup-` prefixes come off the id to build the address,
    // so two drills whose names only differ by their prefix would collide and
    // one of them would silently overwrite the other in `dist/`.
    expect(new Set(paths).size, "two drills share an address").toBe(paths.length);
    expect(drillPages().length).toBe(DRILLS.length + themeGrades().length);
  });

  it("says everything the drill says", () => {
    for (const drill of DRILLS) {
      const html = drillPageHtml(drill);
      const where = `${drillPath(drill)}`;
      // Escaped the way the page escapes it. Escaping is per character, so the
      // escape of a prefix is the prefix of the escape. Comparing raw text
      // passes on 119 drills then fails on the one with an apostrophe in it.
      const says = (text: string): string => esc(text.slice(0, 30));
      expect(html, where).toContain(esc(drill.title));
      expect(html, where).toContain(says(drill.setup));
      expect(html, where).toContain(says(drill.howItRuns));
      for (const point of drill.coachingPoints) {
        expect(html, `${where}: ${point}`).toContain(says(point));
      }
      // The faults are the part no competitor has, so they are the part most
      // worth publishing. A page that quietly dropped them would rank on the
      // half of the drill everybody else already has.
      for (const fault of drill.faults ?? []) {
        expect(html, `${where}: ${fault.looks}`).toContain(says(fault.looks));
        expect(html, `${where}: ${fault.say}`).toContain(says(fault.say));
      }
      if (drill.safety) expect(html, `${where}: safety`).toContain(says(drill.safety));
    }
  });

  it("draws the diagram the app draws", () => {
    // The same renderer off the same coordinates, so a static page cannot show
    // a coach a different picture to the one in their pocket at the pitch.
    for (const drill of DRILLS) {
      const html = drillPageHtml(drill);
      expect(html.includes('class="drill-diagram"'), `${drillPath(drill)}`).toBe(Boolean(drill.diagram));
    }
  });

  it("points every drill at the app", () => {
    for (const drill of DRILLS) {
      expect(drillPageHtml(drill), drillPath(drill)).toContain(`/hub#/catalogue/${drill.id}`);
    }
  });

  it("declares its own address as canonical", () => {
    for (const { path, html } of drillPages()) {
      expect(html, path).toContain(`<link rel="canonical" href="https://equalplay.io${path}" />`);
    }
  });

  it("lets a crawler read every one of them", () => {
    for (const { path, html } of drillPages()) {
      expect(html, path).not.toContain("noindex");
    }
  });
});

/**
 * A page written for one grade tells the app which one.
 *
 * Every theme page is a grade's page. A coach landing on "U9 rugby tackling
 * drills" out of a search and tapping through was asked which age group they
 * coach, which is the app forgetting the one thing it had just been told, at
 * the point in the funnel where it can least afford to.
 *
 * Only the call to action carries it. The chrome is identical on every page in
 * the product and the tests above hold it that way, because a header that
 * changed with the page would be the site's navigation arguing with itself.
 * A drill page is deliberately not in here either: a drill spans grades, so
 * seeding one off `minAge` would set a U12 coach to U7 for reading a warm-up.
 */
describe("a page that knows the grade hands it over", () => {
  it("puts it on the theme page's call to action", () => {
    for (const { theme, age } of themeGrades()) {
      const html = themePageHtml(theme, age, drillsFor(theme, age));
      expect(html, `${themePath(theme, age)}`).toContain(`href="/hub?age=${age}"`);
    }
  });

  it("leaves a drill page pointing at the drill and nothing else", () => {
    for (const drill of DRILLS) {
      const html = drillPageHtml(drill);
      expect(html, drillPath(drill)).toContain(`href="/hub#/catalogue/${drill.id}"`);
      expect(html, `${drillPath(drill)} guesses a grade`).not.toContain("/hub?age=");
    }
  });
});

describe("nothing is published where it cannot be found", () => {
  it("links every drill from at least one theme page", () => {
    // The sitemap is a hint rather than a route. A page with no link into it is
    // a page a crawler is entitled to ignore.
    const linked = new Set<string>();
    for (const { theme, age, drills } of themeGrades()) {
      const html = themePageHtml(theme, age, drills);
      for (const drill of DRILLS) {
        if (html.includes(`href="${drillPath(drill)}"`)) linked.add(drill.id);
      }
    }
    for (const drill of DRILLS) {
      expect(linked.has(drill.id), `${drill.title} is reachable only from the sitemap`).toBe(true);
    }
  });

  it("links every theme page from its own grade page and from the index", () => {
    const index = page("public/rugby-drills-by-age-group/index.html");
    for (const { theme, age } of themeGrades()) {
      const grade = page(`public/rugby-drills-${age}/index.html`);
      expect(grade, `${themePath(theme, age)} from the ${age} page`).toContain(
        `href="${themePath(theme, age)}"`,
      );
      expect(index, `${themePath(theme, age)} from the cluster index`).toContain(
        `href="${themePath(theme, age)}"`,
      );
    }
  });

  it("keeps no hand-written copy of a generated page", () => {
    // The trap the rules pages already fell into once. A copy under `public/`
    // is a second version of a drill, indexed, free to drift from the one the
    // app renders from the same data.
    for (const path of drillPagePaths()) {
      expect(existsSync(`public${path}`), path).toBe(false);
    }
  });
});

describe("the sitemap", () => {
  it("lists every page the build writes, and nothing it does not", () => {
    const listed = sitemapPaths();
    expect(new Set(listed).size, "duplicate url").toBe(listed.length);
    for (const path of [...rulesPagePaths(), ...drillPagePaths()]) {
      expect(listed, path).toContain(path);
    }
    // The other direction. A URL listed but never written is a 404 handed
    // straight to a crawler, which is worse than not listing it.
    for (const path of listed) {
      const generated = [...rulesPagePaths(), ...drillPagePaths()].includes(path);
      if (generated || path === "/" || path === "/hub" || path === "/planner") continue;
      expect(existsSync(`public${path}/index.html`), `${path} is listed but not written`).toBe(true);
    }
  });

  it("is well formed and absolute", () => {
    const xml = sitemapXml();
    const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(urls.length).toBe(sitemapPaths().length);
    for (const url of urls) expect(url.startsWith("https://equalplay.io/"), url).toBe(true);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml.trimEnd().endsWith("</urlset>")).toBe(true);
  });

  it("is not a file somebody has to remember to edit", () => {
    expect(existsSync("public/sitemap.xml"), "a second sitemap would win over the built one").toBe(
      false,
    );
  });

  it("is where robots.txt says it is", () => {
    expect(page("public/robots.txt")).toContain("Sitemap: https://equalplay.io/sitemap.xml");
  });
});

describe("a theme page gathers what it claims", () => {
  it("counts what it lists", () => {
    for (const { theme, age, drills } of themeGrades()) {
      expect(drills).toEqual(drillsFor(theme, age));
      expect(themePageHtml(theme, age, drills), themePath(theme, age)).toContain(
        `${drills.length} `,
      );
    }
  });

  it("offers no page with nothing on it", () => {
    for (const { theme, age, drills } of themeGrades()) {
      expect(drills.length, themePath(theme, age)).toBeGreaterThan(0);
    }
  });
});
