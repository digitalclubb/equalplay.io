/**
 * Session sync — owner writes, viewers subscribe.
 * All writes are non-blocking and debounced.
 * Realtime subscription + polling fallback for viewers.
 */

import { supabase } from "./supabase.js";
import type { SavedData } from "./storage.js";

export type SyncStatus = "connected" | "polling" | "offline";

// ---- Owner: create + push ----

export async function createSession(state: SavedData): Promise<string | null> {
  if (!supabase) return null;
  const id = crypto.randomUUID();
  const { error } = await supabase.from("sessions").insert({
    id,
    state,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    console.error("Failed to create session:", error);
    return null;
  }
  return id;
}

/**
 * Returns a push function (debounced 500ms) and a destroy cleanup.
 * Every call to push() queues the latest state; only the most recent
 * state is written after the debounce window.
 */
export function createOwnerSync(sessionId: string): {
  push(state: SavedData): void;
  destroy(): void;
} {
  if (!supabase) return { push() {}, destroy() {} };

  let timer: ReturnType<typeof setTimeout> | null = null;
  let latest: SavedData | null = null;
  let destroyed = false;

  async function flush() {
    if (!latest || destroyed) return;
    const state = latest;
    latest = null;
    try {
      await supabase!.from("sessions").update({
        state,
        updated_at: new Date().toISOString(),
      }).eq("id", sessionId);
    } catch (err) {
      console.error("Sync write failed:", err);
    }
  }

  return {
    push(state: SavedData) {
      latest = state;
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, 500);
    },
    destroy() {
      destroyed = true;
      if (timer) clearTimeout(timer);
    },
  };
}

// ---- Viewer: load + subscribe ----

export async function loadSession(id: string): Promise<SavedData | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("sessions")
    .select("state")
    .eq("id", id)
    .single();
  if (error || !data) return null;
  return data.state as SavedData;
}

/**
 * Subscribe to a session using realtime + polling fallback.
 * onUpdate fires with the latest state whenever it changes.
 * onStatus fires when connection quality changes.
 */
export function subscribeAsViewer(
  sessionId: string,
  onUpdate: (state: SavedData) => void,
  onStatus: (status: SyncStatus) => void,
): { destroy(): void } {
  if (!supabase) {
    onStatus("offline");
    return { destroy() {} };
  }

  let destroyed = false;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let lastJson = "";

  // Realtime subscription
  const channel = supabase
    .channel(`session-${sessionId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "sessions",
        filter: `id=eq.${sessionId}`,
      },
      (payload) => {
        if (!destroyed && payload.new?.state) {
          onUpdate(payload.new.state as SavedData);
          onStatus("connected");
        }
      },
    )
    .subscribe((status) => {
      if (destroyed) return;
      if (status === "SUBSCRIBED") {
        onStatus("connected");
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        onStatus("polling");
      }
    });

  // Polling fallback — catches anything realtime misses
  async function poll() {
    if (destroyed) return;
    const state = await loadSession(sessionId);
    if (state && !destroyed) {
      const json = JSON.stringify(state);
      if (json !== lastJson) {
        lastJson = json;
        onUpdate(state);
      }
    }
  }
  pollTimer = setInterval(poll, 8000);

  return {
    destroy() {
      destroyed = true;
      channel.unsubscribe();
      if (pollTimer) clearInterval(pollTimer);
    },
  };
}
