// src/gen-emptyset.ts
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { randomUUID } from "node:crypto";

/**
 * Usage:
 *   npx tsx src/gen-emptyset.ts ./emptyset_svg [--set=precise|legacy|all] [--label="Empty set symbol"]
 *                          [--preset=inter|sf|helvetica]
 *                          [--angle=-35] [--edge-gap=6] [--slash-stroke=12]
 *                          [--radius-bold=32] [--ring-outer=38] [--ring-inner=24]
 *
 * Notes:
 * - Stroke-based variants get vector-effect="non-scaling-stroke".
 * - Filled variants stay as-is (no vector-effect).
 * - SVGs inherit color via `currentColor`.
 *
 * Flags affect the **precise** set (U+2205-like interior slash) only.
 */

const OUT_DIR = process.argv[2] ?? "emptyset_svg";
const ARG_SET = getArg("--set") ?? "precise"; // precise | legacy | all
const ARG_LABEL = getArg("--label") ?? "Empty set symbol";
const ARG_PRESET = (getArg("--preset") ?? "").toLowerCase(); // inter | sf | helvetica

// Numeric overrides
const ARG_ANGLE = getNum("--angle");
const ARG_EDGE_GAP = getNum("--edge-gap");
const ARG_SLASH_STROKE = getNum("--slash-stroke");
const ARG_RADIUS_BOLD = getNum("--radius-bold");
const ARG_RING_OUTER = getNum("--ring-outer");
const ARG_RING_INNER = getNum("--ring-inner");

