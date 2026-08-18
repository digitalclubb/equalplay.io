import { esc } from "../../lib/esc.js";
import { rulesLink } from "../../lib/rulesLink.js";
import { chooseAge } from "../ageChoice.js";
import {
  AGE_GROUPS,
  AGE_GROUP_LABELS,
  REGULATION_15_URL,
  isAgeGroup,
  type AgeGroup,
} from "../content/types.js";

/**
 * The first thing a coach sees, before any account.
 *
 * The catalogue cannot show a drill until it knows the grade, so this has to
 * come first. That is worth having rather than working around: it puts the age
 * gate on screen inside ten seconds, before anybody has typed an email address,
 * which is the one thing none of the paid competition does.
 *
 * Signed in this never appears. The grade comes off the profile instead.
 */
export function renderAgePicker(container: HTMLElement, onPicked: (age: AgeGroup) => void): void {
  container.innerHTML = `
    <section class="hub-panel age-picker">
      <h2>Which age group do you coach?</h2>
      <p class="hub-lede">
        You will only ever be shown drills your grade is allowed to do, so this is
        the one thing we need before showing you anything. You can change it later.
      </p>
      <div class="age-picker-grid">
        ${AGE_GROUPS.map(
          (age) =>
            `<button type="button" class="hub-btn age-picker-option" data-age="${age}">${esc(
              AGE_GROUP_LABELS[age],
            )}</button>`,
        ).join("")}
      </div>
      <p class="hub-fineprint">
        Tackling starts at U9, rucks and scrums at U10, lineouts at U12. Those are the
        RFU's rules rather than ours. You can read
        ${rulesLink("their rules of play", REGULATION_15_URL)} yourself.
      </p>
    </section>`;

  container.querySelector(".age-picker-grid")?.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLElement>("[data-age]");
    const age = button?.dataset.age;
    if (!isAgeGroup(age)) return;
    chooseAge(age);
    onPicked(age);
  });
}
