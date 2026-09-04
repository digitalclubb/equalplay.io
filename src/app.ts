import { navHtml } from "./lib/nav.js";
import { transition } from "./lib/motion.js";
import { createForm } from "./components/form.js";
import type { FormHandle } from "./components/form.js";
import { createLogo } from "./components/logo.js";
import { renderResults } from "./components/results.js";
import type { ResultsCallbacks } from "./components/results.js";
import { renderTeamTabs } from "./components/teamTabs.js";
import { showToast } from "./components/toast.js";
import {
  generateInitialPlan,
  applyEvents,
} from "./logic/rotation.js";
import {
  saveTeams,
  loadTeams,
} from "./logic/storage.js";
import { TeamStore } from "./logic/teamState.js";
import { validateInputs, hasErrors } from "./logic/validate.js";
import type {
  Player,
  RotationEvent,
} from "./types/index.js";

// ---- App ----

export function mountApp(root: HTMLElement): void {
  // Header bar is static HTML in index.html for instant LCP.
  // Adopt existing elements; fall back to creating them if missing.
  let headerBar = document.getElementById("header-bar");
  let tabsContainer: HTMLElement | null = document.getElementById("tabs-container");

  if (!headerBar) {
    headerBar = document.createElement("div");
    headerBar.className = "header-bar";

    const header = document.createElement("header");
    header.className = "app-header";
    header.innerHTML = createLogo();
    headerBar.appendChild(header);

    // Same nav as the static markup, from the same module, so this fallback
    // cannot quietly drop a coach out of the rest of the app.
    const appNav = document.createElement("nav");
    appNav.className = "hub-nav";
    appNav.setAttribute("aria-label", "Sections");
    appNav.innerHTML = navHtml("planner", "/hub");
    headerBar.appendChild(appNav);

    root.appendChild(headerBar);
  }

  if (!tabsContainer) {
    tabsContainer = document.createElement("nav");
    tabsContainer.setAttribute("aria-label", "Teams");
    // Into the planner's own view, above its inputs, matching the markup
    root.prepend(tabsContainer);
  }

  const tabs = tabsContainer as HTMLElement;

  const resultsContainer = document.createElement("div");
  resultsContainer.id = "results";

  // Multi-team state
  const store = new TeamStore();
  let previousEvents: RotationEvent[] | null = null;

  // ---- Persistence ----

  function persist(): void {
    saveTeams(store.buildSavedData());
  }

  // ---- Rendering ----

  function renderTabs(): void {
    renderTeamTabs(
      tabs,
      store.teams.map((t) => ({ id: t.id, name: t.name })),
      store.activeTeamId,
      {
        onSelect(teamId) {
          saveDraft();
          // The one place on match day that is navigation rather than a change
          // to what is being run. The pill slides to the team you picked and the
          // squad under it crosses over. Nothing else here is animated. A
          // substitution has to land the instant it is tapped, so a rotation
          // table that slides is a rotation table a coach waits for.
          transition("tabs", () => {
            store.activeTeamId = teamId;
            previousEvents = null;
            rerenderAll();
            persist();
          });
        },
        onAdd() {
          saveDraft();
          const team = store.addTeam();
          previousEvents = null;
          rerenderAll();
          persist();
          showToast(`${team.name} created.`);
        },
        onDelete(teamId) {
          if (!store.deleteTeam(teamId)) return;
          previousEvents = null;
          rerenderAll();
          persist();
          showToast("Team deleted.");
        },
        onRename(teamId, newName) {
          if (store.renameTeam(teamId, newName)) {
            renderTabs();
            persist();
          }
        },
      },
    );
  }

  /** Convert string-keyed overrides to number-keyed for the logic layer */
  function numericOverrides(overrides: Record<string, number>): Record<number, number> | undefined {
    const keys = Object.keys(overrides);
    if (keys.length === 0) return undefined;
    const out: Record<number, number> = {};
    for (const k of keys) out[Number(k)] = overrides[k];
    return out;
  }

  function rerenderResults(): void {
    const team = store.getActive();
    if (!team.initialPlan) {
      resultsContainer.innerHTML = "";
      return;
    }

    const overrides = numericOverrides(team.teamSizeOverrides);
    const needsRecompute = team.events.length > 0 || overrides;
    const plan = needsRecompute
      ? applyEvents(
          team.initialPlan,
          team.events,
          team.originalPlayerIds,
          team.playersPerTeam,
          team.currentGame,
          overrides,
        )
      : team.initialPlan;

    renderResults(
      resultsContainer,
      plan,
      team.playerMap,
      team.playersPerTeam,
      team.events,
      team.originalPlayerIds,
      team.currentGame,
      team.gameLabels,
      buildCallbacks(),
      false,
      team.matchMode,
      team.teamSizeOverrides,
      team.minutesPerMatch,
    );
  }

  function rerenderAll(): void {
    rebuildForm();
    renderTabs();
    rerenderResults();
  }

  // ---- Actions ----

  function undo(): void {
    const team = store.getActive();
    if (!team.initialPlan || previousEvents === null) return;
    team.events = previousEvents;
    previousEvents = null;
    rerenderResults();
    persist();
    showToast("Undone");
  }

  function applyAction(mutate: () => void): void {
    const team = store.getActive();
    if (!team.initialPlan) return;
    previousEvents = [...team.events];
    mutate();
    rerenderResults();
    persist();
  }

  function getName(playerId: string): string {
    return store.getActive().playerMap.get(playerId)?.name ?? "Player";
  }

  // ---- Callbacks ----

  function buildCallbacks(): ResultsCallbacks {
    return {
      onMarkLate(playerId) {
        const name = getName(playerId);
        applyAction(() => {
          const team = store.getActive();
          team.events = team.events.filter((e) => !("playerId" in e && e.playerId === playerId));
          team.events.push({ type: "late", playerId });
        });
        showToast(`${name} isn't here yet. Rotation updated.`, undo);
      },

      onMarkInjured(playerId, gameNumber) {
        const name = getName(playerId);
        applyAction(() => {
          const team = store.getActive();
          team.events = team.events.filter((e) => !("playerId" in e && e.playerId === playerId));
          team.events.push({ type: "injured", playerId, gameNumber });
        });
        showToast(`${name} injured. Use Make sub to replace.`, undo);
      },

      onMarkJoined(playerId) {
        const name = getName(playerId);
        applyAction(() => {
          store.getActive().events.push({ type: "joined", playerId, duringGame: store.getActive().currentGame });
        });
        showToast(`${name} has arrived and is on the bench.`, undo);
      },

      onMarkLeaving(playerId, afterGame) {
        const name = getName(playerId);
        applyAction(() => {
          const team = store.getActive();
          // Remove any existing leaving event for this player
          team.events = team.events.filter(
            (e) => !(e.type === "leaving" && e.playerId === playerId),
          );
          team.events.push({ type: "leaving", playerId, afterGame });
        });
        showToast(`${name} leaves after game ${afterGame}. Rotation updated.`, undo);
      },

      onClearStatus(playerId) {
        const name = getName(playerId);
        applyAction(() => {
          const team = store.getActive();
          team.events = team.events.filter((e) => !("playerId" in e && e.playerId === playerId));
        });
        showToast(`${name} is back in the rotation.`, undo);
      },

      onTeamSizeChange(gameNumber, size) {
        const team = store.getActive();
        if (size === team.playersPerTeam) {
          delete team.teamSizeOverrides[String(gameNumber)];
        } else {
          team.teamSizeOverrides[String(gameNumber)] = size;
        }
        rerenderResults();
        persist();
      },

      onGameLabelChange(gameNumber, label) {
        const team = store.getActive();
        if (label) {
          team.gameLabels[String(gameNumber)] = label;
        } else {
          delete team.gameLabels[String(gameNumber)];
        }
        persist();
      },

      onMakeSub(gameNumber, playerOut, playerIn) {
        const outName = getName(playerOut);
        const inName = getName(playerIn);
        applyAction(() => {
          store.getActive().events.push({ type: "sub", gameNumber, playerOut, playerIn });
        });
        showToast(`${inName} on for ${outName}.`, undo);
      },

      onNextGame() {
        const team = store.getActive();
        if (!team.initialPlan) return;
        const totalGames = team.initialPlan.games.length;
        if (team.currentGame > totalGames) return;
        const nextNum = team.currentGame + 1;
        team.currentGame = nextNum;
        rerenderResults();
        persist();
        if (nextNum > totalGames) {
          showToast("All games completed.");
        } else {
          showToast(`Game ${nextNum} is now live.`);
        }
      },

      onPrevGame() {
        const team = store.getActive();
        if (!team.initialPlan) return;
        if (team.currentGame <= 1) return;
        const prevNum = team.currentGame - 1;
        team.currentGame = prevNum;
        rerenderResults();
        persist();
        showToast(`Back to game ${prevNum}.`);
      },

      onStartMatch() {
        const team = store.getActive();
        team.matchMode = "live";
        rerenderResults();
        persist();
        showToast("Game 1 is live.");
      },

      onStartNew() {
        const team = store.getActive();
        team.initialPlan = null;
        team.events = [];
        team.currentGame = 1;
        team.gameLabels = {};
        team.matchMode = "setup";
        team.teamSizeOverrides = {};
        team.playerMap = new Map();
        team.originalPlayerIds = [];
        previousEvents = null;
        resultsContainer.innerHTML = "";

        persist();
        showToast("Session cleared.");
      },
    };
  }

  // ---- Generate ----

  function generate(handle: FormHandle): void {
    handle.clearErrors();
    resultsContainer.innerHTML = "";
    previousEvents = null;

    const players = handle.getPlayers();
    const playersPerTeam = handle.getPlayersPerTeam();
    const numberOfGames = handle.getNumberOfGames();
    const minutesPerMatch = handle.getMinutesPerMatch();

    const errors = validateInputs(
      players.length,
      playersPerTeam,
      numberOfGames,
      minutesPerMatch,
    );
    if (hasErrors(errors)) {
      handle.showErrors(errors);
      return;
    }

    const playerMap = new Map<string, Player>(
      players.map((p) => [p.id, p]),
    );

    handle.setLoading(true);
    setTimeout(() => {
      const plan = generateInitialPlan({ players, playersPerTeam, numberOfGames });
      const team = store.getActive();

      team.initialPlan = plan;
      team.originalPlayerIds = players.map((p) => p.id);
      team.playersPerTeam = playersPerTeam;
      team.numberOfGames = numberOfGames;
      team.minutesPerMatch = minutesPerMatch;
      team.playerMap = playerMap;
      team.events = [];
      team.currentGame = 1;
      team.gameLabels = {};
      team.matchMode = "setup";
      team.teamSizeOverrides = {};

      rerenderResults();
      persist();
      handle.setLoading(false);

      // Bring the rotation into view. The squad, the settings and the button
      // itself fill a phone, so the first game landed about 630px down an 844px
      // screen: you tapped the one big button on the page and almost nothing
      // moved. Only this path scrolls. A substitution has to land where the
      // thumb already is, which is why `rerenderResults` does not do it.
      resultsContainer.scrollIntoView({
        block: "start",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
    }, 200);
  }

  // Form container. Rebuilt on every team switch so inputs are fresh
  const formContainer =
    document.getElementById("main-content") ??
    document.createElement("div");
  formContainer.id = "main-content";
  let currentFormHandle: { getRawNames: () => string[] } | null = null;

  /** Save current form inputs to the active team's draft before switching */
  function saveDraft(): void {
    if (currentFormHandle) {
      store.getActive().draftPlayerNames = currentFormHandle.getRawNames();
    }
  }

  function rebuildForm(): void {
    formContainer.innerHTML = "";
    const team = store.getActive();
    const form = createForm(generate, team.draftPlayerNames, {
      playersPerTeam: team.playersPerTeam,
      numberOfGames: team.numberOfGames,
      minutesPerMatch: team.minutesPerMatch,
    });
    currentFormHandle = form;
    formContainer.appendChild(form.element);
  }

  // ---- Restore ----

  const saved = loadTeams();
  if (saved) {
    store.restoreFrom(saved);
  }

  // ---- Mount ----

  root.appendChild(formContainer);
  root.appendChild(resultsContainer);
  rerenderAll();
}
