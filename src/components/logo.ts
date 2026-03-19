/**
 * Logo: rounded square icon with rotation arrows + "EqualPlay" wordmark.
 *
 * - 32px icon, 21px wordmark
 * - Bold weight, tight tracking
 * - High contrast for outdoor readability
 */
export function createLogo(): string {
  return `
    <svg class="logo" viewBox="0 0 188 32" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="EqualPlay">
      <!-- Icon: rounded square with rotation arrows -->
      <rect width="32" height="32" rx="8" fill="#2563eb"/>
      <g transform="translate(16, 16)">
        <!-- Top arrow: arcs right-to-left -->
        <path d="M7,-2.5 A8,8 0 0,0 -7,-2.5" fill="none" stroke="white" stroke-width="2.8" stroke-linecap="round"/>
        <path d="M-5,-6.5 L-8,-2.5 L-4,-1.5" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
        <!-- Bottom arrow: arcs left-to-right -->
        <path d="M-7,2.5 A8,8 0 0,0 7,2.5" fill="none" stroke="white" stroke-width="2.8" stroke-linecap="round"/>
        <path d="M5,6.5 L8,2.5 L4,1.5" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      </g>
      <!-- Wordmark -->
      <text x="42" y="23" font-family="system-ui, -apple-system, sans-serif" font-size="21" font-weight="700" fill="#0f172a" letter-spacing="-0.5">EqualPlay</text>
    </svg>
  `;
}
