import { esc } from "../../lib/esc.js";
import { ageRulesLink } from "../../lib/rulesLink.js";
import { showToast } from "../../components/toast.js";
import { go, stillOn } from "../router.js";
import { DRILLS, filterDrills, findDrill } from "../content/drills.js";
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
  localPlans,
  newPlanId,
  pendingCount,
  savePlan,
  stagePlan,
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
let pushTimer: ReturnType<typeof setTimeout> | undefined;

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
    container.innerHTML = `<section class="hub-panel"><p class="hub-fineprint">Loading…</p></section>`;
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

  container.innerHTML = `
    <p class="hub-back"><a href="#/plans">← All sessions</a></p>

    <section class="hub-panel run-head">
      <div class="run-head-top">
        <h2>${esc(plan.title)}</h2>
        <a class="hub-btn hub-btn-edit" href="#/plan/${esc(plan.id)}/edit">Edit</a>
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

    <section class="hub-panel">
      <button type="button" class="hub-btn" id="plan-print">Print it</button>
    </section>`;

  container.querySelector("#plan-print")?.addEventListener("click", () => window.print());
  for (const details of container.querySelectorAll<HTMLDetailsElement>("[data-safety]")) {
    details.addEventListener("toggle", () => {
      const id = details.dataset.safety ?? "";
      if (details.open) openSafety.add(id);
      else openSafety.delete(id);
    });
  }

  renderPrintable(plan, blocks, totals);
}

/** One block, sized to be read at arm's length with a whistle in the other hand. */
function runBlock(block: PlanBlock, drill: Drill, index: number, planId: string): string {
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

      <ul class="run-points">${drill.coachingPoints.map((point) => `<li>${esc(point)}</li>`).join("")}</ul>
      <p class="run-more"><a href="#/catalogue/${esc(drill.id)}/from/${esc(planId)}">How it runs, plus how to change it</a></p>
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
  const { updatedAt: _updatedAt, ...rest } = plan;
  return rest;
}

function draw(container: HTMLElement, ctx: PlannerContext): void {
  const plan = editing;
  if (!plan) return;
  starred = localFavourites(ctx.userId);

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
      <div class="chip-scroll-wrap">
        <div class="chip-scroll" role="group" aria-label="Narrow the drills down">
          <button type="button" id="add-fav" class="chip-filter chip-fav${addFavouritesOnly ? " is-active" : ""}" aria-pressed="${addFavouritesOnly}">
            ${starIcon(addFavouritesOnly)} Favourites${starred.size > 0 ? ` (${starred.size})` : ""}
          </button>
          <span class="chip-divider" aria-hidden="true"></span>
          <button type="button" data-addtheme="" class="chip-filter${addTheme ? "" : " is-active"}" aria-pressed="${!addTheme}">Anything</button>
          ${THEMES.filter((t) => ageAtLeast(plan.ageGroup, THEME_MIN_AGE[t]))
            .map(
              (t) =>
                `<button type="button" data-addtheme="${t}" class="chip-filter${t === addTheme ? " is-active" : ""}" aria-pressed="${t === addTheme}">${esc(THEME_SHORT[t])}</button>`,
            )
            .join("")}
        </div>
      </div>
      ${addList(plan.ageGroup, plan)}
    </section>

    ${kitList(totals)}

    <section class="hub-panel">
      <button type="button" class="hub-btn" id="plan-print">Print it</button>
      <button type="button" class="hub-btn" id="plan-duplicate">Duplicate</button>
      <button type="button" class="hub-btn hub-btn-danger" id="plan-delete">Delete this session</button>
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
  });

  if (matches.length === 0) {
    return `<p class="hub-fineprint">${
      addFavouritesOnly && starred.size === 0
        ? "No favourites yet. Star a drill under Drills and it'll show up here."
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
            <span class="add-title">${esc(drill.title)}${starred.has(drill.id) ? ` ${starIcon(true)}` : ""}</span>
            <span class="add-meta">${kindPill(drill)} ${drill.minutes} min · ${esc(drill.space)}</span>
          </button>
          ${
            open
              ? `<div class="add-peek">
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
      const value = chip.dataset.addtheme ?? "";
      addTheme = value ? (value as Theme) : undefined;
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
    addSearch = search.value;
    previewing = null;
    draw(container, ctx);
    const next = container.querySelector<HTMLInputElement>("#add-search");
    next?.focus();
    next?.setSelectionRange(next.value.length, next.value.length);
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
  editing = null;
  addSearch = "";
  addTheme = undefined;
  addKind = undefined;
  addFavouritesOnly = false;
  previewing = null;
  openSafety = new Set();
  saveState = "saved";
  clearTimeout(pushTimer);
  pushTimer = undefined;
  clearPrintable();
}
