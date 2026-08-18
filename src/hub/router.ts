/**
 * Hash routing. Hash rather than history API so the hub needs no rewrite rules
 * on the host. `/hub` is a plain static file and every view is a fragment of it.
 */
export interface Route {
  name: string;
  param?: string;
  /**
   * Anything after the first two segments.
   *
   * Used to carry where a drill was opened from, so the back link on a drill can
   * say "back to the session" and mean it, still correct after a reload.
   */
  rest: string[];
}

export function currentRoute(): Route {
  const [name = "", param, ...rest] = window.location.hash.replace(/^#\/?/, "").split("/");
  return { name: name || "home", param: param || undefined, rest: rest.filter(Boolean) };
}

export function go(path: string): void {
  const next = `#/${path.replace(/^#?\/?/, "")}`;
  if (window.location.hash === next) return;
  window.location.hash = next;
}

/**
 * True when the route has not moved on.
 *
 * Async work resolves into whichever view is on screen, not the one that started
 * it. Without this a slow favourites sync repaints the drill catalogue over an
 * open session, because both render into the same element.
 */
export function stillOn(name: string, param?: string): boolean {
  const route = currentRoute();
  if (route.name !== name) return false;
  return param === undefined || route.param === param;
}

export function onRoute(fn: (route: Route) => void): void {
  window.addEventListener("hashchange", () => {
    // Routes are `#/name`. A bare fragment is an in-page anchor, like the skip
    // link pointing at #hub-view, so it should scroll without navigating.
    if (window.location.hash && !window.location.hash.startsWith("#/")) return;
    fn(currentRoute());
  });
}
