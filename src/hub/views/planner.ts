import { esc } from "../../lib/esc.js";
import { ageRulesLink } from "../../lib/rulesLink.js";
import { showToast } from "../../components/toast.js";
import { currentRoute, go, stillOn } from "../router.js";
import { DRILLS, filterDrills, findDrill, isAvailableAt } from "../content/drills.js";
import { renderDiagram } from "../content/diagram.js";
import { PRESETS, presetsForAge } from "../content/presets.js";
import {
  AGE_GROUP_LABELS,
  THEMES,
  THEME_LABELS,
  RULES_OF_PLAY,
  THEME_MIN_AGE,
  THEME_SHORT,
  ageAtLeast,
  kitLabel,
  type AgeGroup,
  type Drill,
  type DrillKind,
  type Preset,
  type Theme,
} from "../content/types.js";
import { localFavourites } from "../favourites.js";
import {
  deletePlan,
  fetchSharedPlan,
  localPlans,
  newPlanId,
  pendingCount,
  savePlan,
  stagePlan,
  startSharing,
  stopSharing,
  syncPlans,
  type StoredPlan,
} from "../plans.js";
import {
  moveBlock,
  planDrills,
  planTotals,
  withWaterBreak,
  type PlanBlock,
  type PlanTotals,
  type SessionPlan,
} from "../../logic/sessionPlan.js";

/**
 * Same shape as the nav's icons, meaning a 24 viewBox drawn in strokes on
 * `currentColor`, so an icon and the label beside it change colour together.
 * Three actions stacked in one panel, all wearing the same outline, had to be
 * read one at a time to be told apart.
 */
const ICON = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';

/** A printer, paper coming out of the top. */
const iconPrint = `<svg ${ICON}><path d="M7 9V3.5h10V9"/><path d="M7 18H5.5A1.5 1.5 0 0 1 4 16.5V11a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5.5a1.5 1.5 0 0 1-1.5 1.5H17"/><rect x="7" y="14.5" width="10" height="6" rx="1"/></svg>`;

/** Two sheets, one behind the other. */
const iconDuplicate = `<svg ${ICON}><rect x="8.5" y="8.5" width="12" height="12" rx="2"/><path d="M15.5 5.5A2 2 0 0 0 13.5 3.5h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2"/></svg>`;

/** A bin. The one irreversible thing on the page. */
const iconDelete = `<svg ${ICON}><path d="M4.5 6.5h15"/><path d="M9.5 6.5V4.8a1.3 1.3 0 0 1 1.3-1.3h2.4a1.3 1.3 0 0 1 1.3 1.3v1.7"/><path d="M6.5 6.5l.9 12.2a1.8 1.8 0 0 0 1.8 1.8h5.6a1.8 1.8 0 0 0 1.8-1.8l.9-12.2"/></svg>`;

const KINDS: Array<{ value: DrillKind | ""; label: string }> = [
  { value: "", label: "All" },
  { value: "warmup", label: "Warm-ups" },
  { value: "exercise", label: "Exercises" },
];

export interface PlannerContext {
  userId: string;
  ageGroup: AgeGroup;
}

/** The plan being edited. Held here so a re-render is not a reload. */
let editing: SessionPlan | null = null;
let addSearch = "";
let addTheme: Theme | undefined;
let addKind: DrillKind | undefined;
let addFavouritesOnly = false;
/** The pitch is frozen and you are in the hall. Same filter the catalogue has. */
let addSmallSpace = false;
/** The pitch is baked or frozen and nobody is going to ground on it. */
let addHardGround = false;
/** Which drill in the add list is expanded for a look before committing to it. */
let previewing: string | null = null;
let starred: Set<string> = new Set();
/**
 * Which safety notes the coach has opened. The editor redraws on every keystroke,
 * and a <details> element loses its open state when its markup is replaced.
 */
let openSafety: Set<string> = new Set();
/**
 * Whether the current edit has reached the server.
 *
 * The editor saves as you type, which is right but invisible. Invisible saving
 * makes people hunt for a button, so it says so instead.
 */
let saveState: "saved" | "saving" | "local" = "saved";

function kindPill(drill: Drill): string {
  return `<span class="kind-dot${drill.kind === "warmup" ? " kind-dot-warmup" : ""}">${
    drill.kind === "warmup" ? "Warm-up" : "Exercise"
  }</span>`;
}

function playersLabel(drill: Drill): string {
  return drill.players.max
    ? `${drill.players.min} to ${drill.players.max} players`
    : `${drill.players.min}+ players`;
}

/** Outline when off, filled when on. Matches the catalogue. */
function starIcon(filled: boolean): string {
  return filled
    ? `<svg class="star" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.4L12 17.4l-5.8 3 1.1-6.4L2.6 9.4l6.5-.9z"/></svg>`
    : `<svg class="star" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.7-5.2-2.7-5.2 2.7 1-5.7L3.6 9.7l5.8-.8z"/></svg>`;
}
/** The tick a chip that stacks with the others wears. Matches the catalogue. */
function tickIcon(on: boolean): string {
  return on
    ? `<svg class="chip-tick" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12.5l5 5 10-11"/></svg>`
    : "";
}

let pushTimer: ReturnType<typeof setTimeout> | undefined;
/** Same reason as the catalogue's. The add panel redraws the editor around it. */
let addSearchTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * How long a search box waits before rebuilding its list.
 *
 * Shared so the two searches in the hub feel like one control. Lives here
 * rather than in the catalogue because the catalogue already imports this
 * module. The other way round would be a cycle.
 */
export const SEARCH_DEBOUNCE_MS = 140;

// ---- List ----

export function renderPlanList(container: HTMLElement, ctx: PlannerContext): void {
  const draw = (plans: StoredPlan[], state: "loading" | "synced" | "offline"): void => {
    const presets = presetsForAge(ctx.ageGroup);
    const age = AGE_GROUP_LABELS[ctx.ageGroup];

    container.innerHTML = `
      <section class="hub-panel">
        <h2>Ready-made sessions</h2>
        <p class="hub-lede">
          A ready-made ${esc(age)} session. Run it as it comes or change whatever you like.
        </p>
        ${
          presets.length === 0
            ? `<p class="hub-fineprint">No ready-made ${esc(age)} sessions yet. Build one below.</p>`
            : `<div class="preset-grid">${presets.map(presetCard).join("")}</div>`
        }
        <button type="button" class="hub-btn" id="new-blank">Build one from scratch</button>
      </section>

      <section class="hub-panel">
        <h2>Your sessions</h2>
        ${syncNotice(state, pendingCount(ctx.userId))}
        ${
          plans.length === 0
            ? `<p class="hub-fineprint">${state === "loading" ? "Fetching your sessions…" : "Nothing saved yet."}</p>`
            : `<div class="drill-list">${plans.map((plan) => planRow(plan)).join("")}</div>`
        }
      </section>`;

    container.querySelector("#new-blank")?.addEventListener("click", () => {
      create(ctx, blankPlan(ctx.ageGroup));
    });

    for (const button of container.querySelectorAll<HTMLButtonElement>("[data-preset]")) {
      button.addEventListener("click", () => {
        const preset = PRESETS.find((p) => p.id === button.dataset.preset);
        if (preset) create(ctx, fromPreset(preset));
      });
    }
  };

  // Paint from the local mirror first so an offline coach sees their plans at once
  draw(localPlans(ctx.userId), "loading");
  void syncPlans(ctx.userId).then((result) => {
    // The coach may have opened a session while this was in flight
    if (!stillOn("plans")) return;
    draw(result.plans, result.reachedServer ? "synced" : "offline");
  });
}

/**
 * Says out loud when what you are looking at came off this device rather than the
 * server. Silence here would let a coach assume an edit had been saved properly.
 */
