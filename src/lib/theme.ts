/**
 * The colour scheme a coach picked, if they picked one.
 *
 * Following the phone is the default and covers almost everybody, so this is
 * not a setting anybody has to find. It exists for the case the phone gets
 * wrong. A screen pinned to dark is harder to read than a light one at a bright
 * pitch on a Sunday morning. Nobody is going into their system settings with
 * cold wet hands to fix it.
 *
 * Imports nothing, the same rule `lib/nav.ts` follows. Both entries use it, so
 * anything pulled in here would land in the match-day bundle that exists to
 * stay small.
 *
 * The value is written to `<html>` as `data-theme` and `src/base.css` turns
 * that into a `color-scheme`, which is the whole mechanism: every token is a
 * `light-dark()` pair reading it. Absent means follow the phone.
 */

export const SCHEMES = ["system", "light", "dark"] as const;
export type Scheme = (typeof SCHEMES)[number];

/** Not namespaced under a coach. A phone is a phone whoever is signed in. */
export const SCHEME_KEY = "equalplay_scheme";

const LABELS: Record<Scheme, string> = {
  system: "Auto",
  light: "Light",
  dark: "Dark",
};

function isScheme(value: unknown): value is Scheme {
  return typeof value === "string" && (SCHEMES as readonly string[]).includes(value);
}

export function storedScheme(): Scheme {
  try {
    const held = localStorage.getItem(SCHEME_KEY);
    return isScheme(held) ? held : "system";
  } catch {
    // Private browsing. Following the phone is the right answer anyway
    return "system";
  }
}

/**
 * Writes the choice onto `<html>`.
 *
 * `system` removes the attribute rather than setting it to anything, so the
 * media query behind `light-dark()` is left to answer on its own.
 */
export function applyScheme(scheme: Scheme): void {
  const root = document.documentElement;
  if (scheme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", scheme);
}

export function chooseScheme(scheme: Scheme): void {
  applyScheme(scheme);
  try {
    if (scheme === "system") localStorage.removeItem(SCHEME_KEY);
    else localStorage.setItem(SCHEME_KEY, scheme);
  } catch {
    // It still applies for this visit, which is better than refusing to switch
  }
}

/**
 * One icon each, drawn the way `lib/nav.ts` draws the tabs: a 24 viewBox in
 * strokes on `currentColor`, so the glyph and the control change colour
 * together. Written out here for the same reason the tabs are, meaning this
 * module still pulls in nothing.
 *
 * A monitor for Auto, because what it follows is the device. A sun and a moon
 * for the two a coach can force.
 */
const ICON = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';

const ICONS: Record<Scheme, string> = {
  system: `<svg ${ICON}><rect x="3" y="4" width="18" height="12.5" rx="2"/><path d="M12 16.5v4"/><path d="M8.5 20.5h7"/></svg>`,
  light: `<svg ${ICON}><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2"/><path d="M12 19.5v2"/><path d="M2.5 12h2"/><path d="M19.5 12h2"/><path d="m5.28 5.28 1.42 1.42"/><path d="m17.3 17.3 1.42 1.42"/><path d="m18.72 5.28-1.42 1.42"/><path d="m6.7 17.3-1.42 1.42"/></svg>`,
  dark: `<svg ${ICON}><path d="M20.5 14.6A8.6 8.6 0 0 1 9.4 3.5a8.6 8.6 0 1 0 11.1 11.1z"/></svg>`,
};

/** Auto, then the two a coach can force, then back. */
export function nextScheme(scheme: Scheme): Scheme {
  return SCHEMES[(SCHEMES.indexOf(scheme) + 1) % SCHEMES.length] as Scheme;
}

/**
 * The control, written out by both entries the way the nav is.
 *
 * One button that cycles rather than three that choose. It sits in the chrome
 * now, top right of the bar on a phone. At 320px the logo leaves about 110px
 * beside it, which is one 48px target rather than three. The icon carries the
 * state, which is what stops Auto and Light being indistinguishable on a phone
 * already set to light: the page does not change, the glyph does.
 *
 * The name says where you are rather than where the tap goes. "Colours: Dark"
 * is true the moment it is read. "Switch to light" is a promise about the next
 * tap that is wrong as soon as somebody tabs past it.
 *
 * The written label shows only in the rail at 900px, where every other row is
 * an icon beside a word and a bare glyph reads as something left behind. The
 * `aria-label` covers the button either way, so the span is never announced
 * twice.
 */
export function schemeHtml(active: Scheme = "system"): string {
  const name = `Colours: ${LABELS[active]}`;
  return `<button type="button" class="scheme-toggle" data-scheme="${active}" title="${name}" aria-label="${name}">${ICONS[active]}<span class="scheme-name">${LABELS[active]}</span></button>`;
}

/**
 * Wires the control up once. It lives in the chrome, which sits outside the
 * view every route renders into, so it is never replaced and never rewired.
 */
export function wireScheme(root: ParentNode = document): void {
  const button = root.querySelector<HTMLButtonElement>(".scheme-toggle");
  if (!button) return;

  const paint = (scheme: Scheme): void => {
    const name = `Colours: ${LABELS[scheme]}`;
    button.dataset.scheme = scheme;
    button.innerHTML = `${ICONS[scheme]}<span class="scheme-name">${LABELS[scheme]}</span>`;
    button.title = name;
    button.setAttribute("aria-label", name);
  };

  // The markup ships on Auto, because the HTML is written before anyone knows
  // what is stored. This is the first moment that can be corrected.
  //
  // Applied as well as painted. The inline script in each entry has normally
  // done that already, so this is a no-op, but a module that only paints tells
  // the coach it is on Dark while the document follows the phone the moment
  // that script does not run.
  //
  // Held here rather than read back off the button or out of storage on each
  // tap. Private browsing throws on write. A cycle that re-read storage each
  // time would then bounce between Auto and Light for ever, never reaching
  // Dark.
  let active = storedScheme();
  applyScheme(active);
  paint(active);

  button.addEventListener("click", () => {
    active = nextScheme(active);
    chooseScheme(active);
    paint(active);
  });
}
