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

/** The nav markup as written into an entry's HTML, with the pretty-printing out. */
function staticNav(html: string, where: string): string {
  const found = html.match(/<nav class="hub-nav"[^>]*>([\s\S]*?)<\/nav>/);
  if (!found) throw new Error(`${where} has no .hub-nav`);
  return found[1].replace(/\s*\n\s*/g, "");
}

describe("app navigation", () => {
  it("renders the same markup on both entries", () => {
    // Both entries write this into their HTML so the chrome paints with the
    // document rather than waiting on a bundle. This is what stops the copies
    // rotting.
    expect(staticNav(plannerHtml, "planner/index.html")).toBe(navHtml("planner", "/hub"));
  });

  /**
   * The hub used to ship an empty nav and fill it once 400 kB of JavaScript had
   * arrived. `.hub-nav:empty` hid it until then, so the chrome was a logo on
   * navy and jumped 124px when the tabs turned up. Coming from Match day, whose
   * nav is in its HTML, that read as the app losing its styling.
   *
   * No active tab in the markup. The router adds it, and `is-active` only paints
   * a background, so nothing moves when it lands.
   */
  it("writes the hub's nav into its html too, with no tab marked", () => {
    const written = staticNav(hubHtml, "hub/index.html");
    expect(written).toBe(navHtml(""));
    expect(written).not.toContain("is-active");
    expect(written).not.toContain("aria-current");
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

  it("offers the same four places from anywhere, in the order a coach uses them", () => {
    // Drills to find something, Sessions to build it, Match day on the Sunday.
    // Account last because it is the odd one out, and pinned to the foot of the
    // rail once the layout is wide enough to have one.
    expect(NAV_ITEMS.map((item) => item.key)).toEqual([
      "catalogue",
      "plans",
      "planner",
      "account",
    ]);
  });

  it("gives every tab an icon, hidden from a screen reader", () => {
    for (const item of NAV_ITEMS) {
      expect(item.icon, `${item.key} has no icon`).toMatch(/^<svg\b/);
      // The label is right beside it, so announcing the icon as well would say
      // everything twice all the way down the rail.
      expect(item.icon, `${item.key}'s icon is not hidden`).toContain('aria-hidden="true"');
      expect(item.icon, `${item.key}'s icon has a fixed colour`).not.toMatch(/#[0-9a-f]{3,8}/i);
    }
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