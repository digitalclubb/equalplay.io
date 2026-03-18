import { SubstitutionType } from "../types/index.js";
import type { ValidationErrors } from "../types/index.js";
import { createPlayerList } from "./playerList.js";

export interface FormHandle {
  element: HTMLElement;
  getPlayerNames: () => string[];
  getPlayersPerTeam: () => number;
  getNumberOfGames: () => number;
  getSubstitutionType: () => SubstitutionType;
  showErrors: (errors: ValidationErrors) => void;
  clearErrors: () => void;
  setLoading: (loading: boolean) => void;
}

/** Builds the input form with dynamic player list */
export function createForm(onSubmit: (handle: FormHandle) => void): FormHandle {
  const section = document.createElement("section");
  const form = document.createElement("form");
  form.id = "rotation-form";

  // Dynamic player inputs
  const playerList = createPlayerList();
  form.appendChild(playerList.element);

  // Error slot for player-level errors
  const playerError = document.createElement("div");
  playerError.className = "field-error";
  playerError.id = "error-players";
  playerList.element.appendChild(playerError);

  // Config fields
  const configHTML = document.createElement("div");
  configHTML.className = "form-section";
  configHTML.innerHTML = `
    <div class="form-row">
      <div class="form-group">
        <label for="players-per-team">Players on field</label>
        <input id="players-per-team" type="number" min="1" value="5" />
        <div class="field-error" id="error-playersPerTeam"></div>
      </div>
      <div class="form-group">
        <label for="num-games">Number of games</label>
        <input id="num-games" type="number" min="1" value="3" />
        <div class="field-error" id="error-numberOfGames"></div>
      </div>
    </div>

    <div class="form-group">
      <label for="sub-type">Substitution type</label>
      <select id="sub-type">
        <option value="${SubstitutionType.None}">None</option>
        <option value="${SubstitutionType.Halftime}">Halftime</option>
        <option value="${SubstitutionType.Rolling}">Rolling</option>
      </select>
    </div>
  `;
  form.appendChild(configHTML);

  const submitBtn = document.createElement("button");
  submitBtn.type = "submit";
  submitBtn.id = "submit-btn";
  submitBtn.textContent = "Generate Rotation";
  form.appendChild(submitBtn);

  section.appendChild(form);

  const handle: FormHandle = {
    element: section,
    getPlayerNames: playerList.getPlayerNames,

    getPlayersPerTeam() {
      return parseInt(
        (form.querySelector("#players-per-team") as HTMLInputElement).value,
      );
    },

    getNumberOfGames() {
      return parseInt(
        (form.querySelector("#num-games") as HTMLInputElement).value,
      );
    },

    getSubstitutionType() {
      return (form.querySelector("#sub-type") as HTMLSelectElement)
        .value as SubstitutionType;
    },

    showErrors(errors: ValidationErrors) {
      // Clear previous errors first
      handle.clearErrors();

      for (const [field, message] of Object.entries(errors)) {
        const el = form.querySelector(`#error-${field}`);
        if (el) el.textContent = message;
      }

      // Mark inputs with errors visually
      if (errors.playersPerTeam) {
        form.querySelector("#players-per-team")?.classList.add("input-error");
      }
      if (errors.numberOfGames) {
        form.querySelector("#num-games")?.classList.add("input-error");
      }
    },

    clearErrors() {
      form.querySelectorAll(".field-error").forEach((el) => {
        el.textContent = "";
      });
      form.querySelectorAll(".input-error").forEach((el) => {
        el.classList.remove("input-error");
      });
    },

    setLoading(loading: boolean) {
      submitBtn.disabled = loading;
      submitBtn.textContent = loading ? "Generating..." : "Generate Rotation";
    },
  };

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    onSubmit(handle);
  });

  return handle;
}
