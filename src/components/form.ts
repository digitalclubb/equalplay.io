import type { Player, ValidationErrors } from "../types/index.js";
import { createPlayerList } from "./playerList.js";
import { iconSquad, iconSettings, iconGenerate } from "./icons.js";

/** What the settings panel starts on, so a reload comes back as it was left. */
export interface FormSettings {
  playersPerTeam: number;
  numberOfGames: number;
  minutesPerMatch: number | null;
}

export interface FormHandle {
  element: HTMLElement;
  getPlayers: () => Player[];
  getPlayersPerTeam: () => number;
  getNumberOfGames: () => number;
  /** Null when the coach has not said, which is allowed. */
  getMinutesPerMatch: () => number | null;
  /** Read all raw input values (including empty ones) */
  getRawNames: () => string[];
  showErrors: (errors: ValidationErrors) => void;
  clearErrors: () => void;
  setLoading: (loading: boolean) => void;
}

export function createForm(
  onSubmit: (handle: FormHandle) => void,
  initialNames?: string[],
  settings?: FormSettings,
): FormHandle {
  const section = document.createElement("section");
  section.className = "squad-panel";

  const squadHeader = document.createElement("div");
  squadHeader.className = "squad-header";
  squadHeader.innerHTML = `<h2>${iconSquad} Team</h2>`;
  section.appendChild(squadHeader);

  const playerList = createPlayerList(initialNames);
  section.appendChild(playerList.element);

  const playerError = document.createElement("div");
  playerError.className = "field-error";
  playerError.id = "error-players";
  playerList.element.appendChild(playerError);

  const settingsLabel = document.createElement("div");
  settingsLabel.className = "settings-label";
  settingsLabel.innerHTML = `<h2>${iconSettings} Match settings</h2>`;
  section.appendChild(settingsLabel);

  const settingsPanel = document.createElement("div");
  settingsPanel.className = "settings-panel";
  // The saved values, not the defaults. These were hard-coded, so a reload put
  // 7 and 3 back in the boxes while the results below them were built from
  // whatever the coach had actually typed.
  const startsOn: FormSettings = settings ?? {
    playersPerTeam: 7,
    numberOfGames: 3,
    minutesPerMatch: null,
  };

  settingsPanel.innerHTML = `
    <div class="setup-config setup-config-2col">
      <div class="setup-field">
        <label for="players-per-team">Players per team</label>
        <input id="players-per-team" type="number" min="1" value="${startsOn.playersPerTeam}" />
        <div class="field-error" id="error-playersPerTeam"></div>
      </div>
      <div class="setup-field">
        <label for="num-games">Number of matches</label>
        <input id="num-games" type="number" min="1" value="${startsOn.numberOfGames}" />
        <div class="field-error" id="error-numberOfGames"></div>
      </div>
      <div class="setup-field">
        <label for="minutes-per-match">Minutes a match</label>
        <input id="minutes-per-match" type="number" min="1" inputmode="numeric"
               placeholder="Optional"
               value="${startsOn.minutesPerMatch ?? ""}" />
        <div class="field-error" id="error-minutesPerMatch"></div>
      </div>
    </div>
  `;
  section.appendChild(settingsPanel);

  const submitBtn = document.createElement("button");
  submitBtn.type = "button";
  submitBtn.className = "btn-generate";
  submitBtn.innerHTML = `${iconGenerate} Sort my team`;
  submitBtn.addEventListener("click", () => {
    onSubmit(handle);
  });
  section.appendChild(submitBtn);

  const handle: FormHandle = {
    element: section,
    getPlayers: playerList.getPlayers,
    getRawNames: playerList.getRawNames,

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

    getMinutesPerMatch() {
      // Blank is the default and has to stay blank. `parseInt("")` is NaN,
      // which would then fail validation on a field nobody filled in.
      const raw = (settingsPanel.querySelector("#minutes-per-match") as HTMLInputElement).value;
      return raw.trim() === "" ? null : Number(raw);
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
      if (errors.minutesPerMatch) {
        settingsPanel.querySelector("#minutes-per-match")?.classList.add("input-error");
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

    setLoading(loading: boolean) {
      submitBtn.disabled = loading;
      submitBtn.innerHTML = loading ? "Sorting..." : `${iconGenerate} Sort my team`;
    },
  };

  return handle;
}
