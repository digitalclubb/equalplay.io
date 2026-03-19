/**
 * Logo: PNG rotation icon + "EqualPlay" wordmark in Inter.
 * Uses the original logo-idea.png for the icon mark.
 */
export function createLogo(): string {
  return `
    <div class="logo" role="img" aria-label="EqualPlay">
      <img class="logo-icon" src="/logo-idea.png" alt="" />
      <span class="logo-text">Equal <span class="logo-text-play">Play</span></span>
    </div>
  `;
}