function syncNotice(state: "loading" | "synced" | "offline", pending: number): string {
  if (state === "offline") {
    return `<p class="sync-notice sync-notice-offline" role="status">
      Showing what's saved on this phone. We couldn't reach the server${
        pending > 0
          ? `, so ${pending === 1 ? "one edit is" : `${pending} edits are`} still waiting to go up`
          : ""
      }.
    </p>`;
  }
  if (pending > 0) {
    return `<p class="sync-notice" role="status">
      ${pending === 1 ? "One edit is" : `${pending} edits are`} saved here but not on the
      server yet. They will go up on their own.
    </p>`;
  }
  return "";
}

function presetCard(preset: Preset): string {
  const drills = preset.drillIds.map(findDrill).filter(Boolean) as Drill[];
  // The session length rather than the drill total. `fromPreset` adds a water
  // break, so the drills alone read three minutes short of the plan the coach
  // ends up with. This is the number they check their pitch slot against.
  return `
    <button type="button" class="preset-card" data-preset="${esc(preset.id)}">
      <span class="preset-title">${esc(preset.title)}</span>
      <span class="preset-meta">
        ${AGE_GROUP_LABELS[preset.ageGroup]} · ${esc(THEME_LABELS[preset.theme])} ·
        ${drills.length} drills · ${preset.sessionMinutes} min
      </span>
    </button>`;
}

function planRow(plan: StoredPlan): string {
  const totals = planTotals(plan, DRILLS);
  const problems = totals.warnings.filter((w) => w.level === "error").length;
  return `
    <a class="drill-card" href="#/plan/${esc(plan.id)}">
      <span class="drill-card-head">
        <span class="drill-card-title">${esc(plan.title)}</span>
        ${problems > 0 ? '<span class="drill-kind plan-flag">Check</span>' : ""}
      </span>
      <span class="drill-meta">
        ${AGE_GROUP_LABELS[plan.ageGroup]} · ${plan.blocks.length} blocks ·
        ${totals.plannedMinutes} of ${plan.sessionMinutes} min
      </span>
    </a>`;
}

function blankPlan(ageGroup: AgeGroup): SessionPlan {
  return {
    id: newPlanId(),
    title: "New session",
    ageGroup,
    sessionMinutes: 60,
    blocks: [],
  };
}

function fromPreset(preset: Preset): SessionPlan {
  return withWaterBreak({
    id: newPlanId(),
    title: preset.title,
    ageGroup: preset.ageGroup,
    theme: preset.theme,
    sessionMinutes: preset.sessionMinutes,
    blocks: preset.drillIds.flatMap((drillId) => {
      const drill = findDrill(drillId);
      return drill ? [{ drillId, minutes: drill.minutes }] : [];
    }),
  });
}

/**
 * Append a drill to a session from outside the editor.
 *
 * The editor holds whatever it is working on in `editing`, so a block added
 * anywhere else has to reach that copy too. Without it the next keystroke in the
 * editor stages the plan from before the add and the block quietly disappears.
 *
 * Returns the session's title for the confirmation, or null when the id no
 * longer resolves.
 */
export function addDrillToPlan(userId: string, planId: string, drill: Drill): string | null {
  const found = localPlans(userId).find((plan) => plan.id === planId);
  if (!found) return null;
  // Checked here as well as in the picker that draws the list. This is the one
  // door every route into a plan goes through. A gate that only exists in a
  // render is a gate one new caller away from not existing.
  if (!isAvailableAt(drill, found.ageGroup)) return null;
  const next: SessionPlan = {
    ...stripMeta(found),
    blocks: [...found.blocks, { drillId: drill.id, minutes: drill.minutes }],
  };
  // `savePlan` stages before its first await, so the local write has already
  // happened by the time this returns. A coach with no signal keeps the block.
  if (editing?.id === planId) editing = next;
  void savePlan(userId, next);
  return next.title;
}

/** A session that starts life with one drill in it. Lands in the editor. */
export function newPlanWithDrill(userId: string, ageGroup: AgeGroup, drill: Drill): void {
  create(
    { userId, ageGroup },
    { ...blankPlan(ageGroup), blocks: [{ drillId: drill.id, minutes: drill.minutes }] },
  );
}

function create(ctx: PlannerContext, plan: SessionPlan): void {
  // Staged synchronously so the plan exists before the route changes, even offline
  stagePlan(ctx.userId, plan);
  editing = plan;
  void savePlan(ctx.userId, plan);
  go(`plan/${plan.id}/edit`);
}

// ---- View ----

/**
 * What a coach reads at the pitch. No steppers, no add panel, no delete.
 *
 * This is the default when a session is opened, because reading it on a wet
 * Tuesday is the common case and editing it at the kitchen table is the rare one.
 * Coaching points are on the page rather than one tap away, which is the whole
 * reason a coach would look at their phone mid-session.
 */
export function renderPlanView(
  container: HTMLElement,
  ctx: PlannerContext,
  planId: string,
): void {
  const found = localPlans(ctx.userId).find((p) => p.id === planId);
  if (!found) {
    container.innerHTML = `<div class="plan-read"><section class="hub-panel"><p class="hub-fineprint">Loading…</p></section></div>`;
    void syncPlans(ctx.userId).then(({ plans }) => {
      if (!stillOn("plan", planId)) return;
      if (plans.some((p) => p.id === planId)) renderPlanView(container, ctx, planId);
      else {
        showToast("Can't find that session.");
        go("plans");
      }
    });
    return;
  }

  const plan = stripMeta(found);
  const totals = planTotals(plan, DRILLS);
  const blocks = planDrills(plan, DRILLS);

  // One column, capped and centred as a whole. Capping the blocks and leaving
  // the panels under them full width put Share it and Print it 128px outside
  // the session on both sides at 1280.
  container.innerHTML = `
    <div class="plan-read">
    <p class="hub-back"><a href="#/plans">← All sessions</a></p>

    <section class="hub-panel run-head">
      <div class="run-head-top">
        <h2>${esc(plan.title)}</h2>
        <div class="run-head-actions">
          ${
            blocks.length > 0
              ? `<a class="hub-btn hub-btn-primary" href="#/plan/${esc(plan.id)}/run/0">Run it</a>`
              : ""
          }
          <a class="hub-btn hub-btn-edit" href="#/plan/${esc(plan.id)}/edit">Edit</a>
        </div>
      </div>
      <p class="run-meta">
        ${AGE_GROUP_LABELS[plan.ageGroup]} · ${totals.plannedMinutes} min${
          totals.breakMinutes > 0 ? ` including ${totals.breakMinutes} of breaks` : ""
        } · ${blocks.length} ${blocks.length === 1 ? "block" : "blocks"}
      </p>
      ${
        totals.equipment.length > 0
          ? `<p class="run-kit"><strong>Pack</strong> ${esc(totals.equipment.map(kitLabel).join(", "))}</p>`
          : ""
      }
      <p class="hub-fineprint">${ageRulesLink(
        AGE_GROUP_LABELS[plan.ageGroup],
        RULES_OF_PLAY[plan.ageGroup],
      )}</p>
      ${warningList(totals)}
    </section>

    ${
      blocks.length === 0
        ? `<section class="hub-panel hub-empty">
             <p>Nothing in this session yet.</p>
             <a class="hub-btn" href="#/plan/${esc(plan.id)}/edit">Add some drills</a>
           </section>`
        : blocks.map(({ block, drill }, position) => runBlock(block, drill, position, plan.id)).join("")
    }

    ${sharePanel(found)}

    <section class="hub-panel">
      <button type="button" class="hub-btn" id="plan-print">${iconPrint}Print it</button>
    </section>
    </div>`;

  container.querySelector("#plan-print")?.addEventListener("click", () => window.print());
  wireShare(container, ctx, planId);
  for (const details of container.querySelectorAll<HTMLDetailsElement>("[data-safety]")) {
    details.addEventListener("toggle", () => {
      const id = details.dataset.safety ?? "";
      if (details.open) openSafety.add(id);
      else openSafety.delete(id);
    });
  }

  renderPrintable(plan, blocks, totals);
}

