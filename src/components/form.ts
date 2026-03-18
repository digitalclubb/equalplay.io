import { SubstitutionType } from "../types/index.js";
import { createPlayerList } from "./playerList.js";

export interface FormHandle {
  element: HTMLElement;
  getPlayerNames: () => string[];
}

/** Builds the input form with dynamic player list */
export function createForm(onSubmit: (handle: FormHandle) => void): FormHandle {
  const section = document.createElement("section");
  const form = document.createElement("form");
  form.id = "rotation-form";

  // Dynamic player inputs
  const playerList = createPlayerList();
  form.appendChild(playerList.element);

  // Remaining config fields rendered as static HTML
  const configHTML = document.createElement("div");
  configHTML.innerHTML = `
    <div class="form-row">
      <div class="form-group">
        <label for="players-per-team">Players on field</label>
        <input id="players-per-team" type="number" min="1" value="5" />
      </div>
      <div class="form-group">
        <label for="num-games">Number of games</label>
        <input id="num-games" type="number" min="1" value="3" />
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
  submitBtn.textContent = "Generate Rotation";
  form.appendChild(submitBtn);

  section.appendChild(form);

  const handle: FormHandle = {
    element: section,
    getPlayerNames: playerList.getPlayerNames,
  };

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    onSubmit(handle);
  });

  return handle;
}
