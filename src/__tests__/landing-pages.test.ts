import { existsSync, readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { DRILLS, filterDrills } from "../hub/content/drills.js";
import { PRESETS } from "../hub/content/presets.js";
import {
  AGE_GROUPS,
  AGE_GROUP_LABELS,
  RULES_OF_PLAY,
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
      expect(html, `${age} card`).toContain(`${drillsFor(age).length} drills the grade is allowed`);
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
   * The guides are a hub route rather than static pages, so the only thing the
   * marketing site owes them is a way in. Somebody who lands on the U9 drills
   * page from a search is exactly who wants the U9 rules, and `/hub` is noindex
   * so nothing else will send them there.
   */
  it("links each grade's guide from that grade's drills page", () => {
    for (const age of AGE_GROUPS) {
      expect(agePage(age), age).toContain(`href="/hub#/guide/${age}"`);
    }
  });

  it("links every grade's guide from the cluster page", () => {
    const html = page(CLUSTER);
    for (const age of AGE_GROUPS) {
      expect(html, age).toContain(`href="/hub#/guide/${age}"`);
    }
  });

  it("has no static guide pages left behind", () => {
    // They shipped as `public/rugby-rules-*` for one commit. A stray copy would
    // be a second version of every age grade claim, indexed, drifting.
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

  it("carries the same footer", () => {
    for (const path of PAGES) {
      const html = page(path);
      expect(html, `${path}: hub`).toContain('<li><a href="/hub">Open Equal Play</a></li>');
      expect(html, `${path}: drills`).toContain(
        '<li><a href="/rugby-drills-by-age-group">Rugby drills by age group</a></li>',
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

  it("is in the sitemap, exactly once", () => {
    const sitemap = page("public/sitemap.xml");
    const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(new Set(urls).size, "duplicate url").toBe(urls.length);
    for (const age of AGE_GROUPS) {
      expect(urls, age).toContain(`https://equalplay.io/rugby-drills-${age}`);
    }
    expect(urls).toContain("https://equalplay.io/rugby-drills-by-age-group");
    // The guides live at #/guide inside the hub, which is noindex, so nothing
    // about them belongs in here.
    expect(urls.filter((u) => u.includes("rugby-rules")), "guides in the sitemap").toEqual([]);
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
