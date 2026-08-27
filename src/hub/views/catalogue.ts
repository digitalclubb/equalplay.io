import { esc } from "../../lib/esc.js";
import { ageRulesLink, rulesLink } from "../../lib/rulesLink.js";
import { currentRoute, go } from "../router.js";
import {
  localFavourites,
  syncFavourite,
  syncFavourites,
  toggleFavourite,
} from "../favourites.js";
import { DRILLS, filterDrills, findDrill, isAvailableAt, type DrillFilter } from "../content/drills.js";
import { localPlans, syncPlans } from "../plans.js";
import { addDrillToPlan, newPlanWithDrill } from "./planner.js";
import { showToast } from "../../components/toast.js";
import { renderDiagram } from "../content/diagram.js";
import {
  AGE_GROUPS,
  AGE_GROUP_LABELS,
  THEMES,
  THEME_LABELS,
  REGULATION_15_URL,
  RULES_OF_PLAY,
  THEME_MIN_AGE,
  THEME_SHORT,
  ageAtLeast,
  isAgeGroup,
  kitLabel,
  type AgeGroup,
  type Drill,
  type DrillKind,
  type Theme,
} from "../content/types.js";

/**
 * Favourites is a route rather than a filter, so it is somewhere a coach can
 * land, link to and come back to. Everything else about the list is the same,
 * which is why it renders through here instead of getting a view of its own.
 */
function onFavourites(): boolean {
  return currentRoute().name === "favourites";
}

/** The route the list is under, so a card and a back link agree with where they are. */
function listRoute(): string {
  return onFavourites() ? "favourites" : "catalogue";
}

/**
 * Filters live here rather than in the URL so they survive the trip into a drill
 * and back out. A coach browsing U10 rucking should not lose that when they tap
 * a drill to read it.
 *
 * `seededFor` is what keeps the age gate honest across a profile change. Without
 * it, a coach who signs up as U12 by mistake and corrects it to U8 on the Account
 * page would come back to a catalogue still listing rucks and scrums. The very
 * thing content-age-gate.test.ts exists to prevent, defeated one layer above the
 * function it tests. Same story for a second coach signing in on a shared device.
 */
let filters: DrillFilter | null = null;
let seededFor: AgeGroup | null = null;
let favourites: Set<string> = new Set();
let currentUserId = "";
let pulledFor: string | null = null;
/**
 * Whether the drill page has its session picker open.
 *
 * Reset on every route change rather than remembered. A coach who opened it,
 * thought better of it and moved on should not find it waiting on the next drill.
 */
let addOpen = false;
/**
 * Which coach's sessions have been pulled for the picker, plus whether a pull
 * is in the air. The local mirror stays empty until something has been to the
 * server. Only the planner ever goes, so without this a coach signing in on a
 * second phone opens the picker and is told they have no sessions.
 */
let plansPulledFor: string | null = null;
let plansPulling = false;

const WELCOME_KEY = "equalplay_hub_welcomed";

/**
 * Called on sign-out and on a second coach signing in, so a shared tablet holds
 * nothing belonging to the one who left.
 *
 * The pulled-once markers matter as much as the data. Signing out clears the
 * local mirrors, so a marker still naming that coach means the re-fetch never
 * runs and the catalogue shows an empty set of stars for the rest of the tab's
 * life. Clubs share tablets, so this is a same-coach-again path as well.
 */
export function resetCatalogue(): void {
  filters = null;
  seededFor = null;
  favourites = new Set();
  currentUserId = "";
  pulledFor = null;
  plansPulledFor = null;
  plansPulling = false;
  addOpen = false;
  try {
    localStorage.removeItem(WELCOME_KEY);
  } catch {
    // Nothing to do
  }
}

/**
 * Shown once. A coach signing in for the first time lands on a list of drills with
 * no idea why those ones and not others, which is the single most useful thing to
 * tell them.
 */
function welcome(age: string): string {
  try {
    if (localStorage.getItem(WELCOME_KEY)) return "";
  } catch {
    return "";
  }
  return `
    <section class="hub-panel hub-welcome">
      <h2>Welcome along</h2>
      <p class="hub-lede">
        Everything here is set to ${esc(age)}, so you'll only ever see drills your
        players are allowed to do. Tackling shows up at U9, rucks and scrums at U10.
      </p>
      <p class="hub-lede">
        Head to <a href="#/plans">Sessions</a> when you want to put a training night
        together. There are ready-made ones you can run as they come. It all keeps
        working once you've opened it, so the car park at the club is fine.
      </p>
      <p class="hub-fineprint">
        None of this is official RFU guidance. Every age group links straight to
        ${rulesLink("their rules of play", REGULATION_15_URL)} so you can see for yourself.
      </p>
      <button type="button" class="hub-btn" id="dismiss-welcome">Got it</button>
    </section>`;
}

