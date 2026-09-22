/**
 * The answers, rendered as static pages a search engine can read.
 *
 * Same argument as the rules pages and the coaching guides beside them. The
 * answers live in the bundle so the FAQs tab opens at a pitch with no signal.
 * `/hub` is `noindex` though. "What happens if the ball comes out the wrong
 * side of the scrum" is a question somebody types into Google from a car park
 * before they have got the engine started.
 *
 * This is the cluster those queries land on. One page per topic rather than
 * one per question, because a page holding a single Q and A is a thin page
 * competing with sixty-odd of its own siblings. One page holding all of them
 * ranks for nothing in particular. A topic is the unit somebody searches.
 *
 * Every word comes out of `hub/content/questions.ts`, so a page cannot drift
 * from what the app shows.
 *
 * Emitted at build by the `staticPages` plugin in `vite.config.ts`, into
 * `dist/` rather than into `public/`. A copy in `public/` would be a second
 * source of truth going stale, which `landing-pages.test.ts` has a guard
 * against.
 */

import { esc } from "../lib/esc.js";
import { RULES_INDEX_PATH, page } from "./page.js";
import { rulesPath } from "./rulesPage.js";
import {
  QUESTIONS,
  QUESTIONS_INDEX_PATH,
  QUESTION_TOPICS,
  TOPICS,
  questionGrades,
  questionsFor,
  questionsPath,
  topicGrades,
  type Question,
  type QuestionTopic,
} from "../hub/content/questions.js";
import {
  AGE_GROUPS,
  AGE_GROUP_LABELS,
  REGULATION_15_URL,
  rulesCheckedPhrase,
} from "../hub/content/types.js";

/** Every page this module emits, for the sitemap and for the tests. */
export function questionPagePaths(): string[] {
  return [QUESTIONS_INDEX_PATH, ...QUESTION_TOPICS.map(questionsPath)];
}

/**
 * What each topic puts in front of a search engine.
 *
 * Written out rather than built off the label, because a title is the whole of
 * what most people see and a template that says "The scrum in rugby" for one
 * topic says "Running a session in rugby" for another. Every one names the
 * sport: a generated title that does not is a page competing for somebody
 * else's word. See the coaching guides, which shipped titled "How to teach the
 * scrum from scratch" and lost to a software methodology.
 */
const SEO: Record<QuestionTopic, { title: string; description: string }> = {
  tag: {
    title: "Tag Rugby Rules Explained, U7 and U8 Questions",
    description:
      "Tags, the three second count, the six tag turnover plus what a tagged player may still do. The U7 and U8 questions a new coach asks, answered from RFU Regulation 15.",
  },
  tackle: {
    title: "Youth Rugby Tackle Rules, U9 and Up Questions",
    description:
      "How high a child may tackle, what counts as held, what the tackler does next plus why nobody contests the ball at U9. Answered from RFU Regulation 15.",
  },
  ruck: {
    title: "Rugby Ruck and Maul Rules for U10 to U12",
    description:
      "How many players may join a ruck at each grade, what the referee means by Use it, where the offside line sits plus when a tackler may play the ball.",
  },
  scrum: {
    title: "Youth Rugby Scrum Rules, U10 to U12 Questions",
    description:
      "What happens when the ball comes out the wrong side, how many players are in a scrum, who goes in the front row plus why nobody pushes in minis rugby.",
  },
  restarts: {
    title: "Rugby Free Pass and Restart Rules, U7 to U12",
    description:
      "Free passes, free kicks, drop kick restarts, what happens at touch plus why there is no lineout at any minis rugby grade. Answered from RFU Regulation 15.",
  },
  kicking: {
    title: "Rugby Kicking Rules for U11 and U12",
    description:
      "When children may start kicking a rugby ball, which kicks are allowed, what a mark is plus the U11 knock on rule that looks wrong to every parent.",
  },
  "match-day": {
    title: "Minis Rugby Match Day Rules and Playing Time",
    description:
      "The Half Game Rule, rolling substitutions, how long a game is at each grade plus what to do when the two squads are different sizes.",
  },
  referee: {
    title: "Minis Rugby Refereeing Questions for Coaches",
    description:
      "Who referees a minis rugby game, what a referee can give, why there is no sin bin plus what a coach is allowed to do from the touchline.",
  },
  safety: {
    title: "Youth Rugby Safety Questions for Volunteer Coaches",
    description:
      "Head knocks, mouthguards, frozen pitches, mismatched sizes, mixed rugby plus why squeezeball is banned at every age grade. Written for a volunteer coach.",
  },
  coaching: {
    title: "Running a Minis Rugby Training Session, Questions",
    description:
      "How long a session should be, how many drills to plan, how many helpers you need plus whether you can coach rugby having never played it.",
  },
};

