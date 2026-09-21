import { describe, it, expect } from "vitest";
import {
  anotherLike,
  blockMinutes,
  isCarousel,
  planTotals,
  planDrills,
  stationIds,
  moveBlock,
  hasBlockingProblem,
  themeCoverage,
  withWaterBreak,
  type SessionPlan,
} from "../logic/sessionPlan.js";
import { DRILLS } from "../hub/content/drills.js";
import { PRESETS } from "../hub/content/presets.js";
import { kitLabel, type AgeGroup, type Drill } from "../hub/content/types.js";

function drill(id: string, over: Partial<Drill> = {}): Drill {
  return {
    id,
    title: id,
    kind: "exercise",
    themes: ["handling"],
    minAge: "u7",
    minutes: 10,
    players: { min: 4 },
    space: "10 × 10 m",
    equipment: [],
    setup: "s",
    howItRuns: "h",
    coachingPoints: ["p"],
    ...over,
  };
}

function plan(over: Partial<SessionPlan> = {}): SessionPlan {
  return {
    id: "p1",
    title: "Tuesday",
    ageGroup: "u10",
    sessionMinutes: 60,
    blocks: [],
    ...over,
  };
}

describe("planTotals. Time budget", () => {
  it("sums block minutes, not the drill defaults", () => {
    const catalogue = [drill("a", { minutes: 10 }), drill("b", { minutes: 10 })];
    const totals = planTotals(
      plan({ blocks: [{ drillId: "a", minutes: 25 }, { drillId: "b", minutes: 20 }] }),
      catalogue,
    );
    expect(totals.plannedMinutes).toBe(45);
    expect(totals.remainingMinutes).toBe(15);
  });

  it("reports an overrun as negative remaining time and warns", () => {
    const totals = planTotals(
      plan({ sessionMinutes: 30, blocks: [{ drillId: "a", minutes: 45 }] }),
      [drill("a")],
    );
    expect(totals.remainingMinutes).toBe(-15);
    expect(totals.warnings).toContainEqual({
      level: "warn",
      message: "15 minutes over your 30.",
    });
  });

  it("nudges when there is real slack but tolerates a few spare minutes", () => {
    const slack = planTotals(
      plan({ sessionMinutes: 60, blocks: [{ drillId: "a", minutes: 20 }] }),
      [drill("a")],
    );
    expect(slack.warnings.map((w) => w.message)).toContain("40 minutes still to fill.");

    const snug = planTotals(
      plan({ sessionMinutes: 60, blocks: [{ drillId: "a", minutes: 55 }] }),
      [drill("a")],
    );
    expect(snug.warnings.map((w) => w.message)).not.toContain("5 minutes still to fill.");
  });

  it("splits time between warm-up and exercise", () => {
    const catalogue = [drill("w", { kind: "warmup" }), drill("e")];
    const totals = planTotals(
      plan({ blocks: [{ drillId: "w", minutes: 12 }, { drillId: "e", minutes: 18 }] }),
      catalogue,
    );
    expect(totals.byKind).toEqual({ warmup: 12, exercise: 18 });
  });

  it("treats a negative block duration as zero rather than crediting time back", () => {
    const totals = planTotals(
      plan({ blocks: [{ drillId: "a", minutes: -30 }, { drillId: "a", minutes: 20 }] }),
      [drill("a")],
    );
    expect(totals.plannedMinutes).toBe(20);
  });

  it("an empty plan is not scolded for having no warm-up", () => {
    const totals = planTotals(plan({ blocks: [] }), [drill("a")]);
    expect(totals.warnings.map((w) => w.message)).not.toContain(
      "No warm-up. Children going into contact cold get hurt more.",
    );
  });

  it("flags a plan with drills but no warm-up", () => {
    const totals = planTotals(
      plan({ sessionMinutes: 20, blocks: [{ drillId: "a", minutes: 20 }] }),
      [drill("a")],
    );
    expect(totals.warnings.map((w) => w.level)).toContain("warn");
    expect(totals.warnings.map((w) => w.message)).toContain(
      "No warm-up. Children going into contact cold get hurt more.",
    );
  });
});

