import { existsSync, readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { DRILLS, filterDrills } from "../hub/content/drills.js";
import { PRESETS } from "../hub/content/presets.js";
import { rulesPageHtml, rulesIndexHtml, rulesPagePaths, rulesPath } from "../seo/rulesPage.js";
import { GUIDES } from "../hub/content/guides.js";
import { esc } from "../lib/esc.js";
import {
  AGE_GROUPS,
  AGE_GROUP_LABELS,
  HALF_GAME_RULE_URL,
  REGULATION_15_URL,
  RULES_OF_PLAY,
  rulesCheckedPhrase,
  THEMES,
  THEME_LABELS,
  type AgeGroup,
} from "../hub/content/types.js";

/**
 * The age group landing pages state counts that the catalogue owns.
 *
 * "74 drills" on the U10 page is true until somebody adds a drill, at which
 * point the page is quietly lying to a search engine about what is behind the
 * link. These are the only numbers on the site that live in two places, so this
 * is what stops them drifting apart. Same reason `homepage-faq.test.ts` exists.
 */

const page = (path: string): string => readFileSync(path, "utf8");

const agePage = (age: AgeGroup): string => page(`public/rugby-drills-${age}/index.html`);

const CLUSTER = "public/rugby-drills-by-age-group/index.html";

/** What a coach actually sees in the catalogue once they pick that grade. */
function drillsFor(age: AgeGroup) {
  return filterDrills(DRILLS, { ageGroup: age });
}

function presetsFor(age: AgeGroup) {
  return PRESETS.filter((preset) => preset.ageGroup === age);
}

describe("age group landing pages", () => {
  it("has a page for every age grade", () => {
    for (const age of AGE_GROUPS) {
      expect(agePage(age).length, age).toBeGreaterThan(1000);
    }
  });

  it("states the drill count the catalogue would show", () => {
    for (const age of AGE_GROUPS) {
      const drills = drillsFor(age);
      const warmups = drills.filter((drill) => drill.kind === "warmup").length;
      // Collapsed, because these numbers sit wherever the line happens to wrap.
      const html = agePage(age).replace(/\s+/g, " ");
      expect(html, `${age} total`).toContain(`${drills.length} drills`);
      expect(html, `${age} warm-ups`).toContain(`${warmups} warm-ups`);
      expect(html, `${age} exercises`).toContain(`${drills.length - warmups} exercises`);
    }
  });

  it("states the number of ready-made sessions there are", () => {
    for (const age of AGE_GROUPS) {
      const label = AGE_GROUP_LABELS[age];
      expect(agePage(age), `${age} sessions`).toContain(
        `${presetsFor(age).length} ready-made ${label} sessions`,
      );
    }
  });

  it("names the sessions that actually exist for that grade", () => {
    for (const age of AGE_GROUPS) {
      const html = agePage(age);
      for (const preset of presetsFor(age)) {
        expect(html, `${age}: ${preset.title}`).toContain(`<strong>${preset.title}</strong>`);
      }
    }
  });

  it("counts each theme the way the catalogue does", () => {
    for (const age of AGE_GROUPS) {
      const drills = drillsFor(age);
      const html = agePage(age);
      for (const theme of THEMES) {
        const count = drills.filter((drill) => drill.themes.includes(theme)).length;
        const row = `<tr><td>${THEME_LABELS[theme]}</td><td>${count}</td></tr>`;
        if (count === 0) {
          // A theme the grade cannot do has no row at all, rather than a zero.
          expect(html, `${age}: ${theme} should not be listed`).not.toContain(
            `<td>${THEME_LABELS[theme]}</td>`,
          );
        } else {
          expect(html, `${age}: ${theme}`).toContain(row);
        }
      }
    }
  });

  it("hands no minis grade a lineout", () => {
    // There is no lineout at any grade the hub covers. Reg 15 has touch restarting
    // with a free pass through U13, the uncontested lineout arriving at U14 and
    // lifting held back to U15. Seven pages said U12 until August 2026, and the
    // catalogue shipped four lineout drills to match. Saying "no lineout" is fine,
    // so this bans the claim rather than the word.
    // The lookbehind keeps "no lineout at U10" out of it. Denying one is the point.
    const CLAIMS =
      /(?<!no )(?<!not )lineouts? (?:from |at |arrives? at |starts? at |is introduced at )u(?:7|8|9|1[0-3])\b/i;
    for (const path of [
      "index.html",
      CLUSTER,
      ...AGE_GROUPS.map((age) => `public/rugby-drills-${age}/index.html`),
    ]) {
      const html = page(path).replace(/\s+/g, " ");
      expect(CLAIMS.test(html), `${path}: ${html.match(CLAIMS)?.[0]}`).toBe(false);
      expect(html, `${path} lists a lineout theme row`).not.toContain("<td>Scrum and lineout</td>");
    }
  });

  it("links each grade to its own RFU appendix", () => {
    for (const age of AGE_GROUPS) {
      expect(agePage(age), age).toContain(RULES_OF_PLAY[age]);
    }
  });

  it("claims no theme the grade is not allowed", () => {
    // The safety line the whole product turns on, restated where a search engine
    // can see it. A U8 page must never say the word ruck as something they do.
    for (const age of AGE_GROUPS) {
      const drills = drillsFor(age);
      const html = agePage(age);
      for (const theme of THEMES) {
        if (drills.some((drill) => drill.themes.includes(theme))) continue;
        expect(html, `${age} lists ${theme} in its table`).not.toContain(
          `<td>${THEME_LABELS[theme]}</td>`,
        );
      }
    }
  });
});

describe("the drills by age group page", () => {
  it("gives every grade a row that matches the catalogue", () => {
    const html = page(CLUSTER).replace(/\s+/g, " ");
    for (const age of AGE_GROUPS) {
      const drills = drillsFor(age).length;
      const sessions = presetsFor(age).length;
      expect(html, `${age} row`).toContain(`<td>${drills}</td> <td>${sessions}</td>`);
    }
  });

  it("says the same count in its cards as in its table", () => {
    // Two places on one page, so the table can be right while the cards below it
    // have quietly gone stale.
    const html = page(CLUSTER).replace(/\s+/g, " ");
    for (const age of AGE_GROUPS) {
      expect(html, `${age} card`).toContain(`${drillsFor(age).length} drills ready for the grade`);
    }
  });

  it("links to every age page", () => {
    const html = page(CLUSTER);
    for (const age of AGE_GROUPS) {
      expect(html, age).toContain(`href="/rugby-drills-${age}"`);
    }
  });
});

describe("the marketing pages reach the guides", () => {
  /**
   * The guide is hub content, in the bundle, so the Guide tab opens with no
   * signal. `/hub` is `noindex` though, so the same words are also emitted as a
   * static page per grade at build time from `hub/content/guides.ts`. That is
   * what a search engine reads, and what the drills cluster links across to.
   *
   * Generated rather than committed. A copy in `public/` would be a second
   * source of truth going stale in the repository, which is what the last
   * assertion in here is still guarding against.
   */

  it("links each grade's rules page from that grade's drills page", () => {
    for (const age of AGE_GROUPS) {
      expect(agePage(age), age).toContain(`href="/rugby-rules-${age}"`);
    }
  });

  it("links every grade's rules page from the cluster page", () => {
    const html = page(CLUSTER);
    for (const age of AGE_GROUPS) {
      expect(html, age).toContain(`href="/rugby-rules-${age}"`);
    }
  });

  it("keeps no hand-written copy of a generated page", () => {
    // They shipped as hand-written `public/rugby-rules-*` for one commit. A copy
    // there now would be a second version of every age grade claim, indexed and
    // free to drift away from the guide the build renders from.
    expect(existsSync("public/rugby-rules-by-age-group"), "guide index").toBe(false);
    for (const age of AGE_GROUPS) {
      expect(existsSync(`public/rugby-rules-${age}`), age).toBe(false);
    }
  });
});

describe("every static page reaches the product", () => {
  const PAGES = [
    "index.html",
    CLUSTER,
    ...AGE_GROUPS.map((age) => `public/rugby-drills-${age}/index.html`),
    "public/rugby-substitution-app/index.html",
    "public/equal-playing-time-calculator/index.html",
    "public/rfu-regulation-15-playing-time/index.html",
  ];

  it("points its header at the app rather than at one half of it", () => {
    // The three match-day pages used to send every visitor to /planner, which is
    // how the whole site came to read as a substitution app with a drill
    // catalogue bolted on. The chrome belongs to the product.
    for (const path of PAGES) {
      expect(page(path), path).toContain('<a class="header-cta" href="/hub">');
    }
  });

  it("keeps the two words of the logo in one flex item", () => {
    // `.brand` is a flex row, so a bare "Equal" next to <span>Play</span> is two
    // items with the whitespace between them trimmed away. The 0.6rem gap then
    // prints where the space should be: 0.44em on the homepage against the hub's
    // 0.176em for the same mark.
    for (const path of [...PAGES, "public/privacy/index.html"]) {
      expect(page(path), path).toContain('<span class="brand-text">Equal <span>Play</span></span>');
    }
    // The wrapper is what carries the orange word now. Rename it on one side only
    // and "Play" goes white on navy across all twelve with this test still green.
    expect(page("public/pages.css")).toContain(".brand-text span");
  });

  it("honours a scheme the app forced, before the stylesheet", () => {
    // A coach who picked Light on a dark phone taps a footer link out of the
    // hub. Without this the page they land on is dark and the one they came
    // from was not. Before the stylesheet, or it flashes the other one first.
    for (const path of [...PAGES, "public/privacy/index.html"]) {
      const html = page(path);
      const script = html.indexOf("equalplay_scheme");
      expect(script, `${path} ignores the chosen scheme`).toBeGreaterThan(-1);
      expect(script, `${path} reads it too late`).toBeLessThan(html.indexOf('rel="stylesheet"'));
    }
  });

  it("carries the same footer", () => {
    for (const path of PAGES) {
      const html = page(path);
      expect(html, `${path}: hub`).toContain('<li><a href="/hub">Open Equal Play</a></li>');
      expect(html, `${path}: drills`).toContain(
        '<li><a href="/rugby-drills-by-age-group">Rugby drills by age group</a></li>',
      );
      expect(html, `${path}: rules`).toContain(
        '<li><a href="/rugby-rules-by-age-group">Rugby rules by age group</a></li>',
      );
      expect(html, `${path}: privacy`).toContain('<li><a href="/privacy">Privacy</a></li>');
    }
  });

  it("states the catalogue total the catalogue actually has", () => {
    // "100 drills" is repeated across the homepage and the match-day pages with
    // nothing tying it to DRILLS. It is the number most likely to move. These
    // are the pages that talk about the catalogue as a whole rather than
    // about one grade, so every count on them is the total or it is wrong.
    const TALKS_ABOUT_THE_WHOLE_CATALOGUE = [
      "index.html",
      "public/rugby-substitution-app/index.html",
      "public/equal-playing-time-calculator/index.html",
      "public/rfu-regulation-15-playing-time/index.html",
    ];
    for (const path of TALKS_ABOUT_THE_WHOLE_CATALOGUE) {
      const html = page(path).replace(/\s+/g, " ");
      const claims = html.match(/\b\d+ drills\b/g) ?? [];
      expect(claims.length, `${path} states no drill count at all`).toBeGreaterThan(0);
      for (const claim of claims) {
        expect(Number(claim.split(" ")[0]), `${path}: "${claim}"`).toBe(DRILLS.length);
      }
    }
  });

  it("quotes one Half Game Rule link rather than two hand-typed ones", () => {
    // Same discipline as RULES_OF_PLAY. The rule is the floor on playing time
    // and the RFU's explainer is the source, so the URL lives in one constant
    // and these pages are held to it.
    for (const path of [
      "public/rfu-regulation-15-playing-time/index.html",
      "public/equal-playing-time-calculator/index.html",
    ]) {
      expect(page(path), path).toContain(HALF_GAME_RULE_URL);
    }
  });

  it("dates the rules claims it makes by hand", () => {
    // The guide and its static twin carry the date already, because they are
    // generated from one source. These are typed out, which is exactly why they
    // are the ones that go stale unnoticed.
    //
    // Name the regulation, date the reading. Selecting these by the "not
    // affiliated" disclaimer instead let two pages through: the calculator
    // states the Half Game Rule in full and the substitution page states how
    // the two limits are structured, and neither carries that line.
    const named = PAGES.filter((path) => page(path).includes("Regulation 15"));
    expect(named.length, "no page names the regulation").toBeGreaterThan(5);
    for (const path of named) {
      expect(page(path), path).toContain(rulesCheckedPhrase());
    }
  });

  it("is in the sitemap, exactly once", () => {
    const sitemap = page("public/sitemap.xml");
    const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(new Set(urls).size, "duplicate url").toBe(urls.length);
    for (const age of AGE_GROUPS) {
      expect(urls, age).toContain(`https://equalplay.io/rugby-drills-${age}`);
    }
    expect(urls).toContain("https://equalplay.io/rugby-drills-by-age-group");
    // The rules pages are emitted at build rather than living in `public/`, so
    // nothing here would catch a missing one except this.
    for (const path of rulesPagePaths()) {
      expect(urls, path).toContain(`https://equalplay.io${path}`);
    }
    expect(urls).toContain("https://equalplay.io/");
  });
});

describe("structured data on the static pages", () => {
  const WITH_LD = [
    CLUSTER,
    ...AGE_GROUPS.map((age) => `public/rugby-drills-${age}/index.html`),
    "public/rugby-substitution-app/index.html",
    "public/rfu-regulation-15-playing-time/index.html",
    "public/equal-playing-time-calculator/index.html",
  ];

  /** The questions a page asks out loud, so the JSON-LD can be held to them. */
  function questionsOnPage(html: string): string[] {
    return [...html.matchAll(/<h3>([^<]+\?)<\/h3>/g)].map((m) => m[1]);
  }

  const strip = (fragment: string): string =>
    fragment.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

  /** Each visible question with the paragraph under it. */
  function answersOnPage(html: string): Array<[string, string]> {
    return [...html.matchAll(/<h3>([^<]+\?)<\/h3>\s*<p>([\s\S]*?)<\/p>/g)].map((m) => [
      m[1],
      strip(m[2]),
    ]);
  }

  function faqEntity(html: string): Array<{ name: string; acceptedAnswer: { text: string } }> {
    const block = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    if (!block) throw new Error("no JSON-LD");
    const parsed = JSON.parse(block[1]);
    const nodes = parsed["@graph"] ?? [parsed];
    const faq = nodes.find((node: { "@type": string }) => node["@type"] === "FAQPage");
    return faq ? faq.mainEntity : [];
  }

  function faqQuestions(html: string): string[] {
    const block = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    if (!block) throw new Error("no JSON-LD");
    const parsed = JSON.parse(block[1]);
    const nodes = parsed["@graph"] ?? [parsed];
    const faq = nodes.find((node: { "@type": string }) => node["@type"] === "FAQPage");
    return faq ? faq.mainEntity.map((q: { name: string }) => q.name) : [];
  }

  it("parses", () => {
    for (const path of WITH_LD) {
      const block = page(path).match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
      expect(block, path).not.toBeNull();
      expect(() => JSON.parse(block![1]), path).not.toThrow();
    }
  });

  it("asks the questions the page asks, in the same order", () => {
    // Google drops the rich result when the two disagree. A page that gets
    // edited without its JSON-LD is the way that happens.
    for (const path of WITH_LD) {
      const html = page(path);
      expect(faqQuestions(html), path).toEqual(questionsOnPage(html));
    }
  });

  it("gives the answers the page gives", () => {
    for (const path of WITH_LD) {
      const html = page(path);
      const onPage = new Map(answersOnPage(html));
      for (const entry of faqEntity(html)) {
        expect(entry.acceptedAnswer.text, `${path}: answer to "${entry.name}"`).toBe(
          onPage.get(entry.name),
        );
      }
    }
  });

  it("gives every page a canonical of its own", () => {
    const seen = new Set<string>();
    for (const path of WITH_LD) {
      const canonical = page(path).match(/rel="canonical" href="([^"]+)"/);
      expect(canonical, path).not.toBeNull();
      expect(seen.has(canonical![1]), `${path}: duplicate canonical`).toBe(false);
      seen.add(canonical![1]);
    }
  });
});

