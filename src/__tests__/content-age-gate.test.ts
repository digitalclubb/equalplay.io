import { readFileSync } from "node:fs";
import { describe, it, expect, beforeEach } from "vitest";
import { renderCatalogue } from "../hub/views/catalogue.js";
import { localPlans, stagePlan } from "../hub/plans.js";
import { addDrillToPlan } from "../hub/views/planner.js";
import { DRILLS, filterDrills, fitsSmallSpace, isAvailableAt, findDrill } from "../hub/content/drills.js";
import { PRESETS, presetsForAge } from "../hub/content/presets.js";
import {
  AGE_GROUPS,
  REGULATION_15_URL,
  RULES_OF_PLAY,
  THEME_MIN_AGE,
  THEMES,
  ageAtLeast,
  type AgeGroup,
  type Drill,
} from "../hub/content/types.js";

/**
 * The load-bearing test in the coaching hub.
 *
 * RFU Regulation 15 introduces contact in stages: tackling at U9, rucks, mauls
 * and the uncontested scrum at U10. There is no lineout below U14, so none of them
 * has one. A catalogue that offered
 * a ruck drill to a U8 coach would not be a cosmetic bug, so the age floors are
 * enforced here rather than left to whoever writes the next drill.
 */
describe("age gating", () => {
  it("no drill sits below the floor for any theme it claims", () => {
    for (const drill of DRILLS) {
      for (const theme of drill.themes) {
        const floor = THEME_MIN_AGE[theme];
        expect(
          ageAtLeast(drill.minAge, floor),
          `"${drill.title}" is tagged ${theme} but starts at ${drill.minAge}; ${theme} is not legal until ${floor}`,
        ).toBe(true);
      }
    }
  });

  it("never surfaces a contact drill to a tag age grade", () => {
    for (const age of ["u7", "u8"] as const) {
      const results = filterDrills(DRILLS, { ageGroup: age });
      for (const drill of results) {
        expect(
          drill.themes.some((t) => t === "tackle" || t === "breakdown" || t === "setpiece"),
          `"${drill.title}" reached ${age}, which plays tag rugby`,
        ).toBe(false);
      }
    }
  });

  it("never surfaces a ruck, maul or scrum drill to U9", () => {
    for (const drill of filterDrills(DRILLS, { ageGroup: "u9" })) {
      expect(
        drill.themes.some((t) => t === "breakdown" || t === "setpiece"),
        `"${drill.title}" reached U9, which has tackling but no ruck, maul or scrum`,
      ).toBe(false);
    }
  });

  it("keeps every theme reachable at the age it is introduced", () => {
    // Guards the opposite failure: a floor set so high the content is unreachable
    for (const theme of THEMES) {
      const floor = THEME_MIN_AGE[theme];
      expect(AGE_GROUPS).toContain(floor);
    }
  });

  it("respects maxAge", () => {
    const tagOnly = DRILLS.filter((d) => d.maxAge);
    expect(tagOnly.length).toBeGreaterThan(0);
    for (const drill of tagOnly) {
      const beyond = AGE_GROUPS[AGE_GROUPS.indexOf(drill.maxAge as AgeGroup) + 1];
      if (beyond) expect(isAvailableAt(drill, beyond)).toBe(false);
      expect(isAvailableAt(drill, drill.maxAge as AgeGroup)).toBe(true);
    }
  });
});

describe("content integrity", () => {
  it("has unique ids", () => {
    const ids = DRILLS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has the fields a coach needs mid-session", () => {
    for (const drill of DRILLS) {
      expect(drill.title.length, drill.id).toBeGreaterThan(0);
      expect(drill.setup.length, drill.id).toBeGreaterThan(0);
      expect(drill.howItRuns.length, drill.id).toBeGreaterThan(0);
      expect(drill.coachingPoints.length, drill.id).toBeGreaterThan(0);
      expect(drill.themes.length, drill.id).toBeGreaterThan(0);
      expect(drill.minutes, drill.id).toBeGreaterThan(0);
      expect(drill.players.min, drill.id).toBeGreaterThan(0);
      expect(drill.space.length, drill.id).toBeGreaterThan(0);
    }
  });

  it("gives every contact drill a safety note", () => {
    const contact = DRILLS.filter((d) =>
      d.themes.some((t) => t === "tackle" || t === "breakdown" || t === "setpiece"),
    );
    expect(contact.length).toBeGreaterThan(0);
    for (const drill of contact) {
      expect(drill.safety, `"${drill.title}" involves contact but has no safety note`).toBeTruthy();
    }
  });

  it("has a max no lower than its min where both are set", () => {
    for (const drill of DRILLS) {
      if (drill.maxAge) expect(ageAtLeast(drill.maxAge, drill.minAge), drill.id).toBe(true);
      if (drill.players.max) {
        expect(drill.players.max, drill.id).toBeGreaterThanOrEqual(drill.players.min);
      }
    }
  });

  it("covers both warm-ups and exercises at every age grade", () => {
    for (const age of AGE_GROUPS) {
      const available = filterDrills(DRILLS, { ageGroup: age });
      expect(available.some((d) => d.kind === "warmup"), `no warm-up for ${age}`).toBe(true);
      expect(available.some((d) => d.kind === "exercise"), `no exercise for ${age}`).toBe(true);
    }
  });
});