describe("planTotals. The age gate", () => {
  it("raises an error, not a nudge, for a drill the age grade cannot do", () => {
    const catalogue = [drill("ruck", { title: "Two second ruck", minAge: "u10", themes: ["breakdown"] })];
    const totals = planTotals(
      plan({ ageGroup: "u8", sessionMinutes: 12, blocks: [{ drillId: "ruck", minutes: 12 }] }),
      catalogue,
    );
    expect(totals.warnings).toContainEqual({
      level: "error",
      message: "Two second ruck is not for U8. Take it out.",
    });
    expect(hasBlockingProblem(totals)).toBe(true);
  });

  it("respects maxAge, so tag-only work is blocked for a contact age grade", () => {
    const catalogue = [drill("tag", { title: "Tag and turn", minAge: "u7", maxAge: "u8" })];
    const totals = planTotals(
      plan({ ageGroup: "u10", blocks: [{ drillId: "tag", minutes: 8 }] }),
      catalogue,
    );
    expect(hasBlockingProblem(totals)).toBe(true);
  });

  it("passes a legal plan cleanly", () => {
    const catalogue = [drill("ruck", { minAge: "u10", themes: ["breakdown"] })];
    const totals = planTotals(
      plan({ ageGroup: "u11", sessionMinutes: 12, blocks: [{ drillId: "ruck", minutes: 12 }] }),
      catalogue,
    );
    expect(hasBlockingProblem(totals)).toBe(false);
  });
});

describe("planTotals. Kit list", () => {
  const labels = (totals: ReturnType<typeof planTotals>): string[] =>
    totals.equipment.map(kitLabel);

  it("takes the largest count per item, never the sum. Drills run one at a time", () => {
    const catalogue = [
      drill("a", { equipment: [{ item: "cone", qty: 6 }] }),
      drill("b", { equipment: [{ item: "cone", qty: 4 }] }),
      drill("c", { equipment: [{ item: "cone", qty: 8 }] }),
    ];
    const totals = planTotals(
      plan({
        blocks: [
          { drillId: "a", minutes: 10 },
          { drillId: "b", minutes: 10 },
          { drillId: "c", minutes: 10 },
        ],
      }),
      catalogue,
    );
    expect(labels(totals)).toEqual(["8 cones"]);
  });

  it("keeps one line per item, in the order the plan was built", () => {
    const catalogue = [
      drill("a", { equipment: [{ item: "cone", qty: 4 }, { item: "ball", qty: 2 }] }),
      drill("b", { equipment: [{ item: "ball", qty: 2 }, { item: "tackle shield", qty: 1 }] }),
    ];
    const totals = planTotals(
      plan({ blocks: [{ drillId: "a", minutes: 20 }, { drillId: "b", minutes: 20 }] }),
      catalogue,
    );
    expect(labels(totals)).toEqual(["4 cones", "2 balls", "1 tackle shield"]);
  });

  it("lets a per-pair requirement beat any absolute count for the same item", () => {
    const catalogue = [
      drill("a", { equipment: [{ item: "ball", qty: 2 }] }),
      drill("b", { equipment: [{ item: "ball", qty: 1, per: "pair" }] }),
    ];
    const totals = planTotals(
      plan({ blocks: [{ drillId: "a", minutes: 10 }, { drillId: "b", minutes: 10 }] }),
      catalogue,
    );
    expect(labels(totals)).toEqual(["1 ball per pair"]);
  });

  it("lets per-player beat per-pair, whichever order they appear in", () => {
    const catalogue = [
      drill("a", { equipment: [{ item: "tag", qty: 1, per: "pair" }] }),
      drill("b", { equipment: [{ item: "tag", qty: 2, per: "player" }] }),
    ];
    const forwards = planTotals(
      plan({ blocks: [{ drillId: "a", minutes: 10 }, { drillId: "b", minutes: 10 }] }),
      catalogue,
    );
    const backwards = planTotals(
      plan({ blocks: [{ drillId: "b", minutes: 10 }, { drillId: "a", minutes: 10 }] }),
      catalogue,
    );
    expect(labels(forwards)).toEqual(["2 tags per player"]);
    expect(labels(backwards)).toEqual(["2 tags per player"]);
  });

  it("collapses a repeat within one drill's own list", () => {
    const totals = planTotals(
      plan({ blocks: [{ drillId: "a", minutes: 10 }] }),
      [drill("a", { equipment: [{ item: "cone", qty: 4 }, { item: "cone", qty: 4 }] })],
    );
    expect(labels(totals)).toEqual(["4 cones"]);
  });

  it("singularises a count of one", () => {
    const totals = planTotals(
      plan({ blocks: [{ drillId: "a", minutes: 10 }] }),
      [drill("a", { equipment: [{ item: "ball", qty: 1 }] })],
    );
    expect(labels(totals)).toEqual(["1 ball"]);
  });

  it("names kit carried for one short block only", () => {
    const catalogue = [
      drill("a", { equipment: [{ item: "cone", qty: 4 }, { item: "tackle shield", qty: 1 }] }),
      drill("b", { equipment: [{ item: "cone", qty: 4 }] }),
    ];
    const totals = planTotals(
      plan({ blocks: [{ drillId: "a", minutes: 8 }, { drillId: "b", minutes: 30 }] }),
      catalogue,
    );
    expect(totals.singleUseEquipment).toEqual(["tackle shield"]);
  });

  it("does not name kit that earns its place across a long block", () => {
    const totals = planTotals(
      plan({ blocks: [{ drillId: "a", minutes: 30 }] }),
      [drill("a", { equipment: [{ item: "tackle shield", qty: 1 }] })],
    );
    expect(totals.singleUseEquipment).toEqual([]);
  });
});

