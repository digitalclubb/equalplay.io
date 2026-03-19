export interface TeamTab {
  id: string;
  name: string;
}

export interface TeamTabsCallbacks {
  onSelect: (teamId: string) => void;
  onAdd: () => void;
  onRename: (teamId: string, newName: string) => void;
}

/**
 * Renders a horizontal tab bar for team switching.
 * [ Team 1 ] [ Team 2 ] [ + ]
 */
export function renderTeamTabs(
  container: HTMLElement,
  teams: TeamTab[],
  activeTeamId: string,
  callbacks: TeamTabsCallbacks,
): void {
  container.innerHTML = "";
  container.className = "team-tabs";

  for (const team of teams) {
    const isActive = team.id === activeTeamId;

    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = `team-tab${isActive ? " team-tab-active" : ""}`;
    tab.dataset.teamId = team.id;

    const nameSpan = document.createElement("span");
    nameSpan.className = "team-tab-name";
    nameSpan.textContent = team.name;
    tab.appendChild(nameSpan);

    tab.addEventListener("click", () => {
      if (!isActive) {
        callbacks.onSelect(team.id);
      }
    });

    // Double-tap / long-press to rename (use simple click on name for active tab)
    if (isActive) {
      nameSpan.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        promptRename(tab, team, callbacks, nameSpan);
      });
    }

    container.appendChild(tab);
  }

  // Add team button
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "team-tab team-tab-add";
  addBtn.textContent = "+";
  addBtn.addEventListener("click", () => {
    callbacks.onAdd();
  });
  container.appendChild(addBtn);
}

function promptRename(
  _tab: HTMLElement,
  team: TeamTab,
  callbacks: TeamTabsCallbacks,
  nameSpan: HTMLSpanElement,
): void {

  const input = document.createElement("input");
  input.type = "text";
  input.className = "team-tab-rename";
  input.value = team.name;

  function commit(): void {
    const newName = input.value.trim() || team.name;
    nameSpan.textContent = newName;
    if (input.parentElement) {
      input.replaceWith(nameSpan);
    }
    callbacks.onRename(team.id, newName);
  }

  input.addEventListener("blur", commit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      nameSpan.textContent = team.name;
      input.replaceWith(nameSpan);
    }
  });

  nameSpan.replaceWith(input);
  input.focus();
  input.select();
}
