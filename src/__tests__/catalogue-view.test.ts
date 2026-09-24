import { describe, it, expect, beforeEach } from "vitest";
import { renderCatalogue } from "../hub/views/catalogue.js";
import { DRILLS, drillPath } from "../hub/content/drills.js";
import { presetsForAge } from "../hub/content/presets.js";
import { renderPresetList } from "../hub/views/planner.js";
import { readFileSync } from "node:fs";
import { chooseAge, chosenAge, coachedAges } from "../hub/ageChoice.js";

const USER = "00000000-0000-4000-8000-000000000001";

/**
 * The catalogue keeps its filters in module state so they survive a trip into a
 * drill and back. That state is one layer above filterDrills, so it can defeat
 * the age gate without content-age-gate.test.ts noticing. These cover the seam.
 */
describe("catalogue filter state", () => {
  let container: HTMLElement;

  beforeEach(() => {
    window.location.hash = "";
    container = document.createElement("div");
    document.body.replaceChildren(container);
  });

  const shownAge = (): string =>
    container.querySelector<HTMLSelectElement>("#f-age")?.value ?? "";

  const titles = (): string[] =>
    [...container.querySelectorAll(".drill-card-title")].map((el) => el.textContent ?? "");

  it("defaults to the age group the coach registered", () => {
    renderCatalogue(container, "u9", USER);
    expect(shownAge()).toBe("u9");
  });

  it("re-seeds when the coach corrects their age group", () => {
    renderCatalogue(container, "u12", USER);
    expect(titles()).toContain("Two second ruck");

    // Same as saving a new age group on the Account page and coming back
    renderCatalogue(container, "u8", USER);
    expect(shownAge()).toBe("u8");
    expect(titles()).not.toContain("Two second ruck");
  });

  it("switches the whole app rather than this list", () => {
    // The grade is not the catalogue's to keep. It used to set the filter here
    // and nothing else, so a coach could leave Drills showing U8 while
    // Sessions offered U12 and match day started a twelve a side squad, with
    // nothing on any screen saying why.
    localStorage.clear();
    chooseAge("u12");
    renderCatalogue(container, "u12", USER);

    const select = container.querySelector<HTMLSelectElement>("#f-age");
    if (!select) throw new Error("age switcher missing");
    select.value = "u8";
    select.dispatchEvent(new Event("change"));

    expect(shownAge()).toBe("u8");
    // The one value every other tab reads when it next renders.
    expect(chosenAge()).toBe("u8");
    // And the grade switched to is now one of the coach's, so the switcher
    // offers it next time without them having to find it again.
    expect(coachedAges()).toEqual(["u8", "u12"]);
  });

  it("takes the grade from outside on every render", () => {
    // Switching on the sessions page and walking back here has to land on the
    // grade that was switched to. It did not: the list kept a note of what it
    // was last seeded with, the note matched, and the drills underneath it
    // were still filtered to the grade before last.
    localStorage.clear();
    chooseAge("u12");
    renderCatalogue(container, "u12", USER);

    chooseAge("u8");
    renderCatalogue(container, "u8", USER);
    expect(shownAge()).toBe("u8");
    expect(titles()).not.toContain("Two second ruck");
  });

  it("never lists a contact drill after re-seeding down to a tag age grade", () => {
    renderCatalogue(container, "u12", USER);
    renderCatalogue(container, "u7", USER);
    for (const title of titles()) {
      expect(["Two second ruck", "Three player scrum shape", "Cheek to cheek"]).not.toContain(title);
    }
  });
});

/**
 * The filters are two groups doing two different jobs. Above the rule is what
 * the drill is, where picking a theme replaces the last one. Below it is your
 * stars and the pitch you have got, where everything stacks. They were one row
 * of nine identical chips, which said none of that.
 */