function getArg(flag: string): string | undefined {
  const match = process.argv.find((a) => a.startsWith(flag + "="));
  return match?.split("=")[1];
}
function getNum(flag: string): number | undefined {
  const v = getArg(flag);
  if (v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
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
// PRECISE (U+2205-like) configuration via presets + overrides
// ────────────────────────────────────────────────────────────────────────────────

type PreciseConfig = {
  cx: number;
  cy: number;
  circleStroke: number; // outline thickness for bold
  radiusBold: number; // circle radius (stroke outline)
  slashStroke: number; // slash thickness
  edgeGap: number; // distance from outer edge to slash ends
  angle: number; // degrees (negative tilts up-left to down-right)
  ringOuter: number; // filled ring outer radius
  ringInner: number; // filled ring inner radius
  knockGap: number; // gap from ring outer edge to ends of knock-out
  knockRadius: number; // rounded ends radius for knock-out
};

// Presets approximate the look of ∅ in common UI fonts (fine-tune as you like).
const PRESETS: Record<string, Partial<PreciseConfig>> = {
  // Inter tends to a slightly steeper slash and a clean modern weight
  inter: { angle: -35, slashStroke: 12, edgeGap: 6 },
  // SF Pro (San Francisco) is a touch less steep, slightly lighter appearance
  sf: { angle: -33, slashStroke: 11, edgeGap: 6 },
  // Helvetica often appears a hair more conservative/shallower angle
  helvetica: { angle: -30, slashStroke: 11, edgeGap: 7 },
};

function resolvePreciseConfig(): PreciseConfig {
  const base: PreciseConfig = {
    cx: 50,
    cy: 50,
    circleStroke: 14,
    radiusBold: 32,
    slashStroke: 12,
    edgeGap: 6,
    angle: -35,
    ringOuter: 38,
    ringInner: 24,
    knockGap: 7,
    knockRadius: 6,
  };

  // Apply preset if any
  const preset = PRESETS[ARG_PRESET] ?? {};
  const merged: PreciseConfig = {
    ...base,
    ...preset,
  };

  // Apply explicit numeric overrides
  if (ARG_SLASH_STROKE !== undefined)
    merged.slashStroke = clamp(ARG_SLASH_STROKE, 4, 24);
  if (ARG_EDGE_GAP !== undefined) merged.edgeGap = clamp(ARG_EDGE_GAP, 2, 16);
  if (ARG_ANGLE !== undefined) merged.angle = clamp(ARG_ANGLE, -60, -10);
  if (ARG_RADIUS_BOLD !== undefined)
    merged.radiusBold = clamp(ARG_RADIUS_BOLD, 20, 46);
  if (ARG_RING_OUTER !== undefined)
    merged.ringOuter = clamp(ARG_RING_OUTER, 26, 48);
  if (ARG_RING_INNER !== undefined)
    merged.ringInner = clamp(ARG_RING_INNER, 14, merged.ringOuter - 6);

  // Keep ring thickness vaguely close to circleStroke by default
  // knockGap should be a little larger than edgeGap (visual breathing room)
  merged.knockGap = Math.max(merged.edgeGap + 1, 5);

  return merged;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/** compute interior slash length so it stays inside the circle */
function slashLengthFor(
  radius: number,
  stroke: number,
  edgeGap: number
): number {
  const safeRadius = radius - (edgeGap + stroke / 2);
  return Math.max(0, 2 * safeRadius);
}

// ────────────────────────────────────────────────────────────────────────────────
// PRECISE variants (affected by flags)
// ────────────────────────────────────────────────────────────────────────────────

function precise_emptyset_bold(cfg: PreciseConfig): string {
  const L = slashLengthFor(cfg.radiusBold, cfg.slashStroke, cfg.edgeGap);
  return xml(
    wrap100(
      [
        `<!-- U+2205-inspired bold: interior slash with rounded ends, no edge contact -->`,
        strokeGroupOpen(),
        `  <circle cx="${cfg.cx}" cy="${cfg.cy}" r="${cfg.radiusBold}" stroke-width="${cfg.circleStroke}"/>`,
        `  <g transform="rotate(${cfg.angle} ${cfg.cx} ${cfg.cy})">`,
        `    <line x1="${cfg.cx - L / 2}" y1="${cfg.cy}" x2="${
          cfg.cx + L / 2
        }" y2="${cfg.cy}" stroke-width="${cfg.slashStroke}"/>`,
        `  </g>`,
        strokeGroupClose,
      ].join("\n")
    )
  );
}

function precise_emptyset_filled_outline(cfg: PreciseConfig): string {
  const maskId = `cut-${randomUUID()}`; // unique per render
  const knockLength = 2 * (cfg.ringOuter - cfg.knockGap);

  return xml(
    wrap100(
      [
        `<!-- Solid ring with an interior knocked-out slash (no edge contact) -->`,
        `<defs>`,
        `  <mask id="${maskId}">`,
        `    <rect x="0" y="0" width="100" height="100" fill="white"/>`,
        `    <g transform="rotate(${cfg.angle} ${cfg.cx} ${cfg.cy})">`,
        `      <rect x="${cfg.cx - knockLength / 2}" y="${
          cfg.cy - cfg.slashStroke / 2
        }" width="${knockLength}" height="${cfg.slashStroke}" rx="${
          cfg.knockRadius
        }" ry="${cfg.knockRadius}" fill="black"/>`,
        `    </g>`,
        `  </mask>`,
        `</defs>`,
        // Intentionally **no** vector-effect here (it's a filled path)
        `<g fill="currentColor" mask="url(#${maskId})">`,
        `  <path d="`,
        `    M ${cfg.cx},${cfg.cy - cfg.ringOuter}`,
        `    a ${cfg.ringOuter},${cfg.ringOuter} 0 1 1 0,${2 * cfg.ringOuter}`,
        `    a ${cfg.ringOuter},${cfg.ringOuter} 0 1 1 0,${-2 * cfg.ringOuter}`,
        `    M ${cfg.cx},${cfg.cy - cfg.ringInner}`,
        `    a ${cfg.ringInner},${cfg.ringInner} 0 1 0 0,${2 * cfg.ringInner}`,
        `    a ${cfg.ringInner},${cfg.ringInner} 0 1 0 0,${
          -2 * cfg.ringInner
        }" fill-rule="evenodd"/>`,
        `</g>`,
      ].join("\n")
    )
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// LEGACY variants (stroke ones have non-scaling strokes; not affected by flags)
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

function readmePrecise(cfg: PreciseConfig): string {
  return `Empty Set (∅) – Unicode U+2205-aligned
=========================================
- Stroke variant: interior diagonal with rounded ends; does NOT touch the ring.
- Filled variant: solid ring with interior knocked-out slash.
- Angle ≈ ${Math.abs(cfg.angle)}°, edge gap ${cfg.edgeGap}, slash stroke ${
    cfg.slashStroke
  }.
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
- emptyset_bold_legacy.svg — heavier stroke.
- emptyset_tilted.svg — rotated slash.
- emptyset_filled_outline_legacy.svg — solid ring with knocked-out slash (mask).
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
    const cfg = resolvePreciseConfig();
    files = {
      ...files,
      "emptyset_bold.svg": precise_emptyset_bold(cfg),
      "emptyset_filled_outline.svg": precise_emptyset_filled_outline(cfg),
      "README-precise.txt": readmePrecise(cfg),
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