/**
 * Starring, from the list and from a drill page both.
 *
 * A star is per coach and has to survive a new phone, so signed out this is the
 * moment to ask rather than a button that quietly does nothing.
 */
function toggleStar(id: string, redraw: () => void): void {
  if (!currentUserId) {
    go("join/favourites");
    return;
  }
  favourites = toggleFavourite(currentUserId, id);
  void syncFavourite(currentUserId, id);
  redraw();
}

const KINDS: Array<{ value: DrillKind | ""; label: string }> = [
  { value: "", label: "All" },
  { value: "warmup", label: "Warm-ups" },
  { value: "exercise", label: "Exercises" },
];

export function renderCatalogue(
  container: HTMLElement,
  defaultAge: AgeGroup,
  userId: string,
  drillId?: string,
  /** ["from", "<planId>"] when the drill was opened out of a session. */
  origin: string[] = [],
): void {
  if (!filters || seededFor !== defaultAge) {
    filters = { ageGroup: defaultAge };
    seededFor = defaultAge;
  }
  currentUserId = userId;
  favourites = localFavourites(userId);
  addOpen = false;

  // Pull the server's list once per visit, then redraw if it differs
  if (!pulledFor || pulledFor !== userId) {
    pulledFor = userId;
    void syncFavourites(userId).then((result) => {
      favourites = result.ids;
      // Checked now rather than remembered from when this started. The coach may
      // be three views away by the time a slow sync comes back.
      const route = currentRoute();
      if ((route.name === "catalogue" || route.name === "favourites") && !route.param) {
        renderList(container);
      }
    });
  }

  if (drillId) {
    const drill = findDrill(drillId);
    if (drill) {
      renderDetail(container, drill, backLink(origin));
      return;
    }
    // Stale link, e.g. a bookmark from before a drill was renamed
    go(listRoute());
    return;
  }

  renderList(container);
}

// ---- List ----

