import { mountApp } from "./app.js";

const root = document.getElementById("app");
if (root) {
  mountApp(root);
} else {
  console.error("Root element #app not found");
}

// Register service worker for offline support
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js");
  });
}
