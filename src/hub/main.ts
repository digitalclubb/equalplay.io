import { renderAuth } from "./views/authView.js";
import { renderAccount } from "./views/account.js";
import { renderCatalogue, resetCatalogue } from "./views/catalogue.js";
import {
  clearPrintable,
  flushPlanPush,
  renderPlanEditor,
  renderPlanList,
  renderPlanRun,
  renderPlanView,
  renderPresetList,
  renderPresetView,
  renderSharedPlan,
  resetPlanner,
  stopRunClock,
  takePreset,
  type PlannerContext,
} from "./views/planner.js";
import { clearLocalPlans, retryPending } from "./plans.js";
import { clearLocalFavourites, retryFavourites } from "./favourites.js";
import { clearLocalRuns, retryRuns } from "./sessionLog.js";
import { showToast } from "../components/toast.js";
import {
  GATE_KEY,
  cacheProfile,
  cachedProfile,
  clearCachedProfile,
  getSession,
  onAuthChange,
  profileFromUser,
  type Profile,
} from "./auth.js";
import { isConfigured } from "./supabase.js";
import { currentRoute, go, onRoute, type Route } from "./router.js";
import { transition } from "../lib/motion.js";
import { navHtml } from "../lib/nav.js";
import { wireScheme } from "../lib/theme.js";
import { manageServiceWorker } from "../lib/sw.js";
import { chooseAge, chosenAge } from "./ageChoice.js";
import { isAgeGroup } from "./content/types.js";
import { renderAgePicker } from "./views/agePicker.js";
import { renderGuide } from "./views/guide.js";

/**
 * Routes that belong to a tab of another name. The plan editor lives under
 * #/plan/<id> but is part of Sessions. A bare hash renders the catalogue. So does
 * #/favourites, which is the same list with the stars kept in.
 */
const TAB_FOR_ROUTE: Record<string, string> = {
  plan: "plans",
  preset: "plans",
  home: "catalogue",
  favourites: "catalogue",
};

/**
 * What a coach was reaching for when a gate stopped them, keyed by the `#/join`
 * parameter. Everything gated here is gated because it has to persist, never
 * because the content is being held back.
 */
const GATE_REASON: Record<string, string> = {
  plans:
    "Sessions live in your account, so the one you build tonight is still there next week on whatever phone you have with you.",
  favourites:
    "A starred drill needs somewhere to live beyond this browser, which is what the account is for.",
};

/**
 * Whether a value names a gate this app knows how to land somebody on.
 *
 * Both callers read it out of a URL, one off the address bar and one off a
 * confirmation email, so neither may be trusted to name a key. `in` would say
 * yes to `toString`, because a plain object still has a prototype. Nothing bad
 * follows from that here, since the worst it produces is `#/toString` and the
 * router shows the catalogue for anything it does not recognise, but a check
 * that answers yes to a method is not a check.
 */
function isGate(value: string | null | undefined): value is string {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(GATE_REASON, value);
}

const view = document.getElementById("hub-view");
const nav = document.getElementById("hub-nav");

if (!view || !nav) {
  console.error("Hub shell elements missing");
} else if (!isConfigured) {
  view.innerHTML = `
    <section class="hub-panel">
      <h2>Not configured</h2>
      <p>
        This build has no Supabase credentials. Set VITE_SUPABASE_URL and
        VITE_SUPABASE_ANON_KEY and rebuild.
      </p>
    </section>`;
} else {
  start(view, nav);
}

/**
 * What a page asked the URL to carry in, read once at boot then taken back off.
 *
 * Two things arrive this way. `age` comes off a static page that already knew
 * the grade, since every theme page and every rules page is written for one.
 * A coach landing on "U9 rugby tackling drills" out of a search used to be
 * asked which age group they coach, which is the app forgetting something it
 * had that moment been told, at the point in the funnel where it can least
 * afford to. It is only ever a seed: a coach who has already answered keeps
 * their answer, so reading a U9 page while coaching U12 does not quietly move
 * them. Signed in the profile overwrites it the moment it lands. Match day
 * reads the same storage for how many a side to start on, so the grade travels
 * that far as well.
 *
 * It comes off the address afterwards, or a reload would seed again and a
 * bookmark would carry somebody else's grade. Everything else in the query goes
 * back untouched: a confirmation link arrives with a PKCE `code` in it that
 * supabase-js has not read yet. Dropping that would sign a coach out at the
 * moment they finished confirming.
 */
