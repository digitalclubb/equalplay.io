import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { DRILLS } from "../hub/content/drills.js";
import { PRESETS } from "../hub/content/presets.js";
import { AGE_GROUP_LABELS, THEME_LABELS } from "../hub/content/types.js";

/**
 * House style, enforced rather than remembered.
 *
 * The hub is meant to read like a coach talking, not like a content farm. Left to
 * discipline alone this rots the moment somebody adds a drill in a hurry, so the
 * rules live here instead.
 */

/** Escaped so a find-and-replace over the repo cannot quietly gut this test. */
const EM_DASH = "\u2014";

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
    for (const kit of drill.equipment) out.push([at("equipment"), kit.item]);
  }
  for (const preset of PRESETS) out.push([`${preset.id} title`, preset.title]);
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
      // Coaching points and progressions are fragments, so no trailing full stop
      for (const point of [...drill.coachingPoints, ...(drill.progressions ?? []), ...(drill.regressions ?? [])]) {
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
