import { esc } from "../../lib/esc.js";
import { rulesLink } from "../../lib/rulesLink.js";
import {
  AGE_GRADE_RESOURCES_URL,
  AGE_GROUP_LABELS,
  HEADCASE_URL,
  REGULATION_15_URL,
  THEME_SHORT,
  rulesCheckedPhrase,
  type AgeGroup,
} from "../content/types.js";
import {
  QUESTIONS,
  QUESTION_TOPICS,
  TOPICS,
  isQuestionTopic,
  questionGrades,
  questionsFor,
  searchQuestions,
  topicGrades,
  type Question,
  type QuestionTopic,
} from "../content/questions.js";

/**
 * The answers, searchable, grouped by what was happening at the time.
 *
 * Not age gated, for the same reason the guide is not. Every other route hides
 * what the coach's grade may not do, because handing an U8 a ruck drill is a
 * safety problem. This is the opposite of a drill: it is somebody asking what
 * the rule is, usually because it has just happened in front of them. Hiding
 * the answer because it belongs to the grade above would hide the thing they
 * came for. A coach going up in September needs to read next season now.
 *
 * What pays for that is the grade on every single answer. A rule quoted with
 * no grade attached is how an U8 coach ends up coaching a ruck, so
 * `questionGrades` runs on every one of them and `questions.test.ts` fails if
 * one renders without it.
 *
 * So `main.ts` renders this before the account check and before the age
 * picker, the same way the guide and a shared session come before both.
 */

/**
 * What a coach has typed, held here rather than read back off the input.
 *
 * `render()` in `main.ts` runs on plenty of things that are not a coach
 * navigating: a token refresh an hour in, the tab coming back to the
 * foreground, the browser announcing it is online again. Each of those rebuilds
 * this view. A query living only in the DOM is a query that empties itself the
 * moment the phone finds signal, which is exactly the touchline moment this tab
 * exists for. The catalogue keeps its filters out here for the same reason.
 */
let term = "";

/** Dropped with everything else belonging to a coach when one signs out. */
export function resetQuestions(): void {
  term = "";
}

/**
 * Every string here is escaped, so the content module holds plain text.
 *
 * `caption` is off on a topic whose answers all hold for the same grades,
 * because the page has said so once at the top and repeating it nine times is
 * the caption saying nothing. See `topicGrades`.
 */
function answer(question: Question, opts: { topic?: boolean; caption?: boolean } = {}): string {
  const { topic = false, caption = true } = opts;
  const label = topic ? ` &middot; ${esc(TOPICS[question.topic].label)}` : "";
  return `
    <div class="guide-faq">
      ${caption ? `<span class="guide-card-meta">${esc(questionGrades(question))}${label}</span>` : ""}
      <h4>${esc(question.question)}</h4>
      <p>${esc(question.answer)}</p>
    </div>`;
}

function topicCards(): string {
  return QUESTION_TOPICS.map((topic) => {
    const meta = TOPICS[topic];
    const count = questionsFor(topic).length;
    return `
      <a class="guide-card is-coaching" href="#/answers/${topic}">
        <span class="guide-card-meta">${count} ${count === 1 ? "question" : "questions"}</span>
        <span class="guide-card-title">${esc(meta.label)}</span>
        <span class="guide-card-blurb">${esc(meta.blurb)}</span>
      </a>`;
  }).join("");
}

/**
 * What sits under the search box: the topics, or the matches.
 *
 * Only this part is redrawn as a coach types, which is what keeps the caret
 * where they left it. The catalogue has to restore one because it replaces the
 * whole view; here there is nothing to restore. No debounce either: this is
 * `QUESTIONS.length` short strings and a substring test, rather than seventy
 * cards each carrying a diagram.
 */
/**
 * What the search just did, for somebody who cannot see the list change.
 *
 * Its own element rather than a live region around the results, because a
 * polite region wrapping seventy answers reads the answers out. This is one
 * short string, so each keystroke replaces the last rather than queueing a
 * paragraph behind it.
 */
function count(term: string): string {
  if (!term.trim()) return `${QUESTIONS.length} answers, in ${QUESTION_TOPICS.length} topics`;
  const found = searchQuestions(term).length;
  if (!found) return `Nothing matches ${term}`;
  return `${found} ${found === 1 ? "answer" : "answers"}`;
}

function results(term: string): string {
  if (!term.trim()) {
    return `
      <section class="guide-section">
        <h3>Pick what was happening</h3>
        <div class="guide-grid">${topicCards()}</div>
      </section>`;
  }

  const found = searchQuestions(term);
  if (!found.length) {
    return `
      <section class="guide-section">
        <h3>Nothing matches "${esc(term)}"</h3>
        <p>
          Try the word a referee would use rather than the one a commentator
          would. If it isn't here, it's worth telling us about.
        </p>
        <p><button type="button" class="hub-btn" data-clear-search>Show every topic</button></p>
      </section>`;
  }

  return `
    <section class="guide-section">
      <h3>${found.length} ${found.length === 1 ? "answer" : "answers"}</h3>
      ${found.map((question) => answer(question, { topic: true })).join("")}
    </section>`;
}