// ---- Present mode ----

/**
 * One block at a time, at arm's length, with the clock running.
 *
 * The reading view is the whole session on one page, which is what a coach
 * checks in the car park. This is what they hold while it is happening: the
 * coaching points at a size you can read from six feet away with a whistle in
 * your mouth. The minutes count down as well, so a block that was meant to take
 * ten does not quietly take twenty.
 *
 * The block is in the URL rather than in memory, so a phone that locks and
 * comes back lands on the drill you were actually running.
 */
interface RunClock {
  /** Epoch ms the block is due to end. Kept as a deadline rather than a count,
   * so a throttled background tab comes back with the right number instead of
   * however many ticks the browser felt like delivering. */
  endsAt: number;
  /** Epoch ms it was paused at, or null while it is running. */
  pausedAt: number | null;
  /**
   * What the block was when this clock started.
   *
   * An index alone is not the same block from one visit to the next. Stretch a
   * block from ten minutes to fifteen or reorder the session, then index 0 is a
   * different thing. Reusing the old deadline would start the coach off already
   * overrun on a block they have not run yet.
   */
  drillId: string;
  minutes: number;
}

/**
 * One clock per block, kept for as long as present mode is on this session.
 *
 * Keyed rather than replaced because Next is a big primary button on a wet
 * screen. Tapping it by mistake and coming back used to hand the block a full
 * fresh ten minutes when eight of them had gone.
 */
const runClocks = new Map<number, RunClock>();
let runPlanId = "";
let runClock: RunClock | null = null;
let runTimer: ReturnType<typeof setInterval> | undefined;

interface ScreenLock {
  release: () => Promise<void>;
  addEventListener: (type: "release", listener: () => void) => void;
}

let screenLock: ScreenLock | null = null;
/** A request already on its way. Two in flight orphans the first sentinel. */
let lockPending = false;
/**
 * Bumped every time present mode is left. A wake lock request that was still in
 * flight then resolves into a session nobody is running, so it checks this
 * before keeping what it was given.
 */
let lockGeneration = 0;

/** Milliseconds left. Negative once the block has overrun, which is the point. */
function runRemaining(clock: RunClock): number {
  return clock.endsAt - (clock.pausedAt ?? Date.now());
}

function runClockLabel(clock: RunClock): string {
  const left = runRemaining(clock);
  const total = Math.floor(Math.abs(left) / 1000);
  const stamp = `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  return left < 0 ? `${stamp} over` : stamp;
}

/**
 * A pitch is the one place a screen going dark mid-drill is not a small
 * annoyance. Refused, unsupported and released on backgrounding are all normal,
 * so every path here is allowed to fail quietly.
 */
function holdScreenAwake(): void {
  const api = (navigator as Navigator & {
    wakeLock?: { request: (type: "screen") => Promise<ScreenLock> };
  }).wakeLock;
  if (!api || screenLock || lockPending) return;

  lockPending = true;
  const generation = lockGeneration;
  // Only a lock handed over and given straight back is worth asking for again.
  // A refusal must not be, or a phone on battery saver spins rejected requests
  // for the length of the session: `request` is rejected outright there, which
  // is the very case the catch below is written for.
  let abandoned = false;
  void api
    .request("screen")
    .then((lock) => {
      // Present mode was left while this was in flight, so nobody wants it now
      if (generation !== lockGeneration) {
        abandoned = true;
        void lock.release().catch(() => {});
        return;
      }
      screenLock = lock;
      // A browser drops the lock whenever the tab goes to the background. Say so
      // here, or the sentinel looks live forever and the re-acquire below never
      // fires again: the screen would then sleep for the rest of the session.
      lock.addEventListener("release", () => {
        if (screenLock === lock) screenLock = null;
      });
    })
    .catch(() => {
      // A low battery or a browser that will not do it. The clock still runs
    })
    .finally(() => {
      lockPending = false;
      // A request that started, was abandoned on leaving and then came back to a
      // coach who had gone straight back in. It released what it was handed, so
      // without this present mode runs on with no lock and nothing to ask again.
      if (abandoned && runTimer !== undefined && !screenLock) holdScreenAwake();
    });
}

function releaseScreen(): void {
  lockGeneration += 1;
  const held = screenLock;
  screenLock = null;
  void held?.release().catch(() => {});
}

/** Called on leaving present mode as well as on sign-out. Never leaves a phone awake. */
export function stopRunClock(): void {
  clearInterval(runTimer);
  runTimer = undefined;
  runClock = null;
  // The deadlines go with it. `main.ts` only calls this on leaving present mode,
  // so moving between blocks keeps them, which is the whole point of the map.
  // Tapping Done ends the run. Checking the running order in the car park at
  // 6:15 otherwise opened training at 6:30 on "15:00 over" in red, on every
  // block that had been looked at, with Reset the only way out of it.
  runClocks.clear();
  runPlanId = "";
  releaseScreen();
}

/** True while the coach is still on this session's present mode, not just its plan. */
function stillRunning(planId: string): boolean {
  const route = currentRoute();
  return route.name === "plan" && route.param === planId && route.rest[0] === "run";
}

/** Repaints the one thing that changes every second, rather than the whole view. */
function paintClock(container: HTMLElement): void {
  const slot = container.querySelector<HTMLElement>("#run-time");
  if (!slot || !runClock) {
    // The coach has navigated away between ticks
    stopRunClock();
    return;
  }
  slot.textContent = runClockLabel(runClock);
  slot.dataset.over = String(runRemaining(runClock) < 0);
}

function startRunClock(
  container: HTMLElement,
  planId: string,
  index: number,
  drillId: string,
  minutes: number,
): void {
  // A different session gets its own clocks. Otherwise block 3 of last night's
  // plan would be handed to block 3 of this one.
  if (runPlanId !== planId) {
    runClocks.clear();
    runPlanId = planId;
  }
  let clock = runClocks.get(index);
  if (!clock || clock.drillId !== drillId || clock.minutes !== minutes) {
    clock = { endsAt: Date.now() + minutes * 60_000, pausedAt: null, drillId, minutes };
    runClocks.set(index, clock);
  }
  runClock = clock;

  clearInterval(runTimer);
  runTimer = setInterval(() => paintClock(container), 1000);
  holdScreenAwake();
}

export function renderPlanRun(
  container: HTMLElement,
  ctx: PlannerContext,
  planId: string,
  step: number,
): void {
  const found = localPlans(ctx.userId).find((p) => p.id === planId);
  if (!found) {
    container.innerHTML = `<section class="hub-panel"><p class="hub-fineprint">Loading…</p></section>`;
    void syncPlans(ctx.userId).then(({ plans }) => {
      // The sub-route matters here and nowhere else. `stillOn` cannot tell
      // present mode from the reading view, so a slow pull resolving after the
      // coach hit Back would paint the stage over it and restart both the timer
      // and the wake lock that leaving had just switched off.
      if (!stillRunning(planId)) return;
      if (plans.some((p) => p.id === planId)) renderPlanRun(container, ctx, planId, step);
      else {
        showToast("Can't find that session.");
        go("plans");
      }
    });
    return;
  }

  const plan = stripMeta(found);
  const blocks = planDrills(plan, DRILLS);
  if (blocks.length === 0) {
    go(`plan/${planId}`);
    return;
  }

  // Truncated as well as clamped. `run/1.5` otherwise indexes nothing and the
  // destructure below throws, leaving a blank view with no way out of it.
  const index = Math.min(
    Math.max(0, Number.isFinite(step) ? Math.trunc(step) : 0),
    blocks.length - 1,
  );
  // Replaced rather than pushed. A typed or stale block number should correct
  // itself without leaving a step in history that bounces the coach forwards.
  if (index !== step) history.replaceState(null, "", `#/plan/${planId}/run/${index}`);

  const { block, drill } = blocks[index];
  const next = blocks[index + 1];

  // Errors only. This is the view a coach is holding while it happens, so a
  // block their grade is not allowed to run has to say so here as well. It is
  // the last screen that could stop it. "26 minutes still to fill" is advice
  // for the kitchen table and would only be noise on a pitch.
  const totals = planTotals(plan, DRILLS);
  const problems: PlanTotals = {
    ...totals,
    warnings: totals.warnings.filter((w) => w.level === "error"),
  };

  container.innerHTML = `
    <section class="run-stage">
      <div class="run-stage-top">
        <span class="run-stage-count">${index + 1} of ${blocks.length}</span>
        <a class="hub-btn hub-btn-done" href="#/plan/${esc(plan.id)}">Done</a>
      </div>

      ${warningList(problems)}

      <h2 class="run-stage-title">${esc(drill.title)}</h2>
      <p class="run-stage-meta">${block.minutes} min &middot; ${esc(drill.space)} &middot; ${playersLabel(drill)}</p>

      <div class="run-clock">
        <p class="run-clock-time" id="run-time" role="timer" aria-live="off" data-over="false"></p>
        <div class="run-clock-actions">
          <button type="button" class="hub-btn" id="run-pause">Pause</button>
          <button type="button" class="hub-btn" id="run-reset">Reset</button>
        </div>
      </div>

      ${
        drill.safety
          ? `<p class="run-stage-safety"><strong>Safety.</strong> ${esc(drill.safety)}</p>`
          : ""
      }

      <ul class="run-stage-points">${drill.coachingPoints
        .map((point) => `<li>${esc(point)}</li>`)
        .join("")}</ul>

      ${
        block.breakAfter
          ? `<p class="run-stage-then">Water break after this one, ${block.breakAfter} min.</p>`
          : ""
      }

      <nav class="run-stage-steps" aria-label="Through the session">
        ${
          index > 0
            ? `<a class="hub-btn" href="#/plan/${esc(plan.id)}/run/${index - 1}">Back</a>`
            : `<a class="hub-btn" href="#/plan/${esc(plan.id)}">Back</a>`
        }
        ${
          next
            ? `<a class="hub-btn hub-btn-primary run-stage-next" href="#/plan/${esc(plan.id)}/run/${index + 1}">
                 <span class="run-stage-next-label">Next</span>
                 <span class="run-stage-next-drill">${esc(next.drill.title)}</span>
               </a>`
            : `<a class="hub-btn hub-btn-primary" href="#/plan/${esc(plan.id)}">That's the session</a>`
        }
      </nav>
    </section>`;

  startRunClock(container, planId, index, drill.id, block.minutes);

  const pause = container.querySelector<HTMLButtonElement>("#run-pause");

  /**
   * Painted rather than re-rendered. Replacing the view would destroy the button
   * that was just pressed, dropping focus to the body and sending the next Tab
   * back to the top of the page.
   */
  const paintPause = (): void => {
    if (pause) pause.textContent = runClock?.pausedAt === null ? "Pause" : "Start";
    paintClock(container);
  };

  paintPause();

  pause?.addEventListener("click", () => {
    if (!runClock) return;
    if (runClock.pausedAt === null) {
      runClock.pausedAt = Date.now();
    } else {
      // Put the deadline back by however long it sat paused, so the block still
      // gets the minutes it was given
      runClock.endsAt += Date.now() - runClock.pausedAt;
      runClock.pausedAt = null;
    }
    paintPause();
  });

  container.querySelector("#run-reset")?.addEventListener("click", () => {
    runClocks.delete(index);
    startRunClock(container, planId, index, drill.id, block.minutes);
    paintPause();
  });

  // The plan route keeps whatever sheet the last view built. Print hides
  // `#hub-view`, so without this a Ctrl+P from present mode after a reload
  // prints a blank page rather than the session in front of you.
  renderPrintable(plan, blocks, totals);
}

