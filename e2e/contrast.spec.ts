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
  // `content-visibility: auto` on the drill cards means the browser lays out
  // only what is near the viewport, and everything else reports a zero box and
  // gets skipped below. That would quietly narrow this sweep to the five cards
  // on screen, so it is switched off for the measurement only.
  await page.addStyleTag({ content: "* { content-visibility: visible !important; }" });
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

/**
 * A signed-in session, written in before the page scripts run.
 *
 * Everything past the sign-in screen used to be invisible to this file, which
 * is most of the app: the running order a coach holds at a pitch, the session
 * editor, the account page. The sweep below found four failures in the dark
 * scheme the first time it could see them, one of them the active nav tab at
 * 1.12:1, which is the third time that exact shape of mistake has shipped.
 */
async function signIn(page: Page, hash: string, scheme?: "light" | "dark") {
  await page.addInitScript(
    ([key, value, forced]) => {
      if (localStorage.getItem("__seeded")) return;
      localStorage.clear();
      localStorage.setItem("__seeded", "1");
      localStorage.setItem(key, value);
      localStorage.setItem("equalplay_hub_welcomed", "1");
      // Set inside the same script as the clear above, or the clear wipes it
      if (forced) localStorage.setItem("equalplay_scheme", forced);
    },
    [
      "sb-example-auth-token",
      JSON.stringify({
        access_token: "stub",
        token_type: "bearer",
        expires_in: 360_000,
        expires_at: Math.floor(Date.now() / 1000) + 360_000,
        refresh_token: "stub",
        user: {
          id: "00000000-0000-4000-8000-000000000001",
          aud: "authenticated",
          role: "authenticated",
          email: "coach@example.com",
          created_at: "2026-08-17T00:00:00Z",
          app_metadata: {},
          user_metadata: { name: "A Coach", club: "A club", age_group: "u10" },
        },
      }),
      scheme ?? "",
    ],
  );
  await page.goto(`/hub/${hash}`);
  await page.waitForSelector('body[data-signed-in="true"]');
}

