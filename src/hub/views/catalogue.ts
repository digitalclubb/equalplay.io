import { esc } from "../../lib/esc.js";
import { ageRulesLink, rulesLink } from "../../lib/rulesLink.js";
import { go, stillOn } from "../router.js";
import { currentRoute } from "../router.js";
import {
  localFavourites,
  syncFavourite,
  syncFavourites,
  toggleFavourite,
} from "../favourites.js";
import { DRILLS, filterDrills, findDrill, type DrillFilter } from "../content/drills.js";
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
 * Filters live here rather than in the URL so they survive the trip into a drill
 * and back out. A coach browsing U10 rucking should not lose that when they tap
 * a drill to read it.
 *
 * `seededFor` is what keeps the age gate honest across a profile change. Without
 * it, a coach who signs up as U12 by mistake and corrects it to U8 on the Account
 * page would come back to a catalogue still listing rucks and lineouts. The very
 * thing content-age-gate.test.ts exists to prevent, defeated one layer above the
 * function it tests. Same story for a second coach signing in on a shared device.
 */
let filters: DrillFilter | null = null;
let seededFor: AgeGroup | null = null;
let favourites: Set<string> = new Set();
let currentUserId = "";
let pulledFor: string | null = null;

const WELCOME_KEY = "equalplay_hub_welcomed";

/** Called on sign-out, so a shared tablet greets the next coach properly. */
export function forgetWelcome(): void {
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
        players are allowed to do. Tackling shows up at U9, rucks and scrums at U10,
        lineouts at U12.
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

  // Pull the server's list once per visit, then redraw if it differs
  if (!pulledFor || pulledFor !== userId) {
    pulledFor = userId;
    void syncFavourites(userId).then((result) => {
      favourites = result.ids;
      // Checked now rather than remembered from when this started. The coach may
      // be three views away by the time a slow sync comes back.
      if (stillOn("catalogue") && !currentRoute().param) renderList(container);
    });
  }

  if (drillId) {
    const drill = findDrill(drillId);
    if (drill) {
      renderDetail(container, drill, backLink(origin));
      return;
    }
    // Stale link, e.g. a bookmark from before a drill was renamed
    go("catalogue");
    return;
  }

  renderList(container);
}

// ---- List ----

function renderList(container: HTMLElement): void {
  const active = filters as DrillFilter;
  const results = filterDrills(DRILLS, { ...active, favourites });

  container.innerHTML = `
    ${welcome(AGE_GROUP_LABELS[active.ageGroup])}
    <section class="hub-panel hub-filters">
      <div class="hub-field">
        <label for="f-search" class="visually-hidden">Search drills</label>
        <input id="f-search" type="search" value="${esc(active.search ?? "")}" placeholder="Search ruck, passing, tag…" />
      </div>

      <div class="chip-scroll-wrap">
      <div class="chip-scroll" role="group" aria-label="What you're working on">
        <button type="button" id="f-fav" class="chip-filter chip-fav${active.onlyFavourites ? " is-active" : ""}" aria-pressed="${Boolean(active.onlyFavourites)}">
          ${star(Boolean(active.onlyFavourites))} Favourites${favourites.size > 0 ? ` (${favourites.size})` : ""}
        </button>
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
        : `<div class="drill-list">${results.map(card).join("")}</div>`
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
    update({ onlyFavourites: !active.onlyFavourites });
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
    renderList(container);
  });

  function update(patch: Partial<DrillFilter>, after?: () => void): void {
    filters = { ...active, ...patch };
    renderList(container);
    after?.();
  }
}

function countLabel(count: number, filter: DrillFilter): string {
  const age = AGE_GROUP_LABELS[filter.ageGroup];
  if (count === 0) return `Nothing for ${age} matches that.`;
  if (filter.onlyFavourites) {
    return count === 1
      ? `One favourite your ${age} squad can do.`
      : `${count} favourites your ${age} squad can do.`;
  }
  return `${count} ${count === 1 ? "drill" : "drills"} your ${age} squad can do.`;
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
function card(drill: Drill): string {
  return `
    <article class="drill-card">
      <span class="drill-card-head">
        <a class="drill-card-title drill-card-link" href="#/catalogue/${esc(drill.id)}">${esc(drill.title)}</a>
        <span class="drill-kind drill-kind-${drill.kind}">${drill.kind === "warmup" ? "Warm-up" : "Exercise"}</span>
        ${favButton(drill)}
      </span>
      <span class="drill-meta">
        ${drill.minutes} min · ${playersLabel(drill)} · ${esc(drill.space)}
      </span>
      <span class="drill-themes">${drill.themes.map((t) => esc(THEME_LABELS[t])).join(" · ")}</span>
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
  return { href: "#/catalogue", label: "← Back to drills" };
}

function renderDetail(
  container: HTMLElement,
  drill: Drill,
  back: { href: string; label: string },
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
    </article>`;

  for (const button of container.querySelectorAll<HTMLButtonElement>("[data-fav]")) {
    button.addEventListener("click", () => {
      toggleStar(button.dataset.fav ?? "", () => renderDetail(container, drill, back));
    });
  }

  container.querySelector<HTMLElement>("h2")?.scrollIntoView({ block: "start" });
}

function list(heading: string, items?: string[]): string {
  if (!items?.length) return "";
  return `<h3>${esc(heading)}</h3><ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
}