/**
 * A screen lock is dropped whenever the tab goes to the background, so coming
 * back needs a fresh one. Without this the phone stays awake for exactly as
 * long as it takes a coach to put it in their pocket once.
 */
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  if (runTimer !== undefined) holdScreenAwake();
});

// ---- Sharing ----

/** Where the link points, written out so a coach can read it before they send it. */
function shareUrl(token: string): string {
  // `/hub`, not `/hub/`. The service worker precaches the first and matches on
  // the exact URL, so the trailing slash would miss the cache and hand a reader
  // with no signal the browser's own error page.
  return `${window.location.origin}/hub#/shared/${token}`;
}

/**
 * Sharing lives at the foot of the reading view rather than beside Edit.
 *
 * Reading the session is what this page is for. Sharing it is a thing a coach
 * does once, so it sits after the running order instead of competing with it.
 */
const shareNote = '<p class="share-note" id="share-note" role="status"></p>';

function sharePanel(plan: StoredPlan): string {
  if (!plan.shareToken) {
    return `
      <section class="hub-panel plan-share">
        <h3>Share it</h3>
        <p>
          Whoever else takes the age group can read this on their own phone. They
          won't be able to change it and they don't need an account.
        </p>
        <button type="button" class="hub-btn" id="plan-share">Create a link</button>
        ${shareNote}
      </section>`;
  }

  return `
    <section class="hub-panel plan-share">
      <h3>Share it</h3>
      <p class="hub-fineprint">Anyone with this link can read the session as it stands.</p>
      <div class="hub-field">
        <label class="visually-hidden" for="share-url">Link to this session</label>
        <input id="share-url" class="share-url" type="text" readonly value="${esc(shareUrl(plan.shareToken))}" />
      </div>
      ${shareNote}
      <div class="share-actions">
        <button type="button" class="hub-btn hub-btn-primary" id="plan-copy">Copy the link</button>
        <button type="button" class="hub-btn" id="plan-unshare">Stop sharing</button>
      </div>
    </section>`;
}

function wireShare(container: HTMLElement, ctx: PlannerContext, planId: string): void {
  const note = (message: string): void => {
    const target = container.querySelector("#share-note");
    if (target) target.textContent = message;
  };

  container.querySelector("#plan-share")?.addEventListener("click", () => {
    void startSharing(ctx.userId, planId).then((result) => {
      if (!stillOn("plan", planId)) return;
      renderPlanView(container, ctx, planId);
      // Said out loud rather than left to be discovered by the person it was
      // sent to. The token is staged locally, so the link exists before the
      // server has heard about it and will not resolve until it has.
      if (!result.reachedServer) {
        note("Made on this phone. It starts working once you're back in signal.");
      }
    });
  });

  container.querySelector("#plan-copy")?.addEventListener("click", () => {
    const field = container.querySelector<HTMLInputElement>("#share-url");
    if (!field) return;
    field.select();
    // Refused is one thing. Absent is another: there is no clipboard at all
    // outside a secure context, which is how a phone reaches the dev server.
    // The field is selected either way, so there is still something to do.
    const refused = (): void => {
      note("Couldn't copy it. The link is selected, so copy it yourself.");
    };
    if (!navigator.clipboard) {
      refused();
      return;
    }
    void navigator.clipboard
      .writeText(field.value)
      .then(() => showToast("Link copied."))
      .catch(refused);
  });

  container.querySelector("#plan-unshare")?.addEventListener("click", () => {
    void stopSharing(ctx.userId, planId).then((result) => {
      if (!stillOn("plan", planId)) return;
      // Repainted first, so this writes into the panel that is on screen now
      // rather than the one the click came from.
      renderPlanView(container, ctx, planId);
      if (!result.reachedServer) {
        note("Stopped on this phone. The link you sent keeps working until this reaches the server.");
      }
    });
  });
}

/**
 * Somebody else's session, read by token.
 *
 * No account, no age grade of their own, nothing cached. The plan says which
 * grade it was written for and links the RFU's own rules for it, the same as it
 * does for the coach who wrote it.
 */
