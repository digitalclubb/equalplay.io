import { describe, it, expect, beforeEach } from "vitest";
import {
  activeAge,
  chooseAge,
  chosenAge,
  clearCoachedAges,
  coachedAges,
  mergeCoachedAges,
  setCoachedAges,
} from "../hub/ageChoice.js";

/**
 * The grade the app is set to, and the grades a coach says they take.
 *
 * Load bearing because everything filters on the answer: the catalogue, the
 * ready-made sessions, the term plan and how many a side match day starts a
 * new squad on. The failure this replaces was two answers at once, the
 * catalogue holding a grade in a filter while every other tab read storage.
 */
describe("the grades a coach takes", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("has nothing to say before a grade is picked", () => {
    expect(chosenAge()).toBeNull();
    expect(activeAge()).toBeNull();
    expect(coachedAges()).toEqual([]);
  });

  it("takes one grade as a list of one, with nothing to migrate", () => {
    // The old shape: a single grade under the old key and no list at all. A
    // coach who picked U10 last season must not have to pick again.
    localStorage.setItem("equalplay_age_group", "u10");
    expect(activeAge()).toBe("u10");
    expect(coachedAges()).toEqual(["u10"]);
  });

  it("adds the grade switched to, so the list builds as a coach uses it", () => {
    chooseAge("u10");
    chooseAge("u7");
    expect(activeAge()).toBe("u7");
    // Youngest first, rather than the order they happened to be added.
    expect(coachedAges()).toEqual(["u7", "u10"]);
    chooseAge("u10");
    expect(activeAge()).toBe("u10");
    expect(coachedAges()).toEqual(["u7", "u10"]);
  });

  it("keeps the active grade when the list is edited around it", () => {
    setCoachedAges(["u7", "u10"]);
    chooseAge("u10");
    setCoachedAges(["u9", "u10"]);
    expect(activeAge()).toBe("u10");
  });

  it("moves off a grade the coach has stopped taking", () => {
    // Dropping the grade you are standing on has to land somewhere real, or
    // every tab filters to a grade that is no longer theirs.
    setCoachedAges(["u7", "u10"]);
    chooseAge("u10");
    setCoachedAges(["u7"]);
    expect(activeAge()).toBe("u7");
    expect(coachedAges()).toEqual(["u7"]);
  });

  it("survives storage somebody has edited by hand", () => {
    localStorage.setItem("equalplay_age_groups", "{ not json");
    localStorage.setItem("equalplay_age_group", "u9");
    expect(coachedAges()).toEqual(["u9"]);
    expect(activeAge()).toBe("u9");

    localStorage.setItem("equalplay_age_groups", JSON.stringify(["u9", "u18", 7, null]));
    expect(coachedAges()).toEqual(["u9"]);

    // A grade that is not one of the six cannot become the one being filtered
    // to, however it got into storage.
    localStorage.setItem("equalplay_age_group", "u18");
    localStorage.setItem("equalplay_age_groups", JSON.stringify(["u7"]));
    expect(activeAge()).toBe("u7");
  });

  it("does not hand one coach's grades to the next on a club tablet", () => {
    // Clubs share tablets, so the grades somebody takes go out with the rest of
    // what belongs to them. The active grade stays, because it doubles as the
    // answer the age picker wrote and a device browsing signed out needs one.
    chooseAge("u10");
    chooseAge("u7");
    expect(coachedAges()).toEqual(["u7", "u10"]);

    clearCoachedAges();
    // The coach signing in next brings their own, and gets only their own. The
    // merge reads the list as stored rather than what `coachedAges` reports,
    // which falls back to the grade the last coach left in the other key.
    mergeCoachedAges(["u12"]);
    expect(coachedAges()).toEqual(["u12"]);
    expect(activeAge()).toBe("u12");
  });

  it("keeps a grade added on this device when the profile lands", () => {
    // The switch is local first so it works at a pitch. The profile's own list
    // arrives on every load and replacing with it put a coach back on the
    // grade they registered with the moment anything reloaded.
    chooseAge("u10");
    chooseAge("u7");
    mergeCoachedAges(["u10"]);
    expect(coachedAges()).toEqual(["u7", "u10"]);
    expect(activeAge()).toBe("u7");
  });

  it("never lists the same grade twice", () => {
    setCoachedAges(["u10", "u10", "u7"]);
    expect(coachedAges()).toEqual(["u7", "u10"]);
    chooseAge("u10");
    expect(coachedAges()).toEqual(["u7", "u10"]);
  });
});
