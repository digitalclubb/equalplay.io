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
  let chrome: HTMLElement;

  const button = (): HTMLButtonElement =>
    chrome.querySelector<HTMLButtonElement>(".scheme-toggle") as HTMLButtonElement;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    chrome = document.createElement("div");
    chrome.innerHTML = schemeHtml();
    document.body.replaceChildren(chrome);
  });

  it("starts on the phone's own answer", () => {
    wireScheme(chrome);
    expect(button().dataset.scheme).toBe("system");
    expect(button().getAttribute("aria-label")).toBe("Colours: Auto");
  });

  it("switches the document and remembers it", () => {
    wireScheme(chrome);
    button().click();
    button().click();

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(button().dataset.scheme).toBe("dark");
    expect(localStorage.getItem(SCHEME_KEY)).toBe("dark");
  });

  it("corrects the markup to what was stored", () => {
    // The HTML ships on Auto, because it is written before anyone knows what is
    // on the device. Wiring up is the first moment that can be right.
    chooseScheme("light");
    chrome.innerHTML = schemeHtml();
    wireScheme(chrome);
    expect(button().dataset.scheme).toBe("light");
    expect(button().getAttribute("aria-label")).toBe("Colours: Light");
  });

  it("cycles back round to the phone", () => {
    wireScheme(chrome);
    for (let tap = 0; tap < 3; tap++) button().click();

    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(button().dataset.scheme).toBe("system");
    expect(localStorage.getItem(SCHEME_KEY)).toBeNull();
  });

  it("reaches dark even when nothing can be stored", () => {
    // Private browsing throws on write, so a cycle that read the next scheme
    // back out of storage would bounce between Auto and Light for ever.
    const stored = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    try {
      wireScheme(chrome);
      button().click();
      button().click();
      expect(document.documentElement.dataset.theme).toBe("dark");
    } finally {
      Storage.prototype.setItem = stored;
    }
  });

  it("shows a different glyph for each scheme", () => {
    // Auto and Light are the same page on a phone already set to light. The
    // icon is the only thing that says which of the two you are on.
    wireScheme(chrome);
    const seen = new Set<string>();
    for (let tap = 0; tap < 3; tap++) {
      seen.add(button().innerHTML);
      button().click();
    }
    expect(seen.size).toBe(3);
  });

  it("says nothing when there is no switch to wire", () => {
    const empty = document.createElement("div");
    expect(() => wireScheme(empty)).not.toThrow();
  });
});
