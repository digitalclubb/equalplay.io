const MIN_PLAYERS = 2;
const MAX_PLAYERS = 30;

/**
 * Dynamic player input list.
 * Starts with 2 empty fields. Users can add/remove rows up to MAX_PLAYERS.
 * Returns the container element; call getPlayerNames() to read current values.
 */
export function createPlayerList(): {
  element: HTMLElement;
  getPlayerNames: () => string[];
} {
  const container = document.createElement("div");
  container.className = "form-group";

  const label = document.createElement("label");
  label.textContent = "Players";
  container.appendChild(label);

  const list = document.createElement("div");
  list.className = "player-list";
  container.appendChild(list);

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "btn-add-player";
  addBtn.textContent = "+ Add Player";
  container.appendChild(addBtn);

  // Seed with 2 empty rows
  appendRow(list, "");
  appendRow(list, "");
  updateRemoveButtons(list);

  addBtn.addEventListener("click", () => {
    if (list.children.length >= MAX_PLAYERS) return;
    appendRow(list, "");
    updateRemoveButtons(list);
    updateAddButton(list, addBtn);
    // Focus the newly added input
    const inputs = list.querySelectorAll<HTMLInputElement>("input");
    inputs[inputs.length - 1].focus();
  });

  function getPlayerNames(): string[] {
    const inputs = list.querySelectorAll<HTMLInputElement>("input");
    return Array.from(inputs)
      .map((input) => input.value.trim())
      .filter(Boolean);
  }

  return { element: container, getPlayerNames };
}

function appendRow(list: HTMLElement, value: string): void {
  const row = document.createElement("div");
  row.className = "player-row";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "player-input";
  input.placeholder = `Player ${list.children.length + 1}`;
  input.value = value;

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "btn-remove-player";
  removeBtn.title = "Remove player";
  removeBtn.textContent = "\u00D7"; // × character
  removeBtn.addEventListener("click", () => {
    row.remove();
    updateRemoveButtons(list);
    // Re-number placeholders
    list.querySelectorAll<HTMLInputElement>("input").forEach((inp, i) => {
      inp.placeholder = `Player ${i + 1}`;
    });
    // Re-show add button in case we dropped below max
    const addBtn = list.parentElement?.querySelector<HTMLButtonElement>(".btn-add-player");
    if (addBtn) updateAddButton(list, addBtn);
  });

  row.appendChild(input);
  row.appendChild(removeBtn);
  list.appendChild(row);
}

/** Hide remove buttons when at minimum player count */
function updateRemoveButtons(list: HTMLElement): void {
  const buttons = list.querySelectorAll<HTMLButtonElement>(".btn-remove-player");
  const atMin = list.children.length <= MIN_PLAYERS;
  buttons.forEach((btn) => {
    btn.style.visibility = atMin ? "hidden" : "visible";
  });
}

/** Disable add button when at max */
function updateAddButton(list: HTMLElement, btn: HTMLButtonElement): void {
  btn.disabled = list.children.length >= MAX_PLAYERS;
}
