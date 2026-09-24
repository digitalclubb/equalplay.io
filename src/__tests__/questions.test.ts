import { describe, it, expect, beforeEach } from "vitest";
import {
  QUESTIONS,
  QUESTION_TOPICS,
  QUESTIONS_INDEX_PATH,
  TOPICS,
  isQuestionTopic,
  questionGrades,
  questionsFor,
  questionsPath,
  searchQuestions,
  topicFloor,
  topicGrades,
} from "../hub/content/questions.js";
import { renderQuestions, resetQuestions } from "../hub/views/questions.js";
import {
  questionIndexHtml,
  questionPagePaths,
  questionPages,
} from "../seo/questionPage.js";
import { rulesIndexHtml } from "../seo/rulesPage.js";
import { esc } from "../lib/esc.js";
import {
  AGE_GROUPS,
  AGE_GROUP_LABELS,
  THEME_MIN_AGE,
  ageAtLeast,
} from "../hub/content/types.js";

/**
 * The answers are the one place in the hub where a rule reaches a coach with
 * no age gate in front of it.
 *
 * Everywhere else, `filterDrills` decides what a grade may see, because a drill
 * is something children go and do. An answer is not: it is somebody asking what
 * just happened, and hiding the reply because it belongs to the grade above
 * would hide the thing they came for. The guide made that call first and this
 * follows it.
 *
 * What pays for the exception is the grade printed on every single answer, so
 * this holds that in three places: on the data, in the app and on the static
 * pages. It also holds a themed topic to `THEME_MIN_AGE`, which is the same
 * table the age gate itself runs on, so a scrum answer can never claim to apply
 * at a grade Regulation 15 has no scrum at.
 */

