import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Persistence, with the server switched on and off.
 *
 * The rule the hub promises: everything ends up in the database, and everything
 * works with no signal. The interesting cases are all in the gap between those
 * two, so the stub below can be told to fail every request.
 */

interface Row {
  id: string;
  user_id: string;
  title: string;
  age_group: string;
  theme: string | null;
  session_minutes: number | null;
  blocks: unknown;
  updated_at: string;
}

/** Stands in for the one table this module touches. */
const server = {
  online: true,
  rows: [] as Row[],
  reset() {
    this.online = true;
    this.rows = [];
  },
};

const ERROR = { message: "no connection" };

vi.mock("../hub/supabase.js", () => ({
  isConfigured: true,
  supabase: {
    from() {
      return {
        select() {
          return Promise.resolve(
            server.online ? { data: server.rows, error: null } : { data: null, error: ERROR },
          );
        },
        upsert(row: Row) {
          if (!server.online) return Promise.resolve({ error: ERROR });
          server.rows = [...server.rows.filter((r) => r.id !== row.id), row];
          return Promise.resolve({ error: null });
        },
        delete() {
          const filters: Record<string, string> = {};
          const builder = {
            eq(column: string, value: string) {
              filters[column] = value;
              return builder;
            },
            then(resolve: (v: { error: typeof ERROR | null }) => void) {
              if (!server.online) return resolve({ error: ERROR });
              server.rows = server.rows.filter(
                (r) =>
                  !Object.entries(filters).every(
                    ([k, v]) => r[k as keyof Row] === v,
                  ),
              );
              return resolve({ error: null });
            },
          };
          return builder;
        },
      };
    },
  },
}));

const {
  deletePlan,
  localPlans,
  pendingCount,
  savePlan,
  stagePlan,
  syncPlans,
  retryPending,
  clearLocalPlans,
} = await import("../hub/plans.js");

const USER = "00000000-0000-4000-8000-000000000001";
const OTHER = "00000000-0000-4000-8000-000000000002";

function plan(id: string, title = "Tuesday") {
  return {
    id,
    title,
    ageGroup: "u10" as const,
    sessionMinutes: 60,
    blocks: [{ drillId: "drill-two-second-ruck", minutes: 12 }],
  };
}

beforeEach(() => {
  localStorage.clear();
  server.reset();
});

describe("with a connection", () => {
  it("puts a new session in the database, not just on the device", async () => {
    expect(await savePlan(USER, plan("a"))).toBe(true);
    expect(server.rows.map((r) => r.id)).toEqual(["a"]);
    expect(server.rows[0].user_id).toBe(USER);
    expect(pendingCount(USER)).toBe(0);
  });

  it("sends edits through", async () => {
    await savePlan(USER, plan("a", "Tuesday"));
    await savePlan(USER, plan("a", "Wednesday"));
    expect(server.rows).toHaveLength(1);
    expect(server.rows[0].title).toBe("Wednesday");
  });

  it("removes a deleted session from the database", async () => {
    await savePlan(USER, plan("a"));
    await deletePlan(USER, "a");
    expect(server.rows).toHaveLength(0);
    expect(localPlans(USER)).toHaveLength(0);
    expect(pendingCount(USER)).toBe(0);
  });

  it("picks up a session another device saved", async () => {
    server.rows.push({
      id: "remote",
      user_id: USER,
      title: "From the laptop",
      age_group: "u10",
      theme: null,
      session_minutes: 60,
      blocks: [],
      updated_at: "2026-08-20T10:00:00.000Z",
    });
    const result = await syncPlans(USER);
    expect(result.reachedServer).toBe(true);
    expect(result.plans.map((p) => p.title)).toContain("From the laptop");
  });

  it("keeps the local copy of an edit the server has not seen", async () => {
    // Server holds an older copy, this device holds an unsynced newer one
    server.rows.push({
      id: "a",
      user_id: USER,
      title: "Old title",
      age_group: "u10",
      theme: null,
      session_minutes: 60,
      blocks: [],
      updated_at: "2099-01-01T00:00:00.000Z",
    });
    stagePlan(USER, plan("a", "My edit"));

    const result = await syncPlans(USER);
    expect(result.plans.find((p) => p.id === "a")?.title).toBe("My edit");
    // And the edit is pushed, so the server now agrees
    expect(server.rows.find((r) => r.id === "a")?.title).toBe("My edit");
  });
});

