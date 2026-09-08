import { describe, it, expect, beforeEach, vi } from "vitest";
import { GATE_KEY, signUp } from "../hub/auth.js";

/**
 * Where a coach ends up after a confirmation email.
 *
 * The email opens a fresh page with nothing of the tab that sent it, so
 * something has to carry what they were reaching for. It used to carry
 * nothing, which meant registering to keep the session you were reading, then
 * confirming, then landing on the drill list. The register screen promises
 * "you will land back here", so this is the code keeping that promise.
 *
 * `emailRedirectTo` is the obvious place to put it and the wrong one. Supabase
 * matches that address against an allow list of whole URLs. `supabase/README.md`
 * has `https://equalplay.io/hub` on it with nothing after it, so a query would
 * miss, fall back to the Site URL, then drop the coach on the marketing
 * homepage, which ships no JavaScript and so can never exchange the code. That
 * is a production-only failure of the one flow that must not break, which is
 * why the address is held to exactly what is on the list here.
 */
let sent = "";

vi.mock("../hub/supabase.js", () => ({
  isConfigured: true,
  supabase: {
    auth: {
      signUp(args: { options: { emailRedirectTo: string } }) {
        sent = args.options.emailRedirectTo;
        // No session back means Supabase has sent a confirmation email, which
        // is the only case any of this matters in.
        return Promise.resolve({ data: { session: null }, error: null });
      },
    },
  },
}));

const FIELDS = {
  name: "Gareth",
  club: "Somewhere RFC",
  ageGroup: "u9" as const,
  email: "coach@example.com",
  password: "eightormore",
};

const remembered = (): string | null => localStorage.getItem(GATE_KEY);

describe("the address a confirmation email comes back to", () => {
  beforeEach(() => {
    sent = "";
    localStorage.clear();
  });

  it("is exactly what the allow list has, wherever they registered from", async () => {
    for (const hash of ["#/join/plans", "#/join/favourites", "#/favourites", "#/account", ""]) {
      window.location.hash = hash;
      await signUp(FIELDS);
      expect(sent, hash).toBe(`${window.location.origin}/hub`);
    }
  });
});

describe("what the coach was reaching for when they registered", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("is kept for the gates they were stopped at", async () => {
    for (const [hash, gate] of [
      ["#/join/plans", "plans"],
      ["#/join/favourites", "favourites"],
    ]) {
      localStorage.clear();
      window.location.hash = hash;
      await signUp(FIELDS);
      expect(remembered(), hash).toBe(gate);
    }
  });

  it("covers the other doors the same form is shown at", async () => {
    // `renderSignedOut` puts the register form up for a bare `#/favourites` and
    // for a session route as well, so keying this off `#/join` alone would
    // leave a coach who registered at one of those landing on the drill list.
    for (const [hash, gate] of [
      ["#/favourites", "favourites"],
      ["#/plans", "plans"],
      ["#/plan/whatever", "plans"],
    ]) {
      localStorage.clear();
      window.location.hash = hash;
      await signUp(FIELDS);
      expect(remembered(), hash).toBe(gate);
    }
  });

  it("keeps nothing when they were not reaching for anything", async () => {
    // Registering off the account page or the catalogue. There is nowhere in
    // particular they were headed, so nothing is invented for them.
    for (const hash of ["#/account", "#/catalogue", "#/guide/u9", ""]) {
      localStorage.setItem(GATE_KEY, "plans");
      window.location.hash = hash;
      await signUp(FIELDS);
      expect(remembered(), hash).toBeNull();
    }
  });
});
