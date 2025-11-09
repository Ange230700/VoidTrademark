// src/gen-emptyset.ts
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { randomUUID } from "node:crypto";

/**
 * Usage:
 *   npx tsx src/gen-emptyset.ts ./emptyset_svg [--set=precise|legacy|all] [--label="Empty set symbol"]
 *
 * Sets:
 *   - precise (default): U+2205-like interior slash only:
 *       emptyset_bold.svg (stroke, interior slash)
 *       emptyset_filled_outline.svg (solid ring with knocked-out interior slash)
 *   - legacy: your original full set (basic, round, bold, tilted, filled, monogram)
 *   - all: precise + legacy
 *
 * Notes:
 * - Stroke-based variants get vector-effect="non-scaling-stroke".
 * - Filled variants stay as-is (no vector-effect).
 * - SVGs inherit color via `currentColor`.
 */

const OUT_DIR = process.argv[2] ?? "emptyset_svg";
const ARG_SET = getArg("--set") ?? "precise"; // precise | legacy | all
const ARG_LABEL = getArg("--label") ?? "Empty set symbol";

function getArg(flag: string): string | undefined {
  const match = process.argv.find((a) => a.startsWith(flag + "="));
  return match?.split("=")[1];
}

// ────────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ────────────────────────────────────────────────────────────────────────────────

const xml = (s: string) => `<?xml version="1.0" encoding="UTF-8"?>\n${s}`;

const wrap100 = (inner: string, label = ARG_LABEL) =>
  `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${label}" viewBox="0 0 100 100">\n${inner}\n</svg>\n`;

const wrap120 = (inner: string, label = ARG_LABEL) =>
  `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${label}" viewBox="0 0 120 120">\n${inner}\n</svg>\n`;

/** Stroke group with non-scaling strokes baked in */
const strokeGroupOpen = (extra: string = "") =>
  `<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" ${extra}>`;
const strokeGroupClose = `</g>`;

// Geometry defaults (legacy set)
const STROKES = {
  basic: 8,
  round: 10,
  bold: 14,
  tilted: 10,
  monogram: 10,
} as const;

const SIZES = {
  circleR_basic: 34,
  circleR_round: 33,
  circleR_bold: 30,
  circleR_tilted: 33,
  circleR_monogram: 35, // on a 120x120 canvas
} as const;

// ────────────────────────────────────────────────────────────────────────────────
/** PRECISE (U+2205-like) variants: interior slash, rounded ends, no edge contact */
// ────────────────────────────────────────────────────────────────────────────────

const CX = 50,
  CY = 50;

// Outline (stroke) circle
const RADIUS_BOLD = 32;
const CIRCLE_STROKE = 14;

// Slash geometry
const SLASH_STROKE = 12;
const EDGE_GAP = 6;
const SLASH_ANGLE = -35;

// Filled ring
const R_OUTER = 38;
const R_INNER = 24;
const KNOCK_GAP = 7;
const KNOCK_HEIGHT = 12;
const KNOCK_RADIUS = 6;

/** compute interior slash length so it stays inside the circle */
function slashLengthFor(
  radius: number,
  stroke: number,
  edgeGap: number
): number {
  const safeRadius = radius - (edgeGap + stroke / 2);
  return Math.max(0, 2 * safeRadius);
}

function precise_emptyset_bold(): string {
  const L = slashLengthFor(RADIUS_BOLD, SLASH_STROKE, EDGE_GAP);
  return xml(
    wrap100(
      [
        `<!-- U+2205-inspired bold: interior slash with rounded ends, no edge contact -->`,
        strokeGroupOpen(),
        `  <circle cx="${CX}" cy="${CY}" r="${RADIUS_BOLD}" stroke-width="${CIRCLE_STROKE}"/>`,
        `  <g transform="rotate(${SLASH_ANGLE} ${CX} ${CY})">`,
        `    <line x1="${CX - L / 2}" y1="${CY}" x2="${
          CX + L / 2
        }" y2="${CY}" stroke-width="${SLASH_STROKE}"/>`,
        `  </g>`,
        strokeGroupClose,
      ].join("\n")
    )
  );
}