describe("presets", () => {
  it("only contain drills their own age grade is allowed to do", () => {
    for (const preset of PRESETS) {
      for (const id of preset.drillIds) {
        const drill = findDrill(id);
        expect(drill, `preset "${preset.title}" points at missing drill ${id}`).toBeTruthy();
        if (!drill) continue;
        expect(
          isAvailableAt(drill, preset.ageGroup),
          `preset "${preset.title}" (${preset.ageGroup}) contains "${drill.title}", which runs ${drill.minAge}${drill.maxAge ? ` to ${drill.maxAge}` : " and up"}`,
        ).toBe(true);
      }
    }
  });

  it("open with a warm-up and fit inside their own session length", () => {
    for (const preset of PRESETS) {
      const drills = preset.drillIds.map(findDrill).filter(Boolean) as Drill[];
      expect(drills[0]?.kind, `preset "${preset.title}" does not start with a warm-up`).toBe("warmup");

      const suggested = drills.reduce((sum, d) => sum + d.minutes, 0);
      expect(
        suggested,
        `preset "${preset.title}" suggests ${suggested} min for a ${preset.sessionMinutes} min session`,
      ).toBeLessThanOrEqual(preset.sessionMinutes);
    }
  });

  it("finish with a game", () => {
    // A session that ends on a drill ends on the coach talking. The drill was
    // only ever there so they could use it in the game.
    for (const preset of PRESETS) {
      const drills = preset.drillIds.map(findDrill).filter(Boolean) as Drill[];
      const last = drills[drills.length - 1];
      expect(
        last?.themes.includes("gamesense"),
        `preset "${preset.title}" ends on "${last?.title}", which is not a game`,
      ).toBe(true);
    }
  });

  it("have unique ids and match their stated theme", () => {
    const ids = PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const preset of PRESETS) {
      const drills = preset.drillIds.map(findDrill).filter(Boolean) as Drill[];
      expect(
        drills.some((d) => d.themes.includes(preset.theme)),
        `preset "${preset.title}" claims ${preset.theme} but no drill in it covers that`,
      ).toBe(true);
    }
  });

  it("are only offered to the age grade they were written for", () => {
    for (const preset of PRESETS) {
      expect(presetsForAge(preset.ageGroup)).toContain(preset);
      for (const age of AGE_GROUPS) {
        if (age !== preset.ageGroup) expect(presetsForAge(age)).not.toContain(preset);
      }
    }
  });
});

describe("filterDrills", () => {
  it("narrows by kind and theme", () => {
    const warmups = filterDrills(DRILLS, { ageGroup: "u12", kind: "warmup" });
    expect(warmups.every((d) => d.kind === "warmup")).toBe(true);

    const tackle = filterDrills(DRILLS, { ageGroup: "u12", theme: "tackle" });
    expect(tackle.length).toBeGreaterThan(0);
    expect(tackle.every((d) => d.themes.includes("tackle"))).toBe(true);
  });

  it("searches title and body text, all words must match", () => {
    expect(filterDrills(DRILLS, { ageGroup: "u12", search: "scrum" }).length).toBeGreaterThan(0);
    expect(filterDrills(DRILLS, { ageGroup: "u12", search: "SCRUM shape" }).length).toBeGreaterThan(0);
    expect(filterDrills(DRILLS, { ageGroup: "u12", search: "scrum unicycle" })).toHaveLength(0);
  });

  it("applies the age gate even when a search would otherwise match", () => {
    expect(filterDrills(DRILLS, { ageGroup: "u12", search: "ruck" }).length).toBeGreaterThan(0);
    // A legal U8 drill may mention the word while explaining why it matters later.
    // What must never come back is a drill about actually doing it.
    for (const drill of filterDrills(DRILLS, { ageGroup: "u8", search: "ruck" })) {
      expect(drill.themes, `"${drill.title}" reached a U8 search for ruck`).not.toContain("breakdown");
    }
  });

  it("finds a drill by id", () => {
    expect(findDrill("drill-two-second-ruck")?.title).toBe("Two second ruck");
    expect(findDrill("nope")).toBeUndefined();
  });
});

