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
 *                          [--overshoot=6]
 *
 * Notes:
 * - Stroke-based variants get vector-effect="non-scaling-stroke" and now always **overshoot** the circle.
 * - Filled variants stay contained (their slash/knockout does **not** overshoot).
 * - SVGs inherit color via `currentColor`.
 *
 * Flags:
 *   - `--overshoot` applies to **all stroke** variants (precise + legacy).
 *   - other flags (`--angle`, `--edge-gap`, etc.) apply to the **precise** set.
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
const ARG_OVERSHOOT = getNum("--overshoot");

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
  overshoot: number; // how far the slash extends beyond radius (cut-through)
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
    overshoot: 6,
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
  if (ARG_OVERSHOOT !== undefined)
    merged.overshoot = clamp(ARG_OVERSHOOT, 0, 20);

  // Keep ring thickness vaguely close to circleStroke by default
  // knockGap should be a little larger than edgeGap (visual breathing room)
  merged.knockGap = Math.max(merged.edgeGap + 1, 5);

  return merged;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/** compute slash length that CUTS THROUGH the ring (extends past radius) */
function slashLengthCutThrough(radius: number, overshoot: number): number {
  return Math.max(0, 2 * (radius + overshoot));
}

// ────────────────────────────────────────────────────────────────────────────────
// PRECISE variants (affected by flags)
// ────────────────────────────────────────────────────────────────────────────────

function precise_emptyset_bold(cfg: PreciseConfig): string {
  // Cut-through: extend beyond circle radius by `overshoot`
  const L = slashLengthCutThrough(cfg.radiusBold, cfg.overshoot);
  return xml(
    wrap100(
      [
        `<!-- U+2205 cut-through: slash extends beyond the circle to intersect the ring -->`,
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
  // Contained: knockout stays within the ring (no overshoot)
  const knockLength = 2 * (cfg.ringOuter - cfg.knockGap);

  return xml(
    wrap100(
      [
        `<!-- Solid ring with an interior knocked-out slash (contained; no overshoot) -->`,
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
  const overshoot = clamp(ARG_OVERSHOOT ?? 6, 0, 20);
  const R = SIZES.circleR_basic;
  const L = slashLengthCutThrough(R, overshoot);
  return xml(
    wrap100(
      [
        `  <!-- Legacy: circle + diagonal slash (cut-through) -->`,
        strokeGroupOpen(`stroke-width="${STROKES.basic}"`),
        `    <circle cx="50" cy="50" r="${R}"/>`,
        `    <g transform="rotate(-45 50 50)">`,
        `      <line x1="${50 - L / 2}" y1="50" x2="${50 + L / 2}" y2="50"/>`,
        `    </g>`,
        strokeGroupClose,
      ].join("\n")
    )
  );
}
function legacy_emptyset_round(): string {
  const overshoot = clamp(ARG_OVERSHOOT ?? 6, 0, 20);
  const R = SIZES.circleR_round;
  const L = slashLengthCutThrough(R, overshoot);
  return xml(
    wrap100(
      [
        `  <!-- Legacy: rounded caps/joins (cut-through) -->`,
        strokeGroupOpen(`stroke-width="${STROKES.round}"`),
        `    <circle cx="50" cy="50" r="${R}"/>`,
        `    <g transform="rotate(-45 50 50)">`,
        `      <line x1="${50 - L / 2}" y1="50" x2="${50 + L / 2}" y2="50"/>`,
        `    </g>`,
        strokeGroupClose,
      ].join("\n")
    )
  );
}
function legacy_emptyset_bold(): string {
  const overshoot = clamp(ARG_OVERSHOOT ?? 6, 0, 20);
  const R = SIZES.circleR_bold;
  const L = slashLengthCutThrough(R, overshoot);
  return xml(
    wrap100(
      [
        `  <!-- Legacy: bold diagonal (cut-through) -->`,
        strokeGroupOpen(`stroke-width="${STROKES.bold}"`),
        `    <circle cx="50" cy="50" r="${R}"/>`,
        `    <g transform="rotate(-45 50 50)">`,
        `      <line x1="${50 - L / 2}" y1="50" x2="${50 + L / 2}" y2="50"/>`,
        `    </g>`,
        strokeGroupClose,
      ].join("\n")
    )
  );
}
function legacy_emptyset_tilted(): string {
  const overshoot = clamp(ARG_OVERSHOOT ?? 6, 0, 20);
  const R = SIZES.circleR_tilted;
  const L = slashLengthCutThrough(R, overshoot);
  return xml(
    wrap100(
      [
        `  <!-- Legacy: rotated line group (cut-through) -->`,
        strokeGroupOpen(`stroke-width="${STROKES.tilted}"`),
        `    <circle cx="50" cy="50" r="${R}"/>`,
        `    <g transform="rotate(-40 50 50)">`,
        `      <line x1="${50 - L / 2}" y1="50" x2="${50 + L / 2}" y2="50"/>`,
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
  const overshoot = clamp(ARG_OVERSHOOT ?? 6, 0, 20);
  const CX = 60,
    CY = 50;
  const R = SIZES.circleR_monogram;
  const L = slashLengthCutThrough(R, overshoot);
  return xml(
    wrap120(
      [
        `  <!-- Legacy: monogram lockup on 120 box (cut-through) -->`,
        strokeGroupOpen(`stroke-width="${STROKES.monogram}"`),
        `    <circle cx="${CX}" cy="${CY}" r="${R}"/>`,
        `    <g transform="rotate(-45 ${CX} ${CY})">`,
        `      <line x1="${CX - L / 2}" y1="${CY + L / 2}" x2="${
          CX + L / 2
        }" y2="${CY - L / 2}"/>`,
        `    </g>`,
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
  return `Empty Set (∅) – Unicode U+2205
====================================
- Stroke variant: diagonal slash **cuts through** (overshoots) the circle.
- Filled variant: knockout slash is **contained** within the ring (no overshoot).
- Angle ≈ ${Math.abs(cfg.angle)}°, overshoot ${cfg.overshoot}, slash stroke ${
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
- emptyset_basic.svg — stroke slash **cuts through** the circle (overshoot).
- emptyset_round.svg — rounded stroke slash **cuts through**.
- emptyset_bold_legacy.svg — bold stroke slash **cuts through**.
- emptyset_tilted.svg — rotated stroke slash **cuts through**.
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
