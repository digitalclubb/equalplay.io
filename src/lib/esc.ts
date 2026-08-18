/**
 * Escape user-supplied text for interpolation into innerHTML.
 *
 * Quotes are escaped too, so the result is safe inside a double- or
 * single-quoted attribute as well as in text content. TeamTabs.ts renders a
 * team name into an `value="..."` attribute and a name containing a quote
 * would otherwise break out of it.
 */
export function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
