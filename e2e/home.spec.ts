import { test, expect, type Page } from "@playwright/test";

/**
 * The homepage is static marketing HTML. What can actually break is the route it
 * hands people off to, so that is what these check: one product, one call to
 * action, with the free match-day planner a tab away rather than a rival CTA.
 * See docs/one-product.md.
 */

test("the homepage has one call to action, into the app", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("age group");

  const ctas = page.getByRole("link", { name: "Open Equal Play" });
  await expect(ctas.first()).toBeVisible();
  for (const cta of await ctas.all()) {
    await expect(cta).toHaveAttribute("href", "/hub");
  }

  await ctas.first().click();
  await expect(page).toHaveURL(/\/hub/);
});

test("no static page scrolls sideways on the smallest phone", async ({ page }) => {
  // The header is a flex row of two things that cannot shrink: the wordmark is
  // nowrap and so is the call to action. Held on one line they came to 343px, so
  // a 320px phone scrolled sideways on every one of them. It wraps below 344px now.
  await page.setViewportSize({ width: 320, height: 800 });

  for (const path of [
    "/",
    "/rugby-drills-by-age-group",
    "/rugby-drills-u7",
    "/rugby-drills-u8",
    "/rugby-drills-u9",
    "/rugby-drills-u10",
    "/rugby-drills-u11",
    "/rugby-drills-u12",
    "/rugby-rules-by-age-group",
    "/rugby-rules-u7",
    "/rugby-rules-u8",
    "/rugby-rules-u9",
    "/rugby-rules-u10",
    "/rugby-rules-u11",
    "/rugby-rules-u12",
    "/rugby-substitution-app",
    "/equal-playing-time-calculator",
    "/rfu-regulation-15-playing-time",
    "/privacy",
  ]) {
    await page.goto(path);
    const width = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    expect(width.scroll, path).toBeLessThanOrEqual(width.client);
  }
});

test("the app and the planner are the same product", async ({ page }) => {
  await page.goto("/planner");
  await expect(page.locator(".btn-generate")).toBeVisible();

  // Same five tabs as the app, with this page marked as where you are
  await expect(page.locator(".hub-tab")).toHaveCount(5);
  await expect(page.locator('.hub-tab[data-route="planner"]')).toHaveAttribute(
    "aria-current",
    "page",
  );

  await page.locator('.hub-tab[data-route="catalogue"]').click();
  await expect(page).toHaveURL(/\/hub/);
});

test("the planner is reachable from the app without an account", async ({ page }) => {
  await page.goto("/hub/");
  await page.locator('.hub-tab[data-route="planner"]').click();
  await expect(page).toHaveURL(/\/planner/);
  await expect(page.locator(".btn-generate")).toBeVisible();
});

test("a rules page is a real page, not a redirect into the app", async ({ page }) => {
  // The guide is hub content and `/hub` is noindex, so these exist to be the
  // version a search engine can read. If one ever became a redirect or an empty
  // shell that waits on JavaScript, the whole point of it would be gone.
  await page.goto("/rugby-rules-u10");
  expect(page.url()).toContain("/rugby-rules-u10");

  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator("h1")).toContainText("U10");
  await expect(page.locator("main")).toContainText("ruck");

  // Straight into the app, and across to the drills for the same grade
  await expect(page.locator('a[href="/hub#/guide/u10"]')).toHaveCount(1);
  await expect(page.locator('a[href="/rugby-drills-u10"]')).not.toHaveCount(0);
  await expect(page.locator('a.header-cta[href="/hub"]')).toBeVisible();
});

test("the rules cluster links itself together", async ({ page }) => {
  await page.goto("/rugby-rules-by-age-group");
  for (const age of ["u7", "u8", "u9", "u10", "u11", "u12"]) {
    await expect(page.locator(`a[href="/rugby-rules-${age}"]`).first()).toBeVisible();
  }

  // In from the drills page for the grade, which is where a coach who searched
  // for drills rather than rules comes in
  await page.goto("/rugby-drills-u9");
  await page.locator('a[href="/rugby-rules-u9"]').first().click();
  await expect(page.locator("h1")).toContainText("U9");
});

// ---- The colour scheme switch ----

const bg = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

