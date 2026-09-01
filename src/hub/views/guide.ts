import { esc } from "../../lib/esc.js";
import { ageRulesLink, rulesLink } from "../../lib/rulesLink.js";
import {
  AGE_GROUPS,
  AGE_GROUP_LABELS,
  HALF_GAME_RULE_URL,
  REGULATION_15_URL,
  rulesCheckedPhrase,
  RULES_OF_PLAY,
  isAgeGroup,
  type AgeGroup,
} from "../content/types.js";
import {
  ARRIVALS,
  GUIDES,
  GUIDE_BLURB,
  type Guide,
  type GuideBlock,
  type GuideTable,
} from "../content/guides.js";

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

function block(b: GuideBlock): string {
  if ("subheading" in b) return `<h4>${esc(b.subheading)}</h4>`;
  if ("text" in b) return `<p>${esc(b.text)}</p>`;
  if ("table" in b) return table(b.table);
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
        <p>${ageRulesLink(label, RULES_OF_PLAY[guide.ageGroup])}</p>
      </footer>

      <nav class="guide-steps" aria-label="Other age grades">
        ${step(previous, "prev", "Back to")}
        ${step(next, "next", "On to")}
      </nav>
    </article>`;
}

function guideIndex(coachAge?: AgeGroup): string {
  const cards = AGE_GROUPS.map((age) => {
    const yours = age === coachAge;
    return `
      <a class="guide-card${yours ? " is-yours" : ""}" href="#/guide/${age}">
        <span class="guide-card-grade">
          ${AGE_GROUP_LABELS[age]}
          ${yours ? `<span class="guide-card-yours">Your grade</span>` : ""}
        </span>
        <span class="guide-card-title">${esc(GUIDES[age].title)}</span>
        <span class="guide-card-blurb">${esc(GUIDE_BLURB[age])}</span>
      </a>`;
  }).join("");

  return `
    <article class="guide">
      <header class="guide-header">
        <span class="guide-eyebrow">RFU Regulation 15</span>
        <h2 class="guide-title">What your grade plays</h2>
        <p class="guide-lede">
          Regulation 15 decides what a minis grade may do rather than a coach's
          judgement. One page per grade, saying what arrives, what goes and what
          to get in before the season starts.
        </p>
      </header>

      <section class="guide-section">
        <h3>When each part of the game arrives</h3>
        ${table(ARRIVALS)}
        <p>
          There is no lineout at any minis grade. It turns up at U14, with lifting
          held back until U15, so nothing between here and then needs a throw
          practised at training.
        </p>
        <p>
          Boys and girls play together all the way through U11. At U12 the game
          splits into separate bands and the girls in your squad move into girls'
          rugby. Training is a different matter: a non-contact session with nothing
          competitive in it can be mixed at any age, once you have judged it safe.
        </p>
      </section>

      <section class="guide-section">
        <h3>Pick a grade</h3>
        <div class="guide-grid">${cards}</div>
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
        <p>${rulesLink("Regulation 15 in full", REGULATION_15_URL)}</p>
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
  container.innerHTML = age ? guidePage(GUIDES[age], coachAge) : guideIndex(coachAge);
  // The window is the scroller, not the container. Stepping from a long U10 page
  // to U11 used to drop you halfway down it.
  window.scrollTo(0, 0);
}