describe("planTotals. Missing drills", () => {
  it("survives a plan referencing a drill that no longer exists", () => {
    const totals = planTotals(
      plan({ sessionMinutes: 20, blocks: [{ drillId: "gone", minutes: 20 }, { drillId: "a", minutes: 20 }] }),
      [drill("a")],
    );
    expect(totals.missingDrillIds).toEqual(["gone"]);
    expect(totals.plannedMinutes).toBe(20);
    expect(hasBlockingProblem(totals)).toBe(true);
    expect(totals.warnings.map((w) => w.message)).toContain(
      "One drill in here no longer exists. Take it out.",
    );
  });

  it("pluralises when several are missing", () => {
    const totals = planTotals(
      plan({ blocks: [{ drillId: "x", minutes: 5 }, { drillId: "y", minutes: 5 }] }),
      [],
    );
    expect(totals.warnings.map((w) => w.message)).toContain(
      "2 drills in here no longer exist. Take them out.",
    );
  });
});

describe("planDrills", () => {
  it("resolves blocks in order and drops the unresolvable", () => {
    const resolved = planDrills(
      plan({ blocks: [{ drillId: "b", minutes: 5 }, { drillId: "gone", minutes: 5 }, { drillId: "a", minutes: 5 }] }),
      [drill("a"), drill("b")],
    );
    expect(resolved.map((r) => r.drill.id)).toEqual(["b", "a"]);
  });
});

describe("moveBlock", () => {
  const blocks = [
    { drillId: "a", minutes: 5 },
    { drillId: "b", minutes: 5 },
    { drillId: "c", minutes: 5 },
  ];
  const ids = (list: typeof blocks): string[] => list.map((b) => b.drillId);

  it("moves down and up", () => {
    expect(ids(moveBlock(blocks, 0, 2))).toEqual(["b", "c", "a"]);
    expect(ids(moveBlock(blocks, 2, 0))).toEqual(["c", "a", "b"]);
  });

  it("clamps rather than dropping a block off either end", () => {
    expect(ids(moveBlock(blocks, 0, -5))).toEqual(["a", "b", "c"]);
    expect(ids(moveBlock(blocks, 2, 99))).toEqual(["a", "b", "c"]);
    expect(moveBlock(blocks, 0, 99)).toHaveLength(3);
  });

  it("ignores an out-of-range source and never mutates the input", () => {
    expect(moveBlock(blocks, 7, 0)).toBe(blocks);
    moveBlock(blocks, 0, 2);
    expect(ids(blocks)).toEqual(["a", "b", "c"]);
  });
});