describe("the answers", () => {
  it("gives every topic something worth opening", () => {
    for (const topic of QUESTION_TOPICS) {
      const questions = questionsFor(topic);
      expect(questions.length, `${topic} has ${questions.length} questions`).toBeGreaterThan(3);
      expect(TOPICS[topic].label.length, `${topic} label`).toBeGreaterThan(3);
      expect(TOPICS[topic].blurb.length, `${topic} blurb`).toBeGreaterThan(30);
    }
    // Every question is filed under a topic that exists, so none can go missing
    // between the data and the pages.
    expect(QUESTIONS.length).toBe(QUESTION_TOPICS.flatMap(questionsFor).length);
  });

  it("asks a question and answers it", () => {
    for (const question of QUESTIONS) {
      expect(question.question.endsWith("?"), `"${question.question}"`).toBe(true);
      expect(question.answer.length, `"${question.question}" has no answer`).toBeGreaterThan(80);
      expect(question.answer.endsWith("."), `"${question.question}" trails off`).toBe(true);
    }
  });

  it("asks each one once", () => {
    const seen = new Set<string>();
    for (const question of QUESTIONS) {
      const key = question.question.toLowerCase();
      expect(seen.has(key), `asked twice: "${question.question}"`).toBe(false);
      seen.add(key);
    }
  });

  /**
   * Both renderers escape every string, which is what lets this be edited by
   * anyone without thinking about markup. Put a tag in the content and a coach
   * reads the tag.
   */
  it("holds plain text, with no markup in it", () => {
    for (const question of QUESTIONS) {
      for (const text of [question.question, question.answer]) {
        expect(/<[a-z/]/i.test(text), `"${text}" contains markup`).toBe(false);
        expect(text.includes("&"), `"${text}" contains an entity`).toBe(false);
      }
    }
  });

  /**
   * The load bearing one. A themed topic's floor comes off `THEME_MIN_AGE`
   * rather than being typed here, so this is the same claim the catalogue's age
   * gate is built on, checked against content nothing filters.
   */
  it("claims no grade earlier than Regulation 15 allows the phase of play", () => {
    for (const question of QUESTIONS) {
      const floor = topicFloor(question.topic);
      if (!floor) continue;
      expect(
        ageAtLeast(question.from, floor),
        `"${question.question}" claims ${question.from}, but ${question.topic} starts at ${floor}`,
      ).toBe(true);
    }
    // The map is read off the themes rather than written down twice.
    expect(topicFloor("scrum")).toBe(THEME_MIN_AGE.setpiece);
    expect(topicFloor("ruck")).toBe(THEME_MIN_AGE.breakdown);
    expect(topicFloor("tackle")).toBe(THEME_MIN_AGE.tackle);
    expect(topicFloor("kicking")).toBe(THEME_MIN_AGE.kicking);
    expect(topicFloor("match-day")).toBeUndefined();
  });

  it("never ends a range before it starts", () => {
    for (const question of QUESTIONS) {
      if (!question.to) continue;
      expect(
        ageAtLeast(question.to, question.from),
        `"${question.question}" runs ${question.from} to ${question.to}`,
      ).toBe(true);
    }
  });

  it("keeps tag rugby inside the two grades that play it", () => {
    // Tag is the whole game at U7 and U8 and gone by U9. An answer about the
    // seventh tag with no upper bound on it reads as current at U12.
    for (const question of questionsFor("tag")) {
      expect(question.to, `"${question.question}" never stops`).toBeDefined();
      expect(
        ageAtLeast("u8", question.to ?? "u12"),
        `"${question.question}" runs past U8`,
      ).toBe(true);
    }
  });

  it("says which grades every single answer is for", () => {
    for (const question of QUESTIONS) {
      const grades = questionGrades(question);
      expect(grades.length, `"${question.question}"`).toBeGreaterThan(3);
      // Either it names a grade or it says it holds everywhere. Anything else
      // is an answer a coach cannot place.
      const names = AGE_GROUPS.some((age) => grades.includes(AGE_GROUP_LABELS[age]));
      expect(names || grades === "Every grade", `"${question.question}": "${grades}"`).toBe(true);
    }
  });

  it("hands no minis grade a lineout", () => {
    // Reg 15 has touch restarting with a free pass through U13, the uncontested
    // lineout arriving at U14 and lifting held back to U15. The catalogue
    // claimed U12 until August 2026 and shipped four drills to match.
    const CLAIM =
      /(?<!no )(?<!not )lineouts? (?:from |at |arrives? at |starts? at |is introduced at )u(?:7|8|9|1[0-3])\b/i;
    for (const question of QUESTIONS) {
      for (const text of [question.question, question.answer]) {
        expect(CLAIM.test(text), `"${text}"`).toBe(false);
      }
    }
  });

  it("checks a topic off storage rather than trusting it", () => {
    // Same trap as `isTheme`. The topic comes off the address bar, so `in` on a
    // plain object would say yes to "toString" and hand `TOPICS[...]` back an
    // inherited function that sails past a truthy test then throws inside esc.
    expect(isQuestionTopic("scrum")).toBe(true);
    expect(isQuestionTopic("toString")).toBe(false);
    expect(isQuestionTopic("constructor")).toBe(false);
    expect(isQuestionTopic(undefined)).toBe(false);
  });

  it("searches the answer as well as the question", () => {
    // A coach searches for what they saw rather than for the heading somebody
    // filed it under. "Wrong side" is in one question; "sternum" is only ever
    // in an answer.
    expect(searchQuestions("wrong side").length).toBeGreaterThan(0);
    expect(searchQuestions("sternum").length).toBeGreaterThan(0);
    expect(searchQuestions("STERNUM").length).toBe(searchQuestions("sternum").length);
    expect(searchQuestions("   ")).toEqual(QUESTIONS);
    expect(searchQuestions("zzzzz")).toEqual([]);
  });

  it("matches every word rather than the whole phrase", () => {
    // A coach types what happened in front of them, which puts the words in
    // the order they saw them rather than the order somebody filed them in.
    // Each of these found nothing while the box matched the phrase, with the
    // answer sitting first on its own topic page the whole time. The drill
    // search has always worked this way, so this is one box catching the
    // other up rather than a rule of its own.
    for (const term of ["scrum wrong side", "ball out scrum", "ruck offside"]) {
      expect(searchQuestions(term).length).toBeGreaterThan(0);
    }

    // Every word, not any word. A term nobody wrote still finds nothing, even
    // beside one that plenty of answers carry.
    expect(searchQuestions("scrum zzzzz")).toEqual([]);

    // Word order cannot change the answer.
    expect(searchQuestions("wrong side scrum").length).toBe(
      searchQuestions("scrum wrong side").length,
    );

    // Punctuation a coach typed cannot hide an answer either. This box
    // suggests "wrong side, high tackle, half game" in its own placeholder, so
    // a comma is exactly what it invites.
    const plain = searchQuestions("wrong side");
    expect(plain.length).toBeGreaterThan(0);
    for (const term of ["wrong side?", "wrong side.", "wrong, side"]) {
      expect(searchQuestions(term).length, term).toBe(plain.length);
    }
    expect(searchQuestions("???")).toEqual(QUESTIONS);
  });
});

