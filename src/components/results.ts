import type { Player, RotationResult } from "../types/index.js";

/**
 * Renders the rotation results with player chips.
 * Accepts an optional callback that supplies the current full player list
 * so we can detect post-generation status changes and suggest replacements.
 */
export function renderResults(
  container: HTMLElement,
  result: RotationResult,
  getCurrentPlayers?: () => Player[],
): void {
  container.innerHTML = "";

  const header = document.createElement("div");
  header.innerHTML = `
    <h2>Rotation Plan</h2>
    <p class="subtitle">
      ${result.totalPlayers} players, ${result.playersPerTeam} per team,
      ${result.games.length} game(s) — subs: ${result.substitutionType}
    </p>
  `;
  container.appendChild(header);

  for (const game of result.games) {
    const card = document.createElement("div");
    card.className = "game-card";

    const title = document.createElement("h3");
    title.textContent = `Game ${game.gameNumber}`;
    card.appendChild(title);

    // On field section
    const fieldSection = document.createElement("div");
    fieldSection.className = "game-section";
    const fieldLabel = document.createElement("span");
    fieldLabel.className = "game-section-label";
    fieldLabel.textContent = "On Field";
    fieldSection.appendChild(fieldLabel);
    const fieldChips = document.createElement("div");
    fieldChips.className = "chip-list";
    for (const p of game.starters) {
      fieldChips.appendChild(createChip(p, "field"));
    }
    fieldSection.appendChild(fieldChips);
    card.appendChild(fieldSection);

    // Bench section
    const benchSection = document.createElement("div");
    benchSection.className = "game-section";
    const benchLabel = document.createElement("span");
    benchLabel.className = "game-section-label";
    benchLabel.textContent = "Bench";
    benchSection.appendChild(benchLabel);
    const benchChips = document.createElement("div");
    benchChips.className = "chip-list";
    if (game.bench.length === 0) {
      const none = document.createElement("span");
      none.className = "chip-none";
      none.textContent = "—";
      benchChips.appendChild(none);
    } else {
      for (const p of game.bench) {
        benchChips.appendChild(createChip(p, "bench"));
      }
    }
    benchSection.appendChild(benchChips);
    card.appendChild(benchSection);

    // Replacement suggestion slot — updated live
    const replacementSlot = document.createElement("div");
    replacementSlot.className = "replacement-slot";
    card.appendChild(replacementSlot);

    // Store game data on the card so we can re-evaluate replacements
    (card as GameCardElement).__gameData = {
      starters: game.starters,
      bench: game.bench,
      replacementSlot,
      fieldChips,
    };

    container.appendChild(card);
  }

  // If we have a way to read live player state, wire up status-change updates
  if (getCurrentPlayers) {
    updateReplacements(container, getCurrentPlayers);
  }
}

interface GameCardData {
  starters: Player[];
  bench: Player[];
  replacementSlot: HTMLElement;
  fieldChips: HTMLElement;
}

interface GameCardElement extends HTMLElement {
  __gameData?: GameCardData;
}

/**
 * Re-evaluates all game cards for injured/late starters and suggests
 * bench replacements. Called on initial render and on status changes.
 */
export function updateReplacements(
  container: HTMLElement,
  getCurrentPlayers: () => Player[],
): void {
  const currentPlayers = getCurrentPlayers();
  const cards = container.querySelectorAll<GameCardElement>(".game-card");

  for (const card of cards) {
    const data = card.__gameData;
    if (!data) continue;

    const { starters, bench, replacementSlot, fieldChips } = data;

    // Update chip styles based on current status
    const chips = fieldChips.querySelectorAll<HTMLElement>(".chip");
    for (const chip of chips) {
      const name = chip.dataset.playerName;
      const current = currentPlayers.find((p) => p.name === name);
      chip.classList.remove("chip-injured", "chip-late");
      if (current?.status === "injured") chip.classList.add("chip-injured");
      if (current?.status === "late") chip.classList.add("chip-late");
    }

    // Find starters who are now unavailable
    const unavailable = starters.filter((s) => {
      const current = currentPlayers.find((p) => p.name === s.name);
      return current && current.status !== "active";
    });

    if (unavailable.length === 0) {
      replacementSlot.innerHTML = "";
      continue;
    }

    // Find available bench players (active and not already suggested)
    const usedReplacements = new Set<string>();
    const suggestions: string[] = [];

    for (const player of unavailable) {
      const replacement = bench.find((b) => {
        const current = currentPlayers.find((p) => p.name === b.name);
        return current?.status === "active" && !usedReplacements.has(b.name);
      });

      if (replacement) {
        usedReplacements.add(replacement.name);
        suggestions.push(
          `<div class="replacement-row">
            <span class="chip chip-injured">${escapeHtml(player.name)}</span>
            <span class="replacement-arrow">&rarr;</span>
            <span class="chip chip-replacement">${escapeHtml(replacement.name)}</span>
          </div>`,
        );
      } else {
        suggestions.push(
          `<div class="replacement-row">
            <span class="chip chip-injured">${escapeHtml(player.name)}</span>
            <span class="replacement-arrow">&rarr;</span>
            <span class="replacement-none">No available replacement</span>
          </div>`,
        );
      }
    }

    replacementSlot.innerHTML = `
      <div class="replacement-card">
        <span class="replacement-title">Suggested Replacements</span>
        ${suggestions.join("")}
      </div>
    `;
  }
}

function createChip(player: Player, role: "field" | "bench"): HTMLElement {
  const chip = document.createElement("span");
  chip.className = `chip chip-${role}`;
  chip.dataset.playerName = player.name;
  if (player.status === "injured") chip.classList.add("chip-injured");
  if (player.status === "late") chip.classList.add("chip-late");
  chip.textContent = player.name;
  return chip;
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
