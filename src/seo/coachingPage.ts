/**
 * The coaching guides, rendered as static pages a search engine can read.
 *
 * Same argument as the rules pages beside them. The guide lives in the bundle
 * so the Guide tab opens at a pitch with no signal. `/hub` is `noindex` though,
 * while "how to teach a scrum to under 10s" is a question a volunteer types into
 * Google at ten o'clock on a Monday night. Without these the answer sits behind
 * a hash route nothing can index.
 *
 * Every word comes out of `hub/content/coaching.ts`, so a page cannot drift
 * from what the app shows. The blocks are rendered by `guideBlocks` in
 * `rulesPage.ts` rather than by a second copy of the same markup.
 *
 * What differs from the rules cluster is the footer. None of this is Regulation
 * 15: the rules inside it are, the order to teach them in is ours. So it wears
 * a note of its own rather than the one that says the RFU wrote it.
 */

import { esc } from "../lib/esc.js";
import { RULES_INDEX_PATH, page } from "./page.js";
import { guideBlocks, rulesPath } from "./rulesPage.js";
import { drillsFor, themePath } from "./drillPage.js";
import {
  AGE_GROUPS,
  AGE_GROUP_LABELS,
  CONTACT_GUIDANCE_URL,
  HEADCASE_URL,
  RULES_OF_PLAY,
  THEME_LABELS,
  THEME_MIN_AGE,
  ageAtLeast,
  rulesCheckedPhrase,
  type AgeGroup,
} from "../hub/content/types.js";
import {
  COACHING_GUIDES,
  COACHING_SOURCE_NOTE,
  coachingPath,
  type CoachingGuide,
} from "../hub/content/coaching.js";

/** Every page this module emits, for the sitemap and for the tests. */
export function coachingPagePaths(): string[] {
  return COACHING_GUIDES.map(coachingPath);
}

function link(text: string, href: string): string {
  return `<a href="${esc(href)}" rel="noopener">${esc(text)}</a>`;
}

/**
 * The grades this phase of play exists at, so the page can point at the drills
 * for each one. Off `THEME_MIN_AGE` rather than written down, which is the same
 * table the age gate itself runs on, then gated a second time on the theme
 * actually having drills at that grade. Without the second check this links a
 * page the drills generator never wrote.
 */
function gradesFor(guide: CoachingGuide): AgeGroup[] {
  return AGE_GROUPS.filter(
    (age) =>
      ageAtLeast(age, THEME_MIN_AGE[guide.theme]) && drillsFor(guide.theme, age).length > 0,
  );
}

function body(guide: CoachingGuide): string {
  const from = THEME_MIN_AGE[guide.theme];
  const label = AGE_GROUP_LABELS[from];

  return `        <h1>${esc(guide.title)}</h1>
        <p class="standfirst">${esc(guide.standfirst)}</p>

        <p><a class="cta" href="/hub?age=${from}#/guide/${esc(guide.slug)}">Read it in the app</a></p>
        <p class="home-microcopy">
          Free to read with no account. It works at a pitch with no signal too.
        </p>

${guide.sections
  .map((section) => `        <h2>${esc(section.heading)}</h2>\n${guideBlocks(section.blocks)}`)
  .join("\n\n")}

        <h2>Common questions</h2>
${guide.faqs
  .map((faq) => `        <h3>${esc(faq.question)}</h3>\n        <p>${esc(faq.answer)}</p>`)
  .join("\n")}

        <div class="note">
          <p>${esc(COACHING_SOURCE_NOTE)}</p>
          <p>${rulesCheckedPhrase()}.</p>
          <p>
            ${link(`The RFU's own ${label} rules of play`, RULES_OF_PLAY[from])}
            &middot;
            ${link("Their contact training guidance", CONTACT_GUIDANCE_URL)}
            &middot;
            ${link("Headcase, on concussion", HEADCASE_URL)}
          </p>
        </div>

        <h2>The drills that go with it</h2>
        <ul>
${gradesFor(guide)
  .map(
    (age) =>
      `          <li><a href="${themePath(guide.theme, age)}">${AGE_GROUP_LABELS[age]} ${esc(
        THEME_LABELS[guide.theme].toLowerCase(),
      )} drills</a></li>`,
  )
  .join("\n")}
        </ul>
        <p>
          <a href="${rulesPath(from)}">What ${label} is allowed to do</a> is the rules
          side of this, which is where every number on this page comes from.
        </p>

        <h2>The other coaching guides</h2>
        <ul>
${COACHING_GUIDES.filter((other) => other.slug !== guide.slug)
  .map(
    (other) =>
      `          <li><a href="${coachingPath(other)}">${esc(other.title)}</a></li>`,
  )
  .join("\n")}
        </ul>`;
}

export function coachingPageHtml(guide: CoachingGuide): string {
  const from = THEME_MIN_AGE[guide.theme];

  return page({
    path: coachingPath(guide),
    // Not the heading. The heading is written for somebody already on the page,
    // so "How to teach the scrum from scratch" reads right there. As a title tag
    // it competes with a software methodology, because it never says rugby.
    // At 67 characters Google cut the front of it off as well. The slug is the word somebody
    // types, which is why it is the slug, so the title is built off it and the
    // grade comes from the same table the rest of the page runs on.
    title: `How to Teach Rugby ${guide.slug[0].toUpperCase()}${guide.slug.slice(1)}, ${AGE_GROUP_LABELS[from]} and Up`,
    // Raw. `page()` escapes it, so escaping here would put entities in the
    // meta tags the first time a blurb is written with an apostrophe in it.
    // The blurb leads, because a snippet is cut from the right.
    description: `${guide.blurb} For a volunteer coaching ${AGE_GROUP_LABELS[from]} and up, from RFU Regulation 15.`,
    breadcrumb: [
      { name: "Rugby rules by age group", path: RULES_INDEX_PATH },
      { name: guide.title, path: coachingPath(guide) },
    ],
    faqs: guide.faqs,
    body: body(guide),
  });
}

/** Every page, keyed by the path it belongs at. What the build writes out. */
export function coachingPages(): Array<{ path: string; html: string }> {
  return COACHING_GUIDES.map((guide) => ({
    path: coachingPath(guide),
    html: coachingPageHtml(guide),
  }));
}
