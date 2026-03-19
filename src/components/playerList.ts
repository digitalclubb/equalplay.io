import type { Player } from "../types/index.js";

const MAX_PLAYERS = 30;

let nextPlayerId = 1;
function generateId(): string {
  return `p${nextPlayerId++}`;
}

export interface PlayerListHandle {
  element: HTMLElement;
  getPlayers: () => Player[];
}

/**
 * Chip-based squad list. No persistent input field —
 * tap "+ Add" to reveal an inline input, type a name, press Enter.
 */
export function createPlayerList(): PlayerListHandle {
  const container = document.createElement("div");
  container.className = "squad-chips";

  const chipArea = document.createElement("div");
  chipArea.className = "player-chips";
  container.appendChild(chipArea);

  // "+ Add" chip that turns into an input
  const addChip = document.createElement("button");
  addChip.type = "button";
  addChip.className = "player-chip-add";
  addChip.textContent = "+ Add";

  const inputWrap = document.createElement("div");
  inputWrap.className = "player-inline-input";
  inputWrap.hidden = true;

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Name";

  function commitName(): void {
    const name = input.value.trim();
    if (name && chipArea.children.length < MAX_PLAYERS) {
      addPlayerChip(name);
    }
    input.value = "";
  }

  function closeInput(): void {
    commitName();
    inputWrap.hidden = true;
    addChip.hidden = false;
  }

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitName();
      // Keep input open for rapid entry
      input.focus();
    } else if (e.key === "Escape") {
      closeInput();
    }
  });

  input.addEventListener("blur", () => {
    // Small delay to allow chip × clicks to register
    setTimeout(closeInput, 150);
  });

  inputWrap.appendChild(input);
  container.appendChild(inputWrap);
  container.appendChild(addChip);

  addChip.addEventListener("click", () => {
    addChip.hidden = true;
    inputWrap.hidden = false;
    input.value = "";
    input.focus();
  });

  function addPlayerChip(name: string): void {
    const chip = document.createElement("span");
    chip.className = "player-chip";
    chip.dataset.playerId = generateId();

    const nameSpan = document.createElement("span");
    nameSpan.textContent = name;
    chip.appendChild(nameSpan);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "player-chip-remove";
    removeBtn.textContent = "\u00D7";
    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      chip.remove();
    });
    chip.appendChild(removeBtn);

    chipArea.appendChild(chip);
  }

  function getPlayers(): Player[] {
    const chips = chipArea.querySelectorAll<HTMLElement>(".player-chip");
    const players: Player[] = [];
    for (const chip of chips) {
      const name = chip.querySelector("span")?.textContent?.trim();
      if (!name) continue;
      players.push({ id: chip.dataset.playerId!, name });
    }
    return players;
  }

  return { element: container, getPlayers };
}