/**
 * One answer, as page markup.
 *
 * The grade goes above the question rather than inside the answer. This cluster
 * is not filtered by grade the way a theme page is, so a rule with no grade
 * attached is how an U8 coach ends up reading a ruck answer as though it were
 * theirs. Keeping it out of the paragraph also leaves the visible answer
 * identical to the one in the FAQ structured data, which is what Google checks
 * before it shows either.
 *
 * `caption` is off where the whole topic holds for the same grades and the page
 * has already said so once. Nine answers each captioned "U10 and up" is the
 * caption saying nothing. See `topicGrades`.
 *
 * Where it is on it goes under the answer rather than over the question, which
 * is the opposite of the app. `pages.css` gives a paragraph 1rem beneath it and
 * an `h3` 1.75rem above, so a caption placed before the question sits nearer
 * the answer above it than the question it labels: "U12 and up" ended up
 * reading as a caveat on the U9 answer before it. The app puts it over the
 * question because `.guide-faq` draws a rule between the blocks, so there is
 * nothing to be nearer to. Underneath needs no rule and no wrapper.
 */
function answer(question: Question, caption: boolean): string {
  const grades = caption
    ? `\n        <p class="calc-detail">${esc(questionGrades(question))}</p>`
    : "";
  return `        <h3>${esc(question.question)}</h3>
        <p>${esc(question.answer)}</p>${grades}`;
}

function sourceNote(): string {
  return `        <div class="note">
          <p>
            Equal Play is not affiliated with the RFU. Regulation 15 is theirs. These
            answers put it in our own words, so they are a summary rather than the thing
            itself. It is reissued every summer as well, so read this season's there
            rather than trusting a copy on somebody else's website. Ours included. If a
            referee on Sunday says something different to this page, they are right.
          </p>
          <p>${rulesCheckedPhrase()}.</p>
          <p>
            <a href="${esc(REGULATION_15_URL)}" rel="noopener">Regulation 15 in full</a>
            &middot;
            <a href="mailto:hello@equalplay.io?subject=Equal%20Play%3A%20something%20is%20wrong">Tell us if this is wrong</a>
          </p>
        </div>`;
}

function body(topic: QuestionTopic): string {
  const meta = TOPICS[topic];
  const questions = questionsFor(topic);
  const others = QUESTION_TOPICS.filter((other) => other !== topic);
  // Stated once where every answer agrees, on each answer where they do not.
  const shared = topicGrades(topic);

  return `        <h1>${esc(meta.label)}, the questions that come up</h1>
        <p class="standfirst">${esc(meta.blurb)}</p>
${shared ? `        <p class="calc-detail">${esc(shared)}</p>\n` : ""}
        <p><a class="cta" href="/hub#/faqs/${topic}">Read these in the app</a></p>
        <p class="home-microcopy">
          Free to read with no account. They work at a pitch with no signal too.
        </p>

        <h2>The answers</h2>

${questions.map((question) => answer(question, !shared)).join("\n\n")}

${sourceNote()}

        <h2>What your grade is allowed to do</h2>
        <p>
          The answers above say what the rule is. The rules guides say what a whole
          grade may do, which is the thing to read in August rather than in a car park.
        </p>
        <ul>
${AGE_GROUPS.map(
  (age) =>
    `          <li><a href="${rulesPath(age)}">What ${AGE_GROUP_LABELS[age]} rugby looks like</a></li>`,
).join("\n")}
        </ul>

        <h2>The other questions</h2>
        <ul>
${others
  .map(
    (other) =>
      `          <li><a href="${questionsPath(other)}">${esc(TOPICS[other].label)}</a>. ${esc(
        TOPICS[other].blurb,
      )}</li>`,
  )
  .join("\n")}
        </ul>
        <p>
          <a href="${QUESTIONS_INDEX_PATH}">Every topic in one place</a> is the way in.
          The app searches the answers themselves, which is what you want when you
          know what you saw rather than what it is called.
        </p>`;
}

