import { test, expect, type Page } from "@playwright/test";

/**
 * Happy path for the coaching hub.
 *
 * Auth is stubbed by writing a session into localStorage before the page scripts
 * run, so this covers everything past the sign-in screen without needing a live
 * Supabase project. Registration and email confirmation are deliberately not
 * covered here, because faking them would prove nothing.
 *
 * The build under test uses throwaway credentials, so every request to Supabase
 * fails. That is the point of most of what follows: the hub has to work anyway,
 * because a coach at a pitch has no signal either.
 */

const USER_ID = "00000000-0000-4000-8000-000000000001";

/**
 * How many drills are in `preset-u10-rucking`, which nearly every session test
 * below builds from. Named rather than typed out so editing a preset does not
 * mean editing forty assertions.
 */
const BLOCKS = 6;

function session(ageGroup: string) {
  return {
    access_token: "stub",
    token_type: "bearer",
    expires_in: 360_000,
    expires_at: Math.floor(Date.now() / 1000) + 360_000,
    refresh_token: "stub",
    user: {
      id: USER_ID,
      aud: "authenticated",
      role: "authenticated",
      email: "coach@example.com",
      created_at: "2026-08-17T00:00:00Z",
      app_metadata: {},
      user_metadata: { name: "Gareth Clubb", club: "Bridgend Athletic RFC", age_group: ageGroup },
    },
  };
}

/**
 * Seed a signed-in session, once.
 *
 * addInitScript runs on every navigation, so the seed is guarded by a sentinel.
 * Without that, a reload wipes exactly the state the reload is meant to prove
 * survived, and the test passes while checking nothing.
 */
async function seedSession(page: Page, ageGroup: string, skipWelcome: boolean) {
  await page.addInitScript(
    ([key, value, welcomed]) => {
      if (localStorage.getItem("__seeded")) return;
      localStorage.clear();
      localStorage.setItem("__seeded", "1");
      localStorage.setItem(key, value);
      if (welcomed) localStorage.setItem("equalplay_hub_welcomed", "1");
    },
    ["sb-example-auth-token", JSON.stringify(session(ageGroup)), skipWelcome ? "1" : ""],
  );
}

/** Tap a theme filter chip. Pass "" for Anything. */
async function pickTheme(page: Page, theme: string) {
  await page.locator(`[data-theme="${theme}"]`).click();
}

/** Sign in as a coach of the given age grade and land on `hash`. */
async function signedIn(page: Page, ageGroup: string, hash = "#/catalogue") {
  await seedSession(page, ageGroup, true);
  await page.goto(`/hub/${hash}`);
  // Not `.hub-tab`. The nav is the same four tabs signed out, so waiting on it
  // would resolve before the session was read and prove nothing. The chrome
  // carries no signed-in text any more, so this waits on the state itself.
  await page.waitForSelector('body[data-signed-in="true"]');
}

/**
 * Land on the app with no session at all, having already picked a grade.
 *
 * Sentinel guarded for the same reason `seedSession` is: addInitScript runs on
 * every navigation, so without it a reload wipes the very choice the reload is
 * meant to prove was remembered.
 */
async function signedOut(page: Page, ageGroup: string | null, hash = "#/catalogue") {
  await page.addInitScript((age) => {
    if (localStorage.getItem("__seeded")) return;
    localStorage.clear();
    localStorage.setItem("__seeded", "1");
    if (age) localStorage.setItem("equalplay_age_group", age);
    localStorage.setItem("equalplay_hub_welcomed", "1");
  }, ageGroup);
  await page.goto(`/hub/${hash}`);
}

// ---- Catalogue ----

test("catalogue defaults to the coach's own age grade", async ({ page }) => {
  await signedIn(page, "u10");
  await expect(page.locator("#f-age")).toHaveValue("u10");
  await expect(page.locator(".hub-count")).toContainText("U10");
  expect(await page.locator(".drill-card").count()).toBeGreaterThan(20);
});

test("a tag age grade is never offered a contact drill", async ({ page }) => {
  await signedIn(page, "u8");

  // Every theme that involves contact must come back empty, and the empty state
  // should say when that kind of rugby actually starts
  for (const [theme, startsAt] of [["tackle", "U9"], ["breakdown", "U10"], ["setpiece", "U10"]]) {
    await pickTheme(page, theme);
    await expect(page.locator(".drill-card")).toHaveCount(0);
    await expect(page.locator(".hub-empty")).toContainText(`starts at ${startsAt}`);
  }

  // And searching for it by name does not get round the gate
  await pickTheme(page, "");
  await page.locator("#f-search").fill("two second ruck");
  await expect(page.locator(".drill-card")).toHaveCount(0);
});

test("U9 gets tackling but no rucks or scrums", async ({ page }) => {
  await signedIn(page, "u9");
  await pickTheme(page, "tackle");
  expect(await page.locator(".drill-card").count()).toBeGreaterThan(0);

  for (const theme of ["breakdown", "setpiece"]) {
    await pickTheme(page, theme);
    await expect(page.locator(".drill-card")).toHaveCount(0);
  }
});

test("a contact drill leads with its safety note", async ({ page }) => {
  await signedIn(page, "u10", "#/catalogue/drill-front-on-tackle");
  const safety = page.locator(".drill-safety");
  await expect(safety).toBeVisible();
  await expect(safety).toContainText("head");

  // The safety note sits above the instructions, not after them
  const safetyBox = await safety.boundingBox();
  const setup = await page.locator(".hub-panel h3").filter({ hasText: "Set up" }).boundingBox();
  expect(safetyBox && setup && safetyBox.y < setup.y).toBe(true);
});