describe("against the real catalogue", () => {
  it("a hand-built U10 session totals up and passes the age gate", () => {
    const real = plan({
      ageGroup: "u10",
      sessionMinutes: 60,
      blocks: [
        { drillId: "warmup-move-and-brace", minutes: 8 },
        { drillId: "warmup-down-and-up", minutes: 6 },
        { drillId: "drill-long-placement", minutes: 10 },
        { drillId: "drill-two-second-ruck", minutes: 12 },
        { drillId: "drill-corner-ball", minutes: 10 },
      ],
    });
    const totals = planTotals(real, DRILLS);

    expect(totals.plannedMinutes).toBe(46);
    expect(totals.byKind.warmup).toBe(14);
    expect(totals.missingDrillIds).toEqual([]);
    expect(hasBlockingProblem(totals)).toBe(false);
    expect(totals.equipment.map(kitLabel)).toContain("1 tackle shield per pair");
  });

  it("the same session dropped to U8 is blocked on every contact drill", () => {
    const totals = planTotals(
      plan({
        ageGroup: "u8" as AgeGroup,
        blocks: [
          { drillId: "drill-long-placement", minutes: 10 },
          { drillId: "drill-two-second-ruck", minutes: 12 },
        ],
      }),
      DRILLS,
    );
    expect(totals.warnings.filter((w) => w.level === "error")).toHaveLength(2);
  });
});

describe("water breaks", () => {
  it("counts break minutes towards the session", () => {
    const totals = planTotals(
      plan({
        sessionMinutes: 60,
        blocks: [
          { drillId: "a", minutes: 20, breakAfter: 5 },
          { drillId: "a", minutes: 20 },
        ],
      }),
      [drill("a")],
    );
    expect(totals.breakMinutes).toBe(5);
    expect(totals.plannedMinutes).toBe(45);
    expect(totals.remainingMinutes).toBe(15);
  });

  it("keeps breaks out of the warm-up and exercise split", () => {
    const totals = planTotals(
      plan({ blocks: [{ drillId: "w", minutes: 10, breakAfter: 5 }] }),
      [drill("w", { kind: "warmup" })],
    );
    expect(totals.byKind).toEqual({ warmup: 10, exercise: 0 });
    expect(totals.plannedMinutes).toBe(15);
  });

  it("treats a plan with no breaks as fine when it is short", () => {
    const totals = planTotals(
      plan({
        sessionMinutes: 30,
        blocks: [{ drillId: "w", minutes: 10 }, { drillId: "a", minutes: 20 }],
      }),
      [drill("w", { kind: "warmup" }), drill("a")],
    );
    expect(totals.warnings.map((warning) => warning.message)).not.toContain(
      "No water breaks in 30 minutes. Add one after a block.",
    );
  });

  it("mentions it on a long session with none", () => {
    const totals = planTotals(
      plan({
        sessionMinutes: 60,
        blocks: [{ drillId: "w", minutes: 20 }, { drillId: "a", minutes: 40 }],
      }),
      [drill("w", { kind: "warmup" }), drill("a")],
    );
    expect(totals.warnings.map((warning) => warning.message)).toContain(
      "No water breaks in 60 minutes. Add one after a block.",
    );
  });

  it("stops mentioning it once there is one", () => {
    const totals = planTotals(
      plan({
        sessionMinutes: 60,
        blocks: [{ drillId: "w", minutes: 20, breakAfter: 5 }, { drillId: "a", minutes: 35 }],
      }),
      [drill("w", { kind: "warmup" }), drill("a")],
    );
    expect(totals.warnings.map((warning) => warning.message).join(" ")).not.toContain("water breaks");
  });

  it("ignores a negative break", () => {
    const totals = planTotals(
      plan({ blocks: [{ drillId: "a", minutes: 20, breakAfter: -10 }] }),
      [drill("a")],
    );
    expect(totals.breakMinutes).toBe(0);
    expect(totals.plannedMinutes).toBe(20);
  });

  it("does not nag a single block session", () => {
    const totals = planTotals(
      plan({ sessionMinutes: 60, blocks: [{ drillId: "w", minutes: 60 }] }),
      [drill("w", { kind: "warmup" })],
    );
    expect(totals.warnings.map((warning) => warning.message).join(" ")).not.toContain("water breaks");
  });
});

