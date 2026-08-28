import { describe, it, expect, beforeEach } from "vitest";
import {
  SCHEME_KEY,
  applyScheme,
  chooseScheme,
  schemeHtml,
  storedScheme,
  wireScheme,
} from "../lib/theme.js";

/**
 * The colour scheme a coach picked.
 *
 * Following the phone is the default and covers almost everybody. This exists
 * for the case the phone gets wrong: a screen pinned to dark is harder to read
 * than a light one at a bright pitch, and nobody is going into system settings
 * with cold wet hands.
 *
 * The whole mechanism is one attribute on `<html>`. `src/base.css` turns it
 * into a `color-scheme` and every token is a `light-dark()` pair reading that,
 * so these cover the attribute and the storage rather than the colours, which
 * `e2e/contrast.spec.ts` measures in a real browser.
 */
describe("the colour scheme a coach picked", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("follows the phone until somebody says otherwise", () => {
    expect(storedScheme()).toBe("system");
    applyScheme("system");
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });

  it("writes the choice onto the document", () => {
    applyScheme("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    applyScheme("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("takes the attribute off again for the phone's own answer", () => {
    // Not `data-theme="system"`. The media query behind `light-dark()` has to be
    // left to answer, and an attribute it does not know would stop nothing.
    applyScheme("dark");
    applyScheme("system");
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });

  it("remembers a choice and forgets it when it goes back to the phone", () => {
    chooseScheme("dark");
    expect(localStorage.getItem(SCHEME_KEY)).toBe("dark");
    expect(storedScheme()).toBe("dark");

    chooseScheme("system");
    expect(localStorage.getItem(SCHEME_KEY)).toBeNull();
    expect(storedScheme()).toBe("system");
  });

  it("ignores a stored value that is not a scheme", () => {
    localStorage.setItem(SCHEME_KEY, "sepia");
    expect(storedScheme()).toBe("system");
  });

  it("belongs to the phone rather than to a coach", () => {
    // Signing out clears everything belonging to whoever just left, because
    // clubs share tablets. A colour scheme is not theirs, it is the device's,
    // so it is stored under its own key rather than beside their data.
    chooseScheme("dark");
    localStorage.removeItem("equalplay_hub_plans");
    localStorage.removeItem("equalplay_hub_welcomed");
    expect(storedScheme()).toBe("dark");
  });
});

describe("the switch itself", () => {
  let footer: HTMLElement;

  const pressed = (): string[] =>
    [...footer.querySelectorAll<HTMLButtonElement>('[data-scheme][aria-pressed="true"]')].map(
      (b) => b.dataset.scheme ?? "",
    );

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    footer = document.createElement("footer");
    footer.innerHTML = schemeHtml();
    document.body.replaceChildren(footer);
  });

  it("marks exactly one option", () => {
    wireScheme(footer);
    expect(pressed()).toEqual(["system"]);
  });

  it("switches the document and remembers it", () => {
    wireScheme(footer);
    footer.querySelector<HTMLButtonElement>('[data-scheme="dark"]')?.click();

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(pressed()).toEqual(["dark"]);
    expect(localStorage.getItem(SCHEME_KEY)).toBe("dark");
  });

  it("corrects the markup to what was stored", () => {
    // The HTML ships with Auto lit, because it is written before anyone knows
    // what is on the device. Wiring up is the first moment that can be right.
    chooseScheme("light");
    footer.innerHTML = schemeHtml();
    wireScheme(footer);
    expect(pressed()).toEqual(["light"]);
  });

  it("goes back to the phone", () => {
    wireScheme(footer);
    footer.querySelector<HTMLButtonElement>('[data-scheme="dark"]')?.click();
    footer.querySelector<HTMLButtonElement>('[data-scheme="system"]')?.click();

    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(pressed()).toEqual(["system"]);
  });

  it("says nothing when there is no switch to wire", () => {
    const empty = document.createElement("div");
    expect(() => wireScheme(empty)).not.toThrow();
  });
});
