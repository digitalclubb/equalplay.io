import { isAgeGroup, type AgeGroup } from "./content/types.js";
import { storeAgeGroup, storedAgeGroup } from "../lib/squadSize.js";

/**
 * The age grade a coach picked before registering.
 *
 * Signed in, the age group comes off the profile in auth metadata. Signed out
 * there is no profile. The catalogue cannot show a single drill until it knows
 * which grade it is filtering to, so the picker writes the answer here.
 *
 * It survives registration on purpose. Somebody who browsed as U9 should find
 * U9 already filled in on the form rather than being asked twice.
 *
 * The storage itself is in `lib/squadSize.ts`, because match day reads the same
 * answer to know how many a side to start on and may import nothing from here.
 */
export function chosenAge(): AgeGroup | null {
  const raw = storedAgeGroup();
  return isAgeGroup(raw) ? raw : null;
}

export function chooseAge(age: AgeGroup): void {
  storeAgeGroup(age);
}
