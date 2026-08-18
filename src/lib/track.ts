/**
 * Custom analytics events.
 *
 * Two of them, covering the only question the one-product change asks. Does
 * anybody cross from the free planner into the app, then go on to register.
 * Pageviews alone cannot answer either, so without these the gates in
 * `docs/one-product.md` cannot be judged.
 *
 * Lazily imported so it never sits in front of first paint. Failures are
 * swallowed, because a blocked analytics script must not take the app with it.
 */
export function track(event: string, data?: Record<string, string>): void {
  void import("@vercel/analytics")
    .then(({ track: send }) => send(event, data))
    .catch(() => {});
}