test("filters survive a trip into a drill and back", async ({ page }) => {
  await signedIn(page, "u10");
  await pickTheme(page, "breakdown");
  const before = await page.locator(".hub-count").innerText();

  await page.locator(".drill-card").first().click();
  await expect(page.locator(".drill-facts")).toBeVisible();
  await page.getByRole("link", { name: /Back to drills/ }).click();

  await expect(page.locator('[data-theme="breakdown"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".hub-count")).toHaveText(before);
});

// ---- Session planner ----

test("builds a session from a preset and totals it up", async ({ page }) => {
  await signedIn(page, "u10", "#/plans");

  await expect(page.locator(".preset-card")).not.toHaveCount(0);

  // What the card promises is what the session length ends up being. The card
  // used to count the drills, which reads short of the plan you get because
  // building it adds a water break.
  const card = page.locator('[data-preset="preset-u10-rucking"] .preset-meta');
  const promised = (await card.innerText()).match(/(\d+) min/)?.[1];
  await page.locator('[data-preset="preset-u10-rucking"]').click();
  await expect(page.locator("#plan-minutes")).toHaveValue(String(promised));

  await expect(page.locator("#plan-title")).toHaveValue("Rucking");
  await expect(page.locator(".block-row")).toHaveCount(BLOCKS);
  await expect(page.locator(".budget-text")).toContainText("min");
  await expect(page.locator(".kit-list li")).not.toHaveCount(0);

  // Stretching a block moves the budget
  await page.locator('[data-minutes="0"]').fill("40");
  await page.locator('[data-minutes="0"]').dispatchEvent("change");
  await expect(page.locator(".is-over-text")).toBeVisible();
});

test("reorders, removes and adds blocks", async ({ page }) => {
  await signedIn(page, "u10", "#/plans");
  await page.locator('[data-preset="preset-u10-rucking"]').click();
  await expect(page.locator(".block-row")).toHaveCount(BLOCKS);
  const titles = async () => page.locator(".block-title").allInnerTexts();

  const [first, second] = await titles();
  await page.locator('[data-down="0"]').click();
  expect(await titles()).toEqual(expect.arrayContaining([second, first]));

  await page.locator('[data-remove="0"]').click();
  expect(await page.locator(".block-row").count()).toBe(BLOCKS - 1);

  await page.locator("#add-search").fill("scrum shape");
  await page.locator("[data-peek]").first().click();
  await page.locator("[data-add]").first().click();
  expect(await page.locator(".block-row").count()).toBe(BLOCKS);
});

test("the add-a-drill box is gated to the plan's age grade", async ({ page }) => {
  await signedIn(page, "u8", "#/plans");
  await page.locator(".preset-card").first().click();

  // No ruck, scrum or lineout drill can be added to a U8 session. A legal U8
  // drill may still mention the word while explaining why it matters later, so
  // this checks by name rather than by keyword.
  for (const forbidden of ["Two second ruck", "Three player scrum shape", "Cheek to cheek"]) {
    await page.locator("#add-search").fill(forbidden);
    await expect(page.locator("[data-peek]")).toHaveCount(0);
  }

  // And something a U8 squad can do is still offered
  await page.locator("#add-search").fill("corner ball");
  await expect(page.locator("[data-peek] .add-title").filter({ hasText: "Corner ball" })).toHaveCount(1);

  // The theme chips in the add panel only offer what the grade is allowed to do
  await expect(page.locator('[data-addtheme="breakdown"]')).toHaveCount(0);
  await expect(page.locator('[data-addtheme="handling"]')).toHaveCount(1);
});

test("a session survives a reload with no server", async ({ page }) => {
  await signedIn(page, "u10", "#/plans");
  await page.locator('[data-preset="preset-u10-rucking"]').click();
  await expect(page.locator(".block-row")).toHaveCount(BLOCKS);
  await page.locator("#plan-title").fill("Tuesday night");
  await page.locator("#plan-title").dispatchEvent("input");
  await expect(page.locator("#plan-title")).toHaveValue("Tuesday night");

  const hash = await page.evaluate(() => location.hash);
  await page.reload();
  expect(await page.evaluate(() => location.hash)).toBe(hash);
  await expect(page.locator("#plan-title")).toHaveValue("Tuesday night");
  expect(await page.locator(".block-row").count()).toBe(BLOCKS);
});

test("says so when it could not reach the server", async ({ page }) => {
  await signedIn(page, "u10", "#/plans");
  await page.locator('[data-preset="preset-u10-rucking"]').click();
  await expect(page.locator(".block-row")).toHaveCount(BLOCKS);
  await page.goto("/hub/#/plans");

  // Supabase is unreachable in this build, so the notice is the honest state.
  // A request to a host that does not resolve can outlast the default timeout.
  await expect(page.locator(".sync-notice-offline")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".sync-notice-offline")).toContainText("saved on this phone");
  // And the plan is listed regardless
  await expect(page.locator(".drill-card-title")).toContainText("Rucking");
});

test("a printable sheet is built for the session", async ({ page }) => {
  await signedIn(page, "u10", "#/plans");
  await page.locator('[data-preset="preset-u10-rucking"]').click();
  await expect(page.locator(".block-row")).toHaveCount(BLOCKS);

  const sheet = page.locator("#plan-print-sheet");
  await expect(sheet.locator(".print-block")).toHaveCount(BLOCKS);
  await expect(sheet.locator("h1")).toHaveText("Rucking");
  await expect(sheet.locator(".print-safety").first()).toContainText("contact");

  // Only visible on paper
  await expect(sheet).toBeHidden();
  await page.emulateMedia({ media: "print" });
  await expect(sheet).toBeVisible();
});

// ---- Account and onboarding ----

test("an account with no age grade lands on the setup form", async ({ page }) => {
  await seedSession(page, "nonsense", false);
  await page.goto("/hub/");
  await expect(page.locator("#hub-view h2").first()).toHaveText("Finish setting up");
  await expect(page.locator("#acc-age")).toHaveValue("");
  // The nav is the same four tabs whatever state you are in, because it is one
  // product. What changes is where a tab lands you, not whether it exists.
  await expect(page.locator(".hub-tab")).toHaveCount(4);
  await expect(page.locator("#sign-out")).toBeVisible();
});

test("the first-run panel appears once then stays gone", async ({ page }) => {
  await seedSession(page, "u10", false);
  await page.goto("/hub/#/catalogue");
  await expect(page.locator(".hub-welcome")).toBeVisible();

  await page.locator("#dismiss-welcome").click();
  await expect(page.locator(".hub-welcome")).toHaveCount(0);

  await page.reload();
  await expect(page.locator(".hub-count")).toBeVisible();
  await expect(page.locator(".hub-welcome")).toHaveCount(0);
});

test("the skip link focuses the content without changing the route", async ({ page }) => {
  await signedIn(page, "u10", "#/account");
  await expect(page.locator("#hub-view h2").first()).toHaveText("Your details");

  await page.locator("#skip-link").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#hub-view h2").first()).toHaveText("Your details");
  expect(await page.evaluate(() => location.hash)).toBe("#/account");
});

test("the app is noindex and installs as one product", async ({ page }) => {
  await signedIn(page, "u10");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex,nofollow");
  // One manifest across both entries, so a home screen gets one Equal Play icon
  // rather than one per half. See docs/one-product.md.
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.json");
});

test("the planner installs as the same product", async ({ page }) => {
  await page.goto("/planner");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.json");
});

// ---- Small phones ----

test("works on a 320px screen without sideways scroll", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 600 });
  await signedIn(page, "u10", "#/plans");
  await page.locator('[data-preset="preset-u10-rucking"]').click();
  await expect(page.locator(".block-row")).toHaveCount(BLOCKS);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflow).toBe(false);

  // The block controls stay reachable rather than being pushed off the edge
  const remove = page.locator('[data-remove="0"]');
  await expect(remove).toBeVisible();
  const box = await remove.boundingBox();
  expect(box && box.x + box.width <= 320).toBe(true);
});

