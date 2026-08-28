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
 * The control, written out by both entries the way the nav is.
 *
 * Buttons rather than a select, because a select costs two taps and this is one
 * of three. `aria-pressed` rather than a radio group: nothing is submitted and
 * the change is immediate, which is what a toggle button describes.
 */
export function schemeHtml(active: Scheme = "system"): string {
  const buttons = SCHEMES.map(
    (scheme) =>
      `<button type="button" class="scheme-option${scheme === active ? " is-active" : ""}" data-scheme="${scheme}" aria-pressed="${scheme === active}">${LABELS[scheme]}</button>`,
  ).join("");

  return `<div class="scheme-switch" role="group" aria-label="Colour scheme">
        <span class="scheme-label" aria-hidden="true">Colours</span>
        ${buttons}
      </div>`;
}

/**
 * Wires the control up once. The footer sits outside the view every route
 * renders into, so it is never replaced and never needs rewiring.
 */
export function wireScheme(root: ParentNode = document): void {
  const group = root.querySelector<HTMLElement>(".scheme-switch");
  if (!group) return;

  const paint = (active: Scheme): void => {
    for (const button of group.querySelectorAll<HTMLButtonElement>("[data-scheme]")) {
      const on = button.dataset.scheme === active;
      button.classList.toggle("is-active", on);
      button.setAttribute("aria-pressed", String(on));
    }
  };

  // The markup ships with Auto lit, because the HTML is written before anyone
  // knows what is stored. This is the first moment that can be corrected.
  //
  // Applied as well as painted. The inline script in each entry has normally
  // done that already, so this is a no-op, but a module that only paints tells
  // the coach it is on Dark while the document follows the phone the moment
  // that script does not run.
  const stored = storedScheme();
  applyScheme(stored);
  paint(stored);

  group.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-scheme]");
    const scheme = button?.dataset.scheme;
    if (!isScheme(scheme)) return;
    chooseScheme(scheme);
    paint(scheme);
  });
}
