/**
 * The colour scheme a coach is on.
 *
 * Two states, Light and Dark. The phone decides which one a coach starts on, so
 * it is not a setting anybody has to find. It exists for the case the phone
 * gets wrong: a screen pinned to dark is harder to read than a light one at a
 * bright pitch on a Sunday morning. Nobody is going into their system settings
 * with cold wet hands to fix it.
 *
 * There is deliberately no third "follow the phone" state. It read as a mode of
 * its own rather than as the two colours it picks between. Its monitor glyph on
 * a phone said Desktop rather than System. Following the phone is still what
 * happens, it is just the starting point rather than a thing to choose. The
 * cost is that a coach who taps it once stops following the phone from then
 * on.
 *
 * Imports nothing, the same rule `lib/nav.ts` follows. Both entries use it, so
 * anything pulled in here would land in the match-day bundle that exists to
 * stay small.
 *
 * The value is written to `<html>` as `data-theme` and `src/base.css` turns
 * that into a `color-scheme`, which is the whole mechanism: every token is a
 * `light-dark()` pair reading it.
 */

export const SCHEMES = ["light", "dark"] as const;
export type Scheme = (typeof SCHEMES)[number];

/** Not namespaced under a coach. A phone is a phone whoever is signed in. */
export const SCHEME_KEY = "equalplay_scheme";

const LABELS: Record<Scheme, string> = {
  light: "Light",
  dark: "Dark",
};

function isScheme(value: unknown): value is Scheme {
  return typeof value === "string" && (SCHEMES as readonly string[]).includes(value);
}

/** The query the phone answers, held once so the listener and the read agree. */
const DARK = "(prefers-color-scheme: dark)";

/** What the phone asks for, which is where a coach who has never tapped starts. */
function systemScheme(): Scheme {
  return globalThis.matchMedia?.(DARK).matches ? "dark" : "light";
}

/** What a coach chose, or null for nobody has chosen. */
function heldScheme(): Scheme | null {
  try {
    const held = localStorage.getItem(SCHEME_KEY);
    return isScheme(held) ? held : null;
  } catch {
    // Private browsing. The phone's own answer is the right one anyway
    return null;
  }
}

export function storedScheme(): Scheme {
  return heldScheme() ?? systemScheme();
}

/** Writes the choice onto `<html>`. */
export function applyScheme(scheme: Scheme): void {
  document.documentElement.setAttribute("data-theme", scheme);
}

export function chooseScheme(scheme: Scheme): void {
  applyScheme(scheme);
  try {
    localStorage.setItem(SCHEME_KEY, scheme);
  } catch {
    // It still applies for this visit, which is better than refusing to switch
  }
}

/**
 * One icon each, drawn the way `lib/nav.ts` draws the tabs: a 24 viewBox in
 * strokes on `currentColor`, so the glyph and the control change colour
 * together. Written out here for the same reason the tabs are, meaning this
 * module still pulls in nothing.
 */
const ICON = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';

const ICONS: Record<Scheme, string> = {
  light: `<svg ${ICON}><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2"/><path d="M12 19.5v2"/><path d="M2.5 12h2"/><path d="M19.5 12h2"/><path d="m5.28 5.28 1.42 1.42"/><path d="m17.3 17.3 1.42 1.42"/><path d="m18.72 5.28-1.42 1.42"/><path d="m6.7 17.3-1.42 1.42"/></svg>`,
  dark: `<svg ${ICON}><path d="M20.5 14.6A8.6 8.6 0 0 1 9.4 3.5a8.6 8.6 0 1 0 11.1 11.1z"/></svg>`,
};

/** The other one. */
export function nextScheme(scheme: Scheme): Scheme {
  return scheme === "dark" ? "light" : "dark";
}

/**
 * The control, written out by both entries the way the nav is.
 *
 * One button that flips. It sits in the chrome, top right of the bar on a
 * phone: at 320px the logo leaves about 110px beside it, which is one 48px
 * target rather than a pair of pills.
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
export function schemeHtml(active: Scheme = "light"): string {
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

  // The markup ships on Light, because the HTML is written before anyone knows
  // what the phone asks for or what is stored. It is right for a light phone
  // and for a coach who chose light. Wiring up is the first moment the other
  // two cases can be corrected.
  //
  // Nothing chosen means nothing is written to `<html>` either. The media query
  // behind `light-dark()` is still answering, the same as it is on the static
  // pages, which have no bundle to wire anything up. Pinning the attribute to
  // whatever the phone said at load would leave the hub light at sunset while
  // the homepage went dark.
  //
  // Both held here rather than read back off the button or out of storage on
  // each tap. Private browsing throws on write, so a flip that re-read storage
  // would land on the same scheme every time and the button would never move.
  let chosen = heldScheme();
  let active = chosen ?? systemScheme();
  if (chosen) applyScheme(active);
  paint(active);

  // Until a coach chooses, the phone is still in charge, so the glyph follows
  // it rather than freezing on whichever it asked for at load.
  globalThis.matchMedia?.(DARK).addEventListener("change", () => {
    if (!chosen) paint((active = systemScheme()));
  });

  button.addEventListener("click", () => {
    active = nextScheme(active);
    chosen = active;
    chooseScheme(active);
    paint(active);
  });
}
