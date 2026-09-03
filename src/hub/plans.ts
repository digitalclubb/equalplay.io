import { supabase } from "./supabase.js";
import { isAgeGroup, THEMES, type Theme } from "./content/types.js";
import type { PlanBlock, SessionPlan } from "../logic/sessionPlan.js";

/**
 * A saved plan. `updatedAt` is persistence metadata, so it lives here rather than
 * on SessionPlan. The logic layer has no business knowing when a plan was saved.
 */
export interface StoredPlan extends SessionPlan {
  updatedAt: string;
  /**
   * Set once the author asks for a share link, absent otherwise. Persistence
   * metadata like `updatedAt`, so the editor never sees it, but unlike
   * `updatedAt` it has to survive an edit rather than be replaced. A link a
   * coach has already sent must not stop working because they changed a title.
   */
  shareToken?: string;
}

/**
 * Offline-first. A coach reads their plan at the side of a pitch, so the local
 * mirror is what the UI renders from and Supabase is what makes it survive a new
 * phone. Writes land locally first and push behind that; a push that fails leaves
 * the plan in `unsynced` to retry on the next load.
 */
interface LocalStore {
  userId: string;
  plans: StoredPlan[];
  unsynced: string[];
  /**
   * Ids deleted here whose delete has not reached the server.
   *
   * Without these, deleting a session with no signal un-deletes it: the row is
   * still on the server, the next pull does not find it locally and adds it back.
   * A tombstone is the only way a pull can tell "never seen" from "deliberately
   * gone".
   */
  deleted: string[];
}

const KEY = "equalplay_hub_plans";

// ---- Local mirror ----

function readLocal(): LocalStore | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.userId !== "string" || !Array.isArray(parsed?.plans)) return null;
    return {
      userId: parsed.userId,
      plans: parsed.plans.filter(isStoredPlan),
      unsynced: Array.isArray(parsed.unsynced) ? parsed.unsynced.filter(isString) : [],
      deleted: Array.isArray(parsed.deleted) ? parsed.deleted.filter(isString) : [],
    };
  } catch {
    return null;
  }
}

function writeLocal(store: LocalStore): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // Quota or private browsing. The plan is still in memory and still pushed
  }
}

/** Plans readable with no network. Empty for a different user than the cache holds. */
export function localPlans(userId: string): StoredPlan[] {
  const store = readLocal();
  if (!store || store.userId !== userId) return [];
  return [...store.plans].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * How many edits are sitting on this device and have not reached the server.
 *
 * A coach who edits a plan in a car park with no signal deserves to be told that
 * plainly, rather than being left to assume it saved.
 */
export function pendingCount(userId: string): number {
  const held = readLocal();
  if (!held || held.userId !== userId) return 0;
  return held.unsynced.length + held.deleted.length;
}

export function clearLocalPlans(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to do
  }
}

function store(userId: string): LocalStore {
  const existing = readLocal();
  return existing && existing.userId === userId
    ? existing
    : { userId, plans: [], unsynced: [], deleted: [] };
}

// ---- Validation of anything crossing back in ----

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isBlock(value: unknown): value is PlanBlock {
  const block = value as PlanBlock | null;
  if (!block || !isString(block.drillId) || typeof block.minutes !== "number") return false;
  // Optional. Plans saved before breaks existed simply do not have it
  return block.breakAfter === undefined || typeof block.breakAfter === "number";
}

/**
 * localStorage and the database are both outside our control. A stale schema, a
 * hand-edited row or a corrupted string must not take the planner down.
 */
function isStoredPlan(value: unknown): value is StoredPlan {
  const plan = value as StoredPlan | null;
  return (
    Boolean(plan) &&
    isString(plan?.id) &&
    isString(plan?.title) &&
    isAgeGroup(plan?.ageGroup) &&
    typeof plan?.sessionMinutes === "number" &&
    Array.isArray(plan?.blocks) &&
    plan.blocks.every(isBlock) &&
    isString(plan?.updatedAt) &&
    (plan?.shareToken === undefined || isString(plan?.shareToken))
  );
}

// ---- Row mapping ----

interface PlanRow {
  id: string;
  title: string;
  age_group: string;
  theme: string | null;
  session_minutes: number | null;
  blocks: unknown;
  updated_at: string;
  /** Absent on a shared read: `shared_plan` never returns it. */
  share_token?: string | null;
}

function fromRow(row: PlanRow): StoredPlan | null {
  const theme = THEMES.includes(row.theme as Theme) ? (row.theme as Theme) : undefined;
  const candidate = {
    id: row.id,
    title: row.title,
    ageGroup: row.age_group,
    theme,
    sessionMinutes: row.session_minutes ?? 60,
    blocks: Array.isArray(row.blocks) ? row.blocks.filter(isBlock) : [],
    updatedAt: row.updated_at,
    shareToken: row.share_token ?? undefined,
  };
  return isStoredPlan(candidate) ? candidate : null;
}

