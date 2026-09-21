/**
 * The drill catalogue, rendered as static pages a search engine can read.
 *
 * The catalogue itself is hub content and stays that way. It lives in the
 * bundle so the Drills tab opens with no signal, which is the whole reason the
 * drills are typed data rather than database rows. But `/hub` is `noindex` and
 * a hash route is one URL to a crawler however many drills sit behind it, so
 * 120 drills written from scratch sat where nothing could find them. Meanwhile
 * "u9 rugby tackling drills" is a question a coach types into Google on a
 * Monday night.
 *
 * So this is the rules cluster's shape applied to the catalogue: a page per
 * drill, plus a page per theme per grade to gather them, both pointing at the
 * product. Nothing is written twice. Every word comes out of
 * `hub/content/catalogue/`, so a page cannot drift from the drill a coach reads
 * in the app. The diagram is the same renderer drawing the same coordinates.
 *
 * Two things it must never do, both held by `drill-pages.test.ts`. It may not
 * emit a theme page below the grade Regulation 15 allows that theme at, because
 * a page called "U8 rugby ruck drills" is the age gate failing in public. And
 * it may not put a drill on a grade's page that the grade cannot do, which is
 * the same rule `filterDrills` enforces inside the app.
 */

import { esc } from "../lib/esc.js";
import { DRILLS_INDEX_PATH, ORIGIN, page } from "./page.js";
import { rulesPath } from "./rulesPage.js";
import { DRILLS, drillPath, fitsHardGround, fitsSmallSpace } from "../hub/content/drills.js";
import { coachingGuideForTheme, coachingPath } from "../hub/content/coaching.js";
import { renderSequence } from "../hub/content/diagram.js";
import {
  AGE_GROUPS,
  AGE_GROUP_LABELS,
  HEADCASE_URL,
  RULES_OF_PLAY,
  THEMES,
  THEME_LABELS,
  THEME_MIN_AGE,
  THEME_TIPS,
  type AgeGroup,
  type Drill,
  type Theme,
  ageAtLeast,
  isAvailableAt,
  kitLabel,
  rulesCheckedPhrase,
} from "../hub/content/types.js";

// ---- Addresses ----

/**
 * A drill's own URL, defined next to the drills so the hub can link it too.
 *
 * Flat rather than nested under a directory, the same as every other page in
 * the product. That is what the host already resolves for the rules cluster.
 */
export { drillPath };

/**
 * What a coach types, which is not always what the theme is called in here.
 *
 * `handling` is passing to everybody outside this codebase and `gamesense` is
 * two words in a search box. The rest are already the word. Nothing here names
 * a lineout, for the same reason `THEME_SHORT` does not.
 */
const THEME_SLUG: Record<Theme, string> = {
  handling: "passing",
  evasion: "evasion",
  tackle: "tackling",
  breakdown: "ruck",
  setpiece: "scrum",
  kicking: "kicking",
  gamesense: "game-sense",
};

/** The same word in a sentence, where the hyphen would read as a typo. */
const themeWord = (theme: Theme): string => THEME_SLUG[theme].replace("-", " ");

export function themePath(theme: Theme, age: AgeGroup): string {
  return `/rugby-${THEME_SLUG[theme]}-drills-${age}`;
}

/** Every drill a grade may do within one theme, in catalogue order. */
export function drillsFor(theme: Theme, age: AgeGroup): Drill[] {
  return DRILLS.filter((drill) => isAvailableAt(drill, age) && drill.themes.includes(theme));
}

/**
 * The theme and grade pairs worth a page.
 *
 * Gated on Regulation 15 first and on having something to show second. The
 * legality check is written out here rather than left to `isAvailableAt` on the
 * drills, because a gate that only exists as a side effect of the content is
 * one bad `minAge` away from not existing at all.
 */
export function themeGrades(): Array<{ theme: Theme; age: AgeGroup; drills: Drill[] }> {
  const pairs: Array<{ theme: Theme; age: AgeGroup; drills: Drill[] }> = [];
  for (const age of AGE_GROUPS) {
    for (const theme of THEMES) {
      if (!ageAtLeast(age, THEME_MIN_AGE[theme])) continue;
      const drills = drillsFor(theme, age);
      if (drills.length > 0) pairs.push({ theme, age, drills });
    }
  }
  return pairs;
}