describe("the answers in the app", () => {
  let container: HTMLElement;

  beforeEach(() => {
    window.location.hash = "";
    // The search term outlives a render on purpose, so one test's query would
    // otherwise be the next test's starting state.
    resetQuestions();
    container = document.createElement("div");
    document.body.replaceChildren(container);
  });

  it("lists every topic on the index", () => {
    renderQuestions(container, undefined);
    const links = [...container.querySelectorAll<HTMLAnchorElement>(".guide-card")].map((a) =>
      a.getAttribute("href"),
    );
    expect(links).toEqual(QUESTION_TOPICS.map((topic) => `#/answers/${topic}`));
  });

  it("falls back to the index rather than erroring on a bad topic", () => {
    renderQuestions(container, "constructor");
    expect(container.querySelectorAll(".guide-card")).toHaveLength(QUESTION_TOPICS.length);
  });

  it("puts every answer of a topic on its page, and says which grades", () => {
    for (const topic of QUESTION_TOPICS) {
      renderQuestions(container, topic);
      const blocks = [...container.querySelectorAll(".guide-faq")];
      expect(blocks, topic).toHaveLength(questionsFor(topic).length);

      // Stated once in the eyebrow where every answer agrees, on each answer
      // where they do not. Nine identical captions is the caption saying
      // nothing, which is the "U10 on all six preset cards" failure again.
      const shared = topicGrades(topic);
      if (shared) {
        expect(container.querySelector(".guide-eyebrow")?.textContent, topic).toContain(shared);
      }

      for (const [i, block] of blocks.entries()) {
        const question = questionsFor(topic)[i];
        expect(block.querySelector("h4")?.textContent, topic).toBe(question.question);
        expect(block.querySelector("p")?.textContent, topic).toBe(question.answer);
        expect(block.querySelector(".guide-card-meta")?.textContent?.trim(), topic).toBe(
          shared ? undefined : questionGrades(question),
        );
      }
    }
  });

  it("leaves no answer on screen without the grades it holds for", () => {
    // The whole of what pays for this route not being age gated. Whichever way
    // a page says it, a coach reading an answer can see which grades it is for.
    for (const topic of QUESTION_TOPICS) {
      renderQuestions(container, topic);
      const text = container.textContent ?? "";
      for (const question of questionsFor(topic)) {
        expect(text, `${topic}: "${question.question}"`).toContain(questionGrades(question));
      }
    }
  });

  /**
   * The exception the guide already makes, made once more. Every other route
   * hides what the coach's grade may not do. A coach going up to U10 in
   * September has to be able to read the ruck answers in August, and a coach
   * whose referee has just given something has to be able to look it up
   * whatever grade they are on.
   */
  it("shows an answer for a grade above the coach's own", () => {
    renderQuestions(container, "scrum", "u7");
    expect(container.querySelectorAll(".guide-faq").length).toBe(questionsFor("scrum").length);
    expect(container.textContent).toContain("wrong side");
    expect(container.textContent).toContain("U10 and up");
  });

  it("filters as a coach types, without losing the box", () => {
    renderQuestions(container, undefined);
    const box = container.querySelector<HTMLInputElement>("#answers-search");
    expect(box).not.toBeNull();

    box!.value = "sternum";
    box!.dispatchEvent(new Event("input"));
    const found = [...container.querySelectorAll(".guide-faq")];
    expect(found.length).toBe(searchQuestions("sternum").length);
    // The box is outside the part that is redrawn, which is what keeps the
    // caret where the coach left it. The catalogue has to restore one because
    // it replaces the whole view.
    expect(container.querySelector("#answers-search")).toBe(box);
    // A list that changes silently is a list a screen reader never sees change.
    // Its own element, because a live region around the answers reads the
    // answers out on every keystroke.
    const said = container.querySelector("#answers-count");
    expect(said?.getAttribute("role")).toBe("status");
    expect(said?.textContent).toBe(`${found.length} ${found.length === 1 ? "answer" : "answers"}`);
  });

  it("keeps what a coach typed when the view is rebuilt under them", () => {
    // A token refresh, the tab coming back, the browser reporting signal: each
    // of those calls `render()` without the coach having gone anywhere. The box
    // emptying itself at the moment the phone finds signal is the touchline
    // moment this tab is for.
    renderQuestions(container, undefined);
    const box = container.querySelector<HTMLInputElement>("#answers-search")!;
    box.value = "sternum";
    box.dispatchEvent(new Event("input"));

    renderQuestions(container, undefined);
    expect(container.querySelector<HTMLInputElement>("#answers-search")?.value).toBe("sternum");
    expect(container.querySelectorAll(".guide-faq")).toHaveLength(
      searchQuestions("sternum").length,
    );

    // Gone once a different coach picks the tablet up.
    resetQuestions();
    renderQuestions(container, undefined);
    expect(container.querySelector<HTMLInputElement>("#answers-search")?.value).toBe("");
    expect(container.querySelectorAll(".guide-card")).toHaveLength(QUESTION_TOPICS.length);
  });

  it("offers a way back out of a search that found nothing", () => {
    renderQuestions(container, undefined);
    const box = container.querySelector<HTMLInputElement>("#answers-search")!;
    box.value = "zzzzz";
    box.dispatchEvent(new Event("input"));
    const clear = container.querySelector<HTMLButtonElement>("[data-clear-search]");
    expect(clear).not.toBeNull();

    clear!.click();
    expect(box.value).toBe("");
    expect(container.querySelectorAll(".guide-card")).toHaveLength(QUESTION_TOPICS.length);
  });

  it("steps to the topics either side, and stops at the ends", () => {
    const steps = (topic: string): string[] => {
      renderQuestions(container, topic);
      return [...container.querySelectorAll<HTMLAnchorElement>(".guide-steps a")].map(
        (a) => a.getAttribute("href") ?? "",
      );
    };
    const first = QUESTION_TOPICS[0];
    const last = QUESTION_TOPICS[QUESTION_TOPICS.length - 1];
    expect(steps(first)).toEqual([`#/answers/${QUESTION_TOPICS[1]}`]);
    expect(steps(last)).toEqual([`#/answers/${QUESTION_TOPICS[QUESTION_TOPICS.length - 2]}`]);
  });
});

