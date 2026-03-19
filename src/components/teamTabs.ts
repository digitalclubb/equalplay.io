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

  const canDelete = teams.length > 1;

  for (const team of teams) {
    const isActive = team.id === activeTeamId;

    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = `team-tab${isActive ? " team-tab-active" : ""}`;

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
  addBtn.addEventListener("click", () => callbacks.onAdd());
  container.appendChild(addBtn);
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
    document.body.appendChild(sheet);
  }

  backdrop.hidden = false;
  sheet.hidden = false;

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
      dismissTeamSheet();

      if (action === "rename") {
        const newName = prompt("Team name:", team.name);
        if (newName !== null && newName.trim()) {
          callbacks.onRename(team.id, newName.trim());
        }
      } else if (action === "delete") {
        if (confirm(`Delete ${team.name}? This can't be undone.`)) {
          callbacks.onDelete(team.id);
        }
      }
    });
  });
}

function dismissTeamSheet(): void {
  const sheet = document.getElementById("team-sheet");
  const backdrop = document.getElementById("team-sheet-backdrop");
  if (sheet) sheet.hidden = true;
  if (backdrop) backdrop.hidden = true;
}

function esc(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