describe("favourites never get round the age gate", () => {
  it("hides a starred drill the age grade is not allowed to do", () => {
    const starred = new Set(["drill-two-second-ruck", "drill-corner-ball"]);

    const atU10 = filterDrills(DRILLS, { ageGroup: "u10", onlyFavourites: true, favourites: starred });
    expect(atU10.map((d) => d.id)).toContain("drill-two-second-ruck");

    // Same starred list, younger squad. The ruck drill must not come back.
    const atU8 = filterDrills(DRILLS, { ageGroup: "u8", onlyFavourites: true, favourites: starred });
    expect(atU8.map((d) => d.id)).not.toContain("drill-two-second-ruck");
    expect(atU8.map((d) => d.id)).toContain("drill-corner-ball");
  });

  it("respects maxAge as well, so tag-only work stays out of a contact grade", () => {
    const starred = new Set(["drill-tag-and-turn"]);
    expect(filterDrills(DRILLS, { ageGroup: "u8", onlyFavourites: true, favourites: starred })).toHaveLength(1);
    expect(filterDrills(DRILLS, { ageGroup: "u10", onlyFavourites: true, favourites: starred })).toHaveLength(0);
  });

  it("still applies theme, kind and search on top of the star filter", () => {
    // Every U7 drill, minus the tag-only one that stops at U8
    const starred = new Set(DRILLS.filter((d) => d.minAge === "u7").map((d) => d.id));
    const base = { ageGroup: "u12" as const, onlyFavourites: true, favourites: starred };
    const reachable = DRILLS.filter((d) => starred.has(d.id) && isAvailableAt(d, "u12"));

    expect(filterDrills(DRILLS, base)).toHaveLength(reachable.length);
    expect(reachable.length).toBeLessThan(starred.size);
    expect(
      filterDrills(DRILLS, { ...base, kind: "warmup" }).every((d) => d.kind === "warmup"),
    ).toBe(true);
    expect(
      filterDrills(DRILLS, { ...base, theme: "handling" }).every((d) => d.themes.includes("handling")),
    ).toBe(true);
    expect(filterDrills(DRILLS, { ...base, search: "unicycle" })).toHaveLength(0);
  });

  it("returns nothing when nothing is starred", () => {
    expect(
      filterDrills(DRILLS, { ageGroup: "u12", onlyFavourites: true, favourites: new Set() }),
    ).toHaveLength(0);
  });

  it("ignores the star filter when it is off", () => {
    const all = filterDrills(DRILLS, { ageGroup: "u12" });
    const withEmptySet = filterDrills(DRILLS, { ageGroup: "u12", favourites: new Set() });
    expect(withEmptySet).toHaveLength(all.length);
  });
});

/**
 * The one path a drill can reach a grade that is not allowed to do it.
 *
 * A shared session is a document somebody deliberately sent, so it renders as
 * written rather than being filtered down to the reader's grade. That is a
 * decision rather than an oversight, and it is pinned here so it cannot be made
 * again by accident: the reader is told, in the markup, before the drills.
 */
describe("a shared session is the exception, and says so", () => {
  it("holds every catalogue path to the gate", () => {
    // filterDrills is the only way a drill is surfaced by the app itself. What
    // arrives through a link arrives because a coach sent it.
    const u8 = filterDrills(DRILLS, { ageGroup: "u8" });
    expect(u8.some((drill) => drill.themes.includes("breakdown"))).toBe(false);
  });

  it("warns the reader when the session is above their grade", () => {
    const planner = readFileSync("src/hub/views/planner.ts", "utf8");
    // The comparison, the banner and its role. Drop any one and a U8 coach reads
    // a U12 lineout session with nothing said about it.
    expect(planner).toContain("!ageAtLeast(readerAge, plan.ageGroup)");
    expect(planner).toContain('class="share-grade" role="alert"');
  });

  it("gives the reader's own grade to the view on both routes", () => {
    const main = readFileSync("src/hub/main.ts", "utf8");
    // Signed in it comes off the profile, signed out off the age they picked.
    expect(main).toContain("renderSharedPlan(view, route.param, profile?.ageGroup)");
    expect(main).toContain("renderSharedPlan(view, route.param, chosenAge() ?? undefined)");
  });
});

