// ---- Drill diagrams ----
//
// A drill diagram is data, not a picture. Each drill describes where things
// stand in metres and this file turns that into SVG at render time.
//
// Shipping 100 SVG files would mean 100 precache entries and about 210 kB for
// something the bundle can build in two kilobytes. It would also put the part
// that has to stay consistent, meaning stroke weights, colours and marker
// sizes, into 100 places where it can drift. Here it lives once.
//
// Everything structural is `currentColor` so one diagram serves both colour
// schemes. The only fixed colour is the primary. It never carries text.
// `diagram.test.ts` enforces both of those.

import { esc } from "../../lib/esc.js";

/** A point on the pitch in metres. Origin is the far left corner, y runs towards the coach. */
export type Point = [x: number, y: number];

export type Corner = "tl" | "tr" | "bl" | "br";

export interface Diagram {
  /** Pitch size in metres, width by depth. Taken from the drill's `space`. */
  space: [width: number, depth: number];
  /** Shaded target areas, each a corner and how many metres square it is. */
  zones?: [corner: Corner, size: number][];
  /** Every cone. The count is checked against the drill's kit list. */
  cones?: Point[];
  /** The team in possession. */
  attack?: Point[];
  /** The team without it. Also used for anyone working alone. */
  defence?: Point[];
  /** Shield or pad holders, drawn as a bar rather than a disc. */
  shields?: Point[];
  /** Where people run. `bend` curves the line, in metres, negative the other way. */
  runs?: [from: Point, to: Point, bend?: number][];
  /** Where the ball goes. Drawn lighter than a run so the two read apart. */
  passes?: [from: Point, to: Point, bend?: number][];
  /** Loose balls, or the one being carried. */
  ball?: Point[];
  /** Overrides the generated description. Only worth writing when the default misleads. */
  label?: string;
}

// The whole visual language, in one place. Tuned at 280, 150 and 104 px wide:
// below about 100 px the running lines start to go and the cones merge into
// the grid corners, which is the floor rather than a target.
const BOX = 280;
const PAD = 16;
const STROKE = 2.4;
const CONE_R = 5.5;
const PLAYER_R = 9;
/* The token rather than the hex behind it. A diagram is drawn on a card that
   flips with the colour scheme, so the one literal colour left in here was the
   very thing the rest of the file avoids: the brand red is the dark end of the
   ramp and all but disappeared behind a 0.22 opacity zone on a dark panel. */
const PRIMARY = "var(--color-primary)";

// Arrowheads are markers. A marker is addressed by id, so two diagrams on one
// page sharing an id is invalid markup. Each render takes its own. Not
// visible while a drill page shows one diagram; it lands the moment a catalogue
// card carries one too, which is the whole point of drawing them.
let sequence = 0;

/** Maps metres onto the viewBox. Always square so a card grid stays even. */
function projector(space: [number, number]) {
  const [w, d] = space;
  const scale = Math.min((BOX - PAD * 2) / w, (BOX - PAD * 2) / d);
  const offsetX = (BOX - w * scale) / 2;
  const offsetY = (BOX - d * scale) / 2;
  return {
    scale,
    x: (m: number) => offsetX + m * scale,
    y: (m: number) => offsetY + m * scale,
    rect: { x: offsetX, y: offsetY, w: w * scale, h: d * scale },
  };
}

function round(n: number): string {
  return (Math.round(n * 10) / 10).toString();
}

/** A quadratic through a control point offset square to the line of travel. */
function curve(p: ReturnType<typeof projector>, from: Point, to: Point, bend = 0): string {
  const x1 = p.x(from[0]);
  const y1 = p.y(from[1]);
  const x2 = p.x(to[0]);
  const y2 = p.y(to[1]);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const cx = (x1 + x2) / 2 + (-dy / len) * bend * p.scale;
  const cy = (y1 + y2) / 2 + (dx / len) * bend * p.scale;
  return `M${round(x1)} ${round(y1)}Q${round(cx)} ${round(cy)} ${round(x2)} ${round(y2)}`;
}

function zoneRect(p: ReturnType<typeof projector>, space: [number, number], zone: [Corner, number]) {
  const [corner, size] = zone;
  const [w, d] = space;
  const left = corner === "tl" || corner === "bl";
  const top = corner === "tl" || corner === "tr";
  return {
    x: p.x(left ? 0 : w - size),
    y: p.y(top ? 0 : d - size),
    w: size * p.scale,
    h: size * p.scale,
    left,
    top,
  };
}

/** "1 cone", "8 cones". Every count here can legitimately be one. */
function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

/**
 * Says what the diagram shows for anyone who cannot see it. Generated rather
 * than written 100 times, because a description that drifts from the picture is
 * worse than a plain one that cannot.
 */
export function describe(d: Diagram): string {
  if (d.label) return d.label;
  const parts: string[] = [];
  if (d.zones?.length) {
    parts.push(d.zones.length === 1 ? "a target area in one corner" : `${d.zones.length} target areas`);
  }
  if (d.cones?.length) parts.push(count(d.cones.length, "cone"));
  // Says which colour is which rather than naming a contest. Half these drills
  // have no opposition in them, so "attackers against defenders" would be a
  // confident lie on a pairs drill or a relay. A drill the wording still
  // misreads sets its own `label`.
  if (d.attack?.length && d.defence?.length) {
    parts.push(`${count(d.attack.length, "player")} with the ball, ${d.defence.length} without`);
  } else if (d.attack?.length) {
    parts.push(count(d.attack.length, "player") + " with the ball");
  } else if (d.defence?.length) {
    parts.push(count(d.defence.length, "player"));
  }
  if (d.shields?.length) parts.push(count(d.shields.length, "shield holder"));
  if (d.passes?.length) parts.push("passes marked");
  if (d.runs?.length) parts.push("running lines marked");
  // The drill's own facts panel states the space. A diagram is free to turn a
  // channel on its end, so repeating the dimensions here would only give a
  // screen reader a second set of numbers to disagree with.
  return parts.length ? `Set up diagram. ${parts.join(", ")}.` : "Set up diagram.";
}

