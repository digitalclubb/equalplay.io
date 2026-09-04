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

/**
 * Type into a search box and let the list catch up.
 *
 * Both searches in the hub rebuild their list behind a debounce now, because
 * doing it on every keystroke cost 127ms a letter on a throttled phone. A
 * locator resolved straight after a `fill` reads the list from before the
 * search, which is how three of these tests started clicking the wrong drill.
 */
async function searchFor(page: Page, box: string, term: string) {
  await page.locator(box).fill(term);
  await page.waitForTimeout(240);
  await settled(page);
}

/**
 * Wait for a view transition to have finished, if one is running.
 *
 * A filter tap, a route change and the session picker all hand the DOM change
 * to `startViewTransition`, which runs the callback a frame later. So the list
 * a test reads straight after a tap is the list from before it. `lib/motion.ts`
 * puts `data-vt` on `<html>` for the length of the transition, so waiting for
 * that to go is waiting for the redraw plus its animation. When there is no
 * transition to run the attribute is never set and this returns at once, which
 * is the same answer.
 */
async function settled(page: Page) {
  await expect(page.locator("html")).not.toHaveAttribute("data-vt", /./);
}

/** Tap a theme filter chip. Tapping the active one again clears the filter. */
async function pickTheme(page: Page, theme: string) {
  await page.locator(`[data-theme="${theme}"]`).click();
  await settled(page);
}

/** Take whichever theme chip is lit back off, leaving the whole list. */
async function clearTheme(page: Page) {
  await page.locator("[data-theme].is-active").click();
  await settled(page);
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
  await clearTheme(page);
  await searchFor(page, "#f-search", "two second ruck");
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

test("a theme chip comes off when it is tapped again", async ({ page }) => {
  await signedIn(page, "u10");
  const all = await page.locator(".drill-card").count();

  await pickTheme(page, "breakdown");
  const narrowed = await page.locator(".drill-card").count();
  expect(narrowed).toBeLessThan(all);

  // The same chip is how a coach gets the whole list back. There is no
  // Anything chip to find, which is the point of it toggling.
  await pickTheme(page, "breakdown");
  await expect(page.locator('[data-theme="breakdown"]')).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".drill-card")).toHaveCount(all);
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

/**
 * The sessions page is two lists, and which of them a coach came for depends on
 * whether they have any. A coach with none needs the thing that makes the first
 * one. A coach with three came back for one of the three, so making them scroll
 * past six ready-made cards to reach it is the wrong way round.
 */
test("your own sessions come first once there are any", async ({ page }) => {
  await signedIn(page, "u10", "#/plans");
  const headings = () => page.locator(".hub-section h2").allInnerTexts();
  await expect(page.locator(".preset-card").first()).toBeVisible();
  // Coverage is always last. It is a thing to notice on the way past rather
  // than a thing a coach came to the page for.
  expect(await headings()).toEqual(["Start a session", "Your sessions", "What you've covered"]);

  await page.locator('[data-preset="preset-u10-rucking"]').click();
  await expect(page.locator("#plan-title")).toBeVisible();
  await page.goto("/hub/#/plans");
  await expect(page.locator(".plan-card")).toHaveCount(1);
  expect(await headings()).toEqual(["Your sessions", "Start a session", "What you've covered"]);

  // The strip on the card is the session, so it carries a piece per block plus
  // the water break the preset comes with
  await expect(page.locator(".plan-card .shape-seg")).toHaveCount(BLOCKS + 1);
});

test("your sessions switch between grid and list, and stay switched", async ({ page }) => {
  await signedIn(page, "u10", "#/plans");
  await page.locator('[data-preset="preset-u10-rucking"]').click();
  await expect(page.locator("#plan-title")).toBeVisible();
  await page.goto("/hub/#/plans");
  await expect(page.locator(".view-toggle")).toHaveCount(1);

  await page.locator('[data-preset="preset-u10-quick-hands"]').click();
  await expect(page.locator("#plan-title")).toBeVisible();
  await page.goto("/hub/#/plans");
  await expect(page.locator(".plan-card")).toHaveCount(2);

  // Both segments one width, or the pill grows and shrinks as it crosses, which
  // is the one thing a toggle does not do. The track is auto-sized in the
  // heading row, so nothing else is levelling them
  const segs = page.locator(".view-toggle .hub-seg");
  const widths = await segs.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width));
  expect(new Set(widths).size).toBe(1);

  await page.locator('[data-plan-view="list"]').click();
  await settled(page);
  await expect(page.locator(".plan-line")).toHaveCount(2);
  await expect(page.locator(".plan-card")).toHaveCount(0);

  // Kept, or it is a setting a coach has to make again on every visit
  await page.reload();
  await expect(page.locator(".plan-line")).toHaveCount(2);
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

  await searchFor(page, "#add-search", "scrum shape");
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
    await searchFor(page, "#add-search", forbidden);
    await expect(page.locator("[data-peek]")).toHaveCount(0);
  }

  // And something a U8 squad can do is still offered
  await searchFor(page, "#add-search", "corner ball");
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
  await expect(page.locator(".sync-notice-offline")).toContainText("saved here");
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
  // The nav is the same five tabs whatever state you are in, because it is one
  // product. What changes is where a tab lands you, not whether it exists.
  await expect(page.locator(".hub-tab")).toHaveCount(5);
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

test("the small space filter narrows the list and survives a drill", async ({ page }) => {
  await signedIn(page, "u10", "#/catalogue");
  const count = async () => page.locator(".drill-card").count();

  const all = await count();
  await page.locator("#f-space").click();
  await settled(page);
  await expect(page.locator("#f-space")).toHaveAttribute("aria-pressed", "true");

  const small = await count();
  expect(small).toBeLessThan(all);
  expect(small).toBeGreaterThan(0);
  await expect(page.locator(".hub-count")).toContainText("sports hall");

  // Filters live above the route, so a trip into a drill and back keeps it
  await page.locator(".drill-card-link").first().click();
  await expect(page.locator(".drill-detail")).toBeVisible();
  await page.locator(".hub-back a").click();
  await expect(page.locator("#f-space")).toHaveAttribute("aria-pressed", "true");
  expect(await count()).toBe(small);
});

test("the small space filter cannot get round the age gate", async ({ page }) => {
  await signedIn(page, "u8", "#/catalogue");
  await page.locator("#f-space").click();
  await settled(page);
  await expect(page.locator("#f-space")).toHaveAttribute("aria-pressed", "true");

  // A tight square does not make a ruck legal for an U8 grade
  for (const theme of ["breakdown", "tackle", "setpiece"]) {
    await pickTheme(page, theme);
    await expect(page.locator(".drill-card")).toHaveCount(0);
  }
});

test("a session can be built for the hall when the pitch is frozen", async ({ page }) => {
  await signedIn(page, "u10", "#/plans");
  await page.locator('[data-preset="preset-u10-rucking"]').click();
  await expect(page.locator(".block-row")).toHaveCount(BLOCKS);

  const all = Number((await page.locator(".add-count").innerText()).match(/(\d+)/)?.[1]);
  await page.locator("#add-space").click();
  await expect(page.locator("#add-space")).toHaveAttribute("aria-pressed", "true");
  const small = Number((await page.locator(".add-count").innerText()).match(/(\d+)/)?.[1]);
  expect(small).toBeLessThan(all);
  expect(small).toBeGreaterThan(0);
});

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
  // Favourites is a route, so the list arrives on the hashchange rather than in
  // the click. Wait on the count before reading a title out of it.
  await expect(page.locator(".drill-card")).toHaveCount(1);
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
  await settled(page);
  await page.locator("#f-fav").click();
  await expect(page).toHaveURL(/#\/favourites$/);
  await expect(page.locator(".drill-card").filter({ hasText: "Two second ruck" })).toHaveCount(0);
});

