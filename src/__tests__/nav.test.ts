import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { NAV_ITEMS, navHref, navHtml } from "../lib/nav.js";

/**
 * One product, two entries. These cover the two ways that arrangement can quietly
 * come apart: the planner's hard-coded copy of the nav drifting from the module,
 * and the module growing an import that drags Supabase into the planner's bundle.
 */

const plannerHtml = readFileSync("planner/index.html", "utf8");
const navSource = readFileSync("src/lib/nav.ts", "utf8");
const hubHtml = readFileSync("hub/index.html", "utf8");

/**
 * The tag and class of everything inside an entry's chrome, with the logo's SVG
 * dropped. Enough to tell the two entries apart structurally without pinning
 * the nav's contents, which the hub fills in at runtime.
 */
function chromeShape(html: string): string[] {
  const block = html.match(/<div class="header-bar app-chrome"[\s\S]*?\n( {4,6})<\/div>/);
  if (!block) throw new Error("no .app-chrome block");
  const inner = block[0].replace(/<svg[\s\S]*?<\/svg>/g, "").replace(/<!--[\s\S]*?-->/g, "");
  return [...inner.matchAll(/<(header|nav|p|div|h1)\b([^>]*)>/g)].map(([, tag, attrs]) => {
    const cls = attrs.match(/class="([^"]*)"/)?.[1] ?? "";
    return cls ? `${tag}.${cls.split(" ")[0]}` : tag;
  });
}

/** The nav markup as written into the planner entry, with the pretty-printing out. */
function plannerNav(): string {
  const found = plannerHtml.match(/<nav class="hub-nav"[^>]*>([\s\S]*?)<\/nav>/);
  if (!found) throw new Error("planner/index.html has no .hub-nav");
  return found[1].replace(/\s*\n\s*/g, "");
}

describe("app navigation", () => {
  it("renders the same markup on both entries", () => {
    // The planner writes this by hand because its header paints before the bundle
    // arrives, which is that page's LCP. This is what stops the copy rotting.
    expect(plannerNav()).toBe(navHtml("planner", "/hub"));
  });

  it("marks the page you are on, once", () => {
    const html = navHtml("catalogue");
    expect(html.match(/aria-current/g)).toHaveLength(1);
    expect(html).toContain('class="hub-tab is-active" aria-current="page" data-route="catalogue"');
  });

  it("keeps the hub's own links as bare fragments", () => {
    // `/hub` and `/hub/` are different paths and the host serves both, so a
    // path-qualified href would reload the document instead of routing in place.
    expect(navHref("plans")).toBe("#/plans");
    expect(navHref("plans", "/hub")).toBe("/hub#/plans");
  });

  it("points the planner at its own document from either side", () => {
    expect(navHref("planner")).toBe("/planner");
    expect(navHref("planner", "/hub")).toBe("/planner");
  });

  it("offers the same four places from anywhere", () => {
    expect(NAV_ITEMS.map((item) => item.key)).toEqual([
      "catalogue",
      "planner",
      "plans",
      "account",
    ]);
  });

  it("pulls nothing from the hub into the planner's bundle", () => {
    // @supabase/supabase-js is ~220 kB and `createClient` runs at module load, so
    // a single import from hub/ here would land the lot on the indexed page.
    expect(navSource).not.toMatch(/from\s+"[^"]*hub\//);
  });

  it("gives both entries the same chrome", () => {
    // The planner used to carry a tagline and the hub a "Coaching U10" pill, so
    // the rail changed shape depending on which half you were looking at. The
    // chrome is identity plus navigation. Anything only one entry can say does
    // not belong in it.
    expect(chromeShape(plannerHtml)).toEqual(chromeShape(hubHtml));
  });

  it("keeps prose out of the chrome", () => {
    for (const [name, html] of [["planner", plannerHtml], ["hub", hubHtml]] as const) {
      expect(chromeShape(html).filter((el) => el.startsWith("p")), `${name} chrome`).toEqual([]);
    }
  });
});