describe("the filter groups", () => {
  let container: HTMLElement;

  beforeEach(() => {
    window.location.hash = "";
    localStorage.clear();
    container = document.createElement("div");
    document.body.replaceChildren(container);
    // The filters are module state that survives a render on purpose, so each
    // of these starts by re-seeding off a different grade to clear the last
    // one's taps. Same thing the account page does when a coach corrects it.
    renderCatalogue(container, "u9", USER);
    renderCatalogue(container, "u12", USER);
  });

  const ids = (selector: string): string[] =>
    [...container.querySelectorAll(`${selector} .chip-filter`)].map(
      (chip) => chip.id || chip.getAttribute("data-theme") || "",
    );

  it("keeps the themes and the pitch apart", () => {
    // Every theme in one group, nothing else in it. A pitch chip that lands
    // among them is the thing this whole layout exists to stop.
    expect(ids(".chip-themes")).toEqual([
      "handling",
      "evasion",
      "tackle",
      "breakdown",
      "setpiece",
      "kicking",
      "gamesense",
    ]);
    expect(ids(".chip-picks")).toEqual(["f-fav", "f-space", "f-ground"]);
  });

  it("ticks what stacks and leaves the themes plain", () => {
    // A theme replaces the theme before it, so it never gets a tick. The two
    // pitch chips stack with each other and with whatever theme is lit, and the
    // tick is the only thing on screen that says so.
    container.querySelector<HTMLButtonElement>("#f-ground")?.click();
    container.querySelector<HTMLButtonElement>('[data-theme="tackle"]')?.click();

    expect(container.querySelector("#f-ground .chip-tick")).not.toBeNull();
    expect(container.querySelector("#f-space .chip-tick")).toBeNull();
    expect(container.querySelector(".chip-themes .chip-tick")).toBeNull();
    expect(container.querySelector('[data-theme="tackle"]')?.className).toContain("is-active");
  });

  it("offers a way out only once there is something to clear", () => {
    expect(container.querySelector(".filter-clear")).toBeNull();

    container.querySelector<HTMLButtonElement>("#f-space")?.click();
    expect(container.querySelector(".filter-clear")).not.toBeNull();

    container.querySelector<HTMLButtonElement>(".filter-clear")?.click();
    expect(container.querySelector("#f-space")?.getAttribute("aria-pressed")).toBe("false");
    expect(container.querySelector(".filter-clear")).toBeNull();
  });

  it("clears the lot rather than one thing at a time", () => {
    const search = container.querySelector<HTMLInputElement>("#f-search");
    if (!search) throw new Error("no search box");
    container.querySelector<HTMLButtonElement>("#f-ground")?.click();
    container.querySelector<HTMLButtonElement>('[data-theme="tackle"]')?.click();
    container.querySelector<HTMLButtonElement>('[data-kind="warmup"]')?.click();

    container.querySelector<HTMLButtonElement>(".filter-clear")?.click();
    expect(container.querySelector("#f-ground")?.getAttribute("aria-pressed")).toBe("false");
    expect(container.querySelector(".chip-themes .is-active")).toBeNull();
    expect(container.querySelector<HTMLSelectElement>("#f-age")?.value).toBe("u12");
  });
});

/**
 * Signed out there is no profile, so the age grade comes off a local choice
 * instead. That is a third layer above `filterDrills` with the same power to
 * defeat the age gate, which is why it is covered here rather than trusted.
 */
describe("the age gate with no account", () => {
  let container: HTMLElement;

  beforeEach(() => {
    window.location.hash = "";
    localStorage.clear();
    container = document.createElement("div");
    document.body.replaceChildren(container);
  });

  const titles = (): string[] =>
    [...container.querySelectorAll(".drill-card-title")].map((el) => el.textContent ?? "");

  it("gates a coach with no user id exactly as it gates one with", () => {
    // "" is what the catalogue is handed when nobody is signed in
    renderCatalogue(container, "u8", "");
    expect(titles().length).toBeGreaterThan(0);
    for (const title of titles()) {
      expect(["Two second ruck", "Three player scrum shape", "Cheek to cheek"]).not.toContain(title);
    }
  });

  it("remembers the grade that was picked", () => {
    chooseAge("u9");
    expect(chosenAge()).toBe("u9");
  });

  it("refuses a grade it did not write", () => {
    // A hand-edited key must not become an age gate bypass
    localStorage.setItem("equalplay_age_group", "u18");
    expect(chosenAge()).toBeNull();
    localStorage.setItem("equalplay_age_group", "");
    expect(chosenAge()).toBeNull();
  });

  it("falls back to asking rather than guessing when storage is unreadable", () => {
    const getItem = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error("storage disabled");
    };
    try {
      expect(chosenAge()).toBeNull();
    } finally {
      Storage.prototype.getItem = getItem;
    }
  });
});