function precise_emptyset_filled_outline(): string {
  const maskId = `cut-${randomUUID()}`; // unique per render
  const knockLength = 2 * (R_OUTER - KNOCK_GAP);

  return xml(
    wrap100(
      [
        `<!-- Solid ring with an interior knocked-out slash (no edge contact) -->`,
        `<defs>`,
        `  <mask id="${maskId}">`,
        `    <rect x="0" y="0" width="100" height="100" fill="white"/>`,
        `    <g transform="rotate(${SLASH_ANGLE} ${CX} ${CY})">`,
        `      <rect x="${CX - knockLength / 2}" y="${
          CY - KNOCK_HEIGHT / 2
        }" width="${knockLength}" height="${KNOCK_HEIGHT}" rx="${KNOCK_RADIUS}" ry="${KNOCK_RADIUS}" fill="black"/>`,
        `    </g>`,
        `  </mask>`,
        `</defs>`,
        // Intentionally **no** vector-effect here (it's a filled path)
        `<g fill="currentColor" mask="url(#${maskId})">`,
        `  <path d="`,
        `    M ${CX},${CY - R_OUTER}`,
        `    a ${R_OUTER},${R_OUTER} 0 1 1 0,${2 * R_OUTER}`,
        `    a ${R_OUTER},${R_OUTER} 0 1 1 0,${-2 * R_OUTER}`,
        `    M ${CX},${CY - R_INNER}`,
        `    a ${R_INNER},${R_INNER} 0 1 0 0,${2 * R_INNER}`,
        `    a ${R_INNER},${R_INNER} 0 1 0 0,${
          -2 * R_INNER
        }" fill-rule="evenodd"/>`,
        `</g>`,
      ].join("\n")
    )
  );
}

// ────────────────────────────────────────────────────────────────────────────────
/** LEGACY variants (kept for completeness). Stroke-based ones get non-scaling strokes. */
// ────────────────────────────────────────────────────────────────────────────────

function legacy_emptyset_basic(): string {
  return xml(
    wrap100(
      [
        `  <!-- Legacy: circle + diagonal slash -->`,
        strokeGroupOpen(`stroke-width="${STROKES.basic}"`),
        `    <circle cx="50" cy="50" r="${SIZES.circleR_basic}"/>`,
        `    <line x1="28" y1="72" x2="72" y2="28" />`,
        strokeGroupClose,
      ].join("\n")
    )
  );
}

function legacy_emptyset_round(): string {
  return xml(
    wrap100(
      [
        `  <!-- Legacy: rounded caps/joins -->`,
        strokeGroupOpen(`stroke-width="${STROKES.round}"`),
        `    <circle cx="50" cy="50" r="${SIZES.circleR_round}"/>`,
        `    <line x1="26" y1="74" x2="74" y2="26"/>`,
        strokeGroupClose,
      ].join("\n")
    )
  );
}

function legacy_emptyset_bold(): string {
  return xml(
    wrap100(
      [
        `  <!-- Legacy: bold full-length diagonal -->`,
        strokeGroupOpen(`stroke-width="${STROKES.bold}"`),
        `    <circle cx="50" cy="50" r="${SIZES.circleR_bold}"/>`,
        `    <line x1="24" y1="76" x2="76" y2="24"/>`,
        strokeGroupClose,
      ].join("\n")
    )
  );
}

function legacy_emptyset_tilted(): string {
  return xml(
    wrap100(
      [
        `  <!-- Legacy: rotated line group -->`,
        strokeGroupOpen(`stroke-width="${STROKES.tilted}"`),
        `    <circle cx="50" cy="50" r="${SIZES.circleR_tilted}"/>`,
        `    <g transform="rotate(-40 50 50)">`,
        `      <line x1="20" y1="50" x2="80" y2="50"/>`,
        `    </g>`,
        strokeGroupClose,
      ].join("\n")
    )
  );
}

