import { esc } from "./esc.js";

/**
 * Links to the RFU's own rules of play.
 *
 * The wording lives here rather than at each call site so it cannot drift into
 * three different shapes, which is what happened first time round. Source first,
 * age grade second, no trailing clause.
 */
export function rulesLink(label: string, url: string, className = "rules-link"): string {
  return `<a class="${className}" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(
    label,
  )}<span class="visually-hidden"> (opens the England Rugby site in a new tab)</span></a>`;
}

/** The standard label for one age grade, e.g. "RFU rules of play for U10". */
export function ageRulesLink(
  ageLabel: string,
  url: string,
  className?: string,
): string {
  return rulesLink(`RFU rules of play for ${ageLabel}`, url, className);
}