/**
 * One button in the chrome that cycles Auto, Light, Dark, so a scheme is
 * reached by tapping until it says so rather than by clicking one of three.
 * Three taps is the whole cycle, so anything more means it is stuck.
 */
async function setScheme(page: Page, want: string): Promise<void> {
  const toggle = page.locator(".scheme-toggle");
  for (let tap = 0; tap < 3; tap++) {
    if ((await toggle.getAttribute("data-scheme")) === want) return;
    await toggle.click();
  }
  await expect(toggle).toHaveAttribute("data-scheme", want);
}

test("a coach can pick a scheme and the phone stops deciding", async ({ page }) => {
  // The phone says light. The switch has to be able to say otherwise, because a
  // screen pinned one way is what this exists for.
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/hub/#/catalogue");
  const light = await bg(page);

  await setScheme(page, "dark");
  await expect(page.locator(".scheme-toggle")).toHaveAttribute("data-scheme", "dark");
  const dark = await bg(page);
  expect(dark).not.toBe(light);

  // Back to the phone, and the attribute goes rather than being set to system
  await setScheme(page, "system");
  expect(await bg(page)).toBe(light);
  expect(await page.evaluate(() => document.documentElement.hasAttribute("data-theme"))).toBe(false);
});

test("the choice survives a reload, and lands before the first paint", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/hub/#/catalogue");
  await setScheme(page, "dark");
  const dark = await bg(page);

  // Read from inside the page as soon as the DOM exists rather than after
  // `reload()` resolves. By then a scheme applied late by the bundle looks
  // exactly like one applied early, so the assertion could not fail for the
  // reason it names. `nav.test.ts` holds the script ahead of the stylesheet.
  await page.addInitScript(() => {
    addEventListener("DOMContentLoaded", () => {
      (window as unknown as { seenEarly?: string }).seenEarly =
        document.documentElement.dataset.theme ?? "none";
    });
  });
  await page.reload();

  const early = await page.evaluate(
    () => (window as unknown as { seenEarly?: string }).seenEarly,
  );
  expect(early, "the scheme was applied late, so the page flashed").toBe("dark");
  expect(await bg(page)).toBe(dark);
  await expect(page.locator(".scheme-toggle")).toHaveAttribute("data-scheme", "dark");
});

test("the scheme belongs to the phone, so it crosses between the two halves", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/planner");
  await setScheme(page, "dark");
  const dark = await bg(page);

  await page.goto("/hub/#/catalogue");
  expect(await bg(page)).toBe(dark);
  await expect(page.locator(".scheme-toggle")).toHaveAttribute("data-scheme", "dark");
});

test("the choice holds when a footer link leaves the app", async ({ page }) => {
  // The static pages are the third part of the product. A coach who forced one
  // scheme and tapped About Equal Play used to land in the other.
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/hub/#/catalogue");
  await setScheme(page, "light");

  // Not the same colour as the app. The marketing pages are white where the app
  // is grey, and always were. What has to match is the scheme rather than the
  // palette, so this asks whether the page is light rather than dark.
  const lightness = () =>
    page.evaluate(() => {
      const [r, g, b] = (getComputedStyle(document.body).backgroundColor.match(/\d+/g) ?? []).map(
        Number,
      );
      return (r + g + b) / 3;
    });

  for (const path of ["/", "/privacy", "/rugby-drills-u10", "/rugby-rules-u10"]) {
    await page.goto(path);
    expect(await page.evaluate(() => document.documentElement.dataset.theme), path).toBe("light");
    expect(await lightness(), `${path} came back dark`).toBeGreaterThan(200);
  }
});

test("signing out leaves the phone's colours alone", async ({ page }) => {
  // Everything belonging to a coach goes when they sign out, because clubs
  // share tablets. The scheme is the device's rather than theirs.
  await page.goto("/hub/#/catalogue");
  await setScheme(page, "dark");
  await page.evaluate(() => {
    for (const key of ["equalplay_hub_plans", "equalplay_hub_favourites", "equalplay_hub_welcomed"]) {
      localStorage.removeItem(key);
    }
  });
  await page.reload();
  await expect(page.locator(".scheme-toggle")).toHaveAttribute("data-scheme", "dark");
});