test("teaches what the star is for when nothing is starred", async ({ page }) => {
  await signedIn(page, "u10");
  await page.locator("#f-fav").click();
  await expect(page.locator(".hub-empty")).toContainText("Star a drill and it'll show up here");
  // No "start again" button, because clearing filters is not the fix here
  await expect(page.locator("#clear-filters")).toHaveCount(0);
});

test("favourites is a place, not a filter setting", async ({ page }) => {
  await signedIn(page, "u10");
  const name = await page.locator(".drill-card-title").first().innerText();
  await page.locator(".drill-card").first().locator(".fav-btn").click();

  await page.locator("#f-fav").click();
  await expect(page).toHaveURL(/#\/favourites$/);
  // It is still the drill catalogue, so that is the tab that stays lit
  await expect(page.locator('.hub-tab[data-route="catalogue"]')).toHaveClass(/is-active/);

  // The whole point of a route: this survives a reload rather than a redraw
  await page.reload();
  await page.waitForSelector(".hub-tab");
  await expect(page.locator(".drill-card-title")).toHaveText(name);
});

test("a drill opened out of favourites comes back to favourites", async ({ page }) => {
  await signedIn(page, "u10");
  await page.locator(".drill-card").first().locator(".fav-btn").click();
  await page.locator("#f-fav").click();

  await page.locator(".drill-card-link").first().click();
  await expect(page).toHaveURL(/#\/favourites\/./);
  await expect(page.locator(".drill-detail")).toBeVisible();

  await page.getByRole("link", { name: /Back to your favourites/ }).click();
  await expect(page).toHaveURL(/#\/favourites$/);
  await expect(page.locator(".drill-card")).toHaveCount(1);
});

test("favourites with no account asks for one, and says why", async ({ page }) => {
  await signedOut(page, "u10", "#/favourites");
  await expect(page.locator(".hub-gate")).toContainText("beyond this browser");
  await expect(page.locator("#auth-form")).toBeVisible();
});

test("the gate hands a coach on to what they were reaching for", async ({ page }) => {
  // Landing on the gate with a session is what signing up through it looks like
  await signedIn(page, "u10", "#/join/favourites");
  await expect(page).toHaveURL(/#\/favourites$/);

  await page.goto("/hub/#/join/plans");
  await expect(page).toHaveURL(/#\/plans$/);
});

test("the gate does not trap the back button behind it", async ({ page }) => {
  await signedIn(page, "u10");
  await page.evaluate(() => {
    location.hash = "#/join/favourites";
  });
  await expect(page).toHaveURL(/#\/favourites$/);

  // The gate is gone rather than sitting one step back, sending them forwards again
  await page.goBack();
  await expect(page).toHaveURL(/#\/catalogue$/);
});

test("a drill read with no account backs out to the drills", async ({ page }) => {
  await signedOut(page, "u10", "#/favourites/warmup-tail-snatch");
  await expect(page.locator(".drill-detail")).toBeVisible();

  // Not "back to your favourites": with no account that is the register form
  await page.getByRole("link", { name: /Back to drills/ }).click();
  await expect(page).toHaveURL(/#\/catalogue$/);
  await expect(page.locator(".hub-count")).toBeVisible();
});

test("start again gets out of an empty favourites list", async ({ page }) => {
  await signedIn(page, "u10");
  await pickTheme(page, "breakdown");
  await page.locator(".drill-card").filter({ hasText: "Two second ruck" }).locator(".fav-btn").click();

  // A U8 squad cannot do the one drill they starred, so the list is empty
  await page.selectOption("#f-age", "u8");
  await settled(page);
  await page.locator("#f-fav").click();
  await expect(page.locator(".hub-empty")).toBeVisible();

  await page.locator("#clear-filters").click();
  await expect(page).toHaveURL(/#\/catalogue$/);
  // The hash moves in the click, the list on the hashchange after it. `count()`
  // does not retry, so it has to wait on something that does.
  await expect(page.locator(".hub-empty")).toHaveCount(0);
  expect(await page.locator(".drill-card").count()).toBeGreaterThan(20);
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

  await searchFor(page, "#add-search", "cheek to cheek");
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

  await searchFor(page, "#add-search", "cheek to cheek");
  await page.locator("[data-peek]").first().click();

  const button = await page.locator("[data-add]").boundingBox();
  const prose = await page.locator(".add-peek > p").last().boundingBox();
  expect(button && prose && button.y < prose.y).toBe(true);
});

test("the add button is readable, not white on grey", async ({ page }) => {
  await signedIn(page, "u10", "#/plans");
  await page.locator('[data-preset="preset-u10-rucking"]').click();
  await expect(page.locator(".block-row")).toHaveCount(BLOCKS);

  await searchFor(page, "#add-search", "cheek to cheek");
  await page.locator("[data-peek]").first().click();

  const seen = await page.locator("[data-add]").evaluate((el) => {
    const style = getComputedStyle(el);
    return { colour: style.color, background: style.backgroundColor };
  });
  // Orange background with white on it, rather than the pale row background
  expect(seen.colour).toBe("rgb(255, 255, 255)");
  expect(seen.background).toBe("rgb(207, 57, 24)");
});

test("a drill goes into a session from the drill page", async ({ page }) => {
  await signedIn(page, "u10", "#/plans");
  await page.locator('[data-preset="preset-u10-rucking"]').click();
  await expect(page.locator(".block-row")).toHaveCount(BLOCKS);

  await page.goto("/hub/#/catalogue/drill-two-second-ruck");
  await page.locator("#drill-add").click();
  await expect(page.locator("[data-addto]")).toHaveCount(1);
  await page.locator("[data-addto]").first().click();

  await page.locator(".hub-tab[data-route='plans']").click();
  await page.locator(".drill-card").first().click();
  await expect(page.locator(".run-block")).toHaveCount(BLOCKS + 1);
});

test("opening the session picker does not throw the page back to the title", async ({ page }) => {
  await signedIn(page, "u10", "#/plans");
  await page.locator('[data-preset="preset-u10-rucking"]').click();
  await expect(page.locator(".block-row")).toHaveCount(BLOCKS);

  await page.goto("/hub/#/catalogue/drill-two-second-ruck");
  const button = page.locator("#drill-add");
  await button.scrollIntoViewIfNeeded();
  const pageScroll = await page.evaluate(() => window.scrollY);
  expect(pageScroll).toBeGreaterThan(0);

  await button.click();
  // The picker replaces the button at the foot of a long drill. Scrolling back
  // to the title would put what the coach just asked for off the screen.
  await expect(page.locator("[data-addto]").first()).toBeInViewport();
  expect(await page.evaluate(() => window.scrollY)).toBe(pageScroll);
});

test("a session the drill's grade cannot do is not offered", async ({ page }) => {
  await signedIn(page, "u8", "#/plans");
  await page.locator(".preset-card").first().click();
  await expect(page.locator(".block-row")).not.toHaveCount(0);

  // A bookmark to a ruck drill opens for anyone. The U8 session must not be a
  // place it can be put, and the new session it offers has to be a grade that
  // is allowed the drill.
  await page.goto("/hub/#/catalogue/drill-two-second-ruck");
  await page.locator("#drill-add").click();
  await expect(page.locator("[data-addto]")).toHaveCount(0);
  await expect(page.locator(".drill-add")).toContainText("cannot do this drill");

  await page.locator("#drill-add-new").click();
  await expect(page.locator(".plan-age")).not.toHaveText("U8");
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

  // The editor arrives on a view transition, so the page is still moving for a
  // beat after the count lands. Measuring geometry before it has stopped reads
  // a page that is on its way somewhere.
  await settled(page);

  // Get down to the add panel, and scroll inside its list as well
  await page.locator("#add-search").scrollIntoViewIfNeeded();
  const list = page.locator(".add-list");
  await list.evaluate((el) => { el.scrollTop = 200; });

  const row = page.locator("[data-peek]").nth(6);
  // On screen before it is tapped. A click on a row below the fold makes
  // Playwright scroll to it first, so the scroll this measures would be its own
  // rather than the app's, and the test would then be reporting on how tall the
  // panel above the list happens to be.
  await row.scrollIntoViewIfNeeded();

  const listScroll = await list.evaluate((el) => el.scrollTop);
  const pageScroll = await page.evaluate(() => window.scrollY);
  expect(pageScroll).toBeGreaterThan(0);
  expect(listScroll).toBeGreaterThan(0);

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

  await settled(page);

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
  await expect(page.locator("#save-state")).toContainText("not on the server yet", {
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
  await searchFor(page, "#f-search", "corner ball");
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
  await searchFor(page, "#f-search", "unicycle");

  for (const [age, appendix] of [["u7", 1], ["u8", 2], ["u9", 3], ["u10", 4], ["u11", 5], ["u12", 6]] as const) {
    await page.selectOption("#f-age", age);
    await settled(page);
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

test("a drill page links the rules for the grade being coached", async ({ page }) => {
  // A warm-up legal from U7, opened by a U10 coach. This linked the drill's own
  // floor, so it sent them to the U7 appendix: the right document for the "U7
  // and up" line above it and the wrong one for the person reading. A drill
  // page is never age gated, so the grade being browsed is the useful one.
  await signedIn(page, "u10", "#/catalogue/warmup-tail-snatch");
  const facts = page.locator(".drill-facts");
  await expect(facts).toContainText("U7 and up");
  await expect(facts.locator(".rules-link")).toContainText("RFU rules of play for U10");
  await expect(facts.locator(".rules-link")).toHaveAttribute(
    "href",
    /appendix-4-u10-rules-of-play$/,
  );
  // Two separate claims, so two rows. The drill's grade under "Age grade" and
  // the reader's under "Your grade". Printed as one, "U7 and up" sitting over a
  // U10 appendix reads as though the drill's range were the reader's.
  await expect(facts.locator("dt", { hasText: "Your grade" })).toBeVisible();
});

test("a contact drill points at the RFU's concussion education", async ({ page }) => {
  // Every contact drill carries a safety note about what to watch for during
  // the drill. What to do after a knock is a national programme, and the
  // product linked it from nowhere at all.
  await signedIn(page, "u10", "#/catalogue/drill-two-second-ruck");
  const safety = page.locator(".drill-safety");
  await expect(safety.locator("a")).toContainText("Headcase");
  await expect(safety.locator("a")).toHaveAttribute("href", /player-welfare\/headcase$/);

  // Not on a warm-up nobody can get hit in. Keyed off contact rather than off
  // the safety note, which movement prep also carries.
  await page.goto("/hub/#/catalogue/warmup-tail-snatch");
  await expect(page.locator(".drill-facts")).toBeVisible();
  await expect(page.locator(".drill-safety a")).toHaveCount(0);
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
  await expect(page.locator(".hub-welcome")).toContainText("Not official RFU guidance");
  await expect(page.locator(".hub-welcome .rules-link")).toContainText("their rules of play");

  // Short enough that the drills are not below a screen of explanation. This
  // ran to three paragraphs, which on a phone is the whole first screen.
  const panel = await page.locator(".hub-welcome").boundingBox();
  expect(panel!.height).toBeLessThan(300);
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

test("the chrome runs edge to edge on a small phone", async ({ page }) => {
  // The hub used to put 8px of side padding on `body` below 360px, which inset
  // the whole shell. The navy went with it, so every hub route wore a pair of
  // background-coloured gutters that /planner, sharing the same shell, did not.
  const WIDTH = 320;
  await page.setViewportSize({ width: WIDTH, height: 844 });

  const chrome = () =>
    page.locator(".app-chrome").evaluate((el) => {
      const box = el.getBoundingClientRect();
      return { left: Math.round(box.left), width: Math.round(box.width) };
    });

  await signedOut(page, "u10");
  for (const route of ["catalogue", "plans", "account"]) {
    await page.goto(`/hub/#/${route}`);
    await expect(page.locator(".app-chrome")).toBeVisible();
    expect(await chrome(), `#/${route}`).toEqual({ left: 0, width: WIDTH });
  }

  await page.goto("/planner");
  expect(await chrome(), "/planner").toEqual({ left: 0, width: WIDTH });
});

test("the bar fits the phone at every phone width, tabs and switch", async ({ page }) => {
  // The tabs used to size to their own labels. Four fitted; the fifth put them
  // at 340px against a 320px phone and both entries scrolled sideways. The bar
  // shares its width evenly now, and "Match day" wraps where it will not fit
  // rather than turning into "Match da...".
  //
  // Swept rather than sampled. The first fix at 320px used a 360px breakpoint
  // for the wrap, which left 361px and 362px truncating. One width proves one
  // width, and phones are not all 320.
  await signedOut(page, "u10");

  for (const path of ["/hub/#/catalogue", "/planner"]) {
    for (let width = 320; width <= 480; width += 1) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(path);
      await expect(page.locator(".hub-tab").first()).toBeVisible();

      const bar = await page.locator(".hub-nav").evaluate((el) => {
        const tabs = [...el.querySelectorAll(".hub-tab")].map((tab) => {
          const label = tab.querySelector(".hub-tab-label") as HTMLElement;
          return {
            text: label.textContent,
            height: tab.getBoundingClientRect().height,
            cut: label.scrollWidth > label.clientWidth + 0.5,
          };
        });
        return { scroll: el.scrollWidth, client: el.clientWidth, tabs };
      });

      const where = `${path} at ${width}px`;
      expect(bar.scroll, `${where}: the nav overflows its bar`).toBeLessThanOrEqual(bar.client);
      expect(bar.tabs, `${where}: tab count`).toHaveLength(5);
      for (const tab of bar.tabs) {
        expect(tab.cut, `${where}: "${tab.text}" is truncated`).toBe(false);
        // Still a target a thumb can hit.
        expect(tab.height, `${where}: "${tab.text}" is too short to tap`).toBeGreaterThanOrEqual(44);
      }

      // The colour switch sits in the bar's top right corner, positioned
      // absolutely so the centred logo stays centred rather than being shoved
      // 48px to the left by it. Absolute means nothing pushes back when the
      // logo grows into it, so the clearance is measured rather than assumed.
      const corner = await page.locator(".app-chrome").evaluate((el) => {
        const toggle = (el.querySelector(".scheme-toggle") as HTMLElement).getBoundingClientRect();
        const logo = (el.querySelector(".logo-link") as HTMLElement).getBoundingClientRect();
        return {
          right: toggle.right,
          size: Math.min(toggle.width, toggle.height),
          clear: toggle.left - logo.right,
        };
      });
      expect(corner.right, `${where}: the switch runs off the screen`).toBeLessThanOrEqual(width);
      expect(corner.size, `${where}: the switch is too small to tap`).toBeGreaterThanOrEqual(44);
      expect(corner.clear, `${where}: the switch is sitting on the logo`).toBeGreaterThan(0);
    }
  }
});

test("the Guide tab reaches the guides from either entry", async ({ page }) => {
  await signedOut(page, "u10");

  await page.goto("/hub/#/catalogue");
  await page.locator('.hub-tab[data-route="guide"]').click();
  await expect(page).toHaveURL(/#\/guide$/);
  await expect(page.locator(".guide-card")).toHaveCount(6);
  // Still inside the app, with the tab lit and the chrome unchanged.
  await expect(page.locator('.hub-tab[data-route="guide"]')).toHaveAttribute(
    "aria-current",
    "page",
  );

  // From the planner it is a different document, so it is a path rather than a
  // fragment, and it has to land on the same place.
  await page.goto("/planner");
  await page.locator('.hub-tab[data-route="guide"]').click();
  await expect(page).toHaveURL(/\/hub#\/guide$/);
  await expect(page.locator(".guide-card")).toHaveCount(6);
});

test("a guide reads with no account and no grade picked", async ({ page }) => {
  // The guide is what every grade may do, so being asked which one you coach is
  // no answer to it. It comes before the age picker, like a shared session.
  await page.goto("/hub/#/guide/u10");
  await expect(page.locator(".guide h2")).toHaveText("What changes at U10");
  await expect(page.locator(".age-picker")).toHaveCount(0);

  // And a coach can walk the grades from there.
  await page.locator('.guide-steps a[href="#/guide/u11"]').click();
  await expect(page.locator(".guide h2")).toHaveText("What changes at U11");
});

test("the guide reads as an article rather than as one flat size", async ({ page }) => {
  /**
   * The first version had the title at 17.6px, both heading levels and the body
   * all at 16px, and the standfirst at 13.6px, which is smaller than the text it
   * introduces. Four levels of hierarchy inside 1.6px of each other, with weight
   * doing the whole job. Nothing caught it, because nothing was looking.
   *
   * The numbers below are floors rather than the design. What they hold is that
   * each level stays clear of the one under it and that the measure stays
   * readable.
   */
  await page.setViewportSize({ width: 1280, height: 900 });
  await signedOut(page, "u10");
  await page.goto("/hub/#/guide/u10");
  await expect(page.locator(".guide-title")).toBeVisible();

  const type = await page.evaluate(() => {
    const size = (sel: string) => {
      const el = document.querySelector(sel);
      return el ? parseFloat(getComputedStyle(el).fontSize) : 0;
    };
    const body = document.querySelector(".guide-section p") as HTMLElement;
    return {
      title: size(".guide-title"),
      lede: size(".guide-lede"),
      h3: size(".guide-section h3"),
      h4: size(".guide-section h4"),
      body: size(".guide-section p"),
      // Roughly how many characters fit on a line of body copy.
      measure: body.getBoundingClientRect().width / (parseFloat(getComputedStyle(body).fontSize) * 0.5),
      lineHeight: parseFloat(getComputedStyle(body).lineHeight),
    };
  });

  expect(type.body, "body copy below 16px").toBeGreaterThanOrEqual(16);
  // Each level clear of the one below it, rather than leaning on weight alone.
  expect(type.title, "the title barely outranks a section heading").toBeGreaterThan(type.h3 * 1.4);
  expect(type.h3, "section headings do not outrank subheadings").toBeGreaterThan(type.h4 * 1.15);
  expect(type.h4, "subheadings are the same size as body copy").toBeGreaterThan(type.body * 1.05);
  // A standfirst introduces the body, so it cannot be smaller than it.
  expect(type.lede, "the standfirst is smaller than the body").toBeGreaterThan(type.body);

  expect(type.measure, "lines are too long to read comfortably").toBeLessThan(78);
  expect(type.measure, "lines are too short").toBeGreaterThan(45);
  expect(type.lineHeight / type.body, "body copy is set too tight").toBeGreaterThan(1.45);
});

test("the guide shows a grade above the coach's own", async ({ page }) => {
  // The catalogue must never do this. The guide has to: the grade you are going
  // up to in September is the one you want to read in August.
  await signedOut(page, "u8");
  await page.goto("/hub/#/guide");
  await expect(page.locator(".guide-card.is-yours")).toHaveCount(1);

  await page.locator('.guide-card[href="#/guide/u12"]').click();
  await expect(page.locator(".guide h2")).toHaveText("What changes at U12");
  await expect(page.locator(".guide")).toContainText("The scrum goes to five");
});

// ---- Sharing ----

/**
 * The build under test carries throwaway Supabase credentials, so every request
 * fails. That is the point: a coach makes a link in a car park, and what the
 * interface says about it has to be true.
 */

// ---- Present mode ----

/** Build the rucking preset and land on its running order. */
async function runnableSession(page: Page) {
  await signedIn(page, "u10", "#/plans");
  await page.locator('[data-preset="preset-u10-rucking"]').click();
  await expect(page.locator(".block-row")).toHaveCount(BLOCKS);
  const planId = (page.url().match(/#\/plan\/([^/]+)/) ?? [])[1];
  await page.locator(".hub-btn-done").click();
  return planId;
}

test("running a session opens one block at a time with the clock going", async ({ page }) => {
  await runnableSession(page);
  await page.locator("text=Run it").click();
  await expect(page.locator(".run-stage-count")).toHaveText(`1 of ${BLOCKS}`);

  // The clock starts from the minutes the block was given, not the drill's
  // suggested length, because a coach may have stretched it. Read as a range
  // rather than an exact `8:00`: it leaves that value one second after render
  // and never comes back to it, so an exact match races the thing it measures.
  const minutes = Number(
    (await page.locator(".run-stage-meta").innerText()).match(/(\d+) min/)?.[1],
  );
  const seconds = async () => {
    const shown = (await page.locator("#run-time").innerText()).trim();
    expect(shown).toMatch(/^\d+:\d\d$/);
    const [m, s] = shown.split(":").map(Number);
    return m * 60 + s;
  };

  const first = await seconds();
  expect(first).toBeLessThanOrEqual(minutes * 60);
  expect(first).toBeGreaterThan((minutes - 1) * 60);

  // It is counting, rather than showing a number and sitting there
  await page.waitForTimeout(2500);
  expect(await seconds()).toBeLessThan(first);
});

test("the block being run is in the URL, so a reload lands back on it", async ({ page }) => {
  await runnableSession(page);
  await page.locator("text=Run it").click();

  const second = await page.locator(".run-stage-next-drill").innerText();
  await page.locator(".run-stage-next").click();
  await expect(page.locator(".run-stage-count")).toHaveText(`2 of ${BLOCKS}`);
  await expect(page.locator(".run-stage-title")).toHaveText(second);

  await page.reload();
  await expect(page.locator(".run-stage-count")).toHaveText(`2 of ${BLOCKS}`);
  await expect(page.locator(".run-stage-title")).toHaveText(second);
});

test("a block number past the end of the session corrects itself", async ({ page }) => {
  const planId = await runnableSession(page);

  await page.goto(`/hub/#/plan/${planId}/run/99`);
  await expect(page.locator(".run-stage-count")).toHaveText(`${BLOCKS} of ${BLOCKS}`);
  // The last block has nowhere further to go, so it offers the way out instead
  await expect(page.locator(".run-stage-next")).toHaveCount(0);
  await expect(page.locator(".run-stage-steps")).toContainText("That's the session");
  expect(page.url()).toContain(`/run/${BLOCKS - 1}`);
});

test("the clock can be paused, and holds where it was", async ({ page }) => {
  await runnableSession(page);
  await page.locator("text=Run it").click();
  await expect(page.locator("#run-time")).toBeVisible();

  await page.locator("#run-pause").click();
  await expect(page.locator("#run-pause")).toHaveText("Start");
  const held = await page.locator("#run-time").innerText();

  await page.waitForTimeout(2500);
  expect((await page.locator("#run-time").innerText()).trim()).toBe(held.trim());

  await page.locator("#run-pause").click();
  await expect(page.locator("#run-pause")).toHaveText("Pause");
  await expect(page.locator("#run-time")).not.toHaveText(held, { timeout: 4000 });
});

test("leaving the session and running it again starts the clock fresh", async ({ page }) => {
  const planId = await runnableSession(page);
  await page.goto(`/hub/#/plan/${planId}/run/0`);
  const minutes = Number(
    (await page.locator(".run-stage-meta").innerText()).match(/(\d+) min/)?.[1],
  );

  // Checking the running order in the car park at 6:15 must not open training
  // at 6:30 on a red overrun, on every block that was looked at
  await page.locator(".run-stage-next").click();
  await expect(page.locator(".run-stage-count")).toHaveText(`2 of ${BLOCKS}`);
  await page.locator(".hub-btn-done").click();
  await expect(page.locator(".run-head")).toBeVisible();

  await page.locator("text=Run it").click();
  await expect(page.locator("#run-time")).toHaveAttribute("data-over", "false");
  // Near the full block rather than exactly on it. Reading an exact value races
  // the second hand for no benefit: what matters is that it did not carry the
  // time the first look through spent.
  const shown = (await page.locator("#run-time").innerText()).trim();
  const [m, sec] = shown.split(":").map(Number);
  expect(m * 60 + sec).toBeGreaterThan(minutes * 60 - 5);
  expect(m * 60 + sec).toBeLessThanOrEqual(minutes * 60);
});

test("a block that overruns says so rather than stopping at zero", async ({ page }) => {
  const planId = await runnableSession(page);

  // A block with no minutes left in it is over the moment it starts, which is
  // the same state a block that ran long ends up in
  await page.goto(`/hub/#/plan/${planId}/edit`);
  await page.locator('[data-minutes="0"]').fill("0");
  await page.locator('[data-minutes="0"]').dispatchEvent("change");
  await page.goto(`/hub/#/plan/${planId}/run/0`);

  await expect(page.locator("#run-time")).toContainText("over");
  await expect(page.locator("#run-time")).toHaveAttribute("data-over", "true");
});

test("a session can be turned into a link", async ({ page }) => {
  await signedIn(page, "u10", "#/plans");
  await page.locator('[data-preset="preset-u10-rucking"]').click();
  await expect(page).toHaveURL(/#\/plan\/.+\/edit/);
  await page.getByRole("link", { name: "Done" }).click();

  await page.locator("#plan-share").click();

  const field = page.locator("#share-url");
  // `/hub`, not `/hub/`. The service worker precaches the first and matches
  // exactly, so the trailing slash would miss the cache with no signal.
  await expect(field).toHaveValue(
    /\/hub#\/shared\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
  );
  // The server is unreachable, so the link exists before it works. Say so
  await expect(page.locator("#share-note")).toContainText("back in signal");
});

test("sharing can be taken back", async ({ page }) => {
  await signedIn(page, "u10", "#/plans");
  await page.locator('[data-preset="preset-u10-rucking"]').click();
  await page.getByRole("link", { name: "Done" }).click();

  await page.locator("#plan-share").click();
  await expect(page.locator("#share-url")).toBeVisible();

  await page.locator("#plan-unshare").click();
  await expect(page.locator("#share-url")).toHaveCount(0);
  await expect(page.locator("#plan-share")).toBeVisible();
});

test("a shared session opens with no account and no age grade picked", async ({ page }) => {
  // Not even the age picker first. Being asked which grade you coach is no
  // answer to a link somebody sent you.
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem("__seeded", "1");
  });
  await page.goto("/hub/#/shared/8f3a1c2d-4e5f-4a6b-8c9d-0e1f2a3b4c5d");

  await expect(page.locator(".hub-empty")).toContainText("needs signal");
  await expect(page.locator(".age-picker-grid")).toHaveCount(0);
  await expect(page.locator("#auth-form")).toHaveCount(0);
});

test("stopping without signal says the link is still live", async ({ page }) => {
  await signedIn(page, "u10", "#/plans");
  await page.locator('[data-preset="preset-u10-rucking"]').click();
  await page.getByRole("link", { name: "Done" }).click();

  await page.locator("#plan-share").click();
  await expect(page.locator("#share-url")).toBeVisible();

  await page.locator("#plan-unshare").click();
  // The panel goes back to "Create a link" while the server still has the token,
  // so the note has to survive that repaint rather than be written into the
  // panel the click came from.
  await expect(page.locator("#plan-share")).toBeVisible();
  await expect(page.locator("#share-note")).toContainText("keeps working");
});

test("a link wearing the button class is a button", async ({ page }) => {
  // `.hub-btn` is worn by anchors as often as by buttons, and an inline box
  // ignores min-height and width. Every link wearing it came out underlined and
  // 23px tall inside a 48px pill, the shared view's and the empty plan's alike.
  await signedOut(page, "u10", "#/shared/8f3a1c2d-4e5f-4a6b-8c9d-0e1f2a3b4c5d");

  const link = page.locator(".hub-empty a.hub-btn");
  await expect(link).toBeVisible();
  const drawn = await link.evaluate((el) => ({
    decoration: getComputedStyle(el).textDecorationLine,
    height: Math.round(el.getBoundingClientRect().height),
  }));
  expect(drawn.decoration).toBe("none");
  // The project's own touch minimum, which an inline box silently ignores
  expect(drawn.height).toBeGreaterThanOrEqual(44);
});

test("a link that is not a token is not treated as one", async ({ page }) => {
  await signedOut(page, "u10", "#/shared/nonsense");
  await expect(page.locator(".hub-empty")).toContainText("doesn't work any more");
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

test("coming back to a block keeps the time it had already used", async ({ page }) => {
  await runnableSession(page);
  await page.locator("text=Run it").click();
  await expect(page.locator("#run-time")).toBeVisible();

  await page.locator("#run-pause").click();
  const held = (await page.locator("#run-time").innerText()).trim();

  // Next is a big primary button on a wet screen. One mistaken tap used to hand
  // the block back a full set of minutes it had already spent.
  await page.locator(".run-stage-next").click();
  await expect(page.locator(".run-stage-count")).toHaveText(`2 of ${BLOCKS}`);
  await page.goBack();
  await expect(page.locator(".run-stage-count")).toHaveText(`1 of ${BLOCKS}`);
  // Retrying rather than read once. The clock paints in its own pass just after
  // the view, so a single read can catch it between the two and fail on an
  // empty string rather than on anything being wrong.
  await expect(page.locator("#run-time")).toHaveText(held);

  // Reset is the deliberate way to start the block again
  await page.locator("#run-reset").click();
  await expect(page.locator("#run-time")).not.toHaveText(held);
});

test("present mode says when a block is one the grade may not do", async ({ page }) => {
  await signedIn(page, "u10", "#/plans");
  await page.locator('[data-preset="preset-u10-rucking"]').click();
  await expect(page.locator(".block-row")).toHaveCount(BLOCKS);
  const planId = (page.url().match(/#\/plan\/([^/]+)/) ?? [])[1];

  // Drop the plan's grade under its own blocks, the way a shared session or a
  // corrected profile can. The pitch is the last screen that could catch it.
  await page.evaluate((id) => {
    const key = "equalplay_hub_plans";
    const store = JSON.parse(localStorage.getItem(key) ?? "{}");
    for (const plan of store.plans ?? []) if (plan.id === id) plan.ageGroup = "u7";
    localStorage.setItem(key, JSON.stringify(store));
  }, planId);

  await page.goto(`/hub/#/plan/${planId}/run/0`);
  await expect(page.locator(".run-stage .plan-warning-error").first()).toBeVisible();
});

test("present mode says how to set the drill up, not only what to watch for", async ({
  page,
}) => {
  await runnableSession(page);
  await page.locator("text=Run it").click();
  await expect(page.locator("#run-time")).toBeVisible();

  // The screen a coach holds while the cones go out. It carried the coaching
  // points and none of the instructions, so it was a set of reminders for
  // somebody who had never been told the drill in the first place. The drill
  // page and the reading view both carry the picture; this is the one on the
  // pitch.
  await expect(page.locator(".run-stage-setup")).not.toBeEmpty();
  await expect(page.locator(".run-stage-figure svg")).toBeVisible();

  // How it runs plus the ways to change it are one tap away rather than on the
  // page, because the points have to stay readable at arm's length.
  const more = page.locator(".run-stage-more");
  await expect(more.locator(".run-stage-more-body")).toBeHidden();
  await more.locator("summary").click();
  await expect(more.locator(".run-stage-more-body")).toBeVisible();
  // The faults come first, because the first question when a block is going
  // wrong is whether the drill is wrong or whether it is being done wrong.
  // Then easier before harder, since that is the one a coach reaches for.
  await expect(more.locator(".run-more-label")).toHaveText([
    "When it is not working",
    "Make it easier",
    "Make it harder",
  ]);
});

test("eight turned up, so the session says which blocks will not run", async ({ page }) => {
  const planId = await runnableSession(page);
  await page.goto(`/hub/#/plan/${planId}`);

  // The car park. You wrote this for a full squad on Sunday.
  await page.locator("#tonight-players").fill("8");
  await page.locator("#tonight-check").click();
  await expect(page.locator(".tonight-verdict")).toContainText("8 here");
  const short = page.locator(".tonight-note-short");
  await expect(short.first()).toBeVisible();

  // A stand-in runs tonight rather than editing the session.
  const swap = page.locator("[data-swap]").first();
  const index = await swap.getAttribute("data-swap");
  await swap.click();
  await expect(page.locator(".tonight-note-swapped").first()).toBeVisible();

  // It reaches the screen the drill is actually run from.
  await page.goto(`/hub/#/plan/${planId}/run/${index}`);
  await expect(page.locator(".run-stage-swapped")).toContainText("Standing in for");

  // And the session a coach wrote is still the session they wrote.
  const stored = await page.evaluate(() => localStorage.getItem("equalplay_hub_plans") ?? "");
  expect(stored).not.toContain("swaps");

  await page.goto(`/hub/#/plan/${planId}`);
  await page.locator("#tonight-clear").click();
  await expect(page.locator(".tonight-note-swapped")).toHaveCount(0);
  await expect(page.locator("#tonight-check")).toHaveText(/Check the session/);
});

test("marking a night as run fills in what you have covered", async ({ page }) => {
  const planId = await runnableSession(page);
  await page.goto(`/hub/#/plan/${planId}`);

  // The server is unreachable, so this proves the log works at a pitch with no
  // signal, which is exactly where it gets tapped.
  await page.locator("#plan-ran").click();
  await expect(page.locator(".ran-it-done")).toContainText("Marked as run today");

  await page.goto("/hub/#/plans");
  const covered = page.locator(".coverage-row-never");
  // The rucking session covers ruck and maul, evasion and game sense, so the
  // three it does not touch are the ones a coach needs pointing out.
  await expect(covered).toHaveCount(3);
  await expect(page.locator(".coverage")).toContainText("1 night");

  // Undoing it takes the night back out.
  await page.goto(`/hub/#/plan/${planId}`);
  await page.locator("[data-unrun]").click();
  await expect(page.locator("#plan-ran")).toBeVisible();
});

test("a U8 coach is never told they have neglected rucking", async ({ page }) => {
  // Coverage lists themes to work on. Listing one Regulation 15 does not allow
  // at the grade would be the app telling a coach to break it.
  await signedIn(page, "u8", "#/plans");
  await expect(page.locator(".coverage")).toBeVisible();
  await expect(page.locator(".coverage-list")).toHaveCount(0);

  await page.locator(".preset-card").first().click();
  await page.getByRole("link", { name: "Done" }).click();
  await page.locator("#plan-ran").click();
  await page.goto("/hub/#/plans");

  const themes = await page.locator(".coverage-theme").allInnerTexts();
  expect(themes).not.toContain("Ruck and maul");
  expect(themes).not.toContain("Tackle");
  expect(themes).not.toContain("Scrum and restarts");
});

test("a drill says what going wrong looks like, plus what to say", async ({ page }) => {
  await signedIn(page, "u10", "#/catalogue/drill-front-on-tackle");

  // The audience is a parent who never played. "Head slips to the side of the
  // hips" is a reminder, and a reminder only works for somebody who has seen it
  // go right. This is the part that tells them what they are looking at.
  const faults = page.locator(".drill-faults");
  await expect(faults).toBeVisible();
  await expect(faults.locator("dt").first()).toContainText("Head coming up");
  await expect(faults.locator("dd").first()).toContainText("Eyes open");

  // And it reaches the pitch, which is where the drill is actually going wrong.
  const planId = await runnableSession(page);
  await page.goto(`/hub/#/plan/${planId}/run/0`);
  await page.locator(".run-stage-more summary").click();
  await expect(page.locator(".run-faults")).toBeVisible();
});

test("buttons sitting in a row line up with each other", async ({ page }) => {
  await runnableSession(page);
  await page.locator("text=Run it").click();
  await expect(page.locator(".run-stage-steps .hub-btn").first()).toBeVisible();

  // `.hub-btn + .hub-btn` stacks buttons with a top margin, which in a row with
  // a gap drops everything after the first 8px lower and 8px shorter. It landed
  // on the age picker once and on present mode's Next button months later, so
  // this measures every row rather than the one that was noticed.
  for (const row of [".run-stage-steps", ".run-clock-actions"]) {
    const boxes = await page.locator(`${row} .hub-btn`).evaluateAll((els) =>
      els.map((el) => {
        const box = el.getBoundingClientRect();
        return { top: Math.round(box.top), height: Math.round(box.height) };
      }),
    );
    expect(boxes.length, row).toBeGreaterThan(1);
    for (const box of boxes) {
      expect(box.top, `${row} tops`).toBe(boxes[0].top);
      expect(box.height, `${row} heights`).toBe(boxes[0].height);
    }
  }
});

test("what to do with a session answers a pointer and does not overlap", async ({ page }) => {
  // Two faults in the one panel. Print it and Duplicate were spaced by
  // `.hub-btn + .hub-btn`, a top margin on a phone and a left one at 900px.
  // Once they go to auto width they are inline boxes, so a pair that wraps onto
  // two lines has nothing spacing them vertically and the second sat 25px up
  // inside the first. The other is that only the filled tier had a hover rule,
  // which left all three of these dead under a mouse.
  const planId = await runnableSession(page);
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.goto(`/hub/#/plan/${planId}/edit`);
  await expect(page.locator("#plan-delete")).toBeVisible();

  const rows = await page.locator(".plan-actions .hub-btn").evaluateAll((els) =>
    els.map((el) => {
      const box = el.getBoundingClientRect();
      return { top: Math.round(box.top), bottom: Math.round(box.bottom) };
    }),
  );
  expect(rows.length).toBe(2);
  const [first, second] = rows;
  const sideBySide = first.top === second.top;
  expect(sideBySide || second.top >= first.bottom, "Print it and Duplicate overlap").toBe(true);

  for (const id of ["#plan-print", "#plan-duplicate", "#plan-delete"]) {
    const button = page.locator(id);
    const before = await button.evaluate((el) => getComputedStyle(el).backgroundColor);
    await button.hover();
    await page.waitForTimeout(200);
    const after = await button.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(after, `${id} does nothing on hover`).not.toBe(before);
    // Off the button, so the next one is measured from rest rather than hover.
    await page.mouse.move(0, 0);
  }
});

/**
 * Count the transitions the page actually starts.
 *
 * Wrapped before any script runs, so it sees the calls `lib/motion.ts` makes
 * rather than being told about them.
 */
async function countTransitions(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __vt: number };
    w.__vt = 0;
    const real = document.startViewTransition?.bind(document);
    if (!real) return;
    document.startViewTransition = ((update: () => void) => {
      w.__vt += 1;
      return real(update);
    }) as typeof document.startViewTransition;
  });
}

const started = (page: Page) => page.evaluate(() => (window as unknown as { __vt: number }).__vt);

test("nothing shares a view transition name", async ({ page }) => {
  // A duplicate is not a warning anybody sees. The browser drops the whole
  // transition rather than choosing between them, so every slide in the app
  // stops at once and nothing on screen says why. `.hub-seg.is-active` is the
  // one to watch: it is in the catalogue's filters and in the session editor's
  // add panel, which is why this walks both.
  const planId = await runnableSession(page);
  for (const hash of ["#/catalogue", "#/plans", `#/plan/${planId}`, `#/plan/${planId}/edit`, "#/account"]) {
    await page.goto(`/hub/${hash}`);
    await settled(page);
    // Small space and Favourites are their own switches, so this turns on the
    // ones each screen has before counting. Favourites in the catalogue is left
    // out: it is a route rather than a switch and would walk off the page being
    // counted.
    for (const id of ["#f-space", "#add-space", "#add-fav"]) {
      const chip = page.locator(id);
      if (await chip.count()) {
        await chip.click();
        await settled(page);
      }
    }
    const names = await page.evaluate(() =>
      [...document.querySelectorAll("*")]
        .map((el) => getComputedStyle(el).viewTransitionName)
        .filter((name) => name && name !== "none"),
    );
    expect(names.length, `${hash} names nothing`).toBeGreaterThan(1);
    expect([...new Set(names)].length, `${hash}: ${names.join(", ")}`).toBe(names.length);
  }
});

test("a tap on a filter and a tap on a tab are both animated", async ({ page }) => {
  await countTransitions(page);
  await signedIn(page, "u10");
  expect(await started(page), "the catalogue arrived on one").toBe(0);

  await page.locator('[data-kind="exercise"]').click();
  await settled(page);
  expect(await started(page), "the segmented control did not slide").toBe(1);

  await page.locator('.hub-tab[data-route="plans"]').click();
  // A tab changes the hash, so the transition is queued behind a hashchange
  // rather than started by the click. `settled` asserts the absence of the
  // attribute, which is true in the gap before it starts, so this waits for the
  // count itself rather than for a moment that has already passed.
  await expect
    .poll(() => started(page), { message: "the nav pill did not slide" })
    .toBe(2);
  await settled(page);
});

test("the three segments stay one width", async ({ page }) => {
  // The pill that marks the chosen one is the segment itself, so a segment
  // sized to its own label makes the pill grow and shrink as it crosses. It read
  // as the control rearranging itself rather than as a toggle. Sizing to the
  // label put "All" at 33px beside "Warm-ups" at 70 on a 320px phone, and 47
  // beside 103 on a desk. The same control is in the editor's add panel, where
  // the pane it stands in is the thing that can starve it.
  const planId = await runnableSession(page);
  const widths = [320, 340, 360, 375, 390, 414, 480, 700, 768, 820, 900, 1000, 1280, 1440];

  for (const hash of ["#/catalogue", `#/plan/${planId}/edit`]) {
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/hub/${hash}`);
      await page.locator(".hub-seg").first().waitFor();

      const track = page.locator(".hub-segmented").first();
      const segs = await track.evaluate((el) =>
        [...el.querySelectorAll(".hub-seg")].map((seg) => ({
          text: seg.textContent?.trim(),
          width: seg.getBoundingClientRect().width,
          cut: seg.scrollWidth > Math.ceil(seg.getBoundingClientRect().width),
        })),
      );
      // Three columns that will not go under their own labels overflow the panel
      // rather than shrinking, which is how the editor's side pane used to cut
      // the end off "Exercises". The pane carries a floor for it.
      const spills = await track.evaluate((el) => el.scrollWidth > el.clientWidth + 0.5);

      const where = `${hash} at ${width}px`;
      expect(spills, `${where}: the control overflows what it stands in`).toBe(false);
      expect(segs, `${where}: segment count`).toHaveLength(3);
      const spread = Math.max(...segs.map((s) => s.width)) - Math.min(...segs.map((s) => s.width));
      // A pixel of slack for a track dividing by three. Anything a coach could
      // see is a segment that has fallen back to its own label.
      expect(spread, `${where}: ${segs.map((s) => `${s.text} ${s.width.toFixed(1)}`).join(", ")}`)
        .toBeLessThan(1);
      for (const seg of segs) {
        expect(seg.cut, `${where}: "${seg.text}" is truncated`).toBe(false);
      }
    }
  }
});

test("every filter chip is on screen at every width", async ({ page }) => {
  // The row used to scroll sideways below 640px, which fitted three and a half
  // of the eight chips on a 390px phone. Tackle, Ruck and maul, Scrum and
  // restarts plus Game sense were reachable only by dragging a row that looks
  // static, behind a 24px fade. A filter a coach cannot see is a filter they do
  // not have, and this is the control that navigates 100 drills. The same row is
  // in the editor's add panel, where the pane it stands in is narrower still.
  const planId = await runnableSession(page);
  const widths = [320, 360, 375, 390, 414, 480, 700, 768, 820, 900, 1000, 1280, 1440];

  for (const hash of ["#/catalogue", `#/plan/${planId}/edit`]) {
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/hub/${hash}`);
      await page.locator(".chip-filter").first().waitFor();

      // Every row, not the first one. The chips are two groups now and a
      // sweep that only measured the group it happened to find first would
      // pass while the other one ran off the screen.
      const measured = await page.evaluate(() =>
        [...document.querySelectorAll(".chip-row")].map((el) => {
          const box = el.getBoundingClientRect();
          return {
            hidden: el.scrollWidth - el.clientWidth,
            spills: [...el.querySelectorAll(".chip-filter")]
              .filter((chip) => chip.getBoundingClientRect().right > box.right + 0.5)
              .map((chip) => chip.textContent?.trim()),
            count: el.querySelectorAll(".chip-filter").length,
          };
        }),
      );

      const where = `${hash} at ${width}px`;
      expect(measured.length, `${where}: no chip rows`).toBe(2);
      for (const row of measured) {
        expect(row.count, `${where}: an empty chip row`).toBeGreaterThan(2);
        expect(row.hidden, `${where}: the row scrolls sideways`).toBe(0);
        expect(row.spills, `${where}: chips past the right edge`).toEqual([]);
      }
    }
  }
});

test("the pitch chips never sit among the themes", async ({ page }) => {
  // Nine identical chips in one row put Hard ground between Small space and
  // Handling, where nothing said that a theme replaces the last theme while
  // those two stack with everything. They are two groups now: what the drill
  // is above the rule, what your evening looks like below it. Stacked on a
  // phone, side by side once there is room for both, and never interleaved.
  // The breakpoint moved from 1280 to 1360 when the set piece chip became
  // "Scrum and restarts": six chips at 608px want a column 1280 does not have,
  // so the themes wrapped to two rows and the picks centred against them.
  await signedIn(page, "u10");

  for (const width of [320, 390, 768, 1024, 1279, 1359, 1360, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.locator(".chip-picks .chip-filter").first().waitFor();

    const laid = await page.evaluate(() => {
      const box = (selector: string) =>
        document.querySelector(selector)!.getBoundingClientRect();
      const themes = box(".chip-themes");
      const picks = box(".chip-picks");
      return {
        beside: Math.abs(themes.top - picks.top) < 4,
        below: picks.top >= themes.bottom - 0.5,
        themed: [...document.querySelectorAll(".chip-themes .chip-filter")].every((chip) =>
          chip.hasAttribute("data-theme"),
        ),
        picked: [...document.querySelectorAll(".chip-picks .chip-filter")].every(
          (chip) => !chip.hasAttribute("data-theme"),
        ),
      };
    });

    const where = `at ${width}px`;
    expect(laid.themed, `${where}: something that is not a theme is among them`).toBe(true);
    expect(laid.picked, `${where}: a theme is among the pitch chips`).toBe(true);
    // One or the other. Overlapping is the failure that would look like the
    // row they used to be.
    expect(laid.beside || laid.below, `${where}: the two groups overlap`).toBe(true);
    expect(laid.beside, `${where}: wrong side of the breakpoint`).toBe(width >= 1360);
  }
});

test("a coach who has asked for less motion gets none of it", async ({ page }) => {
  // The promise the reduced-motion sweep in `base.css` cannot keep on its own.
  // That sweep matches elements and the ::view-transition tree is not any
  // element's descendant, so `lib/motion.ts` is the only thing that can honour
  // this. Which is why this checks the transition is never started rather than
  // that it is quick. Emulated on the page rather than through `test.use`,
  // because a context option set in a describe never reached matchMedia here.
  await countTransitions(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signedIn(page, "u10");

  await page.locator('[data-kind="exercise"]').click();
  await expect(page.locator('[data-kind="exercise"]')).toHaveAttribute("aria-pressed", "true");
  await page.locator('.hub-tab[data-route="plans"]').click();
  await expect(page.locator(".preset-card").first()).toBeVisible();
  expect(await started(page)).toBe(0);
});

test("stretching a block gives it the minutes it was stretched to", async ({ page }) => {
  const planId = await runnableSession(page);
  await page.locator("text=Run it").click();
  await expect(page.locator("#run-time")).toBeVisible();

  // Run it, go back and change it, run it again. A clock kept against the index
  // alone would hand back the remains of the old block, often already over.
  await page.goto(`/hub/#/plan/${planId}/edit`);
  await page.locator('[data-minutes="0"]').fill("29");
  await page.locator('[data-minutes="0"]').dispatchEvent("change");

  await page.goto(`/hub/#/plan/${planId}/run/0`);
  const shown = (await page.locator("#run-time").innerText()).trim();
  expect(shown).toMatch(/^(28:\d\d|29:00)$/);
});

test("a block number that is not a whole number does not blank the view", async ({ page }) => {
  const planId = await runnableSession(page);
  await page.goto(`/hub/#/plan/${planId}/run/1.5`);
  await expect(page.locator(".run-stage-count")).toHaveText(`2 of ${BLOCKS}`);
});

test("present mode prints the session rather than a blank page", async ({ page }) => {
  const planId = await runnableSession(page);
  await page.goto(`/hub/#/plan/${planId}/run/0`);
  await expect(page.locator(".run-stage-title")).toBeVisible();
  await expect(page.locator("#plan-print-sheet .print-block")).toHaveCount(BLOCKS);
});

test("the account page says whether the app is ready for a pitch", async ({ page }) => {
  await signedIn(page, "u10", "#/account");
  const panel = page.locator("section").filter({ hasText: "On this device" });
  await expect(panel).toBeVisible();

  // The service worker registers on an idle callback, so a first paint can
  // honestly say not yet. A reload is served through it, and by then it has to
  // stop hedging: this is the promise the whole product rests on.
  await page.reload();
  await expect(page.locator("body[data-signed-in]")).toBeVisible();
  await expect(page.locator(".device-state-ready")).toContainText("Ready for the pitch");
});

test("the session picker finds sessions that are only on the server", async ({ page }) => {
  await signedIn(page, "u10", "#/plans");
  await page.locator('[data-preset="preset-u10-rucking"]').click();
  await expect(page.locator(".block-row")).toHaveCount(BLOCKS);

  // Wipe the local mirror without signing out, which is the shape of a first
  // sign-in on a second phone. The picker used to say "Nothing saved yet" and
  // offer to start a duplicate.
  const saved = await page.evaluate(() => localStorage.getItem("equalplay_hub_plans"));
  await page.evaluate(() => localStorage.removeItem("equalplay_hub_plans"));
  await page.goto("/hub/#/catalogue/drill-two-second-ruck");
  await page.locator("#drill-add").click();
  await expect(page.locator(".drill-add")).toContainText("Fetching your sessions");

  // The build under test cannot reach Supabase, so the pull comes back empty
  // and it stops hedging rather than saying "fetching" for ever
  await expect(page.locator(".drill-add")).toContainText("Nothing saved yet", { timeout: 10_000 });
  expect(saved).not.toBeNull();
});
