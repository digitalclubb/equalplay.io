import { test, expect, type Page } from "@playwright/test";

// ---- Helpers ----

/** Clear localStorage so each test starts fresh. */
async function freshStart(page: Page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector(".btn-generate");
}

/** Fill in player names, overwriting default empty rows then adding more. */
async function addPlayers(page: Page, names: string[]) {
  const inputs = page.locator(".player-input");
  for (let i = 0; i < names.length; i++) {
    // Add a row if we've run out of existing inputs
    if ((await inputs.count()) <= i) {
      await page.getByText("+ Add player").click();
    }
    await inputs.nth(i).fill(names[i]);
  }
}

/** Set the "Players per team" number input. */
async function setPlayersPerTeam(page: Page, n: number) {
  await page.locator("#players-per-team").fill(String(n));
}

/** Set the "Number of matches" number input. */
async function setNumberOfGames(page: Page, n: number) {
  await page.locator("#num-games").fill(String(n));
}

/** Click "Sort my team" and wait for results to appear. */
async function generate(page: Page) {
  await page.getByRole("button", { name: "Sort my team" }).click();
  await page.waitForSelector(".game-card");
}

/** Get all player names inside a section ("Playing" / "Bench" / "Unavailable") of the current (Live) game. */
async function currentGameSection(page: Page, label: string): Promise<string[]> {
  const card = page.locator(".game-card-current");
  const section = card.locator(".game-section", { has: page.locator(`.game-section-label`, { hasText: label }) });
  const chips = section.locator(".chip");
  const names: string[] = [];
  for (let i = 0; i < await chips.count(); i++) {
    names.push((await chips.nth(i).textContent() ?? "").trim());
  }
  return names;
}

/** Click a player chip by name inside the current game card to open the action sheet. */
async function tapPlayer(page: Page, name: string) {
  const card = page.locator(".game-card-current");
  // Scope to chip-list to avoid matching sub-strip chips
  await card.locator(".chip-list").getByRole("button", { name, exact: true }).click();
  await page.waitForSelector("#action-sheet:not([hidden])");
}

/** Click an action in the open action sheet. */
async function pickAction(page: Page, action: string) {
  await page.locator(`#action-sheet [data-action="${action}"]`).click();
  // Wait for sheet to close
  await expect(page.locator("#action-sheet")).toBeHidden();
}

/** Dismiss the toast (wait for it to auto-hide or click undo). */
async function waitForToast(page: Page): Promise<string> {
  const toast = page.locator("#toast");
  await expect(toast).not.toHaveAttribute("hidden", "");
  const msg = await toast.locator(".toast-message").textContent();
  return msg?.trim() ?? "";
}

async function clickUndo(page: Page) {
  await page.locator("#toast .toast-undo").click();
}

// ====================================================================
// SCENARIO 1: Basic flow — generate rotation, see fair distribution
// ====================================================================

test("basic flow: 3 players, 2 per team, 3 games — fair rotation generated", async ({ page }) => {
  await freshStart(page);

  await addPlayers(page, ["Alice", "Bob", "Charlie"]);
  await setPlayersPerTeam(page, 2);
  await setNumberOfGames(page, 3);
  await generate(page);

  // Three game cards should exist
  const cards = page.locator(".game-card");
  await expect(cards).toHaveCount(3);

  // Current game is game 1 (has "Live" badge)
  const live = page.locator(".game-badge-current");
  await expect(live).toHaveText("Live");

  // Current game: 2 playing, 1 on bench
  const playing = await currentGameSection(page, "Playing");
  const bench = await currentGameSection(page, "Bench");
  expect(playing).toHaveLength(2);
  expect(bench).toHaveLength(1);

  // All three names accounted for
  const allNames = [...playing, ...bench].sort();
  expect(allNames).toEqual(["Alice", "Bob", "Charlie"]);

  // Sub suggestion is visible
  await expect(page.locator(".sub-strip")).toBeVisible();
  await expect(page.locator(".sub-strip-label")).toHaveText("Next sub");
  await expect(page.locator(".sub-strip-arrow")).toHaveText("on for");

  // Fairness summary exists
  await expect(page.locator(".fairness-summary")).toBeVisible();
});

