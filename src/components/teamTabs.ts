export interface TeamTab {
  id: string;
  name: string;
}

export interface TeamTabsCallbacks {
  onSelect: (teamId: string) => void;
  onAdd: () => void;
  onRename: (teamId: string, newName: string) => void;
  onDelete: (teamId: string) => void;
}

/**
 * Horizontal tab bar for team switching.
 * Tap inactive tab → switch. Tap active tab → shows manage options.
 */
export function renderTeamTabs(
  container: HTMLElement,
  teams: TeamTab[],
  activeTeamId: string,
  callbacks: TeamTabsCallbacks,
): void {
  container.innerHTML = "";
  container.className = "team-tabs";
  container.setAttribute("role", "tablist");
  container.setAttribute("aria-label", "Teams");
  container.removeAttribute("aria-hidden");

  const canDelete = teams.length > 1;

  for (const team of teams) {
    const isActive = team.id === activeTeamId;

    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = `team-tab${isActive ? " team-tab-active" : ""}`;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", String(isActive));
    tab.setAttribute("tabindex", isActive ? "0" : "-1");

    const nameSpan = document.createElement("span");
    nameSpan.className = "team-tab-name";
    nameSpan.textContent = team.name;
    tab.appendChild(nameSpan);

    if (isActive) {
      // Tap active tab → show manage sheet (rename / delete)
      tab.addEventListener("click", () => {
        showTeamSheet(team, canDelete, callbacks);
      });
    } else {
      tab.addEventListener("click", () => {
        callbacks.onSelect(team.id);
      });
    }

    container.appendChild(tab);
  }

  // Add button
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "team-tab team-tab-add";
  addBtn.textContent = "+";
  addBtn.setAttribute("aria-label", "Add team");
  addBtn.addEventListener("click", () => callbacks.onAdd());
  container.appendChild(addBtn);

  // Arrow key navigation between tabs (WAI-ARIA tabs pattern)
  container.addEventListener("keydown", (e) => {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) return;

    const tabs = Array.from(container.querySelectorAll<HTMLElement>('[role="tab"]'));
    const currentIndex = tabs.findIndex((t) => t === document.activeElement);
    if (currentIndex === -1) return;

    let nextIndex: number;
    if (e.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % tabs.length;
    } else if (e.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    } else if (e.key === "Home") {
      nextIndex = 0;
    } else {
      nextIndex = tabs.length - 1;
    }

    e.preventDefault();
    tabs[currentIndex].setAttribute("tabindex", "-1");
    tabs[nextIndex].setAttribute("tabindex", "0");
    tabs[nextIndex].focus();
  });
}

// ---- Team manage sheet ----

function showTeamSheet(
  team: TeamTab,
  canDelete: boolean,
  callbacks: TeamTabsCallbacks,
): void {
  // Reuse the action sheet pattern (or create a dedicated one)
  let sheet = document.getElementById("team-sheet");
  let backdrop = document.getElementById("team-sheet-backdrop");

  if (!backdrop) {
    backdrop = document.createElement("div");
    backdrop.id = "team-sheet-backdrop";
    backdrop.className = "action-backdrop";
    backdrop.addEventListener("click", dismissTeamSheet);
    document.body.appendChild(backdrop);
  }

  if (!sheet) {
    sheet = document.createElement("div");
    sheet.id = "team-sheet";
    sheet.className = "action-sheet";
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-modal", "true");
    document.body.appendChild(sheet);
  }

  backdrop.hidden = false;
  sheet.hidden = false;
  sheet.setAttribute("aria-label", `Manage ${team.name}`);

  let deleteHTML = "";
  if (canDelete) {
    deleteHTML = `
      <button type="button" class="action-btn action-btn-delete" data-action="delete">
        Delete team
        <span class="action-desc">Remove ${esc(team.name)} and all its data</span>
      </button>
    `;
  }

  sheet.innerHTML = `
    <div class="action-sheet-header">${esc(team.name)}</div>
    <div class="action-sheet-actions">
      <button type="button" class="action-btn" data-action="rename">
        Rename team
        <span class="action-desc">Change the team name</span>
      </button>
      ${deleteHTML}
    </div>
  `;

  sheet.querySelectorAll<HTMLButtonElement>(".action-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;

      if (action === "rename") {
        showRenameView(sheet!, team, callbacks);
      } else if (action === "delete") {
        showDeleteConfirm(sheet!, team, callbacks);
      }
    });
  });

  // Focus first action and add Escape key handler
  const firstBtn = sheet.querySelector<HTMLButtonElement>(".action-btn");
  if (firstBtn) firstBtn.focus();

  addSheetKeyHandler();
}