describe("planDrills carries the real block index", () => {
  // A saved plan pointing at a drill that no longer exists shifts every position
  // after it. Editing controls address plan.blocks, so they need the real index.
  const catalogue = [drill("a", { title: "First" }), drill("b", { title: "Second" })];
  const withGap = plan({
    blocks: [
      { drillId: "gone", minutes: 10 },
      { drillId: "a", minutes: 10 },
      { drillId: "vanished", minutes: 10 },
      { drillId: "b", minutes: 10 },
    ],
  });

  it("reports where each resolved block actually sits", () => {
    const resolved = planDrills(withGap, catalogue);
    expect(resolved.map((r) => r.drill.title)).toEqual(["First", "Second"]);
    // Rendered at positions 0 and 1, but they live at 1 and 3
    expect(resolved.map((r) => r.index)).toEqual([1, 3]);
  });

  it("means removing the second visible block removes the right one", () => {
    const resolved = planDrills(withGap, catalogue);
    const target = resolved[1].index;
    const after = withGap.blocks.filter((_, i) => i !== target);
    expect(after.map((b) => b.drillId)).toEqual(["gone", "a", "vanished"]);
  });

  it("and the indexes line up when nothing is missing", () => {
    const tidy = plan({ blocks: [{ drillId: "a", minutes: 5 }, { drillId: "b", minutes: 5 }] });
    expect(planDrills(tidy, catalogue).map((r) => r.index)).toEqual([0, 1]);
  });
});

/**
 * The presets are the first thing a coach opens, so they are held to the standard
 * the planner itself sets. Every one of them, built the way `fromPreset` builds
 * it, has to come up clean: nothing illegal, nothing missing, the time filled and
 * a break in it. A ready-made session that opens on "22 minutes still to fill" is
 * worse than no ready-made session.
 */
describe("presets as real sessions", () => {
  const built = PRESETS.map((preset) =>
    withWaterBreak({
      id: preset.id,
      title: preset.title,
      ageGroup: preset.ageGroup,
      theme: preset.theme,
      sessionMinutes: preset.sessionMinutes,
      blocks: preset.drillIds.flatMap((drillId) => {
        const found = DRILLS.find((d) => d.id === drillId);
        return found ? [{ drillId, minutes: found.minutes }] : [];
      }),
    }),
  );

  it("open without a single warning", () => {
    for (const session of built) {
      const totals = planTotals(session, DRILLS);
      expect(totals.warnings.map((w) => w.message), `preset "${session.title}"`).toEqual([]);
    }
  });

  it("carry a water break somewhere in the middle", () => {
    for (const session of built) {
      const at = session.blocks.findIndex((block) => block.breakAfter);
      expect(at, `preset "${session.title}" has no break`).toBeGreaterThan(-1);
      expect(at, `preset "${session.title}" breaks after the last block`).toBeLessThan(
        session.blocks.length - 1,
      );
    }
  });

  it("leaves a plan that already has a break alone", () => {
    const already = plan({
      sessionMinutes: 60,
      blocks: [
        { drillId: "a", minutes: 20, breakAfter: 5 },
        { drillId: "b", minutes: 20 },
      ],
    });
    expect(withWaterBreak(already)).toBe(already);
  });

  it("leaves a short session alone", () => {
    const short = plan({
      sessionMinutes: 30,
      blocks: [{ drillId: "a", minutes: 15 }, { drillId: "b", minutes: 15 }],
    });
    expect(withWaterBreak(short)).toBe(short);
  });
});

describe("Coverage. What you have not been coaching", () => {
  const run = (themes: string[], ranOn: string) => ({ themes: themes as never, ranOn });

  it("puts a theme never coached above one coached a while ago", () => {
    const rows = themeCoverage(
      [run(["handling"], "2026-09-01")],
      "u10",
      "2026-09-29",
    );
    // Handling was four weeks back. Everything else has never happened at all,
    // which is the thing a volunteer cannot see for themselves.
    expect(rows[rows.length - 1].theme).toBe("handling");
    expect(rows.filter((r) => r.runs === 0).length).toBe(5);
  });

  it("only counts themes the grade is allowed to do", () => {
    // Telling a U8 coach they have neglected rucking is telling them to break
    // Regulation 15, which is the opposite of what this app is for.
    const rows = themeCoverage([], "u8", "2026-09-29");
    expect(rows.map((r) => r.theme).sort()).toEqual(["evasion", "gamesense", "handling"]);
  });

  it("counts every night a theme appears in", () => {
    const rows = themeCoverage(
      [
        run(["handling"], "2026-09-01"),
        run(["handling", "evasion"], "2026-09-08"),
        run(["handling"], "2026-09-15"),
      ],
      "u10",
      "2026-09-15",
    );
    const handling = rows.find((r) => r.theme === "handling");
    expect(handling?.runs).toBe(3);
    expect(handling?.last).toBe("2026-09-15");
    expect(handling?.weeksAgo).toBe(0);
  });

  it("measures in whole weeks from the most recent night", () => {
    const rows = themeCoverage(
      [run(["handling"], "2026-08-04"), run(["handling"], "2026-09-01")],
      "u10",
      "2026-09-15",
    );
    expect(rows.find((r) => r.theme === "handling")?.weeksAgo).toBe(2);
  });

  it("never reports a night in the future as coached weeks ago", () => {
    // A phone with its clock set wrong would otherwise sort above a theme that
    // has genuinely never been coached.
    const rows = themeCoverage([run(["handling"], "2026-12-25")], "u10", "2026-09-15");
    expect(rows.find((r) => r.theme === "handling")?.weeksAgo).toBe(0);
  });
});

