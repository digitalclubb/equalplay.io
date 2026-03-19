/**
 * Logo: PNG rotation icon (visually cropped) + "Equal Play" in Outfit.
 */
export function createLogo(): string {
  return `
    <div class="logo" role="img" aria-label="Equal Play">
      <div class="logo-icon-wrap">
        <img class="logo-icon" src="/logo-idea.png" alt="" />
      </div>
      <span class="logo-text">Equal <span class="logo-text-play">Play</span></span>
    </div>
  `;
}
