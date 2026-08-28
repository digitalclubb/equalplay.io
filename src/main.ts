import { mountApp } from "./app.js";
import { track } from "./lib/track.js";
import { wireScheme } from "./lib/theme.js";

const root = document.getElementById("app");
if (!root) {
  console.error("Root element #app not found");
} else {
  mountApp(root);
}

// The crossing from the free planner into the rest of the app, which is the
// number the whole one-product change turns on. Delegated from the document so
// it covers the nav and the card under the playing time totals both, including
// the card, which does not exist yet when this runs.
document.addEventListener("click", (event) => {
  const link = (event.target as HTMLElement).closest<HTMLAnchorElement>("a[data-route]");
  if (link?.getAttribute("href")?.startsWith("/hub")) {
    track("planner_to_app", { to: link.dataset.route ?? "" });
  }
});

// The footer is outside anything the app re-renders, so once is enough
wireScheme();

// Deferred: service worker + analytics. Loaded only when browser is idle
function onIdle(fn: () => void): void {
  if ("requestIdleCallback" in window) {
    requestIdleCallback(fn);
  } else {
    setTimeout(fn, 2000);
  }
}

onIdle(() => {
  // Service worker for offline support
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js");
  }

  // Vercel Analytics. Lazy import so it doesn't block initial load
  import("@vercel/analytics").then(({ inject }) => {
    inject();
  });
});