function index(coachAge?: AgeGroup): string {
  return `
    <article class="guide answers">
      <header class="guide-header">
        <span class="guide-eyebrow">Answers &middot; RFU Regulation 15</span>
        <h2 class="guide-title">The questions that come up on a Sunday</h2>
        <p class="guide-lede">
          ${QUESTIONS.length} short answers for the things that happen in front of
          you. Search for what you saw, or pick where it happened.
        </p>
      </header>

      <div class="answers-search" role="search">
        <label class="visually-hidden" for="answers-search">Search the answers</label>
        <input
          id="answers-search"
          type="search"
          autocomplete="off"
          value="${esc(term)}"
          placeholder="wrong side, high tackle, half game"
        />
      </div>

      <p class="visually-hidden" role="status" id="answers-count">${esc(count(term))}</p>
      <div id="answers-results">${results(term)}</div>

      <footer class="guide-source">
        <p>
          These are our words rather than the RFU's. Regulation 15 is theirs and it
          is reissued every summer, so read this season's there rather than trusting
          a summary on somebody else's website. Ours included. If a referee on Sunday
          says something different to this page, they're right.
        </p>
        <p>${rulesCheckedPhrase()}.</p>
        <p>
          ${rulesLink("Regulation 15 in full", REGULATION_15_URL)}
          &middot;
          <a class="rules-link-plain" href="#/guide">What your own grade may do${
            coachAge ? `, ${AGE_GROUP_LABELS[coachAge]}` : ""
          }</a>
          &middot;
          <a class="rules-link-plain" href="mailto:hello@equalplay.io?subject=Equal%20Play%3A%20a%20question%20that%20is%20not%20answered">Ask us one that isn't here</a>
        </p>
      </footer>
    </article>`;
}

function topicPage(topic: QuestionTopic): string {
  const meta = TOPICS[topic];
  const questions = questionsFor(topic);
  // Stated once where every answer agrees, on each answer where they do not.
  const shared = topicGrades(topic);
  const i = QUESTION_TOPICS.indexOf(topic);
  const previous = QUESTION_TOPICS[i - 1];
  const next = QUESTION_TOPICS[i + 1];

  const step = (other: QuestionTopic | undefined, dir: string, which: string): string =>
    other
      ? `<a class="guide-step guide-step-${dir}" href="#/answers/${other}">
           <span class="guide-step-dir">${which}</span>
           <span class="guide-step-grade">${esc(TOPICS[other].label)}</span>
         </a>`
      : "";

  return `
    <article class="guide answers">
      <header class="guide-header">
        <p class="guide-back"><a href="#/answers">All the questions</a></p>
        <span class="guide-eyebrow">${
          shared ? esc(shared) : `${questions.length} questions`
        } &middot; RFU Regulation 15</span>
        <h2 class="guide-title">${esc(meta.label)}</h2>
        <p class="guide-lede">${esc(meta.blurb)}</p>
      </header>

      <section class="guide-section">
        <h3>The answers</h3>
        ${questions.map((question) => answer(question, { caption: !shared })).join("")}
      </section>

      <section class="guide-section">
        <h3>Where to go next</h3>
        <ul class="guide-list">
          <li><a href="#/guide">What each grade is allowed to do</a>, which is where
            every number above comes from.</li>
          ${
            meta.theme
              ? `<li><a href="#/catalogue">Every drill your grade can do</a>, then tap the
                   ${esc(THEME_SHORT[meta.theme])} chip for the ones this covers.</li>`
              : `<li><a href="#/plans">A ready-made session</a>, if what you actually
                   need is an hour planned rather than a rule.</li>`
          }
        </ul>
      </section>

      <footer class="guide-source">
        <p>
          Our words rather than the RFU's. Regulation 15 is theirs and it's reissued
          every summer. If a referee on Sunday says something different to this page,
          they're right.
        </p>
        <p>${rulesCheckedPhrase()}.</p>
        <p>
          ${rulesLink("Regulation 15 in full", REGULATION_15_URL)}
          &middot;
          ${
            topic === "safety"
              ? rulesLink("Headcase, on concussion", HEADCASE_URL)
              : rulesLink("Everything the RFU publishes for age grade coaches", AGE_GRADE_RESOURCES_URL)
          }
          &middot;
          <a class="rules-link-plain" href="mailto:hello@equalplay.io?subject=Equal%20Play%3A%20something%20is%20wrong">Tell us if this is wrong</a>
        </p>
      </footer>

      <nav class="guide-steps" aria-label="Other topics">
        ${step(previous, "prev", "Back to")}
        ${step(next, "next", "On to")}
      </nav>
    </article>`;
}

/**
 * `param` is the topic in `#/answers/<topic>`, or absent for the index. Anything
 * that is not a topic falls back to the index rather than erroring, the same
 * way a mistyped guide route does: this is reference material, so a bad link
 * should land somewhere useful.
 */
export function renderQuestions(
  container: HTMLElement,
  param: string | undefined,
  coachAge?: AgeGroup,
): void {
  const topic = isQuestionTopic(param) ? param : undefined;
  container.innerHTML = topic ? topicPage(topic) : index(coachAge);

  if (!topic) {
    const box = container.querySelector<HTMLInputElement>("#answers-search");
    const shown = container.querySelector<HTMLElement>("#answers-results");
    const said = container.querySelector<HTMLElement>("#answers-count");
    const draw = (): void => {
      if (!shown || !box) return;
      term = box.value;
      shown.innerHTML = results(term);
      // textContent rather than innerHTML. It carries the one string on the
      // page a coach typed, which is never markup.
      if (said) said.textContent = count(term);
    };
    box?.addEventListener("input", draw);
    // Delegated, because the button only exists while nothing matches and the
    // element carrying it is replaced on the next keystroke.
    shown?.addEventListener("click", (event) => {
      if (!(event.target as HTMLElement).closest("[data-clear-search]") || !box) return;
      box.value = "";
      draw();
      box.focus();
    });
  }

  // The window is the scroller, not the container. Stepping between topics
  // otherwise drops you halfway down the one you just left.
  window.scrollTo(0, 0);
}
