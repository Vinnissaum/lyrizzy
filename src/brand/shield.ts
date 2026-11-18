/**
 * Lyrizzy's brand mark: the Shield of the Trinity (Scutum Fidei) drawn as a
 * backlit stained-glass window. Three roundels (Pater, Filius, Spiritus Sanctus)
 * sit on a ring of glass; three "est" spokes join each to Deus at the centre and
 * three "non est" arcs join them to each other.
 *
 * This module is the single source of the artwork. It returns SVG markup:
 *   - the launch splash inlines it and animates its `lz-*` classes (index.css);
 *   - scripts/brand/build-brand.mjs writes the static files from it (the app
 *     icon source app-icon.svg, the docs logo and the docs hero window).
 * It has no imports and uses only erasable TypeScript, so Node runs it directly.
 */

/** The window's glass, from the darkest lead came to the palest backlit glass. */
export const BRAND = {
  night: "#03070C",
  tileTop: "#0C1826",
  lead: "#062447",
  cobalt: "#0B4E9C",
  azure: "#0B7EC0",
  cyan: "#1EB8EC",
  glow: "#4FD6FF",
  pale: "#BDF3FF",
} as const;

export interface ShieldOptions {
  /** The Latin inscriptions. They need the Cinzel face: loaded by index.css in the
   *  app, or passed in `css` as an embedded @font-face for a standalone file. */
  labels?: boolean;
  /** The rounded-square night tile behind the window: the app icon. */
  tile?: boolean;
  /** Backlit bloom around the glass, as an SVG blur filter. */
  glow?: boolean;
  /** Prefix for gradient, filter and path ids; unique per document. */
  idPrefix?: string;
  /** Crop the viewBox to the ring plus this margin; omitted keeps the 1024 canvas. */
  margin?: number;
  /** Extra CSS for a <style> element, e.g. an embedded @font-face. */
  css?: string;
  /** Accessible name. Without one the SVG is aria-hidden (decorative). */
  title?: string;
}

const SIZE = 1024;
const C = SIZE / 2;
/** Width of the lead came drawn around every piece of glass. */
const LEAD = 9;
const RING_R = 428;
const RING_W = 30;
const RING_BARS = 16;
/** Distance from the centre to the three person roundels. */
const VERTEX_R = 290;
const NODE_R = 84;
const DEUS_R = 90;
const SPOKE_W = 50;
const ARC_W = 56;
/** How far each "non est" arc bows out past the straight line between roundels. */
const ARC_SAGITTA = 100;

export const RING_OUTER_R = RING_R + RING_W / 2 + LEAD;

interface Pt {
  x: number;
  y: number;
}

const n = (v: number) => String(Math.round(v * 100) / 100);
const rad = (deg: number) => (deg * Math.PI) / 180;
const polar = (deg: number, r: number): Pt => ({
  x: C + r * Math.cos(rad(deg)),
  y: C + r * Math.sin(rad(deg)),
});

/** Pater on top, Filius bottom-left, Spiritus Sanctus bottom-right. */
const PERSONS = [
  { key: "pater", deg: -90, lines: ["PATER"], size: 34 },
  { key: "filius", deg: 150, lines: ["FILIUS"], size: 34 },
  { key: "spiritus", deg: 30, lines: ["SPIRITUS", "SANCTUS"], size: 25 },
].map((p) => ({ ...p, at: polar(p.deg, VERTEX_R) }));

const [PATER, FILIUS, SPIRITUS] = PERSONS;

/** SVG arc from a to b through the roundel centres, bowing away from the centre. */
function arc(a: Pt, b: Pt, withMove = true): string {
  const half = Math.hypot(b.x - a.x, b.y - a.y) / 2;
  const radius = (half * half + ARC_SAGITTA * ARC_SAGITTA) / (2 * ARC_SAGITTA);
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const out = Math.hypot(mid.x - C, mid.y - C);
  const ux = (mid.x - C) / out;
  const uy = (mid.y - C) / out;
  const centre = { x: mid.x - ux * (radius - ARC_SAGITTA), y: mid.y - uy * (radius - ARC_SAGITTA) };
  let delta =
    Math.atan2(b.y - centre.y, b.x - centre.x) - Math.atan2(a.y - centre.y, a.x - centre.x);
  if (delta > Math.PI) delta -= 2 * Math.PI;
  if (delta < -Math.PI) delta += 2 * Math.PI;
  const sweep = delta > 0 ? 1 : 0;
  const move = withMove ? `M${n(a.x)} ${n(a.y)}` : "";
  return `${move}A${n(radius)} ${n(radius)} 0 0 ${sweep} ${n(b.x)} ${n(b.y)}`;
}

/**
 * The three "non est" arcs, each drawn in the direction its words read so the
 * letters stand upright: up the left side, down the right, left to right below.
 */
const ARCS = [
  { key: "left", from: FILIUS.at, to: PATER.at },
  { key: "right", from: PATER.at, to: SPIRITUS.at },
  { key: "bottom", from: FILIUS.at, to: SPIRITUS.at },
];

