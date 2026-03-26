let activeTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Shows a toast message. Replaces any existing toast immediately.
 * Auto-dismisses after 2s. Tap anywhere on the toast to dismiss.
 * Supports horizontal swipe-to-dismiss.
 */
export function showToast(
  message: string,
  onUndo?: () => void,
  duration = 2000,
): void {
  let toast = document.getElementById("toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    toast.className = "toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    document.body.appendChild(toast);
    setupSwipeDismiss(toast);
  }

  // Clear pending dismiss
  if (activeTimer !== null) {
    clearTimeout(activeTimer);
    activeTimer = null;
  }

  // If replacing a visible toast, skip fade-in — just swap content
  const wasVisible = toast.classList.contains("toast-visible");

  // Build content
  toast.innerHTML = "";

  const msgSpan = document.createElement("span");
  msgSpan.className = "toast-message";
  msgSpan.textContent = message;
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

  // Tap to dismiss (but not on the undo button)
  toast.onclick = (e) => {
    if ((e.target as HTMLElement).classList.contains("toast-undo")) return;
    dismissToast();
  };

  // Show
  toast.hidden = false;
  toast.style.transform = "";
  toast.style.opacity = "";

  if (!wasVisible) {
    // Force reflow for initial animation
    void toast.offsetHeight;
  }
  toast.classList.add("toast-visible");

  activeTimer = setTimeout(dismissToast, duration);
}

export function dismissToast(): void {
  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.classList.remove("toast-visible");
  if (activeTimer !== null) {
    clearTimeout(activeTimer);
    activeTimer = null;
  }
  // Wait for fade-out transition
  setTimeout(() => {
    toast.hidden = true;
    toast.style.transform = "";
    toast.style.opacity = "";
  }, 150);
}

/** Swipe-to-dismiss: horizontal or upward (like flicking away an iOS notification). */
function setupSwipeDismiss(toast: HTMLElement): void {
  let startX = 0;
  let startY = 0;
  let axis: "x" | "y" | null = null;

  toast.addEventListener("touchstart", (e) => {
    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    axis = null;
    toast.style.transition = "none";
  }, { passive: true });

  toast.addEventListener("touchmove", (e) => {
    if (axis === null) {
      const dx = Math.abs(e.touches[0].clientX - startX);
      const dy = Math.abs(e.touches[0].clientY - startY);
      if (dx < 5 && dy < 5) return; // haven't moved enough to decide
      axis = dx > dy ? "x" : "y";
    }

    if (axis === "x") {
      const dx = e.touches[0].clientX - startX;
      toast.style.transform = `translateX(${dx}px)`;
      toast.style.opacity = String(Math.max(0, 1 - Math.abs(dx) / 200));
    } else {
      const dy = e.touches[0].clientY - startY;
      // Only allow upward swipe (negative dy) — ignore downward
      if (dy < 0) {
        toast.style.transform = `translateY(${dy}px)`;
        toast.style.opacity = String(Math.max(0, 1 - Math.abs(dy) / 100));
      }
    }
  }, { passive: true });

  toast.addEventListener("touchend", () => {
    toast.style.transition = "";
    const opacity = parseFloat(toast.style.opacity || "1");
    if (opacity < 0.5) {
      dismissToast();
    } else {
      toast.style.transform = "";
      toast.style.opacity = "";
    }
    axis = null;
  });
}
