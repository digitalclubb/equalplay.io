import { isAgeGroup, type AgeGroup } from "./content/types.js";

/**
 * The age grade a coach picked before registering.
 *
 * Signed in, the age group comes off the profile in auth metadata. Signed out
 * there is no profile. The catalogue cannot show a single drill until it knows
 * which grade it is filtering to, so the picker writes the answer here.
 *
 * It survives registration on purpose. Somebody who browsed as U9 should find
 * U9 already filled in on the form rather than being asked twice.
 */
const KEY = "equalplay_age_group";

export function chosenAge(): AgeGroup | null {
  try {
    const raw = localStorage.getItem(KEY);
    return isAgeGroup(raw) ? raw : null;
  } catch {
    // Private mode with storage off. Falls back to asking again.
    return null;
  }
}

export function chooseAge(age: AgeGroup): void {
  try {
    localStorage.setItem(KEY, age);
  } catch {
    // Nothing to do. The picker simply reappears next time.
  }
}
