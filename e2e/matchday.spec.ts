import { test, expect, type Page, type Locator } from "@playwright/test";

// ---- Helpers ----

/** Clear localStorage so each test starts fresh. */
async function freshStart(page: Page) {
  await page.goto("/planner");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector(".btn-generate");
}

/** Fill in player names, adding rows as needed. */
async function addPlayers(page: Page, names: string[]) {
  const inputs = page.locator(".player-input");
  for (let i = 0; i < names.length; i++) {
    if ((await inputs.count()) <= i) {
      await page.getByText("+ Add player").click();
    }
    await inputs.nth(i).fill(names[i]);
  }
}

async function setPlayersPerTeam(page: Page, n: number) {
  await page.locator("#players-per-team").fill(String(n));
}

async function setNumberOfGames(page: Page, n: number) {
  await page.locator("#num-games").fill(String(n));
}

/**
 * Click "Sort my team", then start the match so game one is live.
 *
 * Generating leaves the squad in setup mode. Every scenario below is about what
 * happens once the whistle has gone, so both steps belong in the helper.
 */
async function generate(page: Page) {
  await page.getByRole("button", { name: "Sort my team" }).click();
  await page.waitForSelector("[data-testid^='game-']");
  await page.locator(".btn-start-match").click();
  await page.waitForSelector(".game-card-current");
}

// ---- Locator helpers ----

/** The current (Live) game card. */
function liveGame(page: Page): Locator {
  return page.locator(".game-card-current");
}

/** Get a specific game card by number. */
function gameCard(page: Page, n: number): Locator {
  return page.locator(`[data-testid='game-${n}']`);
}

/** Player names within a section of a game card. */
async function playersIn(card: Locator, role: "field" | "bench" | "unavailable"): Promise<string[]> {
  const section = card.locator(`[data-testid='section-${role}']`);
  // Section may not exist (e.g. no bench players) — return empty
  if ((await section.count()) === 0) return [];
  const chips = section.locator(".chip");
  const names: string[] = [];
  for (let i = 0; i < await chips.count(); i++) {
    names.push((await chips.nth(i).textContent() ?? "").trim());
  }
  return names;
}

/** All player names across all sections of a game card. */
async function allPlayersInGame(card: Locator): Promise<string[]> {
  const field = await playersIn(card, "field");
  const bench = await playersIn(card, "bench");
  return [...field, ...bench];
}

/**
 * Tap a player chip by name within a game card to open the action sheet.
 *
 * Scoped to the squad sections on purpose. The live card also carries the
 * substitution strip, which repeats two of the same names in its own chip list.
 */
async function tapPlayer(page: Page, name: string, card?: Locator) {
  const scope = card ?? liveGame(page);
  // Matched on the visible text rather than the accessible name. Chips carry an
  // aria-label of "Alice, field. Tap for actions" for screen readers, so a name
  // match would have to duplicate that phrasing here.
  await scope
    .locator("[data-testid^='section-'] .chip-list .chip")
    .filter({ hasText: new RegExp(`^${name}$`) })
    .click();
  await expect(page.locator("#action-sheet")).toBeVisible();
}

/** Select an action from the open action sheet. */
async function pickAction(page: Page, action: string) {
  await page.locator(`#action-sheet [data-action="${action}"]`).click();
  await expect(page.locator("#action-sheet")).toBeHidden();
}

/** Wait for the toast to appear and return its message text. */
async function waitForToast(page: Page): Promise<string> {
  const toast = page.locator("#toast");
  await expect(toast).toBeVisible();
  return (await toast.locator(".toast-message").textContent())?.trim() ?? "";
}

/** Click the undo button in the currently visible toast. */
async function clickUndo(page: Page) {
  await page.locator("#toast .toast-undo").click();
}

/** The sub-strip component (suggestion area). */
function subStrip(page: Page): Locator {
  return page.locator(".sub-strip");
}

