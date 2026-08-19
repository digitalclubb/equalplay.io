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

/**
 * Icons are written out here rather than imported, so this module keeps its one
 * useful property. It pulls in nothing, so it can never drag anything into the
 * planner's bundle. Same shape as `components/icons.ts`, meaning a 24 viewBox
 * drawn in strokes on `currentColor`, so a tab's icon and its label change
 * colour together.
 */
const ICON = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';

/**
 * A marker cone on the ground, which is what a coach puts down before any drill.
 * The first go had a stripe across the middle and read as a capital A at the
 * twenty pixels this is actually drawn at. The ground line carries it instead.
 */
const iconDrills = `<svg class="hub-tab-icon" ${ICON}><path d="M12 3.5 6 17.5h12z"/><path d="M3.5 20.5h17"/></svg>`;

/** A plan sheet, ruled. */
const iconSessions = `<svg class="hub-tab-icon" ${ICON}><rect x="4" y="3.5" width="16" height="17" rx="2.5"/><path d="M8 9h8"/><path d="M8 13h8"/><path d="M8 17h5"/></svg>`;

/** Two arrows swapping, which is the whole of match day. */
const iconMatchDay = `<svg class="hub-tab-icon" ${ICON}><path d="M16 3.5 20 7.5l-4 4"/><path d="M20 7.5H4"/><path d="M8 20.5 4 16.5l4-4"/><path d="M4 16.5h16"/></svg>`;

/** One person, because an account belongs to one coach. */
const iconAccount = `<svg class="hub-tab-icon" ${ICON}><circle cx="12" cy="8" r="3.6"/><path d="M4.8 20.5c.6-3.8 3.7-5.8 7.2-5.8s6.6 2 7.2 5.8"/></svg>`;

export interface NavItem {
  /** The hub's route name, or "planner" for the entry that is its own document. */
  key: string;
  label: string;
  /** Inline SVG. Hidden from assistive technology: the label beside it says it. */
  icon: string;
}

/**
 * Order is the order a coach uses them. Drills to find something, Sessions to
 * build it, Match day on the Sunday. Account is the odd one out and sits last,
 * pinned to the foot of the rail once there is a rail to pin it to.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { key: "catalogue", label: "Drills", icon: iconDrills },
  { key: "plans", label: "Sessions", icon: iconSessions },
  { key: "planner", label: "Match day", icon: iconMatchDay },
  { key: "account", label: "Account", icon: iconAccount },
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
  return NAV_ITEMS.map(({ key, label, icon }) => {
    const current = key === active;
    return `<a href="${navHref(key, hubBase)}" class="hub-tab${current ? " is-active" : ""}"${
      current ? ' aria-current="page"' : ""
    } data-route="${key}">${icon}<span class="hub-tab-label">${label}</span></a>`;
  }).join("");
}