// ---- Favourites ----

test("stars a drill and filters to it", async ({ page }) => {
  await signedIn(page, "u10");

  const first = page.locator(".drill-card").first();
  const name = await first.locator(".drill-card-title").innerText();
  await first.locator(".fav-btn").click();
  await expect(first.locator(".fav-btn")).toHaveAttribute("aria-pressed", "true");

  // The chip counts them
  await expect(page.locator("#f-fav")).toContainText("(1)");

  await page.locator("#f-fav").click();
  await expect(page.locator("#f-fav")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".drill-card")).toHaveCount(1);
  await expect(page.locator(".drill-card-title")).toHaveText(name);
});

test("starring does not open the drill", async ({ page }) => {
  await signedIn(page, "u10");
  await page.locator(".drill-card").first().locator(".fav-btn").click();
  // Still on the list rather than the drill page
  expect(await page.evaluate(() => location.hash)).toBe("#/catalogue");
  await expect(page.locator(".hub-count")).toBeVisible();
});

test("a star survives a reload with no server", async ({ page }) => {
  await signedIn(page, "u10");
  const name = await page.locator(".drill-card-title").first().innerText();
  await page.locator(".drill-card").first().locator(".fav-btn").click();
  await expect(page.locator("#f-fav")).toContainText("(1)");

  await page.reload();
  await page.waitForSelector(".hub-tab");
  await expect(page.locator("#f-fav")).toContainText("(1)");
  await page.locator("#f-fav").click();
  await expect(page.locator(".drill-card-title")).toHaveText(name);
});

test("unstarring removes it again", async ({ page }) => {
  await signedIn(page, "u10");
  const fav = page.locator(".drill-card").first().locator(".fav-btn");
  await fav.click();
  await expect(page.locator("#f-fav")).toContainText("(1)");
  await page.locator(".drill-card").first().locator(".fav-btn").click();
  await expect(page.locator("#f-fav")).not.toContainText("(1)");
});

test("the star filter never gets round the age gate", async ({ page }) => {
  // Star a ruck drill as a U10 coach
  await signedIn(page, "u10");
  await pickTheme(page, "breakdown");
  await page.locator(".drill-card").filter({ hasText: "Two second ruck" }).locator(".fav-btn").click();
  await expect(page.locator("#f-fav")).toContainText("(1)");

  // Drop the age group to U8 and it must not come back, starred or not
  await page.selectOption("#f-age", "u8");
  await page.locator("#f-fav").click();
  await expect(page.locator(".drill-card").filter({ hasText: "Two second ruck" })).toHaveCount(0);
});

test("teaches what the star is for when nothing is starred", async ({ page }) => {
  await signedIn(page, "u10");
  await page.locator("#f-fav").click();
  await expect(page.locator(".hub-empty")).toContainText("Star a drill and it'll show up here");
  // No "start again" button, because clearing filters is not the fix here
  await expect(page.locator("#clear-filters")).toHaveCount(0);
});

test("the drill page has its own star, in step with the list", async ({ page }) => {
  await signedIn(page, "u10", "#/catalogue/drill-front-on-tackle");
  const fav = page.locator(".fav-btn");
  await expect(fav).toHaveAttribute("aria-pressed", "false");
  await fav.click();
  await expect(fav).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("link", { name: /Back to drills/ }).click();
  await expect(page.locator("#f-fav")).toContainText("(1)");
});


