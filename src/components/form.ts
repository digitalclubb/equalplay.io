import { SubstitutionType } from "../types/index.js";

/** Builds the input form and returns a reference to the container element */
export function createForm(onSubmit: (form: HTMLFormElement) => void): HTMLElement {
  const section = document.createElement("section");
  section.innerHTML = `
    <form id="rotation-form">
      <div class="form-group">
        <label for="players">Player names (one per line)</label>
        <textarea id="players" placeholder="Alice\nBob\nCharlie\n..."></textarea>
      </div>

      <div class="form-group">
        <label for="players-per-team">Players per team on field</label>
        <input id="players-per-team" type="number" min="1" value="5" />
      </div>

      <div class="form-group">
        <label for="num-games">Number of games</label>
        <input id="num-games" type="number" min="1" value="3" />
      </div>

      <div class="form-group">
        <label for="sub-type">Substitution type</label>
        <select id="sub-type">
          <option value="${SubstitutionType.None}">None</option>
          <option value="${SubstitutionType.Halftime}">Halftime</option>
          <option value="${SubstitutionType.Rolling}">Rolling</option>
        </select>
      </div>

      <button type="submit">Generate Rotation</button>
    </form>
  `;

  const form = section.querySelector("form")!;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    onSubmit(form);
  });

  return section;
}
