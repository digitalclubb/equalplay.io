import { AGE_GROUPS, AGE_GROUP_LABELS, isAgeGroup, type AgeGroup } from "../content/types.js";
import { chooseAge, coachedAges } from "../ageChoice.js";
import { esc } from "../../lib/esc.js";

/**
 * The control that says which grade the app is set to, plus changes it.
 *
 * One value behind it, read by every tab. The catalogue used to hold a grade
 * of its own in a filter that was never written down, so Drills could say U7
 * while Sessions offered U10, match day started an eight a side squad and
 * nothing on screen said why.
 *
 * The coach's own grades come first, then the rest under a heading that says
 * what picking one does. Offering only the grades already claimed would be the
 * tidier list and the wrong one: a coach going up in September needs a grade
 * that is not on it yet. The other place to add one is the account page,
 * which a signed-out coach cannot reach at all. Picking from the second group
 * adds it, so the list builds itself out of what a coach actually does.
 *
 * A `select` rather than a menu of our own. It is the control a phone already
 * knows how to open, it names itself to a screen reader for nothing, plus
 * `optgroup` is the one native way to say "yours" and "the others" in a list
 * this short.
 */
export function ageSwitcher(active: AgeGroup, id: string, label: "shown" | "hidden"): string {
  const mine = coachedAges();
  const rest = AGE_GROUPS.filter((age) => !mine.includes(age));
  const option = (age: AgeGroup): string =>
    `<option value="${age}"${age === active ? " selected" : ""}>${esc(AGE_GROUP_LABELS[age])}</option>`;

  return `
    <div class="age-switch">
      <label for="${esc(id)}"${label === "hidden" ? ' class="visually-hidden"' : ""}>${
        label === "hidden" ? "Age group you coach" : "Coaching"
      }</label>
      <select id="${esc(id)}" class="age-select">
        ${
          mine.length > 0 && rest.length > 0
            ? `<optgroup label="You coach">${mine.map(option).join("")}</optgroup>
               <optgroup label="Add another grade">${rest.map(option).join("")}</optgroup>`
            : AGE_GROUPS.map(option).join("")
        }
      </select>
    </div>`;
}

/**
 * Wires it up. `after` redraws whatever the caller has on screen.
 *
 * The write happens before the redraw rather than inside it, because every
 * other tab reads the grade off storage when it next renders and a coach can
 * leave this one the moment they have tapped.
 */
export function wireAgeSwitcher(container: HTMLElement, id: string, after: () => void): void {
  container.querySelector<HTMLSelectElement>(`#${id}`)?.addEventListener("change", (event) => {
    const value = (event.target as HTMLSelectElement).value;
    if (!isAgeGroup(value)) return;
    chooseAge(value);
    after();
  });
}
