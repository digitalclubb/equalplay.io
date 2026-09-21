import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { DRILLS } from "../hub/content/drills.js";
import { PRESETS } from "../hub/content/presets.js";
import { GUIDES, GUIDE_BLURB, type Guide } from "../hub/content/guides.js";
import { COACHING_GUIDES, type CoachingGuide } from "../hub/content/coaching.js";
import { AGE_GROUP_LABELS, THEME_LABELS, THEME_TIPS } from "../hub/content/types.js";

/**
 * House style, enforced rather than remembered.
 *
 * The hub is meant to read like a coach talking, not like a content farm. Left to
 * discipline alone this rots the moment somebody adds a drill in a hurry, so the
 * rules live here instead.
 */

/** Escaped so a find-and-replace over the repo cannot quietly gut this test. */
const EM_DASH = "\u2014";

/** Every page a coach can land on without the app, homepage included. */
function htmlPages(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) found.push(...htmlPages(path));
    else if (entry.endsWith(".html")) found.push(path);
  }
  return found;
}
const PAGES = ["index.html", ...htmlPages("public")];

/** A guide's prose, with its tables, bullets and headings left out. */
function guideProse(guide: Guide): string[] {
  const out = [guide.standfirst];
  for (const section of guide.sections) {
    for (const block of section.blocks) if ("text" in block) out.push(block.text);
  }
  for (const faq of guide.faqs) out.push(faq.answer);
  return out;
}

/** A guide's prose, with its tables, bullets and headings left out. */
function coachingProse(guide: CoachingGuide): string[] {
  const out = [guide.standfirst, guide.blurb];
  for (const section of guide.sections) {
    for (const block of section.blocks) if ("text" in block) out.push(block.text);
  }
  for (const faq of guide.faqs) out.push(faq.answer);
  return out;
}

/**
 * Every string anywhere in a lump of content, labelled by where it sits.
 *
 * A walk rather than a flattener written to the shape of a guide. The lexical
 * rules below hold for every word a coach can read, whichever field it is in,
 * so knowing the shape buys nothing except a second place to update when a
 * field is added.
 */
function strings(value: unknown, at: string): Array<[string, string]> {
  if (typeof value === "string") return [[at, value]];
  if (Array.isArray(value)) return value.flatMap((item, i) => strings(item, `${at}[${i}]`));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) => strings(item, `${at}.${key}`));
  }
  return [];
}

/** Words and phrases that read as machine-written. Case insensitive. */
const BANNED = [
  "delve",
  "leverage",
  "landscape",
  "multifaceted",
  "comprehensive",
  "furthermore",
  "moreover",
  "crucial",
  "utilise",
  "utilize",
  "robust",
  "testament",
  "underscore",
  "unpack",
  "dive into",
  "deep dive",
  "dynamic",
  "innovative",
  "vibrant",
  "embark",
  "foster",
  "elevate",
  "seamless",
  "streamline",
  "harness",
  "pivotal",
  "realm",
  "tapestry",
  "unlock",
  "empower",
  "game-changer",
  "cutting-edge",
  "best practice",
  "it's important to note",
  "it is important to note",
  "when it comes to",
  "at its core",
  "here's the thing",
  "here's the kicker",
  "here's the breakdown",
  "the best part",
  "that being said",
  "in today's world",
  "revolutionise",
  "revolutionize",
];

/** American spellings that slip in. */
const AMERICANISMS: Array<[RegExp, string]> = [
  [/\bcolor\b/i, "colour"],
  [/\bmeter\b/i, "metre"],
  [/\bmeters\b/i, "metres"],
  [/\bcenter\b/i, "centre"],
  [/\bpractice(s|d|ing)\b/i, "practise as a verb"],
  [/\borganiz/i, "organis"],
  [/\brecogniz/i, "recognis"],
  [/\bdefense\b/i, "defence"],
  [/\boffense\b/i, "offence"],
  [/\bfavor/i, "favour"],
  [/\bcleats\b/i, "boots"],
  [/\bfield\b/i, "pitch"],
];

