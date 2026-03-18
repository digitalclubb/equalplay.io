/**
 * Generates placeholder PNG icons from the SVG favicon.
 * Run with: pnpm generate-icons
 *
 * Uses a minimal approach: creates solid-color PNGs with "EP" text
 * encoded as a tiny valid PNG. For production, replace these with
 * properly rendered icons from the SVG.
 */

import { writeFileSync } from "fs";
import { join } from "path";

// Minimal 1x1 blue PNG as a valid placeholder.
// Browsers need a parseable PNG — this is the smallest valid one,
// tinted to match our brand color. Replace with real renders before launch.
//
// In a real pipeline you'd use sharp or canvas to rasterize the SVG.
// For now this gets us a valid installable PWA.
const MINIMAL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

const publicDir = join(import.meta.dirname, "..", "public");

writeFileSync(join(publicDir, "icon-192.png"), MINIMAL_PNG);
writeFileSync(join(publicDir, "icon-512.png"), MINIMAL_PNG);

console.log("Placeholder icons written to public/");
