import { describe as group, it, expect } from "vitest";
import { DRILLS } from "../hub/content/drills.js";
import { describe, renderDiagram, type Diagram, type Point } from "../hub/content/diagram.js";
import type { Drill } from "../hub/content/types.js";

/**
 * What a diagram claims has to match what the drill says.
 *
 * A generated picture that shows seven cones for an eight cone drill, or puts
 * the scoring boxes somewhere the setup never mentioned, is worse than no
 * picture: it looks authoritative and it is wrong. A coach reading it on the
 * touchline has no way to tell. So the agreement between the drill text and the
 * diagram is checked here rather than left to whoever eyeballs the next one.
 */

const withDiagram = DRILLS.filter((d): d is Drill & { diagram: Diagram } => Boolean(d.diagram));

/** Pulls the metres out of a `space` string. "20 x 15 m" and "20 m channel" both work. */
function statedMetres(space: string): number[] {
  return [...space.matchAll(/(\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
}

function everyPoint(d: Diagram): Point[] {
  return [
    ...(d.cones ?? []),
    ...(d.attack ?? []),
    ...(d.defence ?? []),
    ...(d.shields ?? []),
    ...(d.ball ?? []),
    ...(d.runs ?? []).flatMap(([from, to]) => [from, to]),
    ...(d.passes ?? []).flatMap(([from, to]) => [from, to]),
  ];
}

group("drill diagrams", () => {
  it("has at least one to check", () => {
    expect(withDiagram.length).toBeGreaterThan(0);
  });

  it("uses the dimensions the drill states", () => {
    for (const drill of withDiagram) {
      const stated = statedMetres(drill.space);
      const drawn = drill.diagram.space;
      const complaint = `"${drill.title}" says ${drill.space} but the diagram is ${drawn.join(" x ")}`;
      // Orientation is the author's call, because "20 x 15 m" does not say which
      // number runs which way and every drill here runs up the page. Both
      // numbers still have to be the drill's, in one order or the other.
      if (stated.length === 2) {
        expect([...drawn].sort((a, b) => a - b), complaint).toEqual([...stated].sort((a, b) => a - b));
      } else {
        for (const metres of stated) expect(drawn, complaint).toContain(metres);
      }
    }
  });

  it("draws on a pitch with both sides bigger than nothing", () => {
    for (const drill of withDiagram) {
      for (const side of drill.diagram.space) {
        // A zero would divide through the projector and put NaN in every
        // coordinate, which renders as an empty box rather than an error.
        expect(side, `"${drill.title}" has a side of ${side} m`).toBeGreaterThan(0);
      }
    }
  });

  it("draws exactly as many cones as the kit list packs", () => {
    for (const drill of withDiagram) {
      const cones = drill.equipment.find((k) => k.item === "cone");
      // A per-player count scales with whoever turns up, so there is no fixed
      // number to draw. Only absolute counts are checked.
      if (!cones || cones.per) continue;
      expect(
        drill.diagram.cones?.length ?? 0,
        `"${drill.title}" packs ${cones.qty} cones but the diagram draws ${drill.diagram.cones?.length ?? 0}`,
      ).toBe(cones.qty);
    }
  });

  it("never draws a cone for a drill that needs none", () => {
    for (const drill of withDiagram) {
      if (drill.equipment.some((k) => k.item === "cone")) continue;
      expect(drill.diagram.cones ?? [], `"${drill.title}" has no cones in its kit`).toHaveLength(0);
    }
  });

  it("keeps everything inside the pitch", () => {
    for (const drill of withDiagram) {
      const [w, d] = drill.diagram.space;
      for (const [x, y] of everyPoint(drill.diagram)) {
        expect(x, `"${drill.title}" has a point at x ${x}, outside 0 to ${w}`).toBeGreaterThanOrEqual(0);
        expect(x, `"${drill.title}" has a point at x ${x}, outside 0 to ${w}`).toBeLessThanOrEqual(w);
        expect(y, `"${drill.title}" has a point at y ${y}, outside 0 to ${d}`).toBeGreaterThanOrEqual(0);
        expect(y, `"${drill.title}" has a point at y ${y}, outside 0 to ${d}`).toBeLessThanOrEqual(d);
      }
    }
  });

  it("never draws more players than the drill takes", () => {
    for (const drill of withDiagram) {
      const drawn =
        (drill.diagram.attack?.length ?? 0) +
        (drill.diagram.defence?.length ?? 0) +
        (drill.diagram.shields?.length ?? 0);
      expect(drawn, `"${drill.title}" draws nobody`).toBeGreaterThan(0);
      if (drill.players.max) {
        expect(
          drawn,
          `"${drill.title}" tops out at ${drill.players.max} players but the diagram draws ${drawn}`,
        ).toBeLessThanOrEqual(drill.players.max);
      }
    }
  });

  it("keeps a target area inside the pitch it sits in", () => {
    for (const drill of withDiagram) {
      const [w, d] = drill.diagram.space;
      for (const [corner, size] of drill.diagram.zones ?? []) {
        expect(size, `"${drill.title}" has a ${corner} zone of ${size} m`).toBeGreaterThan(0);
        expect(size).toBeLessThanOrEqual(Math.min(w, d) / 2);
      }
    }
  });
});

group("the diagram renderer", () => {
  it("produces a well formed svg for every diagram", () => {
    for (const drill of withDiagram) {
      const svg = renderDiagram(drill.diagram);
      expect(svg.startsWith("<svg"), `"${drill.title}"`).toBe(true);
      expect(svg.endsWith("</svg>"), `"${drill.title}"`).toBe(true);
      expect(svg, `"${drill.title}" rendered a NaN`).not.toContain("NaN");
      expect(svg, `"${drill.title}" rendered an undefined`).not.toContain("undefined");
    }
  });

  /**
   * The load-bearing one.
   *
   * `--color-navy` does not flip with the colour scheme and neither does a hex
   * baked into an SVG. Reaching for a fixed colour on a surface that does flip
   * is the mistake that has already shipped twice, once at 1.5:1 and once at
   * 1.12:1. One diagram has to serve both schemes, so everything structural is
   * `currentColor` and the only literal colour allowed is the primary.
   */
  it("uses no fixed colour but the primary", () => {
    for (const drill of withDiagram) {
      const colours = new Set(renderDiagram(drill.diagram).match(/#[0-9a-fA-F]{3,8}\b/g) ?? []);
      colours.delete("#cf3918");
      expect([...colours], `"${drill.title}" bakes in a colour that cannot flip`).toEqual([]);
    }
  });

  /**
   * A marker is addressed by id, so two diagrams sharing one is invalid markup
   * and the second arrowhead resolves to the first diagram's definition. It
   * costs nothing while a drill page renders one, and it breaks a catalogue
   * card grid, which is where these are headed.
   */
  it("gives every diagram on a page its own marker ids", () => {
    const page = withDiagram
      .slice(0, 5)
      .map((drill) => renderDiagram(drill.diagram))
      .join("");
    const ids = (page.match(/ id="[^"]+"/g) ?? []).map((one) => one.trim());
    expect(ids.length).toBeGreaterThan(2);
    expect(new Set(ids).size, `ids repeat across diagrams: ${ids.join(" ")}`).toBe(ids.length);
  });

  it("says what it shows for anyone who cannot see it", () => {
    for (const drill of withDiagram) {
      const said = describe(drill.diagram);
      expect(said.length, `"${drill.title}" describes itself as nothing`).toBeGreaterThan(10);
      expect(renderDiagram(drill.diagram)).toContain('role="img"');
      expect(renderDiagram(drill.diagram)).toContain("aria-label=");
    }
  });

  /**
   * A drill with no opposition in it must not be described as having any. Five
   * of these are pairs work or a relay, where "attackers against defenders"
   * would be a confident lie to the one reader who cannot check it against the
   * picture.
   */
  it("claims no contest that the drill does not have", () => {
    for (const drill of withDiagram) {
      expect(describe(drill.diagram), `"${drill.title}"`).not.toMatch(/against|defender|attacker/i);
    }
  });

  it("counts one of something as one", () => {
    const said = describe({ space: [10, 10], cones: [[1, 1]], shields: [[5, 5]] });
    expect(said).toContain("1 cone,");
    expect(said).toContain("1 shield holder");
    expect(said).not.toContain("1 cones");
    expect(said).not.toContain("1 shield holders");
  });

  it("mentions the passing when passing is all the picture shows", () => {
    const said = describe({ space: [10, 10], attack: [[2, 2]], passes: [[[2, 2], [8, 8]]] });
    expect(said).toContain("passes marked");
  });

  /**
   * A channel drawn on its end would otherwise be described with its width and
   * depth the other way round from the facts panel sitting beside it, giving a
   * sighted reader and a screen reader two different sets of numbers.
   */
  it("leaves the dimensions to the facts panel", () => {
    for (const drill of withDiagram) {
      if (drill.diagram.label) continue;
      expect(describe(drill.diagram), `"${drill.title}"`).not.toMatch(/\bmetre area\b/);
    }
  });

  it("escapes a label rather than letting it break the markup", () => {
    const svg = renderDiagram({ space: [10, 10], label: 'Ten by ten "grid" & a <cone>' });
    expect(svg).toContain("&quot;grid&quot;");
    expect(svg).toContain("&amp;");
    expect(svg).toContain("&lt;cone&gt;");
  });

  it("fits any shape of pitch into the same square", () => {
    for (const space of [
      [10, 10],
      [40, 20],
      [20, 40],
      [60, 43],
    ] as [number, number][]) {
      expect(renderDiagram({ space })).toContain('viewBox="0 0 280 280"');
    }
  });
});
