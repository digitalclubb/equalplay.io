import { describe, it, expect } from "vitest";
import {
  applySwaps,
  drillAtHeadcount,
  planTotals,
  planDrills,
  moveBlock,
  hasBlockingProblem,
  standIns,
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

describe("Tonight. Eight turned up", () => {
  it("says whether a drill runs with the group that came", () => {
    const tight = drill("tight", { players: { min: 10, max: 16 } });
    expect(drillAtHeadcount(tight, 8)).toBe("short");
    expect(drillAtHeadcount(tight, 12)).toBe("works");
    expect(drillAtHeadcount(tight, 20)).toBe("over");
  });

  it("counts a drill with no ceiling as working however many turn up", () => {
    const open = drill("open", { players: { min: 4 } });
    expect(drillAtHeadcount(open, 40)).toBe("works");
  });

  it("never offers a stand-in the grade may not do", () => {
    // The whole point of the app. A stand-in is a second route a drill can take
    // to a session, so the gate has to hold on it as much as on the catalogue.
    const catalogue = [
      drill("legal", { minAge: "u7", players: { min: 4 } }),
      drill("ruck", { minAge: "u12", players: { min: 4 } }),
    ];
    const broken = drill("broken", { players: { min: 30 } });
    const found = standIns(broken, plan({ ageGroup: "u10", blocks: [] }), catalogue, 8);
    expect(found.map((d) => d.id)).toEqual(["legal"]);
  });

  it("keeps a stand-in to the same kind and the same theme", () => {
    const catalogue = [
      drill("same", { themes: ["handling"], kind: "exercise" }),
      drill("warmup", { themes: ["handling"], kind: "warmup" }),
      drill("other", { themes: ["tackle"], kind: "exercise", minAge: "u9" }),
    ];
    const broken = drill("broken", { themes: ["handling"], players: { min: 30 } });
    const found = standIns(broken, plan({ blocks: [] }), catalogue, 8);
    expect(found.map((d) => d.id)).toEqual(["same"]);
  });

  it("never offers a drill the session already has", () => {
    const catalogue = [drill("a"), drill("b")];
    const broken = drill("broken", { players: { min: 30 } });
    const found = standIns(
      broken,
      plan({ blocks: [{ drillId: "a", minutes: 10 }] }),
      catalogue,
      8,
    );
    expect(found.map((d) => d.id)).toEqual(["b"]);
  });

  it("stands a drill in for tonight without touching the session", () => {
    const catalogue = [drill("a"), drill("b")];
    const session = plan({ blocks: [{ drillId: "a", minutes: 10 }] });
    const swapped = applySwaps(planDrills(session, catalogue), { 0: "b" }, catalogue, "u10");

    expect(swapped[0].drill.id).toBe("b");
    expect(swapped[0].swappedFor?.id).toBe("a");
    // The plan is what the coach wrote. Next week twenty turn up again.
    expect(session.blocks[0].drillId).toBe("a");
  });

  it("drops a swap naming a drill the grade may not do", () => {
    // Storage is hand-editable and a grade can be corrected after the fact, so
    // the gate is checked on the way out as well as on the way in.
    const catalogue = [drill("a"), drill("ruck", { minAge: "u12" })];
    const session = plan({ ageGroup: "u10", blocks: [{ drillId: "a", minutes: 10 }] });
    const swapped = applySwaps(planDrills(session, catalogue), { 0: "ruck" }, catalogue, "u10");
    expect(swapped[0].drill.id).toBe("a");
    expect(swapped[0].swappedFor).toBeUndefined();
  });

  it("addresses plan.blocks rather than the render order", () => {
    // A block whose drill is gone gets dropped from the render, so the second
    // block on screen can be the third in the plan. Swapping on render order
    // would stand a drill in for the wrong block.
    const catalogue = [drill("a"), drill("c"), drill("stand-in")];
    const session = plan({
      blocks: [
        { drillId: "a", minutes: 10 },
        { drillId: "gone", minutes: 10 },
        { drillId: "c", minutes: 10 },
      ],
    });
    const resolved = planDrills(session, catalogue);
    expect(resolved.map((r) => r.index)).toEqual([0, 2]);

    const swapped = applySwaps(resolved, { 2: "stand-in" }, catalogue, "u10");
    expect(swapped[1].drill.id).toBe("stand-in");
    expect(swapped[0].drill.id).toBe("a");
  });
});
