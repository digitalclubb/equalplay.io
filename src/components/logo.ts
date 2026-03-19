/**
 * Rotation ring logo: two bold curved arrows forming a continuous loop.
 * Paired with a geometric wordmark — "Equal" in dark, "Play" in blue.
 */
export function createLogo(): string {
  return `
    <svg class="logo" viewBox="0 0 220 44" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Equal Play">
      <!-- Rotation ring mark -->
      <g transform="translate(22, 22)">
        <!-- Top arc: clockwise arrow -->
        <path d="M-10,-2 A11,11 0 0,1 10,-2" fill="none" stroke="#2563eb" stroke-width="3" stroke-linecap="round"/>
        <polygon points="9,-6 13,-1.5 8,-1" fill="#2563eb"/>
        <!-- Bottom arc: counter-clockwise arrow -->
        <path d="M10,2 A11,11 0 0,1 -10,2" fill="none" stroke="#2563eb" stroke-width="3" stroke-linecap="round"/>
        <polygon points="-9,6 -13,1.5 -8,1" fill="#2563eb"/>
      </g>
      <!-- Wordmark -->
      <text x="46" y="30" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="800" fill="#0f172a" letter-spacing="-0.5">Equal</text>
      <text x="120" y="30" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="800" fill="#2563eb" letter-spacing="-0.5">Play</text>
    </svg>
  `;
}
