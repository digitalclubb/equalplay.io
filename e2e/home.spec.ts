import { test, expect } from "@playwright/test";

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

test("the app and the planner are the same product", async ({ page }) => {
  await page.goto("/planner");
  await expect(page.locator(".btn-generate")).toBeVisible();

  // Same four tabs as the app, with this page marked as where you are
  await expect(page.locator(".hub-tab")).toHaveCount(4);
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