/** Every string a coach can actually read, with a label for the failure message. */
function drillCopy(): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const drill of DRILLS) {
    const at = (part: string): string => `${drill.id} ${part}`;
    out.push([at("title"), drill.title]);
    out.push([at("setup"), drill.setup]);
    out.push([at("howItRuns"), drill.howItRuns]);
    out.push([at("space"), drill.space]);
    if (drill.safety) out.push([at("safety"), drill.safety]);
    drill.coachingPoints.forEach((p, i) => out.push([at(`coachingPoints[${i}]`), p]));
    drill.progressions?.forEach((p, i) => out.push([at(`progressions[${i}]`), p]));
    drill.regressions?.forEach((p, i) => out.push([at(`regressions[${i}]`), p]));
    drill.faults?.forEach((fault, i) => {
      out.push([at(`faults[${i}].looks`), fault.looks]);
      out.push([at(`faults[${i}].say`), fault.say]);
    });
    for (const kit of drill.equipment) out.push([at("equipment"), kit.item]);
    // A diagram caption is a figcaption on the drill page, in a session block,
    // in present mode and in a shared session. It reads on screen the same as
    // anything else here, so it is held to the same house style.
    if (drill.diagram?.caption) out.push([at("diagram.caption"), drill.diagram.caption]);
    if (drill.diagram?.after?.caption) {
      out.push([at("diagram.after.caption"), drill.diagram.after.caption]);
    }
  }
  for (const preset of PRESETS) {
    out.push([`${preset.id} title`, preset.title]);
    out.push([`${preset.id} aim`, preset.aim]);
  }
  for (const [theme, tips] of Object.entries(THEME_TIPS)) {
    tips.forEach((tip, i) => out.push([`${theme} tip[${i}]`, tip]));
  }
  for (const label of Object.values(THEME_LABELS)) out.push(["theme label", label]);
  for (const label of Object.values(AGE_GROUP_LABELS)) out.push(["age label", label]);
  return out;
}

describe("drill copy", () => {
  const copy = drillCopy();

  it("has something to check", () => {
    expect(copy.length).toBeGreaterThan(100);
  });

  it("uses no em dashes", () => {
    for (const [where, text] of copy) {
      expect(text.includes(EM_DASH), `${where}: em dash`).toBe(false);
    }
  });

  it("puts no comma before and", () => {
    for (const [where, text] of copy) {
      expect(/,\s+and\b/i.test(text), `${where}: comma before "and" in "${text}"`).toBe(false);
    }
  });

  it("avoids phrasing that reads as machine-written", () => {
    for (const [where, text] of copy) {
      const lower = text.toLowerCase();
      for (const banned of BANNED) {
        expect(lower.includes(banned), `${where}: "${banned}"`).toBe(false);
      }
    }
  });

  it("is British English", () => {
    for (const [where, text] of copy) {
      for (const [pattern, better] of AMERICANISMS) {
        expect(pattern.test(text), `${where}: use ${better} in "${text}"`).toBe(false);
      }
    }
  });

  it("keeps coaching points short enough to read mid-session", () => {
    for (const drill of DRILLS) {
      for (const point of drill.coachingPoints) {
        expect(point.length, `${drill.id}: "${point}" is too long for a glance`).toBeLessThan(120);
      }
    }
  });

  it("starts sentences with a capital and does not end a fragment with a full stop", () => {
    for (const drill of DRILLS) {
      // Coaching points, progressions and faults are fragments, so no trailing
      // full stop. A fault is read at the same glance as a coaching point.
      const faultLines = (drill.faults ?? []).flatMap((fault) => [fault.looks, fault.say]);
      for (const point of [
        ...drill.coachingPoints,
        ...(drill.progressions ?? []),
        ...(drill.regressions ?? []),
        ...faultLines,
      ]) {
        expect(point[0], `${drill.id}: "${point}" should start with a capital`).toBe(
          point[0].toUpperCase(),
        );
        expect(point.endsWith("."), `${drill.id}: "${point}" should not end with a full stop`).toBe(
          false,
        );
      }
      // Prose is sentences, so it should
      for (const prose of [drill.setup, drill.howItRuns]) {
        expect(prose.endsWith("."), `${drill.id}: prose should end with a full stop`).toBe(true);
      }
    }
  });
});

