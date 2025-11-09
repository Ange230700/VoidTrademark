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

function emptyset_bold(): string {
  return xml(
    wrap100(
      [
        `  <!-- Bold, logo-friendly weight -->`,
        `  <g fill="none" stroke="currentColor" stroke-width="${STROKES.bold}" stroke-linecap="round" stroke-linejoin="round">`,
        `    <circle cx="50" cy="50" r="${SIZES.circleR_bold}"/>`,
        `    <line x1="24" y1="76" x2="76" y2="24"/>`,
        `  </g>`,
      ].join("\n")
    )
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
  return xml(
    wrap100(
      [
        `  <!-- Filled ring + negative slash (mask). Good for solid marks. -->`,
        `  <defs>`,
        `    <mask id="cut">`,
        `      <rect x="0" y="0" width="100" height="100" fill="white"/>`,
        `      <g transform="rotate(-45 50 50)">`,
        `        <rect x="15" y="45" width="70" height="10" rx="5" ry="5" fill="black"/>`,
        `      </g>`,
        `    </mask>`,
        `  </defs>`,
        `  <g fill="currentColor" mask="url(#cut)">`,
        `    <path d="M50,10 a40,40 0 1,1 0,80 a40,40 0 1,1 0,-80`,
        `             M50,22 a28,28 0 1,0 0,56 a28,28 0 1,0 0,-56" fill-rule="evenodd"/>`,
        `  </g>`,
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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
