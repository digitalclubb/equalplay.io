import { describe, it, expect, beforeEach } from "vitest";
import { existsSync } from "node:fs";
import {
  COACHING_GUIDES,
  COACHING_SOURCE_NOTE,
  coachingGuide,
  coachingGuideForTheme,
  coachingPath,
} from "../hub/content/coaching.js";
import { DRILLS } from "../hub/content/drills.js";
import { esc } from "../lib/esc.js";
import { renderGuide } from "../hub/views/guide.js";
import { coachingPageHtml, coachingPagePaths, coachingPages } from "../seo/coachingPage.js";
import { rulesIndexHtml } from "../seo/rulesPage.js";
import { themePageHtml, drillsFor, themePath } from "../seo/drillPage.js";
import { sitemapPaths } from "../seo/sitemap.js";
import {
  AGE_GROUPS,
  THEMES,
  THEME_MIN_AGE,
  ageAtLeast,
  isAvailableAt,
  rulesCheckedPhrase,
  type Theme,
} from "../hub/content/types.js";

/**
 * The coaching guides. How to teach a scrum, rather than what a scrum is
 * allowed to be.
 *
 * Held to the same things the rules guides are, because they make the same
 * class of claim in the same voice on the same tab. Two extra things matter
 * here. A guide points at drills by id, so an id with no drill behind it is a
 * dead link on a page a coach reached from a search. And a guide exists for a
 * phase of play, so which phases have one cannot be a list somebody typed: it
 * comes off `THEME_MIN_AGE`, the same table the age gate runs on.
 */

/** Every string a coach can read, flattened, with a label for the failure. */
function coachingCopy(): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const guide of COACHING_GUIDES) {
    const at = (part: string): string => `${guide.slug} ${part}`;
    out.push([at("title"), guide.title]);
    out.push([at("blurb"), guide.blurb]);
    out.push([at("standfirst"), guide.standfirst]);
    guide.sections.forEach((section, s) => {
      out.push([at(`section[${s}] heading`), section.heading]);
      section.blocks.forEach((block, b) => {
        const where = at(`section[${s}].blocks[${b}]`);
        if ("subheading" in block) out.push([where, block.subheading]);
        else if ("text" in block) out.push([where, block.text]);
        else if ("table" in block) {
          out.push([`${where} caption`, block.table.caption]);
          for (const cell of [...block.table.head, ...block.table.rows.flat()]) {
            out.push([where, cell]);
          }
        } else if ("items" in block) {
          for (const item of block.items) {
            if (item.lead) out.push([`${where} lead`, item.lead]);
            out.push([where, item.text]);
          }
        }
      });
    });
    guide.faqs.forEach((faq, f) => {
      out.push([at(`faqs[${f}].question`), faq.question]);
      out.push([at(`faqs[${f}].answer`), faq.answer]);
    });
  }
  return out;
}

/** Every drill a guide points at, with the guide that points at it. */
function referenced(): Array<[string, string]> {
  return COACHING_GUIDES.flatMap((guide) =>
    guide.sections.flatMap((section) =>
      section.blocks.flatMap((block) =>
        "drills" in block ? block.drills.map((id) => [guide.slug, id] as [string, string]) : [],
      ),
    ),
  );
}

describe("which phases of play get a coaching guide", () => {
  /**
   * The rule rather than a list. A theme whose floor is above U7 is a theme
   * that arrives part way through the minis game, which is exactly the thing a
   * volunteer has never been taught. Handling and evasion need no guide of this
   * kind: a parent who never played can still see what a pass should look like.
   */
  it("has one for every theme the game lets in part way through, and no others", () => {
    const arriving = THEMES.filter((theme) => THEME_MIN_AGE[theme] !== "u7");
    expect([...COACHING_GUIDES].map((guide) => guide.theme).sort()).toEqual([...arriving].sort());
    for (const theme of arriving) {
      expect(coachingGuideForTheme(theme as Theme), theme).toBeTruthy();
    }
  });

  it("gives each one an address of its own", () => {
    const slugs = COACHING_GUIDES.map((guide) => guide.slug);
    expect(new Set(slugs).size, "two guides share a slug").toBe(slugs.length);
    for (const slug of slugs) expect(slug, slug).toMatch(/^[a-z]+$/);
    for (const guide of COACHING_GUIDES) {
      expect(coachingGuide(guide.slug)).toBe(guide);
      expect(coachingPath(guide)).toBe(`/how-to-teach-rugby-${guide.slug}`);
    }
  });

  it("looks up nothing for a slug nobody wrote", () => {
    // Off a Map rather than an object, so the inherited members of an object
    // literal cannot come back as a guide. Same trap as the theme tables.
    expect(coachingGuide(undefined)).toBeUndefined();
    expect(coachingGuide("constructor")).toBeUndefined();
    expect(coachingGuide("toString")).toBeUndefined();
    expect(coachingGuide("lineout")).toBeUndefined();
  });
});