/** The name shown in the "coming on" position of the sub strip. */
async function subInName(page: Page): Promise<string> {
  return (await page.locator("[data-testid='sub-in']").textContent())?.trim() ?? "";
}

/** The name shown in the "going off" position of the sub strip. */
async function subOutName(page: Page): Promise<string> {
  return (await page.locator("[data-testid='sub-out']").textContent())?.trim() ?? "";
}

// ====================================================================
// SCENARIO 1: Basic flow
// A coach adds players, generates a rotation, and sees a usable plan.
// ====================================================================

test("basic flow: generate rotation, all players included, sub suggestion visible", async ({ page }) => {
  await freshStart(page);

  const names = ["Alice", "Bob", "Charlie"];
  await addPlayers(page, names);
  await setPlayersPerTeam(page, 2);
  await setNumberOfGames(page, 3);
  await generate(page);

  // Three game cards rendered
  await expect(page.locator("[data-testid^='game-']")).toHaveCount(3);

  // Current game is live
  await expect(liveGame(page).locator(".game-badge-current")).toHaveText("Live");

  // 2 playing, 1 on bench — correct squad distribution
  const playing = await playersIn(liveGame(page), "field");
  const bench = await playersIn(liveGame(page), "bench");
  expect(playing).toHaveLength(2);
  expect(bench).toHaveLength(1);

  // Every player is accounted for in game 1
  expect([...playing, ...bench].sort()).toEqual(names.sort());

  // Every player appears in at least one game across the session
  for (const name of names) {
    let found = false;
    for (let g = 1; g <= 3; g++) {
      const gamePlayers = await playersIn(gameCard(page, g), "field");
      if (gamePlayers.includes(name)) { found = true; break; }
    }
    expect(found).toBe(true);
  }

  // Sub suggestion is visible with a clear "X on for Y" structure
  await expect(subStrip(page)).toBeVisible();
  const coming = await subInName(page);
  const going = await subOutName(page);
  expect(bench).toContain(coming); // the player coming on was on the bench
  expect(playing).toContain(going); // the player going off was playing
});

// ====================================================================
// SCENARIO 2: Late player arrives
// A player hasn't turned up. Coach marks them late, then they arrive.
// ====================================================================

test("late player: excluded from current game, reintegrated after arrival", async ({ page }) => {
  await freshStart(page);

  await addPlayers(page, ["Alice", "Bob", "Charlie"]);
  await setPlayersPerTeam(page, 2);
  await setNumberOfGames(page, 3);
  await generate(page);

  // Mark Alice as not here yet
  await tapPlayer(page, "Alice");
  await pickAction(page, "late");
  await waitForToast(page);

  // Alice should NOT be in the "Playing" section of the current game
  const playingAfterLate = await playersIn(liveGame(page), "field");
  expect(playingAfterLate).not.toContain("Alice");

  // Mark Alice as arrived
  // She's shown as a late chip — tap her through the chip-list
  await liveGame(page).locator("[data-testid^='section-'] .chip-list .chip-late", { hasText: "Alice" }).click();
  await expect(page.locator("#action-sheet")).toBeVisible();
  await pickAction(page, "joined");
  const toast = await waitForToast(page);
  expect(toast).toContain("arrived");

  // Alice should appear in future games (game 2 or 3)
  const game2Players = await allPlayersInGame(gameCard(page, 2));
  const game3Players = await allPlayersInGame(gameCard(page, 3));
  const inFutureGames = game2Players.includes("Alice") || game3Players.includes("Alice");
  expect(inFutureGames).toBe(true);
});

// ====================================================================
// SCENARIO 3: Injury during game
// A player on the field gets injured. The coach needs a clear,
// immediate substitution suggestion showing the injured player out.
// ====================================================================