for (const scheme of ["light", "dark"] as const) {
  for (const [name, hash] of [
    ["the drill list", "#/catalogue"],
    ["a drill", "#/catalogue/drill-two-second-ruck"],
    ["the sessions list", "#/plans"],
    ["a rules guide", "#/guide/u10"],
    ["the account page", "#/account"],
  ] as const) {
    test(`${name} meets AA contrast in ${scheme} mode, signed in`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize({ width: 390, height: 844 });
      await signIn(page, hash);
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
 * The match screen, not the setup form.
 *
 * `/planner` cold is a squad list and a button. Everything a coach looks at on
 * a Sunday is behind that button, so loading the URL alone left the game cards,
 * the section headings and the fairness table unmeasured. Three fixed navy
 * colours were sitting on surfaces that flip, one of them the only marking on
 * the current game.
 */
async function runningMatch(page: Page) {
  await page.goto("/planner");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector(".btn-generate");

  const inputs = page.locator(".player-input");
  for (let i = 0; i < 9; i += 1) {
    if ((await inputs.count()) <= i) await page.getByText("+ Add player").click();
    await inputs.nth(i).fill(`Player ${i + 1}`);
  }
  await page.locator("#players-per-team").fill("7");
  await page.locator("#num-games").fill("3");
  await page.getByRole("button", { name: "Sort my team" }).click();
  await page.waitForSelector("[data-testid^='game-']");
  await page.locator(".btn-start-match").click();
  await page.waitForSelector(".game-card-current");
}

for (const scheme of ["light", "dark"] as const) {
  test(`the match screen meets AA contrast in ${scheme} mode`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.setViewportSize({ width: 390, height: 844 });
    await runningMatch(page);
    await page.waitForTimeout(300);

    const failures = (await samples(page))
      .map((s) => ({ ...s, contrast: ratio(s.fg, s.bg) }))
      .filter((s) => s.contrast < (s.large ? 3 : 4.5))
      .map((s) => `${s.where} "${s.text}" at ${s.contrast.toFixed(2)}:1`);

    expect(failures, `${scheme} mode contrast failures`).toEqual([]);
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
for (const scheme of ["light", "dark"] as const) {
for (const [name, reach] of [
  ["the drill list", async (page: Page) => {
    await page.addInitScript(() => localStorage.setItem("equalplay_age_group", "u10"));
    await page.goto("/hub/#/catalogue");
    await expect(page.locator(".chip-filter").first()).toBeVisible();
  }],
  // The steppers, the add rows and the minutes boxes only exist here. Listing
  // their selectors while standing on the catalogue matched nothing at all, so
  // the coverage this test claimed was not coverage.
  ["the session editor", async (page: Page) => {
    await signIn(page, "#/plans");
    await page.locator(".preset-card").first().click();
    await expect(page.locator(".block-controls button").first()).toBeVisible();
  }],
  // The planner is the other half of the product and its controls were never in
  // here at all. Setup only reaches the three number inputs, so this plays a
  // match: the stepper, the pitch and kick-off boxes and the end game button
  // only exist once the whistle has gone, which is where a coach is standing
  // when they need to find them.
  ["match day", async (page: Page) => {
    await page.goto("/planner/");
    const names = page.locator(".player-input");
    for (const [i, name] of ["Alice", "Bob", "Cara", "Dan"].entries()) {
      if ((await names.count()) <= i) await page.getByText("+ Add player").click();
      await names.nth(i).fill(name);
    }
    await page.locator("#players-per-team").fill("2");
    await page.getByRole("button", { name: "Sort my team" }).click();
    await page.getByRole("button", { name: "Start game" }).first().click();
    // The pitch and kick-off boxes are behind "Add details" and render hidden
    // until it is tapped. Listed but never opened, they measure zero wide and
    // are dropped, which is coverage this file has claimed falsely before.
    await page.locator(".match-details-text").first().click();
    await expect(page.locator(".match-detail-input").first()).toBeVisible();
    // Still unmeasured: end game, which only renders on the last game of the
    // day, and the action sheet's buttons, which need a different journey.
    // Both carry the control edge token. Neither is checked by anything.
  }],
] as const) {
test(`controls on ${name} have a visible edge in ${scheme} mode`, async ({ page }) => {
  await page.emulateMedia({ colorScheme: scheme });
  await page.setViewportSize({ width: 900, height: 820 });
  await reach(page);

  const controls = await page.evaluate(() => {
    const rgb = (value: string): number[] =>
      (value.match(/[\d.]+/g) ?? ["0", "0", "0"]).slice(0, 3).map(Number);
    // A transparent fill is not a fill. `rgba(0, 0, 0, 0)` parses to black,
    // which then "passes" against any light panel, so every control with no
    // background of its own was being waved through on a colour it does not
    // paint.
    const opaque = (value: string): boolean => {
      const parts = (value.match(/[\d.]+/g) ?? []).map(Number);
      return parts.length < 4 || parts[3] > 0.9;
    };
    const behind = (el: Element): number[] => {
      let node: Element | null = el.parentElement;
      while (node) {
        const parts = (getComputedStyle(node).backgroundColor.match(/[\d.]+/g) ?? []).map(Number);
        if (parts.length === 3 || (parts.length === 4 && parts[3] > 0.9)) return parts.slice(0, 3);
        node = node.parentElement;
      }
      return [255, 255, 255];
    };
    // Not just `.hub-btn`. That was the one control this ever checked, so the
    // chips, the inputs, the selects and the steppers all sat at 1.25:1 with
    // nothing to say so. A card is left out on purpose: it is identified by the
    // title inside it rather than by its outline, which is the exception the
    // success criterion makes.
    return [...document.querySelectorAll(".hub-btn, .chip-filter, .hub-field input, .hub-field select, .age-select, .add-row, .block-controls button, .block-minutes input, .preset-card, .hub-reveal, .setup-field input, .player-input, .btn-add-player, .action-btn, .team-tab, .grade-size, .team-size-btn, .match-detail-input, .btn-next-game, .btn-start-match")]
      .filter((el) => el.getBoundingClientRect().width > 0)
      .map((el) => ({
        label: (el.textContent ?? "").trim().slice(0, 24),
        // Every side that is actually drawn, not the shorthand. `borderColor`
        // resolves to the top edge, so a control whose only border is one side
        // was measured on a side it does not have: .match-detail-input has
        // `border: none` plus a bottom rule, and its top resolved to
        // currentColor, which always passes. The check could not fail.
        fillCounts: opaque(getComputedStyle(el).backgroundColor),
        edges: (["Top", "Right", "Bottom", "Left"] as const)
          .filter((side) => parseFloat(getComputedStyle(el)[`border${side}Width`]) > 0)
          .map((side) => rgb(getComputedStyle(el)[`border${side}Color`])),
        fill: rgb(getComputedStyle(el).backgroundColor),
        behind: behind(el),
      }));
  });

  expect(controls.length).toBeGreaterThan(0);
  // Identifiable by any drawn edge or by its fill. Any one will do.
  const best = (c: {
    edges: number[][];
    fill: number[];
    fillCounts: boolean;
    behind: number[];
  }): number =>
    Math.max(
      c.fillCounts ? ratio(c.fill, c.behind) : 0,
      ...c.edges.map((edge) => ratio(edge, c.behind)),
      0,
    );
  const invisible = controls
    .filter((c) => best(c) < 3)
    .map((c) => `"${c.label}" at ${best(c).toFixed(2)}:1`);
  expect(controls.length, "nothing matched, so nothing was checked").toBeGreaterThan(3);
  expect(invisible, "controls with no visible boundary").toEqual([]);
});
}
}

/**
 * Hover states, which the resting sweep above cannot see.
 *
 * A hover rule that lifts a tab's colour is written for the tabs you are not
 * on. The one you are on is a white pill with navy text at this width, so the
 * same rule painted white on white and the tab went blank: no label, no icon,
 * just a shape. It measured 1:1, which is worse than either of the two that
 * made this file necessary in the first place.
 */
for (const [where, width] of [
  ["the phone bar", 390],
  ["the rail", 1100],
] as const) {
  test(`a hovered nav tab stays readable on ${where}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => localStorage.setItem("equalplay_age_group", "u10"));
    await page.goto("/hub/#/catalogue");
    await page.waitForSelector(".hub-tab.is-active");

    const failures: string[] = [];
    for (const tab of await page.locator(".hub-tab").all()) {
      await tab.hover();
      const seen = await tab.evaluate((el) => {
        const rgb = (value: string) =>
          (value.match(/[\d.]+/g) ?? ["0", "0", "0"]).slice(0, 3).map(Number);
        let node: Element | null = el;
        let bg = [255, 255, 255];
        while (node) {
          const parts = (getComputedStyle(node).backgroundColor.match(/[\d.]+/g) ?? []).map(Number);
          if (parts.length >= 3 && (parts.length < 4 || parts[3] > 0.9)) {
            bg = parts.slice(0, 3);
            break;
          }
          node = node.parentElement;
        }
        return { label: el.textContent?.trim() ?? "", fg: rgb(getComputedStyle(el).color), bg };
      });
      const contrast = ratio(seen.fg, seen.bg);
      // The label is small text, so AA wants 4.5:1.
      if (contrast < 4.5) failures.push(`"${seen.label}" hovered at ${contrast.toFixed(2)}:1`);
    }

    expect(failures, `hovered tab contrast on ${where}`).toEqual([]);
  });
}

/**
 * The scheme a coach forced, rather than the one their phone asked for.
 *
 * `light-dark()` reads `color-scheme`, and the switch sets that through a
 * `data-theme` attribute rather than through the media query. That is a second
 * road to the same colours, so it gets measured too: a rule written inside a
 * `prefers-color-scheme` block would work for the phone and do nothing at all
 * for the switch, and nothing else here would notice.
 */
for (const forced of ["light", "dark"] as const) {
  test(`a forced ${forced} scheme meets AA contrast against the opposite phone`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: forced === "dark" ? "light" : "dark" });
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page, "#/catalogue", forced);
    await page.waitForTimeout(300);

    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(forced);

    const failures = (await samples(page))
      .map((s) => ({ ...s, contrast: ratio(s.fg, s.bg) }))
      .filter((s) => s.contrast < (s.large ? 3 : 4.5))
      .map((s) => `${s.where} "${s.text}" at ${s.contrast.toFixed(2)}:1`);

    expect(failures, `forced ${forced} contrast failures`).toEqual([]);
  });
}