describe("coaching guide content", () => {
  it("gives every guide enough to be worth opening", () => {
    for (const guide of COACHING_GUIDES) {
      expect(guide.title.length, `${guide.slug} title`).toBeGreaterThan(10);
      expect(guide.blurb.length, `${guide.slug} blurb`).toBeGreaterThan(40);
      expect(guide.standfirst.length, `${guide.slug} standfirst`).toBeGreaterThan(80);
      expect(guide.sections.length, `${guide.slug} sections`).toBeGreaterThan(4);
      expect(guide.faqs.length, `${guide.slug} faqs`).toBeGreaterThan(2);
      for (const [i, section] of guide.sections.entries()) {
        expect(section.heading.trim(), `${guide.slug} section ${i}`).not.toBe("");
        expect(section.blocks.length, `${guide.slug} "${section.heading}" is empty`).toBeGreaterThan(
          0,
        );
      }
    }
  });

  it("holds plain text, with no markup in it", () => {
    for (const [where, text] of coachingCopy()) {
      expect(/<[a-z/]/i.test(text), `${where}: "${text}" contains markup`).toBe(false);
      expect(text.includes("&"), `${where}: "${text}" contains an entity`).toBe(false);
    }
  });

  it("keeps every table rectangular", () => {
    const tables = COACHING_GUIDES.flatMap((guide) =>
      guide.sections.flatMap((section) =>
        section.blocks.flatMap((block) =>
          "table" in block ? [[`${guide.slug} "${section.heading}"`, block.table] as const] : [],
        ),
      ),
    );
    expect(tables.length, "no tables found").toBeGreaterThan(3);
    for (const [where, table] of tables) {
      expect(table.rows.length, `${where} has no rows`).toBeGreaterThan(0);
      for (const [i, row] of table.rows.entries()) {
        expect(row.length, `${where} row ${i} is a different width to its head`).toBe(
          table.head.length,
        );
      }
    }
  });

  it("ends every question with a question mark", () => {
    for (const guide of COACHING_GUIDES) {
      for (const faq of guide.faqs) {
        expect(faq.question.endsWith("?"), `${guide.slug}: "${faq.question}"`).toBe(true);
        expect(faq.answer.length, `${guide.slug}: "${faq.question}" has no answer`).toBeGreaterThan(
          40,
        );
      }
    }
  });

  it("gives every standfirst and every blurb an ending of its own", () => {
    // The failure the rules guides already had: five of six closing on the same
    // six words. Invisible one page at a time, obvious on an index of four.
    const tail = (s: string): string =>
      s.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/).slice(-3).join(" ");
    for (const field of ["standfirst", "blurb"] as const) {
      const seen = new Map<string, string>();
      for (const guide of COACHING_GUIDES) {
        const end = tail(guide[field]);
        expect(seen.get(end), `${guide.slug} ${field} ends "${end}", same as ${seen.get(end)}`)
          .toBeUndefined();
        seen.set(end, guide.slug);
      }
    }
  });

  it("hands no minis grade a lineout", () => {
    // The same guard the rules guides carry. A page called "how to teach the
    // set piece" is the likeliest place in the product for this to come back.
    const CLAIM =
      /(?<!no )(?<!not )lineouts? (?:from |at |arrives? at |starts? at |is introduced at )u(?:7|8|9|1[0-3])\b/i;
    for (const [where, text] of coachingCopy()) {
      expect(CLAIM.test(text), `${where}: "${text}"`).toBe(false);
    }
  });

  it("never says anybody pushes in a scrum", () => {
    // Nobody pushes at any grade the hub covers. The set piece theme tips got
    // this wrong on their first draft, so the guide that teaches the scrum is
    // held to it too.
    const scrum = coachingGuideForTheme("setpiece");
    expect(scrum).toBeTruthy();
    const words = JSON.stringify(scrum).toLowerCase();
    expect(words).toContain("nobody pushes");
    expect(/\bdrive (?:the )?(?:scrum|them off)/.test(words), "teaching a shove").toBe(false);
  });
});

