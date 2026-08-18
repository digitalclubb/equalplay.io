import { supabase } from "./supabase.js";

/**
 * Starred drills. Same shape as plans.ts: the local mirror is what the interface
 * renders from and Supabase is what makes it survive a new phone.
 *
 * Toggling a star has to work with no signal, so every write lands locally first
 * and the push happens behind it. A failed push leaves the drill id in `pending`
 * to retry on the next load or when the browser comes back online.
 */
interface LocalStore {
  userId: string;
  ids: string[];
  /** Drill ids whose starred state has not reached the server. */
  pending: string[];
}

const KEY = "equalplay_hub_favourites";

function readLocal(): LocalStore | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.userId !== "string" || !Array.isArray(parsed?.ids)) return null;
    return {
      userId: parsed.userId,
      ids: parsed.ids.filter((v: unknown) => typeof v === "string"),
      pending: Array.isArray(parsed.pending)
        ? parsed.pending.filter((v: unknown) => typeof v === "string")
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
    // Quota or private browsing. Stars still work for this session
  }
}

function store(userId: string): LocalStore {
  const held = readLocal();
  return held && held.userId === userId ? held : { userId, ids: [], pending: [] };
}

/** Starred drill ids, readable with no network. */
export function localFavourites(userId: string): Set<string> {
  return new Set(store(userId).ids);
}

export function pendingFavourites(userId: string): number {
  return store(userId).pending.length;
}

export function clearLocalFavourites(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to do
  }
}

// ---- Writes ----

/**
 * Flips the star and returns the new set immediately. Synchronous on purpose so
 * the interface can redraw without waiting for anything.
 */
export function toggleFavourite(userId: string, drillId: string): Set<string> {
  const current = store(userId);
  const ids = current.ids.includes(drillId)
    ? current.ids.filter((id) => id !== drillId)
    : [...current.ids, drillId];

  writeLocal({
    userId,
    ids,
    pending: [...new Set([...current.pending, drillId])],
  });
  return new Set(ids);
}

async function push(userId: string, drillId: string, starred: boolean): Promise<boolean> {
  const { error } = starred
    ? await supabase.from("favourites").upsert({ user_id: userId, drill_id: drillId })
    : await supabase
        .from("favourites")
        .delete()
        .eq("user_id", userId)
        .eq("drill_id", drillId);
  return !error;
}

/**
 * Pushes one pending star. Called straight after a toggle.
 *
 * The state that was pushed is compared against the state now before clearing the
 * pending flag. Double-tapping fires an upsert then a delete. If the responses land
 * out of order the later write cannot claim the earlier one landed, which used to
 * leave the row on the server with the device saying unstarred.
 */
export async function syncFavourite(userId: string, drillId: string): Promise<void> {
  // No account, nothing to push. A star signed out is a prompt to register.
  if (!userId) return;
  const pushedStarred = store(userId).ids.includes(drillId);
  if (!(await push(userId, drillId, pushedStarred))) return;

  const after = store(userId);
  if (after.ids.includes(drillId) !== pushedStarred) return;

  writeLocal({
    userId,
    ids: after.ids,
    pending: after.pending.filter((id) => id !== drillId),
  });
}

// ---- Sync ----

export interface FavouriteSync {
  ids: Set<string>;
  reachedServer: boolean;
  pending: number;
}

/**
 * Pulls the server's list and merges it with the local one.
 *
 * A pending id always keeps its local state, because the server has not heard
 * about it yet. Everything else takes the server's word for it, which is what
 * makes a second device pick the list up.
 */
export async function syncFavourites(userId: string): Promise<FavouriteSync> {
  // Signed out there is no list to pull. `reachedServer` stays true because
  // nothing failed, so the interface does not claim to be offline when it is not.
  if (!userId) return { ids: new Set(), reachedServer: true, pending: 0 };

  const local = store(userId);

  const { data, error } = await supabase.from("favourites").select("drill_id");
  if (error) {
    return { ids: new Set(local.ids), reachedServer: false, pending: local.pending.length };
  }

  const remote = new Set(
    ((data ?? []) as Array<{ drill_id: unknown }>)
      .map((row) => row.drill_id)
      .filter((id): id is string => typeof id === "string"),
  );

  // Local wins only where a push has not landed
  for (const id of local.pending) {
    if (local.ids.includes(id)) remote.add(id);
    else remote.delete(id);
  }

  const stillPending: string[] = [];
  for (const id of local.pending) {
    if (!(await push(userId, id, remote.has(id)))) stillPending.push(id);
  }

  writeLocal({ userId, ids: [...remote], pending: stillPending });
  return { ids: remote, reachedServer: true, pending: stillPending.length };
}

/** Retries every pending star. Wired to the browser coming back online. */
export async function retryFavourites(userId: string): Promise<number> {
  if (!userId) return 0;
  const current = store(userId);
  if (current.pending.length === 0) return 0;

  const stillPending: string[] = [];
  for (const id of current.pending) {
    if (!(await push(userId, id, current.ids.includes(id)))) stillPending.push(id);
  }
  writeLocal({ userId, ids: current.ids, pending: stillPending });
  return stillPending.length;
}