// ---- Session building details ----

test("a drill can be looked at before it is added", async ({ page }) => {
  await signedIn(page, "u10", "#/plans");
  await page.locator('[data-preset="preset-u10-rucking"]').click();
  await expect(page.locator(".block-row")).toHaveCount(BLOCKS);

  await page.locator("#add-search").fill("cheek to cheek");
  const row = page.locator("[data-peek]").first();

  // Nothing is added just by looking
  await row.click();
  await expect(row).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".add-peek")).toBeVisible();
  await expect(page.locator(".add-peek-safety")).toContainText("size");
  await expect(page.locator(".block-row")).toHaveCount(BLOCKS);

  // Tapping again closes it, still without adding
  await row.click();
  await expect(page.locator(".add-peek")).toHaveCount(0);
  await expect(page.locator(".block-row")).toHaveCount(BLOCKS);

  // Only the explicit button adds it
  await row.click();
  await page.locator("[data-add]").click();
  await expect(page.locator(".block-row")).toHaveCount(BLOCKS + 1);
  await expect(page.locator(".add-peek")).toHaveCount(0);
});

test("the add panel offers every match, not a truncated few", async ({ page }) => {
  await signedIn(page, "u10", "#/plans");
  await page.locator('[data-preset="preset-u10-rucking"]').click();
  await expect(page.locator(".block-row")).toHaveCount(BLOCKS);

  const count = await page.locator("[data-peek]").count();
  expect(count).toBeGreaterThan(20);
  await expect(page.locator(".add-count")).toContainText(`${count} to choose from`);

  // And it narrows by theme
  await page.locator('[data-addtheme="breakdown"]').click();
  const narrowed = await page.locator("[data-peek]").count();
  expect(narrowed).toBeLessThan(count);
  expect(narrowed).toBeGreaterThan(0);
});

test("favourites can be filtered inside the add panel", async ({ page }) => {
  // Star something in the catalogue first
  await signedIn(page, "u10");
  const name = await page.locator(".drill-card-title").first().innerText();
  await page.locator(".drill-card").first().locator(".fav-btn").click();

  await page.locator('a[href="#/plans"]').click();
  await page.locator('[data-preset="preset-u10-rucking"]').click();
  await expect(page.locator(".block-row")).toHaveCount(BLOCKS);

  await page.locator("#add-fav").click();
  await expect(page.locator("[data-peek]")).toHaveCount(1);
  await expect(page.locator("[data-peek] .add-title")).toContainText(name);
});

test("a safety note can be read without leaving the session", async ({ page }) => {
  await signedIn(page, "u10", "#/plans");
  await page.locator('[data-preset="preset-u10-rucking"]').click();
  await expect(page.locator(".block-row")).toHaveCount(BLOCKS);

  const details = page.locator(".block-safety-details").first();
  await expect(details.locator("p")).toBeHidden();
  await details.locator("summary").click();
  await expect(details.locator("p")).toBeVisible();
  // Still on the session rather than the drill page
  expect(await page.evaluate(() => location.hash)).toContain("#/plan/");
});

test("water breaks are added, counted and removed", async ({ page }) => {
  await signedIn(page, "u10", "#/plans");
  await page.locator('[data-preset="preset-u10-rucking"]').click();
  await expect(page.locator(".block-row")).toHaveCount(BLOCKS);

  // A ready-made session arrives with the break the planner would ask for, so it
  // opens clean: no warnings panel at all. More than one warning can be up, so
  // read the whole list rather than a single element, and an absent list is
  // nothing to say rather than a failure.
  const warnings = async () => (await page.locator(".plan-warnings").allInnerTexts()).join(" ");
  await expect(page.locator(".plan-warnings")).toHaveCount(0);
  await expect(page.locator(".break-row")).toHaveCount(1);
  await expect(page.locator(".budget-text")).toContainText("of it breaks");
  expect(await warnings()).not.toContain("No water breaks");

  // The break shows on the printed sheet where it falls
  await expect(page.locator("#plan-print-sheet .print-break")).toHaveCount(1);

  // Take it out and a 60 minute session says so
  const before = await page.locator(".budget-text").innerText();
  await page.locator("[data-nobreak]").first().click();
  await expect(page.locator(".break-row")).toHaveCount(0);
  expect(await page.locator(".budget-text").innerText()).not.toBe(before);
  expect(await warnings()).toContain("No water breaks");

  // And it can go back somewhere else
  await page.locator('[data-addbreak="0"]').first().click();
  await expect(page.locator(".break-row")).toHaveCount(1);
  expect(await warnings()).not.toContain("No water breaks");
});

test("the session length says what unit it wants", async ({ page }) => {
  await signedIn(page, "u10", "#/plans");
  await page.locator('[data-preset="preset-u10-rucking"]').click();
  await expect(page.locator("#plan-minutes-unit")).toHaveText("minutes");
  await expect(page.locator("#plan-minutes")).toHaveAttribute("aria-describedby", "plan-minutes-unit");
});

test("an open safety note survives an edit", async ({ page }) => {
  await signedIn(page, "u10", "#/plans");
  await page.locator('[data-preset="preset-u10-rucking"]').click();
  await expect(page.locator(".block-row")).toHaveCount(BLOCKS);

  const details = page.locator(".block-safety-details").first();
  await details.locator("summary").click();
  await expect(details.locator("p")).toBeVisible();

  // The editor redraws on every change, which used to close it again
  await page.locator('[data-minutes="0"]').fill("12");
  await page.locator('[data-minutes="0"]').dispatchEvent("change");
  await expect(page.locator(".block-safety-details").first().locator("p")).toBeVisible();
});