/**
 * Carousels. Four stations running at once, one coach on each, groups rotating.
 *
 * The whole feature is arithmetic plus an age gate, and both are easy to get
 * subtly wrong in a way nobody notices until a Sunday. A carousel counted as one
 * station's minutes turns an hour's plan into two hours on the grass. Kit taken
 * as the largest station rather than the sum sends a coach to a pitch with a
 * quarter of the cones. A gate checked on the first station only lets a ruck
 * drill reach an U8 through station three.
 */
describe("planTotals. Carousels", () => {
  const four = { drillId: "a", minutes: 8, alongside: ["b", "c", "d"] };
  const catalogue = [drill("a"), drill("b"), drill("c"), drill("d")];

  it("knows a station's minutes from the block's", () => {
    expect(blockMinutes(four)).toBe(32);
    expect(blockMinutes({ drillId: "a", minutes: 8 })).toBe(8);
    expect(isCarousel(four)).toBe(true);
    expect(isCarousel({ drillId: "a", minutes: 8 })).toBe(false);
    expect(stationIds(four)).toEqual(["a", "b", "c", "d"]);
  });

  it("counts every group's trip round, not one station", () => {
    const totals = planTotals(plan({ blocks: [four] }), catalogue);
    // Eight minutes at each of four stations is half an hour of pitch time.
    // Counting it as eight is how a session that looks like an hour runs two.
    expect(totals.plannedMinutes).toBe(32);
    expect(totals.remainingMinutes).toBe(28);
  });

  it("splits the time by what each station is", () => {
    const totals = planTotals(
      plan({ blocks: [{ drillId: "a", minutes: 8, alongside: ["w"] }] }),
      [drill("a"), drill("w", { kind: "warmup" })],
    );
    expect(totals.byKind).toEqual({ warmup: 8, exercise: 8 });
  });

  it("adds the kit up across the stations, because they are all out at once", () => {
    const totals = planTotals(
      plan({ blocks: [{ drillId: "a", minutes: 8, alongside: ["b"] }] }),
      [
        drill("a", { equipment: [{ item: "cone", qty: 8 }] }),
        drill("b", { equipment: [{ item: "cone", qty: 6 }, { item: "ball", qty: 2 }] }),
      ],
    );
    expect(totals.equipment.map(kitLabel)).toEqual(["14 cones", "2 balls"]);
  });

  it("still takes the largest across blocks that follow one another", () => {
    // The carousel needs fourteen at once. The block after it needs four, and
    // the same cones go back out for it, so fourteen is what goes in the bag.
    const totals = planTotals(
      plan({
        blocks: [
          { drillId: "a", minutes: 8, alongside: ["b"] },
          { drillId: "c", minutes: 10 },
        ],
      }),
      [
        drill("a", { equipment: [{ item: "cone", qty: 8 }] }),
        drill("b", { equipment: [{ item: "cone", qty: 6 }] }),
        drill("c", { equipment: [{ item: "cone", qty: 4 }] }),
      ],
    );
    expect(totals.equipment.map(kitLabel)).toEqual(["14 cones"]);
  });

  it("gates every station, not only the first", () => {
    // The one that matters. A carousel is a route a drill can take to a screen
    // without passing the catalogue, so a ruck drill at station three has to be
    // caught here or it is not caught at all.
    const totals = planTotals(
      plan({ ageGroup: "u8", blocks: [{ drillId: "a", minutes: 8, alongside: ["ruck"] }] }),
      [drill("a"), drill("ruck", { minAge: "u10", themes: ["breakdown"] })],
    );
    expect(totals.warnings[0].level).toBe("error");
    expect(totals.warnings[0].message).toContain("ruck");
    expect(hasBlockingProblem(totals)).toBe(true);
  });

  it("says an illegal drill once however many stations it is on", () => {
    const totals = planTotals(
      plan({ ageGroup: "u8", blocks: [{ drillId: "ruck", minutes: 8, alongside: ["ruck"] }] }),
      [drill("ruck", { minAge: "u10" })],
    );
    expect(totals.warnings.filter((w) => w.level === "error")).toHaveLength(1);
  });

  it("reports a station that no longer exists", () => {
    const totals = planTotals(
      plan({ blocks: [{ drillId: "a", minutes: 8, alongside: ["gone"] }] }),
      [drill("a")],
    );
    expect(totals.missingDrillIds).toEqual(["gone"]);
    // The slot still counts. A total that shrinks when a drill is renamed is one
    // nobody can reconcile against the stations in front of them.
    expect(totals.plannedMinutes).toBe(16);
  });

  it("puts the water break at the halfway point of the real length", () => {
    // Sixteen minutes of carousel then a ten minute block is halfway through the
    // carousel, so the break belongs after it rather than after the short block.
    const withBreak = withWaterBreak(
      plan({
        sessionMinutes: 60,
        blocks: [
          { drillId: "a", minutes: 8, alongside: ["b"] },
          { drillId: "c", minutes: 10 },
        ],
      }),
    );
    expect(withBreak.blocks[0].breakAfter).toBe(3);
    expect(withBreak.blocks[1].breakAfter).toBeUndefined();
  });
});

