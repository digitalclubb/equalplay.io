import { readFileSync } from "node:fs";
import { nextScheme, schemeHtml, SCHEMES } from "../lib/theme.js";
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
const mainSource = readFileSync("src/hub/main.ts", "utf8");

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

  it("routes Guide inside the hub", () => {
    // The guides are hub content, not static pages, so Guide is an ordinary
    // fragment on the hub and a path-qualified one from the planner. Match day
    // is the only tab that is a document of its own.
    expect(navHref("guide")).toBe("#/guide");
    expect(navHref("guide", "/hub")).toBe("/hub#/guide");
  });

  it("offers the same five places from anywhere, in the order a coach uses them", () => {
    // Drills to find something, Sessions to build it, Match day on the Sunday.
    // Then the two nobody opens the app to reach: Guide, which is an August
    // read, and Account, pinned to the foot of the rail once there is one.
    expect(NAV_ITEMS.map((item) => item.key)).toEqual([
      "catalogue",
      "plans",
      "planner",
      "guide",
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

  /**
   * Both entries link their stylesheet from the document. The hub used to
   * import it from `hub/main.ts` instead, which gives the browser nothing to
   * hold paint on: it put up the bare HTML first, logo at its intrinsic 374px,
   * then styled it when the module graph arrived. `inline-css` in
   * vite.config.ts turns both links into a <style> in the head at build, so
   * this is also what keeps dev looking like production.
   */
  it("lets both entries block on their own stylesheet", () => {
    for (const [name, html] of [["planner", plannerHtml], ["hub", hubHtml]] as const) {
      const links = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]*>/g)].map((m) => m[0]);
      const own = links.filter((tag) => !tag.includes("fonts.googleapis.com"));
      expect(own, `${name}/index.html does not link its own stylesheet`).toHaveLength(1);
      expect(own[0], `${name}'s stylesheet is deferred`).not.toMatch(/media="print"/);
    }
    expect(mainSource, "hub/main.ts imports css, so the browser cannot block on it").not.toMatch(
      /import\s+["'][^"']*\.css["']/,
    );
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
/**
 * The colour scheme switch, written into both entries the same way the nav is.
 *
 * It sits in the chrome now. In the footer it was under a hundred drill cards,
 * which is a long scroll for the one setting a coach needs at the pitch. That
 * makes it the single exception to "identity plus navigation": a control both
 * entries carry identically, rather than something only one half can say.
 * Two copies in HTML plus one in a module is exactly the drift `staticNav`
 * exists to catch, so it gets the same treatment.
 */
describe("the colour scheme switch", () => {
  const written = (html: string, where: string): string => {
    const found = html.match(/<button[^>]*class="scheme-toggle"[\s\S]*?<\/button>/);
    if (!found) throw new Error(`${where} has no .scheme-toggle`);
    return found[0].replace(/\s*\n\s*/g, "");
  };

  it("matches the module on both entries", () => {
    const expected = schemeHtml().replace(/\s*\n\s*/g, "");
    expect(written(hubHtml, "hub/index.html")).toBe(expected);
    expect(written(plannerHtml, "planner/index.html")).toBe(expected);
  });

  it("ships on light, because the HTML cannot know", () => {
    // What the phone asks for and what a coach stored are both read after
    // paint, so one of the two has to be written here and corrected. Light is
    // right for a light phone, which is most of them, and for a coach who
    // picked light. A dark phone wears a sun until the bundle lands.
    expect(written(hubHtml, "hub/index.html")).toContain('data-scheme="light"');
  });

  it("names the scheme it is on rather than the one a tap would give", () => {
    // A button whose name promises the next state is wrong the moment somebody
    // tabs onto it and does not press.
    for (const scheme of SCHEMES) {
      expect(schemeHtml(scheme), scheme).toContain(`data-scheme="${scheme}"`);
      expect(schemeHtml(scheme), scheme).toMatch(/aria-label="Colours: (Light|Dark)"/);
    }
  });

  it("gives every scheme its own glyph, hidden from a screen reader", () => {
    // The glyph is what a coach reads the state off, since the chrome is navy
    // in both schemes and looks the same either way.
    const glyphs = SCHEMES.map((scheme) => schemeHtml(scheme).replace(/^<button[^>]*>/, ""));
    expect(new Set(glyphs).size).toBe(SCHEMES.length);
    for (const glyph of glyphs) {
      expect(glyph).toContain('aria-hidden="true"');
      expect(glyph, "a fixed colour in the chrome").not.toMatch(/#[0-9a-f]{3,8}/i);
    }
  });

  it("flips to the other one", () => {
    expect(SCHEMES.map(nextScheme)).toEqual(["dark", "light"]);
  });

  it("applies the choice before the stylesheet, in both entries", () => {
    // After the stylesheet the page has already painted in the other scheme,
    // which is the flash this exists to stop.
    for (const [name, html] of [["hub", hubHtml], ["planner", plannerHtml]] as const) {
      const script = html.indexOf("equalplay_scheme");
      const sheet = html.indexOf('rel="stylesheet"');
      expect(script, `${name} never reads the stored scheme`).toBeGreaterThan(-1);
      expect(script, `${name} reads it too late`).toBeLessThan(sheet);
    }
  });

  it("is in the chrome on both entries, and the same one", () => {
    for (const [name, html] of [["hub", hubHtml], ["planner", plannerHtml]] as const) {
      const chrome = html.match(/<div class="header-bar app-chrome"[\s\S]*?\n( {4,6})<\/div>/);
      if (!chrome) throw new Error(`${name} has no .app-chrome block`);
      expect(chrome[0], `${name} chrome`).toContain('class="scheme-toggle"');
    }
  });
});