/**
 * The way a coach sends one drill to whoever else is helping.
 *
 * What goes out has to be the drill's own public page rather than a hub route.
 * The person opening it has no account and has never picked an age grade, so
 * the hub would put a question in front of them before it showed them the
 * drill. `drill-pages.test.ts` holds the other end of this, meaning that the
 * build actually emits the page these link at.
 */
describe("sharing one drill", () => {
  let container: HTMLElement;

  beforeEach(() => {
    // jsdom has no layout, so the drill page's own scroll to the title throws
    Element.prototype.scrollIntoView = (): void => {};
    window.location.hash = "";
    container = document.createElement("div");
    document.body.replaceChildren(container);
  });

  const share = (): HTMLAnchorElement | null =>
    container.querySelector<HTMLAnchorElement>("#drill-share");

  it("points at the drill's own page rather than into the hub", () => {
    for (const drill of [DRILLS[0], DRILLS[DRILLS.length - 1]]) {
      renderCatalogue(container, "u12", "", drill.id);
      expect(share()?.getAttribute("href"), drill.id).toBe(drillPath(drill));
    }
  });

  it("is an anchor, so a browser with no clipboard still gets somewhere", () => {
    // The share sheet and the clipboard are both absent outside a secure
    // context. Left as a button that would be a dead control.
    renderCatalogue(container, "u12", "", DRILLS[0].id);
    expect(share()?.tagName).toBe("A");
    expect(share()?.getAttribute("aria-label")).toContain(DRILLS[0].title);
  });

  it("is not on a card, only on the drill", () => {
    renderCatalogue(container, "u12", "");
    expect(share()).toBeNull();
  });
});

/**
 * Reading a ready-made session takes no account.
 *
 * The gate is on persistence and always has been. Keeping a session is
 * persistence. Reading one is not, and it is the half of the job this audience
 * cannot do for itself: a parent who never played can take a session off a list
 * and go. Building an hour out of 120 drill cards is a different skill. Behind
 * the register form, what a coach without an account got was the drills with no
 * help ordering them, which is the wrong half to give away.
 */
describe("reading a session with no account", () => {
  let container: HTMLElement;

  beforeEach(() => {
    window.location.hash = "";
    container = document.createElement("div");
    document.body.replaceChildren(container);
  });

  it("lists the ready-made sessions for the grade, as links", () => {
    for (const age of ["u7", "u10", "u12"] as const) {
      renderPresetList(container, age);
      const cards = [...container.querySelectorAll<HTMLAnchorElement>("a.preset-card")];
      expect(cards.map((card) => card.getAttribute("href")).sort()).toEqual(
        presetsForAge(age)
          .map((preset) => `#/preset/${preset.id}`)
          .sort(),
      );
    }
  });

  it("asks for the account at the point of keeping one", () => {
    renderPresetList(container, "u9");
    const gate = container.querySelector<HTMLAnchorElement>('a[href="#/join/plans"]');
    expect(gate, "no way through to the account").not.toBeNull();
  });

  it("does not offer to build one, since there is nowhere to put it", () => {
    renderPresetList(container, "u9");
    expect(container.querySelector("#new-blank")).toBeNull();
  });

  it("is what the signed-out route renders instead of the register form", () => {
    const main = readFileSync("src/hub/main.ts", "utf8");
    expect(main).toContain('if (chosen && (route.name === "plans" || route.name === "preset"))');
    expect(main).toContain("renderPresetList(view, chosen)");
  });
});
