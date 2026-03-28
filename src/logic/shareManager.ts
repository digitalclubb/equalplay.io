/**
 * ShareManager — encapsulates all share/sync state and logic.
 *
 * Manages Supabase session sharing: lazy-loading the sync module,
 * creating/reconnecting sessions, and providing share state to the UI.
 */

import type { SavedData } from "./storage.js";

interface SyncHandle {
  push(state: SavedData): void;
  destroy(): void;
}

interface SyncModule {
  supabase: unknown;
  createSession(state: SavedData): Promise<string | null>;
  createOwnerSync(sessionId: string): SyncHandle;
}

export interface ShareDeps {
  /** Called whenever share state changes and UI needs re-rendering */
  onStateChange: () => void;
  /** Provides current saved data for creating a session */
  buildSavedData: () => SavedData;
  /** Shows a toast message */
  showToast: (message: string) => void;
}

export class ShareManager {
  private sessionId: string | null;
  private ownerSync: SyncHandle | null = null;
  private sharePending = false;
  private shareEnabled = false;
  private deps: ShareDeps;

  constructor(deps: ShareDeps) {
    this.sessionId = localStorage.getItem("equalplay_session_id");
    this.deps = deps;
  }

  /** Initialise — probe for Supabase and reconnect if previously shared */
  async init(): Promise<void> {
    const mod = await this.loadSync();
    if (!mod) return;
    this.shareEnabled = true;
    if (this.sessionId) {
      this.ownerSync = mod.createOwnerSync(this.sessionId);
    } else {
      this.deps.onStateChange();
    }
  }

  /** Push state to remote if a shared session exists */
  push(data: SavedData): void {
    this.ownerSync?.push(data);
  }

  /** Tear down the shared session (e.g. on "Start new") */
  disconnect(): void {
    if (this.ownerSync) {
      this.ownerSync.destroy();
      this.ownerSync = null;
    }
    this.sessionId = null;
    localStorage.removeItem("equalplay_session_id");
  }

  /** Label for the share button — reflects pending state */
  get shareLabel(): string {
    return this.sharePending ? "Sharing..." : "Share live plan \u2197";
  }

  /** Returns the share handler if sharing is available, undefined otherwise */
  get onShare(): (() => Promise<void>) | undefined {
    if (!this.shareEnabled) return undefined;
    return () => this.handleShare();
  }

  // ---- Private ----

  private async loadSync(): Promise<SyncModule | null> {
    const { supabase } = await import("./supabase.js");
    if (!supabase) return null;
    const sync = await import("./sync.js");
    return { supabase, ...sync };
  }

  private async handleShare(): Promise<void> {
    if (this.sharePending) return;

    if (this.sessionId) {
      const url = `${window.location.origin}/session/${this.sessionId}`;
      try {
        await navigator.clipboard.writeText(url);
        this.deps.showToast("Link copied");
      } catch {
        this.deps.showToast("Could not copy link");
      }
      return;
    }

    this.sharePending = true;
    this.deps.onStateChange();

    const mod = await this.loadSync();
    if (!mod) {
      this.sharePending = false;
      this.deps.onStateChange();
      this.deps.showToast("Sharing not available.");
      return;
    }

    const data = this.deps.buildSavedData();
    const id = await mod.createSession(data);
    this.sharePending = false;

    if (id) {
      this.sessionId = id;
      localStorage.setItem("equalplay_session_id", id);
      this.ownerSync = mod.createOwnerSync(id);
      const url = `${window.location.origin}/session/${id}`;
      try {
        await navigator.clipboard.writeText(url);
        this.deps.showToast("Link copied. Live updates enabled.");
      } catch {
        this.deps.showToast("Live updates enabled");
      }
    } else {
      this.deps.showToast("Could not share. Try again.");
    }

    this.deps.onStateChange();
  }
}
