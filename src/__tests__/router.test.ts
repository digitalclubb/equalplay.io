import { describe, it, expect, beforeEach } from "vitest";
import { currentRoute, go, stillOn } from "../hub/router.js";

beforeEach(() => {
  window.location.hash = "";
});

describe("currentRoute", () => {
  it("reads a bare route", () => {
    window.location.hash = "#/plans";
    expect(currentRoute()).toEqual({ name: "plans", param: undefined, rest: [] });
  });

  it("reads a param", () => {
    window.location.hash = "#/plan/abc";
    expect(currentRoute()).toEqual({ name: "plan", param: "abc", rest: [] });
  });

  it("keeps everything after the param, which is how a drill knows where it came from", () => {
    window.location.hash = "#/catalogue/drill-x/from/plan-y";
    expect(currentRoute()).toEqual({
      name: "catalogue",
      param: "drill-x",
      rest: ["from", "plan-y"],
    });
  });

  it("falls back to home with no hash", () => {
    expect(currentRoute().name).toBe("home");
  });

  it("ignores a trailing slash", () => {
    window.location.hash = "#/plan/abc/";
    expect(currentRoute().rest).toEqual([]);
  });
});

/**
 * The guard that stops async work painting over whichever view is on screen. Two
 * of these were live bugs: a slow favourites sync repainting the drill catalogue
 * over an open session, and a plans sync yanking a coach back to the list.
 */
describe("stillOn", () => {
  it("is true only for the route that is actually showing", () => {
    window.location.hash = "#/plans";
    expect(stillOn("plans")).toBe(true);
    expect(stillOn("catalogue")).toBe(false);
    expect(stillOn("plan")).toBe(false);
  });

  it("can insist on a particular record", () => {
    window.location.hash = "#/plan/abc";
    expect(stillOn("plan", "abc")).toBe(true);
    expect(stillOn("plan", "xyz")).toBe(false);
    // No param asked for means any record of that kind
    expect(stillOn("plan")).toBe(true);
  });

  it("goes false the moment the route moves on", () => {
    window.location.hash = "#/catalogue";
    expect(stillOn("catalogue")).toBe(true);
    go("plan/abc");
    expect(stillOn("catalogue")).toBe(false);
    expect(stillOn("plan", "abc")).toBe(true);
  });

  it("treats the editor as the same record as the view", () => {
    window.location.hash = "#/plan/abc/edit";
    expect(stillOn("plan", "abc")).toBe(true);
  });
});