test("the add button sits above the drill description", async ({ page }) => {
  await signedIn(page, "u10", "#/plans");
  await page.locator('[data-preset="preset-u10-rucking"]').click();
  await expect(page.locator(".block-row")).toHaveCount(BLOCKS);

  await page.locator("#add-search").fill("cheek to cheek");
  await page.locator("[data-peek]").first().click();

  const button = await page.locator("[data-add]").boundingBox();
  const prose = await page.locator(".add-peek > p").last().boundingBox();
  expect(button && prose && button.y < prose.y).toBe(true);
});

test("the add button is readable, not white on grey", async ({ page }) => {
  await signedIn(page, "u10", "#/plans");
  await page.locator('[data-preset="preset-u10-rucking"]').click();
  await expect(page.locator(".block-row")).toHaveCount(BLOCKS);

  await page.locator("#add-search").fill("cheek to cheek");
  await page.locator("[data-peek]").first().click();

  const seen = await page.locator("[data-add]").evaluate((el) => {
    const style = getComputedStyle(el);
    return { colour: style.color, background: style.backgroundColor };
  });
  // Orange background with white on it, rather than the pale row background
  expect(seen.colour).toBe("rgb(255, 255, 255)");
  expect(seen.background).toBe("rgb(207, 57, 24)");
});

test("a drill opened from a session goes back to that session", async ({ page }) => {
  await signedIn(page, "u10", "#/plans");
  await page.locator('[data-preset="preset-u10-rucking"]').click();
  await expect(page.locator(".block-row")).toHaveCount(BLOCKS);
  const planId = await page.evaluate(() => location.hash.split("/")[2]);

  await page.locator(".block-title").first().click();
  await expect(page.locator(".drill-facts")).toBeVisible();
  await expect(page.locator(".hub-back a")).toHaveText("← Back to the session");

  // And it still points at the right session after a reload
  await page.reload();
  await expect(page.locator(".hub-back a")).toHaveText("← Back to the session");
  await page.locator(".hub-back a").click();
  // Back to the session, which lands on the reading view rather than the editor
  expect(await page.evaluate(() => location.hash)).toBe(`#/plan/${planId}`);
  await expect(page.locator(".run-block")).toHaveCount(BLOCKS);
});

test("a drill opened from the catalogue still goes back to drills", async ({ page }) => {
  await signedIn(page, "u10", "#/catalogue/drill-front-on-tackle");
  await expect(page.locator(".hub-back a")).toHaveText("← Back to drills");
});

test("expanding a drill does not throw the page around", async ({ page }) => {
  await signedIn(page, "u10", "#/plans");
  await page.locator('[data-preset="preset-u10-rucking"]').click();
  await expect(page.locator(".block-row")).toHaveCount(BLOCKS);

  // Get down to the add panel, and scroll inside its list as well
  await page.locator("#add-search").scrollIntoViewIfNeeded();
  const list = page.locator(".add-list");
  await list.evaluate((el) => { el.scrollTop = 200; });
  const listScroll = await list.evaluate((el) => el.scrollTop);
  const pageScroll = await page.evaluate(() => window.scrollY);
  expect(pageScroll).toBeGreaterThan(0);
  expect(listScroll).toBeGreaterThan(0);

  const row = page.locator("[data-peek]").nth(6);
  const before = await row.boundingBox();
  await row.click();

  // Both scroll positions held, so the row is still where the thumb left it
  expect(await page.evaluate(() => window.scrollY)).toBe(pageScroll);
  expect(await list.evaluate((el) => el.scrollTop)).toBe(listScroll);
  const after = await page.locator("[data-peek]").nth(6).boundingBox();
  expect(Math.abs((before?.y ?? 0) - (after?.y ?? 0))).toBeLessThan(3);
});

test("editing minutes does not throw the page around either", async ({ page }) => {
  await signedIn(page, "u10", "#/plans");
  await page.locator('[data-preset="preset-u10-rucking"]').click();
  await expect(page.locator(".block-row")).toHaveCount(BLOCKS);

  // Edit the last block, which needs scrolling to reach. Reading the position
  // after the input is in view, because Playwright scrolls to an element before
  // filling it and that scroll is the browser doing its job, not a bug.
  const input = page.locator('[data-minutes="4"]');
  await input.scrollIntoViewIfNeeded();
  const pageScroll = await page.evaluate(() => window.scrollY);
  expect(pageScroll).toBeGreaterThan(0);

  await input.fill("15");
  await input.dispatchEvent("change");
  await expect(page.locator(".budget-text")).toContainText("min");
  expect(await page.evaluate(() => window.scrollY)).toBe(pageScroll);
});

test("says whether the session is saved", async ({ page }) => {
  await signedIn(page, "u10", "#/plans");
  await page.locator('[data-preset="preset-u10-rucking"]').click();
  await expect(page.locator(".block-row")).toHaveCount(BLOCKS);

  await page.locator("#plan-title").fill("Tuesday night");
  await page.locator("#plan-title").dispatchEvent("input");
  await expect(page.locator("#save-state")).toHaveText("Saving…");

  // Supabase is unreachable in this build, so it settles on the honest answer
  await expect(page.locator("#save-state")).toContainText("Saved on this phone", {
    timeout: 15_000,
  });

  // And Done takes you to the session as it will be read, with the work kept
  await page.locator(".hub-btn-done").click();
  await expect(page.locator(".run-head h2")).toHaveText("Tuesday night");
  await expect(page.locator(".run-block")).toHaveCount(BLOCKS);
});


// ---- Reading a session at the pitch ----

