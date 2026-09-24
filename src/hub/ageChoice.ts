import { AGE_GROUPS, isAgeGroup, type AgeGroup } from "./content/types.js";
import {
  storeAgeGroup,
  storedAgeGroup,
  storeAgeGroups,
  storedAgeGroups,
} from "../lib/squadSize.js";

/**
 * Which grade the app is set to, plus which grades the coach says they take.
 *
 * Signed in, the grades come off the profile in auth metadata the first time
 * and are mirrored here. Signed out there is no profile. The catalogue cannot
 * show a single drill until it knows which grade it is filtering to, so the
 * picker writes the answer here.
 *
 * It survives registration on purpose. Somebody who browsed as U9 should find
 * U9 already filled in on the form rather than being asked twice.
 *
 * There are two answers rather than one because a volunteer with two children
 * often takes two teams. The active grade is what every tab filters to. The
 * list is what the switcher offers. Before this the catalogue held a grade of
 * its own in a filter while everything else read storage, so Drills could say
 * U7 while Sessions offered U10 and nothing on screen said why.
 *
 * The storage itself is in `lib/squadSize.ts`, because match day reads the same
 * answer to know how many a side to start on and may import nothing from here.
 */
export function chosenAge(): AgeGroup | null {
  const raw = storedAgeGroup();
  return isAgeGroup(raw) ? raw : null;
}

/**
 * The grade every tab is filtered to.
 *
 * Falls through to the first grade the coach takes, so storage holding a grade
 * that is no longer one of theirs cannot leave the app filtered to nothing.
 */
export function activeAge(): AgeGroup | null {
  const stored = chosenAge();
  const coached = coachedAges();
  if (stored && (coached.length === 0 || coached.includes(stored))) return stored;
  return coached[0] ?? stored;
}

/**
 * Every grade this coach takes, youngest first.
 *
 * Grade order rather than the order they were added, because U7 then U10 is
 * how a coach reads their own two teams and it does not move about as the list
 * is edited. A coach who has only ever picked one grade has a list of one, so
 * nothing has to migrate: the active grade stands in for an empty list.
 */
export function coachedAges(): AgeGroup[] {
  const stored = storedAgeGroups().filter(isAgeGroup);
  const list = stored.length > 0 ? stored : [chosenAge()].filter((age) => age !== null);
  const unique = [...new Set(list)];
  return unique.sort((a, b) => AGE_GROUPS.indexOf(a) - AGE_GROUPS.indexOf(b));
}

/**
 * Sets the grade the app is on, adding it to the list where it is new.
 *
 * The first run picker, the register form plus the switcher all land here.
 * Adding on the way through is deliberate: a coach going up in September needs
 * a grade that is not on their list yet, where the only other place to add one
 * is the account page, which a signed-out coach cannot reach at all.
 */
export function chooseAge(age: AgeGroup): void {
  // Read before the write. An empty list stands in for the active grade, so
  // asking after that grade has changed reports the new one as the whole list
  // and the grade being left behind is dropped on the way past.
  const before = coachedAges();
  storeAgeGroup(age);
  if (!before.includes(age)) setCoachedAges([...before, age]);
}

/**
 * Folds the profile's grades in without dropping one added on this device.
 *
 * Local first, the way plans and favourites are. This runs on every profile
 * landing, so replacing the list here would undo a grade added at a pitch the
 * moment the tab was reloaded: the switcher writes locally and the account
 * metadata has not heard about it yet. Replacing is what a deliberate save on
 * the account page does, which is also the only way to stop taking a grade.
 */
export function mergeCoachedAges(ages: AgeGroup[]): void {
  // The list as stored, not what `coachedAges` reports. That falls back to the
  // active grade where the list is empty, which is right for reading it and
  // wrong here: on a club tablet the coach before last leaves their grade in
  // that key, so merging against the fallback hands their team to whoever
  // signs in next.
  setCoachedAges([...storedAgeGroups().filter(isAgeGroup), ...ages]);
}

/**
 * Drops the list, on the way out or when a different coach signs in.
 *
 * Clubs share tablets. The grades somebody takes are theirs, so they go with
 * the cached profile, the plans, the stars and the log. The active grade stays
 * put, because it doubles as the answer the age picker wrote and a device
 * browsing signed out still needs one.
 */
export function clearCoachedAges(): void {
  storeAgeGroups([]);
}

/** Replaces the list. The account page, where a coach drops a grade for good. */
export function setCoachedAges(ages: AgeGroup[]): void {
  const unique = [...new Set(ages)];
  storeAgeGroups(unique);
  const stored = chosenAge();
  // The grade the app is on has to stay one the coach takes, or every tab
  // filters to a grade that is no longer theirs.
  if (unique.length > 0 && (!stored || !unique.includes(stored))) storeAgeGroup(unique[0]);
}