describe("links out to the RFU's own rules", () => {
  it("has one per age group and nothing missing", () => {
    for (const age of AGE_GROUPS) {
      expect(RULES_OF_PLAY[age], `no rules link for ${age}`).toBeTruthy();
    }
    expect(Object.keys(RULES_OF_PLAY).sort()).toEqual([...AGE_GROUPS].sort());
  });

  it("points at england rugby over https, never a copy of ours", () => {
    for (const url of [...Object.values(RULES_OF_PLAY), REGULATION_15_URL]) {
      expect(url.startsWith("https://www.englandrugby.com/")).toBe(true);
    }
  });

  it("gives each grade its own page rather than all sharing one", () => {
    const urls = Object.values(RULES_OF_PLAY);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("names the right age group in each link", () => {
    for (const age of AGE_GROUPS) {
      expect(RULES_OF_PLAY[age], age).toContain(`-${age}-rules-of-play`);
    }
  });
});

/**
 * A drill page can offer to drop the drill straight into a session. That is a
 * second way a drill reaches a plan, so it needs the same gate the planner's own
 * search has. A coach can browse a grade above their own, so without this an U8
 * session could be handed a ruck drill from two taps away.
 */
describe("adding a drill to a session from the drill page", () => {
  const USER = "00000000-0000-4000-8000-000000000009";
  let container: HTMLElement;

  const offered = (): string[] =>
    [...container.querySelectorAll("[data-addto] .add-title")].map(
      (el) => el.textContent?.trim() ?? "",
    );

  const openPicker = (drillId: string, age: AgeGroup): void => {
    renderCatalogue(container, age, USER, drillId);
    container.querySelector<HTMLButtonElement>("#drill-add")?.click();
  };

  beforeEach(() => {
    // jsdom has no layout, so the drill page's own scroll to the title throws
    Element.prototype.scrollIntoView = (): void => {};
    localStorage.clear();
    window.location.hash = "";
    container = document.createElement("div");
    document.body.replaceChildren(container);
    stagePlan(USER, {
      id: "plan-u7",
      title: "Tag night",
      ageGroup: "u7",
      sessionMinutes: 45,
      blocks: [],
    });
    stagePlan(USER, {
      id: "plan-u12",
      title: "Ruck night",
      ageGroup: "u12",
      sessionMinutes: 60,
      blocks: [],
    });
  });

  it("leaves out a session whose grade is not allowed the drill", () => {
    openPicker("drill-two-second-ruck", "u12");
    expect(offered()).toEqual(["Ruck night"]);
  });

  it("offers both when every grade may do the drill", () => {
    openPicker("warmup-tail-snatch", "u12");
    expect(offered().sort()).toEqual(["Ruck night", "Tag night"]);
  });

  it("says why a session is missing rather than pretending it is not there", () => {
    openPicker("drill-two-second-ruck", "u12");
    expect(container.querySelector(".drill-add")?.textContent).toContain("cannot do this drill");
  });

  it("starts a new session at a grade the drill is allowed in", () => {
    // A drill page is never gated, so a bookmark can open a ruck drill while the
    // catalogue is browsing U8. Starting a session there must not label it U8.
    openPicker("drill-two-second-ruck", "u8");
    container.querySelector<HTMLButtonElement>("#drill-add-new")?.click();

    const started = localPlans(USER).find((plan) => plan.id !== "plan-u7" && plan.id !== "plan-u12");
    if (!started) throw new Error("no session was started");
    expect(isAvailableAt(findDrill("drill-two-second-ruck") as Drill, started.ageGroup)).toBe(true);
    expect(started.blocks.map((b) => b.drillId)).toEqual(["drill-two-second-ruck"]);
  });

  it("comes down to the nearest grade rather than the drill's floor", () => {
    // Browsing U12 and opening the one drill capped at U8. Falling back to the
    // drill's own minAge would hand a U12 coach a U7 session.
    openPicker("drill-tag-and-turn", "u12");
    const button = container.querySelector<HTMLButtonElement>("#drill-add-new");
    expect(button?.dataset.newplan).toBe("u8");
    // Said out loud, because the editor shows the grade as text and the coach
    // has no way to change it afterwards
    expect(button?.textContent).toContain("U8");
  });

  it("refuses at the door, not only in the list that draws it", () => {
    // The picker leaves an illegal session out, and that is a render. This is
    // the function every route into a plan goes through, so the gate lives here
    // too rather than one new caller away from not existing.
    const drill = findDrill("drill-two-second-ruck") as Drill;
    expect(addDrillToPlan(USER, "plan-u7", drill)).toBeNull();
    expect(localPlans(USER).find((p) => p.id === "plan-u7")?.blocks).toEqual([]);

    expect(addDrillToPlan(USER, "plan-u12", drill)).toBe("Ruck night");
    expect(localPlans(USER).find((p) => p.id === "plan-u12")?.blocks).toHaveLength(1);
  });

  it("gates on an account rather than hiding the button", () => {
    renderCatalogue(container, "u12", USER, "drill-two-second-ruck");
    expect(container.querySelector("#drill-add")).not.toBeNull();

    // Signed out. The button is still there, because a drill is never gated. It
    // asks for the account at the point the session would have to persist.
    renderCatalogue(container, "u12", "", "drill-two-second-ruck");
    container.querySelector<HTMLButtonElement>("#drill-add")?.click();
    expect(window.location.hash).toBe("#/join/plans");
  });
});

/**
 * The pitch is frozen and you are in the sports hall, or another age group has
 * the rest of the field. The filter is worked out from each drill's diagram
 * rather than from a field somebody has to keep true by hand.
 */
describe("drills that fit a small space", () => {
  it("keeps a tight drill and drops one that needs a pitch", () => {
    const tight = DRILLS.filter((drill) => drill.diagram && drill.diagram.space[0] <= 10);
    const wide = DRILLS.filter((drill) => drill.diagram && drill.diagram.space[0] >= 40);
    expect(tight.length, "no tight drills to check").toBeGreaterThan(0);
    expect(wide.length, "no wide drills to check").toBeGreaterThan(0);
    for (const drill of tight) expect(fitsSmallSpace(drill), drill.id).toBe(true);
    for (const drill of wide) expect(fitsSmallSpace(drill), drill.id).toBe(false);
  });

  it("counts either orientation, because a room can be turned round", () => {
    for (const drill of DRILLS) {
      if (!drill.diagram) continue;
      const [width, depth] = drill.diagram.space;
      const turned = { ...drill, diagram: { ...drill.diagram, space: [depth, width] as [number, number] } };
      expect(fitsSmallSpace(turned), drill.id).toBe(fitsSmallSpace(drill));
    }
  });

  it("never gets round the age gate", () => {
    // Age is checked before the space is. A ruck drill in a tight square is
    // still a ruck drill, and a U8 hall does not make it legal.
    const u8 = filterDrills(DRILLS, { ageGroup: "u8", smallSpace: true });
    for (const drill of u8) {
      expect(isAvailableAt(drill, "u8"), drill.id).toBe(true);
      expect(drill.themes.includes("breakdown"), drill.id).toBe(false);
    }
  });

  it("leaves every grade something to run rather than emptying the young ones", () => {
    // A tighter box was tried and left U7 two drills out of eighteen, because
    // tag games need running room while contact work happens in a square. A
    // filter that is useless at exactly the grades most likely to be indoors is
    // not a filter worth having.
    for (const age of AGE_GROUPS) {
      const all = filterDrills(DRILLS, { ageGroup: age });
      const small = filterDrills(DRILLS, { ageGroup: age, smallSpace: true });
      expect(small.length, `${age} has too few`).toBeGreaterThan(all.length / 4);
      expect(small.length, `${age} is barely filtered`).toBeLessThan(all.length);
    }
  });

  it("holds a drill with no diagram to the space it states", () => {
    // The rule says a drill with no diagram needs no marked area, which is true
    // of the one mobility warm-up that has none. This stops a later drill
    // arriving with no diagram and a full pitch and being offered for a hall.
    const undrawn = DRILLS.filter((drill) => !drill.diagram);
    for (const drill of undrawn) {
      const metres = (drill.space.match(/\d+/g) ?? []).map(Number);
      expect(metres.length, `${drill.id} states no size`).toBeGreaterThan(0);
      expect(Math.max(...metres), drill.id).toBeLessThanOrEqual(25);
      expect(Math.min(...metres), drill.id).toBeLessThanOrEqual(15);
    }
  });
});