// ====================================================================
// SCENARIO 2: Late player arrives mid-session
// ====================================================================

test("late player: excluded initially, reintegrated after arrival", async ({ page }) => {
  await freshStart(page);

  await addPlayers(page, ["Alice", "Bob", "Charlie"]);
  await setPlayersPerTeam(page, 2);
  await setNumberOfGames(page, 3);

  // Mark Alice as late before generating
  // (We generate first, then mark late — the app works on generated plans)
  await generate(page);

  // Mark Alice as "Not here yet"
  await tapPlayer(page, "Alice");
  await pickAction(page, "late");
  const lateToast = await waitForToast(page);
  expect(lateToast).toContain("Alice");

  // Alice should appear with the late chip style
  const lateChips = page.locator(".game-card-current .chip-late");
  const lateNames: string[] = [];
  for (let i = 0; i < await lateChips.count(); i++) {
    lateNames.push((await lateChips.nth(i).textContent() ?? "").trim());
  }
  expect(lateNames).toContain("Alice");

  // Now mark Alice as arrived
  await tapPlayer(page, "Alice");
  await pickAction(page, "joined");
  const arrivedToast = await waitForToast(page);
  expect(arrivedToast).toContain("Alice");
  expect(arrivedToast).toContain("arrived");

  // Alice should now be in the rotation for future games.
  // Check game 2 (up next) — Alice should appear somewhere.
  const nextCard = page.locator(".game-card-next");
  await expect(nextCard).toBeVisible();
  const nextChips = nextCard.locator(".chip");
  const nextNames: string[] = [];
  for (let i = 0; i < await nextChips.count(); i++) {
    nextNames.push((await nextChips.nth(i).textContent() ?? "").trim());
  }
  expect(nextNames).toContain("Alice");
});

// ====================================================================
// SCENARIO 3: Injury during game — suggestion updates immediately
// ====================================================================

test("injury: sub suggestion immediately shows injured player as out", async ({ page }) => {
  await freshStart(page);

  await addPlayers(page, ["Alice", "Bob", "Charlie", "Dave", "Eve", "Frank", "Grace"]);
  await setPlayersPerTeam(page, 5);
  await setNumberOfGames(page, 3);
  await generate(page);

  // Identify a player currently playing
  const playing = await currentGameSection(page, "Playing");
  expect(playing.length).toBe(5);
  const playerToInjure = playing[2]; // pick one from the middle

  // Mark them injured
  await tapPlayer(page, playerToInjure);
  await pickAction(page, "injured");
  const toast = await waitForToast(page);
  expect(toast).toContain(playerToInjure);
  expect(toast).toContain("injured");

  // Sub strip should now show "Injury replacement" label
  await expect(page.locator(".sub-strip-label")).toHaveText("Injury replacement");

  // The strip should have the urgent style
  await expect(page.locator(".sub-strip-urgent")).toBeVisible();

  // The outgoing chip should show the injured player's name
  const outChip = page.locator(".sub-strip-row .chip-injured");
  await expect(outChip).toHaveText(playerToInjure);

  // Confirm the sub
  await page.getByRole("button", { name: "Make sub" }).click();

  // After making the sub, the injured player should no longer be in "Playing"
  const playingAfter = await currentGameSection(page, "Playing");
  expect(playingAfter).not.toContain(playerToInjure);
});

// ====================================================================
// SCENARIO 4: Fairness recovery — underplayed player gets priority
// ====================================================================