/**
 * The coaching guides get the drills' lexical rules rather than the interface's
 * file scan, because they are content: a body of prose somebody wrote, in the
 * same voice, on the same tab as the rules guides.
 */
describe("coaching guide copy", () => {
  const copy = COACHING_GUIDES.flatMap((guide) => strings(guide, guide.slug));

  it("has something to check", () => {
    expect(copy.length).toBeGreaterThan(200);
  });

  it("uses no em dashes", () => {
    for (const [where, text] of copy) {
      expect(text.includes(EM_DASH), `${where}: em dash`).toBe(false);
    }
  });

  it("puts no comma before and", () => {
    for (const [where, text] of copy) {
      expect(/,\s+and\b/i.test(text), `${where}: comma before "and" in "${text}"`).toBe(false);
    }
  });

  it("avoids phrasing that reads as machine-written", () => {
    for (const [where, text] of copy) {
      const lower = text.toLowerCase();
      for (const banned of BANNED) {
        expect(lower.includes(banned), `${where}: "${banned}"`).toBe(false);
      }
    }
  });

  it("is British English", () => {
    for (const [where, text] of copy) {
      for (const [pattern, better] of AMERICANISMS) {
        expect(pattern.test(text), `${where}: use ${better} in "${text}"`).toBe(false);
      }
    }
  });
});

/**
 * The same rules apply to the interface, but its copy is woven into template
 * literals, so scan the files rather than trying to pull the strings out. Em
 * dashes are banned in comments too. Nobody types those by hand.
 */
describe("interface and page copy", () => {
  function walk(dir: string, match: RegExp): string[] {
    const found: string[] = [];
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) found.push(...walk(path, match));
      else if (match.test(entry)) found.push(path);
    }
    return found;
  }

  const sources = [
    ...walk("src", /\.(ts|css)$/),
    ...walk("public", /\.html$/),
    ...walk("hub", /\.html$/),
    ...walk("planner", /\.html$/),
    ...walk("api", /\.ts$/),
    ...walk("docs", /\.md$/),
    ...walk("supabase", /\.(sql|md)$/),
    "index.html",
    ".env.example",
    "CLAUDE.md",
  ].filter((path) => !path.includes("__tests__"));

  it("finds the source files", () => {
    expect(sources.length).toBeGreaterThan(20);
  });

  it("uses no em dashes anywhere", () => {
    for (const path of sources) {
      const lines = readFileSync(path, "utf8").split("\n");
      lines.forEach((line, i) => {
        expect(line.includes(EM_DASH), `${path}:${i + 1} em dash`).toBe(false);
      });
    }
  });

  it("puts no comma before and", () => {
    for (const path of sources) {
      const lines = readFileSync(path, "utf8").split("\n");
      lines.forEach((line, i) => {
        expect(/,\s+and\b/.test(line), `${path}:${i + 1}: ${line.trim()}`).toBe(false);
      });
    }
  });
});

/**
 * The rhythm half of the house style, which `docs/content-sourcing.md` has always
 * asked for and nothing has ever checked.
 *
 * The lexical rules above held for a year. The rules about shape rotted, because
 * they lived in a document rather than in a test: by September 2026 "in plain
 * English" closed five of six guide standfirsts and appeared 24 times across the
 * site, and every grade page carried at least one three-part list. Both are the
 * pattern a language model falls into when it has found a phrasing that works,
 * and both are invisible to a spell check.
 */