export function renderSharedPlan(
  container: HTMLElement,
  token: string,
  /** The reader's own grade, when there is one. A stranger with no account has none. */
  readerAge?: AgeGroup,
): void {
  container.innerHTML = `<div class="plan-read"><section class="hub-panel"><p class="hub-fineprint">Fetching the session…</p></section></div>`;

  void fetchSharedPlan(token).then(({ plan, reachedServer }) => {
    if (!stillOn("shared", token)) return;

    if (!plan) {
      container.innerHTML = `
        <div class="plan-read">
        <section class="hub-panel hub-empty">
          <p>${
            reachedServer
              ? "That link doesn't work any more. The coach who sent it may have stopped sharing."
              : "We couldn't reach the server. A session somebody shared with you needs signal the first time you open it."
          }</p>
          <a class="hub-btn" href="#/catalogue">Have a look at the drills</a>
        </section>
        </div>`;
      return;
    }

    const totals = planTotals(plan, DRILLS);
    const blocks = planDrills(plan, DRILLS);
    const tooOld = readerAge && !ageAtLeast(readerAge, plan.ageGroup);
    // Errors only. "26 minutes still to fill" is a nudge for whoever wrote the
    // session. The person reading it cannot act on that anyway.
    const problems: PlanTotals = {
      ...totals,
      warnings: totals.warnings.filter((w) => w.level === "error"),
    };

    container.innerHTML = `
      <div class="plan-read">
      <section class="hub-panel run-head">
        <p class="share-from">A coach shared this session with you</p>
        <h2>${esc(plan.title)}</h2>
        ${
          // The catalogue would never put this in front of them, so the one
          // place a drill can reach a grade that is not allowed to do it says
          // so out loud. Still rendered: the coach who sent it meant to.
          tooOld
            ? `<p class="share-grade" role="alert">
                 Written for ${AGE_GROUP_LABELS[plan.ageGroup]}. You coach
                 ${AGE_GROUP_LABELS[readerAge]}, so some of this is beyond what
                 your grade plays yet.
               </p>`
            : ""
        }
        <p class="run-meta">
          ${AGE_GROUP_LABELS[plan.ageGroup]} · ${totals.plannedMinutes} min${
            totals.breakMinutes > 0 ? ` including ${totals.breakMinutes} of breaks` : ""
          } · ${blocks.length} ${blocks.length === 1 ? "block" : "blocks"}
        </p>
        ${
          totals.equipment.length > 0
            ? `<p class="run-kit"><strong>Pack</strong> ${esc(totals.equipment.map(kitLabel).join(", "))}</p>`
            : ""
        }
        <p class="hub-fineprint">${ageRulesLink(
          AGE_GROUP_LABELS[plan.ageGroup],
          RULES_OF_PLAY[plan.ageGroup],
        )}</p>
        ${warningList(problems)}
      </section>

      ${blocks.map(({ block, drill }, position) => runBlock(block, drill, position)).join("")}

      <section class="hub-panel">
        <h3>Build your own</h3>
        <p>
          Equal Play is free for volunteer coaches. Every drill is matched to the age
          group you coach, so you'll only ever see the ones your players are ready for.
        </p>
        <a class="hub-btn" href="#/catalogue">Have a look at the drills</a>
      </section>
      </div>`;

    for (const details of container.querySelectorAll<HTMLDetailsElement>("[data-safety]")) {
      details.addEventListener("toggle", () => {
        const id = details.dataset.safety ?? "";
        if (details.open) openSafety.add(id);
        else openSafety.delete(id);
      });
    }
  });
}

/**
 * One block, sized to be read at arm's length with a whistle in the other hand.
 *
 * `planId` is absent on a shared session. The link it draws goes into the
 * catalogue and back out through a session the reader does not have, so on a
 * shared page the running order is the whole document.
 */
function runBlock(block: PlanBlock, drill: Drill, index: number, planId?: string): string {
  return `
    <article class="hub-panel run-block">
      <div class="run-block-head">
        <span class="run-number">${index + 1}</span>
        <div class="run-block-titles">
          <h3>${esc(drill.title)} ${kindPill(drill)}</h3>
          <p class="run-block-meta">${block.minutes} min · ${esc(drill.space)} · ${playersLabel(drill)}</p>
        </div>
      </div>

      ${
        drill.safety
          ? `<details class="block-safety-details" data-safety="${esc(drill.id)}"${openSafety.has(drill.id) ? " open" : ""}>
               <summary><span class="block-safety">Safety note</span></summary>
               <p>${esc(drill.safety)}</p>
             </details>`
          : ""
      }

      ${
        // Described rather than decorative. The running order never shows the
        // drill's `setup`, so here the picture is the only place that
        // information appears.
        drill.diagram ? `<div class="run-block-figure">${renderDiagram(drill.diagram)}</div>` : ""
      }

      <ul class="run-points">${drill.coachingPoints.map((point) => `<li>${esc(point)}</li>`).join("")}</ul>
      ${
        planId
          ? `<p class="run-more"><a href="#/catalogue/${esc(drill.id)}/from/${esc(planId)}">How it runs, plus how to change it</a></p>`
          : ""
      }
    </article>
    ${
      block.breakAfter
        ? `<p class="run-break">Water break, ${block.breakAfter} min</p>`
        : ""
    }`;
}

// ---- Editor ----

export function renderPlanEditor(
  container: HTMLElement,
  ctx: PlannerContext,
  planId: string,
): void {
  if (!editing || editing.id !== planId) {
    const found = localPlans(ctx.userId).find((p) => p.id === planId);
    if (!found) {
      // Not local yet. Pull, then come back through the same path
      container.innerHTML = `<section class="hub-panel"><p class="hub-fineprint">Loading…</p></section>`;
      void syncPlans(ctx.userId).then(({ plans }) => {
        if (!stillOn("plan", planId)) return;
        const remote = plans.find((p) => p.id === planId);
        if (!remote) {
          showToast("Can't find that session.");
          go("plans");
          return;
        }
        editing = stripMeta(remote);
        renderPlanEditor(container, ctx, planId);
      });
      return;
    }
    editing = stripMeta(found);
  }

  saveState = pendingCount(ctx.userId) > 0 ? "local" : "saved";
  draw(container, ctx);
}

function stripMeta(plan: StoredPlan): SessionPlan {
  const { updatedAt: _updatedAt, shareToken: _shareToken, ...rest } = plan;
  return rest;
}

