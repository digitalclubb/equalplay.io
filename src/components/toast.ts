let activeTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Shows a toast message at the bottom of the screen.
 * Auto-dismisses after `duration` ms. Optionally includes an Undo button.
 */
export function showToast(
  message: string,
  onUndo?: () => void,
  duration = 4000,
): void {
  // Reuse or create toast container
  let toast = document.getElementById("toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    toast.className = "toast";
    document.body.appendChild(toast);
  }

  // Clear any pending auto-dismiss
  if (activeTimer !== null) {
    clearTimeout(activeTimer);
    activeTimer = null;
  }

  // Build content
  const msgSpan = document.createElement("span");
  msgSpan.className = "toast-message";
  msgSpan.textContent = message;

  toast.innerHTML = "";
  toast.appendChild(msgSpan);

  if (onUndo) {
    const undoBtn = document.createElement("button");
    undoBtn.type = "button";
    undoBtn.className = "toast-undo";
    undoBtn.textContent = "Undo";
    undoBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      dismissToast();
      onUndo();
    });
    toast.appendChild(undoBtn);
  }

  // Show
  toast.hidden = false;
  // Force reflow so the transition plays from opacity 0 → 1
  void toast.offsetHeight;
  toast.classList.add("toast-visible");

  activeTimer = setTimeout(dismissToast, duration);
}

export function dismissToast(): void {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.classList.remove("toast-visible");
  // Wait for fade-out transition before hiding
  setTimeout(() => {
    toast.hidden = true;
  }, 200);
  if (activeTimer !== null) {
    clearTimeout(activeTimer);
    activeTimer = null;
  }
}
