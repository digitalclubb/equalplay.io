import { describe, it, expect, beforeEach } from "vitest";
import { renderCatalogue } from "../hub/views/catalogue.js";
import { chooseAge, chosenAge } from "../hub/ageChoice.js";

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

  it("keeps a deliberate filter change while the profile is unchanged", () => {
    renderCatalogue(container, "u12", USER);
    const select = container.querySelector<HTMLSelectElement>("#f-age");
    if (!select) throw new Error("age filter missing");

    select.value = "u8";
    select.dispatchEvent(new Event("change"));
    expect(shownAge()).toBe("u8");

    // Re-render on the same profile. The browsing choice must survive
    renderCatalogue(container, "u12", USER);
    expect(shownAge()).toBe("u8");
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