test("injury: suggestion immediately shows injured player as the one to come off", async ({ page }) => {
  await freshStart(page);

  await addPlayers(page, ["Alice", "Bob", "Charlie", "Dave", "Eve", "Frank", "Grace"]);
  await setPlayersPerTeam(page, 5);
  await setNumberOfGames(page, 3);
  await generate(page);

  // Pick a player currently on the field
  const playing = await playersIn(liveGame(page), "field");
  const bench = await playersIn(liveGame(page), "bench");
  const injured = playing[2];

  // Mark them injured
  await tapPlayer(page, injured);
  await pickAction(page, "injured");
  await waitForToast(page);

  // The sub strip should immediately reflect the injury:
  // 1. Label changes to "Injury replacements"
  await expect(page.locator(".sub-strip-label")).toHaveText("Injury replacements");

  // 2. The "going off" player is the injured one
  expect(await subOutName(page)).toBe(injured);

  // 3. The "coming on" player is from the bench
  const replacement = await subInName(page);
  expect(bench).toContain(replacement);

  // Coach confirms the sub
  await page.getByRole("button", { name: "Make sub" }).click();
  await waitForToast(page);

  // Injured player is no longer in "Playing"
  const playingAfter = await playersIn(liveGame(page), "field");
  expect(playingAfter).not.toContain(injured);

  // Replacement is now playing
  expect(playingAfter).toContain(replacement);
});

// ====================================================================
// SCENARIO 4: Fairness recovery
// A player misses game 1 (late). The system should give them more
// time in later games so they're not permanently disadvantaged.
// ====================================================================

test("fairness: late player gets prioritised in later games", async ({ page }) => {
  await freshStart(page);

  await addPlayers(page, ["Alice", "Bob", "Charlie"]);
  await setPlayersPerTeam(page, 2);
  await setNumberOfGames(page, 3);
  await generate(page);

  // Charlie is late — misses game 1
  await tapPlayer(page, "Charlie");
  await pickAction(page, "late");
  await waitForToast(page);

  // Advance to game 2
  await page.getByRole("button", { name: "Start next game" }).click();

  // Charlie arrives
  await liveGame(page).locator(".chip-list .chip-late", { hasText: "Charlie" }).click();
  await expect(page.locator("#action-sheet")).toBeVisible();
  await pickAction(page, "joined");
  await waitForToast(page);

  // Advance to game 3
  await page.getByRole("button", { name: "Start next game" }).click();

  // Charlie missed game 1, so the system should prioritise them.
  // Observable check: Charlie should be playing in game 3.
  const game3Playing = await playersIn(liveGame(page), "field");
  expect(game3Playing).toContain("Charlie");

  // No player should be benched in ALL games — everyone plays at least once.
  // Check the fairness summary: every player has a non-zero play count.
  const fairnessRows = page.locator(".fairness-row");
  const count = await fairnessRows.count();
  for (let i = 0; i < count; i++) {
    const countText = await fairnessRows.nth(i).locator(".fairness-count").textContent();
    const playTime = parseFloat(countText ?? "0");
    expect(playTime).toBeGreaterThan(0);
  }
});

// ====================================================================
// SCENARIO 5: Make sub then undo
// Coach makes a sub, realises it was wrong, and undoes it.
// Everything should return to exactly where it was.
// ====================================================================

test("undo: substitution is fully reversible, lineup and suggestion restored", async ({ page }) => {
  await freshStart(page);

  await addPlayers(page, ["Alice", "Bob", "Charlie"]);
  await setPlayersPerTeam(page, 2);
  await setNumberOfGames(page, 3);
  await generate(page);

  // Capture the full state before: who's playing, who's on bench, who's suggested
  const playingBefore = await playersIn(liveGame(page), "field");
  const benchBefore = await playersIn(liveGame(page), "bench");
  const sugInBefore = await subInName(page);
  const sugOutBefore = await subOutName(page);

  // Make the sub
  await page.getByRole("button", { name: "Make sub" }).click();
  await waitForToast(page);

  // Lineup should have changed
  const playingAfterSub = await playersIn(liveGame(page), "field");
  expect(playingAfterSub.sort()).not.toEqual(playingBefore.sort());

  // Undo
  await clickUndo(page);
  await waitForToast(page);

  // Lineup restored
  const playingAfterUndo = await playersIn(liveGame(page), "field");
  const benchAfterUndo = await playersIn(liveGame(page), "bench");
  expect(playingAfterUndo.sort()).toEqual(playingBefore.sort());
  expect(benchAfterUndo.sort()).toEqual(benchBefore.sort());

  // Sub suggestion also restored
  expect(await subInName(page)).toBe(sugInBefore);
  expect(await subOutName(page)).toBe(sugOutBefore);
});