function renderList(container: HTMLElement): void {
  // Taken from the route rather than held in `filters`, so the URL says which
  // list this is and a reload lands back on the same one.
  const active: DrillFilter = { ...(filters as DrillFilter), onlyFavourites: onFavourites() };
  const results = filterDrills(DRILLS, { ...active, favourites });
  const base = listRoute();

  container.innerHTML = `
    ${welcome(AGE_GROUP_LABELS[active.ageGroup])}
    <section class="hub-panel hub-filters">
      <div class="hub-field">
        <label for="f-search" class="visually-hidden">Search drills</label>
        <input id="f-search" type="search" value="${esc(active.search ?? "")}" placeholder="Search ruck, passing, tag…" />
      </div>

      <div class="chip-scroll-wrap">
      <div class="chip-scroll" role="group" aria-label="Narrow the drills down">
        <button type="button" id="f-fav" class="chip-filter chip-fav${active.onlyFavourites ? " is-active" : ""}" aria-pressed="${Boolean(active.onlyFavourites)}">
          ${star(Boolean(active.onlyFavourites))} Favourites${favourites.size > 0 ? ` (${favourites.size})` : ""}
        </button>
        <button type="button" id="f-space" class="chip-filter${active.smallSpace ? " is-active" : ""}" aria-pressed="${Boolean(active.smallSpace)}">Small space</button>
        <span class="chip-divider" aria-hidden="true"></span>
        <button type="button" data-theme="" class="chip-filter${active.theme ? "" : " is-active"}" aria-pressed="${active.theme ? "false" : "true"}">Anything</button>
        ${THEMES.map(
          (t) =>
            `<button type="button" data-theme="${t}" class="chip-filter${t === active.theme ? " is-active" : ""}" aria-pressed="${t === active.theme}">${esc(THEME_SHORT[t])}</button>`,
        ).join("")}
      </div>
      </div>

      <div class="filter-row">
        <div class="hub-segmented" role="group" aria-label="Warm-up or exercise">
          ${KINDS.map(
            (k) =>
              `<button type="button" data-kind="${k.value}" class="hub-seg${(active.kind ?? "") === k.value ? " is-active" : ""}" aria-pressed="${(active.kind ?? "") === k.value}">${k.label}</button>`,
          ).join("")}
        </div>
        <label for="f-age" class="visually-hidden">Age group</label>
        <select id="f-age" class="age-select">
          ${AGE_GROUPS.map(
            (g) =>
              `<option value="${g}"${g === active.ageGroup ? " selected" : ""}>${AGE_GROUP_LABELS[g]}</option>`,
          ).join("")}
        </select>
      </div>

      <p class="hub-count" role="status">${countLabel(results.length, active)}</p>
    </section>

    ${
      results.length === 0
        ? emptyState(active)
        : `<div class="drill-list">${results.map((drill) => card(drill, base)).join("")}</div>`
    }`;

  container.querySelector<HTMLSelectElement>("#f-age")?.addEventListener("change", (e) => {
    const value = (e.target as HTMLSelectElement).value;
    if (isAgeGroup(value)) update({ ageGroup: value });
  });

  for (const chip of container.querySelectorAll<HTMLButtonElement>("[data-theme]")) {
    chip.addEventListener("click", () => {
      const value = chip.dataset.theme ?? "";
      update({ theme: value ? (value as Theme) : undefined });
    });
  }

  const search = container.querySelector<HTMLInputElement>("#f-search");
  search?.addEventListener("input", () => {
    update({ search: search.value }, () => {
      const next = container.querySelector<HTMLInputElement>("#f-search");
      next?.focus();
      // Redrawing the input resets the caret to the start, which eats typing
      next?.setSelectionRange(next.value.length, next.value.length);
    });
  });

  for (const button of container.querySelectorAll<HTMLButtonElement>("[data-kind]")) {
    button.addEventListener("click", () => {
      const value = button.dataset.kind ?? "";
      update({ kind: value ? (value as DrillKind) : undefined });
    });
  }

  container.querySelector("#f-fav")?.addEventListener("click", () => {
    go(active.onlyFavourites ? "catalogue" : "favourites");
  });

  container.querySelector("#f-space")?.addEventListener("click", () => {
    update({ smallSpace: !active.smallSpace });
  });

  for (const button of container.querySelectorAll<HTMLButtonElement>("[data-fav]")) {
    button.addEventListener("click", (event) => {
      // The whole card is a link, so stop the tap turning into navigation
      event.preventDefault();
      event.stopPropagation();
      toggleStar(button.dataset.fav ?? "", () => renderList(container));
    });
  }

  container.querySelector("#dismiss-welcome")?.addEventListener("click", () => {
    try {
      localStorage.setItem(WELCOME_KEY, "1");
    } catch {
      // Private browsing. They will see it again, which is a small price
    }
    renderList(container);
  });

  container.querySelector("#clear-filters")?.addEventListener("click", () => {
    filters = { ageGroup: active.ageGroup };
    // The star is a route now, so clearing the filters alone would leave the list
    // just as empty and the button doing nothing you can see.
    if (active.onlyFavourites) go("catalogue");
    else renderList(container);
  });

  function update(patch: Partial<DrillFilter>, after?: () => void): void {
    filters = { ...active, ...patch };
    renderList(container);
    after?.();
  }
}

function countLabel(count: number, filter: DrillFilter): string {
  const age = AGE_GROUP_LABELS[filter.ageGroup];
  const room = filter.smallSpace ? " in a sports hall or a corner of the pitch" : "";
  if (count === 0) return `Nothing for ${age} matches that.`;
  if (filter.onlyFavourites) {
    return count === 1
      ? `One favourite your ${age} squad can do${room}.`
      : `${count} favourites your ${age} squad can do${room}.`;
  }
  return `${count} ${count === 1 ? "drill" : "drills"} your ${age} squad can do${room}.`;
}