function takeUrlIntent(): void {
  const params = new URLSearchParams(window.location.search);
  const age = params.get("age");
  if (age === null) return;

  if (isAgeGroup(age) && !chosenAge()) chooseAge(age);

  params.delete("age");
  const query = params.toString();
  history.replaceState(
    null,
    "",
    `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`,
  );
}

/**
 * Coming back from a confirmation link, at the gate the coach registered
 * through rather than at the drill list.
 *
 * `auth.ts` writes what they were reaching for when they signed up. This is the
 * only journey that needs it, because it is the only one that opens a fresh
 * page with nothing of the tab that started it.
 *
 * Only on the way back from a link, which is what the code in the query says.
 * Applying it on any load would send a coach who registered last night, closed
 * the tab and opened the app this morning somewhere they did not ask to go.
 *
 * The fragment is left alone unless it is a route. An expired or already used
 * link comes back with the reason in the fragment rather than the query.
 * `reportLinkFailure` is the thing that reads it out to the coach. Overwriting
 * it would put them on the sessions gate with nothing said about why they are
 * not signed in, which is the failure that function exists to prevent.
 */
function landAfterConfirming(): void {
  if (!new URLSearchParams(window.location.search).has("code")) return;

  let gate: string | null = null;
  try {
    gate = localStorage.getItem(GATE_KEY);
    localStorage.removeItem(GATE_KEY);
  } catch {
    return;
  }

  if (!isGate(gate)) return;
  if (window.location.hash && !window.location.hash.startsWith("#/")) return;
  history.replaceState(null, "", `${window.location.pathname}${window.location.search}#/${gate}`);
}

