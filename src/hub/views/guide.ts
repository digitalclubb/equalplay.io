import { esc } from "../../lib/esc.js";
import { ageRulesLink, rulesLink } from "../../lib/rulesLink.js";
import {
  AGE_GROUPS,
  AGE_GROUP_LABELS,
  AGE_GRADE_RESOURCES_URL,
  HALF_GAME_RULE_URL,
  REGULATION_15_URL,
  rulesCheckedPhrase,
  RULES_OF_PLAY,
  CONTACT_GUIDANCE_URL,
  HEADCASE_URL,
  THEME_MIN_AGE,
  THEME_SHORT,
  isAgeGroup,
  type AgeGroup,
  type Drill,
} from "../content/types.js";
import {
  ARRIVALS,
  GUIDES,
  GUIDE_BLURB,
  MIXED_RUGBY_NOTE,
  type Guide,
  type GuideBlock,
  type GuideTable,
} from "../content/guides.js";
import {
  COACHING_GUIDES,
  COACHING_SOURCE_NOTE,
  coachingGuide,
  coachingGuidesFor,
  type CoachingGuide,
} from "../content/coaching.js";
import { DRILLS } from "../content/drills.js";

/**
 * The rules guides. What each age grade is allowed to do, in plain English.
 *
 * The one part of the hub that is not gated by the coach's own grade. Everything
 * else is: a drill an U8 grade cannot do never appears in an U8 catalogue,
 * because handing it to them is a safety problem. A guide is the opposite of
 * that. It is the coach reading what their grade may do. A coach coming up to
 * U10 in September wants to read the U10 page in August, so hiding the grade
 * above yours would hide the one thing they came for.
 *
 * So it needs neither an account nor a grade. `main.ts` renders it before both
 * checks, the same way a shared session is rendered before the age picker.
 */