// ====================================================================
// SCENARIO 6: Player leaving early
// A parent says their kid has to leave after game 1.
// The app should exclude them from all future games.
// ====================================================================

test("leaving early: player gone from all games after their exit point", async ({ page }) => {
  await freshStart(page);

  await addPlayers(page, ["Alice", "Bob", "Charlie"]);
  await setPlayersPerTeam(page, 2);
  await setNumberOfGames(page, 3);
  await generate(page);

  // Alice has to leave after game 1
  await tapPlayer(page, "Alice");
  await pickAction(page, "leaving");
  const toast = await waitForToast(page);
  expect(toast).toContain("leaves");

  // Advance to game 2
  await page.getByRole("button", { name: "Start next game" }).click();

  // Alice should not appear in game 2 at all
  const game2Playing = await playersIn(liveGame(page), "field");
  const game2Bench = await playersIn(liveGame(page), "bench");
  expect(game2Playing).not.toContain("Alice");
  expect(game2Bench).not.toContain("Alice");

  // Remaining players fill all slots — no empty positions
  expect(game2Playing).toHaveLength(2);

  // Advance to game 3 — Alice still absent
  await page.getByRole("button", { name: "Start next game" }).click();
  const game3Playing = await playersIn(liveGame(page), "field");
  const game3Bench = await playersIn(liveGame(page), "bench");
  expect(game3Playing).not.toContain("Alice");
  expect(game3Bench).not.toContain("Alice");
});

// ====================================================================
// SCENARIO 7: Chaos — real match conditions
// One player is late, one gets injured, the late player arrives.
// The system should handle all of this without breaking.
// ====================================================================

test("chaos: late + injury + arrival all in one session produces valid state", async ({ page }) => {
  await freshStart(page);

  // 5 players, 3 on field, 3 games — tight squad, every event matters
  await addPlayers(page, ["Alice", "Bob", "Charlie", "Dave", "Eve"]);
  await setPlayersPerTeam(page, 3);
  await setNumberOfGames(page, 3);
  await generate(page);

  const initialPlaying = await playersIn(liveGame(page), "field");
  const initialBench = await playersIn(liveGame(page), "bench");

  // Step 1: Alice hasn't turned up
  await tapPlayer(page, "Alice");
  await pickAction(page, "late");
  await waitForToast(page);

  // Alice is no longer in the playing section
  const afterLate = await playersIn(liveGame(page), "field");
  expect(afterLate).not.toContain("Alice");

  // Step 2: One of the on-field players gets injured
  const playingNow = await playersIn(liveGame(page), "field");
  const injured = playingNow[0];
  await tapPlayer(page, injured);
  await pickAction(page, "injured");
  await waitForToast(page);

  // Sub suggestion should show the injured player going off
  expect(await subOutName(page)).toBe(injured);
  await expect(page.locator(".sub-strip-label")).toHaveText("Injury replacement");

  // Step 3: Alice arrives
  await liveGame(page).locator("[data-testid^='section-'] .chip-list .chip-late", { hasText: "Alice" }).click();
  await expect(page.locator("#action-sheet")).toBeVisible();
  await pickAction(page, "joined");
  await waitForToast(page);

  // The sub suggestion should still be valid — a bench player on for the injured player
  await expect(subStrip(page)).toBeVisible();
  expect(await subOutName(page)).toBe(injured);

  // The coming-on player should be someone from the bench (could be Alice now)
  const comingOn = await subInName(page);
  const currentBench = await playersIn(liveGame(page), "bench");
  expect(currentBench).toContain(comingOn);

  // Confirm the injury sub
  await page.getByRole("button", { name: "Make sub" }).click();
  await waitForToast(page);

  // Verify: the game is in a valid state
  const finalPlaying = await playersIn(liveGame(page), "field");
  const finalBench = await playersIn(liveGame(page), "bench");

  // Correct number on field
  expect(finalPlaying).toHaveLength(3);

  // Injured player is not playing
  expect(finalPlaying).not.toContain(injured);

  // No duplicate players — everyone appears exactly once
  const allPlayers = [...finalPlaying, ...finalBench];
  const unique = new Set(allPlayers);
  expect(unique.size).toBe(allPlayers.length);

  // Advance to game 2 — verify the app doesn't break
  await page.getByRole("button", { name: "Start next game" }).click();
  await expect(liveGame(page).locator(".game-badge-current")).toHaveText("Live");

  // Game 2 should have 3 playing, and injured player should not be in any section
  const g2Playing = await playersIn(liveGame(page), "field");
  expect(g2Playing).toHaveLength(3);
  expect(g2Playing).not.toContain(injured);
});