describe("planDrills. Carousels", () => {
  it("resolves every station, in order, the lead first", () => {
    const resolved = planDrills(
      plan({ blocks: [{ drillId: "a", minutes: 8, alongside: ["b", "c"] }] }),
      [drill("a"), drill("b"), drill("c")],
    );
    expect(resolved[0].stations.map((d) => d.id)).toEqual(["a", "b", "c"]);
    expect(resolved[0].drill.id).toBe("a");
  });

  it("keeps the block when the lead station has gone", () => {
    // Dropping the block would take three good drills out of the running order
    // because a fourth was renamed.
    const resolved = planDrills(
      plan({ blocks: [{ drillId: "gone", minutes: 8, alongside: ["b", "c"] }] }),
      [drill("b"), drill("c")],
    );
    expect(resolved).toHaveLength(1);
    expect(resolved[0].drill.id).toBe("b");
    expect(resolved[0].stations.map((d) => d.id)).toEqual(["b", "c"]);
  });

  it("gives a plain block one station", () => {
    const resolved = planDrills(plan({ blocks: [{ drillId: "a", minutes: 10 }] }), [drill("a")]);
    expect(resolved[0].stations).toEqual([resolved[0].drill]);
  });
});

describe("anotherLike. Swapping a drill for one of the same sort", () => {
  const catalogue = [
    drill("keep-ball", { themes: ["gamesense", "handling"] }),
    drill("pass-line", { themes: ["handling"] }),
    drill("corner-ball", { themes: ["handling"] }),
    drill("ruck-it", { themes: ["breakdown"], minAge: "u10" }),
    drill("warm-a", { kind: "warmup", themes: ["handling"] }),
    drill("warm-b", { kind: "warmup", themes: ["handling"] }),
  ];

  const session = (blocks: { drillId: string; alongside?: string[] }[]): SessionPlan =>
    plan({ blocks: blocks.map((b) => ({ ...b, minutes: 10 })) });

  it("keeps the kind, so a warm-up can only become another warm-up", () => {
    const next = anotherLike(session([{ drillId: "warm-a" }]), catalogue, 0);
    expect(next?.id).toBe("warm-b");
  });

  it("offers any warm-up, nearest work first", () => {
    // Three warm-ups in the whole catalogue are the only one of their theme, so
    // a rule that holds the swap to a shared theme leaves the scrum session and
    // the kicking one unable to change their warm-up at all.
    const warmups = [
      drill("warm-kick", { kind: "warmup", themes: ["kicking"], minAge: "u11" }),
      drill("warm-any", { kind: "warmup", themes: ["handling"], minAge: "u11" }),
      drill("warm-kick-two", { kind: "warmup", themes: ["kicking"], minAge: "u11" }),
    ];
    const u11 = plan({ ageGroup: "u11", blocks: [{ drillId: "warm-kick", minutes: 6 }] });
    expect(anotherLike(u11, warmups, 0)?.id).toBe("warm-kick-two");
    expect(
      anotherLike(plan({ ageGroup: "u11", blocks: [{ drillId: "warm-kick-two", minutes: 6 }] }), warmups, 0)?.id,
    ).toBe("warm-any");
  });

  it("holds an exercise to the same sort of work", () => {
    // A warm-up is a warm-up. A ruck drill is not a tag game, so the widening
    // above stops at the exercises.
    const mixed = [
      drill("ruck-a", { themes: ["breakdown"], minAge: "u10" }),
      drill("tag-a", { themes: ["evasion"] }),
    ];
    const u10 = plan({ ageGroup: "u10", blocks: [{ drillId: "ruck-a", minutes: 10 }] });
    expect(anotherLike(u10, mixed, 0)).toBeNull();
  });

  it("only offers a drill that shares the work", () => {
    const next = anotherLike(session([{ drillId: "pass-line" }]), catalogue, 0);
    expect(next?.themes).toContain("handling");
  });

  it("never offers a drill the age grade is not allowed", () => {
    const u8 = plan({ ageGroup: "u8", blocks: [{ drillId: "ruck-it", minutes: 10 }] });
    // The block itself is illegal, which is what the plan is already warning
    // about. Swapping it has to hand back something legal rather than nothing.
    expect(anotherLike(u8, catalogue, 0)).toBeNull();

    const u10 = plan({ ageGroup: "u10", blocks: [{ drillId: "ruck-it", minutes: 10 }] });
    expect(anotherLike(u10, catalogue, 0)).toBeNull();
  });

  it("skips a drill the session already has", () => {
    const next = anotherLike(
      session([{ drillId: "pass-line" }, { drillId: "corner-ball" }]),
      catalogue,
      0,
    );
    expect(next?.id).toBe("keep-ball");
  });

  it("walks the list on every tap and comes back round", () => {
    const one = anotherLike(session([{ drillId: "keep-ball" }]), catalogue, 0);
    expect(one?.id).toBe("pass-line");
    const two = anotherLike(session([{ drillId: "pass-line" }]), catalogue, 0);
    expect(two?.id).toBe("corner-ball");
    const three = anotherLike(session([{ drillId: "corner-ball" }]), catalogue, 0);
    expect(three?.id).toBe("keep-ball");
  });

  it("swaps the station asked for, not the block's own drill", () => {
    const carousel = session([{ drillId: "warm-a", alongside: ["pass-line"] }]);
    expect(anotherLike(carousel, catalogue, 0, 1)?.id).toBe("corner-ball");
    expect(anotherLike(carousel, catalogue, 0, 0)?.id).toBe("warm-b");
  });

  it("says so when there is nothing else like it", () => {
    const only = [drill("alone", { themes: ["kicking"] })];
    expect(anotherLike(session([{ drillId: "alone" }]), only, 0)).toBeNull();
  });

  it("holds its nerve on a block or a station that is not there", () => {
    expect(anotherLike(session([{ drillId: "pass-line" }]), catalogue, 4)).toBeNull();
    expect(anotherLike(session([{ drillId: "pass-line" }]), catalogue, 0, 3)).toBeNull();
    expect(anotherLike(session([{ drillId: "ghost" }]), catalogue, 0)).toBeNull();
  });

  it("offers a real swap for every block of every ready-made session", () => {
    // The control is rendered per block, so a preset with nowhere to go on one
    // of its blocks is a button that does nothing on the screen a coach is
    // most likely to reach it from.
    for (const preset of PRESETS) {
      const built: SessionPlan = {
        id: preset.id,
        title: preset.title,
        ageGroup: preset.ageGroup,
        sessionMinutes: preset.sessionMinutes,
        blocks: preset.drillIds.flatMap((drillId) => {
          const found = DRILLS.find((d) => d.id === drillId);
          return found ? [{ drillId, minutes: found.minutes }] : [];
        }),
      };
      built.blocks.forEach((block, index) => {
        expect(
          anotherLike(built, DRILLS, index)?.id,
          `"${preset.title}" has nothing to swap ${block.drillId} for`,
        ).toBeTruthy();
      });
    }
  });
});
