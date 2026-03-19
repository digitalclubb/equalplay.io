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
 * Squad panel with player chips, always-visible match settings,
 * and a "Generate rotation" button.
 */
export function createForm(onSubmit: (handle: FormHandle) => void): FormHandle {
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

  // Match settings — always visible
  const settingsLabel = document.createElement("div");
  settingsLabel.className = "settings-label";
  settingsLabel.innerHTML = `<h2>Match settings</h2>`;
  section.appendChild(settingsLabel);

  const settingsPanel = document.createElement("div");
  settingsPanel.className = "settings-panel";
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

  // Generate button
  const submitBtn = document.createElement("button");
  submitBtn.type = "button";
  submitBtn.className = "btn-generate";
  submitBtn.textContent = "Generate rotation";
  submitBtn.addEventListener("click", () => {
    onSubmit(handle);
  });
  section.appendChild(submitBtn);

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

    setLoading(loading: boolean) {
      submitBtn.disabled = loading;
      submitBtn.textContent = loading ? "Generating..." : "Generate rotation";
    },
  };

  return handle;
}
