/**
 * Logo: rotation loop with 4 player nodes connected by arc segments.
 *
 * Four dots (players) arranged in a circle, connected by bold curved
 * segments. One node is green (active player). A small arrowhead on
 * the leading segment shows rotation direction.
 *
 * This reads as "players rotating fairly" — not a spinner, not abstract.
 */
export function createLogo(): string {
  // Node positions on a circle of radius 14, centred at (20, 22)
  // Placed at 315°, 45°, 135°, 225° (rotated 45° from cardinal points
  // so the active node sits top-right — visually leading the rotation)
  const cx = 20;
  const cy = 22;
  const r = 13;
  const nodeR = 3.5;

  // Angles in degrees: top-right, bottom-right, bottom-left, top-left
  const angles = [315, 45, 135, 225];
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const nodes = angles.map((a) => ({
    x: cx + r * Math.cos(rad(a)),
    y: cy + r * Math.sin(rad(a)),
  }));

  // Arc segments between nodes (clockwise)
  // Each arc goes from one node to the next along the circle
  function arcBetween(from: { x: number; y: number }, to: { x: number; y: number }): string {
    return `M${from.x.toFixed(1)},${from.y.toFixed(1)} A${r},${r} 0 0,1 ${to.x.toFixed(1)},${to.y.toFixed(1)}`;
  }

  // Arrowhead near node 0 (the green/active node) — on the arc from node 3 to node 0
  // Position it ~70% along that arc
  const arrowAngle = 225 + (360 - 225 + 315) * 0.65; // ~303°
  const arrowX = cx + r * Math.cos(rad(arrowAngle));
  const arrowY = cy + r * Math.sin(rad(arrowAngle));
  // Arrow direction: tangent to circle at that point (perpendicular to radius, clockwise)
  const tangentAngle = arrowAngle + 90;
  const aLen = 4;
  const aSpread = 2.5;
  const tipX = arrowX + aLen * Math.cos(rad(tangentAngle));
  const tipY = arrowY + aLen * Math.sin(rad(tangentAngle));
  const backAngle1 = tangentAngle + 150;
  const backAngle2 = tangentAngle - 150;
  const b1x = tipX + aSpread * Math.cos(rad(backAngle1));
  const b1y = tipY + aSpread * Math.sin(rad(backAngle1));
  const b2x = tipX + aSpread * Math.cos(rad(backAngle2));
  const b2y = tipY + aSpread * Math.sin(rad(backAngle2));

  return `
    <svg class="logo" viewBox="0 0 220 44" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Equal Play">
      <!-- Rotation mark: 4 player nodes connected by arc segments -->
      <g>
        <!-- Arc segments (blue) -->
        <path d="${arcBetween(nodes[0], nodes[1])}" fill="none" stroke="#2563eb" stroke-width="2.5" stroke-linecap="round"/>
        <path d="${arcBetween(nodes[1], nodes[2])}" fill="none" stroke="#2563eb" stroke-width="2.5" stroke-linecap="round"/>
        <path d="${arcBetween(nodes[2], nodes[3])}" fill="none" stroke="#2563eb" stroke-width="2.5" stroke-linecap="round"/>
        <path d="${arcBetween(nodes[3], nodes[0])}" fill="none" stroke="#2563eb" stroke-width="2.5" stroke-linecap="round"/>

        <!-- Direction arrow -->
        <polygon points="${tipX.toFixed(1)},${tipY.toFixed(1)} ${b1x.toFixed(1)},${b1y.toFixed(1)} ${b2x.toFixed(1)},${b2y.toFixed(1)}" fill="#2563eb"/>

        <!-- Player nodes: 3 blue, 1 green (active) -->
        <circle cx="${nodes[0].x.toFixed(1)}" cy="${nodes[0].y.toFixed(1)}" r="${nodeR}" fill="#16a34a"/>
        <circle cx="${nodes[1].x.toFixed(1)}" cy="${nodes[1].y.toFixed(1)}" r="${nodeR}" fill="#2563eb"/>
        <circle cx="${nodes[2].x.toFixed(1)}" cy="${nodes[2].y.toFixed(1)}" r="${nodeR}" fill="#2563eb"/>
        <circle cx="${nodes[3].x.toFixed(1)}" cy="${nodes[3].y.toFixed(1)}" r="${nodeR}" fill="#2563eb"/>
      </g>

      <!-- Wordmark -->
      <text x="46" y="30" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="800" fill="#0f172a" letter-spacing="-0.5">Equal</text>
      <text x="120" y="30" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="800" fill="#2563eb" letter-spacing="-0.5">Play</text>
    </svg>
  `;
}
