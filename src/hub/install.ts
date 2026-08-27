/**
 * Whether this thing will work at the pitch, plus how to make sure of it.
 *
 * The whole product rests on a promise nothing on screen has ever made out
 * loud: open it once at home and the drills, the sessions and the guides are
 * all still there on a wet Tuesday with one bar of signal. A coach has no way
 * of knowing that until the moment it matters, which is the moment it is too
 * late to do anything about.
 */

/**
 * The install prompt, caught and kept.
 *
 * `beforeinstallprompt` fires once, early in the page load, long before a coach
 * has thought about the Account page. Not caught here it is gone for that
 * visit, taking with it the only way to offer an install from inside the app.
 */
interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let waiting: InstallPrompt | null = null;

window.addEventListener("beforeinstallprompt", (event) => {
  // Keeps the browser's own bar from appearing over the app. The offer is made
  // on the Account page instead, where there is room to say what it is for.
  event.preventDefault();
  waiting = event as InstallPrompt;
});

window.addEventListener("appinstalled", () => {
  waiting = null;
});

/** True when this browser has an install to offer. Not every one does. */
export function canInstall(): boolean {
  return waiting !== null;
}

/** True when the app is already running from a home screen rather than a tab. */
export function isInstalled(): boolean {
  try {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS, which has never implemented the standard display-mode query
      ("standalone" in navigator && navigator.standalone === true)
    );
  } catch {
    return false;
  }
}

/**
 * Whether the service worker is serving this page.
 *
 * A controller means the worker is between the app and the network, which is
 * the same thing as saying the shell and everything it has fetched is on the
 * device. It is null on a very first visit, because registration is deferred to
 * an idle moment, so the answer is honestly "not yet" rather than "no".
 */
export function savedForOffline(): boolean {
  return Boolean(navigator.serviceWorker?.controller);
}

export type InstallOutcome = "installed" | "dismissed" | "unavailable";

/** A prompt can only be used once, so it is dropped whether or not it is taken. */
export async function promptInstall(): Promise<InstallOutcome> {
  const prompt = waiting;
  if (!prompt) return "unavailable";

  try {
    await prompt.prompt();
    // Spent only once it has actually been shown. Chrome rejects the call when
    // it declines to display anything. Dropping the event before that took the
    // offer away for the rest of the visit over a prompt nobody ever saw.
    waiting = null;
    const { outcome } = await prompt.userChoice;
    return outcome === "accepted" ? "installed" : "dismissed";
  } catch {
    return "unavailable";
  }
}
