import { SubstitutionType } from "../types/index.js";
import type { Player, ValidationErrors } from "../types/index.js";
import { createPlayerList } from "./playerList.js";

export interface FormHandle {
  element: HTMLElement;
  getPlayers: () => Player[];
  getPlayersPerTeam: () => number;
  getNumberOfGames: () => number;
  getSubstitutionType: () => SubstitutionType;
  showErrors: (errors: ValidationErrors) => void;
  clearErrors: () => void;
  setLoading: (loading: boolean) => void;
}

/**
 * Squad-first panel. Players as chips + collapsible match settings.
 * Auto-generates on every change — no explicit "Generate" button.
 */
export function createForm(onChange: (handle: FormHandle) => void): FormHandle {
  const section = document.createElement("section");
  section.className = "squad-panel";

  // Squad header
  const squadHeader = document.createElement("div");
  squadHeader.className = "squad-header";
  squadHeader.innerHTML = `<h2>Squad</h2>`;
  section.appendChild(squadHeader);

  // Player chips
  const playerList = createPlayerList();
  section.appendChild(playerList.element);

  const playerError = document.createElement("div");
  playerError.className = "field-error";
  playerError.id = "error-players";
  playerList.element.appendChild(playerError);

  // Match settings — collapsible
  const settingsToggle = document.createElement("button");
  settingsToggle.type = "button";
  settingsToggle.className = "settings-toggle";
  settingsToggle.innerHTML = `Match settings <span class="settings-toggle-icon">&#9662;</span>`;
  section.appendChild(settingsToggle);

  const settingsPanel = document.createElement("div");
  settingsPanel.className = "settings-panel";
  settingsPanel.hidden = true;
  settingsPanel.innerHTML = `
    <div class="setup-config">
      <div class="setup-field">
        <label for="players-per-team">On field</label>
        <input id="players-per-team" type="number" min="1" value="5" />
        <div class="field-error" id="error-playersPerTeam"></div>
      </div>
      <div class="setup-field">
        <label for="num-games">Games</label>
        <input id="num-games" type="number" min="1" value="3" />
        <div class="field-error" id="error-numberOfGames"></div>
      </div>
      <div class="setup-field">
        <label for="sub-type">Subs</label>
        <select id="sub-type">
          <option value="${SubstitutionType.None}">None</option>
          <option value="${SubstitutionType.Halftime}">Halftime</option>
          <option value="${SubstitutionType.Rolling}">Rolling</option>
        </select>
      </div>
    </div>
  `;
  section.appendChild(settingsPanel);

  settingsToggle.addEventListener("click", () => {
    settingsPanel.hidden = !settingsPanel.hidden;
    const icon = settingsToggle.querySelector(".settings-toggle-icon");
    if (icon) icon.textContent = settingsPanel.hidden ? "\u25BE" : "\u25B4";
  });

  // Auto-generate: listen to config changes
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  function scheduleGenerate(): void {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => onChange(handle), 200);
  }

  // Wire up config change listeners
  settingsPanel.addEventListener("input", scheduleGenerate);
  settingsPanel.addEventListener("change", scheduleGenerate);

  // Wire up player add/remove — use MutationObserver on the chip area
  const chipArea = playerList.element.querySelector(".player-chips");
  if (chipArea) {
    const observer = new MutationObserver(scheduleGenerate);
    observer.observe(chipArea, { childList: true });
  }

  const handle: FormHandle = {
    element: section,
    getPlayers: playerList.getPlayers,

    getPlayersPerTeam() {
      return parseInt(
        (settingsPanel.querySelector("#players-per-team") as HTMLInputElement).value,
      );
    },

    getNumberOfGames() {
      return parseInt(
        (settingsPanel.querySelector("#num-games") as HTMLInputElement).value,
      );
    },

    getSubstitutionType() {
      return (settingsPanel.querySelector("#sub-type") as HTMLSelectElement)
        .value as SubstitutionType;
    },

    showErrors(errors: ValidationErrors) {
      handle.clearErrors();
      for (const [field, message] of Object.entries(errors)) {
        const el = section.querySelector(`#error-${field}`);
        if (el) el.textContent = message;
      }
      if (errors.playersPerTeam) {
        settingsPanel.querySelector("#players-per-team")?.classList.add("input-error");
      }
      if (errors.numberOfGames) {
        settingsPanel.querySelector("#num-games")?.classList.add("input-error");
      }
    },

    clearErrors() {
      section.querySelectorAll(".field-error").forEach((el) => {
        el.textContent = "";
      });
      section.querySelectorAll(".input-error").forEach((el) => {
        el.classList.remove("input-error");
      });
    },

    setLoading() {
      // No loading state needed — generation is instant
    },
  };

  return handle;
}