function legacy_emptyset_filled_outline(): string {
  const maskId = `cut-${randomUUID()}`;
  return xml(
    wrap100(
      [
        `  <!-- Legacy: solid ring with knockout slash -->`,
        `<defs>`,
        `  <mask id="${maskId}">`,
        `    <rect x="0" y="0" width="100" height="100" fill="white"/>`,
        `    <g transform="rotate(-45 50 50)">`,
        `      <rect x="15" y="45" width="70" height="10" rx="5" ry="5" fill="black"/>`,
        `    </g>`,
        `  </mask>`,
        `</defs>`,
        `<g fill="currentColor" mask="url(#${maskId})">`,
        `  <path d="M50,10 a40,40 0 1,1 0,80 a40,40 0 1,1 0,-80`,
        `           M50,22 a28,28 0 1,0 0,56 a28,28 0 1,0 0,-56" fill-rule="evenodd"/>`,
        `</g>`,
      ].join("\n")
    )
  );
}

function legacy_emptyset_monogram(): string {
  return xml(
    wrap120(
      [
        `  <!-- Legacy: monogram lockup on 120 box -->`,
        strokeGroupOpen(`stroke-width="${STROKES.monogram}"`),
        `    <circle cx="60" cy="50" r="${SIZES.circleR_monogram}"/>`,
        `    <line x1="34" y1="76" x2="86" y2="24"/>`,
        strokeGroupClose,
        `  <!-- Optional baseline for wordmark:`,
        `  <text x="60" y="108" font-size="18" text-anchor="middle" fill="currentColor" font-family="system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif">YourBrand</text> -->`,
      ].join("\n")
    )
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// README content per set
// ────────────────────────────────────────────────────────────────────────────────

function readmePrecise(): string {
  return `Empty Set (∅) – Unicode U+2205-aligned
=========================================
- Stroke variant: interior diagonal with rounded ends; does NOT touch the ring.
- Filled variant: solid ring with interior knocked-out slash.
- Angle ≈ ${Math.abs(SLASH_ANGLE)}°, gaps maintained to avoid prohibition look.
- Stroke groups use vector-effect="non-scaling-stroke".
Files:
- emptyset_bold.svg
- emptyset_filled_outline.svg
`;
}

function readmeLegacy(): string {
  return `Empty Set (∅) SVG Pack – Legacy Set
======================================
Variants:
- emptyset_basic.svg — circle + slash, balanced proportions.
- emptyset_round.svg — round caps/joins for a friendlier look.
- emptyset_bold.svg — heavier stroke.
- emptyset_tilted.svg — rotated slash.
- emptyset_filled_outline.svg — solid ring with knocked-out slash (mask).
- emptyset_monogram.svg — taller canvas for pairing with a wordmark.
Stroke-based variants include vector-effect="non-scaling-stroke".
`;
}

// ────────────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────────────

async function main() {
  const out = path.resolve(process.cwd(), OUT_DIR);
  await fs.mkdir(out, { recursive: true });

  let files: Record<string, string> = {};

  if (ARG_SET === "precise" || ARG_SET === "all") {
    files = {
      ...files,
      "emptyset_bold.svg": precise_emptyset_bold(),
      "emptyset_filled_outline.svg": precise_emptyset_filled_outline(),
      "README-precise.txt": readmePrecise(),
    };
  }

  if (ARG_SET === "legacy" || ARG_SET === "all") {
    files = {
      ...files,
      "emptyset_basic.svg": legacy_emptyset_basic(),
      "emptyset_round.svg": legacy_emptyset_round(),
      "emptyset_bold_legacy.svg": legacy_emptyset_bold(),
      "emptyset_tilted.svg": legacy_emptyset_tilted(),
      "emptyset_filled_outline_legacy.svg": legacy_emptyset_filled_outline(),
      "emptyset_monogram.svg": legacy_emptyset_monogram(),
      "README-legacy.txt": readmeLegacy(),
    };
  }

  await Promise.all(
    Object.entries(files).map(([name, content]) =>
      fs.writeFile(path.join(out, name), content, "utf8")
    )
  );

  console.log(`Wrote ${Object.keys(files).length} files to: ${out}`);
}

try {
  await main();
} catch (err) {
  console.error(err);
  process.exit(1);
}