function start(view: HTMLElement, nav: HTMLElement): void {
  takeUrlIntent();
  landAfterConfirming();
  const cached = cachedProfile();
  let profile: Profile | null = cached?.profile ?? null;
  let userId: string | null = cached?.userId ?? null;
  let email = "";
  let signedIn = false;

  function drawNav(): void {
    // An honest hook for "is there a usable profile", rather than leaving that
    // to be inferred from whatever text happens to be on screen.
    document.body.dataset.signedIn = signedIn && profile ? "true" : "false";
    highlight(currentRoute());
  }

  /**
   * The nav is the same four tabs whatever the sign-in state, because it is one
   * product. Tapping a tab you cannot use yet lands on the register prompt, which
   * is a better answer than a nav that changes shape underneath you.
   */
  function highlight(route: Route): void {
    nav.innerHTML = navHtml(TAB_FOR_ROUTE[route.name] ?? route.name);
  }

  function render(): void {
    const route = currentRoute();
    highlight(route);

    // Present mode holds the screen awake. Leaving it by any route, including
    // the guide and the signed-out paths below, has to give that back.
    if (!(route.name === "plan" && route.rest[0] === "run")) stopRunClock();

    // The guide is what every grade is allowed to do, so it needs neither an
    // account nor a grade of your own. Being asked which one you coach is no
    // answer to "can we ruck yet". The grade you are moving up to in September
    // is also the one you want to read in August. Ahead of both checks for the
    // same reason a shared session is.
    if (route.name === "guide") {
      clearPrintable();
      renderGuide(view, route.param, profile?.ageGroup ?? chosenAge() ?? undefined);
      return;
    }

    if (!signedIn) {
      renderSignedOut(route);
      return;
    }
    // Ahead of the setup form for the same reason it is ahead of the age picker
    // signed out: being asked which grade you coach is no answer to a link.
    if (route.name === "shared" && route.param) {
      renderSharedPlan(view, route.param, profile?.ageGroup);
      return;
    }
    if (!profile) {
      // Signed in but the age group is missing, so there is nothing safe to show
      // in the catalogue. The account form doubles as the setup screen.
      renderAccount(view, null, email);
      return;
    }

    const ctx: PlannerContext = { userId: userId ?? "", ageGroup: profile.ageGroup };

    // The print sheet only belongs to the plan editor; leave it behind and a
    // Ctrl+P anywhere else would print the last session instead of the page
    if (route.name !== "plan") clearPrintable();

    switch (route.name) {
      // The gate is a signed-out screen. Arriving here with a session means the
      // coach has just got one, so send them on to whatever they were reaching
      // for rather than dropping them on the catalogue with nothing to show for it.
      //
      // Replaced rather than pushed. `go()` would leave the gate sitting in
      // history, where a Back tap lands on it and gets sent forwards again, which
      // is a coach who can no longer leave. Keyed off GATE_REASON so a third gate
      // cannot be added without a landing.
      case "join": {
        const reaching = isGate(route.param) ? route.param : "catalogue";
        history.replaceState(null, "", `#/${reaching}`);
        render();
        break;
      }
      case "account":
        renderAccount(view, profile, email);
        break;
      case "plans":
        renderPlanList(view, ctx);
        break;
      // Only reachable signed in by following a link somebody sent, since the
      // card itself takes the session outright once there is a list to put it
      // in. Doing the same here is the honest answer to the same tap.
      //
      // Replaced rather than left in history, the same as the join gate above
      // and for the same reason. This route makes a session as a side effect of
      // being on it, so a Back tap out of the editor would land here and make
      // another one. Then another on every tap after that.
      case "preset":
        history.replaceState(null, "", "#/plans");
        if (route.param) takePreset(ctx, route.param);
        else render();
        break;
      case "plan":
        // Viewing is the default. Editing is the deliberate detour.
        if (!route.param) go("plans");
        else if (route.rest[0] === "edit") renderPlanEditor(view, ctx, route.param);
        else if (route.rest[0] === "run") {
          renderPlanRun(view, ctx, route.param, Number(route.rest[1] ?? 0), Number(route.rest[2] ?? 0));
        } else renderPlanView(view, ctx, route.param);
        break;
      // Handled above the profile check, because a link is not a reason to ask
      // somebody which grade they coach. A bare #/shared has no session in it.
      case "shared":
        go("plans");
        break;
      default:
        renderCatalogue(view, profile.ageGroup, userId ?? "", route.param, route.rest);
    }
  }

  /**
   * Signed out is a real state rather than a wall.
   *
   * Drills are free to read, because the catalogue is the proof the thing is
   * worth an account. What needs an account is anything that has to persist. It
   * gets asked for at the point a coach reaches for it. See
   * `docs/one-product.md`.
   */
  function renderSignedOut(route: Route): void {
    if (route.name === "join") {
      renderAuth(view, "signup", GATE_REASON[route.param ?? ""] ?? "");
      return;
    }
    // A shared session is a document somebody sent you. It comes before the age
    // picker, because being asked which grade you coach is no answer to a link,
    // and the session says which grade it was written for anyway.
    if (route.name === "shared" && route.param) {
      renderSharedPlan(view, route.param, chosenAge() ?? undefined);
      return;
    }
    // The list of starred drills needs an account to exist. A drill under it
    // does not, so `#/favourites/<id>` stays readable like any other drill.
    if (route.name === "favourites" && !route.param) {
      renderAuth(view, "signup", GATE_REASON.favourites);
      return;
    }
    const chosen = chosenAge();
    // Reading a ready-made session is not something that has to persist, so it
    // is not something the account gates. Keeping one is, which is what the
    // button at the foot of it asks for. Both still need the grade, because a
    // preset belongs to one and there is nothing to show until it is known.
    if (chosen && (route.name === "plans" || route.name === "preset")) {
      if (route.name === "preset" && route.param) renderPresetView(view, route.param, chosen);
      else renderPresetList(view, chosen);
      return;
    }
    if (route.name === "plan" || route.name === "account") {
      const signIn = route.name === "account";
      renderAuth(view, signIn ? "signin" : "signup", signIn ? "" : GATE_REASON.plans);
      return;
    }
    const age = chosen;
    // Nothing can be shown until the grade is known, so this comes first
    if (!age) {
      renderAgePicker(view, render);
      return;
    }
    renderCatalogue(view, age, "", route.param, route.rest);
  }

  onRoute(() => {
    // Never leave an edit sitting in a debounce timer across a navigation
    if (userId) flushPlanPush(userId);
    // Inside the transition, both of them. `startViewTransition` runs its
    // callback a frame later, so anything left outside would happen before the
    // page had changed. Only this path is animated: the auth and online-retry
    // redraws further down are the app catching up with itself rather than a
    // coach going somewhere. A screen that slides on its own is a screen that
    // looks like it was tapped.
    transition("route", () => {
      render();
      // Every view renders into the same element, so a tap on a tab swapped the
      // whole page with nothing said about it and the next Tab started again
      // from the top. Moving focus to the view announces it and puts the tab
      // order where the coach is. Only on an actual navigation: the async syncs
      // redraw through their own views and must not pull focus out from under
      // anybody.
      view.focus({ preventScroll: true });
    });
  });

  // Backgrounding the tab is the last reliable moment to get an edit to the server
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && userId) flushPlanPush(userId);
  });

  // Coming back into signal is when a touchline edit can finally leave the device
  window.addEventListener("online", () => {
    if (!userId) return;
    void retryPending(userId).then((stillWaiting) => {
      if (stillWaiting === 0) render();
    });
    void retryFavourites(userId);
    void retryRuns(userId);
  });

  onAuthChange((session) => {
    const user = session?.user ?? null;
    signedIn = Boolean(user);
    email = user?.email ?? "";

    if (!user) {
      profile = null;
      userId = null;
      clearCachedProfile();
      clearLocalPlans();
      clearLocalFavourites();
      clearLocalRuns();
      resetPlanner();
      resetCatalogue();
    } else {
      if (userId && userId !== user.id) {
        // A different coach on the same device. Drop everything belonging to the
        // last one before any of it can be rendered
        clearLocalPlans();
        clearLocalFavourites();
        clearLocalRuns();
        resetPlanner();
        resetCatalogue();
      }
      const fresh = profileFromUser(user);
      if (fresh) {
        profile = fresh;
        userId = user.id;
        cacheProfile(user.id, fresh);
      } else if (userId !== user.id) {
        profile = null;
        userId = user.id;
        clearCachedProfile();
      }
    }

    drawNav();
    render();
  });

  // Kick off. OnAuthChange fires with the restored session, but call getSession
  // so a signed-out cold start paints immediately rather than waiting on it
  void getSession().then((session) => {
    reportLinkFailure(Boolean(session));
    if (!session) {
      drawNav();
      render();
    }
  });

  if (!window.location.hash) go("catalogue");
}

