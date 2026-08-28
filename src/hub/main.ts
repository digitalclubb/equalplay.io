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
  renderSharedPlan,
  resetPlanner,
  stopRunClock,
  type PlannerContext,
} from "./views/planner.js";
import { clearLocalPlans, retryPending } from "./plans.js";
import { clearLocalFavourites, retryFavourites } from "./favourites.js";
import { showToast } from "../components/toast.js";
import {
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
import { navHtml } from "../lib/nav.js";
import { chosenAge } from "./ageChoice.js";
import { renderAgePicker } from "./views/agePicker.js";
import { renderGuide } from "./views/guide.js";

/**
 * Routes that belong to a tab of another name. The plan editor lives under
 * #/plan/<id> but is part of Sessions. A bare hash renders the catalogue. So does
 * #/favourites, which is the same list with the stars kept in.
 */
const TAB_FOR_ROUTE: Record<string, string> = {
  plan: "plans",
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

function start(view: HTMLElement, nav: HTMLElement): void {
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
        const reaching = route.param && route.param in GATE_REASON ? route.param : "catalogue";
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
      case "plan":
        // Viewing is the default. Editing is the deliberate detour.
        if (!route.param) go("plans");
        else if (route.rest[0] === "edit") renderPlanEditor(view, ctx, route.param);
        else if (route.rest[0] === "run") {
          renderPlanRun(view, ctx, route.param, Number(route.rest[1] ?? 0));
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
    if (route.name === "plans" || route.name === "plan" || route.name === "account") {
      const signIn = route.name === "account";
      renderAuth(view, signIn ? "signin" : "signup", signIn ? "" : GATE_REASON.plans);
      return;
    }
    const age = chosenAge();
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
    render();
    // Every view renders into the same element, so a tap on a tab swapped the
    // whole page with nothing said about it and the next Tab started again from
    // the top. Moving focus to the view announces it and puts the tab order
    // where the coach is. Only on an actual navigation: the async syncs redraw
    // through their own views and must not pull focus out from under anybody.
    view.focus({ preventScroll: true });
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
      resetPlanner();
      resetCatalogue();
    } else {
      if (userId && userId !== user.id) {
        // A different coach on the same device. Drop everything belonging to the
        // last one before any of it can be rendered
        clearLocalPlans();
        clearLocalFavourites();
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
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js");
  import("@vercel/analytics").then(({ inject }) => inject());
});