test("opening a session shows it to read, not to edit", async ({ page }) => {
  await signedIn(page, "u10", "#/plans");
  await page.locator('[data-preset="preset-u10-rucking"]').click();
  await expect(page.locator(".block-row")).toHaveCount(BLOCKS);
  const planId = await page.evaluate(() => location.hash.split("/")[2]);

  // Coming at it fresh from the list, the way a coach would at a pitch
  await page.goto("/hub/#/plans");
  await page.locator(`a[href="#/plan/${planId}"]`).click();

  await expect(page.locator(".run-block")).toHaveCount(BLOCKS);
  // None of the editing furniture is in the way
  await expect(page.locator("#add-search")).toHaveCount(0);
  await expect(page.locator("[data-minutes]")).toHaveCount(0);
  await expect(page.locator("#plan-delete")).toHaveCount(0);
  await expect(page.locator("#plan-title")).toHaveCount(0);

  // What it does show is what gets read out
  await expect(page.locator(".run-points li").first()).toBeVisible();
  await expect(page.locator(".run-kit")).toContainText("cones");
  await expect(page.locator(".run-number").first()).toHaveText("1");
});

test("edit and back again", async ({ page }) => {
  await signedIn(page, "u10", "#/plans");
  await page.locator('[data-preset="preset-u10-rucking"]').click();
  const planId = await page.evaluate(() => location.hash.split("/")[2]);

  await page.goto(`/hub/#/plan/${planId}`);
  await expect(page.locator(".run-block")).toHaveCount(BLOCKS);

  await page.locator(".hub-btn-edit").click();
  expect(await page.evaluate(() => location.hash)).toBe(`#/plan/${planId}/edit`);
  await expect(page.locator("#add-search")).toBeVisible();

  await page.locator(".hub-btn-done").click();
  expect(await page.evaluate(() => location.hash)).toBe(`#/plan/${planId}`);
  await expect(page.locator("#add-search")).toHaveCount(0);
});

test("a break shows in the running order", async ({ page }) => {
  await signedIn(page, "u10", "#/plans");
  await page.locator('[data-preset="preset-u10-rucking"]').click();
  await expect(page.locator(".block-row")).toHaveCount(BLOCKS);
  await expect(page.locator(".break-row")).toHaveCount(1);

  await page.locator(".hub-btn-done").click();
  await expect(page.locator(".run-break")).toHaveCount(1);
  await expect(page.locator(".run-break")).toContainText("Water break, 3 min");
  await expect(page.locator(".run-meta")).toContainText("including 3 of breaks");
});

test("a safety note can be read in the running order", async ({ page }) => {
  await signedIn(page, "u10", "#/plans");
  await page.locator('[data-preset="preset-u10-rucking"]').click();
  const planId = await page.evaluate(() => location.hash.split("/")[2]);
  await page.goto(`/hub/#/plan/${planId}`);

  const details = page.locator(".run-block .block-safety-details").first();
  await expect(details.locator("p")).toBeHidden();
  await details.locator("summary").click();
  await expect(details.locator("p")).toBeVisible();
});

// ---- Warm-up or exercise ----

test("the add panel filters by warm-up or exercise", async ({ page }) => {
  await signedIn(page, "u10", "#/plans");
  await page.locator('[data-preset="preset-u10-rucking"]').click();
  await expect(page.locator(".block-row")).toHaveCount(BLOCKS);

  const all = await page.locator("[data-peek]").count();

  await page.locator('[data-addkind="warmup"]').click();
  const warmups = await page.locator("[data-peek]").count();
  expect(warmups).toBeLessThan(all);
  expect(await page.locator("[data-peek] .kind-dot-warmup").count()).toBe(warmups);

  await page.locator('[data-addkind="exercise"]').click();
  const exercises = await page.locator("[data-peek]").count();
  expect(await page.locator("[data-peek] .kind-dot-warmup").count()).toBe(0);
  expect(warmups + exercises).toBe(all);
});

test("warm-ups and exercises are told apart by colour, both readable", async ({ page }) => {
  await signedIn(page, "u10");
  const read = (sel: string) =>
    page.locator(sel).first().evaluate((el) => {
      const style = getComputedStyle(el);
      return `${style.color} on ${style.backgroundColor}`;
    });

  const warmup = await read(".drill-kind-warmup");
  await page.locator('[data-addkind="exercise"]').count(); // no-op on the catalogue
  await page.locator("#f-search").fill("corner ball");
  const exercise = await read(".drill-kind:not(.drill-kind-warmup)");

  expect(warmup).not.toBe(exercise);
  expect(warmup).toBe("rgb(0, 5, 55) on rgb(232, 234, 246)");
  expect(exercise).toBe("rgb(138, 74, 26) on rgb(253, 240, 230)");
});

// ---- Slow syncs must not paint over the view you are on ----

test("a slow favourites sync does not replace the session you opened", async ({ page }) => {
  await signedIn(page, "u10", "#/plans");
  await page.locator('[data-preset="preset-u10-rucking"]').click();
  const planId = await page.evaluate(() => location.hash.split("/")[2]);

  // Land on the catalogue, which kicks off a favourites pull, then leave at once.
  // Supabase is unreachable in this build so that request is still in flight.
  await page.goto("/hub/#/catalogue");
  await page.locator('a[href="#/plans"]').click();
  await page.locator(`a[href="#/plan/${planId}"]`).click();
  await expect(page.locator(".run-block")).toHaveCount(BLOCKS);

  // Long enough for the pull to fail and try to render
  await page.waitForTimeout(12_000);
  await expect(page.locator(".run-block")).toHaveCount(BLOCKS);
  await expect(page.locator(".drill-list")).toHaveCount(0);
  expect(await page.evaluate(() => location.hash)).toBe(`#/plan/${planId}`);
});