/** Every string in here is escaped, so the content module holds plain text. */
function table(t: GuideTable): string {
  // The first column heads the rows, so it is usually blank and wants a label
  // only a screen reader hears. Not always though: the arrivals table calls it
  // Grade. Substituting unconditionally left that one with an empty cell on
  // screen and the word "Row" read out where "Grade" belongs.
  const head = t.head
    .map((h, i) =>
      i === 0 && !h
        ? `<th scope="col"><span class="visually-hidden">Row</span></th>`
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
  return `
    <div class="guide-scroll">
      <table class="guide-table">
        <caption>${esc(t.caption)}</caption>
        <thead><tr>${head}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

/**
 * The drills behind a step of a progression.
 *
 * Resolved against the catalogue rather than written out, so a renamed drill
 * follows on its own. An id with no drill behind it is dropped rather than
 * rendered as a dead link. `coaching.test.ts` fails on it separately, which is
 * the pair of behaviours a broken reference wants: quiet on screen, loud in the
 * build.
 */
function drillLinks(ids: string[]): string {
  const found = ids
    .map((id) => DRILLS.find((drill) => drill.id === id))
    .filter((drill): drill is Drill => Boolean(drill));
  if (!found.length) return "";
  return `<ul class="guide-list guide-drills">${found
    .map(
      (drill) =>
        `<li><a href="#/catalogue/${esc(drill.id)}">${esc(drill.title)}</a>, ${drill.minutes} minutes</li>`,
    )
    .join("")}</ul>`;
}

function block(b: GuideBlock): string {
  if ("subheading" in b) return `<h4>${esc(b.subheading)}</h4>`;
  if ("text" in b) return `<p>${esc(b.text)}</p>`;
  if ("table" in b) return table(b.table);
  if ("drills" in b) return drillLinks(b.drills);
  return `<ul class="guide-list">${b.items
    .map(
      (item) =>
        `<li>${item.lead ? `<strong>${esc(item.lead)}</strong> ` : ""}${esc(item.text)}</li>`,
    )
    .join("")}</ul>`;
}

function guidePage(guide: Guide, coachAge?: AgeGroup): string {
  const label = AGE_GROUP_LABELS[guide.ageGroup];
  const i = AGE_GROUPS.indexOf(guide.ageGroup);
  const previous = AGE_GROUPS[i - 1];
  const next = AGE_GROUPS[i + 1];

  const sections = guide.sections
    .map(
      (section) => `
      <section class="guide-section">
        <h3>${esc(section.heading)}</h3>
        ${section.blocks.map(block).join("\n        ")}
      </section>`,
    )
    .join("");

  const faqs = guide.faqs
    .map(
      (faq) => `
        <div class="guide-faq">
          <h4>${esc(faq.question)}</h4>
          <p>${esc(faq.answer)}</p>
        </div>`,
    )
    .join("");

  const step = (age: AgeGroup | undefined, dir: string, which: string): string =>
    age
      ? `<a class="guide-step guide-step-${dir}" href="#/guide/${age}">
           <span class="guide-step-dir">${which}</span>
           <span class="guide-step-grade">${AGE_GROUP_LABELS[age]}</span>
         </a>`
      : "";

  // Everything this grade may teach, newest first. A grade guide that says the
  // scrum arrives at U10 and then leaves a volunteer to work out what to do
  // about it is the page stopping one step short of the thing they came for.
  const teaching = coachingGuidesFor(guide.ageGroup);
  const teachingSection = teaching.length
    ? `
      <section class="guide-section">
        <h3>How to teach it</h3>
        <p>
          Everything above is what ${label} is allowed to do. Here is how to
          teach it, step by step, written for a coach who never played.
        </p>
        <ul class="guide-list">
          ${teaching
            .map(
              (one) =>
                `<li><a href="#/guide/${esc(one.slug)}">${esc(one.title)}</a> ${esc(one.blurb)}</li>`,
            )
            .join("\n          ")}
        </ul>
      </section>`
    : "";

  return `
    <article class="guide">
      <header class="guide-header">
        <p class="guide-back"><a href="#/guide">All age grades</a></p>
        <span class="guide-eyebrow">${label} &middot; RFU Regulation 15</span>
        <h2 class="guide-title">${esc(guide.title)}</h2>
        <p class="guide-lede">${esc(guide.standfirst)}</p>
        ${coachAge === guide.ageGroup ? `<p class="guide-yours">The grade you coach</p>` : ""}
      </header>
      ${sections}
      ${teachingSection}

      <section class="guide-section">
        <h3>Common questions</h3>
        ${faqs}
      </section>

      <footer class="guide-source">
        <p>
          Everything here is written from the RFU's own rules of play for the grade.
          They are reissued every summer, so read this season's there rather than
          trusting a summary. Ours included. If a referee on Sunday says something
          different to this page, they are right.
        </p>
        <p>${rulesCheckedPhrase()}.</p>
        <p>
          ${ageRulesLink(label, RULES_OF_PLAY[guide.ageGroup])}
          &middot;
          <a class="rules-link-plain" href="mailto:hello@equalplay.io?subject=Equal%20Play%3A%20something%20is%20wrong">Tell us if this is wrong</a>
        </p>
      </footer>

      <nav class="guide-steps" aria-label="Other age grades">
        ${step(previous, "prev", "Back to")}
        ${step(next, "next", "On to")}
      </nav>
    </article>`;
}

/**
 * A coaching guide. How to teach one phase of play, rather than what the rules
 * allow at it.
 *
 * Same blocks, same renderer, same escaping as a rules guide, so the two cannot
 * drift into two shapes. What differs is the footer: none of this is Regulation
 * 15, so it must not wear the note that says it came from the RFU.
 */
function coachingPage(guide: CoachingGuide): string {
  const from = THEME_MIN_AGE[guide.theme];
  const sections = guide.sections
    .map(
      (section) => `
      <section class="guide-section">
        <h3>${esc(section.heading)}</h3>
        ${section.blocks.map(block).join("\n        ")}
      </section>`,
    )
    .join("");

  const faqs = guide.faqs
    .map(
      (faq) => `
        <div class="guide-faq">
          <h4>${esc(faq.question)}</h4>
          <p>${esc(faq.answer)}</p>
        </div>`,
    )
    .join("");

  return `
    <article class="guide">
      <header class="guide-header">
        <p class="guide-back"><a href="#/guide">All guides</a></p>
        <span class="guide-eyebrow">Coaching &middot; from ${AGE_GROUP_LABELS[from]}</span>
        <h2 class="guide-title">${esc(guide.title)}</h2>
        <p class="guide-lede">${esc(guide.standfirst)}</p>
      </header>
      ${sections}

      <section class="guide-section">
        <h3>Common questions</h3>
        ${faqs}
      </section>

      <section class="guide-section">
        <h3>Where to go next</h3>
        <ul class="guide-list">
          <li><a href="#/guide/${from}">What ${AGE_GROUP_LABELS[from]} is allowed to do</a>
            is the rules side of this, which is where the numbers come from.</li>
          <li><a href="#/catalogue">Every drill your grade can do</a>, then tap the
            ${esc(THEME_SHORT[guide.theme])} chip for the ones on this page.</li>
        </ul>
      </section>

      <footer class="guide-source">
        <p>${esc(COACHING_SOURCE_NOTE)}</p>
        <p>${rulesCheckedPhrase()}.</p>
        <p>
          ${ageRulesLink(AGE_GROUP_LABELS[from], RULES_OF_PLAY[from])}
          &middot;
          ${rulesLink("The RFU's own contact guidance", CONTACT_GUIDANCE_URL)}
          &middot;
          ${rulesLink("Headcase, on concussion", HEADCASE_URL)}
          &middot;
          <a class="rules-link-plain" href="mailto:hello@equalplay.io?subject=Equal%20Play%3A%20something%20is%20wrong">Tell us if this is wrong</a>
        </p>
      </footer>
    </article>`;
}

function guideIndex(coachAge?: AgeGroup): string {
  const cards = AGE_GROUPS.map((age) => {
    const yours = age === coachAge;
    return `
      <a class="guide-card${yours ? " is-yours" : ""}" href="#/guide/${age}">
        <span class="guide-card-grade">
          ${AGE_GROUP_LABELS[age]}
          ${yours ? `<span class="guide-card-meta">Your grade</span>` : ""}
        </span>
        <span class="guide-card-title">${esc(GUIDES[age].title)}</span>
        <span class="guide-card-blurb">${esc(GUIDE_BLURB[age])}</span>
      </a>`;
  }).join("");

  // A grade card leads on the grade, because "U10" is what a coach is looking
  // for. A coaching card has no such token: the title is the thing being picked,
  // so it leads and the grade it starts at is the small print. Shipped the other
  // way round first, which put "From U10" at 1.5rem over the sentence that says
  // what the card is.
  const coachingCards = COACHING_GUIDES.map(
    (guide) => `
      <a class="guide-card is-coaching" href="#/guide/${esc(guide.slug)}">
        <span class="guide-card-meta">From ${AGE_GROUP_LABELS[THEME_MIN_AGE[guide.theme]]}</span>
        <span class="guide-card-title">${esc(guide.title)}</span>
        <span class="guide-card-blurb">${esc(guide.blurb)}</span>
      </a>`,
  ).join("");

  return `
    <article class="guide">
      <header class="guide-header">
        <span class="guide-eyebrow">RFU Regulation 15</span>
        <h2 class="guide-title">What your grade plays and how to teach it</h2>
        <p class="guide-lede">
          Regulation 15 decides what a minis grade may do rather than a coach's
          judgement. Pick your grade for the rules, or a phase of play for how to
          teach it.
        </p>
      </header>

      <section class="guide-section">
        <h3>Pick your grade</h3>
        <div class="guide-grid">${cards}</div>
      </section>

      <section class="guide-section">
        <h3>How to teach it</h3>
        <div class="guide-grid">${coachingCards}</div>
      </section>

      <section class="guide-section">
        <h3>When each part of the game arrives</h3>
        ${table(ARRIVALS)}
        <p>
          There is no lineout at any minis grade. It turns up at U14, with lifting
          held back until U15, so nothing between here and then needs a throw
          practised at training.
        </p>
        <p>${esc(MIXED_RUGBY_NOTE)}</p>
      </section>

      <section class="guide-section">
        <h3>The same at every grade</h3>
        <ul class="guide-list">
          <li><strong>${rulesLink("The Half Game Rule", HALF_GAME_RULE_URL)}.</strong>
            Every player in the squad gets at least half of the playing time. Across a festival that is half of the
            morning rather than half of each game. It is the one clubs get wrong most
            often, so Match day checks it for you.</li>
          <li><strong>Rolling substitutions, unlimited.</strong> Only when the ball is
            dead, always with the referee's permission. A player who comes off can go
            back on.</li>
          <li><strong>No sin bin anywhere in minis.</strong> The referee sorts it out
            with the coaches on the touchline and the sides stay even.</li>
          <li><strong>Coaches stay off the pitch</strong> while the ball is in play. The
            referee is expected to talk the players through it instead.</li>
          <li><strong>Pitch sizes are maximums.</strong> A referee and both coaches can
            agree something smaller whenever they think it is safer.</li>
          <li><strong>Squeezeball is banned</strong> and no coach may teach it, at any
            grade.</li>
        </ul>
      </section>

      <footer class="guide-source">
        <p>
          Equal Play is not affiliated with the RFU. Regulation 15 is theirs. These
          pages put it in our own words, so they are a summary rather than the thing
          itself. It is reissued every summer as well.
        </p>
        <p>${rulesCheckedPhrase()}.</p>
        <p>
          ${rulesLink("Regulation 15 in full", REGULATION_15_URL)}
          &middot;
          ${rulesLink("Everything the RFU publishes for age grade coaches", AGE_GRADE_RESOURCES_URL)}
          &middot;
          <a class="rules-link-plain" href="mailto:hello@equalplay.io?subject=Equal%20Play%3A%20something%20is%20wrong">Tell us if this is wrong</a>
        </p>
      </footer>
    </article>`;
}

/**
 * `param` is the age grade in `#/guide/<age>`, or absent for the index. Anything
 * that is not a grade falls back to the index rather than erroring: a guide is
 * reference material, so a mistyped link should land somewhere useful.
 */
export function renderGuide(
  container: HTMLElement,
  param: string | undefined,
  coachAge?: AgeGroup,
): void {
  const age = param && isAgeGroup(param) ? param : undefined;
  // A coaching guide is addressed by its slug rather than by a grade, so it is
  // checked first. Anything that is neither still falls back to the index.
  const coaching = age ? undefined : coachingGuide(param);
  container.innerHTML = age
    ? guidePage(GUIDES[age], coachAge)
    : coaching
      ? coachingPage(coaching)
      : guideIndex(coachAge);
  // The window is the scroller, not the container. Stepping from a long U10 page
  // to U11 used to drop you halfway down it.
  window.scrollTo(0, 0);
}
