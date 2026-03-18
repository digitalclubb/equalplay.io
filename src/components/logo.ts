/** Returns the SVG logo markup as a string */
export function createLogo(): string {
  return `
    <svg class="logo" viewBox="0 0 240 48" xmlns="http://www.w3.org/2000/svg" aria-label="Equal Play logo">
      <!-- Balance / swap icon: two curved arrows forming a cycle -->
      <g transform="translate(4, 4)" stroke="#2563eb" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 26 A12 12 0 0 1 32 14" />
        <polyline points="28,8 32,14 26,16" />
        <path d="M32 14 A12 12 0 0 1 8 26" />
        <polyline points="12,32 8,26 14,24" />
      </g>
      <text x="52" y="34" font-family="system-ui, -apple-system, sans-serif" font-size="28" font-weight="700" fill="#1e293b">
        Equal
      </text>
      <text x="134" y="34" font-family="system-ui, -apple-system, sans-serif" font-size="28" font-weight="700" fill="#2563eb">
        Play
      </text>
    </svg>
  `;
}
