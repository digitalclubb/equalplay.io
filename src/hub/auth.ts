import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase.js";
import { isAgeGroup, type AgeGroup } from "./content/types.js";

/**
 * The coach's own details. Stored in Supabase user metadata rather than a
 * `profiles` table: nothing security-sensitive keys off these fields, so
 * user-writable metadata is the right level and saves a table, a trigger and a
 * policy. Add a real table the day we need to query across coaches.
 */
export interface Profile {
  name: string;
  club: string;
  ageGroup: AgeGroup;
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
  return {
    name: typeof meta.name === "string" ? meta.name : "",
    club: typeof meta.club === "string" ? meta.club : "",
    ageGroup: meta.age_group,
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

export interface SignUpFields extends Profile {
  email: string;
  password: string;
}

/** Resolves with `needsConfirmation` when Supabase has sent a confirmation email. */
export async function signUp(
  fields: SignUpFields,
): Promise<{ needsConfirmation: boolean }> {
  const { data, error } = await supabase.auth.signUp({
    email: fields.email.trim(),
    password: fields.password,
    options: {
      data: {
        name: fields.name.trim(),
        club: fields.club.trim(),
        age_group: fields.ageGroup,
      },
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
    },
  });
  if (error) throw error;
  if (data.user) cacheProfile(data.user.id, profile);
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
