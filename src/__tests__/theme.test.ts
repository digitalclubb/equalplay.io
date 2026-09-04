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
 * The colour scheme a coach is on.
 *
 * Two states, and the phone decides which one a coach starts on. There is no
 * third state to choose, because it read as a mode of its own rather than as
 * the two colours it picks between. This exists for the case the phone gets
 * wrong: a screen pinned to dark is harder to read than a light one at a bright
 * pitch, and nobody is going into system settings with cold wet hands.
 *
 * The whole mechanism is one attribute on `<html>`. `src/base.css` turns it
 * into a `color-scheme` and every token is a `light-dark()` pair reading that,
 * so these cover the attribute and the storage rather than the colours, which
 * `e2e/contrast.spec.ts` measures in a real browser.
 */
/**
 * What the phone asks for. jsdom answers every query false on its own, and has
 * no way to change its mind, which the switch has to cope with: until a coach
 * chooses, the phone is still the one deciding.
 */
let phoneChanged: (() => void)[] = [];

function phoneSays(dark: boolean): void {
  Object.defineProperty(globalThis, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: dark && query.includes("dark"),
      addEventListener: (_: string, listener: () => void) => phoneChanged.push(listener),
    }),
  });
}

/** The phone flipping at sunset, with whatever is listening told about it. */
function phoneFlipsTo(dark: boolean): void {
  phoneSays(dark);
  for (const listener of phoneChanged) listener();
}

describe("the colour scheme a coach is on", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    phoneSays(false);
  });

  it("starts on what the phone asks for", () => {
    expect(storedScheme()).toBe("light");
    phoneSays(true);
    expect(storedScheme()).toBe("dark");
  });

  it("writes the choice onto the document", () => {
    applyScheme("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    applyScheme("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("remembers a choice, over what the phone asks for", () => {
    phoneSays(true);
    chooseScheme("light");
    expect(localStorage.getItem(SCHEME_KEY)).toBe("light");
    expect(storedScheme()).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("ignores a stored value that is not a scheme", () => {
    localStorage.setItem(SCHEME_KEY, "sepia");
    expect(storedScheme()).toBe("light");
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
    phoneChanged = [];
    phoneSays(false);
    chrome = document.createElement("div");
    chrome.innerHTML = schemeHtml();
    document.body.replaceChildren(chrome);
  });

  it("starts on the phone's own answer, and leaves the document to it", () => {
    // Nothing chosen, so nothing is written to `<html>`. The media query behind
    // `light-dark()` is still answering, the same as it is on the static pages.
    phoneSays(true);
    wireScheme(chrome);
    expect(button().dataset.scheme).toBe("dark");
    expect(button().getAttribute("aria-label")).toBe("Colours: Dark");
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });

  it("keeps up with the phone until a coach chooses", () => {
    // A phone on automatic appearance flips at sunset. The hub pinned to what
    // it said at load would sit light while the homepage beside it went dark.
    wireScheme(chrome);
    expect(button().dataset.scheme).toBe("light");

    phoneFlipsTo(true);
    expect(button().dataset.scheme).toBe("dark");

    // Once tapped it is a choice, so the phone stops being asked
    button().click();
    expect(button().dataset.scheme).toBe("light");
    phoneFlipsTo(false);
    expect(button().dataset.scheme).toBe("light");
  });

  it("switches the document and remembers it", () => {
    wireScheme(chrome);
    button().click();

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(button().dataset.scheme).toBe("dark");
    expect(localStorage.getItem(SCHEME_KEY)).toBe("dark");
  });

  it("corrects the markup to what was stored", () => {
    // The HTML ships on Light, because it is written before anyone knows what
    // is on the device. Wiring up is the first moment that can be right.
    chooseScheme("dark");
    chrome.innerHTML = schemeHtml();
    wireScheme(chrome);
    expect(button().dataset.scheme).toBe("dark");
    expect(button().getAttribute("aria-label")).toBe("Colours: Dark");
  });

  it("flips back on the next tap", () => {
    wireScheme(chrome);
    button().click();
    button().click();

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(button().dataset.scheme).toBe("light");
    expect(localStorage.getItem(SCHEME_KEY)).toBe("light");
  });

  it("still flips when nothing can be stored", () => {
    // Private browsing throws on write, so a flip that read the scheme back out
    // of storage would land on the same one every time and never move.
    const stored = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    try {
      wireScheme(chrome);
      button().click();
      expect(document.documentElement.dataset.theme).toBe("dark");
      button().click();
      expect(document.documentElement.dataset.theme).toBe("light");
    } finally {
      Storage.prototype.setItem = stored;
    }
  });

  it("shows a different glyph for each scheme", () => {
    // The chrome is navy in both schemes, so the glyph is what a coach reads
    // the state off.
    wireScheme(chrome);
    const seen = new Set<string>();
    for (let tap = 0; tap < 2; tap++) {
      seen.add(button().innerHTML);
      button().click();
    }
    expect(seen.size).toBe(2);
  });

  it("says nothing when there is no switch to wire", () => {
    const empty = document.createElement("div");
    expect(() => wireScheme(empty)).not.toThrow();
  });
});