function draw(container: HTMLElement, ctx: PlannerContext): void {
  const plan = editing;
  if (!plan) return;
  starred = localFavourites(ctx.userId);

  // The theme chips are the ones this grade is allowed, so a filter carried over
  // from a higher grade has no chip left to switch it off. It is dropped instead
  // of stranding the add panel on an empty list with nothing lit.
  if (addTheme && !ageAtLeast(plan.ageGroup, THEME_MIN_AGE[addTheme])) addTheme = undefined;

  // Replacing innerHTML drops the page back to the top. On a phone the add panel
  // sits a long way down, so every keystroke and every expand threw the coach back
  // up the page. Only held on a redraw: arriving at a session should start at the top.
  const redraw = Boolean(container.querySelector(".plan-layout"));
  const pageScroll = window.scrollY;
  const listScroll = container.querySelector<HTMLElement>(".add-list")?.scrollTop ?? 0;

  const totals = planTotals(plan, DRILLS);
  const blocks = planDrills(plan, DRILLS);
  const filled = plan.sessionMinutes > 0
    ? Math.min(1, totals.plannedMinutes / plan.sessionMinutes)
    : 0;

  container.innerHTML = `
    <p class="hub-back"><a href="#/plans">← All sessions</a></p>
    <div class="plan-layout">
    <div class="plan-main">
    <section class="hub-panel">
      <div class="hub-field">
        <label for="plan-title">Call it</label>
        <input id="plan-title" type="text" maxlength="80" value="${esc(plan.title)}" />
      </div>
      <div class="plan-fields">
        <div class="hub-field">
          <label for="plan-minutes">How long</label>
          <div class="input-unit">
            <input id="plan-minutes" type="number" inputmode="numeric" min="10" max="180" step="5" value="${plan.sessionMinutes}" aria-describedby="plan-minutes-unit" />
            <span class="input-unit-suffix" id="plan-minutes-unit">minutes</span>
          </div>
        </div>
        <div class="hub-field">
          <label>Age group</label>
          <p class="plan-age">${AGE_GROUP_LABELS[plan.ageGroup]}</p>
        </div>
      </div>

      <div class="budget" role="img" aria-label="${totals.plannedMinutes} of ${plan.sessionMinutes} minutes planned">
        <div class="budget-bar"><span style="transform:scaleX(${filled.toFixed(3)})"${totals.remainingMinutes < 0 ? ' class="is-over"' : ""}></span></div>
        <p class="budget-text">
          <strong>${totals.plannedMinutes} min</strong> planned${
            totals.breakMinutes > 0 ? `, ${totals.breakMinutes} of it breaks` : ""
          } ·
          ${
            totals.remainingMinutes < 0
              ? `<span class="is-over-text">${-totals.remainingMinutes} min over</span>`
              : `${totals.remainingMinutes} min left`
          }
        </p>
      </div>

      ${warningList(totals)}
      <div class="plan-status">
        <p class="save-state" id="save-state" role="status">${saveLabel()}</p>
        <a class="hub-btn hub-btn-done" href="#/plan/${esc(plan.id)}">Done</a>
      </div>
    </section>

    <section class="hub-panel">
      <h2>The session</h2>
      ${
        blocks.length === 0
          ? '<p class="hub-fineprint">Empty so far. Add a drill below.</p>'
          : blocks
              .map(({ block, drill, index }, position) =>
                blockRow(block, drill, index, position, blocks.length, plan.id),
              )
              .join("")
      }
      ${
        totals.missingDrillIds.length > 0
          ? `<p class="hub-error">${totals.missingDrillIds.length} block${totals.missingDrillIds.length === 1 ? "" : "s"} point at a drill that no longer exists. <button type="button" class="hub-link" id="drop-missing">Remove them</button></p>`
          : ""
      }
    </section>
    </div>

    <div class="plan-side">
    <section class="hub-panel">
      <h2>Add a drill</h2>
      <div class="hub-field">
        <label for="add-search" class="visually-hidden">Search ${esc(AGE_GROUP_LABELS[plan.ageGroup])} drills</label>
        <input id="add-search" type="search" value="${esc(addSearch)}" placeholder="Search ${esc(AGE_GROUP_LABELS[plan.ageGroup])} drills…" />
      </div>
      <div class="hub-segmented" role="group" aria-label="Warm-up or exercise">
        ${KINDS.map(
          (k) =>
            `<button type="button" data-addkind="${k.value}" class="hub-seg${(addKind ?? "") === k.value ? " is-active" : ""}" aria-pressed="${(addKind ?? "") === k.value}">${k.label}</button>`,
        ).join("")}
      </div>
      <div class="chip-row chip-themes" role="group" aria-label="What the drill is about">
        ${THEMES.filter((t) => ageAtLeast(plan.ageGroup, THEME_MIN_AGE[t]))
          .map(
            (t) =>
              `<button type="button" data-addtheme="${t}" class="chip-filter${t === addTheme ? " is-active" : ""}" aria-pressed="${t === addTheme}">${esc(THEME_SHORT[t])}</button>`,
          )
          .join("")}
      </div>

      <!-- Same two groups as the catalogue, in the same order, because this is
           the same list of drills being narrowed the same way. -->
      <div class="chip-row chip-picks" role="group" aria-label="Your stars and the pitch you have got">
        <button type="button" id="add-fav" class="chip-filter chip-fav${addFavouritesOnly ? " is-active" : ""}" aria-pressed="${addFavouritesOnly}">
          ${starIcon(addFavouritesOnly)} Favourites${starred.size > 0 ? ` (${starred.size})` : ""}
        </button>
        <button type="button" id="add-space" class="chip-filter${addSmallSpace ? " is-active" : ""}" aria-pressed="${addSmallSpace}">${tickIcon(addSmallSpace)}Small space</button>
        <button type="button" id="add-ground" class="chip-filter${addHardGround ? " is-active" : ""}" aria-pressed="${addHardGround}">${tickIcon(addHardGround)}Hard ground</button>
      </div>
      ${addList(plan.ageGroup, plan)}
    </section>

    ${kitList(totals)}

    <section class="hub-panel">
      <div class="plan-actions">
        <button type="button" class="hub-btn" id="plan-print">${iconPrint}Print it</button>
        <button type="button" class="hub-btn" id="plan-duplicate">${iconDuplicate}Duplicate</button>
      </div>
      <button type="button" class="hub-btn hub-btn-danger" id="plan-delete">${iconDelete}Delete this session</button>
    </section>
    </div>
    </div>`;

  wire(container, ctx);
  renderPrintable(plan, blocks, totals);

  if (redraw) {
    const list = container.querySelector<HTMLElement>(".add-list");
    if (list) list.scrollTop = listScroll;
    restorePageScroll(pageScroll);
  }
}

/**
 * Puts the page back where the coach had it after a redraw.
 *
 * Twice on purpose. The synchronous call covers the normal case with no flicker,
 * but straight after innerHTML the document can still be short. The browser then
 * clamps the scroll to a height that is about to change. That left the page 500px
 * from where it started on a phone. The frame callback catches it once layout has
 * actually settled.
 */
function restorePageScroll(top: number): void {
  window.scrollTo(0, top);
  requestAnimationFrame(() => {
    if (Math.abs(window.scrollY - top) > 1) window.scrollTo(0, top);
  });
}

function warningList(totals: PlanTotals): string {
  if (totals.warnings.length === 0) return "";
  return `<ul class="plan-warnings">${totals.warnings
    .map(
      (w) =>
        `<li class="plan-warning plan-warning-${w.level}"${w.level === "error" ? ' role="alert"' : ""}>${esc(w.message)}</li>`,
    )
    .join("")}</ul>`;
}

/**
 * `index` addresses `plan.blocks`, `position` is where it sits on screen. They only
 * match when every block resolves to a drill, so the controls use index and the
 * up/down disabling uses position.
 */
function blockRow(
  block: PlanBlock,
  drill: Drill,
  index: number,
  position: number,
  total: number,
  planId: string,
): string {
  const pause = block.breakAfter ?? 0;
  return `
    <div class="block-row">
      <div class="block-main">
        <a class="block-title" href="#/catalogue/${esc(drill.id)}/from/${esc(planId)}">${esc(drill.title)}</a>
        <p class="block-meta">
          ${kindPill(drill)} ${esc(drill.space)}
        </p>
        ${
          // Readable without leaving the session. Not a hover: this is used on a
          // phone at a pitch, where hover does not exist. Safety is also the last
          // thing that should sit behind an interaction nobody can perform.
          drill.safety
            ? `<details class="block-safety-details" data-safety="${esc(drill.id)}"${openSafety.has(drill.id) ? " open" : ""}>
                 <summary><span class="block-safety">Safety note</span></summary>
                 <p>${esc(drill.safety)}</p>
               </details>`
            : ""
        }
      </div>
      <div class="block-controls">
        <label class="block-minutes">
          <span class="visually-hidden">Minutes for ${esc(drill.title)}</span>
          <input type="number" inputmode="numeric" min="0" max="90" step="1" value="${block.minutes}" data-minutes="${index}" />
        </label>
        <button type="button" data-up="${index}" aria-label="Move ${esc(drill.title)} earlier"${position === 0 ? " disabled" : ""}>▲</button>
        <button type="button" data-down="${index}" aria-label="Move ${esc(drill.title)} later"${position === total - 1 ? " disabled" : ""}>▼</button>
        <button type="button" data-remove="${index}" aria-label="Remove ${esc(drill.title)}">✕</button>
      </div>
    </div>
    ${
      pause > 0
        ? `<div class="break-row">
             <span class="break-label">Water break</span>
             <div class="block-controls">
               <label class="block-minutes">
                 <span class="visually-hidden">Break minutes after ${esc(drill.title)}</span>
                 <input type="number" inputmode="numeric" min="1" max="20" step="1" value="${pause}" data-break="${index}" />
               </label>
               <button type="button" data-nobreak="${index}" aria-label="Remove the water break after ${esc(drill.title)}">✕</button>
             </div>
           </div>`
        : `<button type="button" class="break-add" data-addbreak="${index}">+ water break</button>`
    }`;
}

