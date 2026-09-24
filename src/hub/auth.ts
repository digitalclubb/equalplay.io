import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase.js";
import { isAgeGroup, type AgeGroup } from "./content/types.js";
import { chooseAge, mergeCoachedAges, setCoachedAges } from "./ageChoice.js";
import { currentRoute } from "./router.js";

/**
 * The coach's own details. Stored in Supabase user metadata rather than a
 * `profiles` table: nothing security-sensitive keys off these fields, so
 * user-writable metadata is the right level and saves a table, a trigger and a
 * policy. Add a real table the day we need to query across coaches.
 */
export interface Profile {
  name: string;
  club: string;
  /** The grade the app is set to. One of `ageGroups`. */
  ageGroup: AgeGroup;
  /**
   * Every grade this coach takes. A volunteer with two children often has two
   * teams. Kept in user metadata beside the rest of the profile rather than in
   * a table, the same as everything else here, so it needs no migration: an
   * account registered before this reads back as a list of the one grade it
   * has.
   */
  ageGroups: AgeGroup[];
}

const PROFILE_CACHE_KEY = "equalplay_hub_profile";

// ---- Validation ----

export interface ProfileErrors {
  name?: string;
  email?: string;
  password?: string;
  club?: string;
  ageGroup?: string;
}

export function validateProfile(
  fields: { name: string; club: string; ageGroup: string },
): ProfileErrors {
  const errors: ProfileErrors = {};
  if (!fields.name.trim()) errors.name = "We need your name.";
  else if (fields.name.length > 80) errors.name = "That name is too long.";
  if (!fields.club.trim()) errors.club = "We need your club.";
  else if (fields.club.length > 120) errors.club = "That club name is too long.";
  if (!isAgeGroup(fields.ageGroup)) errors.ageGroup = "Pick the age group you coach.";
  return errors;
}

export function validateCredentials(email: string, password: string): ProfileErrors {
  const errors: ProfileErrors = {};
  // Deliberately loose. The confirmation email is the real check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    errors.email = "That doesn't look like an email address.";
  }
  if (password.length < 8) errors.password = "Eight characters or more, please.";
  return errors;
}

export function hasProfileErrors(errors: ProfileErrors): boolean {
  return Object.keys(errors).length > 0;
}

// ---- Profile ----

export function profileFromUser(user: User | null): Profile | null {
  if (!user) return null;
  const meta = user.user_metadata ?? {};
  if (!isAgeGroup(meta.age_group)) return null;
  // The list is what a coach has told us since. Anything that is not one of the
  // six is dropped rather than trusted: this is user-writable metadata.
  const listed: AgeGroup[] = Array.isArray(meta.age_groups)
    ? meta.age_groups.filter(isAgeGroup)
    : [];
  const ageGroups = listed.length > 0 ? [...new Set(listed)] : [meta.age_group];
  return {
    name: typeof meta.name === "string" ? meta.name : "",
    club: typeof meta.club === "string" ? meta.club : "",
    // The registered grade, unless the coach has since stopped taking it.
    ageGroup: ageGroups.includes(meta.age_group) ? meta.age_group : ageGroups[0],
    ageGroups,
  };
}

/**
 * Last known profile, readable with no network. The hub is used on a touchline;
 * a cold start in a dead spot should still know which age group to filter to.
 *
 * Stored against the user id so a shared device can never render one coach's
 * name, club or age group while a different coach is signed in.
 */
export interface CachedProfile {
  userId: string;
  profile: Profile;
}

export function cachedProfile(): CachedProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.userId !== "string" || !isAgeGroup(parsed?.profile?.ageGroup)) return null;
    return parsed as CachedProfile;
  } catch {
    return null;
  }
}

export function cacheProfile(userId: string, profile: Profile): void {
  // Match day cannot read a profile: it has no Supabase in its bundle at all.
  // This is the one funnel every signed-in grade goes through, so it is where
  // the local answer is kept in step. Without it a coach who registered as U10
  // without ever meeting the age picker gets match day's bare default.
  //
  // A coach this device has already seen keeps what they have added to it: the
  // switcher writes locally so it works at a pitch, so the metadata has not
  // heard about it yet and replacing would undo the switch the moment the tab
  // reloaded.
  //
  // Anybody else and the account decides, outright. Storage holds a grade from
  // whoever used this browser last, or from the `?age=` a static page handed
  // it. Merging let that outrank the one the coach actually registered:
  // landing from a U12 page then signing in as a U8 coach kept the app on U12
  // and put ruck drills in front of them. The age gate is a safety feature, so
  // the only thing allowed to answer for a coach we have not met is their own
  // account.
  if (cachedProfile()?.userId === userId) {
    mergeCoachedAges(profile.ageGroups);
  } else {
    setCoachedAges(profile.ageGroups);
    chooseAge(profile.ageGroup);
  }
  try {
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({ userId, profile }));
  } catch {
    // Private browsing or a full quota. The hub still works, just online-only
  }
}

