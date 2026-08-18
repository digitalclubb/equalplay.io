import { supabase } from "./supabase.js";
import { isAgeGroup, THEMES, type Theme } from "./content/types.js";
import type { PlanBlock, SessionPlan } from "../logic/sessionPlan.js";

/**
 * A saved plan. `updatedAt` is persistence metadata, so it lives here rather than
 * on SessionPlan. The logic layer has no business knowing when a plan was saved.
 */
export interface StoredPlan extends SessionPlan {
  updatedAt: string;
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
    isString(plan?.updatedAt)
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
    .select("id, title, age_group, theme, session_minutes, blocks, updated_at");

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
  const stamped: StoredPlan = { ...plan, updatedAt: new Date().toISOString() };
  const current = store(userId);
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

export function newPlanId(): string {
  // Generated client-side so a plan can be created with no connection
  return crypto.randomUUID();
}