function toRow(plan: StoredPlan, userId: string): Record<string, unknown> {
  return {
    id: plan.id,
    user_id: userId,
    title: plan.title,
    age_group: plan.ageGroup,
    theme: plan.theme ?? null,
    session_minutes: plan.sessionMinutes,
    blocks: plan.blocks,
    updated_at: plan.updatedAt,
    // ponytail: last-write-wins on one column. A second device holding an
    // unsynced edit from before the coach shared this will push null over a live
    // token. Give the token its own row if sharing ever needs to survive that.
    share_token: plan.shareToken ?? null,
  };
}

// ---- Sync ----

/**
 * Pulls the server's copy, merges it with the local mirror last-write-wins on
 * `updatedAt`, retries anything that failed to push and returns what to render.
 *
 * ponytail: last-write-wins is the whole conflict story. A real merge only earns
 * its keep if plans ever become shareable between coaches.
 */
export interface SyncResult {
  plans: StoredPlan[];
  /** False when the server could not be reached, so what is shown is local only. */
  reachedServer: boolean;
  /** Edits still only on this device after the retry. */
  pending: number;
}

export async function syncPlans(userId: string): Promise<SyncResult> {
  // Signed out there is nothing to pull and nothing has failed, so this is not
  // the offline state. Sessions ask for an account before they get this far.
  if (!userId) return { plans: [], reachedServer: true, pending: 0 };

  const local = store(userId);

  const { data, error } = await supabase
    .from("session_plans")
    .select("id, title, age_group, theme, session_minutes, blocks, updated_at, share_token");

  if (error) {
    return { plans: localPlans(userId), reachedServer: false, pending: local.unsynced.length };
  }

  const merged = new Map<string, StoredPlan>();
  for (const plan of local.plans) merged.set(plan.id, plan);

  const tombstoned = new Set(local.deleted);

  for (const row of (data ?? []) as PlanRow[]) {
    const remote = fromRow(row);
    if (!remote) continue;
    // Deleted here and the server has not caught up yet. Do not resurrect it.
    if (tombstoned.has(remote.id)) continue;
    const mine = merged.get(remote.id);
    // An unsynced local edit always wins. It has never reached the server, so a
    // remote row that looks newer is really just the pre-edit copy
    if (mine && (local.unsynced.includes(remote.id) || mine.updatedAt >= remote.updatedAt)) continue;
    merged.set(remote.id, remote);
  }

  const plans = [...merged.values()];
  const stillUnsynced: string[] = [];
  for (const id of local.unsynced) {
    const plan = merged.get(id);
    if (!plan) continue;
    const pushed = await push(plan, userId);
    if (!pushed) stillUnsynced.push(id);
  }

  // Retry the deletes. A tombstone is only forgotten once the row is really gone
  const stillDeleted: string[] = [];
  for (const id of local.deleted) {
    if (!(await remove(userId, id))) stillDeleted.push(id);
  }

  writeLocal({ userId, plans, unsynced: stillUnsynced, deleted: stillDeleted });
  return {
    plans: localPlans(userId),
    reachedServer: true,
    pending: stillUnsynced.length + stillDeleted.length,
  };
}

/**
 * Retries every staged edit. Wired to the browser coming back online, which is
 * the moment a touchline edit can finally leave the device.
 */
export async function retryPending(userId: string): Promise<number> {
  if (!userId) return 0;
  const local = store(userId);
  if (local.unsynced.length === 0 && local.deleted.length === 0) return 0;

  const stillUnsynced: string[] = [];
  for (const id of local.unsynced) {
    const plan = local.plans.find((p) => p.id === id);
    if (!plan) continue;
    if (!(await push(plan, userId))) stillUnsynced.push(id);
  }

  const stillDeleted: string[] = [];
  for (const id of local.deleted) {
    if (!(await remove(userId, id))) stillDeleted.push(id);
  }

  writeLocal({ userId, plans: local.plans, unsynced: stillUnsynced, deleted: stillDeleted });
  return stillUnsynced.length + stillDeleted.length;
}

async function push(plan: StoredPlan, userId: string): Promise<boolean> {
  const { error } = await supabase.from("session_plans").upsert(toRow(plan, userId));
  return !error;
}

/** The user_id filter is belt and braces. Row level security already scopes it. */
async function remove(userId: string, id: string): Promise<boolean> {
  const { error } = await supabase
    .from("session_plans")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  return !error;
}

// ---- Writes ----

/**
 * Records an edit locally, synchronously. The editor calls this on every
 * keystroke and every block change so that closing the tab mid-edit cannot lose
 * work. The network push is debounced behind it and is allowed to be slow.
 */
export function stagePlan(userId: string, plan: SessionPlan): StoredPlan {
  const current = store(userId);
  const held = current.plans.find((p) => p.id === plan.id);
  // The editor works in `SessionPlan`, which carries no token. Spreading an edit
  // straight over the stored plan would drop it. A link the coach had already
  // sent their co-coach would then quietly stop working.
  const stamped: StoredPlan = {
    ...plan,
    updatedAt: new Date().toISOString(),
    shareToken: held?.shareToken,
  };
  writeLocal({
    userId,
    plans: [stamped, ...current.plans.filter((p) => p.id !== stamped.id)],
    unsynced: [...new Set([...current.unsynced, stamped.id])],
    // Editing an id back into existence cancels any pending delete for it
    deleted: current.deleted.filter((id) => id !== stamped.id),
  });
  return stamped;
}