export function questionPageHtml(topic: QuestionTopic): string {
  const meta = TOPICS[topic];

  return page({
    path: questionsPath(topic),
    title: SEO[topic].title,
    // Raw, like every other field here. `page()` escapes it, so escaping it
    // twice would put entities into three meta tags the moment one of these is
    // written with an apostrophe in it.
    description: SEO[topic].description,
    breadcrumb: [
      { name: "Rugby questions answered", path: QUESTIONS_INDEX_PATH },
      { name: meta.label, path: questionsPath(topic) },
    ],
    faqs: questionsFor(topic),
    body: body(topic),
  });
}

export function questionIndexHtml(): string {
  const cards = QUESTION_TOPICS.map((topic) => {
    const count = questionsFor(topic).length;
    return `          <li>
            <a href="${questionsPath(topic)}"><strong>${esc(TOPICS[topic].label)}</strong></a>
            ${esc(TOPICS[topic].blurb)} ${count} ${count === 1 ? "question" : "questions"}.
          </li>`;
  }).join("\n");

  const body = `        <h1>Rugby questions a minis coach actually asks</h1>
        <p class="standfirst">
          ${QUESTIONS.length} short answers for the things that happen in front of you on a
          Sunday. What the referee just gave, what your grade is allowed to do about it
          plus what to do next. Written for a volunteer rather than for somebody who
          played.
        </p>

        <p><a class="cta" href="/hub#/faqs">Search them in the app</a></p>
        <p class="home-microcopy">
          Free to read with no account. They work at a pitch with no signal too.
        </p>

        <h2>Pick what was happening</h2>
        <ul>
${cards}
        </ul>

        <h2>Why this is written down rather than generated</h2>
        <p>
          Every answer here was written once and checked against the RFU's own
          appendices once, then reviewed like any other change to this site. An answer
          made up on the spot could not be checked by anybody, would need a signal at a
          pitch to exist at all and would cheerfully explain a contested scrum to an U9
          coach who asked politely. Age grade rugby is the wrong place for a confident
          guess.
        </p>

${sourceNote()}

        <h2>What each grade plays</h2>
        <p>
          <a href="${RULES_INDEX_PATH}">Rugby rules by age group</a> is one page per grade
          from U7 to U12, saying what arrives, what goes plus what to get in before the
          season starts. <a href="/rugby-drills-by-age-group">Rugby drills by age group</a>
          is the same split applied to training.
        </p>`;

  return page({
    path: QUESTIONS_INDEX_PATH,
    title: "Rugby Questions Answered, U7 to U12 Minis Coaching",
    description:
      "Short answers to the questions a minis rugby coach asks on a Sunday. Scrums, tackles, rucks, tag, playing time plus the referee, written from RFU Regulation 15.",
    breadcrumb: [{ name: "Rugby questions answered", path: QUESTIONS_INDEX_PATH }],
    faqs: [],
    body,
  });
}

/** Every page, keyed by the path it belongs at. What the build writes out. */
export function questionPages(): Array<{ path: string; html: string }> {
  return [
    { path: QUESTIONS_INDEX_PATH, html: questionIndexHtml() },
    ...QUESTION_TOPICS.map((topic) => ({
      path: questionsPath(topic),
      html: questionPageHtml(topic),
    })),
  ];
}
