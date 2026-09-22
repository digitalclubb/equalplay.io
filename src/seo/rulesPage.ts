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
import { RULES_INDEX_PATH, page } from "./page.js";
import { DRILLS, drillPath } from "../hub/content/drills.js";
import { COACHING_GUIDES, coachingGuidesFor, coachingPath } from "../hub/content/coaching.js";
import { QUESTIONS, QUESTIONS_INDEX_PATH } from "../hub/content/questions.js";
import type { Drill } from "../hub/content/types.js";
import {
  AGE_GROUPS,
  AGE_GROUP_LABELS,
  AGE_GRADE_RESOURCES_URL,
  HALF_GAME_RULE_URL,
  REGULATION_15_URL,
  RULES_OF_PLAY,
  type AgeGroup,
  rulesCheckedPhrase,
} from "../hub/content/types.js";
import {
  ARRIVALS,
  GUIDES,
  GUIDE_BLURB,
  MIXED_RUGBY_NOTE,
  type Guide,
  type GuideBlock,
  type GuideTable,
} from "../hub/content/guides.js";

/** Where a grade's page lives. One place, so the sitemap and the links agree. */
export function rulesPath(age: AgeGroup): string {
  return `/rugby-rules-${age}`;
}

/** Every page this module emits, for the sitemap and for the tests. */
export function rulesPagePaths(): string[] {
  return [RULES_INDEX_PATH, ...AGE_GROUPS.map(rulesPath)];
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
  // The drill's own page rather than the hub route the guide links to. A reader
  // here has no app open and may have no account, so `#/catalogue/<id>` would
  // ask them which grade they coach before showing them the drill.
  if ("drills" in b) {
    const found = b.drills
      .map((id) => DRILLS.find((drill) => drill.id === id))
      .filter((drill): drill is Drill => Boolean(drill));
    if (!found.length) return "";
    return `        <ul>${found
      .map(
        (drill) =>
          `<li><a href="${drillPath(drill)}">${esc(drill.title)}</a>, ${drill.minutes} minutes</li>`,
      )
      .join("")}</ul>`;
  }
  return `        <ul>${b.items
    .map((item) => `<li>${item.lead ? `<strong>${esc(item.lead)}</strong> ` : ""}${esc(item.text)}</li>`)
    .join("")}</ul>`;
}

/**
 * A guide's blocks as page markup, for the other generator that renders guide
 * content. `coachingPage.ts` emits the same blocks under a different chrome, so
 * this is exported rather than copied: two renderers for one block type is how
 * a table ends up styled two ways.
 */
export function guideBlocks(blocks: GuideBlock[]): string {
  return blocks.map(block).join("\n");
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
            match day says something different to this page, they are right.
          </p>
          <p>${rulesCheckedPhrase()}.</p>
          <p>
            ${rulesLink(label, href)}
            &middot;
            <a href="mailto:hello@equalplay.io?subject=Equal%20Play%3A%20something%20is%20wrong">Tell us if this is wrong</a>
          </p>
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
  // The same hand-off the hub route makes, for the reader who landed here from
  // a search instead. Newest at this grade first. See `coachingGuidesFor`.
  const teaching = coachingGuidesFor(guide.ageGroup);
  const teachingSection = teaching.length
    ? `        <h2>How to teach it</h2>
        <p>
          Everything above is what ${label} is allowed to do. Here is how to teach
          it, step by step, written for a coach who never played.
        </p>
        <ul>
${teaching
  .map(
    (one) =>
      `          <li><a href="${coachingPath(one)}">${esc(one.title)}</a> ${esc(one.blurb)}</li>`,
  )
  .join("\n")}
        </ul>

`
    : "";

  return `        <h1>${esc(guide.title)}</h1>
        <p class="standfirst">${esc(guide.standfirst)}</p>

        <p><a class="cta" href="/hub?age=${guide.ageGroup}#/guide/${guide.ageGroup}">Read it in the app</a></p>
        <p class="home-microcopy">
          Free to read with no account. It works at a pitch with no signal too.
        </p>

${guide.sections
  .map((section) => `        <h2>${esc(section.heading)}</h2>\n${section.blocks.map(block).join("\n")}`)
  .join("\n\n")}

${teachingSection}        <h2>Common questions</h2>
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
    description: `${GUIDE_BLURB[age]} What an ${label} grade may and may not do at training and in a match, written from RFU Regulation 15.`,
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
        <p>${esc(MIXED_RUGBY_NOTE)}</p>

        <h2>Pick a grade</h2>
        <ul>
${cards}
        </ul>

        <h2>The same at every grade</h2>
        <ul>
          <li><strong>${rulesLink("The Half Game Rule", HALF_GAME_RULE_URL)}.</strong> Every
            player in the squad gets at least half of the playing time. Across a festival that is half of the morning rather
            than half of each game. It is the one clubs get wrong most often, so
            <a href="/planner">Match day</a> checks it for you.</li>
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

        <p class="home-microcopy">
          <a href="${AGE_GRADE_RESOURCES_URL}" rel="noopener">Everything the RFU publishes for
          age grade coaches</a>, including their concussion education.
        </p>

        <h2>How to teach the hard parts</h2>
        <p>
          The pages above say what a grade may do. These say how to teach it, which is
          the harder question if you never played. Each one is a progression from the
          first session to a live one against one.
        </p>
        <ul>
${COACHING_GUIDES.map(
  (guide) =>
    `          <li><a href="${coachingPath(guide)}"><strong>${esc(guide.title)}</strong></a> ${esc(guide.blurb)}</li>`,
).join("\n")}
        </ul>

        <h2>The questions that come up on the day</h2>
        <p>
          A grade's page is what to read in August. <a href="${QUESTIONS_INDEX_PATH}">Rugby
          questions answered</a> is the other half of it: ${QUESTIONS.length} short answers
          to the things that happen in front of you on match day, grouped by what was going
          on at the time rather than by grade.
        </p>

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