function emptyState(filter: DrillFilter): string {
  const age = AGE_GROUP_LABELS[filter.ageGroup];
  let reason: string;

  if (filter.onlyFavourites && favourites.size === 0) {
    reason = "No favourites yet. Star a drill and it'll show up here.";
  } else if (filter.onlyFavourites) {
    reason = `None of your favourites match that at ${age}.`;
  } else if (filter.theme && !ageAtLeast(filter.ageGroup, THEME_MIN_AGE[filter.theme])) {
    // We know exactly when it arrives, so say so
    const from = AGE_GROUP_LABELS[THEME_MIN_AGE[filter.theme]];
    reason = `${THEME_LABELS[filter.theme]} starts at ${from}. Nothing here for your ${age}s yet.`;
  } else if (filter.smallSpace && filter.search?.trim()) {
    reason = `Nothing that small for ${age} matches "${filter.search.trim()}".`;
  } else if (filter.smallSpace) {
    reason = `Nothing for ${age} fits a small space with that on as well.`;
  } else if (filter.search?.trim()) {
    reason = `No ${age} drill matches "${filter.search.trim()}".`;
  } else if (filter.theme) {
    reason = `Nothing written for ${THEME_LABELS[filter.theme].toLowerCase()} at ${age} yet.`;
  } else {
    reason = `Nothing for ${age} matches that.`;
  }

  return `
    <section class="hub-panel hub-empty">
      <p>${esc(reason)}</p>
      <p class="hub-fineprint">${ageRulesLink(age, RULES_OF_PLAY[filter.ageGroup])}</p>
      ${
        filter.onlyFavourites && favourites.size === 0
          ? ""
          : '<button type="button" class="hub-btn" id="clear-filters">Start again</button>'
      }
    </section>`;
}

/** Outline when off, filled when on. Inline so it works with no signal. */
function star(filled: boolean): string {
  return filled
    ? `<svg class="star" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.4L12 17.4l-5.8 3 1.1-6.4L2.6 9.4l6.5-.9z"/></svg>`
    : `<svg class="star" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.7-5.2-2.7-5.2 2.7 1-5.7L3.6 9.7l5.8-.8z"/></svg>`;
}

function favButton(drill: Drill): string {
  const on = favourites.has(drill.id);
  return `<button
    type="button"
    class="fav-btn${on ? " is-on" : ""}"
    data-fav="${esc(drill.id)}"
    aria-pressed="${on}"
    aria-label="${on ? "Remove" : "Add"} ${esc(drill.title)} ${on ? "from" : "to"} favourites"
  >${star(on)}</button>`;
}

/**
 * The card is a link with one secondary action, so the anchor stretches over the
 * whole card with a pseudo-element and the star sits above it. Nesting a button
 * inside an anchor would be invalid and would swallow the tap.
 */
function card(drill: Drill, base: string): string {
  // Decorative here. The title beside it already says which drill this is, so a
  // screen reader working down the catalogue would otherwise get a hundred set
  // up descriptions read out between the names it came for.
  const figure = drill.diagram ? renderDiagram(drill.diagram, { decorative: true }) : "";
  // The slot stays in the markup either way. Empty for the one drill with no
  // diagram, so a phone list keeps every title on the same left edge rather
  // than having one row jump out of the column.
  return `
    <article class="drill-card drill-card-illustrated">
      <span class="drill-card-figure">${figure}</span>
      <span class="drill-card-body">
        <span class="drill-card-head">
          <a class="drill-card-title drill-card-link" href="#/${base}/${esc(drill.id)}">${esc(drill.title)}</a>
          <span class="drill-kind drill-kind-${drill.kind}">${drill.kind === "warmup" ? "Warm-up" : "Exercise"}</span>
          ${favButton(drill)}
        </span>
        <span class="drill-meta">
          ${drill.minutes} min · ${playersLabel(drill)} · ${esc(drill.space)}
        </span>
        <span class="drill-themes">${drill.themes.map((t) => esc(THEME_LABELS[t])).join(" · ")}</span>
      </span>
    </article>`;
}

function playersLabel(drill: Drill): string {
  return drill.players.max
    ? `${drill.players.min}–${drill.players.max} players`
    : `${drill.players.min}+ players`;
}

// ---- Detail ----

/**
 * Where the back link goes. A drill opened from a session returns to that session
 * rather than dumping the coach in the catalogue. It survives a reload because
 * the plan id is in the hash rather than in memory.
 */
function backLink(origin: string[]): { href: string; label: string } {
  const [marker, planId] = origin;
  if (marker === "from" && planId) {
    return { href: `#/plan/${planId}`, label: "← Back to the session" };
  }
  // Signed out the bare route is the gate, so a drill read from a shared link
  // would back out into a registration form for favourites nobody has.
  if (onFavourites() && currentUserId) {
    return { href: "#/favourites", label: "← Back to your favourites" };
  }
  return { href: "#/catalogue", label: "← Back to drills" };
}

/**
 * The grade a session started from a drill page gets created at.
 *
 * A drill page is never age gated, so the grade being browsed can be one this
 * drill is not legal at. That happens in both directions: a bookmarked ruck
 * drill opened while browsing U8, or the one tag drill capped at U8 opened
 * while browsing U12. Neither should produce a session labelled a grade that
 * cannot run the only block in it. The nearest grade at or below what the coach
 * was looking at is the honest answer, falling back to the drill's own floor
 * when the thing has not arrived for them yet.
 */
