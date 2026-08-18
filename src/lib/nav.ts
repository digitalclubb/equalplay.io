/**
 * The one navigation, shared by both entries.
 *
 * Equal Play is one product. It ships as two Vite entries only because
 * `@supabase/supabase-js` is ~220 kB and `/planner` is the indexed page, so this
 * module deliberately imports nothing from `hub/supabase.js`. Anything it pulled
 * in would land in the planner's bundle and undo the split.
 *
 * See `docs/one-product.md`.
 */

export interface NavItem {
  /** The hub's route name, or "planner" for the entry that is its own document. */
  key: string;
  label: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { key: "catalogue", label: "Drills" },
  { key: "planner", label: "Match day" },
  { key: "plans", label: "Sessions" },
  { key: "account", label: "Account" },
];

/**
 * `hubBase` is "" on the hub itself, so its links stay bare fragments and never
 * reload the document. A path-qualified href would, because `/hub` and `/hub/`
 * are different paths and the host serves both.
 */
export function navHref(key: string, hubBase = ""): string {
  return key === "planner" ? "/planner" : `${hubBase}#/${key}`;
}

export function navHtml(active: string, hubBase = ""): string {
  return NAV_ITEMS.map(({ key, label }) => {
    const current = key === active;
    return `<a href="${navHref(key, hubBase)}" class="hub-tab${current ? " is-active" : ""}"${
      current ? ' aria-current="page"' : ""
    } data-route="${key}">${label}</a>`;
  }).join("");
}