export function clearCachedProfile(): void {
  try {
    localStorage.removeItem(PROFILE_CACHE_KEY);
  } catch {
    // Nothing to do. The cache is an optimisation, not a source of truth
  }
}

// ---- Session ----

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthChange(fn: (session: Session | null) => void): void {
  supabase.auth.onAuthStateChange((_event, session) => fn(session));
}

// ---- Actions ----

/**
 * Registering asks for one grade, not the set. A coach adds the second one
 * from the switcher later, if they take one, so the form stays four fields.
 */
export interface SignUpFields extends Omit<Profile, "ageGroups"> {
  email: string;
  password: string;
}

/** Where the app puts what a coach was reaching for when they registered. */
export const GATE_KEY = "equalplay_hub_gate";

/**
 * What the coach was reaching for when they registered, kept for the way back.
 *
 * The confirmation email opens a fresh page with nothing of the tab that sent
 * it, so without this somebody who registered to keep the session they were
 * reading confirms and lands on the drill list.
 *
 * Not carried on `emailRedirectTo`, which is the obvious place and the wrong
 * one. Supabase matches that address against an allow list of whole URLs, so a
 * query it has not been told about falls back to the Site URL, which is the
 * marketing homepage. That page ships no JavaScript and no client, so the PKCE
 * code would never be exchanged and a coach who confirmed would arrive signed
 * out on a page that cannot sign them in. It would fail in production only,
 * where nothing tests it.
 *
 * Storage loses nothing by comparison. The code exchanges against a verifier
 * held in the browser that asked for it, so a confirmation link only ever
 * works in this browser anyway, which is the same place this is written.
 *
 * More than the `join` routes, because the signed-out form is shown for a bare
 * `#/favourites` and for a session route as well. A coach registering at one of
 * those was reaching for something too.
 */
function rememberGate(): void {
  const route = currentRoute();
  const gate =
    route.name === "join" && route.param
      ? route.param
      : route.name === "favourites" && !route.param
        ? "favourites"
        : route.name === "plan" || route.name === "plans"
          ? "plans"
          : "";
  try {
    if (gate) localStorage.setItem(GATE_KEY, gate);
    else localStorage.removeItem(GATE_KEY);
  } catch {
    // Private mode. The coach lands on the app rather than on the gate
  }
}

/** Resolves with `needsConfirmation` when Supabase has sent a confirmation email. */
export async function signUp(
  fields: SignUpFields,
): Promise<{ needsConfirmation: boolean }> {
  rememberGate();
  const { data, error } = await supabase.auth.signUp({
    email: fields.email.trim(),
    password: fields.password,
    options: {
      data: {
        name: fields.name.trim(),
        club: fields.club.trim(),
        age_group: fields.ageGroup,
        age_groups: [fields.ageGroup],
      },
      // Exactly what `supabase/README.md` has on the allow list, nothing added.
      // Where the coach was headed is in storage instead. See `rememberGate`.
      emailRedirectTo: `${window.location.origin}/hub`,
    },
  });
  if (error) throw error;
  return { needsConfirmation: !data.session };
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  clearCachedProfile();
  await supabase.auth.signOut();
}

/**
 * Sends a reset link. The PKCE verifier is stored in this browser's localStorage,
 * so the link only works in the browser that asked for it. The reset form says
 * so. main.ts reports it if somebody tries anyway.
 */
export async function sendPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/hub#/account`,
  });
  if (error) throw error;
}

export async function updateProfile(profile: Profile): Promise<void> {
  const { data, error } = await supabase.auth.updateUser({
    data: {
      name: profile.name.trim(),
      club: profile.club.trim(),
      age_group: profile.ageGroup,
      age_groups: profile.ageGroups,
    },
  });
  if (error) throw error;
  if (data.user) cacheProfile(data.user.id, profile);
  // After the cache, which merges. A save is the coach saying this is the set,
  // so a grade they have just unticked has to go rather than being folded back
  // in off this device's own list.
  setCoachedAges(profile.ageGroups);
}

/**
 * Deletes the account for real. supabase-js cannot do this. Removing a user
 * needs the service role key, so it goes through a serverless function that
 * verifies the caller's own token and deletes only that user.
 */
export async function deleteAccount(): Promise<void> {
  const session = await getSession();
  if (!session) throw new Error("You're not signed in.");

  const response = await fetch("/api/delete-account", {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || "Couldn't delete the account. Give it another go.");
  }

  clearCachedProfile();
  await supabase.auth.signOut();
}
