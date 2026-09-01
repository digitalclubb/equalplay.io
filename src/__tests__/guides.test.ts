import { describe, it, expect, beforeEach } from "vitest";
import { ARRIVALS, GUIDES, GUIDE_BLURB, type GuideBlock } from "../hub/content/guides.js";
import { renderGuide } from "../hub/views/guide.js";
import {
  AGE_GROUPS,
  AGE_GROUP_LABELS,
  RULES_CHECKED,
  RULES_OF_PLAY,
  rulesCheckedPhrase,
  type AgeGroup,
} from "../hub/content/types.js";

/**
 * The rules guides say what Regulation 15 allows. That is the same class of
 * claim the age gate is built on, so it gets the same treatment: held to the
 * catalogue's own age grades, cross-checked where the same fact is written
 * twice, and stopped from claiming a phase of play no minis grade has.
 */

/** Every string a coach can read, flattened, with a label for the failure. */
function guideCopy(): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const age of AGE_GROUPS) {
    const guide = GUIDES[age];
    const at = (part: string): string => `${age} ${part}`;
    out.push([at("title"), guide.title]);
    out.push([at("standfirst"), guide.standfirst]);
    out.push([at("blurb"), GUIDE_BLURB[age]]);
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
        } else {
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

describe("guide content", () => {
  it("has a guide for every age grade the hub covers", () => {
    for (const age of AGE_GROUPS) {
      const guide = GUIDES[age];
      expect(guide, age).toBeTruthy();
      expect(guide.ageGroup, `${age} is filed under the wrong key`).toBe(age);
      expect(guide.title.length, `${age} title`).toBeGreaterThan(5);
      expect(guide.standfirst.length, `${age} standfirst`).toBeGreaterThan(80);
      expect(guide.sections.length, `${age} sections`).toBeGreaterThan(3);
      expect(guide.faqs.length, `${age} faqs`).toBeGreaterThan(3);
    }
  });

  it("gives every section a heading and something under it", () => {
    for (const age of AGE_GROUPS) {
      for (const [i, section] of GUIDES[age].sections.entries()) {
        expect(section.heading.trim(), `${age} section ${i}`).not.toBe("");
        expect(section.blocks.length, `${age} "${section.heading}" is empty`).toBeGreaterThan(0);
      }
    }
  });

  /**
   * The view escapes every string it renders, which is what lets a guide be
   * edited by anyone without thinking about markup. Put a tag in the content and
   * a coach reads the tag.
   */
  it("holds plain text, with no markup in it", () => {
    for (const [where, text] of guideCopy()) {
      expect(/<[a-z/]/i.test(text), `${where}: "${text}" contains markup`).toBe(false);
      expect(text.includes("&"), `${where}: "${text}" contains an entity`).toBe(false);
    }
  });

  it("keeps every table rectangular", () => {
    const tables = [
      ["ARRIVALS", ARRIVALS] as const,
      ...AGE_GROUPS.flatMap((age) =>
        GUIDES[age].sections.flatMap((section) =>
          section.blocks
            .filter((b): b is Extract<GuideBlock, { table: unknown }> => "table" in b)
            .map((b) => [`${age} "${section.heading}"`, b.table] as const),
        ),
      ),
    ];
    expect(tables.length, "no tables found").toBeGreaterThan(5);
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
    for (const age of AGE_GROUPS) {
      for (const faq of GUIDES[age].faqs) {
        expect(faq.question.endsWith("?"), `${age}: "${faq.question}"`).toBe(true);
        expect(faq.answer.length, `${age}: "${faq.question}" has no answer`).toBeGreaterThan(40);
      }
    }
  });

  /**
   * Player counts are written twice: once in the shared arrivals table and once
   * in each grade's own "side by side" comparison. Two copies of a Reg 15 number
   * is exactly how one of them goes stale.
   */
  it("agrees with itself about how many players a grade has", () => {
    const arrivals = new Map(ARRIVALS.rows.map((row) => [row[0], row[1]]));
    expect(arrivals.size, "arrivals table").toBe(AGE_GROUPS.length);

    for (const age of AGE_GROUPS) {
      const rows = GUIDES[age].sections
        .flatMap((section) => section.blocks)
        .filter((b): b is Extract<GuideBlock, { table: unknown }> => "table" in b)
        .flatMap((b) => b.table.rows)
        .filter((row) => row[0] === "Players a side");
      expect(rows.length, `${age} states no player count`).toBeGreaterThan(0);

      // The last column of the comparison is this grade; earlier ones are the
      // grade before, so they are checked against the arrivals row for that one.
      for (const row of rows) {
        const cells = row.slice(1);
        const grades = AGE_GROUPS.slice(AGE_GROUPS.indexOf(age) - cells.length + 1);
        cells.forEach((count, i) => {
          const grade = grades[i];
          expect(count, `${age} guide says ${grade} has ${count}`).toBe(
            arrivals.get(AGE_GROUP_LABELS[grade]),
          );
        });
      }
    }
  });

  it("hands no minis grade a lineout", () => {
    // Reg 15 has touch restarting with a free pass through U13, the uncontested
    // lineout arriving at U14 and lifting held back to U15. The catalogue
    // claimed U12 until August 2026 and shipped four drills to match.
    const CLAIM = /(?<!no )(?<!not )lineouts? (?:from |at |arrives? at |starts? at |is introduced at )u(?:7|8|9|1[0-3])\b/i;
    for (const [where, text] of guideCopy()) {
      expect(CLAIM.test(text), `${where}: "${text}"`).toBe(false);
    }
  });
});

describe("the guide view", () => {
  let container: HTMLElement;

  beforeEach(() => {
    window.location.hash = "";
    container = document.createElement("div");
    document.body.replaceChildren(container);
  });

  const headings = (): string[] =>
    [...container.querySelectorAll("h2, h3")].map((el) => el.textContent?.trim() ?? "");

  it("lists every grade on the index", () => {
    renderGuide(container, undefined);
    const links = [...container.querySelectorAll<HTMLAnchorElement>(".guide-card")].map(
      (a) => a.getAttribute("href"),
    );
    expect(links).toEqual(AGE_GROUPS.map((age) => `#/guide/${age}`));
  });

  /**
   * The one place in the hub where a coach may read about a grade that is not
   * theirs. The catalogue must never do this. A guide has to, because the grade
   * you are going up to is the one you want to read before the season.
   */
  it("shows a grade above the coach's own", () => {
    renderGuide(container, "u12", "u8");
    expect(headings()).toContain(GUIDES.u12.title);
    expect(container.textContent).toContain("The scrum goes to five");
  });

  it("marks the coach's own grade, and only that one", () => {
    renderGuide(container, undefined, "u10");
    const marked = [...container.querySelectorAll(".guide-card.is-yours")];
    expect(marked).toHaveLength(1);
    expect(marked[0].getAttribute("href")).toBe("#/guide/u10");
  });

  it("says nothing about a coach with no grade yet", () => {
    renderGuide(container, undefined);
    expect(container.querySelectorAll(".guide-card.is-yours")).toHaveLength(0);
  });

  it("links the grade's own RFU appendix, never another grade's", () => {
    for (const age of AGE_GROUPS) {
      renderGuide(container, age);
      const rules = [...container.querySelectorAll<HTMLAnchorElement>("a[href*='englandrugby']")];
      expect(rules.length, `${age}`).toBe(1);
      expect(rules[0].getAttribute("href"), age).toBe(RULES_OF_PLAY[age]);
    }
  });

  it("steps to the grades either side, and stops at the ends", () => {
    const steps = (age: AgeGroup): string[] => {
      renderGuide(container, age);
      return [...container.querySelectorAll<HTMLAnchorElement>(".guide-steps a")].map(
        (a) => a.getAttribute("href") ?? "",
      );
    };
    expect(steps("u7")).toEqual(["#/guide/u8"]);
    expect(steps("u10")).toEqual(["#/guide/u9", "#/guide/u11"]);
    expect(steps("u12")).toEqual(["#/guide/u11"]);
  });

  it("falls back to the index rather than breaking on a bad grade", () => {
    renderGuide(container, "u99");
    expect(container.querySelectorAll(".guide-card")).toHaveLength(AGE_GROUPS.length);
  });

  it("escapes what it renders", () => {
    // The contract that lets the content module hold plain text. If this ever
    // stops being true, an apostrophe in a guide becomes &#39; on screen.
    renderGuide(container, "u9");
    expect(container.textContent).not.toContain("&amp;");
    expect(container.querySelector(".guide")).toBeTruthy();
  });
});

describe("the guide index table names its own columns", () => {
  it("does not read out Row where the content says Grade", () => {
    // The first column of a comparison table is blank and wants a label only a
    // screen reader hears. The arrivals table is not blank: it says Grade. The
    // substitution used to be unconditional, so that one rendered an empty cell
    // and announced the wrong word. Same defect shipped in `seo/rulesPage.ts`.
    const container = document.createElement("div");
    document.body.replaceChildren(container);
    renderGuide(container, undefined);

    const headers = [...container.querySelectorAll(".guide-table thead th")].map(
      (cell) => cell.textContent?.trim() ?? "",
    );
    expect(headers).toEqual(ARRIVALS.head);
  });
});

/**
 * A rules claim with no date on it is one nobody can tell has gone stale.
 *
 * Reg 15 is reissued every summer, so the guide says which season it was read
 * for. The date lives in one constant and is written into the guide, its static
 * twin and the about page from there, so moving it is one edit rather than a
 * search. These hold it to a shape that is actually a season and actually a
 * date, because "2026" on its own would pass a `toContain` and tell a coach
 * nothing.
 */
describe("the guide says when it was last read against the RFU", () => {
  it("names a season that is two consecutive years", () => {
    const season = RULES_CHECKED.season.match(/^(20\d\d)\/(\d\d)$/);
    expect(season, `"${RULES_CHECKED.season}" is not a season`).not.toBeNull();
    const [, start, end] = season as RegExpMatchArray;
    expect(Number(end), "a season runs into the next year").toBe((Number(start) + 1) % 100);
  });

  it("has been checked inside the last season", () => {
    // The one test here that can fail without anybody touching the code, which
    // is the point of it. Reg 15 is reissued every summer, so a date sitting
    // more than a season back means the six appendices want re-reading and the
    // guide is making claims nobody has verified this year. Re-read them, then
    // move RULES_CHECKED. Do not move the date on its own.
    const checked = new Date(`1 ${RULES_CHECKED.on} UTC`);
    expect(Number.isNaN(checked.getTime()), `"${RULES_CHECKED.on}" is not a month`).toBe(false);
    const months = (Date.now() - checked.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
    expect(
      months,
      `The guide was last read against the RFU in ${RULES_CHECKED.on}. Re-read the six appendices, then move RULES_CHECKED.`,
    ).toBeLessThan(13);
  });

  it("says so on the index", () => {
    const container = document.createElement("div");
    document.body.replaceChildren(container);
    renderGuide(container, undefined);
    expect(container.textContent).toContain(rulesCheckedPhrase());
  });

  it("says so on every grade", () => {
    const container = document.createElement("div");
    document.body.replaceChildren(container);
    for (const age of AGE_GROUPS) {
      renderGuide(container, age);
      expect(container.textContent, age).toContain(rulesCheckedPhrase());
    }
  });
});

/**
 * Two claims the site makes about every grade, held to every grade.
 *
 * The Half Game Rule was written into U9 through U12 and nowhere else, so a U7
 * coach reading their own page never met the rule the index says covers them.
 * Mixed rugby was in the product nowhere at all, which is most of the minis
 * game missing from a guide about who plays what.
 */
describe("what holds at every grade is said at every grade", () => {
  const wordsIn = (age: AgeGroup): string =>
    JSON.stringify(GUIDES[age]).toLowerCase();

  it("names the Half Game Rule on every grade's page", () => {
    for (const age of AGE_GROUPS) {
      expect(wordsIn(age), age).toContain("half game rule");
    }
  });

  it("says where mixed rugby stops, on the grades it changes for", () => {
    // U11 because it is the last mixed grade, U12 because that is the change.
    // The index carries it for the rest, which is where a coach picks a grade.
    expect(wordsIn("u11")).toContain("boys and girls");
    expect(wordsIn("u12")).toContain("girls");
  });
});
