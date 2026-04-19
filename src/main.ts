import { mountApp } from "./app.js";

const root = document.getElementById("app");
if (!root) {
  console.error("Root element #app not found");
} else {
  mountApp(root);
}

// Deferred: service worker + analytics — loaded only when browser is idle
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

  // Vercel Analytics — lazy import so it doesn't block initial load
  import("@vercel/analytics").then(({ inject }) => {
    inject();
  });
});
