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

/** A station that resolved, with its place in the block it belongs to. */
export interface ResolvedStation {
  drill: Drill;
  /** Position in `stationIds(block)`, which is not the position it renders at. */
  at: number;
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
   * Each one carries where it really sits, for the same reason the block
   * carries `index`: anything with a control on it has to address the station
   * a coach tapped rather than the row it was drawn in.
   */
  stations: ResolvedStation[];
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
      .map((id, at) => ({ drill: byId.get(id), at }))
      .filter((station): station is ResolvedStation => Boolean(station.drill));
    // A carousel whose first station has gone still has stations to run, so the
    // lead falls back to the first one that resolved rather than dropping the
    // whole block and taking three good drills with it.
    if (stations.length > 0) {
      resolved.push({ block, drill: stations[0].drill, stations, index });
    }
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

// ---- Another like it ----
//
// A ready-made session is a hand-picked running order, which is most of its
// value and occasionally the one thing wrong with it. A coach who has run
// "Beating a defender" three Tuesdays running wants the same session with a
// different drill in the middle, not a trip to the catalogue to find one.

/**
 * Another drill for this station: same kind, same sort of work, legal at the
 * grade and not already somewhere else in the session.
 *
 * The block keeps its own minutes. A coach set those, or a preset did. The
 * budget is the one thing on the screen that should not move because they
 * fancied a different game.
 *
 * Sharing a theme is what makes the swap safe rather than random. A session's
 * shape survives it: the finisher is a game because every drill sharing
 * `gamesense` is one. A ruck drill can never become a tag game. Tapping again
 * walks the list rather than rolling a dice, so a coach can see what there is
 * and stop where they like.
 *
 * A warm-up is the exception, because a warm-up is a warm-up. Its themes say
 * what it sets up rather than what it is. Three of them are the only one of
 * their theme in the whole catalogue, so the scrum session could not swap its
 * warm-up and nor could the kicking one. Every warm-up is a candidate instead,
 * with the ones sharing the work first, which is the order a coach would try
 * them in anyway.
 *
 * Returns null when there is nothing else, which at a small grade on a thin
 * theme is a real answer rather than an error.
 */
export function anotherLike(
  plan: SessionPlan,
  catalogue: Drill[],
  index: number,
  station = 0,
): Drill | null {
  const block = plan.blocks[index];
  if (!block) return null;
  const currentId = stationIds(block)[station];
  const current = catalogue.find((drill) => drill.id === currentId);
  if (!current) return null;

  const shares = (drill: Drill): boolean =>
    drill.themes.some((theme) => current.themes.includes(theme));
  const inPlan = new Set(plan.blocks.flatMap(stationIds));
  const pool = catalogue
    .filter(
      (drill) =>
        isAvailableAt(drill, plan.ageGroup) &&
        drill.kind === current.kind &&
        (shares(drill) || current.kind === "warmup") &&
        (drill.id === current.id || !inPlan.has(drill.id)),
    )
    // Stable, so the catalogue's own order holds inside each group.
    .sort((a, b) => Number(shares(b)) - Number(shares(a)));
  if (pool.length === 0) return null;

  // The drill on the block is in the pool, so the next one along is the next
  // one a coach has not got. A block their grade may not do is not, which puts
  // `at` at -1 and hands back the first legal drill instead. That is the right
  // answer to swapping the one block the plan is warning about.
  const at = pool.findIndex((drill) => drill.id === current.id);
  const next = pool[(at + 1) % pool.length];
  return next.id === current.id ? null : next;
}

// ---- Fitting the time you have ----
//
// A ready-made session arrives at 45, 60 or 75 minutes, because those are the
// slots a club books. A coach with 50 minutes, or with the hall until half
// past, had to open every block and do the arithmetic themselves.

/**
 * Stretches or trims every block so the session fills the length it claims.
 *
 * Proportional, so the shape of the evening survives: the long conditioned
 * game at the end stays the longest thing in it. Water breaks are left where
 * they are and at the length they were given, because three minutes is three
 * minutes whether the session is 45 or 75.
 *
 * Floored rather than rounded, then the remainder is handed back a minute at a
 * time to whatever will take one. Rounding lands a plan a minute or two over
 * its own length about half the time, which is a warning a coach did not cause
 * and cannot see the reason for. A carousel takes its minute once per station,
 * so a four station block costs four minutes to lengthen and is skipped where
 * only two are going spare.
 *
 * Returns the plan itself when there is nothing to do, so a caller can render
 * the control only where it would change something. That covers the one case
 * this cannot fix as well: blocks so short that holding them at a minute each
 * already overruns, where trimming further would mean a block of nothing.
 */
export function fitToLength(plan: SessionPlan): SessionPlan {
  const breaks = plan.blocks.reduce((sum, block) => sum + Math.max(0, block.breakAfter ?? 0), 0);
  const target = plan.sessionMinutes - breaks;
  const current = plan.blocks.reduce((sum, block) => sum + blockMinutes(block), 0);
  if (target <= 0 || current <= 0) return plan;

  const factor = target / current;
  // A block already at nothing stays there. It is a coach saying they have not
  // decided yet, which is not the same as a block a minute long.
  const minutes = plan.blocks.map((block) =>
    block.minutes <= 0 ? 0 : Math.max(1, Math.floor(block.minutes * factor)),
  );
  const stations = plan.blocks.map((block) => stationIds(block).length);
  const total = (): number => minutes.reduce((sum, mins, at) => sum + mins * stations[at], 0);

  // Every minute that will fit, given back to the blocks in the order they
  // run. A pass that places nothing is the end of it.
  for (let placed = true; placed && total() < target; ) {
    placed = false;
    minutes.forEach((mins, at) => {
      if (mins > 0 && total() + stations[at] <= target) {
        minutes[at] += 1;
        placed = true;
      }
    });
  }

  // Only the floor above can overrun, by holding a block at its last minute.
  // Trimming anything else to pay for it would be this deciding which drill a
  // coach drops, so it hands the plan back untouched and the warning stands.
  if (total() > target) return plan;

  return plan.blocks.every((block, at) => block.minutes === minutes[at])
    ? plan
    : { ...plan, blocks: plan.blocks.map((block, at) => ({ ...block, minutes: minutes[at] })) };
}

// ---- Building one ----
//
// 32 ready-made sessions is four nights for a U7 coach before they start
// repeating themselves. The catalogue behind them holds 120 drills. What the
// presets add to those is an order, which is not a secret: something to do on
// arrival, then the work, then a game where they have to use it. A rule
// rather than a judgement, so it can be written down once instead of typed
// out 32 times.

export interface SessionRecipe {
  ageGroup: AgeGroup;
  /** The work of the night. Left out for a session that takes a bit of everything. */
  theme?: Theme;
  minutes: number;
}

/**
 * A running order built to the same four rules the ready-made sessions follow.
 *
 * It opens with a warm-up, it ends on a game, every drill is legal at the
 * grade and it roughly fills the time before `fitToLength` makes that exact.
 * `sessionPlan.test.ts` holds what comes out to the bar the presets are held
 * to, which is not a single warning on any grade, theme or length.
 *
 * `seed` rotates the lists rather than shuffling them, so the same coach
 * tapping twice gets a different session while nothing here holds a dice. Pass
 * the clock for that. Pass anything fixed to get the same session back.
 *
 * With no theme it takes one drill from each theme the grade may do, in turn,
 * which is the night a coach wants in September before anything has gone
 * wrong yet. A hand-picked preset still beats this. What it beats is a blank
 * session at nine o'clock the night before.
 */
export function buildSession(catalogue: Drill[], recipe: SessionRecipe, seed = 0): PlanBlock[] {
  const legal = catalogue.filter((drill) => isAvailableAt(drill, recipe.ageGroup));
  const used = new Set<string>();

  /**
   * The first drill nobody has had yet, taking each list in turn.
   *
   * Lists rather than one sorted pool, because the seed rotates inside
   * whichever list it is working through. Sorting the theme's own drills to
   * the front of a single pool and then rotating past them was no ordering at
   * all: a U12 scrum session opened on two handling warm-ups while the one
   * scrum warm-up sat there unused.
   */
  const take = (...pools: Drill[][]): Drill | undefined => {
    for (const pool of pools) {
      for (let i = 0; i < pool.length; i += 1) {
        const drill = pool[(seed + i) % pool.length];
        if (used.has(drill.id)) continue;
        used.add(drill.id);
        return drill;
      }
    }
    return undefined;
  };

  /** The theme's own drills, then everything else, as two lists to try in order. */
  const nearest = (drills: Drill[]): Drill[][] => {
    const theme = recipe.theme;
    if (!theme) return [drills];
    return [
      drills.filter((drill) => drill.themes.includes(theme)),
      drills.filter((drill) => !drill.themes.includes(theme)),
    ];
  };

  const exercises = legal.filter((drill) => drill.kind === "exercise");
  // Two of them at a full length session, which is what every preset does: one
  // to get them moving and one that sets up the work. One at a short session,
  // where a second is a quarter of the evening.
  const warmups = nearest(legal.filter((drill) => drill.kind === "warmup"));
  const opening = [take(...warmups)];
  if (recipe.minutes >= BREAK_EXPECTED_FROM_MINUTES) opening.push(take(...warmups));

  // Picked before the work, so the best game on the theme finishes the night
  // rather than turning up in the middle of it.
  const finish = take(...nearest(exercises.filter((drill) => drill.themes.includes("gamesense"))));

  const blocks = [...opening, finish].filter((drill): drill is Drill => Boolean(drill));
  let spent = blocks.reduce((sum, drill) => sum + drill.minutes, 0);
  if (recipe.minutes >= BREAK_EXPECTED_FROM_MINUTES) spent += 3;

  const work: Drill[] = [];
  for (const pool of workPools(exercises, recipe)) {
    const drill = take(pool);
    if (!drill) continue;
    if (spent + drill.minutes > recipe.minutes) break;
    spent += drill.minutes;
    work.push(drill);
  }

  return [...opening, ...work, finish]
    .filter((drill): drill is Drill => Boolean(drill))
    .map((drill) => ({ drillId: drill.id, minutes: drill.minutes }));
}

/**
 * Where each drill in the middle of the session comes from, in order.
 *
 * One pool per pick rather than one pool picked from repeatedly, because a
 * session with no theme wants a different theme each time round. `take` keeps
 * its own record of what it has handed out, so the same pool offered twice
 * gives two different drills.
 *
 * Six goes at it is more than any session length here can spend. The loop
 * stops the moment one will not fit.
 */
function workPools(exercises: Drill[], recipe: SessionRecipe): Drill[][] {
  if (recipe.theme) {
    const theme = recipe.theme;
    const pool = exercises.filter((drill) => drill.themes.includes(theme));
    return Array.from({ length: 6 }, () => pool);
  }

  const spread = THEMES.filter((theme) => ageAtLeast(recipe.ageGroup, THEME_MIN_AGE[theme])).map(
    (theme) => exercises.filter((drill) => drill.themes.includes(theme)),
  );
  return [...spread, ...spread];
}
