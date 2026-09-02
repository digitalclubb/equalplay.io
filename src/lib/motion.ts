/**
 * A change to the page, animated by the browser rather than measured by us.
 *
 * `startViewTransition` takes a picture of the page, runs `update`, takes
 * another, then animates between the two. Anything carrying a
 * `view-transition-name` is matched across the pair by that name and moved from
 * where it was to where it ended up. That is the whole of the sliding pill in
 * the nav and the filters: the name sits on whichever tab is active, so when a
 * different tab becomes active the browser has the same pill in two places and
 * slides it, with no bounding boxes read in JavaScript and nothing to go stale.
 *
 * `kind` lands on `<html>` as `data-vt` for the length of it, so one mechanism
 * can give a route change and a filter change different animations from the
 * stylesheet. See the view transitions section of `base.css`.
 *
 * Two paths skip it and call `update` on the spot. A browser without the API
 * gets the swap it has always had. So does a coach who has asked for less
 * motion. The reduced-motion sweep in `base.css` matches elements and the
 * `::view-transition` tree is not one, so this is the only place that can honour
 * it. Neither is a degraded page, only an unanimated one.
 *
 * This module imports nothing, like `lib/nav.ts`, because the match-day planner
 * uses it too and nothing may drag `@supabase/supabase-js` into that bundle.
 */

export function transition(kind: string, update: () => void): void {
  // `in` rather than a plain truthiness check: TypeScript's DOM types have this
  // as always present, which is a promise about a browser rather than about this
  // one. Safari got it in 18 and Firefox in 133.
  const supported = "startViewTransition" in document;
  if (!supported || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    update();
    return;
  }

  const root = document.documentElement;
  root.dataset.vt = kind;
  const clear = (): void => {
    delete root.dataset.vt;
  };
  // Both arms, because `finished` rejects when a second navigation cuts this one
  // short. That is an ordinary thing for a coach to do and not an error, but an
  // unhandled rejection would still be logged and `data-vt` would stick.
  void document.startViewTransition(update).finished.then(clear, clear);
}