function gradeForNewPlan(drill: Drill, browsing: AgeGroup): AgeGroup {
  for (let i = AGE_GROUPS.indexOf(browsing); i >= 0; i -= 1) {
    const age = AGE_GROUPS[i];
    if (isAvailableAt(drill, age)) return age;
  }
  return drill.minAge;
}

/**
 * Putting a drill into a session from the page where the coach decided to.
 *
 * The planner's own search was the only way in, which meant reading a drill,
 * remembering the title, going to Sessions and finding it again. The decision
 * gets made here, so the verb belongs here.
 *
 * Sessions the drill is not legal in are left out rather than shown and refused.
 * A coach browsing a grade above their own can reach a ruck drill. Dropping that
 * into their U8 session would put it in front of players who may not do it.
 */
function addPanel(drill: Drill): string {
  if (!addOpen) {
    return `
      <section class="hub-panel drill-add">
        <button type="button" class="hub-btn hub-btn-primary" id="drill-add">Add to a session</button>
      </section>`;
  }

  const all = currentUserId ? localPlans(currentUserId) : [];
  const usable = all.filter((plan) => isAvailableAt(drill, plan.ageGroup));
  const hidden = all.length - usable.length;
  // Named on the button rather than decided silently. A coach who was browsing
  // U8 and lands on a U10 session otherwise has no idea it happened. The editor
  // shows the grade as text with no way to change it either.
  const newPlanAge = gradeForNewPlan(drill, filters?.ageGroup ?? drill.minAge);

  return `
    <section class="hub-panel drill-add">
      <h3 id="drill-add-heading" tabindex="-1">Which session?</h3>
      ${
        usable.length === 0
          ? `<p class="hub-fineprint">${
              hidden > 0
                ? hidden === 1
                  ? "Your one session is for a grade that cannot do this drill."
                  : "None of your sessions are for a grade that can do this drill."
                : plansPulling
                  ? "Fetching your sessions…"
                  : "Nothing saved yet."
            }</p>`
          : `<ul class="add-plan-list">${usable
              .map(
                (plan) => `
                <li>
                  <button type="button" class="add-row" data-addto="${esc(plan.id)}">
                    <span class="add-row-body">
                      <span class="add-title">${esc(plan.title)}</span>
                      <span class="add-meta">
                        ${AGE_GROUP_LABELS[plan.ageGroup]} &middot;
                        ${plan.blocks.length} ${plan.blocks.length === 1 ? "block" : "blocks"} &middot;
                        ${plan.sessionMinutes} min
                      </span>
                    </span>
                  </button>
                </li>`,
              )
              .join("")}</ul>
             ${
               hidden > 0
                 ? `<p class="hub-fineprint">${hidden} more ${hidden === 1 ? "session is" : "sessions are"} for a grade that cannot do this drill.</p>`
                 : ""
             }`
      }
      <div class="add-plan-actions">
        <button type="button" class="hub-btn" id="drill-add-new" data-newplan="${newPlanAge}">
          Start a new ${AGE_GROUP_LABELS[newPlanAge]} session with it
        </button>
        <button type="button" class="hub-btn" id="drill-add-cancel">Not now</button>
      </div>
    </section>`;
}