describe("prose rhythm", () => {
  /**
   * Three items in a row opening with the same word. "No names, no dates, no
   * photographs" is the shape, and it reads as filler wearing the clothes of
   * emphasis whatever the three items are.
   *
   * Articles and prepositions are exempt: "the pitch, the halves, the distance"
   * is an ordinary English list, not a rhetorical figure. So are bullets, which
   * are not prose and where a rule with three parts should read as three parts.
   */
  const ANAPHORA = /\b(\w+)\b[^,.;:!?]{1,45}, \1\b[^,.;:!?]{1,45}, \1\b/i;
  const ORDINARY = new Set([
    "the", "a", "an", "of", "and", "in", "on", "at", "to", "is", "it", "or",
    "for", "with", "from", "by", "as", "that", "this", "they", "you",
  ]);

  function anaphora(text: string): string | null {
    for (const sentence of text.split(/(?<=[.!?])\s+/)) {
      const hit = ANAPHORA.exec(sentence);
      if (hit && !ORDINARY.has(hit[1].toLowerCase())) return sentence.trim();
    }
    return null;
  }

  /** Every bit of prose a coach reads, with no bullets or labels in it. */
  function prose(): Array<[string, string]> {
    const out: Array<[string, string]> = [];
    for (const drill of DRILLS) {
      out.push([`${drill.id} setup`, drill.setup]);
      out.push([`${drill.id} howItRuns`, drill.howItRuns]);
    }
    for (const [age, guide] of Object.entries(GUIDES)) {
      out.push([`${age} standfirst`, guide.standfirst]);
      guide.sections.forEach((section, s) => {
        section.blocks.forEach((block, b) => {
          if ("text" in block) out.push([`${age} section[${s}].blocks[${b}]`, block.text]);
        });
      });
      guide.faqs.forEach((faq, f) => out.push([`${age} faqs[${f}]`, faq.answer]));
    }
    for (const guide of COACHING_GUIDES) {
      coachingProse(guide).forEach((text, i) => out.push([`${guide.slug} prose[${i}]`, text]));
    }
    for (const path of PAGES) {
      const html = readFileSync(path, "utf8")
        .replace(/<!--[\s\S]*?-->/g, " ")
        .replace(/<script[\s\S]*?<\/script>/g, " ");
      // Paragraphs only. A list item is a bullet and a heading is a label.
      for (const [i, p] of [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)].entries()) {
        out.push([`${path} p[${i}]`, p[1].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()]);
      }
    }
    return out;
  }

  it("finds the prose", () => {
    expect(prose().length).toBeGreaterThan(300);
  });

  it("starts no three items in a row with the same word", () => {
    for (const [where, text] of prose()) {
      expect(anaphora(text), `${where}: three-part list`).toBe(null);
    }
  });

  it("gives every guide standfirst an ending of its own", () => {
    // Five of the six once ended "in plain English", four of them on the same
    // six words. A set of blurbs that all close the same way is the single most
    // machine-written thing a page can do, and it is invisible one page at a time.
    const tail = (s: string): string =>
      s.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/).slice(-3).join(" ");
    for (const set of [
      Object.entries(GUIDES).map(([age, g]) => [age, g.standfirst] as const),
      Object.entries(GUIDE_BLURB).map(([age, b]) => [age, b] as const),
    ]) {
      const seen = new Map<string, string>();
      for (const [age, text] of set) {
        const end = tail(text);
        expect(seen.get(end), `${age} ends "${end}", the same as ${seen.get(end)}`).toBeUndefined();
        seen.set(end, age);
      }
    }
  });

  it("writes prose with contractions in it", () => {
    // "Contractions are wanted" is the oldest note in `content-sourcing.md` and
    // the one nothing enforced. The guide ran to 7,000 words without a single
    // one. The floor is deliberately low: it catches a body of prose that has
    // none, not a paragraph that happens to want none.
    const CONTRACTION = /\b[A-Za-z]+'(t|re|ve|ll|d|m)\b/g;
    const bodies: Array<[string, string]> = [
      ["guides.ts", Object.values(GUIDES).flatMap(guideProse).join(" ")],
      ["coaching.ts", COACHING_GUIDES.flatMap(coachingProse).join(" ")],
      ...PAGES.map((path) => {
        const html = readFileSync(path, "utf8").replace(/<!--[\s\S]*?-->/g, " ");
        const text = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)]
          .map((m) => m[1].replace(/<[^>]*>/g, " "))
          .join(" ");
        return [path, text] as [string, string];
      }),
    ];
    for (const [where, text] of bodies) {
      const words = text.split(/\s+/).filter(Boolean).length;
      if (words < 250) continue;
      const rate = ((text.match(CONTRACTION) ?? []).length / words) * 1000;
      expect(rate, `${where}: ${rate.toFixed(1)} contractions per 1000 words`).toBeGreaterThan(2);
    }
  });
});