test("a slow plans sync does not drag you off a drill page", async ({ page }) => {
  await signedIn(page, "u10", "#/plans");
  await page.locator("#new-blank").click();
  await expect(page.locator("#plan-title")).toBeVisible();

  await page.goto("/hub/#/plans");
  await page.locator('a[href="#/catalogue"]').click();
  await page.locator(".drill-card-title").first().click();
  await expect(page.locator(".drill-facts")).toBeVisible();

  await page.waitForTimeout(12_000);
  await expect(page.locator(".drill-facts")).toBeVisible();
  await expect(page.locator(".preset-card")).toHaveCount(0);
});

// ---- Controls act on the block you tapped ----

test("removing a block removes that block even with a missing drill in the list", async ({ page }) => {
  await signedIn(page, "u10", "#/plans");
  await page.locator('[data-preset="preset-u10-rucking"]').click();
  await expect(page.locator(".block-row")).toHaveCount(BLOCKS);
  const planId = await page.evaluate(() => location.hash.split("/")[2]);

  // Put a block pointing at a drill that no longer exists at the front, the way a
  // renamed drill id would look in a plan saved last season
  await page.evaluate((id) => {
    const store = JSON.parse(localStorage.getItem("equalplay_hub_plans") ?? "{}");
    const plan = store.plans.find((p: { id: string }) => p.id === id);
    plan.blocks = [{ drillId: "drill-that-was-deleted", minutes: 10 }, ...plan.blocks];
    localStorage.setItem("equalplay_hub_plans", JSON.stringify(store));
  }, planId);

  await page.reload();
  await expect(page.locator(".block-row")).toHaveCount(BLOCKS);
  const titles = await page.locator(".block-title").allInnerTexts();

  // Remove the first visible block. It lives at index 1, not 0.
  await page.locator("[data-remove]").first().click();
  const after = await page.locator(".block-title").allInnerTexts();
  expect(after).toEqual(titles.slice(1));
  // The missing block is still there, so the notice still shows
  await expect(page.locator("#drop-missing")).toBeVisible();
});

test("the minutes stepper edits the block you tapped", async ({ page }) => {
  await signedIn(page, "u10", "#/plans");
  await page.locator('[data-preset="preset-u10-rucking"]').click();
  await expect(page.locator(".block-row")).toHaveCount(BLOCKS);
  const planId = await page.evaluate(() => location.hash.split("/")[2]);

  await page.evaluate((id) => {
    const store = JSON.parse(localStorage.getItem("equalplay_hub_plans") ?? "{}");
    const plan = store.plans.find((p: { id: string }) => p.id === id);
    plan.blocks = [{ drillId: "drill-that-was-deleted", minutes: 10 }, ...plan.blocks];
    localStorage.setItem("equalplay_hub_plans", JSON.stringify(store));
  }, planId);

  await page.reload();
  const first = page.locator("[data-minutes]").first();
  await first.fill("30");
  await first.dispatchEvent("change");

  // The change lands on the visible block rather than the invisible one
  await expect(page.locator("[data-minutes]").first()).toHaveValue("30");
});

// ---- Links out to the RFU ----

test("the age gate points at the RFU's own rules", async ({ page }) => {
  await signedIn(page, "u7");
  await pickTheme(page, "tackle");

  // The moment a coach might wonder who says so
  await expect(page.locator(".hub-empty")).toContainText("Tackle starts at U9");
  const link = page.locator(".hub-empty .rules-link");
  await expect(link).toContainText("RFU rules of play for U7");
  await expect(link).toHaveAttribute(
    "href",
    /englandrugby\.com\/.*appendix-1-u7-rules-of-play$/,
  );
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
});

test("each age group links to its own appendix", async ({ page }) => {
  await signedIn(page, "u10");
  // A search nothing matches gives the same empty state at every grade, so the
  // only thing changing between rounds is the age group
  await page.locator("#f-search").fill("unicycle");

  for (const [age, appendix] of [["u7", 1], ["u8", 2], ["u9", 3], ["u10", 4], ["u11", 5], ["u12", 6]] as const) {
    await page.selectOption("#f-age", age);
    await expect(page.locator(".hub-empty .rules-link")).toHaveAttribute(
      "href",
      new RegExp(`appendix-${appendix}-${age}-rules-of-play$`),
    );
  }
});

test("a drill page backs up the age grade it states", async ({ page }) => {
  await signedIn(page, "u10", "#/catalogue/drill-two-second-ruck");
  const facts = page.locator(".drill-facts");
  await expect(facts).toContainText("U10 and up");
  await expect(facts.locator(".rules-link")).toHaveAttribute(
    "href",
    /appendix-4-u10-rules-of-play$/,
  );
});

test("the running order carries the rules link for the pitch", async ({ page }) => {
  await signedIn(page, "u10", "#/plans");
  await page.locator('[data-preset="preset-u10-rucking"]').click();
  await page.locator(".hub-btn-done").click();
  await expect(page.locator(".run-block")).toHaveCount(BLOCKS);
  await expect(page.locator(".run-head .rules-link")).toContainText("RFU rules of play for U10");
});

test("the account page links the grade you picked", async ({ page }) => {
  await signedIn(page, "u9", "#/account");
  await expect(page.locator(".rules-link")).toContainText("RFU rules of play for U9");
  await expect(page.locator(".rules-link")).toHaveAttribute(
    "href",
    /appendix-3-u9-rules-of-play$/,
  );
});

test("the first-run panel says the rules are the RFU's, not ours", async ({ page }) => {
  await seedSession(page, "u10", false);
  await page.goto("/hub/#/catalogue");
  await expect(page.locator(".hub-welcome")).toContainText("None of this is official RFU guidance");
  await expect(page.locator(".hub-welcome .rules-link")).toContainText("their rules of play");
});