function renderDetail(
  container: HTMLElement,
  drill: Drill,
  back: { href: string; label: string },
  /**
   * False when the panel below the drill is being reopened rather than the drill
   * being arrived at. The picker sits under the whole article, so scrolling back
   * to the title on every redraw took the coach away from the thing they tapped
   * and left it off the bottom of the screen. Same problem `draw()` in the
   * planner solves with its `redraw` flag.
   */
  scrollToTop = true,
): void {
  const ages = drill.maxAge
    ? `${AGE_GROUP_LABELS[drill.minAge]} to ${AGE_GROUP_LABELS[drill.maxAge]}`
    : `${AGE_GROUP_LABELS[drill.minAge]} and up`;

  container.innerHTML = `
    <p class="hub-back"><a href="${back.href}">${esc(back.label)}</a></p>
    <article class="drill-detail">
      <div class="drill-detail-body hub-panel">
        <div class="drill-card-head">
          <h2>${esc(drill.title)}</h2>
          <span class="drill-kind drill-kind-${drill.kind}">${drill.kind === "warmup" ? "Warm-up" : "Exercise"}</span>
          ${favButton(drill)}
        </div>
        <p class="drill-themes">${drill.themes.map((t) => esc(THEME_LABELS[t])).join(" · ")}</p>

        ${drill.safety ? `<div class="drill-safety"><h3>Safety</h3><p>${esc(drill.safety)}</p></div>` : ""}

        <h3>Set up</h3>
        <p>${esc(drill.setup)}</p>
        ${drill.diagram ? renderDiagram(drill.diagram) : ""}

        <h3>How it runs</h3>
        <p>${esc(drill.howItRuns)}</p>

        <h3>Coaching points</h3>
        <ul>${drill.coachingPoints.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>

        ${list("Make it harder", drill.progressions)}
        ${list("Make it easier", drill.regressions)}
      </div>

      <aside class="drill-detail-aside hub-panel">
        <h3>At a glance</h3>
        <dl class="drill-facts">
          <div>
            <dt>Age grade</dt>
            <dd>
              ${esc(ages)}<br />
              ${ageRulesLink(AGE_GROUP_LABELS[drill.minAge], RULES_OF_PLAY[drill.minAge], "rules-link rules-link-sm")}
            </dd>
          </div>
          <div><dt>Time</dt><dd>${drill.minutes} min</dd></div>
          <div><dt>Players</dt><dd>${playersLabel(drill)}</dd></div>
          <div><dt>Space</dt><dd>${esc(drill.space)}</dd></div>
          <div><dt>Kit</dt><dd>${esc(drill.equipment.map(kitLabel).join(", ")) || "none"}</dd></div>
        </dl>
      </aside>
    </article>

    ${addPanel(drill)}`;

  for (const button of container.querySelectorAll<HTMLButtonElement>("[data-fav]")) {
    button.addEventListener("click", () => {
      toggleStar(button.dataset.fav ?? "", () => renderDetail(container, drill, back, false));
    });
  }

  const reopen = (): void => renderDetail(container, drill, back, false);

  container.querySelector("#drill-add")?.addEventListener("click", () => {
    // A session has to persist, so signed out this is the moment to ask. Same
    // answer the star gives, for the same reason.
    if (!currentUserId) {
      go("join/plans");
      return;
    }
    addOpen = true;
    // Asked for on opening rather than on every catalogue visit. The list is
    // only needed here. A coach who has been to Sessions already has it.
    if (plansPulledFor !== currentUserId) {
      plansPulledFor = currentUserId;
      plansPulling = true;
      const pulledFor = currentUserId;
      void syncPlans(currentUserId).then((result) => {
        plansPulling = false;
        // Only counted as asked when it actually got there. A first open with no
        // signal would otherwise latch for the whole tab, so the panel would keep
        // saying the coach has no sessions long after the signal came back. That
        // is the failure this pull exists to prevent.
        if (!result.reachedServer) plansPulledFor = null;
        // Checked now rather than remembered. The coach may have closed the
        // picker or walked to another drill while this was in the air.
        if (addOpen && currentUserId === pulledFor && currentRoute().param === drill.id) {
          reopen();
        }
      });
    }
    reopen();
    // The button that was just pressed no longer exists, so without this focus
    // drops to the body and the next Tab starts again from the top of the page.
    container.querySelector<HTMLElement>("#drill-add-heading")?.focus({ preventScroll: true });
  });

  container.querySelector("#drill-add-cancel")?.addEventListener("click", () => {
    addOpen = false;
    reopen();
  });

  const newPlan = container.querySelector<HTMLButtonElement>("#drill-add-new");
  newPlan?.addEventListener("click", () => {
    // Read back off the button, so the grade created is the one the coach was
    // just told about rather than one worked out a second time
    const ageGroup = newPlan.dataset.newplan ?? "";
    if (isAgeGroup(ageGroup)) newPlanWithDrill(currentUserId, ageGroup, drill);
  });

  for (const button of container.querySelectorAll<HTMLButtonElement>("[data-addto]")) {
    button.addEventListener("click", () => {
      const title = addDrillToPlan(currentUserId, button.dataset.addto ?? "", drill);
      if (!title) return;
      addOpen = false;
      reopen();
      showToast(`Added to ${title}.`);
    });
  }

  if (scrollToTop) container.querySelector<HTMLElement>("h2")?.scrollIntoView({ block: "start" });
}

function list(heading: string, items?: string[]): string {
  if (!items?.length) return "";
  return `<h3>${esc(heading)}</h3><ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
}
