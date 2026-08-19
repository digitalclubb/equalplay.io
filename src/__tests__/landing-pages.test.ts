import { readFileSync } from "node:fs";
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

  it("links to every age page", () => {
    const html = page(CLUSTER);
    for (const age of AGE_GROUPS) {
      expect(html, age).toContain(`href="/rugby-drills-${age}"`);
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

  it("is in the sitemap, exactly once", () => {
    const sitemap = page("public/sitemap.xml");
    const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(new Set(urls).size, "duplicate url").toBe(urls.length);
    for (const age of AGE_GROUPS) {
      expect(urls, age).toContain(`https://equalplay.io/rugby-drills-${age}`);
    }
    expect(urls).toContain("https://equalplay.io/rugby-drills-by-age-group");
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