describe("with no connection", () => {
  it("still creates the session and remembers to push it", async () => {
    server.online = false;
    expect(await savePlan(USER, plan("a"))).toBe(false);

    expect(localPlans(USER).map((p) => p.id)).toEqual(["a"]);
    expect(pendingCount(USER)).toBe(1);
    expect(server.rows).toHaveLength(0);

    server.online = true;
    expect(await retryPending(USER)).toBe(0);
    expect(server.rows.map((r) => r.id)).toEqual(["a"]);
  });

  it("shows the local copy rather than an error", async () => {
    await savePlan(USER, plan("a"));
    server.online = false;

    const result = await syncPlans(USER);
    expect(result.reachedServer).toBe(false);
    expect(result.plans.map((p) => p.id)).toEqual(["a"]);
  });

  // The bug this file was written for
  it("does not bring a deleted session back", async () => {
    await savePlan(USER, plan("a"));
    expect(server.rows).toHaveLength(1);

    server.online = false;
    await deletePlan(USER, "a");
    expect(localPlans(USER)).toHaveLength(0);
    expect(pendingCount(USER)).toBe(1);

    // A pull while still offline must not resurrect it
    expect((await syncPlans(USER)).plans).toHaveLength(0);

    // Nor once the connection is back, and the row goes for good
    server.online = true;
    const result = await syncPlans(USER);
    expect(result.plans).toHaveLength(0);
    expect(server.rows).toHaveLength(0);
    expect(pendingCount(USER)).toBe(0);
  });

  it("clears the tombstone once the delete lands, so it is not retried forever", async () => {
    await savePlan(USER, plan("a"));
    server.online = false;
    await deletePlan(USER, "a");
    expect(pendingCount(USER)).toBe(1);

    server.online = true;
    expect(await retryPending(USER)).toBe(0);
    expect(pendingCount(USER)).toBe(0);
    expect(server.rows).toHaveLength(0);
  });

  it("lets a session be recreated after a pending delete", async () => {
    await savePlan(USER, plan("a"));
    server.online = false;
    await deletePlan(USER, "a");
    // Same id staged again cancels the tombstone
    stagePlan(USER, plan("a", "Back again"));
    expect(localPlans(USER).map((p) => p.title)).toEqual(["Back again"]);

    server.online = true;
    await syncPlans(USER);
    expect(server.rows.map((r) => r.title)).toEqual(["Back again"]);
  });

  it("keeps an offline edit through a failed pull", async () => {
    stagePlan(USER, plan("a", "Written at the pitch"));
    server.online = false;
    await syncPlans(USER);
    expect(localPlans(USER).map((p) => p.title)).toEqual(["Written at the pitch"]);

    server.online = true;
    await syncPlans(USER);
    expect(server.rows.map((r) => r.title)).toEqual(["Written at the pitch"]);
  });
});

describe("the local mirror belongs to one coach", () => {
  it("shows nothing for a different user", async () => {
    await savePlan(USER, plan("a"));
    expect(localPlans(OTHER)).toHaveLength(0);
    expect(pendingCount(OTHER)).toBe(0);
  });

  it("is emptied on sign-out", async () => {
    await savePlan(USER, plan("a"));
    clearLocalPlans();
    expect(localPlans(USER)).toHaveLength(0);
  });

  it("survives a corrupted mirror", async () => {
    localStorage.setItem("equalplay_hub_plans", "{ not json");
    expect(localPlans(USER)).toHaveLength(0);
    expect(await savePlan(USER, plan("a"))).toBe(true);
  });

  it("drops rows that do not match the shape", async () => {
    localStorage.setItem(
      "equalplay_hub_plans",
      JSON.stringify({
        userId: USER,
        plans: [{ id: "junk" }, { id: "ok", title: "Fine", ageGroup: "u10", sessionMinutes: 60, blocks: [], updatedAt: "2026-08-20T00:00:00.000Z" }],
        unsynced: [],
        deleted: [],
      }),
    );
    expect(localPlans(USER).map((p) => p.id)).toEqual(["ok"]);
  });
});