/**
 * Every matching drill, scrolled rather than truncated, because "5 of 73" was no
 * use. Tapping one opens a look at it in place with an explicit Add, so nothing
 * lands in the session by accident.
 *
 * Expanded in place rather than in a modal. This is used one-handed on a phone,
 * where a modal costs a focus trap, a scroll lock and an escape key nobody has.
 */
function addList(ageGroup: AgeGroup, plan: SessionPlan): string {
  const matches = filterDrills(DRILLS, {
    ageGroup,
    search: addSearch,
    theme: addTheme,
    kind: addKind,
    onlyFavourites: addFavouritesOnly,
    favourites: starred,
    smallSpace: addSmallSpace,
    hardGround: addHardGround,
  });

  if (matches.length === 0) {
    return `<p class="hub-fineprint">${
      addFavouritesOnly && starred.size === 0
        ? "No favourites yet. Star a drill under Drills and it'll show up here."
        : // Hard ground first, because with both chips on it is the one doing
          // the work: what fits a hall is mostly the contact drills a baked
          // pitch rules out. Same order as the catalogue's empty state.
          addHardGround
          ? `Nothing for ${AGE_GROUP_LABELS[ageGroup]} works on hard ground with that on as well.`
          : addSmallSpace
            ? `Nothing for ${AGE_GROUP_LABELS[ageGroup]} fits a small space with that on as well.`
            : `Nothing for ${AGE_GROUP_LABELS[ageGroup]} matches that.`
    }</p>`;
  }

  return `
    <p class="add-count">${matches.length} to choose from</p>
    <ul class="add-list">${matches
      .map((drill) => {
        const open = previewing === drill.id;
        return `
        <li${open ? ' class="is-open"' : ""}>
          <button type="button" class="add-row" data-peek="${esc(drill.id)}" aria-expanded="${open}">
            <span class="add-row-figure">${
              drill.diagram ? renderDiagram(drill.diagram, { decorative: true }) : ""
            }</span>
            <span class="add-row-body">
              <span class="add-title">${esc(drill.title)}${starred.has(drill.id) ? ` ${starIcon(true)}` : ""}</span>
              <span class="add-meta">${kindPill(drill)} ${drill.minutes} min · ${esc(drill.space)}</span>
            </span>
          </button>
          ${
            open
              ? `<div class="add-peek">
                   ${
                     drill.diagram
                       ? `<div class="add-peek-figure">${renderDiagram(drill.diagram)}</div>`
                       : ""
                   }
                   <p class="add-peek-facts">${playersLabel(drill)} · ${esc(drill.equipment.map(kitLabel).join(", ")) || "no kit"}</p>
                   <div class="add-peek-actions">
                     <button type="button" class="hub-btn hub-btn-primary" data-add="${esc(drill.id)}">Add ${drill.minutes} min to the session</button>
                     <a class="hub-link" href="#/catalogue/${esc(drill.id)}/from/${esc(plan.id)}">Open the full drill</a>
                   </div>
                   ${drill.safety ? `<p class="add-peek-safety"><strong>Safety.</strong> ${esc(drill.safety)}</p>` : ""}
                   <p>${esc(drill.howItRuns)}</p>
                 </div>`
              : ""
          }
        </li>`;
      })
      .join("")}</ul>`;
}

function kitList(totals: PlanTotals): string {
  if (totals.equipment.length === 0) return "";
  return `
    <section class="hub-panel">
      <h2>What to pack</h2>
      <ul class="kit-list">${totals.equipment.map((item) => `<li>${esc(kitLabel(item))}</li>`).join("")}</ul>
      ${
        totals.singleUseEquipment.length > 0
          ? `<p class="hub-fineprint">Only out for one short block: ${totals.singleUseEquipment
              .map((item) => esc(`${item}s`))
              .join(", ")}.</p>`
          : ""
      }
    </section>`;
}

// ---- Wiring ----

