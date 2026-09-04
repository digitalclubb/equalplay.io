/**
 * How many turned up, plus what is standing in because of it.
 *
 * You planned for twenty on Sunday. Eight came. That decision gets made in a car
 * park at 6:15 with a phone in one hand, which is why it lives on the session
 * rather than in the editor.
 *
 * It is an overlay, never an edit. Next week twenty turn up again and the plan a
 * coach built has to still be the plan they built. `applySwaps` in
 * `logic/sessionPlan.ts` resolves it, so the reading view and present mode both
 * show tonight without anything reaching `session_plans`.
 *
 * One session at a time. A coach is stood at one pitch, so holding a headcount
 * per plan would only ever be stale numbers against the five they are not at.
 * Opening a different session clears it.
 *
 * Not synced, deliberately: this is worth less than the drive home. It is the
 * one thing in the hub that is genuinely local. It holds no more than a number
 * plus some drill ids either way.
 */
const KEY = "equalplay_hub_tonight";

export interface Tonight {
  planId: string;
  players: number;
  /** Index in `plan.blocks`, never the render order, to the drill standing in. */
  swaps: Record<number, string>;
}

/**
 * Held in memory as well as in storage, the same as the sessions view toggle.
 * Read back out of localStorage every render it is dead in private mode, where
 * the write is swallowed and the next read hands back nothing.
 */
let held: Tonight | null = null;

function isTonight(value: unknown): value is Tonight {
  if (typeof value !== "object" || value === null) return false;
  const t = value as Partial<Tonight>;
  return (
    typeof t.planId === "string" &&
    typeof t.players === "number" &&
    Number.isFinite(t.players) &&
    typeof t.swaps === "object" &&
    t.swaps !== null
  );
}

/** Tonight, if it is about this session. Anything else is somebody else's evening. */
export function tonight(planId: string): Tonight | null {
  if (held?.planId === planId) return held;
  if (held) return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isTonight(parsed)) return null;
    held = parsed;
    return parsed.planId === planId ? parsed : null;
  } catch {
    // Private mode, storage off, or a hand-edited value. Ask again.
    return null;
  }
}

function write(next: Tonight | null): void {
  held = next;
  try {
    if (next) localStorage.setItem(KEY, JSON.stringify(next));
    else localStorage.removeItem(KEY);
  } catch {
    // Nothing to do. The in-memory copy carries the evening either way.
  }
}

/**
 * Say how many turned up.
 *
 * Setting it against a different session drops the swaps with it, because a
 * stand-in was chosen for blocks that no longer exist. Changing the number on
 * the same session keeps them: a coach correcting nine to ten has not changed
 * their mind about the drill they already swapped.
 */
export function setHeadcount(planId: string, players: number): void {
  const current = tonight(planId);
  write({ planId, players, swaps: current?.swaps ?? {} });
}

export function swapBlock(planId: string, index: number, drillId: string): void {
  const current = tonight(planId);
  if (!current) return;
  write({ ...current, swaps: { ...current.swaps, [index]: drillId } });
}

export function unswapBlock(planId: string, index: number): void {
  const current = tonight(planId);
  if (!current) return;
  const swaps = { ...current.swaps };
  delete swaps[index];
  write({ ...current, swaps });
}

/** Back to the session as it was written. */
export function clearTonight(): void {
  write(null);
}
