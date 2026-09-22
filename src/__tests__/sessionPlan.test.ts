import { describe, it, expect } from "vitest";
import {
  anotherLike,
  blockMinutes,
  buildSession,
  fitToLength,
  isCarousel,
  planTotals,
  planDrills,
  presetBlocks,
  stationIds,
  moveBlock,
  hasBlockingProblem,
  themeCoverage,
  termPlan,
  withWaterBreak,
  type SessionPlan,
} from "../logic/sessionPlan.js";
import { DRILLS } from "../hub/content/drills.js";
import { PRESETS } from "../hub/content/presets.js";
import {
  AGE_GROUPS,
  THEMES,
  THEME_MIN_AGE,
  ageAtLeast,
  isAvailableAt,
  kitLabel,
  type AgeGroup,
  type Drill,
} from "../hub/content/types.js";

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
      blocks: presetBlocks(preset, DRILLS),
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

  it("leads a coach with nothing logged on what the grade has just been handed", () => {
    // Every theme ties at never in September, so the tie-break is the whole
    // answer. Alphabetical handed a U11 coach the ruck they have had since U10
    // while kicking, which arrives that season, sat fifth.
    expect(termPlan([], "u11", "2026-09-01")[0].theme).toBe("kicking");

    // At U10 the ruck, the maul and the scrum are the new work. Tackling came
    // last year and handling has always been there, so both sort below it.
    const rows = themeCoverage([], "u10", "2026-09-01");
    const at = (theme: string) => rows.findIndex((r) => r.theme === theme);
    expect(at("breakdown"), "a U10 phase should sit above a U9 one").toBeLessThan(at("tackle"));
    expect(at("setpiece")).toBeLessThan(at("tackle"));
    expect(at("tackle"), "a U9 phase should sit above one that was always there").toBeLessThan(
      at("handling"),
    );
  });

  it("still puts what you have actually neglected above what is new", () => {
    // The arrival order is only a tie-break. A U10 coach who has run rucking
    // twice this month and never touched handling needs handling, whatever the
    // regulations handed them in September.
    const rows = themeCoverage(
      [run(["breakdown"], "2026-09-01"), run(["breakdown", "setpiece"], "2026-09-08")],
      "u10",
      "2026-09-15",
    );
    expect(rows[rows.length - 1].theme).toBe("breakdown");
    expect(rows.find((r) => r.theme === "handling")?.runs).toBe(0);
    const at = (theme: string) => rows.findIndex((r) => r.theme === theme);
    expect(at("handling")).toBeLessThan(at("setpiece"));
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
    expect(resolved[0].stations.map((s) => s.drill.id)).toEqual(["a", "b", "c"]);
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
    expect(resolved[0].stations.map((s) => s.drill.id)).toEqual(["b", "c"]);
    // The rows are one and two. The stations are two and three, because the
    // first one is the drill that has gone. Everything with a control on it
    // has to use these rather than the row, or the ✕ beside "c" takes "b" out.
    expect(resolved[0].stations.map((s) => s.at)).toEqual([1, 2]);
  });

  it("addresses the station a coach tapped, not the row it was drawn in", () => {
    const session = plan({ blocks: [{ drillId: "gone", minutes: 8, alongside: ["b", "c"] }] });
    const catalogue = [
      drill("b", { themes: ["handling"] }),
      drill("c", { themes: ["evasion"] }),
      drill("spare-hands", { themes: ["handling"] }),
      drill("spare-feet", { themes: ["evasion"] }),
    ];
    const [resolved] = planDrills(session, catalogue);

    // Row two holds "c", which is station three, because the first station is
    // the drill that has gone. Swapping it has to look at "c" and offer
    // something like "c".
    const second = resolved.stations[1];
    expect(second.drill.id).toBe("c");
    expect(anotherLike(session, catalogue, resolved.index, second.at)?.id).toBe("spare-feet");

    // Reading the row it was drawn in instead lands on "b" and offers a
    // handling drill for an evasion station.
    expect(anotherLike(session, catalogue, resolved.index, 1)?.id).toBe("spare-hands");
  });

  it("gives a plain block one station", () => {
    const resolved = planDrills(plan({ blocks: [{ drillId: "a", minutes: 10 }] }), [drill("a")]);
    expect(resolved[0].stations).toEqual([{ drill: resolved[0].drill, at: 0 }]);
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
    expect(anotherLike(u8, catalogue, 0)).toBeNull();

    const u10 = plan({ ageGroup: "u10", blocks: [{ drillId: "ruck-it", minutes: 10 }] });
    expect(anotherLike(u10, catalogue, 0)).toBeNull();
  });

  it("hands back a legal drill when the block itself is not one", () => {
    // The plan is already warning about this block. Answering the swap with
    // nothing would leave the one control that could clear the warning doing
    // nothing, so the drill on the block is not in the running and the first
    // legal candidate is what comes back.
    const late = [
      drill("u11-only", { themes: ["handling"], minAge: "u11" }),
      drill("fine-here", { themes: ["handling"] }),
    ];
    const u8 = plan({ ageGroup: "u8", blocks: [{ drillId: "u11-only", minutes: 10 }] });
    expect(anotherLike(u8, late, 0)?.id).toBe("fine-here");
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
        blocks: presetBlocks(preset, DRILLS),
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

describe("fitToLength. The time a coach actually has", () => {
  it("stretches the blocks to fill the session", () => {
    const fitted = fitToLength(
      plan({
        sessionMinutes: 60,
        blocks: [{ drillId: "a", minutes: 10 }, { drillId: "b", minutes: 20 }],
      }),
    );
    expect(fitted.blocks.map((b) => b.minutes)).toEqual([20, 40]);
  });

  it("trims them when the session is shorter than the plan", () => {
    const fitted = fitToLength(
      plan({
        sessionMinutes: 30,
        blocks: [{ drillId: "a", minutes: 20 }, { drillId: "b", minutes: 40 }],
      }),
    );
    expect(fitted.blocks.map((b) => b.minutes)).toEqual([10, 20]);
  });

  it("keeps the shape, so the longest block stays the longest", () => {
    const fitted = fitToLength(
      plan({
        sessionMinutes: 50,
        blocks: [
          { drillId: "warm", minutes: 6 },
          { drillId: "skill", minutes: 9 },
          { drillId: "game", minutes: 12 },
        ],
      }),
    );
    const [warm, skill, game] = fitted.blocks.map((b) => b.minutes);
    expect(warm).toBeLessThan(skill);
    expect(skill).toBeLessThan(game);
  });

  it("never lands over the session length", () => {
    // Rounding puts a plan a minute or two over about half the time, which is
    // a warning the coach did not cause and cannot act on.
    for (let minutes = 20; minutes <= 120; minutes += 1) {
      const fitted = fitToLength(
        plan({
          sessionMinutes: minutes,
          blocks: [
            { drillId: "a", minutes: 6 },
            { drillId: "b", minutes: 9 },
            { drillId: "c", minutes: 11 },
            { drillId: "d", minutes: 12 },
          ],
        }),
      );
      const total = fitted.blocks.reduce((sum, b) => sum + blockMinutes(b), 0);
      expect(total, `${minutes} min`).toBeLessThanOrEqual(minutes);
      // And close enough that the planner does not then say there is time left
      expect(minutes - total, `${minutes} min`).toBeLessThanOrEqual(4);
    }
  });

  it("leaves the water breaks alone and counts them", () => {
    const fitted = fitToLength(
      plan({
        sessionMinutes: 60,
        blocks: [
          { drillId: "a", minutes: 10, breakAfter: 3 },
          { drillId: "b", minutes: 10 },
        ],
      }),
    );
    expect(fitted.blocks[0].breakAfter).toBe(3);
    const drills = fitted.blocks.reduce((sum, b) => sum + blockMinutes(b), 0);
    expect(drills).toBe(57);
  });

  it("charges a carousel by the station", () => {
    // Four stations of ten is forty minutes of pitch time, so a block that
    // grows by a minute costs four.
    const fitted = fitToLength(
      plan({
        sessionMinutes: 60,
        blocks: [
          { drillId: "warm", minutes: 6 },
          { drillId: "s1", minutes: 8, alongside: ["s2", "s3", "s4"] },
        ],
      }),
    );
    const total = fitted.blocks.reduce((sum, b) => sum + blockMinutes(b), 0);
    expect(total).toBeLessThanOrEqual(60);
    expect(fitted.blocks[1].minutes * 4).toBe(blockMinutes(fitted.blocks[1]));
  });

  it("hands back the same plan when there is nothing to change", () => {
    const already = plan({
      sessionMinutes: 60,
      blocks: [{ drillId: "a", minutes: 30 }, { drillId: "b", minutes: 30 }],
    });
    expect(fitToLength(already)).toBe(already);
    expect(fitToLength(plan({ sessionMinutes: 60, blocks: [] }))).toBeTruthy();
    expect(fitToLength(plan({ sessionMinutes: 0, blocks: [{ drillId: "a", minutes: 10 }] })))
      .toBeTruthy();
  });

  it("leaves a plan alone rather than cutting a block to nothing", () => {
    // Twelve one minute blocks in a ten minute session. Every one of them is
    // already at its last minute, so the only way to fit is to drop a drill,
    // which is the coach's call rather than this function's.
    const tiny = plan({
      sessionMinutes: 10,
      blocks: Array.from({ length: 12 }, (_, i) => ({ drillId: `d${i}`, minutes: 1 })),
    });
    expect(fitToLength(tiny)).toBe(tiny);
  });

  it("leaves a block the coach has not timed yet at nothing", () => {
    const fitted = fitToLength(
      plan({
        sessionMinutes: 60,
        blocks: [{ drillId: "a", minutes: 20 }, { drillId: "b", minutes: 0 }],
      }),
    );
    expect(fitted.blocks.map((b) => b.minutes)).toEqual([60, 0]);
  });
});

describe("buildSession. One built rather than picked off a list", () => {
  /** Every grade, every theme it may do, at each length the app offers. */
  const recipes = AGE_GROUPS.flatMap((ageGroup) =>
    [undefined, ...THEMES.filter((t) => ageAtLeast(ageGroup, THEME_MIN_AGE[t]))].flatMap((theme) =>
      [45, 60, 75].map((minutes) => ({ ageGroup, theme, minutes })),
    ),
  );

  const build = (recipe: (typeof recipes)[number], seed = 0): SessionPlan =>
    fitToLength(
      withWaterBreak({
        id: "built",
        title: "Built",
        ageGroup: recipe.ageGroup,
        theme: recipe.theme,
        sessionMinutes: recipe.minutes,
        blocks: buildSession(DRILLS, recipe, seed),
      }),
    );

  const label = (recipe: (typeof recipes)[number]): string =>
    `${recipe.ageGroup} ${recipe.theme ?? "mixed"} ${recipe.minutes}min`;

  it("has something to build", () => {
    expect(recipes.length).toBeGreaterThan(80);
  });

  it("opens without a single warning, whatever it is asked for", () => {
    // The same bar the 32 hand-picked sessions are held to. A generated
    // session that opens on "22 minutes still to fill" is worse than no
    // button at all.
    for (const recipe of recipes) {
      for (const seed of [0, 1, 7, 23]) {
        const totals = planTotals(build(recipe, seed), DRILLS);
        expect(totals.warnings.map((w) => w.message), `${label(recipe)} seed ${seed}`).toEqual([]);
      }
    }
  });

  it("starts with a warm-up and ends on a game", () => {
    for (const recipe of recipes) {
      const blocks = planDrills(build(recipe), DRILLS);
      expect(blocks[0]?.drill.kind, label(recipe)).toBe("warmup");
      const last = blocks[blocks.length - 1]?.drill;
      expect(last?.themes.includes("gamesense"), `${label(recipe)} ends on ${last?.title}`).toBe(
        true,
      );
    }
  });

  it("never puts a drill in that the grade is not allowed", () => {
    for (const recipe of recipes) {
      for (const block of planDrills(build(recipe), DRILLS)) {
        expect(
          isAvailableAt(block.drill, recipe.ageGroup),
          `${label(recipe)} got ${block.drill.title}`,
        ).toBe(true);
      }
    }
  });

  it("puts the work asked for in the middle of it", () => {
    for (const recipe of recipes.filter((r) => r.theme)) {
      const blocks = planDrills(build(recipe), DRILLS);
      // The warm-ups are chosen for the theme where one fits, never held to
      // it. Nor is the game at the end: a grade with no game of its own on
      // that theme still has to finish on one.
      const work = blocks.filter((b) => b.drill.kind === "exercise").slice(0, -1);
      expect(work.length, label(recipe)).toBeGreaterThan(0);
      expect(
        work.every((b) => b.drill.themes.includes(recipe.theme!)),
        `${label(recipe)}: ${work.map((b) => b.drill.title).join(", ")}`,
      ).toBe(true);
    }
  });

  it("takes a bit of everything when no theme is asked for", () => {
    for (const recipe of recipes.filter((r) => !r.theme && r.minutes === 60)) {
      const middle = planDrills(build(recipe), DRILLS).slice(1, -1);
      const themes = new Set(middle.flatMap((b) => b.drill.themes));
      expect(themes.size, `${label(recipe)}`).toBeGreaterThan(1);
    }
  });

  it("uses no drill twice", () => {
    for (const recipe of recipes) {
      const ids = buildSession(DRILLS, recipe).map((b) => b.drillId);
      expect(new Set(ids).size, label(recipe)).toBe(ids.length);
    }
  });

  it("gives a different session on a different seed", () => {
    // Tapping it again has to be worth doing, or it is a button that shows the
    // same session twice and looks broken.
    const recipe = { ageGroup: "u10" as const, theme: "handling" as const, minutes: 60 };
    const first = buildSession(DRILLS, recipe, 0).map((b) => b.drillId);
    const second = buildSession(DRILLS, recipe, 3).map((b) => b.drillId);
    expect(second).not.toEqual(first);
  });

  it("gives the same session back on the same seed", () => {
    const recipe = { ageGroup: "u11" as const, theme: "tackle" as const, minutes: 60 };
    expect(buildSession(DRILLS, recipe, 5)).toEqual(buildSession(DRILLS, recipe, 5));
  });
});

/**
 * The next few weeks.
 *
 * The coverage list reads backwards and said nothing at all to a coach who had
 * logged nothing, which is every coach in September. This is the same order
 * laid out forwards, which is the thing the paid competition sells as a season
 * planner.
 */
describe("The next few weeks", () => {
  const run = (themes: string[], ranOn: string) => ({ themes: themes as never, ranOn });

  it("gives a coach with an empty log a term to work through", () => {
    const weeks = termPlan([], "u10", "2026-09-01");
    expect(weeks.map((w) => w.week)).toEqual([1, 2, 3, 4, 5, 6]);
    // U10 may do six themes, so six weeks covers each of them once
    expect(new Set(weeks.map((w) => w.theme)).size).toBe(6);
  });

  it("cycles rather than running out at a grade with three themes", () => {
    // U7 has handling, evasion and game sense. Coming back round in week four
    // is the right answer. A four row list with two blanks is not.
    const weeks = termPlan([], "u7", "2026-09-01");
    expect(weeks).toHaveLength(6);
    expect(weeks[3].theme).toBe(weeks[0].theme);
    expect(weeks[5].theme).toBe(weeks[2].theme);
  });

  it("never offers a grade a theme Regulation 15 does not allow it", () => {
    // Same promise the coverage list makes, through a new route to a screen.
    for (const age of ["u7", "u8"] as const) {
      const themes = termPlan([], age, "2026-09-01").map((w) => w.theme);
      expect(themes).not.toContain("tackle");
      expect(themes).not.toContain("breakdown");
      expect(themes).not.toContain("setpiece");
      expect(themes).not.toContain("kicking");
    }
  });

  it("moves a theme down the list once a night on it has been marked as run", () => {
    const before = termPlan([], "u10", "2026-09-01");
    const after = termPlan([run([before[0].theme], "2026-09-01")], "u10", "2026-09-02");
    expect(after[0].theme, "week one did not move on").not.toBe(before[0].theme);
    expect(after[after.length - 1].theme).toBe(before[0].theme);
  });

  it("carries the reason a week sits where it does", () => {
    const weeks = termPlan([run(["handling"], "2026-09-01")], "u10", "2026-09-29");
    const handling = weeks.find((w) => w.theme === "handling");
    expect(handling?.coverage.runs).toBe(1);
    expect(handling?.coverage.weeksAgo).toBe(4);
    expect(weeks[0].coverage.runs).toBe(0);
  });

  it("asks for no weeks and gets none", () => {
    expect(termPlan([], "u10", "2026-09-01", 0)).toEqual([]);
  });
});