function wire(container: HTMLElement, ctx: PlannerContext): void {
  const change = (mutate: (plan: SessionPlan) => SessionPlan, restoreFocus?: string): void => {
    if (!editing) return;
    editing = mutate(editing);
    // Local write is synchronous, so closing the tab right now loses nothing
    stagePlan(ctx.userId, editing);
    draw(container, ctx);
    schedulePush(ctx, container);
    if (restoreFocus) {
      const target = container.querySelector<HTMLElement>(restoreFocus);
      target?.focus();
      if (target instanceof HTMLInputElement) {
        target.setSelectionRange(target.value.length, target.value.length);
      }
    }
  };

  const title = container.querySelector<HTMLInputElement>("#plan-title");
  title?.addEventListener("input", () => {
    change((plan) => ({ ...plan, title: title.value }), "#plan-title");
  });

  const minutes = container.querySelector<HTMLInputElement>("#plan-minutes");
  minutes?.addEventListener("change", () => {
    const value = Number(minutes.value);
    change((plan) => ({
      ...plan,
      sessionMinutes: Number.isFinite(value) ? Math.min(180, Math.max(10, value)) : plan.sessionMinutes,
    }));
  });

  for (const input of container.querySelectorAll<HTMLInputElement>("[data-minutes]")) {
    input.addEventListener("change", () => {
      const index = Number(input.dataset.minutes);
      const value = Math.min(90, Math.max(0, Number(input.value) || 0));
      change((plan) => ({
        ...plan,
        blocks: plan.blocks.map((b, i) => (i === index ? { ...b, minutes: value } : b)),
      }));
    });
  }

  for (const button of container.querySelectorAll<HTMLButtonElement>("[data-up], [data-down]")) {
    button.addEventListener("click", () => {
      const up = button.dataset.up;
      const index = Number(up ?? button.dataset.down);
      const to = up !== undefined ? index - 1 : index + 1;
      change((plan) => ({ ...plan, blocks: moveBlock(plan.blocks, index, to) }));
    });
  }

  for (const button of container.querySelectorAll<HTMLButtonElement>("[data-addbreak]")) {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.addbreak);
      change((plan) => ({
        ...plan,
        blocks: plan.blocks.map((b, i) => (i === index ? { ...b, breakAfter: 3 } : b)),
      }));
    });
  }

  for (const button of container.querySelectorAll<HTMLButtonElement>("[data-nobreak]")) {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.nobreak);
      change((plan) => ({
        ...plan,
        blocks: plan.blocks.map((b, i) => {
          if (i !== index) return b;
          const { breakAfter: _drop, ...rest } = b;
          return rest;
        }),
      }));
    });
  }

  for (const input of container.querySelectorAll<HTMLInputElement>("[data-break]")) {
    input.addEventListener("change", () => {
      const index = Number(input.dataset.break);
      const value = Math.min(20, Math.max(1, Number(input.value) || 1));
      change((plan) => ({
        ...plan,
        blocks: plan.blocks.map((b, i) => (i === index ? { ...b, breakAfter: value } : b)),
      }));
    });
  }

  for (const button of container.querySelectorAll<HTMLButtonElement>("[data-remove]")) {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.remove);
      change((plan) => ({ ...plan, blocks: plan.blocks.filter((_, i) => i !== index) }));
    });
  }

  for (const button of container.querySelectorAll<HTMLButtonElement>("[data-add]")) {
    button.addEventListener("click", () => {
      const drill = findDrill(button.dataset.add ?? "");
      if (!drill) return;
      previewing = null;
      change((plan) => ({
        ...plan,
        blocks: [...plan.blocks, { drillId: drill.id, minutes: drill.minutes }],
      }));
      showToast(`${drill.title} added.`);
    });
  }

  container.querySelector("#drop-missing")?.addEventListener("click", () => {
    change((plan) => ({ ...plan, blocks: plan.blocks.filter((b) => findDrill(b.drillId)) }));
  });

  for (const details of container.querySelectorAll<HTMLDetailsElement>("[data-safety]")) {
    details.addEventListener("toggle", () => {
      const id = details.dataset.safety ?? "";
      if (details.open) openSafety.add(id);
      else openSafety.delete(id);
    });
  }

  container.querySelector("#add-fav")?.addEventListener("click", () => {
    addFavouritesOnly = !addFavouritesOnly;
    previewing = null;
    draw(container, ctx);
  });

  container.querySelector("#add-space")?.addEventListener("click", () => {
    addSmallSpace = !addSmallSpace;
    previewing = null;
    draw(container, ctx);
  });

  container.querySelector("#add-ground")?.addEventListener("click", () => {
    addHardGround = !addHardGround;
    previewing = null;
    draw(container, ctx);
  });

  for (const button of container.querySelectorAll<HTMLButtonElement>("[data-addkind]")) {
    button.addEventListener("click", () => {
      const value = button.dataset.addkind ?? "";
      addKind = value ? (value as DrillKind) : undefined;
      previewing = null;
      draw(container, ctx);
    });
  }

  for (const chip of container.querySelectorAll<HTMLButtonElement>("[data-addtheme]")) {
    chip.addEventListener("click", () => {
      const value = chip.dataset.addtheme as Theme;
      // Same as the catalogue: the chip you are on comes off when tapped again
      addTheme = value === addTheme ? undefined : value;
      previewing = null;
      draw(container, ctx);
    });
  }

  for (const button of container.querySelectorAll<HTMLButtonElement>("[data-peek]")) {
    button.addEventListener("click", () => {
      const id = button.dataset.peek ?? "";
      previewing = previewing === id ? null : id;
      draw(container, ctx);
      // preventScroll, or focusing it undoes the position draw() just restored
      container.querySelector<HTMLElement>(`[data-peek="${id}"]`)?.focus({ preventScroll: true });
    });
  }

  const search = container.querySelector<HTMLInputElement>("#add-search");
  search?.addEventListener("input", () => {
    clearTimeout(addSearchTimer);
    addSearchTimer = setTimeout(() => {
      // The editor may be gone. Painting into a view that moved on is what
      // `stillOn` exists to stop everywhere else here.
      if (!stillOn("plan", editing?.id)) return;
      addSearch = container.querySelector<HTMLInputElement>("#add-search")?.value ?? "";
      previewing = null;
      draw(container, ctx);
      const next = container.querySelector<HTMLInputElement>("#add-search");
      next?.focus();
      next?.setSelectionRange(next.value.length, next.value.length);
    }, SEARCH_DEBOUNCE_MS);
  });

  container.querySelector("#plan-print")?.addEventListener("click", () => window.print());

  container.querySelector("#plan-duplicate")?.addEventListener("click", () => {
    if (!editing) return;
    const copy: SessionPlan = { ...editing, id: newPlanId(), title: `${editing.title} copy` };
    stagePlan(ctx.userId, copy);
    editing = copy;
    void savePlan(ctx.userId, copy);
    go(`plan/${copy.id}/edit`);
    showToast("Copied.");
  });

  container.querySelector("#plan-delete")?.addEventListener("click", () => {
    if (!editing) return;
    if (!window.confirm(`Delete "${editing.title}"? No undo.`)) return;
    const id = editing.id;
    editing = null;
    void deletePlan(ctx.userId, id);
    go("plans");
    showToast("Session deleted.");
  });
}

function saveLabel(): string {
  if (saveState === "saving") return "Saving…";
  if (saveState === "local") return "Saved on this phone. It'll reach the server on its own.";
  return "Saved";
}

/** Updates the one line rather than redrawing, so it never steals the caret. */
function paintSaveState(container: HTMLElement): void {
  const slot = container.querySelector<HTMLElement>("#save-state");
  if (!slot) return;
  slot.textContent = saveLabel();
  slot.dataset.state = saveState;
}

/** The push is allowed to be slow; the local write already happened. */
function schedulePush(ctx: PlannerContext, container: HTMLElement): void {
  clearTimeout(pushTimer);
  saveState = "saving";
  paintSaveState(container);
  pushTimer = setTimeout(() => {
    if (!editing) return;
    void savePlan(ctx.userId, editing).then((pushed) => {
      saveState = pushed ? "saved" : "local";
      paintSaveState(container);
    });
  }, 800);
}

/** Flush a pending push when the coach navigates away or backgrounds the tab. */
export function flushPlanPush(userId: string): void {
  if (pushTimer === undefined || !editing) return;
  clearTimeout(pushTimer);
  pushTimer = undefined;
  void savePlan(userId, editing);
}

// ---- Print ----

/**
 * A separate, flat rendering for paper. The interactive editor is full of steppers
 * and buttons that mean nothing printed. A coach wants the whole session and
 * its coaching points on one sheet rather than a screenshot of a form.
 */
function renderPrintable(
  plan: SessionPlan,
  blocks: Array<{ block: PlanBlock; drill: Drill }>,
  totals: PlanTotals,
): void {
  let sheet = document.getElementById("plan-print-sheet");
  if (!sheet) {
    sheet = document.createElement("div");
    sheet.id = "plan-print-sheet";
    sheet.setAttribute("aria-hidden", "true");
    document.body.appendChild(sheet);
  }

  sheet.innerHTML = `
    <h1>${esc(plan.title)}</h1>
    <p class="print-sub">
      ${AGE_GROUP_LABELS[plan.ageGroup]} · ${totals.plannedMinutes} min planned of
      ${plan.sessionMinutes} min
    </p>
    ${
      totals.equipment.length > 0
        ? `<p class="print-kit"><strong>Kit:</strong> ${esc(totals.equipment.map(kitLabel).join(", "))}</p>`
        : ""
    }
    ${blocks
      .map(
        ({ block, drill }, index) => `
      <section class="print-block">
        <h2>${index + 1}. ${esc(drill.title)}. ${block.minutes} min</h2>
        <p class="print-meta">${esc(drill.space)} · ${esc(drill.equipment.map(kitLabel).join(", ")) || "no kit"}</p>
        ${drill.safety ? `<p class="print-safety"><strong>Safety:</strong> ${esc(drill.safety)}</p>` : ""}
        <p>${esc(drill.howItRuns)}</p>
        <ul>${drill.coachingPoints.map((point) => `<li>${esc(point)}</li>`).join("")}</ul>
      </section>${
        block.breakAfter
          ? `<p class="print-break">Water break, ${block.breakAfter} min</p>`
          : ""
      }`,
      )
      .join("")}`;
}

export function clearPrintable(): void {
  document.getElementById("plan-print-sheet")?.remove();
}

/** Called on sign-out so the next coach on a shared device starts clean. */
export function resetPlanner(): void {
  stopRunClock();
  editing = null;
  addSearch = "";
  addTheme = undefined;
  addKind = undefined;
  addFavouritesOnly = false;
  addSmallSpace = false;
  addHardGround = false;
  clearTimeout(addSearchTimer);
  addSearchTimer = undefined;
  previewing = null;
  openSafety = new Set();
  saveState = "saved";
  clearTimeout(pushTimer);
  pushTimer = undefined;
  clearPrintable();
}