test("fairness: late joiner is prioritised in later games", async ({ page }) => {
  await freshStart(page);

  await addPlayers(page, ["Alice", "Bob", "Charlie"]);
  await setPlayersPerTeam(page, 2);
  await setNumberOfGames(page, 3);
  await generate(page);

  // Mark Charlie as late
  await tapPlayer(page, "Charlie");
  await pickAction(page, "late");
  await waitForToast(page);

  // Advance to game 2
  await page.getByRole("button", { name: "Start next game" }).click();

  // Mark Charlie as arrived
  const charlieChip = page.locator(".game-card-current .chip-late", { hasText: "Charlie" });
  await charlieChip.click();
  await page.waitForSelector("#action-sheet:not([hidden])");
  await pickAction(page, "joined");
  await waitForToast(page);

  // Advance to game 3
  await page.getByRole("button", { name: "Start next game" }).click();

  // Charlie missed game 1 entirely, so the fairness system should
  // prioritise them. Check that Charlie is playing in game 3.
  const game3Playing = await currentGameSection(page, "Playing");
  expect(game3Playing).toContain("Charlie");

  // Check the fairness summary — Charlie should not be significantly underplayed
  const fairnessRows = page.locator(".fairness-row");
  const count = await fairnessRows.count();
  for (let i = 0; i < count; i++) {
    const scoreText = await fairnessRows.nth(i).locator(".fairness-score").textContent();
    const score = parseFloat(scoreText ?? "0");
    // No player should be more than 1 unit behind fair rate
    expect(Math.abs(score)).toBeLessThanOrEqual(1.5);
  }
});

// ====================================================================
// SCENARIO 5: Make sub then undo — state fully restored
// ====================================================================

test("undo: substitution is fully reversible", async ({ page }) => {
  await freshStart(page);

  await addPlayers(page, ["Alice", "Bob", "Charlie"]);
  await setPlayersPerTeam(page, 2);
  await setNumberOfGames(page, 3);
  await generate(page);

  // Capture state before sub
  const playingBefore = await currentGameSection(page, "Playing");
  const benchBefore = await currentGameSection(page, "Bench");

  // Make the suggested sub
  await page.getByRole("button", { name: "Make sub" }).click();
  const subToast = await waitForToast(page);
  expect(subToast).toContain("on for");

  // Verify the lineup changed
  const playingAfterSub = await currentGameSection(page, "Playing");
  expect(playingAfterSub).not.toEqual(playingBefore);

  // Undo
  await clickUndo(page);
  const undoToast = await waitForToast(page);
  expect(undoToast).toContain("Undone");

  // Lineup should be back to original
  const playingAfterUndo = await currentGameSection(page, "Playing");
  const benchAfterUndo = await currentGameSection(page, "Bench");
  expect(playingAfterUndo.sort()).toEqual(playingBefore.sort());
  expect(benchAfterUndo.sort()).toEqual(benchBefore.sort());
});

// ====================================================================
// SCENARIO 6: Player leaving early
// ====================================================================

test("leaving early: player excluded from future games, fairness adjusts", async ({ page }) => {
  await freshStart(page);

  await addPlayers(page, ["Alice", "Bob", "Charlie"]);
  await setPlayersPerTeam(page, 2);
  await setNumberOfGames(page, 3);
  await generate(page);

  // Mark Alice as leaving early
  await tapPlayer(page, "Alice");
  await pickAction(page, "leaving");
  const toast = await waitForToast(page);
  expect(toast).toContain("Alice");
  expect(toast).toContain("leaves");

  // Advance to game 2
  await page.getByRole("button", { name: "Start next game" }).click();

  // Alice should not be playing or on bench in game 2
  // (she left after game 1)
  const game2Playing = await currentGameSection(page, "Playing");
  const game2Bench = await currentGameSection(page, "Bench");
  expect(game2Playing).not.toContain("Alice");
  expect(game2Bench).not.toContain("Alice");

  // The remaining two players should fill the slots
  const allGame2 = [...game2Playing, ...game2Bench].sort();
  expect(allGame2).toEqual(["Bob", "Charlie"]);
});
