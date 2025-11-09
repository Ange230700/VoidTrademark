// src\gen-emptyset.ts

import { promises as fs } from "node:fs";
import * as path from "node:path";

/**
 * Usage:
 *   npx tsx src/gen-emptyset.ts ./emptyset_svg
 *
 * Notes:
 * - SVGs use `currentColor` so you can recolor via CSS.
 * - Edit STROKES or SIZES below to tweak defaults.
 */

const OUT_DIR = process.argv[2] ?? "emptyset_svg";

const STROKES = {
  basic: 8,
  round: 10,
  bold: 14,
  tilted: 10,
  monogram: 10,
};

const SIZES = {
  circleR_basic: 34,
  circleR_round: 33,
  circleR_bold: 30,
  circleR_tilted: 33,
  circleR_monogram: 35, // on a 120x120 canvas
};

// Shared helpers for interior slash
const CX = 50, CY = 50;
const interiorSlash = (radius: number, stroke: number, edgeGap: number) => {
  const safeRadius = radius - (edgeGap + stroke / 2);
  const L = Math.max(0, 2 * safeRadius);
  return { L };
};

const xml = (s: string) => `<?xml version="1.0" encoding="UTF-8"?>\n${s}`;

// Helpers
const wrap100 = (inner: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">\n${inner}\n</svg>\n`;

const wrap120 = (inner: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">\n${inner}\n</svg>\n`;

// Variants
function emptyset_basic(): string {
  return xml(
    wrap100(
      [
        `  <!-- Basic empty set: circle + diagonal slash -->`,
        `  <g fill="none" stroke="currentColor" stroke-width="${STROKES.basic}">`,
        `    <circle cx="50" cy="50" r="${SIZES.circleR_basic}"/>`,
        `    <line x1="28" y1="72" x2="72" y2="28" stroke-linecap="round"/>`,
        `  </g>`,
      ].join("\n")
    )
  );
}

function emptyset_round(): string {
  return xml(
    wrap100(
      [
        `  <!-- Rounded stroke joins/caps for a friendlier look -->`,
        `  <g fill="none" stroke="currentColor" stroke-width="${STROKES.round}" stroke-linecap="round" stroke-linejoin="round">`,
        `    <circle cx="50" cy="50" r="${SIZES.circleR_round}"/>`,
        `    <line x1="26" y1="74" x2="74" y2="26"/>`,
        `  </g>`,
      ].join("\n")
    )
  );
}

// U+2205-like: interior slash (no edge contact)
function emptyset_bold(): string {
  const R = SIZES.circleR_bold;           // 30
  const strokeCircle = STROKES.bold;      // 14
  const strokeSlash = 12;                 // thicker slash
  const edgeGap = 6;                      // keep slash inside
  const angle = -35;

  const { L } = interiorSlash(R, strokeSlash, edgeGap);

  return xml(
    wrap100([
      `<!-- U+2205-inspired bold: interior slash with rounded ends -->`,
      `<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">`,
      `  <circle cx="${CX}" cy="${CY}" r="${R}" stroke-width="${strokeCircle}"/>`,
      `  <g transform="rotate(${angle} ${CX} ${CY})">`,
      `    <line x1="${CX - L/2}" y1="${CY}" x2="${CX + L/2}" y2="${CY}" stroke-width="${strokeSlash}"/>`,
      `  </g>`,
      `</g>`
    ].join("\n"))
  );
}

function emptyset_tilted(): string {
  return xml(
    wrap100(
      [
        `  <!-- Slightly increased tilt for distinction -->`,
        `  <g fill="none" stroke="currentColor" stroke-width="${STROKES.tilted}" stroke-linecap="round" stroke-linejoin="round">`,
        `    <circle cx="50" cy="50" r="${SIZES.circleR_tilted}"/>`,
        `    <g transform="rotate(-40 50 50)">`,
        `      <line x1="20" y1="50" x2="80" y2="50"/>`,
        `    </g>`,
        `  </g>`,
      ].join("\n")
    )
  );
}

function emptyset_filled_outline(): string {
  // Solid ring + interior knock-out slash
  const R_OUTER = 38,
    R_INNER = 24; // ring thickness ≈ 14
  const angle = -35;
  const knockGap = 7;
  const knockHeight = 12;
  const knockRadius = 6;
  const knockLength = 2 * (R_OUTER - knockGap);

  return xml(
    wrap100(
      [
        `<!-- U+2205-inspired solid ring with interior knocked-out slash -->`,
        `<defs>`,
        `  <mask id="cut">`,
        `    <rect x="0" y="0" width="100" height="100" fill="white"/>`,
        `    <g transform="rotate(${angle} ${CX} ${CY})">`,
        `      <rect x="${CX - knockLength / 2}" y="${
          CY - knockHeight / 2
        }" width="${knockLength}" height="${knockHeight}" rx="${knockRadius}" ry="${knockRadius}" fill="black"/>`,
        `    </g>`,
        `  </mask>`,
        `</defs>`,
        `<g fill="currentColor" mask="url(#cut)">`,
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

function emptyset_monogram(): string {
  return xml(
    wrap120(
      [
        `  <!-- Monogram lockup; taller canvas for optional wordmark baseline -->`,
        `  <g fill="none" stroke="currentColor" stroke-width="${STROKES.monogram}" stroke-linecap="round" stroke-linejoin="round">`,
        `    <circle cx="60" cy="50" r="${SIZES.circleR_monogram}"/>`,
        `    <line x1="34" y1="76" x2="86" y2="24"/>`,
        `  </g>`,
        `  <!-- Optional baseline for wordmark:`,
        `  <text x="60" y="108" font-size="18" text-anchor="middle" fill="currentColor" font-family="system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif">YourBrand</text> -->`,
      ].join("\n")
    )
  );
}

function readme(): string {
  return `Empty Set (∅) SVG Pack
========================

Files:
- emptyset_basic.svg — circle + slash, balanced proportions.
- emptyset_round.svg — round caps/joins for a friendlier look.
- emptyset_bold.svg — heavier stroke for small sizes / avatars.
- emptyset_tilted.svg — same idea with a stronger diagonal.
- emptyset_filled_outline.svg — solid ring with a knocked-out slash (mask).
- emptyset_monogram.svg — taller canvas for pairing with a wordmark.

Tips:
- SVGs use \`currentColor\`, so color can be controlled via CSS (e.g., \`color: #111\`).
- Scale using width/height; keep the \`viewBox\` as-is for crisp rendering.
- For trademark specimens, export a vector PDF with locked proportions/angles.
`;
}

async function main() {
  const out = path.resolve(process.cwd(), OUT_DIR);
  await fs.mkdir(out, { recursive: true });

  const files: Record<string, string> = {
    "emptyset_basic.svg": emptyset_basic(),
    "emptyset_round.svg": emptyset_round(),
    "emptyset_bold.svg": emptyset_bold(),
    "emptyset_tilted.svg": emptyset_tilted(),
    "emptyset_filled_outline.svg": emptyset_filled_outline(),
    "emptyset_monogram.svg": emptyset_monogram(),
    "README.txt": readme(),
  };

  await Promise.all(
    Object.entries(files).map(([name, content]) =>
      fs.writeFile(path.join(out, name), content, "utf8")
    )
  );

  console.log(`Wrote ${Object.keys(files).length - 1} SVGs to: ${out}`);
}

try {
  await main();
} catch (err) {
  console.error(err);
  process.exit(1);
}
