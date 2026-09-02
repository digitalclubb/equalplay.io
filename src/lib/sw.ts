/**
 * The service worker, registered in production and cleared out of dev.
 *
 * `sw.js` runs stale-while-revalidate over every same-origin GET. In production
 * that is the point of it. On the dev server it means Vite's own module graph,
 * cached by a worker that outlives the process which served it: the precached
 * shell paints, the nav with it, then the modules behind it come back from
 * yesterday or not at all.
 *
 * So dev unregisters rather than merely declining to register. Anyone who
 * loaded the dev server before this existed already has the worker installed,
 * and a gate on its own leaves exactly those people broken. Nothing reads the
 * caches once no worker is serving them.
 *
 * `pnpm preview:demo` is a production build, so the offline promise is still
 * proven where it should be proven.
 *
 * Shared by both entries. This module imports nothing, the way `lib/nav.ts`
 * does, so the planner keeps its bundle.
 */
export function manageServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;

  if (import.meta.env.PROD) {
    navigator.serviceWorker.register("/sw.js");
    return;
  }

  navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => {
      for (const registration of registrations) registration.unregister();
    })
    .catch(() => {});
}