/** Inline rename: replaces sheet content with a text input + save/cancel */
function showRenameView(
  sheet: HTMLElement,
  team: TeamTab,
  callbacks: TeamTabsCallbacks,
): void {
  sheet.setAttribute("aria-label", `Rename ${team.name}`);
  sheet.innerHTML = `
    <div class="action-sheet-header">Rename team</div>
    <div class="team-sheet-rename-form">
      <input type="text" class="team-sheet-rename-input" value="${esc(team.name)}" maxlength="30" aria-label="Team name" />
      <div class="team-sheet-rename-actions">
        <button type="button" class="action-btn action-btn-clear" data-action="cancel">Cancel</button>
        <button type="button" class="action-btn team-sheet-rename-save" data-action="save">Save</button>
      </div>
    </div>
  `;

  const input = sheet.querySelector<HTMLInputElement>(".team-sheet-rename-input")!;
  const saveBtn = sheet.querySelector<HTMLButtonElement>('[data-action="save"]')!;
  const cancelBtn = sheet.querySelector<HTMLButtonElement>('[data-action="cancel"]')!;

  input.focus();
  input.select();

  function save(): void {
    const newName = input.value.trim();
    if (newName && newName !== team.name) {
      callbacks.onRename(team.id, newName);
    }
    dismissTeamSheet();
  }

  saveBtn.addEventListener("click", (e) => { e.stopPropagation(); save(); });
  cancelBtn.addEventListener("click", (e) => { e.stopPropagation(); dismissTeamSheet(); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); save(); }
    else if (e.key === "Escape") { e.preventDefault(); dismissTeamSheet(); }
  });
}

/** Inline delete confirm: replaces sheet content with a warning + confirm/cancel */
function showDeleteConfirm(
  sheet: HTMLElement,
  team: TeamTab,
  callbacks: TeamTabsCallbacks,
): void {
  sheet.setAttribute("aria-label", `Delete ${team.name}`);
  sheet.innerHTML = `
    <div class="action-sheet-header">Delete ${esc(team.name)}?</div>
    <p class="team-sheet-delete-warning">This will remove all players, games and events for this team. This can't be undone.</p>
    <div class="team-sheet-rename-actions">
      <button type="button" class="action-btn action-btn-clear" data-action="cancel">Cancel</button>
      <button type="button" class="action-btn action-btn-delete" data-action="confirm-delete">Delete</button>
    </div>
  `;

  const confirmBtn = sheet.querySelector<HTMLButtonElement>('[data-action="confirm-delete"]')!;
  const cancelBtn = sheet.querySelector<HTMLButtonElement>('[data-action="cancel"]')!;

  cancelBtn.focus();

  confirmBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    dismissTeamSheet();
    callbacks.onDelete(team.id);
  });
  cancelBtn.addEventListener("click", (e) => { e.stopPropagation(); dismissTeamSheet(); });
}

function sheetKeyHandler(e: KeyboardEvent): void {
  if (e.key === "Escape") {
    e.preventDefault();
    dismissTeamSheet();
  }
}

function addSheetKeyHandler(): void {
  document.removeEventListener("keydown", sheetKeyHandler);
  document.addEventListener("keydown", sheetKeyHandler);
}

function dismissTeamSheet(): void {
  const sheet = document.getElementById("team-sheet");
  const backdrop = document.getElementById("team-sheet-backdrop");
  if (sheet) sheet.hidden = true;
  if (backdrop) backdrop.hidden = true;
  document.removeEventListener("keydown", sheetKeyHandler);
}

function esc(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