/** Stages the edit, then pushes it. Resolves true once the server has it. */
export async function savePlan(userId: string, plan: SessionPlan): Promise<boolean> {
  if (!userId) return false;
  const stamped = stagePlan(userId, plan);
  const pushed = await push(stamped, userId);
  if (pushed) {
    const current = store(userId);
    writeLocal({
      userId,
      plans: current.plans,
      unsynced: current.unsynced.filter((id) => id !== stamped.id),
      deleted: current.deleted,
    });
  }
  return pushed;
}

/**
 * Removes it here at once, then tells the server. A delete that cannot reach the
 * server leaves a tombstone so the next pull does not bring the session back.
 */
export async function deletePlan(userId: string, id: string): Promise<void> {
  if (!userId) return;
  const current = store(userId);
  writeLocal({
    userId,
    plans: current.plans.filter((p) => p.id !== id),
    unsynced: current.unsynced.filter((u) => u !== id),
    deleted: [...new Set([...current.deleted, id])],
  });

  if (await remove(userId, id)) {
    const after = store(userId);
    writeLocal({
      userId,
      plans: after.plans,
      unsynced: after.unsynced,
      deleted: after.deleted.filter((d) => d !== id),
    });
  }
}

/**
 * A v4 uuid, whatever the page is being served over.
 *
 * `crypto.randomUUID` needs a secure context, so it is missing on a dev server
 * reached at http://192.168.x.x from a phone, which is exactly how this gets
 * tested. `getRandomValues` has no such rule.
 */
function uuid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const hex = [...b].map((n) => n.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function newPlanId(): string {
  // Generated client-side so a plan can be created with no connection
  return uuid();
}

// ---- Sharing ----

/**
 * Turning a session into a link, then taking it back.
 *
 * The token is minted here rather than by a column default, for the same reason
 * plan ids are: the coach gets their link the moment they ask. The push happens
 * behind it like every other write. `reachedServer` is what lets the interface
 * be honest that a link made in a car park does not work until the phone finds
 * signal.
 */
export interface ShareResult {
  token: string | null;
  reachedServer: boolean;
}

async function setToken(
  userId: string,
  planId: string,
  token: string | null,
): Promise<ShareResult> {
  const current = store(userId);
  const held = current.plans.find((p) => p.id === planId);
  if (!held) return { token: null, reachedServer: true };

  const next: StoredPlan = {
    ...held,
    shareToken: token ?? undefined,
    updatedAt: new Date().toISOString(),
  };
  writeLocal({
    userId,
    plans: [next, ...current.plans.filter((p) => p.id !== planId)],
    unsynced: [...new Set([...current.unsynced, planId])],
    deleted: current.deleted.filter((id) => id !== planId),
  });

  const pushed = await push(next, userId);
  if (pushed) {
    const after = store(userId);
    writeLocal({
      userId,
      plans: after.plans,
      unsynced: after.unsynced.filter((id) => id !== planId),
      deleted: after.deleted,
    });
  }
  return { token, reachedServer: pushed };
}

/** Starts sharing, or hands back the link that already exists. */
export async function startSharing(userId: string, planId: string): Promise<ShareResult> {
  if (!userId) return { token: null, reachedServer: true };
  const held = store(userId).plans.find((p) => p.id === planId);
  if (held?.shareToken) return { token: held.shareToken, reachedServer: true };
  return setToken(userId, planId, uuid());
}

/** Clearing the token takes every copy of that link out of service at once. */
export async function stopSharing(userId: string, planId: string): Promise<ShareResult> {
  if (!userId) return { token: null, reachedServer: true };
  return setToken(userId, planId, null);
}

/** A token is the whole permission, so anything that is not one is not asked about. */
export function isShareToken(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export interface SharedPlanResult {
  plan: StoredPlan | null;
  /** False when the server could not be reached, which is not the same as a dead link. */
  reachedServer: boolean;
}

/**
 * Reads somebody else's session by its token.
 *
 * Goes through the `shared_plan` function rather than the table, because the
 * reader is usually anonymous and row level security has no `auth.uid()` to
 * match them against. See `supabase/migrations/0003_share_session.sql`.
 *
 * Nothing is cached. This is the one thing in the hub a coach cannot read with
 * no signal, because it was never theirs to hold on the device.
 */
export async function fetchSharedPlan(token: string): Promise<SharedPlanResult> {
  if (!isShareToken(token)) return { plan: null, reachedServer: true };

  const { data, error } = await supabase.rpc("shared_plan", { token });
  // An error carrying a Postgres code came back from the server, so the phone is
  // not the problem. Reporting a missing function or a revoked grant as "no
  // signal" sends whoever hits it looking in the wrong place entirely.
  if (error) return { plan: null, reachedServer: Boolean(error.code) };

  const row = (data as PlanRow[] | null)?.[0];
  return { plan: row ? fromRow(row) : null, reachedServer: true };
}