describe("the drills a guide points at", () => {
  it("points at some", () => {
    expect(referenced().length).toBeGreaterThan(15);
    for (const guide of COACHING_GUIDES) {
      const mine = referenced().filter(([slug]) => slug === guide.slug);
      expect(mine.length, `${guide.slug} points at no drills at all`).toBeGreaterThan(0);
    }
  });

  it("points at drills that exist", () => {
    // The whole reason ids are checked here rather than trusted: a renamed
    // drill is a dead link on a page a coach reached from a search, and the
    // renderer drops it silently rather than showing them a broken one.
    for (const [slug, id] of referenced()) {
      expect(
        DRILLS.some((drill) => drill.id === id),
        `${slug} points at "${id}", which is not in the catalogue`,
      ).toBe(true);
    }
  });

  it("points at no drill nobody reading the guide could run", () => {
    // A guide says "from U10" at the top of it, so every drill under it has to
    // be one somebody at that grade or above can actually do. Earlier work is
    // fine and wanted: placement is taught at U9 and it is what rucking stands
    // on. What this catches is a drill capped below the floor, which is a
    // progression pointing at something none of its readers may ever run.
    for (const guide of COACHING_GUIDES) {
      const floor = THEME_MIN_AGE[guide.theme];
      const grades = AGE_GROUPS.filter((age) => ageAtLeast(age, floor));
      for (const [, id] of referenced().filter(([slug]) => slug === guide.slug)) {
        const drill = DRILLS.find((one) => one.id === id);
        expect(
          drill && grades.some((age) => isAvailableAt(drill, age)),
          `${guide.slug} points at ${id}, which no grade from ${floor} up may do`,
        ).toBe(true);
      }
    }
  });
});

describe("the coaching guide in the hub", () => {
  let container: HTMLElement;

  beforeEach(() => {
    window.location.hash = "";
    container = document.createElement("div");
    document.body.replaceChildren(container);
  });

  it("lists every one of them on the guide index", () => {
    renderGuide(container, undefined);
    const links = [...container.querySelectorAll<HTMLAnchorElement>(".guide-card.is-coaching")].map(
      (a) => a.getAttribute("href"),
    );
    expect(links).toEqual(COACHING_GUIDES.map((guide) => `#/guide/${guide.slug}`));
  });

  it("renders each one at its own route", () => {
    for (const guide of COACHING_GUIDES) {
      renderGuide(container, guide.slug);
      expect(container.textContent, guide.slug).toContain(guide.title);
      expect(container.textContent, guide.slug).toContain(guide.standfirst);
      expect(container.querySelectorAll(".guide-card"), guide.slug).toHaveLength(0);
    }
  });

  /**
   * The guide is the one route the age gate does not touch, and that has to
   * hold for these as well. A U8 coach reading how to teach a tackle in August,
   * before they go up in September, is the coach this was written for.
   */
  it("shows a guide for a phase the coach's own grade cannot do yet", () => {
    renderGuide(container, "scrums", "u8");
    expect(container.textContent).toContain("How to teach the scrum from scratch");
  });

  it("links the drills behind a progression, by their own titles", () => {
    renderGuide(container, "tackling");
    const links = [...container.querySelectorAll<HTMLAnchorElement>(".guide-drills a")];
    expect(links.length).toBeGreaterThan(3);
    for (const link of links) {
      const id = link.getAttribute("href")?.replace("#/catalogue/", "") ?? "";
      const drill = DRILLS.find((one) => one.id === id);
      expect(drill, `no drill behind ${id}`).toBeTruthy();
      expect(link.textContent?.trim()).toBe(drill?.title);
    }
  });

  it("says it is ours rather than the RFU's", () => {
    // The rules guides carry a note saying the words came from Regulation 15.
    // These must not: the rules inside them are the RFU's, the order to teach
    // them in is ours, and a coach deciding what to trust needs that said.
    for (const guide of COACHING_GUIDES) {
      renderGuide(container, guide.slug);
      expect(container.textContent, guide.slug).toContain(COACHING_SOURCE_NOTE);
      expect(container.textContent, guide.slug).toContain(rulesCheckedPhrase());
    }
  });

  it("falls back to the index rather than breaking on a slug nobody wrote", () => {
    renderGuide(container, "lineouts");
    expect(container.querySelectorAll(".guide-card").length).toBeGreaterThan(AGE_GROUPS.length);
  });

  it("escapes what it renders", () => {
    renderGuide(container, "rucking");
    expect(container.textContent).not.toContain("&amp;");
    expect(container.querySelector(".guide")).toBeTruthy();
  });
});

