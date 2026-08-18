import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

/**
 * The homepage's FAQ structured data has to say what the homepage says.
 *
 * Google treats a mismatch as a reason to drop the rich result, and it drifted
 * once already: the page's question was renamed while the JSON-LD kept
 * advertising the old one. Generated from the page rather than kept alongside
 * it, so this is what catches the next edit that forgets.
 */
const html = readFileSync("index.html", "utf8");

const strip = (fragment: string): string =>
  fragment.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

/** Every "...?" subheading on the page, with the paragraph under it. */
function questionsOnPage(): Array<[string, string]> {
  return [...html.matchAll(/<h3>([^<]+\?)<\/h3>\s*<p>([\s\S]*?)<\/p>/g)].map((m) => [
    m[1],
    strip(m[2]),
  ]);
}

function faqEntity(): Array<{ name: string; acceptedAnswer: { text: string } }> {
  const block = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!block) throw new Error("index.html has no JSON-LD");
  const graph = JSON.parse(block[1])["@graph"];
  const faq = graph.find((node: { "@type": string }) => node["@type"] === "FAQPage");
  if (!faq) throw new Error("no FAQPage in the graph");
  return faq.mainEntity;
}

describe("homepage FAQ structured data", () => {
  it("has something to check", () => {
    expect(questionsOnPage().length).toBeGreaterThan(2);
  });

  it("asks exactly the questions the page asks", () => {
    expect(faqEntity().map((q) => q.name)).toEqual(questionsOnPage().map(([q]) => q));
  });

  it("gives the answers the page gives", () => {
    const onPage = new Map(questionsOnPage());
    for (const entry of faqEntity()) {
      expect(entry.acceptedAnswer.text, `answer to "${entry.name}"`).toBe(
        onPage.get(entry.name),
      );
    }
  });
});
