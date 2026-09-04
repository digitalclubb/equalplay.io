import { supabase } from "./supabase.js";
import type { AgeGroup, Theme } from "./content/types.js";

/**
 * What a coach has actually run.
 *
 * Framed as coverage rather than as a diary. Nobody keeps a diary. The failure
 * a volunteer has is not forgetting what happened: it is coaching
 * handling four Tuesdays running because handling is the session they are
 * comfortable with, then arriving at a festival having never once worked on
 * what to do when somebody runs at you.
 *
 * Same local-first shape as `favourites.ts`. Marking a night as run has to work
 * at a pitch with no signal, because that is where it gets tapped, so the write
 * lands locally and the push happens behind it.
 *
 * Nothing here is about a child. A row is a date, a title and a list of themes.
 */
export interface SessionRun {
  id: string;
  planId: string | null;
  title: string;
  ageGroup: AgeGroup;
  /** Copied off the plan as it ran. A plan can be edited or deleted later. */
  themes: Theme[];
  /** ISO date, no time. A training night is a day, not a moment. */
  ranOn: string;
}

interface LocalStore {
  userId: string;
  runs: SessionRun[];
  /** Run ids whose state has not reached the server. */
  pending: string[];
  /** Run ids deleted locally, so a pull cannot resurrect them. */
  deleted: string[];
}

const KEY = "equalplay_hub_runs";

function isRun(value: unknown): value is SessionRun {
  if (typeof value !== "object" || value === null) return false;
  const run = value as Partial<SessionRun>;
  return (
    typeof run.id === "string" &&
    typeof run.title === "string" &&
    typeof run.ageGroup === "string" &&
    typeof run.ranOn === "string" &&
    Array.isArray(run.themes)
  );
}

function readLocal(): LocalStore | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const held = parsed as Partial<LocalStore>;
    if (typeof held.userId !== "string" || !Array.isArray(held.runs)) return null;
    return {
      userId: held.userId,
      runs: held.runs.filter(isRun),
      pending: Array.isArray(held.pending)
        ? held.pending.filter((v): v is string => typeof v === "string")
        : [],
      deleted: Array.isArray(held.deleted)
        ? held.deleted.filter((v): v is string => typeof v === "string")
        : [],
    };
  } catch {
    return null;
  }
}

function writeLocal(store: LocalStore): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // Quota or private browsing. The log still works for this session.
  }
}

function store(userId: string): LocalStore {
  const held = readLocal();
  return held && held.userId === userId
    ? held
    : { userId, runs: [], pending: [], deleted: [] };
}

export function localRuns(userId: string): SessionRun[] {
  return [...store(userId).runs].sort((a, b) => b.ranOn.localeCompare(a.ranOn));
}

export function pendingRuns(userId: string): number {
  return store(userId).pending.length;
}

export function clearLocalRuns(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to do.
  }
}

// ---- Writes ----

/**
 * Records a night, synchronously, then hands back the log.
 *
 * The id is minted here rather than by the database so the row exists on the
 * device before anything is asked of the network. `crypto.randomUUID` is absent
 * over plain http on a phone, which is how a coach on a club's own wifi hits it,
 * so there is a fallback.
 */
export function logRun(
  userId: string,
  entry: Omit<SessionRun, "id" | "ranOn"> & { ranOn?: string },
): SessionRun[] {
  const current = store(userId);
  const run: SessionRun = {
    id: mintId(),
    planId: entry.planId,
    title: entry.title,
    ageGroup: entry.ageGroup,
    themes: entry.themes,
    ranOn: entry.ranOn ?? today(),
  };
  writeLocal({
    ...current,
    runs: [...current.runs, run],
    pending: [...new Set([...current.pending, run.id])],
  });
  return localRuns(userId);
}

/** Undoes a night. A mis-tap on a wet phone is the common case. */
export function removeRun(userId: string, id: string): SessionRun[] {
  const current = store(userId);
  writeLocal({
    ...current,
    runs: current.runs.filter((run) => run.id !== id),
    pending: current.pending.filter((pendingId) => pendingId !== id),
    deleted: [...new Set([...current.deleted, id])],
  });
  return localRuns(userId);
}

function mintId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    // Same fallback the plans module uses. Not a real UUID, but unique enough
    // for a row a coach owns and never collides across their own devices.
    return `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---- Sync ----

export interface RunSync {
  runs: SessionRun[];
  reachedServer: boolean;
}

interface Row {
  id: unknown;
  plan_id: unknown;
  title: unknown;
  age_group: unknown;
  themes: unknown;
  ran_on: unknown;
}

function fromRow(row: Row): SessionRun | null {
  const run = {
    id: row.id,
    planId: typeof row.plan_id === "string" ? row.plan_id : null,
    title: row.title,
    ageGroup: row.age_group,
    themes: Array.isArray(row.themes) ? row.themes : [],
    ranOn: typeof row.ran_on === "string" ? row.ran_on.slice(0, 10) : row.ran_on,
  };
  return isRun(run) ? (run as SessionRun) : null;
}

async function push(userId: string, run: SessionRun): Promise<boolean> {
  const { error } = await supabase.from("session_runs").upsert({
    id: run.id,
    user_id: userId,
    plan_id: run.planId,
    title: run.title,
    age_group: run.ageGroup,
    themes: run.themes,
    ran_on: run.ranOn,
  });
  return !error;
}

/**
 * Pulls the log and merges it with what is on the device.
 *
 * Deletes carry a tombstone for the same reason plans do: a delete that could
 * not reach the server would otherwise come straight back on the next pull,
 * because the row is still there and nothing can tell "never seen" from
 * "deliberately gone".
 */
export async function syncRuns(userId: string): Promise<RunSync> {
  // Nobody signed in is not the same as no signal, so this does not claim to be
  // offline. Nothing failed.
  if (!userId) return { runs: [], reachedServer: true };

  const local = store(userId);

  const { data, error } = await supabase
    .from("session_runs")
    .select("id, plan_id, title, age_group, themes, ran_on");

  if (error) {
    // Includes the case where 0004 has not been run yet. The log stays on the
    // device and keeps retrying rather than losing the night a coach recorded.
    return { runs: localRuns(userId), reachedServer: false };
  }

  const tombstoned = new Set(local.deleted);
  const byId = new Map<string, SessionRun>();
  for (const row of (data ?? []) as Row[]) {
    const run = fromRow(row);
    if (run && !tombstoned.has(run.id)) byId.set(run.id, run);
  }
  // Anything not yet pushed keeps its local state, the same as a pending star.
  for (const id of local.pending) {
    const held = local.runs.find((run) => run.id === id);
    if (held) byId.set(id, held);
  }

  const stillPending: string[] = [];
  for (const id of local.pending) {
    const run = byId.get(id);
    if (run && !(await push(userId, run))) stillPending.push(id);
  }

  const stillDeleted: string[] = [];
  for (const id of local.deleted) {
    const { error: gone } = await supabase.from("session_runs").delete().eq("id", id);
    if (gone) stillDeleted.push(id);
  }

  writeLocal({
    userId,
    runs: [...byId.values()],
    pending: stillPending,
    deleted: stillDeleted,
  });
  return { runs: localRuns(userId), reachedServer: true };
}

/** Retries everything outstanding. Wired to the browser coming back online. */
export async function retryRuns(userId: string): Promise<number> {
  if (!userId) return 0;
  const current = store(userId);
  if (current.pending.length === 0 && current.deleted.length === 0) return 0;
  const { reachedServer } = await syncRuns(userId);
  return reachedServer ? pendingRuns(userId) : current.pending.length;
}