test("the planner points at the drills once match day is worked out", async ({ page }) => {
  await freshStart(page);
  await addPlayers(page, ["Alice", "Bob", "Charlie", "Dana"]);
  await setPlayersPerTeam(page, 2);
  await setNumberOfGames(page, 2);
  await generate(page);

  // Under the playing time totals, which is where match day is dealt with
  const card = page.locator(".next-step");
  await expect(card).toContainText("for the age group you coach");
  await card.locator(".next-step-link").click();
  await expect(page).toHaveURL(/\/hub/);
});

test("teams belong to the planner, not to the navigation", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 820 });
  await freshStart(page);

  // Four extra teams, which is well past what the rail used to hold
  for (let i = 0; i < 4; i++) {
    await page.locator(".team-tab-add").click();
  }
  // The add button carries .team-tab too, so exclude it from the count
  await expect(page.locator(".team-tab:not(.team-tab-add)")).toHaveCount(5);

  // Nav is nav. Switching team is the planner's own control, so it lives in the
  // planner's view, above its inputs, rather than in the chrome both entries share.
  await expect(page.locator(".app-chrome .team-tabs")).toHaveCount(0);
  await expect(page.locator("#app > .team-tabs")).toHaveCount(1);

  const fits = await page.evaluate(() => {
    const box = (sel: string) => document.querySelector(sel)!.getBoundingClientRect();
    const view = box("#app");
    return {
      tabsOverhang: Math.round(box(".team-tabs").right - view.right),
      addOverhang: Math.round(box(".team-tab-add").right - view.right),
      aboveInputs: box(".team-tabs").bottom <= box(".squad-panel").top,
      pageScrollsSideways:
        document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });

  expect(fits.tabsOverhang).toBeLessThanOrEqual(0);
  // Wrapped rather than scrolled sideways, so adding another team is still possible
  expect(fits.addOverhang).toBeLessThanOrEqual(0);
  expect(fits.aboveInputs).toBe(true);
  expect(fits.pageScrollsSideways).toBe(false);
});

/**
 * The Half Game Rule, which is the one RFU regulation the planner gives a
 * verdict against. Regulation 15 is written in minutes, so the planner asks
 * for them, but the check has to work without them too because the field is
 * optional and blank is the common case.
 */
