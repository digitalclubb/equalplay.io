import {
  ageAtLeast,
  isAvailableAt,
  mergeKit,
  sumKit,
  THEMES,
  THEME_MIN_AGE,
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
  /**
   * Drills running beside this one at the same time, each on its own patch of
   * grass with its own coach. The block is then a carousel: the squad splits
   * into one group per station, every group does `minutes` at a station, then
   * they all rotate. Nobody sits out and nobody queues.
   *
   * This is the Sunday shape. Twenty children and four parents helping is four
   * groups of five, not twenty children in a line waiting for a turn.
   *
   * The block's own `drillId` is the first station, so a plan saved before this
   * existed still loads and still reads correctly. `minutes` stays what it
   * always was, the time a group spends at one station, which is the number a
   * coach actually decides. The block's total is derived from it by
   * `blockMinutes`, because every group has to visit every station.
   */
  alongside?: string[];
}

/** Every drill id in a block, its own first. One station each, in order. */
export function stationIds(block: PlanBlock): string[] {
  return [block.drillId, ...(block.alongside ?? [])];
}

/** True when a block is stations running at once rather than one drill for everybody. */
export function isCarousel(block: PlanBlock): boolean {
  return (block.alongside?.length ?? 0) > 0;
}

/**
 * What a block costs the evening.
 *
 * A carousel runs its minutes once per station, because a group that has not
 * been to every station has not done the block. Four stations of eight minutes
 * is thirty-two minutes of pitch time, not eight. Counting it as eight is how a
 * session that looks like an hour turns out to be two.
 *
 * A station that no longer exists still counts. It is an error the coach has to
 * clear either way. A total that shrinks when a drill is renamed is a total
 * nobody can reconcile against the stations in front of them.
 */
export function blockMinutes(block: PlanBlock): number {
  return Math.max(0, block.minutes) * stationIds(block).length;
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
    const ids = stationIds(block);
    const stations = ids.map((id) => byId.get(id));
    ids.forEach((id, at) => {
      if (!stations[at]) missingDrillIds.push(id);
    });

    const present = stations.filter((drill): drill is Drill => Boolean(drill));
    if (present.length === 0) continue;

    // Per station. Every group spends this long at each one, so the block's own
    // total multiplies it out while the split by kind counts each station once.
    const minutes = Math.max(0, block.minutes);
    plannedMinutes += blockMinutes(block);
    for (const drill of present) byKind[drill.kind] += minutes;

    const pause = Math.max(0, block.breakAfter ?? 0);
    breakMinutes += pause;
    plannedMinutes += pause;

    // Every station, not only the first. A carousel is the one place a drill
    // can reach a grade without passing the catalogue, so the gate is checked
    // per station rather than per block.
    for (const drill of present) {
      if (!isAvailableAt(drill, plan.ageGroup)) illegal.push(drill);
    }

    // Each station's own list is collapsed first, then the stations are added
    // up, because they are on the grass at the same time. A drill naming cones
    // twice still wants the larger of the two rather than both. What comes out
    // goes to the cross-block merge, which still takes the largest.
    const blockKit = sumKit(present.flatMap((drill) => mergeKit(drill.equipment)));
    const seenHere = new Set<string>();
    for (const entry of blockKit) {
      kit.push(entry);
      if (seenHere.has(entry.item)) continue;
      seenHere.add(entry.item);
      const use = kitUse.get(entry.item) ?? { blocks: 0, minutes: 0 };
      kitUse.set(entry.item, { blocks: use.blocks + 1, minutes: use.minutes + blockMinutes(block) });
    }
  }

  const warnings: PlanWarning[] = [];

  // The age gate first and loudest. It is the only thing here that is a safety
  // matter rather than a scheduling one. Said once per drill: the same drill at
  // two stations, or in two blocks, is one thing to take out rather than two.
  for (const drill of new Map(illegal.map((drill) => [drill.id, drill])).values()) {
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

  const half = plan.blocks.reduce((sum, block) => sum + blockMinutes(block), 0) / 2;
  let run = 0;
  const crosses = plan.blocks.findIndex((block) => (run += blockMinutes(block)) >= half);
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
  /**
   * The block's own drill, which is the first station of a carousel.
   *
   * Kept beside `stations` so anything showing a block one drill at a time
   * still has one to show. A carousel that has not been taught about renders as
   * its first station rather than as nothing.
   */
  drill: Drill;
  /**
   * Every station in the block, the lead first. One entry for a plain block.
   *
   * Stations pointing at a drill that no longer exists are dropped, the same as
   * the block itself would be, so this can be shorter than `stationIds(block)`.
   */
  stations: Drill[];
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
    const stations = stationIds(block)
      .map((id) => byId.get(id))
      .filter((drill): drill is Drill => Boolean(drill));
    // A carousel whose first station has gone still has stations to run, so the
    // lead falls back to the first one that resolved rather than dropping the
    // whole block and taking three good drills with it.
    if (stations.length > 0) resolved.push({ block, drill: stations[0], stations, index });
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

// ---- Coverage ----
//
// What a coach has been avoiding. A volunteer runs the session they are
// comfortable with, which for most is handling. They arrive at a festival in
// November having never worked on what to do when somebody runs at you. Nothing
// in the app could see that until it started recording what actually ran.

export interface ThemeCoverage {
  theme: Theme;
  /** Nights covering it inside the window. */
  runs: number;
  /** ISO date of the last one, or null if it has never been run. */
  last: string | null;
  /** Whole weeks since the last one. Null when it has never been run. */
  weeksAgo: number | null;
}

/**
 * How much of each theme has been coached lately, worst first.
 *
 * Only themes the grade is allowed to do. Telling a U8 coach they have neglected
 * rucking would be telling them to break Regulation 15, which is the opposite of
 * what this app is for.
 *
 * Never run sorts above run-a-while-ago, which sorts above run-recently. A tie
 * goes to the theme with fewer nights, then alphabetically so the order is
 * stable between renders rather than jumping about as dates tick over.
 */
export function themeCoverage(
  runs: Array<{ themes: Theme[]; ranOn: string }>,
  ageGroup: AgeGroup,
  todayIso: string,
): ThemeCoverage[] {
  const allowed = THEMES.filter((theme) => ageAtLeast(ageGroup, THEME_MIN_AGE[theme]));

  return allowed
    .map((theme) => {
      const hits = runs.filter((run) => run.themes.includes(theme));
      const last = hits.reduce<string | null>(
        (latest, run) => (latest === null || run.ranOn > latest ? run.ranOn : latest),
        null,
      );
      return { theme, runs: hits.length, last, weeksAgo: weeksBetween(last, todayIso) };
    })
    .sort(
      (a, b) =>
        (b.weeksAgo ?? Number.MAX_SAFE_INTEGER) - (a.weeksAgo ?? Number.MAX_SAFE_INTEGER) ||
        a.runs - b.runs ||
        a.theme.localeCompare(b.theme),
    );
}

/**
 * Whole weeks between two ISO dates, floored, never negative.
 *
 * Dates rather than timestamps, because a training night is a day. A row dated
 * in the future is a clock somebody set wrong. Reading it as "minus two weeks"
 * would sort it above a theme genuinely never coached.
 */
function weeksBetween(from: string | null, to: string): number | null {
  if (from === null) return null;
  const days = (Date.parse(to) - Date.parse(from)) / 86_400_000;
  if (!Number.isFinite(days)) return null;
  return Math.max(0, Math.floor(days / 7));
}