/**
 * Builds the diagram as inline SVG. Safe to drop straight into innerHTML.
 *
 * `decorative` drops the description and hides the whole thing from assistive
 * technology. That is right on a catalogue card, where the drill's title is
 * already a link saying what it is and reading a hundred set up descriptions
 * out in a row would bury it. On a drill page the diagram is the only place
 * some of that information appears, so there it keeps its label.
 */
export function renderDiagram(d: Diagram, options: { decorative?: boolean } = {}): string {
  const p = projector(d.space);
  const uid = `dg${(sequence += 1)}`;
  const out: string[] = [];

  for (const zone of d.zones ?? []) {
    const r = zoneRect(p, d.space, zone);
    out.push(
      `<rect x="${round(r.x)}" y="${round(r.y)}" width="${round(r.w)}" height="${round(r.h)}" fill="${PRIMARY}" opacity="0.22"/>`,
    );
    // Only the two edges inside the pitch. Tracing all four would double up on
    // the grid line and make the corner look like a smudge at card size.
    const vx = round(r.left ? r.x + r.w : r.x);
    const hy = round(r.top ? r.y + r.h : r.y);
    out.push(
      `<path d="M${vx} ${round(r.top ? r.y : r.y + r.h)}V${hy}H${round(r.left ? r.x : r.x + r.w)}" fill="none" stroke="${PRIMARY}" stroke-width="${STROKE}" stroke-dasharray="5 4" stroke-linecap="round"/>`,
    );
  }

  out.push(
    `<rect x="${round(p.rect.x)}" y="${round(p.rect.y)}" width="${round(p.rect.w)}" height="${round(p.rect.h)}" fill="none" stroke="currentColor" stroke-width="${STROKE}" opacity="0.55"/>`,
  );

  if (d.cones?.length) {
    const discs = d.cones
      .map(([x, y]) => `<circle cx="${round(p.x(x))}" cy="${round(p.y(y))}" r="${CONE_R}"/>`)
      .join("");
    out.push(`<g fill="currentColor" opacity="0.8">${discs}</g>`);
  }

  if (d.shields?.length) {
    const bars = d.shields
      .map(
        ([x, y]) =>
          `<rect x="${round(p.x(x) - 13)}" y="${round(p.y(y) - 4.5)}" width="26" height="9" rx="3"/>`,
      )
      .join("");
    out.push(`<g fill="currentColor" opacity="0.72">${bars}</g>`);
  }

  if (d.passes?.length) {
    const lines = d.passes.map(([f, t, b]) => `<path d="${curve(p, f, t, b)}"/>`).join("");
    out.push(
      `<g fill="none" stroke="${PRIMARY}" stroke-width="${STROKE}" stroke-dasharray="2 5" stroke-linecap="round" marker-end="url(#${uid}-pass)">${lines}</g>`,
    );
  }

  if (d.runs?.length) {
    const lines = d.runs.map(([f, t, b]) => `<path d="${curve(p, f, t, b)}"/>`).join("");
    out.push(
      `<g fill="none" stroke="currentColor" stroke-width="${STROKE}" stroke-dasharray="7 5.5" stroke-linecap="round" opacity="0.5" marker-end="url(#${uid}-run)">${lines}</g>`,
    );
  }

  if (d.defence?.length) {
    const dots = d.defence
      .map(([x, y]) => `<circle cx="${round(p.x(x))}" cy="${round(p.y(y))}" r="${PLAYER_R}"/>`)
      .join("");
    out.push(`<g fill="currentColor">${dots}</g>`);
  }

  if (d.attack?.length) {
    const dots = d.attack
      .map(([x, y]) => `<circle cx="${round(p.x(x))}" cy="${round(p.y(y))}" r="${PLAYER_R}"/>`)
      .join("");
    out.push(`<g fill="${PRIMARY}">${dots}</g>`);
  }

  for (const [x, y] of d.ball ?? []) {
    const cx = round(p.x(x));
    const cy = round(p.y(y));
    out.push(
      `<ellipse cx="${cx}" cy="${cy}" rx="9" ry="5.6" fill="none" stroke="currentColor" stroke-width="${STROKE}" transform="rotate(-22 ${cx} ${cy})"/>`,
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BOX} ${BOX}" class="drill-diagram" ${options.decorative ? 'aria-hidden="true" focusable="false"' : `role="img" aria-label="${esc(describe(d))}"`}><defs><marker id="${uid}-run" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="4.2" markerHeight="4.2" orient="auto"><path d="M0 1.5 9.2 5 0 8.5Z" fill="currentColor"/></marker><marker id="${uid}-pass" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="4.2" markerHeight="4.2" orient="auto"><path d="M0 1.5 9.2 5 0 8.5Z" fill="${PRIMARY}"/></marker></defs>${out.join("")}</svg>`;
}
