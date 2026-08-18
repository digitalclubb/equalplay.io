import {
  isAvailableAt,
  mergeKit,
  type AgeGroup,
  type Drill,
  type KitItem,
  type Theme,
} from "../hub/content/types.js";

/**
 * A training session a coach has assembled. Blocks reference drill ids from the
 * bundled catalogue, not database rows, so a plan is just a list of ids and
 * durations, which is also why it persists as a single jsonb column.
 */
export interface PlanBlock {
  drillId: string;
  /** Defaults to the drill's suggested duration, but a coach can stretch or cut it. */
  minutes: number;
  /**
   * Minutes of water break straight after this block. Counts towards the session
   * length, because it happens on the pitch time you booked.
   *
   * Attached to the block rather than being a block of its own so `blocks` stays a
   * plain list of drills. It also means plans saved before breaks still load.
   */
  breakAfter?: number;
}

export interface SessionPlan {
  id: string;
  title: string;
  ageGroup: AgeGroup;
  theme?: Theme;
  sessionMinutes: number;
  blocks: PlanBlock[];
}

/**
 * `error` means the plan is wrong and the coach must act. A drill their age
 * grade is not allowed to do. `warn` is advice they can reasonably ignore.
 */
export type WarningLevel = "error" | "warn";

export interface PlanWarning {
  level: WarningLevel;
  message: string;
}

export interface PlanTotals {
  plannedMinutes: number;
  /** Negative when the plan overruns the session. */
  remainingMinutes: number;
  byKind: { warmup: number; exercise: number };
  /** Water break minutes, counted inside plannedMinutes. */
  breakMinutes: number;
  /** One requirement per item across the whole plan. What goes in the bag. */
  equipment: KitItem[];
  /** Item names carried for a single short block. Shown quietly, not as a warning. */
  singleUseEquipment: string[];
  /** Block drill ids with no matching drill, e.g. a plan saved before a rename. */
  missingDrillIds: string[];
  warnings: PlanWarning[];
}

/** A block sitting well under the session length is worth mentioning, a minute is not. */
const SLACK_TOLERANCE_MINUTES = 10;
/** Below this a session is short enough to run straight through. */
const BREAK_EXPECTED_FROM_MINUTES = 40;
/** Kit is only "barely worth carrying" if the block using it is short. */
const SHORT_BLOCK_MINUTES = 10;

export function planTotals(plan: SessionPlan, catalogue: Drill[]): PlanTotals {
  const byId = new Map(catalogue.map((drill) => [drill.id, drill]));

  let plannedMinutes = 0;
  let breakMinutes = 0;
  const byKind = { warmup: 0, exercise: 0 };
  const missingDrillIds: string[] = [];
  const illegal: Drill[] = [];
  // Insertion-ordered so the kit list reads in the order the coach built the plan
  const kit: KitItem[] = [];
  const kitUse = new Map<string, { blocks: number; minutes: number }>();

  for (const block of plan.blocks) {
    const drill = byId.get(block.drillId);
    if (!drill) {
      missingDrillIds.push(block.drillId);
      continue;
    }

    const minutes = Math.max(0, block.minutes);
    plannedMinutes += minutes;
    byKind[drill.kind] += minutes;

    const pause = Math.max(0, block.breakAfter ?? 0);
    breakMinutes += pause;
    plannedMinutes += pause;

    if (!isAvailableAt(drill, plan.ageGroup)) illegal.push(drill);

    const seenHere = new Set<string>();
    for (const entry of drill.equipment) {
      kit.push(entry);
      if (seenHere.has(entry.item)) continue;
      seenHere.add(entry.item);
      const use = kitUse.get(entry.item) ?? { blocks: 0, minutes: 0 };
      kitUse.set(entry.item, { blocks: use.blocks + 1, minutes: use.minutes + minutes });
    }
  }

  const warnings: PlanWarning[] = [];

  // The age gate first and loudest. It is the only thing here that is a safety
  // matter rather than a scheduling one.
  for (const drill of illegal) {
    warnings.push({
      level: "error",
      message: `${drill.title} is not for ${plan.ageGroup.toUpperCase()}. Take it out.`,
    });
  }

  if (missingDrillIds.length > 0) {
    warnings.push({
      level: "error",
      message:
        missingDrillIds.length === 1
          ? "One drill in here no longer exists. Take it out."
          : `${missingDrillIds.length} drills in here no longer exist. Take them out.`,
    });
  }

  const remainingMinutes = plan.sessionMinutes - plannedMinutes;

  if (remainingMinutes < 0) {
    warnings.push({
      level: "warn",
      message: `${-remainingMinutes} minutes over your ${plan.sessionMinutes}.`,
    });
  } else if (remainingMinutes > SLACK_TOLERANCE_MINUTES) {
    warnings.push({
      level: "warn",
      message: `${remainingMinutes} minutes still to fill.`,
    });
  }

  if (plan.blocks.length > 0 && byKind.warmup === 0) {
    warnings.push({
      level: "warn",
      message: "No warm-up. Children going into contact cold get hurt more.",
    });
  }

  if (
    plan.blocks.length > 1 &&
    breakMinutes === 0 &&
    plan.sessionMinutes >= BREAK_EXPECTED_FROM_MINUTES
  ) {
    warnings.push({
      level: "warn",
      message: `No water breaks in ${plan.sessionMinutes} minutes. Add one after a block.`,
    });
  }

  const singleUseEquipment = [...kitUse]
    .filter(([, use]) => use.blocks === 1 && use.minutes <= SHORT_BLOCK_MINUTES)
    .map(([item]) => item);

  return {
    plannedMinutes,
    remainingMinutes,
    byKind,
    breakMinutes,
    equipment: mergeKit(kit),
    singleUseEquipment,
    missingDrillIds,
    warnings,
  };
}