// ---- Signed out is a real state ----

test("a coach with no account is asked their age grade first", async ({ page }) => {
  await signedOut(page, null);
  await expect(page.locator("#hub-view h2")).toHaveText("Which age group do you coach?");

  await page.locator('[data-age="u10"]').click();
  await expect(page.locator(".drill-card-title").first()).toBeVisible();
  // Asked once, then remembered
  await page.reload();
  await expect(page.locator("#hub-view h2").first()).not.toHaveText(
    "Which age group do you coach?",
  );
});

test("the age gate holds with no account", async ({ page }) => {
  await signedOut(page, "u8");
  await pickTheme(page, "breakdown");
  await expect(page.locator(".drill-card")).toHaveCount(0);
  await expect(page.locator("#hub-view")).toContainText("U10");
});

test("starring with no account asks for one, and says why", async ({ page }) => {
  await signedOut(page, "u10");
  await page.locator("[data-fav]").first().click();
  await expect(page).toHaveURL(/#\/join\/favourites/);
  await expect(page.locator(".hub-gate")).toContainText("beyond this browser");
  // The grade they browsed as is carried over rather than asked for twice
  await expect(page.locator("#ageGroup")).toHaveValue("u10");
});

test("sessions with no account explains what an account is for", async ({ page }) => {
  await signedOut(page, "u10", "#/plans");
  await expect(page.locator(".hub-gate")).toContainText("still there next week");
  await expect(page.locator("#auth-form")).toBeVisible();
});

test("the drills stay readable with no account", async ({ page }) => {
  await signedOut(page, "u10");
  // The link, not the card around it. Clicking the article aims at its centre,
  // which moves when the web font swaps in, so under load the click can land
  // somewhere that does not navigate. Waiting on the route makes the failure
  // honest rather than intermittent.
  await page.locator(".drill-card-link").first().click();
  await expect(page).toHaveURL(/#\/catalogue\/./);
  await expect(page.locator(".drill-detail")).toBeVisible();
  await expect(page.locator("#hub-view")).toContainText("Kit");
});

test("the chrome stays put when you move between routes", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 820 });
  await signedOut(page, "u10");
  await expect(page.locator(".drill-card").first()).toBeVisible();

  const chrome = () =>
    page.locator(".app-chrome").evaluate((el) => Math.round(el.getBoundingClientRect().width));
  const settled = await chrome();

  // Signed out used to widen the rail from 15rem to 27rem on any route that
  // showed the auth form, so moving between tabs resized the whole shell and
  // the logo jumped. The chrome is chrome; it does not move.
  for (const route of ["plans", "account", "catalogue"]) {
    await page.locator(`.hub-tab[data-route="${route}"]`).click();
    await expect(page.locator(`.hub-tab[data-route="${route}"]`)).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(await chrome(), `rail resized on #/${route}`).toBe(settled);
  }
});

// ---- Auth form ----

test("the sign-up fields stay in one column", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await signedOut(page, "u10", "#/join/plans");
  await expect(page.locator("#auth-form")).toBeVisible();

  // Multi-column forms measurably increase skipped and misfilled fields, so the
  // space beside the form is used for reassurance rather than for a second column.
  const rows = await page.locator("#auth-form .hub-field").evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return { left: Math.round(r.left), top: Math.round(r.top) };
    }),
  );
  expect(rows.length).toBeGreaterThan(3);
  expect(new Set(rows.map((r) => r.left)).size).toBe(1);
  expect(new Set(rows.map((r) => r.top)).size).toBe(rows.length);
});

test("the space beside the form explains what an account is for", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await signedOut(page, "u10", "#/join/plans");

  const side = await page.evaluate(() => {
    const form = document.querySelector(".hub-auth")!.getBoundingClientRect();
    const aside = document.querySelector(".hub-auth-aside")!.getBoundingClientRect();
    return { beside: aside.left >= form.right, sameRow: Math.abs(aside.top - form.top) < 120 };
  });
  expect(side.beside).toBe(true);
  expect(side.sameRow).toBe(true);

  // Below the form on a phone, not squeezed alongside it
  await page.setViewportSize({ width: 390, height: 900 });
  const stacked = await page.evaluate(() => {
    const form = document.querySelector(".hub-auth")!.getBoundingClientRect();
    return document.querySelector(".hub-auth-aside")!.getBoundingClientRect().top >= form.bottom;
  });
  expect(stacked).toBe(true);
});

test("a password can be checked before it is submitted", async ({ page }) => {
  await signedOut(page, "u10", "#/account");
  const input = page.locator("#password");
  const reveal = page.locator("#reveal-password");

  await input.fill("boots and all");
  await expect(input).toHaveAttribute("type", "password");
  // The button says what it will do, not what the state is
  await expect(reveal).toHaveText("Show");

  await reveal.click();
  await expect(input).toHaveAttribute("type", "text");
  await expect(reveal).toHaveText("Hide");
  await expect(input).toHaveValue("boots and all");

  await reveal.click();
  await expect(input).toHaveAttribute("type", "password");
});

test("the welcome panel's button is not stuck to the text above it", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("equalplay_age_group", "u10"));
  await page.goto("/hub/#/catalogue");
  const dismiss = page.locator("#dismiss-welcome");
  await expect(dismiss).toBeVisible();

  // .hub-fineprint has a top margin and no bottom one, so a button after it sat
  // flush against the words. Buttons stacked on each other keep their own gap.
  const gap = await dismiss.evaluate(
    (el) => el.getBoundingClientRect().top - el.previousElementSibling!.getBoundingClientRect().bottom,
  );
  expect(gap).toBeGreaterThanOrEqual(8);
});