/**
 * Confirmation and reset links carry a PKCE code that only exchanges against the
 * verifier in the browser that asked for it. Open one on a different device and
 * supabase-js quietly leaves the code in the URL, which used to dump the coach on
 * the sign-in form with no explanation.
 */
function reportLinkFailure(hasSession: boolean): void {
  const query = new URLSearchParams(window.location.search);
  const fragment = new URLSearchParams(window.location.hash.replace(/^#\/?/, ""));
  const described = query.get("error_description") ?? fragment.get("error_description");

  if (described) showToast(described, undefined, 6000);
  else if (query.has("code") && !hasSession) {
    showToast("That link only works in the browser that asked for it.", undefined, 6000);
  } else return;

  // Don't leave a spent code sitting in the URL or the back stack
  window.history.replaceState(null, "", window.location.pathname + window.location.hash);
}

// The footer sits outside the view every route renders into, so this runs once
// and the control keeps working for the life of the page.
wireScheme();

// Focus the content directly rather than jumping to a fragment. An href of
// #hub-view would set the hash. The router watches the hash.
document.getElementById("skip-link")?.addEventListener("click", () => {
  document.getElementById("hub-view")?.focus();
});

// Deferred: service worker + analytics, same pattern as the rotation planner
function onIdle(fn: () => void): void {
  if ("requestIdleCallback" in window) requestIdleCallback(fn);
  else setTimeout(fn, 2000);
}

onIdle(() => {
  manageServiceWorker();
  import("@vercel/analytics").then(({ inject }) => inject());
});
