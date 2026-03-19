/**
 * Logo: rounded square icon with rotation arrows + "EqualPlay" wordmark.
 *
 * Design language matches implera.ai / comparia.ai:
 * - Rounded square icon container
 * - Geometric icon contents (two bold rotation arrows)
 * - Bold wordmark with tight letter-spacing
 * - Single-line horizontal layout, tight gap
 */
export function createLogo(): string {
  return `
    <svg class="logo" viewBox="0 0 164 28" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="EqualPlay">
      <!-- Icon: rounded square with rotation arrows -->
      <rect width="28" height="28" rx="7" fill="#2563eb"/>
      <g transform="translate(14, 14)">
        <!-- Two bold curved arrows forming a rotation cycle -->
        <!-- Top arrow: arcs right-to-left -->
        <path d="M6,-2 A7,7 0 0,0 -6,-2" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
        <!-- Arrowhead pointing left -->
        <path d="M-4.5,-5.5 L-7,-2 L-3.5,-1.5" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <!-- Bottom arrow: arcs left-to-right -->
        <path d="M-6,2 A7,7 0 0,0 6,2" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
        <!-- Arrowhead pointing right -->
        <path d="M4.5,5.5 L7,2 L3.5,1.5" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </g>
      <!-- Wordmark: tight spacing, single weight -->
      <text x="36" y="20" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="700" fill="#0f172a" letter-spacing="-0.6">EqualPlay</text>
    </svg>
  `;
}