/** Every page this module emits, for the sitemap and for the tests. */
export function drillPagePaths(): string[] {
  return [
    ...DRILLS.map(drillPath),
    ...themeGrades().map(({ theme, age }) => themePath(theme, age)),
  ];
}

// ---- Words ----

const kindWord = (drill: Drill): string => (drill.kind === "warmup" ? "warm-up" : "drill");

/**
 * The article the theme in front of it needs.
 *
 * "A evasion and footwork warm-up" is the sort of thing a generated page says
 * once and then says on nineteen more, which reads as nobody having looked.
 */
const article = (word: string): string => (/^[aeiou]/i.test(word) ? "an" : "a");

const capitalise = (word: string): string => word[0].toUpperCase() + word.slice(1);

/** Titles are title case here. Headings stay sentence case, as everywhere else. */
const titleCase = (words: string): string => words.replace(/\b[a-z]/g, (c) => c.toUpperCase());

/** The grades a drill is legal at, said the way a coach would say it. */
function ageRange(drill: Drill): string {
  const from = AGE_GROUP_LABELS[drill.minAge];
  if (!drill.maxAge) return `${from} and up`;
  if (drill.maxAge === drill.minAge) return from;
  return `${from} to ${AGE_GROUP_LABELS[drill.maxAge]}`;
}

const gradesFor = (drill: Drill): AgeGroup[] =>
  AGE_GROUPS.filter((age) => isAvailableAt(drill, age));

/** A meta description has about 160 characters. Cut on a word, never mid-word. */
function clamp(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  return `${cut.slice(0, cut.lastIndexOf(" "))}...`;
}

const list = (items: string[]): string =>
  `        <ul>\n${items.map((item) => `          <li>${item}</li>`).join("\n")}\n        </ul>`;

/**
 * The floor a theme link has to respect.
 *
 * A drill's own `minAge` is usually the later of the two already. Taking the
 * later of them anyway means a drill mis-tagged one grade low still cannot
 * produce a link to a page that does not exist.
 */
const themeFloor = (drill: Drill, theme: Theme): AgeGroup =>
  ageAtLeast(drill.minAge, THEME_MIN_AGE[theme]) ? drill.minAge : THEME_MIN_AGE[theme];

// ---- A drill ----

function facts(drill: Drill): string {
  const rows: Array<[string, string]> = [
    ["Age grades", gradesFor(drill).map((age) => AGE_GROUP_LABELS[age]).join(", ")],
    ["Time", `${drill.minutes} minutes`],
    [
      "Players",
      drill.players.max
        ? `${drill.players.min} to ${drill.players.max}`
        : `${drill.players.min} or more`,
    ],
    ["Space", esc(drill.space)],
    [
      "Kit",
      drill.equipment.length > 0
        ? drill.equipment.map((kit) => esc(kitLabel(kit))).join(", ")
        : "Nothing",
    ],
    ["Pitch", fitsHardGround(drill) ? "Fine on hard ground" : "Wants a forgiving surface"],
  ];
  if (fitsSmallSpace(drill)) rows.push(["Indoors", "Fits a small space"]);

  return `        <dl class="drill-facts">
${rows
  .map(([term, value]) => `          <dt>${esc(term)}</dt>\n          <dd>${value}</dd>`)
  .join("\n")}
        </dl>`;
}

function faults(drill: Drill): string {
  if (!drill.faults?.length) return "";
  return `        <h2>What it looks like when it is going wrong</h2>
        <p>What you can see from the touchline, then the one thing to say about it.</p>
        <dl class="drill-faults">
${drill.faults
  .map(
    (fault) =>
      `          <dt>${esc(fault.looks)}</dt>\n          <dd>${esc(fault.say)}</dd>`,
  )
  .join("\n")}
        </dl>`;
}

function safety(drill: Drill): string {
  if (!drill.safety) return "";
  return `        <div class="note">
          <p><strong>Safety.</strong> ${esc(drill.safety)}</p>
          <p>
            <a href="${HEADCASE_URL}" rel="noopener">The RFU's Headcase</a> is where to go
            for what to do after a bang on the head. It is theirs rather than ours.
          </p>
        </div>`;
}