/** "Est" reads from each person toward Deus where that keeps it upright. */
const SPOKE_TEXT_DEG: Record<string, number> = { pater: 90, filius: -30, spiritus: 30 };

/** Midway between Deus's lead and the person roundel's lead. */
const SPOKE_LABEL_R = (DEUS_R + LEAD + (VERTEX_R - NODE_R - LEAD)) / 2;

/** The ring as a path starting at the top, so it draws clockwise from 12 o'clock. */
const RING_PATH =
  `M${C} ${C - RING_R}A${RING_R} ${RING_R} 0 1 1 ${C} ${C + RING_R}` +
  `A${RING_R} ${RING_R} 0 1 1 ${C} ${C - RING_R}`;

const FONT = "font-family=\"Cinzel, 'Trajan Pro', Georgia, serif\" font-weight=\"700\"";

export function shieldSvg(options: ShieldOptions = {}): string {
  const p = options.idPrefix ?? "lz";
  const id = (name: string) => `${p}-${name}`;
  const url = (name: string) => `url(#${id(name)})`;

  const viewBox =
    options.margin === undefined
      ? `0 0 ${SIZE} ${SIZE}`
      : (() => {
          const r = RING_OUTER_R + options.margin;
          return `${n(C - r)} ${n(C - r)} ${n(2 * r)} ${n(2 * r)}`;
        })();

  const defs = [
    // Light falls from the upper left: brighter glass there, deeper glass below.
    `<linearGradient id="${id("band")}" gradientUnits="userSpaceOnUse" x1="${C - RING_R}" y1="${C - RING_R}" x2="${C + RING_R}" y2="${C + RING_R}">` +
      `<stop offset="0" stop-color="${BRAND.glow}"/><stop offset="0.5" stop-color="${BRAND.cyan}"/>` +
      `<stop offset="1" stop-color="${BRAND.azure}"/>` +
      `</linearGradient>`,
    `<radialGradient id="${id("fill")}" gradientUnits="userSpaceOnUse" cx="${C}" cy="${C - 30}" r="${VERTEX_R + 40}">` +
      `<stop offset="0" stop-color="${BRAND.pale}"/><stop offset="0.55" stop-color="#7FE2FF"/>` +
      `<stop offset="1" stop-color="${BRAND.glow}"/>` +
      `</radialGradient>`,
    `<radialGradient id="${id("node")}" cx="0.4" cy="0.36" r="0.7">` +
      `<stop offset="0" stop-color="#A6EEFF"/><stop offset="0.5" stop-color="${BRAND.glow}"/>` +
      `<stop offset="1" stop-color="${BRAND.cyan}"/>` +
      `</radialGradient>`,
  ];
  if (options.tile) {
    defs.push(
      `<linearGradient id="${id("tile")}" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${BRAND.tileTop}"/><stop offset="1" stop-color="${BRAND.night}"/>` +
        `</linearGradient>`,
      `<radialGradient id="${id("halo")}" cx="0.5" cy="0.5" r="0.5">` +
        `<stop offset="0" stop-color="${BRAND.cyan}" stop-opacity="0.34"/>` +
        `<stop offset="0.6" stop-color="${BRAND.azure}" stop-opacity="0.12"/>` +
        `<stop offset="1" stop-color="${BRAND.azure}" stop-opacity="0"/>` +
        `</radialGradient>`,
    );
  }
  if (options.glow) {
    defs.push(
      `<filter id="${id("bloom")}" x="-25%" y="-25%" width="150%" height="150%" color-interpolation-filters="sRGB">` +
        `<feGaussianBlur in="SourceGraphic" stdDeviation="16" result="soft"/>` +
        `<feGaussianBlur in="SourceGraphic" stdDeviation="44" result="wide"/>` +
        `<feMerge><feMergeNode in="wide"/><feMergeNode in="soft"/><feMergeNode in="SourceGraphic"/></feMerge>` +
        `</filter>`,
    );
  }
  if (options.labels) {
    for (const a of ARCS) defs.push(`<path id="${id(`text-${a.key}`)}" d="${arc(a.from, a.to)}"/>`);
  }

  const label = (text: string, x: number, y: number, size: number, extra = "") =>
    `<text class="lz-label" x="${n(x)}" y="${n(y)}" font-size="${size}" ${FONT} fill="${BRAND.lead}" ` +
    `text-anchor="middle" dy="0.36em"${extra}>${text}</text>`;

  // A band of glass: the lead came underneath, the glass on top, same path.
  const band = (d: string, width: number) =>
    `<path class="lz-draw lz-band-lead" d="${d}" pathLength="1" fill="none" stroke="${BRAND.lead}" stroke-width="${width + 2 * LEAD}"/>` +
    `<path class="lz-draw lz-band-glass" d="${d}" pathLength="1" fill="none" stroke="${url("band")}" stroke-width="${width}"/>`;

  const ringBars = Array.from({ length: RING_BARS }, (_, i) => {
    const deg = (360 / RING_BARS) * (i + 0.5) - 90;
    const a = polar(deg, RING_R - RING_W / 2 - 2);
    const b = polar(deg, RING_R + RING_W / 2 + 2);
    return `<line x1="${n(a.x)}" y1="${n(a.y)}" x2="${n(b.x)}" y2="${n(b.y)}"/>`;
  }).join("");

  const ring =
    `<g class="lz-ring">` +
    `<path class="lz-draw" d="${RING_PATH}" pathLength="1" fill="none" stroke="${BRAND.lead}" stroke-width="${RING_W + 2 * LEAD}"/>` +
    `<path class="lz-draw" d="${RING_PATH}" pathLength="1" fill="none" stroke="${url("band")}" stroke-width="${RING_W}"/>` +
    `<circle class="lz-ring-sheen" cx="${C}" cy="${C}" r="${RING_R - RING_W * 0.22}" fill="none" stroke="${BRAND.pale}" stroke-opacity="0.55" stroke-width="4"/>` +
    `<g class="lz-ring-bars" stroke="${BRAND.lead}" stroke-width="${LEAD - 1}">${ringBars}</g>` +
    `</g>`;

  const fill =
    `<path class="lz-fill" fill="${url("fill")}" d="M${n(PATER.at.x)} ${n(PATER.at.y)}` +
    `${arc(PATER.at, SPIRITUS.at, false)}${arc(SPIRITUS.at, FILIUS.at, false)}${arc(FILIUS.at, PATER.at, false)}Z"/>`;

  const arcs = ARCS.map(
    (a, i) =>
      `<g class="lz-arc lz-arc-${a.key}" style="--i:${i}">${band(arc(a.from, a.to), ARC_W)}` +
      (options.labels
        ? `<text class="lz-label" font-size="27" ${FONT} fill="${BRAND.lead}" letter-spacing="3" dy="0.36em">` +
          `<textPath href="#${id(`text-${a.key}`)}" startOffset="50%" text-anchor="middle">NON · EST</textPath></text>`
        : "") +
      `</g>`,
  ).join("");

  const spokes = PERSONS.map((person, i) => {
    const at = polar(person.deg, SPOKE_LABEL_R);
    return (
      `<g class="lz-spoke lz-spoke-${person.key}" style="--i:${i}">` +
      band(`M${C} ${C}L${n(person.at.x)} ${n(person.at.y)}`, SPOKE_W) +
      (options.labels
        ? label("EST", at.x, at.y, 27, ` letter-spacing="2" transform="rotate(${SPOKE_TEXT_DEG[person.key]} ${n(at.x)} ${n(at.y)})"`)
        : "") +
      `</g>`
    );
  }).join("");

  const roundel = (cls: string, at: Pt, r: number, inner: string, i?: number) =>
    `<g class="lz-node ${cls}"${i === undefined ? "" : ` style="--i:${i}"`}>` +
    `<circle cx="${n(at.x)}" cy="${n(at.y)}" r="${r + LEAD / 2}" fill="${url("node")}" stroke="${BRAND.lead}" stroke-width="${LEAD}"/>` +
    `<circle cx="${n(at.x)}" cy="${n(at.y)}" r="${r - 13}" fill="none" stroke="${BRAND.cobalt}" stroke-opacity="0.6" stroke-width="3"/>` +
    inner +
    `</g>`;

  const nodes =
    roundel("lz-deus", { x: C, y: C }, DEUS_R, options.labels ? label("DEUS", C, C, 38, ` letter-spacing="1"`) : "") +
    PERSONS.map((person, i) => {
      const lines = options.labels
        ? person.lines
            .map((text, line) => {
              const offset = (line - (person.lines.length - 1) / 2) * person.size * 1.12;
              return label(text, person.at.x, person.at.y + offset, person.size);
            })
            .join("")
        : "";
      return roundel(`lz-person lz-${person.key}`, person.at, NODE_R, lines, i);
    }).join("");

  const tile = options.tile
    ? `<rect class="lz-tile" width="${SIZE}" height="${SIZE}" rx="224" fill="${url("tile")}"/>` +
      `<circle cx="${C}" cy="${C}" r="${RING_OUTER_R + 40}" fill="${url("halo")}"/>`
    : "";

  const a11y = options.title ? ` role="img" aria-label="${options.title}"` : ` aria-hidden="true"`;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" class="lz-shield" viewBox="${viewBox}"${a11y}>` +
    (options.title ? `<title>${options.title}</title>` : "") +
    (options.css ? `<style>${options.css}</style>` : "") +
    `<defs>${defs.join("")}</defs>` +
    tile +
    `<g class="lz-figure"${options.glow ? ` filter="${url("bloom")}"` : ""}>` +
    ring +
    fill +
    arcs +
    spokes +
    nodes +
    `</g></svg>`
  );
}