/**
 * The rules pages a search engine reads.
 *
 * Rendered here from the same function the build calls, so these check the
 * pages that actually ship rather than a copy of them. The guide itself stays
 * hub content: `guides.test.ts` holds what it says, and this holds that a
 * static page carries it, points at the product and can be found.
 */
describe("the generated rules pages", () => {
  const pages = (): Array<{ path: string; html: string }> => [
    { path: "/rugby-rules-by-age-group", html: rulesIndexHtml() },
    ...AGE_GROUPS.map((age) => ({ path: rulesPath(age), html: rulesPageHtml(age) })),
  ];

  it("renders one per grade plus an index, and says so in one place", () => {
    expect(rulesPagePaths().sort()).toEqual(pages().map((p) => p.path).sort());
  });

  it("says what the guide says rather than a second version of it", () => {
    for (const age of AGE_GROUPS) {
      const html = rulesPageHtml(age);
      const guide = GUIDES[age];
      expect(html, age).toContain(guide.title);
      // Every question the guide answers is on the page, so the FAQ markup below
      // can never claim something a reader cannot see
      for (const faq of guide.faqs) {
        expect(html, `${age}: ${faq.question}`).toContain(faq.question);
      }
    }
  });

  it("carries the chrome that belongs to the product", () => {
    for (const { path, html } of pages()) {
      expect(html, `${path}: header`).toContain('<a class="header-cta" href="/hub">');
      expect(html, `${path}: canonical`).toContain(`<link rel="canonical" href="https://equalplay.io${path}" />`);
      expect(html, `${path}: logo`).toContain('<span class="brand-text">Equal <span>Play</span></span>');
      expect(html, `${path}: footer`).toContain('<li><a href="/privacy">Privacy</a></li>');
      expect(html, `${path}: one h1`).toMatch(/<h1>/);
      expect((html.match(/<h1>/g) ?? []).length, `${path}: h1 count`).toBe(1);
    }
  });

  it("escapes the description once rather than twice", () => {
    // Every field goes into `page()` raw and is escaped there. Escaping one on
    // the way in ships &amp;#39; to a reader the first time a blurb has an
    // apostrophe in it, on three meta tags at once.
    for (const { path, html } of pages()) {
      const metas = [...html.matchAll(/content="([^"]*)"/g)].map((m) => m[1]);
      for (const value of metas) {
        expect(value, `${path}: double escaped`).not.toMatch(/&(amp|lt|gt|quot|#39);(amp|lt|gt|quot|#\d)/);
      }
    }
  });

  it("names the first column of a table that has a name for it", () => {
    // The first column usually heads the rows and is left blank, which wants a
    // label only a screen reader hears. The arrivals table calls it Grade, and
    // substituting unconditionally left an empty cell on screen with "Row" read
    // out in place of the word that belongs there.
    const index = rulesIndexHtml();
    expect(index).toContain("<th scope=\"col\">Grade</th>");
    expect(index).toContain("<th scope=\"col\">What arrives</th>");
  });

  it("honours a forced scheme like the rest of the site", () => {
    for (const { path, html } of pages()) {
      const script = html.indexOf("equalplay_scheme");
      expect(script, `${path} ignores the chosen scheme`).toBeGreaterThan(-1);
      expect(script, `${path} reads it too late`).toBeLessThan(html.indexOf('rel="stylesheet"'));
    }
  });

  it("is indexable, unlike the hub the same words live in", () => {
    for (const { path, html } of pages()) {
      expect(html, path).not.toContain("noindex");
    }
  });

  it("only claims an FAQ where the answers are on the page", () => {
    for (const { path, html } of pages()) {
      const block = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
      expect(block, `${path}: no structured data`).not.toBeNull();
      const data = JSON.parse((block as RegExpMatchArray)[1].split("\\u003c").join("<"));
      const faq = data["@graph"].find((node: { "@type": string }) => node["@type"] === "FAQPage");
      if (!faq) continue;
      for (const entry of faq.mainEntity) {
        // The structured data holds the text raw, because it is JSON. The page
        // holds it escaped, because it is markup. Same words either way, which
        // is the thing worth checking: Google will not show an answer it cannot
        // find on the page.
        expect(html, `${path}: ${entry.name}`).toContain(esc(entry.name));
        expect(html, `${path}: answer`).toContain(esc(entry.acceptedAnswer.text));
      }
    }
  });

  it("dates itself against the season it was written from", () => {
    // The same line the hub guide carries. A static page is the copy a search
    // engine keeps, so an undated one outlives the season it was true for.
    for (const { path, html } of pages()) {
      expect(html, path).toContain(rulesCheckedPhrase());
    }
  });

  it("links out to the RFU rather than passing the rules off as ours", () => {
    for (const age of AGE_GROUPS) {
      const html = rulesPageHtml(age);
      expect(html, age).toContain(RULES_OF_PLAY[age]);
      expect(html, age).toContain("not affiliated with the RFU");
    }
    expect(rulesIndexHtml()).toContain(REGULATION_15_URL);
  });

  it("never claims a lineout at a grade that has none", () => {
    // Same claim the drills cluster is held to. Seven pages said U12 once.
    for (const { path, html } of pages()) {
      expect(html.replace(/\s+/g, " "), path).not.toMatch(/lineout (at|from|arrives at) U1[0-3]\b/i);
    }
  });

  it("sends a reader on into the app and across to the drills", () => {
    for (const age of AGE_GROUPS) {
      const html = rulesPageHtml(age);
      expect(html, `${age}: app`).toContain(`href="/hub#/guide/${age}"`);
      expect(html, `${age}: drills`).toContain(`href="/rugby-drills-${age}"`);
    }
  });
});