describe("the coaching guides as static pages", () => {
  const pages = new Map(coachingPages().map((one) => [one.path, one.html]));

  it("writes one page per guide", () => {
    expect([...pages.keys()]).toEqual(coachingPagePaths());
    expect(pages.size).toBe(COACHING_GUIDES.length);
  });

  it("says the same words the app says", () => {
    for (const guide of COACHING_GUIDES) {
      const html = coachingPageHtml(guide);
      // Escaped, because that is what the page holds. An apostrophe reaches it
      // as an entity and the content module is deliberately plain text.
      expect(html, guide.slug).toContain(esc(guide.standfirst));
      for (const section of guide.sections) {
        expect(html, guide.slug).toContain(esc(section.heading));
      }
      for (const faq of guide.faqs) expect(html, guide.slug).toContain(esc(faq.question));
    }
  });

  it("points its chrome at the product and its drills at their own pages", () => {
    for (const guide of COACHING_GUIDES) {
      const html = coachingPageHtml(guide);
      expect(html, guide.slug).toContain(`href="/hub?age=${THEME_MIN_AGE[guide.theme]}`);
      // Never a hub route for a drill. Whoever opens this has no account and has
      // picked no grade, so `#/catalogue/<id>` would ask them which age group
      // they coach before showing them the drill.
      expect(html.includes("#/catalogue/"), `${guide.slug} links a hub drill route`).toBe(false);
    }
  });

  it("is listed in the sitemap, once each", () => {
    const listed = sitemapPaths();
    for (const path of coachingPagePaths()) expect(listed, path).toContain(path);
    expect(new Set(listed).size).toBe(listed.length);
  });

  it("keeps no hand-written copy of one", () => {
    for (const path of coachingPagePaths()) {
      expect(existsSync(`public${path}`), path).toBe(false);
    }
  });

  /**
   * A page with no link into it is a page a crawler is entitled to ignore, and
   * a coach will never meet. Two ways in: the rules index, which is the cluster
   * this belongs to, and the drills page for the phase it teaches, which is
   * where somebody who searched for "u10 scrum drills" actually lands.
   */
  it("is linked from the rules index and from the drills it teaches", () => {
    const index = rulesIndexHtml();
    for (const guide of COACHING_GUIDES) {
      expect(index, `${guide.slug} from the rules index`).toContain(
        `href="${coachingPath(guide)}"`,
      );

      const grades = AGE_GROUPS.filter(
        (age) =>
          ageAtLeast(age, THEME_MIN_AGE[guide.theme]) && drillsFor(guide.theme, age).length > 0,
      );
      expect(grades.length, `${guide.theme} has no drill pages`).toBeGreaterThan(0);
      for (const age of grades) {
        const html = themePageHtml(guide.theme, age, drillsFor(guide.theme, age));
        expect(html, `${guide.slug} from ${themePath(guide.theme, age)}`).toContain(
          `href="${coachingPath(guide)}"`,
        );
      }
    }
  });
});
