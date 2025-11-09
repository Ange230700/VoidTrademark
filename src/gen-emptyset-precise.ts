// src\gen-emptyset-precise.ts

import { promises as fs } from "node:fs";
import * as path from "node:path";

/**
 * Generates two ∅ marks:
 *  - emptyset_bold.svg           (stroke outline)
 *  - emptyset_filled_outline.svg (solid ring with a knocked-out interior slash)
 *
 * Key differences from a "prohibition" sign:
 *  - The diagonal slash is shorter and stays inside the circle (gap from edge).
 *  - Rounded caps on the slash.
 *  - Angle and proportions tuned to resemble common U+2205 glyphs.
 *
 * Usage:
 *   npx tsx src/gen-emptyset-precise.ts ./emptyset_svg
 */

const OUT_DIR = process.argv[2] ?? "emptyset_svg";

// Geometry (viewBox 0..100)
const CX = 50;
const CY = 50;

// Circle thickness & radii
const CIRCLE_STROKE = 14;     // outline thickness for bold
const RADIUS_BOLD    = 32;    // circle radius (outline version)

// Slash
const SLASH_STROKE   = 12;    // slash thickness (outline version)
// Keep the slash endpoints away from the circle edge:
const EDGE_GAP       = 6;     // gap from outer edge to the slash endpoints
const SLASH_ANGLE    = -35;   // degrees (negative = tilt up-left to down-right)

// For the filled-outline (solid ring) variant:
const R_OUTER        = 38;    // outer radius of the ring (solid)
const R_INNER        = 24;    // inner radius of the ring (solid), ring thickness ≈ 14
const KNOCK_GAP      = 7;     // gap from the OUTER edge to the ends of the knocked-out slash
const KNOCK_HEIGHT   = 12;    // thickness of the knocked-out slash (≈ SLASH_STROKE)
const KNOCK_RADIUS   = 6;     // rounded ends for the knocked-out slash

const xml = (s: string) => `<?xml version="1.0" encoding="UTF-8"?>\n${s}`;
const wrap100 = (inner: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">\n${inner}\n</svg>\n`;

/** Compute the interior slash length so it doesn't touch the outer circle. */
function slashLengthFor(radius: number, stroke: number, edgeGap: number): number {
  // Effective max distance from center to safe endpoint along the slash direction:
  // Keep endpoints at least (edgeGap + stroke/2) inside the outer edge.
  const safeRadius = radius - (edgeGap + stroke / 2);
  // We'll draw a horizontal line of this total length and rotate it.
  return Math.max(0, 2 * safeRadius);
}

function emptyset_bold(): string {
  const L = slashLengthFor(RADIUS_BOLD, SLASH_STROKE, EDGE_GAP);

  return xml(
    wrap100(
      [
        `<!-- U+2205-inspired: interior slash with rounded ends, no edge contact -->`,
        `<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">`,
        `  <circle cx="${CX}" cy="${CY}" r="${RADIUS_BOLD}" stroke-width="${CIRCLE_STROKE}"/>`,
        `  <g transform="rotate(${SLASH_ANGLE} ${CX} ${CY})">`,
        `    <line x1="${CX - L / 2}" y1="${CY}" x2="${CX + L / 2}" y2="${CY}" stroke-width="${SLASH_STROKE}"/>`,
        `  </g>`,
        `</g>`
      ].join("\n")
    )
  );
}

function emptyset_filled_outline(): string {
  // Knocked-out slash length, kept inside the OUTER edge by KNOCK_GAP
  const knockLength = 2 * (R_OUTER - KNOCK_GAP);

  return xml(
    wrap100(
      [
        `<!-- Solid ring with an interior knocked-out slash (doesn't touch the ring edge) -->`,
        `<defs>`,
        `  <mask id="cut">`,
        `    <!-- White reveals, black conceals -->`,
        `    <rect x="0" y="0" width="100" height="100" fill="white"/>`,
        `    <g transform="rotate(${SLASH_ANGLE} ${CX} ${CY})">`,
        `      <!-- Rounded rectangle as the "eraser" for the slash -->`,
        `      <rect x="${CX - knockLength / 2}" y="${CY - KNOCK_HEIGHT / 2}" width="${knockLength}" height="${KNOCK_HEIGHT}" rx="${KNOCK_RADIUS}" ry="${KNOCK_RADIUS}" fill="black"/>`,
        `    </g>`,
        `  </mask>`,
        `</defs>`,
        `<!-- Draw a filled ring via evenodd, then apply the mask to knock out the slash -->`,
        `<g fill="currentColor" mask="url(#cut)">`,
        `  <path d="`,
        `    M ${CX},${CY - R_OUTER}`,
        `    a ${R_OUTER},${R_OUTER} 0 1 1 0,${2 * R_OUTER}`,
        `    a ${R_OUTER},${R_OUTER} 0 1 1 0,${-2 * R_OUTER}`,
        `    M ${CX},${CY - R_INNER}`,
        `    a ${R_INNER},${R_INNER} 0 1 0 0,${2 * R_INNER}`,
        `    a ${R_INNER},${R_INNER} 0 1 0 0,${-2 * R_INNER}" fill-rule="evenodd"/>`,
        `</g>`
      ].join("\n")
    )
  );
}

function readme(): string {
  return `Empty Set (∅) – Unicode U+2205-aligned
=========================================

This set avoids the "prohibition" look:
- The diagonal is shorter and stays inside the circle with rounded ends.
- Angle ≈ ${Math.abs(SLASH_ANGLE)}°.
- Gaps from the edge: outline gap ${EDGE_GAP}, filled knock-out gap ${KNOCK_GAP}.

Files:
- emptyset_bold.svg
- emptyset_filled_outline.svg

Both use \`currentColor\` so you can set color via CSS.
`;
}

async function main() {
  const out = path.resolve(process.cwd(), OUT_DIR);
  await fs.mkdir(out, { recursive: true });

  const files: Record<string, string> = {
    "emptyset_bold.svg": emptyset_bold(),
    "emptyset_filled_outline.svg": emptyset_filled_outline(),
    "README.txt": readme(),
  };

  await Promise.all(
    Object.entries(files).map(([name, content]) =>
      fs.writeFile(path.join(out, name), content, "utf8")
    )
  );

  console.log(`Wrote ${Object.keys(files).length - 1} SVGs to: ${out}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