test("match day checks the Half Game Rule in minutes when it is told the match length", async ({
  page,
}) => {
  await freshStart(page);
  await addPlayers(page, ["Alice", "Bob", "Cara", "Dan", "Eve", "Finn"]);
  await setPlayersPerTeam(page, 3);
  await setNumberOfGames(page, 4);
  await page.locator("#minutes-per-match").fill("20");
  await page.getByRole("button", { name: "Sort my team" }).click();
  await page.waitForSelector("[data-testid^='game-']");

  const rule = page.locator(".fairness-rule");
  await expect(rule).toContainText("Half Game Rule");
  await expect(rule).toContainText("40 of the 80 minutes");
  await expect(rule).toContainText("Nobody is short");
  // Play time is stated in minutes now rather than in games.
  await expect(page.locator(".fairness-count").first()).toContainText("min");
});

test("match day says when no rotation can clear the floor", async ({ page }) => {
  // More than twice as many turned up as go on the pitch, so the even split is
  // under half whatever the rotation does. That is a fixture problem and the
  // planner should say so rather than quietly producing a plan that breaks it.
  await freshStart(page);
  await addPlayers(page, ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]);
  await setPlayersPerTeam(page, 4);
  await setNumberOfGames(page, 3);
  await page.getByRole("button", { name: "Sort my team" }).click();
  await page.waitForSelector("[data-testid^='game-']");

  const rule = page.locator(".fairness-rule");
  await expect(rule).toContainText("not everybody can reach it");
  await expect(rule).toContainText("second team");
  // Still names who actually came up short. Most of a squad usually clears the
  // floor even when the sums say the whole squad cannot, so dropping the names
  // would lose the only part a coach can act on.
  await expect(rule).toContainText("short by");
});

test("the match length survives a reload", async ({ page }) => {
  await freshStart(page);
  await addPlayers(page, ["Alice", "Bob", "Cara", "Dan"]);
  await setPlayersPerTeam(page, 2);
  await page.locator("#minutes-per-match").fill("25");
  await page.getByRole("button", { name: "Sort my team" }).click();
  await page.waitForSelector("[data-testid^='game-']");

  await page.reload();
  await page.waitForSelector(".btn-generate");
  // The settings boxes used to come back on their hard-coded defaults while the
  // results below them were built from what the coach actually typed.
  await expect(page.locator("#minutes-per-match")).toHaveValue("25");
  await expect(page.locator("#players-per-team")).toHaveValue("2");
});

test("the Reg 15 sizes fill the box in one tap", async ({ page }) => {
  // Players per team defaulted to 7 at every grade. Reg 15 sets 4, 6, 7, 8, 9
  // and 12 from U7 to U12, which is six things to remember or one tap.
  await freshStart(page);
  await page.getByRole("button", { name: /^U12/ }).click();
  await expect(page.locator("#players-per-team")).toHaveValue("12");
  await page.getByRole("button", { name: /^U7/ }).click();
  await expect(page.locator("#players-per-team")).toHaveValue("4");

  // Still editable, because a festival can agree something smaller and the
  // planner is not the referee. Typing over it un-picks the grade rather than
  // leaving U7 filled in beside a box that says 5.
  await page.locator("#players-per-team").fill("5");
  await expect(page.locator("#players-per-team")).toHaveValue("5");
  await expect(page.locator(".grade-size.is-picked")).toHaveCount(0);
});

test("picking a size clears the error it fixes", async ({ page }) => {
  await freshStart(page);
  await addPlayers(page, ["Alice", "Bob", "Cara", "Dan", "Eve", "Finn", "Gus", "Hal"]);
  await page.locator("#players-per-team").fill("40");
  await page.getByRole("button", { name: "Sort my team" }).click();
  await expect(page.locator("#error-playersPerTeam")).not.toBeEmpty();

  await page.getByRole("button", { name: /^U7/ }).click();
  await expect(page.locator("#players-per-team")).toHaveValue("4");
  // The box is right now, so the red message under it is a lie until the next
  // submit unless the tap clears it.
  await expect(page.locator("#error-playersPerTeam")).toBeEmpty();
});