function elsewhere(drill: Drill): string {
  const themes = drill.themes.map((theme) => {
    const age = themeFloor(drill, theme);
    return `<a href="${themePath(theme, age)}">${AGE_GROUP_LABELS[age]} rugby ${esc(themeWord(theme))} drills</a>`;
  });
  const grades = gradesFor(drill).map(
    (age) => `<a href="/rugby-drills-${age}">${AGE_GROUP_LABELS[age]} rugby drills</a>`,
  );

  return `        <h2>More like this</h2>
${list(themes)}
        <h2>The grades that can do it</h2>
${list(grades)}
        <p>
          <a href="${rulesPath(drill.minAge)}">What ${AGE_GROUP_LABELS[drill.minAge]} rugby
          allows</a> is the rule this sits under. Regulation 15 is reissued every summer, so
          <a href="${RULES_OF_PLAY[drill.minAge]}" rel="noopener">the RFU's own rules of
          play</a> are the ones to read for this season rather than a copy on somebody
          else's website. Ours included. ${esc(rulesCheckedPhrase())}.
        </p>`;
}

export function drillPageHtml(drill: Drill): string {
  const theme = THEME_LABELS[drill.themes[0]].toLowerCase();
  const body = `        <h1>${esc(drill.title)}</h1>
        <p class="standfirst">
          ${capitalise(article(theme))} ${esc(theme)} ${kindWord(drill)} for
          ${ageRange(drill)}, with ${drill.diagram ? "where the cones go" : "the set up"},
          how it runs and what to say when it is not working.
        </p>

        <p><a class="cta" href="/hub#/catalogue/${esc(drill.id)}">Open this drill in the app</a></p>
        <p class="home-microcopy">
          Free to read with no account. It works at a pitch with no signal too.
        </p>

${facts(drill)}

        <h2>Setting it up</h2>
        <p>${esc(drill.setup)}</p>
${drill.diagram ? `        <figure class="drill-figure">${renderSequence(drill.diagram)}</figure>` : ""}

        <h2>How it runs</h2>
        <p>${esc(drill.howItRuns)}</p>

        <h2>What to watch for</h2>
${list(drill.coachingPoints.map(esc))}
${
    drill.regressions?.length
      ? `\n        <h2>Make it easier</h2>\n${list(drill.regressions.map(esc))}\n`
      : ""
  }${
    drill.progressions?.length
      ? `\n        <h2>Make it harder</h2>\n${list(drill.progressions.map(esc))}\n`
      : ""
  }
${faults(drill)}

${safety(drill)}

${elsewhere(drill)}`;

  return page({
    path: drillPath(drill),
    // The search word rather than `THEME_LABELS`, which is a sentence and lands
    // in a title as "Rugby Evasion and footwork Drill". It is also the word in
    // the address and in the theme page's own heading, so the three agree.
    title: `${drill.title}. ${AGE_GROUP_LABELS[drill.minAge]} Rugby ${titleCase(themeWord(drill.themes[0]))} ${drill.kind === "warmup" ? "Warm-up" : "Drill"}`,
    // Raw, because `page()` escapes it. Escaping twice puts &amp;#39; into
    // three meta tags the first time a drill has an apostrophe in it.
    description: clamp(
      `${THEME_LABELS[drill.themes[0]]} ${kindWord(drill)} for ${ageRange(drill)}. ${drill.setup}`,
      155,
    ),
    breadcrumb: [
      { name: "Rugby drills by age group", path: DRILLS_INDEX_PATH },
      {
        name: `${AGE_GROUP_LABELS[themeFloor(drill, drill.themes[0])]} ${themeWord(drill.themes[0])} drills`,
        path: themePath(drill.themes[0], themeFloor(drill, drill.themes[0])),
      },
      { name: drill.title, path: drillPath(drill) },
    ],
    faqs: [],
    body,
  });
}

// ---- A theme at a grade ----

function drillCard(drill: Drill): string {
  const meta = [
    `${drill.minutes} min`,
    drill.players.max
      ? `${drill.players.min} to ${drill.players.max} players`
      : `${drill.players.min}+ players`,
    esc(drill.space),
  ].join(" &middot; ");

  // The first fault rather than the first coaching point. A coaching point is a
  // reminder for somebody who has seen the drill go right. What a coach
  // scanning a list of twelve wants is the thing this one fixes.
  const line = drill.faults?.[0] ? esc(drill.faults[0].looks) : esc(clamp(drill.setup, 120));

  return `          <li>
            <a href="${drillPath(drill)}"><strong>${esc(drill.title)}</strong></a>
            <span class="calc-detail">${meta}</span>
            ${line}
          </li>`;
}