/**
 * Drops a water break into a plan that has not got one, three minutes after the
 * block that crosses halfway. Used when a preset becomes a real session: the
 * planner asks for a break in anything this long, so a ready-made session should
 * arrive with one rather than opening on a warning the coach did not cause.
 */
export function withWaterBreak(plan: SessionPlan, minutes = 3): SessionPlan {
  if (plan.sessionMinutes < BREAK_EXPECTED_FROM_MINUTES) return plan;
  if (plan.blocks.length < 2 || plan.blocks.some((block) => block.breakAfter)) return plan;

  const half = plan.blocks.reduce((sum, block) => sum + block.minutes, 0) / 2;
  let run = 0;
  const crosses = plan.blocks.findIndex((block) => (run += block.minutes) >= half);
  // Never after the last block. A break at the end is just going home.
  const at = Math.min(crosses, plan.blocks.length - 2);

  return {
    ...plan,
    blocks: plan.blocks.map((block, i) => (i === at ? { ...block, breakAfter: minutes } : block)),
  };
}

/** Blocks a coach can act on before they run the session. */
export function hasBlockingProblem(totals: PlanTotals): boolean {
  return totals.warnings.some((w) => w.level === "error");
}

export interface ResolvedBlock {
  block: PlanBlock;
  drill: Drill;
  /**
   * Position in `plan.blocks`, which is not the position in this array.
   *
   * Blocks pointing at a drill that no longer exists are dropped, so anything
   * editing a block has to use this rather than the render index. Getting that
   * wrong means the remove button deletes a different block than the one tapped.
   */
  index: number;
}

/** Resolves a plan's blocks to drills, dropping any that no longer exist. */
export function planDrills(plan: SessionPlan, catalogue: Drill[]): ResolvedBlock[] {
  const byId = new Map(catalogue.map((drill) => [drill.id, drill]));
  const resolved: ResolvedBlock[] = [];
  plan.blocks.forEach((block, index) => {
    const drill = byId.get(block.drillId);
    if (drill) resolved.push({ block, drill, index });
  });
  return resolved;
}

/** Moves a block, returning a new array. `to` is clamped, so callers need no guard. */
export function moveBlock(blocks: PlanBlock[], from: number, to: number): PlanBlock[] {
  if (from < 0 || from >= blocks.length) return blocks;
  const target = Math.min(Math.max(to, 0), blocks.length - 1);
  if (target === from) return blocks;
  const next = [...blocks];
  const [moved] = next.splice(from, 1);
  next.splice(target, 0, moved);
  return next;
}