describe("the answers as static pages", () => {
  const pages = questionPages();
  const at = (path: string): string => {
    const found = pages.find((one) => one.path === path);
    if (!found) throw new Error(`no page at ${path}`);
    return found.html;
  };

  it("writes an index plus one page per topic, and says so in one place", () => {
    expect(pages.map((one) => one.path)).toEqual(questionPagePaths());
    expect(questionPagePaths()).toEqual([
      QUESTIONS_INDEX_PATH,
      ...QUESTION_TOPICS.map(questionsPath),
    ]);
  });

  it("says what the app says rather than a second version of it", () => {
    for (const topic of QUESTION_TOPICS) {
      const html = at(questionsPath(topic));
      for (const question of questionsFor(topic)) {
        // Escaped, because that is what the page holds. An apostrophe is
        // `&#39;` in the markup and an apostrophe in the structured data, so
        // comparing the two raw is how this test would pass by accident.
        expect(html, `${topic}: "${question.question}"`).toContain(esc(question.question));
        expect(html, `${topic}: answer`).toContain(esc(question.answer));
        expect(html, `${topic}: grade`).toContain(esc(questionGrades(question)));
      }
    }
  });

  /**
   * Google drops the rich result when the structured data and the page
   * disagree, so the grade goes above the question rather than inside the
   * answer: the visible paragraph has to be the answer and nothing else.
   */
  it("asks the questions it asks, in the same order, with the same answers", () => {
    for (const topic of QUESTION_TOPICS) {
      const html = at(questionsPath(topic));
      const block = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
      expect(block, topic).not.toBeNull();
      const graph = JSON.parse(block![1])["@graph"];
      const faq = graph.find((node: { "@type": string }) => node["@type"] === "FAQPage");
      expect(faq, `${topic} has no FAQPage`).toBeTruthy();

      const onPage = [...html.matchAll(/<h3>([^<]+\?)<\/h3>\s*<p>([\s\S]*?)<\/p>/g)].map((m) => [
        m[1],
        m[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim(),
      ]);
      // JSON carries the apostrophe; the markup carries `&#39;`. Escaping the
      // structured data is what makes the two comparable.
      const entities = faq.mainEntity.map((q: { name: string; acceptedAnswer: { text: string } }) => [
        esc(q.name),
        esc(q.acceptedAnswer.text),
      ]);
      expect(entities, topic).toEqual(onPage);
    }
  });

  it("claims no FAQ on the index, where the answers are not", () => {
    // One question answered at two URLs is two pages asking to be treated as
    // one. The index lists the topics; the answers live on the topic pages.
    expect(questionIndexHtml()).not.toContain('"FAQPage"');
  });

  it("is indexable, unlike the hub the same words live in", () => {
    for (const { path, html } of pages) {
      expect(html, `${path}: noindex`).not.toContain("noindex");
      expect(html, `${path}: canonical`).toContain(`href="https://equalplay.io${path}"`);
      expect(html, `${path}: chrome`).toContain('<a class="header-cta" href="/hub">');
    }
  });

  it("is reachable by a link rather than only by the sitemap", () => {
    // Every topic off the index, the index off the rules cluster, which is in
    // the footer of every page on the site.
    const index = at(QUESTIONS_INDEX_PATH);
    for (const topic of QUESTION_TOPICS) {
      expect(index, `${topic} is not linked from the index`).toContain(
        `href="${questionsPath(topic)}"`,
      );
    }
    expect(rulesIndexHtml(), "the index is orphaned").toContain(
      `href="${QUESTIONS_INDEX_PATH}"`,
    );
  });

  it("sends a reader into the app at the topic they were reading", () => {
    // No `?age=` on it. A topic spans grades, so seeding one would set a U12
    // coach to U7 for reading about free passes. Same reason a drill page
    // carries nothing.
    for (const topic of QUESTION_TOPICS) {
      const html = at(questionsPath(topic));
      expect(html, topic).toContain(`<a class="cta" href="/hub#/answers/${topic}">`);
      expect(html, `${topic} seeds a grade it does not know`).not.toContain("/hub?age=");
    }
  });

  it("links out to the RFU rather than passing the rules off as ours", () => {
    for (const { path, html } of pages) {
      expect(html, `${path}: not affiliated`).toContain("not affiliated with the RFU");
      expect(html, `${path}: reissued`).toContain("reissued every summer");
      expect(html, `${path}: englandrugby`).toContain("englandrugby.com");
    }
  });

  it("hands no minis grade a lineout", () => {
    const CLAIM =
      /(?<!no )(?<!not )lineouts? (?:from |at |arrives? at |starts? at |is introduced at )u(?:7|8|9|1[0-3])\b/i;
    for (const { path, html } of pages) {
      expect(CLAIM.test(html.replace(/<[^>]+>/g, " ")), path).toBe(false);
    }
  });
});