export function themePageHtml(theme: Theme, age: AgeGroup, drills: Drill[]): string {
  const label = AGE_GROUP_LABELS[age];
  const word = themeWord(theme);
  const floor = THEME_MIN_AGE[theme];
  const siblings = THEMES.filter(
    (other) => other !== theme && ageAtLeast(age, THEME_MIN_AGE[other]) && drillsFor(other, age).length > 0,
  );
  const teaching = coachingGuideForTheme(theme);
  const otherGrades = AGE_GROUPS.filter(
    (other) => other !== age && ageAtLeast(other, floor) && drillsFor(theme, other).length > 0,
  );

  const body = `        <h1>${label} rugby ${esc(word)} drills</h1>
        <p class="standfirst">
          ${drills.length} ${esc(THEME_LABELS[theme].toLowerCase())} drills a ${label} squad is
          allowed to do, each with the set up, the coaching points and what it looks like
          from the touchline when it is going wrong.
        </p>

        <p><a class="cta" href="/hub?age=${age}">Open them in the app</a></p>
        <p class="home-microcopy">
          Free to read with no account. They work at a pitch with no signal too.
        </p>

        <h2>What to say, whatever the drill</h2>
        <p>
          These hold for every drill below, so they are worth knowing before you
          pick one. Each drill then adds what to watch for while that one is running.
        </p>
${list(THEME_TIPS[theme].map((tip) => esc(tip)))}

        <h2>What ${label} is allowed here</h2>
        <p>
          ${
            floor === age
              ? `${label} is the first grade the RFU allows ${esc(word)} work at, so this is where it starts.`
              : `${esc(THEME_LABELS[theme])} arrives at ${AGE_GROUP_LABELS[floor]}, so a ${label} squad has had it for a while.`
          }
          Nothing below that grade sees any of these, in the app or on this site.
          <a href="${rulesPath(age)}">What ${label} rugby allows</a> is the rest of it.
        </p>
${
    teaching
      ? `        <p>
          Never coached this before? <a href="${coachingPath(teaching)}">${esc(teaching.title)}</a>
          is the order to teach it in, from the first session to a live one against one.
        </p>\n`
      : ""
  }

        <h2>The drills</h2>
        <p>Under each one is what it looks like when that drill is going wrong.</p>
        <ul class="drill-index">
${drills.map(drillCard).join("\n")}
        </ul>

${
    siblings.length > 0
      ? `        <h2>What else ${label} can work on</h2>\n${list(
          siblings.map(
            (other) =>
              `<a href="${themePath(other, age)}">${label} rugby ${esc(themeWord(other))} drills</a>`,
          ),
        )}\n`
      : ""
  }${
    otherGrades.length > 0
      ? `        <h2>The same at other grades</h2>\n${list(
          otherGrades.map(
            (other) =>
              `<a href="${themePath(theme, other)}">${AGE_GROUP_LABELS[other]} rugby ${esc(word)} drills</a>`,
          ),
        )}\n`
      : ""
  }
        <p>
          <a href="/rugby-drills-${age}">Every ${label} drill</a> is the whole grade rather
          than one theme. <a href="${DRILLS_INDEX_PATH}">Rugby drills by age group</a> is
          all six grades.
        </p>`;

  return page({
    path: themePath(theme, age),
    title: `${label} Rugby ${titleCase(word)} Drills`,
    description: `${drills.length} ${THEME_LABELS[theme].toLowerCase()} drills for ${label} rugby, matched to what RFU Regulation 15 lets the grade do. Set up, coaching points plus what going wrong looks like.`,
    breadcrumb: [
      { name: "Rugby drills by age group", path: DRILLS_INDEX_PATH },
      { name: `${label} rugby ${word} drills`, path: themePath(theme, age) },
    ],
    faqs: [],
    graph: [
      {
        "@type": "ItemList",
        name: `${label} rugby ${word} drills`,
        numberOfItems: drills.length,
        itemListElement: drills.map((drill, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: drill.title,
          url: `${ORIGIN}${drillPath(drill)}`,
        })),
      },
    ],
    body,
  });
}

/** Every page, keyed by the path it belongs at. What the build writes out. */
export function drillPages(): Array<{ path: string; html: string }> {
  return [
    ...DRILLS.map((drill) => ({ path: drillPath(drill), html: drillPageHtml(drill) })),
    ...themeGrades().map(({ theme, age, drills }) => ({
      path: themePath(theme, age),
      html: themePageHtml(theme, age, drills),
    })),
  ];
}
