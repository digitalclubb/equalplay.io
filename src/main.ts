import { mountApp } from "./app.js";

// Entry point — mount once the DOM is ready
const root = document.getElementById("app");
if (root) {
  mountApp(root);
} else {
  console.error("Root element #app not found");
}
