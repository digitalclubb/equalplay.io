/**
 * Logo: two-arrow rotation icon (blue + green) with "EqualPlay" wordmark in Inter.
 * Based on the logo-idea.png — two curved arrows forming a rotation cycle.
 */
export function createLogo(): string {
  return `
    <svg class="logo" viewBox="0 0 200 36" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="EqualPlay">
      <!-- Rotation icon: two curved arrows -->
      <g transform="translate(18, 18)">
        <!-- Blue arrow: curves from right over top to left, arrowhead pointing down-left -->
        <path d="M10,-3 A12,12 0 0,0 -8,-8" fill="none" stroke="#2563eb" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M-5,-12 A12,12 0 0,0 -10,2" fill="none" stroke="#2563eb" stroke-width="3.5" stroke-linecap="round"/>
        <polygon points="-13,1 -9,4 -8,-1" fill="#2563eb"/>

        <!-- Green arrow: curves from left under bottom to right, arrowhead pointing up-right -->
        <path d="M-10,3 A12,12 0 0,0 8,8" fill="none" stroke="#22c55e" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M5,12 A12,12 0 0,0 10,-2" fill="none" stroke="#22c55e" stroke-width="3.5" stroke-linecap="round"/>
        <polygon points="13,-1 9,-4 8,1" fill="#22c55e"/>
      </g>

      <!-- Wordmark in Inter -->
      <text x="40" y="25" font-family="'Inter', system-ui, sans-serif" font-size="20" font-weight="700" fill="#0f172a" letter-spacing="-0.5">EqualPlay</text>
    </svg>
  `;
}
