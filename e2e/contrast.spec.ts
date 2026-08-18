import { test, expect, type Page } from "@playwright/test";

/**
 * Text contrast, in both colour schemes.
 *
 * `pages.css` and `base.css` both carry fixed brand colours next to tokens that
 * flip with `prefers-color-scheme`. Reaching for the fixed one to colour text is
 * an easy mistake that looks fine in whichever scheme you happen to be in: it
 * shipped twice, once at 1.5:1 on a button border and once at 1.12:1 on the
 * homepage's own proof band. Eyes miss it, this does not.
 */

/** WCAG relative luminance. */
function luminance([r, g, b]: number[]): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function ratio(fg: number[], bg: number[]): number {
  const [a, b] = [luminance(fg), luminance(bg)];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

interface Sample {
  text: string;
  where: string;
  fg: number[];
  bg: number[];
  /** AA allows 3:1 for large text, 4.5:1 otherwise. */
  large: boolean;
}

/** Every element holding its own visible text, with the background behind it. */
async function samples(page: Page): Promise<Sample[]> {
  return page.evaluate(() => {
    const rgb = (value: string): number[] =>
      (value.match(/[\d.]+/g) ?? ["0", "0", "0"]).slice(0, 3).map(Number);

    /** Walk up for the first background that is not see-through. */
    const behind = (el: Element): number[] => {
      let node: Element | null = el;
      while (node) {
        const colour = getComputedStyle(node).backgroundColor;
        const parts = (colour.match(/[\d.]+/g) ?? []).map(Number);
        const opaque = parts.length < 4 || parts[3] > 0.9;
        if (colour && colour !== "transparent" && opaque && parts.some((n, i) => i < 3)) {
          if (!(parts.length === 4 && parts[3] === 0)) return parts.slice(0, 3);
        }
        node = node.parentElement;
      }
      return [255, 255, 255];
    };

    const out = [];
    for (const el of document.querySelectorAll("body *")) {
      const own = [...el.childNodes].some(
        (n) => n.nodeType === 3 && (n.textContent ?? "").trim().length > 1,
      );
      if (!own) continue;
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none") continue;
      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      const size = parseFloat(style.fontSize);
      const weight = Number(style.fontWeight) || 400;
      out.push({
        text: (el.textContent ?? "").trim().slice(0, 40),
        where: el.tagName.toLowerCase() + (el.className ? `.${String(el.className).split(" ")[0]}` : ""),
        fg: rgb(style.color),
        bg: behind(el),
        large: size >= 24 || (size >= 18.66 && weight >= 700),
      });
    }
    return out;
  });
}

for (const scheme of ["light", "dark"] as const) {
  for (const [name, url] of [
    ["homepage", "/"],
    ["planner", "/planner"],
  ] as const) {
    test(`${name} text meets AA contrast in ${scheme} mode`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize({ width: 1100, height: 900 });
      await page.goto(url);
      await page.waitForTimeout(300);

      const failures = (await samples(page))
        .map((s) => ({ ...s, contrast: ratio(s.fg, s.bg) }))
        .filter((s) => s.contrast < (s.large ? 3 : 4.5))
        .map((s) => `${s.where} "${s.text}" at ${s.contrast.toFixed(2)}:1`);

      expect(failures, `${scheme} mode contrast failures`).toEqual([]);
    });
  }
}

/**
 * Non-text contrast, WCAG 1.4.11. A control needs a 3:1 boundary against what it
 * sits on unless it is identifiable some other way. Every secondary button in
 * the hub was --color-surface on a --color-surface panel with a --color-border
 * edge, which measured 1.19:1: a button you could only find by guessing.
 */
test("controls have a visible edge against what they sit on", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 820 });
  await page.addInitScript(() => localStorage.setItem("equalplay_age_group", "u10"));
  await page.goto("/hub/#/catalogue");
  await expect(page.locator(".hub-btn").first()).toBeVisible();

  const controls = await page.evaluate(() => {
    const rgb = (value: string): number[] =>
      (value.match(/[\d.]+/g) ?? ["0", "0", "0"]).slice(0, 3).map(Number);
    const behind = (el: Element): number[] => {
      let node: Element | null = el.parentElement;
      while (node) {
        const parts = (getComputedStyle(node).backgroundColor.match(/[\d.]+/g) ?? []).map(Number);
        if (parts.length === 3 || (parts.length === 4 && parts[3] > 0.9)) return parts.slice(0, 3);
        node = node.parentElement;
      }
      return [255, 255, 255];
    };
    return [...document.querySelectorAll(".hub-btn")]
      .filter((el) => el.getBoundingClientRect().width > 0)
      .map((el) => ({
        label: (el.textContent ?? "").trim().slice(0, 24),
        edge: rgb(getComputedStyle(el).borderColor),
        fill: rgb(getComputedStyle(el).backgroundColor),
        behind: behind(el),
      }));
  });

  expect(controls.length).toBeGreaterThan(0);
  const invisible = controls
    // Identifiable by its edge or by its fill. Either will do.
    .filter((c) => Math.max(ratio(c.edge, c.behind), ratio(c.fill, c.behind)) < 3)
    .map((c) => `"${c.label}" at ${ratio(c.edge, c.behind).toFixed(2)}:1`);
  expect(invisible, "controls with no visible boundary").toEqual([]);
});
