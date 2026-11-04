// A Bialetti Moka Express, three cups, on a gas ring, taken apart. Every piece is built at its assembled place and
// lifted along the pot's axis by its own offset; a progress p (0 = apart, 1 = assembled) brings them down in order:
// boiler, funnel with the coffee, filter plate, gasket, collector with its handle, lid. Units are millimetres, read off
// Bialetti's product photograph of the three-cup pot (170 mm to the top of the knob, 130 ml).
// `--photo` draws the assembled pot in that photograph's camera instead, to lay it over the photograph.
//
// Run it again when the moka changes: `node scripts/moka/build.mjs` (or `bun`). It writes the layers the site
// draws, each cropped to its box, and their data into src/assets/moka/; the interactive plate, the unused
// layers and the screwing views (the strip's sources) into scripts/moka/out/, left out of git.
// The anatomy kit it draws with is copied in ./anatomy (MIT), so that it reads nothing outside the repository.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "./anatomy/kit/iso-kit.mjs";
import * as G from "./anatomy/kit/lathe.mjs";
import { kitScript } from "./anatomy/scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(HERE, "..", "..", "src", "assets", "moka");
const OUT = join(HERE, "out");
const PHOTO = process.argv.includes("--photo");
const WIDTH = PHOTO ? 960 : 600;
const HEIGHT = PHOTO ? 1103 : 1000;

// Gas ring
const STOVE = { x: -68, y: -68, w: 136, d: 136, r: 12 };
const RING = { r0: 50, r1: 55 };
const STOVE_Z0 = -26;
const STOVE_TOP = -12;
const FEET_Z = -31;
// Boiler: an octagonal frustum, wide at the base, a short shoulder up to the flat ring the collector's skirt sits on,
// then the round threaded neck. The safety valve sits high on the flat left of the front one, as on the real pot.
const B = { band: 1.5, top: 59.3, apo0: 44.8, apo1: 37.5 };
const SHOULDER = { z: 65, apo: 36.7 };
const NECK = { z0: 65, z1: 71.5, rIn: 31.4, rOut: 33.6 };
const WATER_Z = 45;
const VALVE_Z = 49;
// Funnel: flange on the neck rim, basket, cone and stem down to 3 mm above the boiler floor
const FUNNEL = { flange: [71.5, 72.5], basket: [54, 72.5], r: 29.6, rIn: 29.2, cone: 45, stem: 4.2, tip: 3, coffee: 72.1 };
const FILTER = { z0: 72.5, z1: 73.5, r: 31 };
const GASKET = { z0: 73.5, z1: 76, rIn: 26, rOut: 33.4 };
// Collector: the round threaded skirt at the waist, then an octagonal frustum flaring out to the rim
const SKIRT = { z0: 65, z1: 83.3, r: 36.3, ease: 1.2 };
const C = { z0: 83.3, z1: 136.8, apo0: 38.1, apo1: 45.5, wall: 1.6, floor: 76 };
// Spout: drawn out of the 135° flat, its tip 17.6 mm past the flat and 6 mm under the rim, its keel down to z 96
const SPOUT = { reach: 63.1, tipZ: 130.5, keelZ: 96 };
// Lid: a short rim band, then a low octagonal pyramid up to the knob's seat. The knob is black, faceted, wider at the top.
const LID = { z0: 136.8, band: 2, z1: 150, apo0: 46.2, apo1: 6.6 };
const KNOB = { collar: [150, 151.6], c0: 6.2, c1: 5.2, body: [151.6, 166.6], b0: 4.8, b1: 9.6, tip: 171 };

// Apart offsets along the axis, and the share of the progress over which each piece comes down.
// Each piece hangs a few millimetres above the screen top of the one under it, so the pieces read apart at p = 0.
const PIECES = [
  { name: "boiler", label: "chaudière", off: 52, from: 0, to: 0.16 },
  { name: "funnel", label: "entonnoir et café", off: 138, from: 0.16, to: 0.38 },
  { name: "filter", label: "filtre", off: 185, from: 0.3, to: 0.5 },
  { name: "gasket", label: "joint", off: 232, from: 0.4, to: 0.58 },
  { name: "collector", label: "collecteur et poignée", off: 293, from: 0.5, to: 0.76 },
  { name: "lid", label: "couvercle", off: 358, from: 0.7, to: 0.9 },
];
const OFF = Object.fromEntries(PIECES.map((piece) => [piece.name, piece.off]));

// The handle stands in the vertical plane through the 315° flat (screen right), its broad faces toward the viewer.
const RAD = [Math.SQRT1_2, -Math.SQRT1_2, 0];
const THICK = [Math.SQRT1_2, Math.SQRT1_2, 0];
const apoAt = (z) => C.apo0 + ((C.apo1 - C.apo0) * (Math.min(z, C.z1) - C.z0)) / (C.z1 - C.z0);
// Its outline (distance from the axis, height), traced from the photograph: the arm leaves the body under the hinge,
// rises to a crown, the grip leans back toward the pot and ends free in a small foot that points at the skirt.
const HANDLE = [
  [apoAt(C.z1), C.z1], [57.8, C.z1], [59.2, 140.5], [61, 143.6], [63, 145], [66.5, 145.2], [70.5, 144], [74.5, 141.6],
  [78.5, 138], [82, 133.5], [84.8, 128.6], [86.3, 124], [86.4, 120], [85.6, 115], [84.2, 110], [82.5, 105], [80.6, 100],
  [78.5, 95], [76.2, 90], [73.6, 85], [70.8, 80.5], [68, 76.5], [65, 72.8], [62, 70], [59, 68.2], [56, 67.8], [53.2, 69],
  [51, 71.4], [49.8, 74.2], [49.8, 77], [51, 79.2], [53.6, 80.6], [57, 81.6],
  [59, 84], [60.3, 88], [61.4, 92.5], [62.5, 97], [63.6, 101.5], [64.8, 106], [66.2, 110.5], [67.6, 114.5], [68.7, 118],
  [69.1, 121], [68.6, 123.3], [67, 124.8], [64.5, 125.4], [61, 125], [57, 123.6], [52.5, 121.2], [48, 118.8], [apoAt(117.5), 117.5],
];
// The aluminium bracket that carries the hinge, riveted to the 315° flat under the rim; the lid's tab rides on it.
const BRACKET = [[apoAt(126), 126], [54.5, 126], [57.8, 128.5], [57.8, 135.4], [56.4, 137.6], [apoAt(C.z1), 137.6]];
const PIN = { u: 53.4, z: 133.6, r: 1.9 };
const TAB = [[44, 137.6], [57.2, 137.6], [58.8, 138.5], [58.8, 139.5], [57.6, 140.4], [44, 139.6]];

// Octagon with its flats facing 0°, 45°, 90°…, so one flat faces the camera.
const octR = (apothem) => apothem / Math.cos(Math.PI / 8);
const oct = (apothem) =>
  Array.from({ length: 8 }, (_, index) => {
    const angle = (index * Math.PI) / 4 + Math.PI / 8;
    return [octR(apothem) * Math.cos(angle), octR(apothem) * Math.sin(angle)];
  });
const ring3 = (r, z, count = 32) => Array.from({ length: count }, (_, i) => [r * Math.cos((i / count) * 2 * Math.PI), r * Math.sin((i / count) * 2 * Math.PI), z]);
const inPlane = ([u, v], t = 0) => G.add3(G.add3(G.mul3(RAD, u), G.mul3(THICK, t)), [0, 0, v]);

// Spout corners: the 135° flat's two rim corners, the tip, and the keel point where its underside meets the flat.
const nS = [Math.cos((3 * Math.PI) / 4), Math.sin((3 * Math.PI) / 4)];
const tS = [-nS[1], nS[0]];
const onFlat2 = (z, w) => [apoAt(z) * nS[0] + w * tS[0], apoAt(z) * nS[1] + w * tS[1], z];
const HALF = C.apo1 * Math.tan(Math.PI / 8);
// The lips leave the flat inside its corners and a little under the rim, so both run out from under the lid's edge
// instead of ending on its corner.
const LIP = { span: 0.62, drop: 1.8 };
const SPOUT_A = onFlat2(C.z1 - LIP.drop, -HALF * LIP.span);
const SPOUT_B = onFlat2(C.z1 - LIP.drop, HALF * LIP.span);
const SPOUT_T = [SPOUT.reach * nS[0], SPOUT.reach * nS[1], SPOUT.tipZ];
const SPOUT_K = onFlat2(SPOUT.keelZ, 0);

// Each piece's extent at its assembled place: it frames the camera, apart and assembled.
const EXTENT = {
  stove: [...k.boxCorners(STOVE, FEET_Z, STOVE_TOP), [30, 77, -11.8], [30, 77, -26.2]],
  boiler: [...oct(B.apo0).map(([x, y]) => [x, y, 0]), ...ring3(NECK.rOut, NECK.z1)],
  funnel: [...ring3(NECK.rOut, FUNNEL.flange[1]), [0, 0, FUNNEL.tip]],
  filter: ring3(FILTER.r, FILTER.z1),
  gasket: ring3(GASKET.rOut, GASKET.z1),
  collector: [
    ...oct(C.apo1).map(([x, y]) => [x, y, C.z1]),
    ...ring3(SKIRT.r, SKIRT.z0),
    ...HANDLE.flatMap((uv) => [-6, 6].map((t) => inPlane(uv, t))),
    SPOUT_T,
  ],
  lid: [...oct(LID.apo0).map(([x, y]) => [x, y, LID.z0]), [0, 0, KNOB.tip], ...TAB.flatMap((uv) => [-4.6, 4.6].map((t) => inPlane(uv, t)))],
};

const P = PHOTO
  ? // The photograph: seen from 4.5° above, 5.78 px to the millimetre, the axis at x 415 and the base at y 1030.
    { origin: [415, 1030], scale: 5.78 / Math.sqrt(1.6), azimuth: 45, elevation: 4.5 }
  : k.fitProjection(
      [...EXTENT.stove, ...PIECES.flatMap((piece) => EXTENT[piece.name].map(([x, y, z]) => [x, y, z + piece.off]))],
      WIDTH,
      HEIGHT,
      { pad: 34, azimuth: 45, elevation: 34 },
    );

// The collector is screwed on: it is drawn at several turns about the axis. Geometry stays in the piece's own frame;
// `world` turns points and normals by ROT (radians, counter-clockwise seen from above) before projecting or shading.
let ROT = 0;
const world = (p) => (ROT ? [p[0] * Math.cos(ROT) - p[1] * Math.sin(ROT), p[0] * Math.sin(ROT) + p[1] * Math.cos(ROT), p[2]] : p);
const at = (point) => k.iso(world(point), P);
const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const V = G.viewOf(P);
const AX = G.frameOf([0, 0, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const [LX, LY] = [-Math.sin(Math.PI / 4), Math.cos(Math.PI / 4)];
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const flatTone = (n) => Math.min(3, Math.max(0, Math.floor(((n[0] * LX + n[1] * LY) / (Math.hypot(n[0], n[1]) || 1) + 1) * 2)));
// Faces that look up (the lid, the knob's point, the shoulder) take the kit's light; standing faces keep the floor rule.
const toneFor = (local) => {
  const n = world(local);
  return n[2] > 0.3 ? G.toneOf(n, P) : flatTone(n);
};
const facing = (local) => G.dot3(world(local), V);
const poly = (points) => k.pathOf(points.map(at), true);
const sub2 = (a, b) => [a[0] - b[0], a[1] - b[1]];
const fix = (value) => +value.toFixed(4);

// An octagonal frustum, shaded like the kit's prisms: each visible flat takes a tone from how it faces the light,
// the top is the light face, creases run between visible flats. With a tiny top it is a pyramid (the lid, the knob's point).
function frustum(apo0, apo1, z0, z1, { cap = true } = {}) {
  const lo = oct(apo0).map(([x, y]) => [x, y, z0]);
  const hi = oct(apo1).map(([x, y]) => [x, y, z1]);
  const lo2 = lo.map(at);
  const hi2 = hi.map(at);
  const shades = [[], [], [], []];
  const tops = [];
  const seen = [];
  const normals = [];
  for (let j = 0; j < 8; j++) {
    const next = (j + 1) % 8;
    let n = G.unit3(G.cross3(G.sub3(lo[next], lo[j]), G.sub3(hi[j], lo[j])));
    const mid = G.mul3(G.add3(lo[j], lo[next]), 0.5);
    if (n[0] * mid[0] + n[1] * mid[1] < 0) n = G.mul3(n, -1);
    normals.push(n);
    const visible = facing(n) > 1e-6;
    seen.push(visible);
    if (!visible) continue;
    const tone = toneFor(n);
    (tone === 4 ? tops : shades[tone]).push(k.pathOf([lo2[j], lo2[next], hi2[next], hi2[j]], true));
  }
  const hull = G.hullOf([...lo2, ...hi2]);
  const creases = [];
  for (let j = 0; j < 8; j++) {
    if (seen[j] && seen[(j + 7) % 8]) creases.push(k.pathOf([lo2[j], hi2[j]]));
    if (cap && seen[j]) creases.push(k.pathOf([hi2[j], hi2[(j + 1) % 8]]));
  }
  return {
    fill: k.pathOf(hull, true),
    outline: k.pathOf(hull, true),
    crease: creases.join(""),
    top: [cap ? k.pathOf(hi2, true) : "", ...tops].join(""),
    shades: shades.map((list) => list.join("")),
    seen,
    normals,
    lo2,
    hi2,
  };
}

// A flat plate cut to an outline, standing in a vertical plane: back face, the side walls that face the camera
// (far first), then the front face. Walls along a smooth run join without a seam: each draws only its far edge,
// and a crosswise edge only where the outline turns sharply.
function plate(outline, frame, t0, t1) {
  const point = ([u, v], t) => [frame.o[0] + frame.u[0] * u + frame.a[0] * t, frame.o[1] + frame.u[1] * u + frame.a[1] * t, frame.o[2] + v + frame.a[2] * t];
  const count = outline.length;
  const back = outline.map((uv) => point(uv, t0));
  const front = outline.map((uv) => point(uv, t1));
  const out = [`<path class="iso-fill" d="${poly(back)}"/>`, `<path class="iso-line iso-edge" data-tone="hi" d="${poly(back)}"/>`];
  const walls = [];
  const area = outline.reduce((sum, [u0, v0], index) => {
    const [u1, v1] = outline[(index + 1) % count];
    return sum + u0 * v1 - u1 * v0;
  }, 0);
  const sharp = (j) => {
    const [a, b, c] = [outline[(j - 1 + count) % count], outline[j], outline[(j + 1) % count]];
    const d1 = [b[0] - a[0], b[1] - a[1]];
    const d2 = [c[0] - b[0], c[1] - b[1]];
    return (d1[0] * d2[0] + d1[1] * d2[1]) / (Math.hypot(...d1) * Math.hypot(...d2) || 1) < Math.cos(0.6);
  };
  for (let j = 0; j < count; j++) {
    const next = (j + 1) % count;
    const [u0, v0] = outline[j];
    const [u1, v1] = outline[next];
    const sign = area > 0 ? 1 : -1;
    const n2 = [(v1 - v0) * sign, -(u1 - u0) * sign];
    const normal = G.unit3(G.add3(G.mul3(frame.u, n2[0]), [0, 0, n2[1]]));
    if (facing(normal) <= 1e-6) continue;
    const quad = [back[j], back[next], front[next], front[j]];
    const tone = normal[2] > 0.6 ? "top" : flatTone(world(normal));
    const edges = [k.pathOf([at(back[j]), at(back[next])])];
    if (sharp(j)) edges.push(k.pathOf([at(back[j]), at(front[j])]));
    if (sharp(next)) edges.push(k.pathOf([at(back[next]), at(front[next])]));
    walls.push({ depth: facing(G.mul3(G.add3(back[j], front[next]), 0.5)), quad, tone, edges: edges.join("") });
  }
  walls.sort((a, b) => a.depth - b.depth);
  for (const wall of walls) {
    const cls = wall.tone === "top" ? `class="iso-top"` : `class="iso-shade" data-shade="${wall.tone}"`;
    out.push(`<path class="iso-fill" d="${poly(wall.quad)}"/><path ${cls} d="${poly(wall.quad)}"/><path class="iso-line iso-edge" data-tone="hi" d="${wall.edges}"/>`);
  }
  out.push(`<path class="iso-fill" d="${poly(front)}"/><path class="iso-shade" data-shade="${flatTone(world(frame.a))}" d="${poly(front)}"/><path class="iso-line iso-edge" data-tone="hi" d="${poly(front)}"/>`);
  return `<g class="iso-solid" data-seamless="">${out.join("")}</g>`;
}

const hexagon = (r) => Array.from({ length: 6 }, (_, index) => [r * Math.cos((index * Math.PI) / 3), r * Math.sin((index * Math.PI) / 3)]);

// ── The gas ring ──────────────────────────────────────────────────────────────────────────────────────────────
function stove() {
  const out = [`<path class="iso-halo" d="${k.haloOf(STOVE, FEET_Z, STOVE_TOP - FEET_Z, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(STOVE, 18))) {
    out.push(S(k.cylinder(x, y, 7, FEET_Z, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, FEET_Z + 1.6, STOVE_Z0 - FEET_Z - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(STOVE, STOVE_Z0, STOVE_TOP - STOVE_Z0, P, 8, 1.6), { tone: "mid", inner: Ln(k.sideSeam(STOVE, -20, P, 8), { tone: "faint" }) }));
  out.push(Ln(k.planOutline(k.insetPlan(STOVE, 6), STOVE_TOP, P), { tone: "lo" }));
  const screws = k.corners(STOVE, 10);
  out.push(Ln(screws.map(([x, y]) => k.ring(x, y, 2.2, STOVE_TOP, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, STOVE_TOP])), { size: 0.5 }));

  // Label plate on the right face, three rule lines standing for its print.
  const LAB = G.frameOf([68, -24, -19], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  const onLabel = (u, v) => at([68.8, -24 + u, -19 + v]);
  out.push(S(G.prismOf(LAB, [[-20, -4.4], [20, -4.4], [20, 4.4], [-20, 4.4]], 0, 0.8, P), { tone: "lo" }));
  out.push(Ln([[2.2, 22], [0, 30], [-2.2, 14]].map(([v, length]) => k.pathOf([onLabel(-15.5, v), onLabel(-15.5 + length, v)])).join(""), { tone: "lo", free: true }));
  out.push(D([onLabel(-18, 0), onLabel(18, 0)], { size: 0.45 }));

  // Control knob on the front face, with its scale.
  const KN = G.frameOf([30, 68, -19], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
  out.push(S(G.ringBand(0, 0.6, 7.6, 10.8, KN, P), { tone: "lo" }));
  out.push(Ln(G.spokesOf(KN, 0.6, 9, 10.6, 6, P, { from: -0.5, to: Math.PI / 2 - 0.3 }), { tone: "lo" }));
  out.push(Ln(k.pathOf([at(G.pointOf(KN, 0.6, 8.6, Math.PI / 2)), at(G.pointOf(KN, 0.6, 10.8, Math.PI / 2))]), { tone: "mid" }));
  out.push(S(G.disc(0.6, 2.4, 4.4, KN, P), { tone: "mid" }));
  const ribs = G.ribsOf(KN, 2.4, 8.4, 7.2, 30, P, { fade: [0.1, 0.55], seams: true });
  out.push(S(G.disc(2.4, 8.4, 7.2, KN, P), { tone: "mid", inner: k.fadedSvg(ribs, { tone: "lo" }) }));
  out.push(D([at(G.pointOf(KN, 8.4, 0, 0))], { size: 0.55, tone: "hi" }));

  // Burner: drip cup, crown with its flame ports, cap.
  out.push(S(k.cylinder(0, 0, 30, STOVE_TOP, 2.5, P, 72, 0.5), { tone: "mid" }));
  out.push(S(k.cylinder(0, 0, 22, -9.5, 4.5, P, 64), { tone: "mid" }));
  out.push(D(G.dotsOf(AX, -7.2, 22, 30, P, { fade: [0.05, 0.45] }), { size: 0.55, tone: "hi" }));
  out.push(S(k.cylinder(0, 0, 17, -5, 1.5, P, 56, 0.4), { tone: "mid" }));
  out.push(Ln(k.ring(0, 0, 9, -3.5, P, 40), { tone: "faint" }));
  return out.join("");
}

// The knob's pointer at off (up) and at full flame, drawn over the knob's face; the live code crossfades them.
const KNOB_FRAME = G.frameOf([30, 68, -19], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
const pointerAt = (angle) => k.pathOf([at(G.pointOf(KNOB_FRAME, 8.4, 0.8, angle)), at(G.pointOf(KNOB_FRAME, 8.4, 5.8, angle))]);
const knobOff = () => Ln(pointerAt(Math.PI / 2), { tone: "hi", free: "end" });
const knobOn = () => Ln(pointerAt(-0.5), { tone: "lit", free: "end" });
// The flame's light on the stove top, under the pan support.
const glow = () => `<path class="mk-glow" d="${k.ring(0, 0, 46, STOVE_TOP + 0.2, P, 64)}"/>`;

function stoveGrate() {
  const out = [];
  // Pan support: four legs, a ring, four arms on top of it.
  const legR = (RING.r0 + RING.r1) / 2;
  for (const angle of byDepthAngles([45, 135, 225, 315])) {
    const [x, y] = [legR * Math.cos(angle), legR * Math.sin(angle)];
    out.push(S(k.cylinder(x, y, 2.2, STOVE_TOP, 5, P, 16), { tone: "mid" }));
  }
  out.push(S(G.ringBand(-7, -4, RING.r0, RING.r1, AX, P, { hole: [-4, RING.r0] }), { tone: "mid", className: "mk-holed" }));
  const arms = [
    { x: 22, y: -2.6, w: 33, d: 5.2, r: 1.4 },
    { x: -55, y: -2.6, w: 33, d: 5.2, r: 1.4 },
    { x: -2.6, y: 22, w: 5.2, d: 33, r: 1.4 },
    { x: -2.6, y: -55, w: 5.2, d: 33, r: 1.4 },
  ].sort((a, b) => k.depthOf([a.x + a.w / 2, a.y + a.d / 2, 0], P) - k.depthOf([b.x + b.w / 2, b.y + b.d / 2, 0], P));
  for (const arm of arms) out.push(S(k.slabOf(arm, -4, 4, P, 3, 0.4), { tone: "mid" }));
  return out.join("");
}

function byDepthAngles(degrees) {
  return degrees
    .map((degree) => (degree * Math.PI) / 180)
    .sort((a, b) => k.depthOf([Math.cos(a), Math.sin(a), 0], P) - k.depthOf([Math.cos(b), Math.sin(b), 0], P));
}

// ── The boiler ───────────────────────────────────────────────────────────────────────────────────────────────
const NECK_HOLE = G.circleOf(AX, NECK.z1, NECK.rIn, P);
const NECK_LOW = G.circleOf(AX, NECK.z0, NECK.rIn, P);
const THREADS = [66.8, 68.6, 70.4].map((z) => G.arcOf(AX, z, NECK.rOut, P)).join("");

function boiler() {
  const out = [];
  out.push(S(frustum(B.apo0, B.apo0, 0, B.band, { cap: false }), { tone: "hi" }));
  const body = frustum(B.apo0, B.apo1, B.band, B.top, { cap: false });
  out.push(S(body, { tone: "hi" }));
  // The shoulder: a narrow band leaning in, its top the flat ring the collector's skirt comes down on.
  out.push(S(frustum(B.apo1, SHOULDER.apo, B.top, SHOULDER.z), { tone: "hi" }));
  // Safety valve high on the 90° flat: hex nut, cap, pin, along the flat's normal.
  const apo = B.apo0 - ((B.apo0 - B.apo1) * (VALVE_Z - B.band)) / (B.top - B.band);
  const VF = G.frameAlong([0, apo, VALVE_Z], body.normals[1]);
  out.push(S(G.prismOf(VF, hexagon(5.2), 0, 2.6, P), { tone: "mid" }));
  out.push(S(G.disc(2.6, 4.3, 3.3, VF, P), { tone: "mid" }));
  out.push(S(G.disc(4.3, 5.5, 1.2, VF, P), { tone: "hi" }));
  // Neck with its thread, then what the opening shows: the neck's bore, the dark of the boiler, the water.
  out.push(S(G.ringBand(NECK.z0, NECK.z1, NECK.rIn, NECK.rOut, AX, P), { tone: "hi", inner: Ln(THREADS, { tone: "faint" }) }));
  out.push(`<g class="mk-cav" clip-path="url(#mk-neck-hole)"><path class="mk-bore" d="${NECK_HOLE}"/><path class="mk-deep" d="${NECK_LOW}"/>`);
  out.push(`<g clip-path="url(#mk-neck-low)"><path class="mk-water" d="${poly(oct(B.apo1 + 3.2).map(([x, y]) => [x, y, WATER_Z]))}"/>${Ln([8, 16].map((r) => k.ring(-6, -6, r, WATER_Z, P, 40)).join(""), { tone: "faint" })}</g>`);
  out.push(`${Ln(G.arcOf(AX, NECK.z0, NECK.rIn, P, { inward: true }), { tone: "lo" })}</g>`);
  return out.join("");
}

// The neck's near half, drawn over the funnel's basket while it slides in.
function neckFront() {
  return S(G.ringBand(NECK.z0, NECK.z1, NECK.rIn, NECK.rOut, AX, P), { tone: "hi", inner: Ln(THREADS, { tone: "faint" }) });
}

// ── The funnel ───────────────────────────────────────────────────────────────────────────────────────────────
function funnelLow() {
  const seam = Ln(G.arcOf(AX, 68, FUNNEL.r, P), { tone: "faint" });
  return S(G.solidOf([[FUNNEL.tip, FUNNEL.stem], [FUNNEL.cone, FUNNEL.stem], [FUNNEL.basket[0], FUNNEL.r], [FUNNEL.basket[1], FUNNEL.r]], AX, P), { tone: "hi", inner: seam });
}

function grains() {
  const points = [];
  for (let row = -13; row <= 13; row++) {
    for (let column = -13; column <= 13; column++) {
      const jitter = Math.sin(row * 12.9898 + column * 78.233) * 43758.5453;
      const dx = (jitter - Math.floor(jitter) - 0.5) * 1.4;
      const dy = (Math.sin(row * 39.3468 + column * 11.135) * 24634.6345 % 1) * 1.4;
      const x = column * 2.2 + (row % 2) + dx;
      const y = row * 2 + dy;
      if (Math.hypot(x, y) < FUNNEL.rIn - 2.4) points.push(at([x, y, FUNNEL.coffee]));
    }
  }
  return points;
}

function funnelTop() {
  const out = [];
  const hole = G.circleOf(AX, FUNNEL.flange[1], FUNNEL.rIn, P);
  out.push(S(G.ringBand(FUNNEL.flange[0], FUNNEL.flange[1], FUNNEL.rIn, NECK.rOut, AX, P, { hole: [FUNNEL.flange[1], FUNNEL.rIn] }), { tone: "hi", className: "mk-holed" }));
  out.push(`<g clip-path="url(#mk-funnel-hole)"><path class="mk-bore" d="${hole}"/><path class="mk-coffee" d="${G.circleOf(AX, FUNNEL.coffee, FUNNEL.rIn, P)}"/>`);
  out.push(`<g class="mk-grain">${grains().map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r=".55"/>`).join("")}</g></g>`);
  return out.join("");
}

// ── Filter plate and gasket ──────────────────────────────────────────────────────────────────────────────────
function filterPlate() {
  const out = [S(G.disc(FILTER.z0, FILTER.z1, FILTER.r, AX, P), { tone: "hi" })];
  out.push(Ln(k.ring(0, 0, 25.5, FILTER.z1, P, 72), { tone: "faint" }));
  const holes = [];
  for (let row = -8; row <= 8; row++) {
    for (let column = -9; column <= 9; column++) {
      const x = column * 2.6 + (row % 2 ? 1.3 : 0);
      const y = row * 2.25;
      if (Math.hypot(x, y) < 22.5) holes.push(at([x, y, FILTER.z1]));
    }
  }
  out.push(D(holes, { size: 0.5, tone: "mid" }));
  return out.join("");
}

function gasket() {
  return `<g class="mk-bk">${S(G.ringBand(GASKET.z0, GASKET.z1, GASKET.rIn, GASKET.rOut, AX, P, { hole: [GASKET.z1, GASKET.rIn] }), { tone: "hi", crease: "lo", className: "mk-holed" })}</g>`;
}

// ── What is printed on the collector ─────────────────────────────────────────────────────────────────────────
// The little man with the moustache over BIALETTI on the front flat, traced from the photograph at 5× (one unit is
// 1/5 px of it, 0.0346 mm), drawn once in the flat's own plane and carried there by one matrix.
const INK = "#141412";
const PAPER = "#f7f6f2";
const OMINO = [
  // the raised arm: white up to the cuff stripe, black sleeve below
  { d: "M190 200 L220 200 L220 330 L190 330 Z", fill: PAPER, line: 8 },
  { d: "M190 252 L220 252 L220 262 L190 262 Z", fill: INK },
  { d: "M189 330 L221 330 L221 445 L189 445 Z", fill: INK },
  // the hand: index up, fist and thumb
  { d: "M205 138 L202 26 Q202 6 218 6 Q234 6 233 26 L228 132 Q246 138 246 166 Q246 196 222 200 L174 200 Q138 198 134 172 Q132 148 158 144 Q170 132 186 136 Z", fill: PAPER, line: 9 },
  { d: "M158 146 Q176 160 196 156 M150 170 Q176 182 204 172", line: 7 },
  // the hat with its two points, its brim, the closed eyes
  { d: "M268 348 L274 300 L300 216 L318 268 L342 194 L356 300 L356 348 Z", fill: INK },
  { d: "M244 350 L374 350 L374 362 L244 362 Z", fill: INK },
  { d: "M262 400 Q280 384 298 400 M308 400 Q326 384 344 400", line: 9 },
  { d: "M258 362 L258 432 M352 362 L352 432", line: 8 },
  // the moustache: a white bar ringed in black, dark underneath
  { d: "M178 475 Q178 430 236 430 L374 430 Q432 430 432 475 Q432 520 374 520 L236 520 Q178 520 178 475 Z", fill: PAPER, line: 10 },
  { d: "M176 520 Q176 562 214 562 L238 548 L376 548 L398 562 Q436 562 436 520 Q406 536 376 532 L238 532 Q204 536 176 520 Z", fill: INK },
  // face, neck and shirt front down to the collar
  { d: "M206 562 L204 650 L280 780 L374 744 L356 562 Z", fill: PAPER, line: 9 },
  // the jacket, the bow tie and the hand on the hip
  { d: "M204 650 L280 780 L300 792 L374 744 Q424 770 452 820 Q470 880 462 948 Q452 1004 410 1022 L168 1022 L74 916 Z", fill: INK },
  { d: "M226 828 L250 812 L264 852 L244 884 Z", fill: PAPER },
  { d: "M268 760 L292 776 L268 800 Z M296 776 L320 760 L320 800 Z", fill: INK },
  { d: "M382 968 m-11 0 a11 11 0 1 0 22 0 a11 11 0 1 0 -22 0 Z", fill: PAPER },
  // striped trousers
  { d: "M206 1022 L350 1022 L346 1100 L212 1100 Z", fill: PAPER, line: 8 },
  { d: "M226 1024 L228 1098 M246 1024 L248 1098 M266 1024 L267 1098 M286 1024 L286 1098 M306 1024 L305 1098 M326 1024 L324 1098", line: 9 },
  // shoes
  { d: "M164 1128 Q164 1098 212 1098 Q260 1098 260 1124 Q260 1152 210 1152 Q164 1152 164 1128 Z", fill: INK },
  { d: "M274 1126 Q274 1100 330 1100 Q390 1100 390 1126 Q390 1152 330 1152 Q274 1152 274 1126 Z", fill: INK },
];
// The wordmark: condensed heavy capitals with Bialetti's round e, 140 units tall, baseline at 1335.
const WORDMARK = [
  "M25 1195 L62 1195 Q78 1195 78 1214 L78 1240 Q78 1257 67 1263 Q82 1269 82 1290 L82 1313 Q82 1335 62 1335 L25 1335 Z M47 1213 L52 1213 Q57 1213 57 1219 L57 1246 Q57 1252 51 1252 L47 1252 Z M47 1272 L55 1272 Q61 1272 61 1279 L61 1310 Q61 1317 55 1317 L47 1317 Z",
  "M96 1195 L120 1195 L120 1335 L96 1335 Z",
  "M134 1335 L151 1195 L178 1195 L196 1335 L174 1335 L171 1306 L159 1306 L156 1335 Z M161 1286 L169 1286 L166 1226 L164 1226 Z",
  "M206 1195 L229 1195 L229 1314 L252 1314 L252 1335 L206 1335 Z",
  "M279 1195 L298 1195 Q318 1195 318 1215 L318 1279 L281 1279 L281 1313 L318 1313 L318 1335 L279 1335 Q259 1335 259 1315 L259 1215 Q259 1195 279 1195 Z M281 1216 L296 1216 L296 1257 L281 1257 Z",
  "M326 1195 L382 1195 L382 1217 L365 1217 L365 1335 L343 1335 L343 1217 L326 1217 Z",
  "M388 1195 L442 1195 L442 1217 L426 1217 L426 1335 L404 1335 L404 1217 L388 1217 Z",
  "M456 1195 L480 1195 L480 1335 L456 1335 Z",
];
const LOGO_UNIT = 0.0346;
const LOGO_X0 = 252;

const markOf = (parts) =>
  parts
    .map(({ d, fill, line }) => `<path d="${d}" fill="${fill ?? "none"}"${line ? ` stroke="${INK}" stroke-width="${line}" stroke-linejoin="round" stroke-linecap="round"` : ""}/>`)
    .join("");

// The affine map from logo units to the screen for a plane through `origin` spanned by `right` and `up` (unit vectors),
// logo y pointing down the plane.
function planeMatrix(origin, right, up, unit) {
  const O = at(origin);
  const r = sub2(at(G.add3(origin, right)), O);
  const u = sub2(at(G.add3(origin, up)), O);
  return `matrix(${fix(r[0] * unit)} ${fix(r[1] * unit)} ${fix(-u[0] * unit)} ${fix(-u[1] * unit)} ${fix(O[0])} ${fix(O[1])})`;
}

function frontLogo() {
  const n = [Math.SQRT1_2, Math.SQRT1_2];
  const bottom = [C.apo0 * n[0], C.apo0 * n[1], C.z0];
  const top = [C.apo1 * n[0], C.apo1 * n[1], C.z1];
  const up = G.unit3(G.sub3(top, bottom));
  // The wordmark's baseline 1 mm above the flat's bottom edge, centred on the flat.
  const origin = G.add3(bottom, G.mul3(up, 1));
  if (facing([n[0], n[1], 0]) < 0.05) return "";
  const m = planeMatrix(origin, RAD, up, LOGO_UNIT);
  return `<g class="mk-print" transform="${m}"><g transform="translate(${-LOGO_X0} -1335)">${markOf(OMINO)}<path d="${WORDMARK.join("")}" fill="${INK}" fill-rule="evenodd"/></g></g>`;
}

// "Moka Express" in a pen script round the skirt, the little man before it, "MADE IN ITALY" under it as three rules.
// Each glyph is a pen path in x-heights (baseline 0), smoothed and laid on the cylinder point by point.
const SCRIPT = [
  { w: 2.3, strokes: [[[0, 0.25], [0.2, 1.5], [0.38, 2.55], [0.5, 1.3], [0.72, 0.1], [0.95, 1.5], [1.18, 2.4], [1.32, 1.2], [1.52, 0.05], [1.75, 1.35], [1.96, 2.2], [2.06, 1.0], [2.14, 0.12], [2.3, 0.42]]] },
  { w: 0.95, strokes: [[[0, 0.42], [0.35, 0.95], [0.66, 0.84], [0.7, 0.38], [0.44, 0.02], [0.15, 0.22], [0.26, 0.76], [0.6, 0.95], [0.95, 0.72]]] },
  { w: 1.05, strokes: [[[0, 0.55], [0.36, 1.65], [0.5, 2.55], [0.3, 2.42], [0.2, 1.5], [0.12, 0], [0.2, 0.55], [0.55, 0.95], [0.58, 0.6], [0.26, 0.42], [0.56, 0.14], [0.76, 0], [1.05, 0.3]]] },
  { w: 1.05, strokes: [[[0, 0.3], [0.32, 0.86], [0.66, 0.9], [0.4, 1], [0.08, 0.6], [0.18, 0.04], [0.5, 0.2], [0.7, 0.9], [0.64, 0.24], [0.8, 0], [1.05, 0.3]]] },
  { w: 0.8, strokes: [] },
  { w: 1.7, strokes: [[[1.25, 2.2], [0.96, 2.55], [0.46, 2.45], [0.36, 1.96], [0.75, 1.46], [1.02, 1.4], [0.6, 1.34], [0.15, 1], [0.1, 0.34], [0.5, 0], [1.05, 0.1], [1.4, 0.44], [1.7, 0.55]]] },
  { w: 0.95, strokes: [[[0, 0.55], [0.25, 0.95], [0.45, 0.5], [0.6, 0.05], [0.95, 0.3]], [[0.18, 0.04], [0.5, 0.5], [0.8, 0.95]]] },
  { w: 1.05, strokes: [[[0, 0.3], [0.3, 0.95], [0.34, 0.3], [0.25, -1], [0.3, -0.1], [0.42, 0.62], [0.7, 0.95], [0.86, 0.55], [0.6, 0.04], [0.36, 0.16], [0.6, 0.16], [1.05, 0.34]]] },
  { w: 0.85, strokes: [[[0, 0.35], [0.25, 0.95], [0.36, 0.85], [0.4, 0], [0.46, 0.56], [0.66, 0.95], [0.85, 0.84]]] },
  { w: 0.85, strokes: [[[0, 0.3], [0.5, 0.6], [0.5, 0.92], [0.2, 0.85], [0.05, 0.35], [0.3, 0], [0.85, 0.3]]] },
  { w: 0.75, strokes: [[[0, 0.3], [0.35, 0.98], [0.4, 0.6], [0.6, 0.3], [0.45, 0], [0.12, 0.08], [0.75, 0.3]]] },
  { w: 0.75, strokes: [[[0, 0.3], [0.35, 0.98], [0.4, 0.6], [0.6, 0.3], [0.45, 0], [0.12, 0.08], [0.75, 0.3]]] },
];
const PRINT = { xHeight: 2.3, base: 72.8, from: -12, rules: 68.9, front: Math.PI / 4 };

// Catmull-Rom through the pen's points, sampled.
function smooth(points, per = 6) {
  const out = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const [p1, p2] = [points[i], points[i + 1]];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    for (let s = 0; s < per; s++) {
      const t = s / per;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push([0, 1].map((c) => 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)));
    }
  }
  out.push(points[points.length - 1]);
  return out;
}
// A point printed on the skirt: s mm along the surface toward screen right of the front, at height z.
const onSkirt = (s, z) => {
  const angle = PRINT.front - s / (SKIRT.r + 0.05);
  return at([(SKIRT.r + 0.05) * Math.cos(angle), (SKIRT.r + 0.05) * Math.sin(angle), z]);
};
// Once the collector turns, part of the print goes round the back: keep only the runs on the side facing the viewer.
const seenOnSkirt = (s, margin = 0.06) => {
  const angle = PRINT.front - s / SKIRT.r;
  return facing([Math.cos(angle), Math.sin(angle), 0]) > margin;
};
const skirtPath = (points) => {
  const runs = [[]];
  for (const [s, z] of points) {
    if (seenOnSkirt(s)) runs[runs.length - 1].push(onSkirt(s, z));
    else if (runs[runs.length - 1].length) runs.push([]);
  }
  return runs.filter((run) => run.length > 1).map((run) => k.pathOf(run)).join("");
};

function skirtPrint() {
  const h = PRINT.xHeight;
  const paths = [];
  let x = PRINT.from;
  for (const glyph of SCRIPT) {
    for (const stroke of glyph.strokes) paths.push(skirtPath(smooth(stroke.map(([u, v]) => [x + u * h * 0.92, PRINT.base + v * h]))));
    x += glyph.w * h * 0.92;
  }
  const script = `<path d="${paths.join("")}" fill="none" stroke="#2a2a27" stroke-width="${fix(0.5 * P.scale * Math.sqrt(1.6))}" stroke-linecap="round" stroke-linejoin="round"/>`;
  // The little man before the script: the front flat's mark at a fifth of its size, on the skirt's tangent plane there.
  const s0 = PRINT.from - 4;
  const angle = PRINT.front - s0 / SKIRT.r;
  const origin = [(SKIRT.r + 0.05) * Math.cos(angle), (SKIRT.r + 0.05) * Math.sin(angle), 71];
  const right = [Math.sin(angle), -Math.cos(angle), 0];
  const small = seenOnSkirt(s0, 0.3) ? `<g transform="${planeMatrix(origin, right, [0, 0, 1], LOGO_UNIT * 0.19)}"><g transform="translate(-300 -1152)">${markOf(OMINO)}</g></g>` : "";
  // MADE IN ITALY under the script's middle: one rule per word, as long as the word.
  const words = [[-6.4, -1.8], [-0.8, 0.9], [1.9, 9.8]];
  const rules = words.map(([a, b]) => skirtPath(Array.from({ length: 9 }, (_, i) => [a + ((b - a) * i) / 8, PRINT.rules]))).join("");
  return `<g class="mk-print">${script}${small}<path d="${rules}" fill="none" stroke="#5e5d58" stroke-width="${fix(1.1 * P.scale * Math.sqrt(1.6))}" stroke-linecap="butt"/></g>`;
}

// ── The collector ────────────────────────────────────────────────────────────────────────────────────────────
const OPENING = oct(C.apo1 - C.wall).map(([x, y]) => [x, y, C.z1]);

// Handle in black bakelite, then the aluminium bracket over its root with the hinge pin through it; the plates show
// whichever broad face is turned to the viewer, and the pin's head sits on that side.
function handleSet() {
  const HF = { o: [0, 0, 0], u: RAD, a: THICK };
  const side = facing(THICK) >= 0 ? 1 : -1;
  const out = [`<g class="mk-bk">${plate(HANDLE, HF, -6 * side, 6 * side)}</g>`, plate(BRACKET, HF, -7 * side, 7 * side)];
  const PF = G.frameAlong(world(inPlane([PIN.u, PIN.z])), G.mul3(world(THICK), side));
  out.push(S(G.disc(7, 7.7, PIN.r, PF, P), { tone: "mid" }));
  out.push(D([at(G.pointOf(PF, 7.7, 0, 0))], { size: 0.5, tone: "hi" }));
  out.push(D([at(inPlane([47.6, 131], 7 * side)), at(inPlane([47.6, 128.6], 7 * side))], { size: 0.45, tone: "lo" }));
  return out.join("");
}

function collector() {
  const out = [];
  // Through a turn the handle and the spout each pass behind the pot: drawn first then, last otherwise.
  const handleBehind = facing(RAD) < -1e-6;
  const spoutBehind = facing([nS[0], nS[1], 0]) < -1e-6;
  if (handleBehind) out.push(handleSet());
  if (spoutBehind) out.push(spout());
  // The threaded skirt, eased at its lower edge, with its print.
  out.push(S(G.solidOf([[SKIRT.z0, SKIRT.r - SKIRT.ease], [SKIRT.z0 + SKIRT.ease, SKIRT.r], [SKIRT.z1, SKIRT.r]], AX, P), { tone: "hi" }));
  out.push(skirtPrint());
  const body = frustum(C.apo0, C.apo1, C.z0, C.z1, { cap: false });
  out.push(S({ ...body, top: "" }, { tone: "hi" }).replace(/<path class="iso-line iso-edge"[^>]*\/><\/g>$/, "</g>"));
  // Inside, seen through the opening: floor, the far walls, the column with its mouth.
  const inner = { apo0: SKIRT.r - C.wall, apo1: C.apo1 - C.wall };
  const lowIn = oct(inner.apo0).map(([x, y]) => [x, y, C.floor]);
  const highIn = oct(inner.apo1).map(([x, y]) => [x, y, C.z1]);
  const walls = [];
  for (let j = 0; j < 8; j++) {
    const next = (j + 1) % 8;
    let n = G.unit3(G.cross3(G.sub3(lowIn[next], lowIn[j]), G.sub3(highIn[j], lowIn[j])));
    const mid = G.mul3(G.add3(lowIn[j], lowIn[next]), 0.5);
    if (n[0] * mid[0] + n[1] * mid[1] > 0) n = G.mul3(n, -1);
    if (facing(n) <= 1e-6) continue;
    walls.push(`<path class="iso-shade" data-shade="${flatTone(world(n))}" d="${poly([lowIn[j], lowIn[next], highIn[next], highIn[j]])}"/>`);
    walls.push(Ln(k.pathOf([at(lowIn[j]), at(highIn[j])]), { tone: "faint" }));
  }
  out.push(`<g class="mk-cav" clip-path="url(#mk-opening)"><path class="iso-fill" d="${poly(OPENING)}"/><path class="mk-deep" d="${poly(lowIn)}"/>${walls.join("")}`);
  out.push(S(G.ringBand(C.floor, C.floor + 1.4, 4.5, 7.6, AX, P), { tone: "mid" }));
  out.push(S(G.solidOf([[C.floor + 1.4, 4.5], [119.5, 4.5], [122.4, 6.4], [124, 6.4]], AX, P), { tone: "mid" }));
  out.push(`<path class="mk-deep" d="${G.circleOf(AX, 124, 5, P)}"/>${Ln(G.circleOf(AX, 124, 5, P), { tone: "lo" })}</g>`);
  // Rim: the flat ring between the outer and inner octagons, with its two edges.
  const rimOuter = oct(C.apo1).map(([x, y]) => [x, y, C.z1]);
  out.push(`<path class="iso-top" fill-rule="evenodd" d="${poly(rimOuter)}${poly([...OPENING].reverse())}"/>`);
  out.push(Ln(poly(OPENING), { tone: "lo" }));
  out.push(Ln(body.seen.map((seen, j) => (seen ? k.pathOf([body.hi2[j], body.hi2[(j + 1) % 8]]) : "")).join(""), { tone: "faint" }));
  out.push(`<g class="iso-solid"><path class="iso-line iso-edge" data-tone="hi" d="${body.outline}"/></g>`);
  out.push(frontLogo());
  if (!spoutBehind) out.push(spout());
  if (!handleBehind) out.push(handleSet());
  return out.join("");
}

// The spout: two thin walls run from the 135° flat, just under the lid, to the tip and down its keel to the flat.
// From above the channel between them shows, darker toward the pot where it is deep; the near wall faces the viewer,
// the far one only from inside. A pale rule on the near lip stands for its rolled edge.
function spout() {
  const [A, Bk, T, K] = [SPOUT_A, SPOUT_B, SPOUT_T, SPOUT_K];
  const outward = (p, q) => {
    const n = G.unit3(G.cross3(G.sub3(T, p), G.sub3(K, p)));
    return G.dot3(n, G.sub3(q, p)) > 0 ? G.mul3(n, -1) : n;
  };
  const wallOf = (p, q) => {
    const n = outward(p, q);
    if (facing(n) <= 1e-6) return { depth: -Infinity, svg: "" };
    const tone = toneFor(n);
    const d = poly([p, T, K]);
    const shade = tone === 4 ? `<path class="iso-top" d="${d}"/>` : `<path class="iso-shade" data-shade="${tone}" d="${d}"/>`;
    return { depth: facing(G.mul3(G.add3(G.add3(p, T), K), 1 / 3)), svg: `<g class="iso-solid"><path class="iso-fill" d="${d}"/>${shade}<path class="iso-line iso-edge" data-tone="hi" d="${d}"/></g>` };
  };
  const along = (from, t) => G.lerp3(from, T, t);
  const band = (t0, t1) => poly([along(A, t0), along(Bk, t0), along(Bk, t1), along(A, t1)]);
  const near = wallOf(A, Bk);
  const lip = (t) => G.add3(G.lerp3(A, T, t), [0, 0, -0.7]);
  const walls = [near, wallOf(Bk, A)].sort((a, b) => a.depth - b.depth).map((wall) => wall.svg);
  return [
    `<g class="mk-cav"><path class="iso-fill" d="${poly([A, Bk, T])}"/>`,
    `<path class="iso-shade" data-shade="3" d="${poly([along(A, 0.55), along(Bk, 0.55), T])}"/>`,
    `<path class="iso-shade" data-shade="1" d="${band(0.22, 0.55)}"/>`,
    `<path class="mk-deep" d="${band(0, 0.22)}"/></g>`,
    Ln(k.pathOf([at(A), at(T), at(Bk)]), { tone: "hi" }),
    ...walls,
    near.svg ? Ln(k.pathOf([at(lip(0)), at(lip(0.92))]), { tone: "faint", free: "end" }) : "",
  ].join("");
}

// ── The lid ──────────────────────────────────────────────────────────────────────────────────────────────────
function lid() {
  const out = [];
  const HF = { o: [0, 0, 0], u: RAD, a: THICK };
  out.push(plate(TAB, HF, -4.6, 4.6));
  out.push(S(frustum(LID.apo0, LID.apo0, LID.z0, LID.z0 + LID.band, { cap: false }), { tone: "hi" }));
  out.push(S(frustum(LID.apo0, LID.apo1, LID.z0 + LID.band, LID.z1), { tone: "hi" }));
  out.push(`<g class="mk-bk">`);
  out.push(S(frustum(KNOB.c0, KNOB.c1, KNOB.collar[0], KNOB.collar[1]), { tone: "hi", crease: "lo" }));
  out.push(S(frustum(KNOB.b0, KNOB.b1, KNOB.body[0], KNOB.body[1], { cap: false }), { tone: "hi", crease: "lo" }));
  out.push(S(frustum(KNOB.b1, 1e-4, KNOB.body[1], KNOB.tip, { cap: false }), { tone: "hi", crease: "lo" }));
  out.push(`</g>`);
  return out.join("");
}

// ── Steam over the spout once it brews ──────────────────────────────────────────────────────────────────────
// Three soft plumes leave the spout's mouth: each a ribbon that widens as it rises, sways, leans away from the pot,
// and fades in at its foot and out at its top through a vertical gradient, softened by a light blur. Each is its own
// layer so the page can loop them out of step.
const STEAM_FOOT = at(G.lerp3(SPOUT_T, G.lerp3(SPOUT_A, SPOUT_B, 0.5), 0.3));
// Short enough to stay under the knob's height once the camera has closed in.
const WISPS = [
  { foot: -1.5, rise: 58, lean: -9, sway: 3.2, phase: 0.4, width: 4.2 },
  { foot: 2, rise: 46, lean: 4, sway: 2.6, phase: 2.6, width: 3.4 },
  { foot: -3, rise: 66, lean: -17, sway: 3.8, phase: 4.4, width: 4.8 },
];
function wisp({ foot, rise, lean, sway, phase, width }, index) {
  const [x0, y0] = [STEAM_FOOT[0] + foot, STEAM_FOOT[1]];
  const left = [];
  const right = [];
  for (let i = 0; i <= 36; i++) {
    const t = i / 36;
    const x = x0 + lean * t * t + Math.sin(t * 5.4 + phase) * sway * t;
    const y = y0 - rise * t;
    const half = 0.5 + width * Math.pow(t, 0.75) * (1 - 0.3 * t);
    left.push([x - half, y]);
    right.push([x + half, y]);
  }
  const id = `mk-wisp-${index}`;
  return `<defs><linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${fix(x0)}" y1="${fix(y0)}" x2="${fix(x0)}" y2="${fix(y0 - rise)}"><stop offset="0" stop-color="#a9a7a0" stop-opacity="0"/><stop offset=".14" stop-color="#a9a7a0" stop-opacity=".55"/><stop offset=".5" stop-color="#b3b1a9" stop-opacity=".34"/><stop offset="1" stop-color="#b3b1a9" stop-opacity="0"/></linearGradient><filter id="${id}-soft" x="-60%" y="-20%" width="220%" height="140%"><feGaussianBlur stdDeviation="1.6"/></filter></defs><path d="${k.pathOf([...left, ...right.reverse()], true)}" fill="url(#${id})" filter="url(#${id}-soft)"/>`;
}
const steam = () => WISPS.map((shape, index) => `<g data-wisp="${index}">${wisp(shape, index)}</g>`).join("");

// ── Clips: the boiler's openings, the funnel's mouth, the collector's opening, and the band the basket hides in
const yNeck = at([0, 0, NECK.z1])[1];
const front = (z, r) => {
  const points = [];
  for (let i = 0; i <= 48; i++) {
    const angle = (3 * Math.PI) / 4 - (i / 48) * Math.PI;
    points.push(at([r * Math.cos(angle), r * Math.sin(angle), z]));
  }
  return points;
};
const lowEdge = front(NECK.z0, NECK.rOut);
const BASKET_CLIP = k.pathOf([[lowEdge[0][0], -10], ...lowEdge, [lowEdge[lowEdge.length - 1][0], -10]], true);
const NECK_FRONT_CLIP = k.pathOf([[0, yNeck - 0.2], [WIDTH, yNeck - 0.2], [WIDTH, HEIGHT], [0, HEIGHT]], true);
// The hole is cut out of the whole frame, in a clip of its own: cut out of the band alone, evenodd would paint
// the hole's far half, which sticks out above the band, over the opening.
const NECK_OUT_CLIP = `${k.pathOf([[0, 0], [WIDTH, 0], [WIDTH, HEIGHT], [0, HEIGHT]], true)}${NECK_HOLE}`;
const defs = `<defs>
<clipPath id="mk-neck-hole"><path d="${NECK_HOLE}"/></clipPath>
<clipPath id="mk-neck-low"><path d="${NECK_LOW}"/></clipPath>
<clipPath id="mk-funnel-hole"><path d="${G.circleOf(AX, FUNNEL.flange[1], FUNNEL.rIn, P)}"/></clipPath>
<clipPath id="mk-opening"><path d="${poly(OPENING)}"/></clipPath>
<clipPath id="mk-basket"><path d="${BASKET_CLIP}"/></clipPath>
<clipPath id="mk-neck-front"><path d="${NECK_FRONT_CLIP}"/></clipPath>
<clipPath id="mk-neck-out"><path clip-rule="evenodd" d="${NECK_OUT_CLIP}"/></clipPath>
<filter id="mk-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9"/></filter>
</defs>`;

const boundsOf = (points) => {
  const flat = points.map(at);
  return { top: Math.min(...flat.map(([, y]) => y)), bottom: Math.max(...flat.map(([, y]) => y)), left: Math.min(...flat.map(([x]) => x)), right: Math.max(...flat.map(([x]) => x)) };
};
const FRAME = Object.fromEntries(Object.entries(EXTENT).map(([name, points]) => [name, boundsOf(points)]));
const RISE = k.screenRise(1, P);

const lift = (name) => k.translateAlong(P, [0, 0, OFF[name]]);
const LAYERS = {
  stove: stove(),
  knobOff: knobOff(),
  knobOn: knobOn(),
  glow: glow(),
  grate: stoveGrate(),
  boiler: boiler(),
  funnelLow: funnelLow(),
  neckFront: neckFront(),
  funnelTop: funnelTop(),
  filter: filterPlate(),
  gasket: gasket(),
  collector: collector(),
  lid: lid(),
  steam: steam(),
};

// ── Layers as standalone SVG: the theme resolved into attributes, since an image drops its <style>.
const TOKENS = {
  base: { paper: "#efeee9", face: "#f7f6f2", top: "#f8f7f3", shades: ["#d3d1c9", "#dcdad3", "#e4e2dc", "#ebeae4"], hi: "#141412", mid: "#8b8982", lo: "#b3b1a9", faint: "#d2d0c8", lit: "#ff5b14" },
  "mk-bk": { paper: "#2b2a27", face: "#34332f", top: "#3c3b36", shades: ["#1c1b19", "#222120", "#282725", "#2f2e2b"], faint: "#4a4944", lo: "#56544f" },
  "mk-cav": { paper: "#c9c7bf", top: "#d6d4cd", shades: ["#b6b4ac", "#bdbbb3", "#c4c2ba", "#cbc9c1"], faint: "#aeaca4", lo: "#9c9a93", mid: "#85837c" },
};
const DOT_OPACITY = { hi: 0.85, mid: 0.45, lo: 0.22, faint: 0.12 };
const FILLS = { "mk-bore": "#bebcb4", "mk-deep": "#a9a7a0", "mk-water": "#d8d7d0", "mk-coffee": "#1c1b19" };

// `lit` strokes the piece's own outlines in the signal colour where they are drawn, so fills still hide the ones behind.
function resolve(markup, { lit = false } = {}) {
  const stack = [{ tokens: TOKENS.base }];
  const write = (name, attrs, close) => `<${name}${Object.entries(attrs).map(([key, value]) => ` ${key}="${value}"`).join("")}${close ? "/" : ""}>`;
  return markup.replace(/<(\/?)([\w:]+)([^>]*?)(\/?)>/g, (whole, slash, name, rest, close) => {
    if (slash) {
      if (name === "g") stack.pop();
      return whole;
    }
    const attrs = Object.fromEntries([...rest.matchAll(/([\w:-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
    const here = stack[stack.length - 1];
    const cls = (attrs.class ?? "").split(/\s+/);
    const out = Object.fromEntries(Object.entries(attrs).filter(([key]) => key !== "class" && key !== "style" && !key.startsWith("data-")));
    if (name === "g") {
      const context = { ...here };
      for (const material of ["mk-bk", "mk-cav"]) if (cls.includes(material)) context.tokens = { ...context.tokens, ...TOKENS[material] };
      if (cls.includes("iso-solid")) Object.assign(context, { seamless: "data-seamless" in attrs, holed: cls.includes("mk-holed") });
      if (cls.includes("iso-dots")) Object.assign(out, { fill: "#2a2a27", opacity: DOT_OPACITY[attrs["data-tone"] ?? "mid"] });
      if (cls.includes("mk-grain")) out.fill = "#5a5852";
      if (!close) stack.push(context);
      return write("g", out, close);
    }
    const t = here.tokens;
    const thin = { "stroke-width": "0.4", "stroke-linejoin": "round", "vector-effect": "non-scaling-stroke" };
    if (cls.includes("iso-fill")) Object.assign(out, { fill: t.paper }, here.holed ? { "fill-rule": "evenodd" } : {});
    else if (cls.includes("iso-shade")) {
      const colour = t.shades[Number(attrs["data-shade"])];
      Object.assign(out, { fill: colour }, here.seamless ? { stroke: colour, ...thin } : {});
    } else if (cls.includes("iso-top")) Object.assign(out, { fill: t.top }, here.seamless ? { stroke: t.top, ...thin } : {});
    else if (cls.includes("iso-line") && lit && cls.includes("iso-edge")) Object.assign(out, { fill: "none", stroke: "#ff5b14", "stroke-width": "1.1", "stroke-linecap": "round", "stroke-linejoin": "round", "vector-effect": "non-scaling-stroke" });
    else if (cls.includes("iso-line")) Object.assign(out, { fill: "none", stroke: t[attrs["data-tone"] ?? "lo"] ?? t.lo, "stroke-width": "0.6", "stroke-linecap": "round", "stroke-linejoin": "round", "vector-effect": "non-scaling-stroke" });
    else if (cls.includes("iso-halo")) Object.assign(out, { fill: "#6f6d66", opacity: "0.3", filter: "url(#mk-blur)", transform: "translate(0 3)" });
    else if (cls.includes("mk-glow")) Object.assign(out, { fill: "#ff5b14", filter: "url(#mk-blur)" });
    else for (const [klass, fill] of Object.entries(FILLS)) if (cls.includes(klass)) out.fill = fill;
    return write(name, out, close);
  });
}

const fullFrame = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}">${inner}</svg>`;
const svgFile = (content) => fullFrame(`${resolve(defs)}${resolve(content)}`);
// The silhouettes of a moving piece, stroked in the signal colour: shown while the piece travels.
const edgesOf = (...contents) => {
  const d = contents.flatMap((content) => [...content.matchAll(/<path class="iso-line iso-edge"[^>]*? d="([^"]*)"/g)].map((m) => m[1])).join("");
  return `<path d="${d}" fill="none" stroke="#ff5b14" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
};
// A piece stacked from several solids glints as a lit copy of itself: stroked alone, each solid's silhouette would
// cross the ones in front of it (the boiler's body behind its shoulder, the knob's collar behind the knob).
const litOf = (content) => resolve(content, { lit: true });

// ── Cropped layers: each image only as large as what it draws, so that the page decodes and composites less.
// The box comes from the geometry, not from a rasterizer, so that a run gives the same files on any machine: every
// point a path or a circle goes through (curves by their control points, arcs by twice their radii, so the box can
// only come out too large), plus a blur's reach and room for the hairlines, which keep their width on screen at any
// scale. Whole pixels, so that the box is exact in percent of the frame too.
const STROKE_ROOM = 4;
const attributesOf = (rest) => Object.fromEntries([...rest.matchAll(/([\w:-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
const multiply = ([a, b, c, d, e, f], [A, B, C, D, E, F]) => [a * A + c * B, b * A + d * B, a * C + c * D, b * C + d * D, a * E + c * F + e, b * E + d * F + f];
function matrixOf(transform) {
  if (!transform) return [1, 0, 0, 1, 0, 0];
  const [, kind, args] = transform.match(/^(\w+)\(([^)]*)\)$/) ?? [];
  const n = (args ?? "").trim().split(/[\s,]+/).map(Number);
  if (kind === "translate") return [1, 0, 0, 1, n[0], n[1] ?? 0];
  if (kind === "matrix" && n.length === 6) return n;
  throw new Error(`cropping: transform ${transform} not handled`);
}
const ARITY = { M: 2, L: 2, C: 6, S: 4, Q: 4, T: 2 };
function pointsOfPath(d) {
  const tokens = d.match(/[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) ?? [];
  const points = [];
  let i = 0, command = "", x = 0, y = 0, startX = 0, startY = 0;
  const next = () => Number(tokens[i++]);
  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i])) command = tokens[i++];
    const kind = command.toUpperCase();
    const [ox, oy] = command === kind ? [0, 0] : [x, y];
    if (kind === "Z") {
      [x, y] = [startX, startY];
      if (i < tokens.length && !/[A-Za-z]/.test(tokens[i])) throw new Error("cropping: numbers after Z");
    } else if (kind === "H") points.push([(x = next() + ox), y]);
    else if (kind === "V") points.push([x, (y = next() + oy)]);
    else if (kind === "A") {
      const [rx, ry] = [Math.abs(next()), Math.abs(next())];
      i += 3;
      [x, y] = [next() + ox, next() + oy];
      points.push([x - 2 * rx, y - 2 * ry], [x + 2 * rx, y - 2 * ry], [x - 2 * rx, y + 2 * ry], [x + 2 * rx, y + 2 * ry]);
    } else if (ARITY[kind]) {
      for (let j = 0; j < ARITY[kind]; j += 2) points.push([next() + ox, next() + oy]);
      [x, y] = points[points.length - 1];
      if (kind === "M") [startX, startY, command] = [x, y, command === "M" ? "L" : "l"];
    } else throw new Error(`cropping: path command ${command} not handled`);
  }
  return points;
}
function boxOf(markup) {
  const sigma = Object.fromEntries([...markup.matchAll(/<filter id="([^"]+)"[^>]*>\s*<feGaussianBlur stdDeviation="([\d.]+)"/g)].map((m) => [m[1], Number(m[2])]));
  let [left, top, right, bottom] = [Infinity, Infinity, -Infinity, -Infinity];
  const stack = [[1, 0, 0, 1, 0, 0]];
  let inDefs = 0;
  for (const [, slash, name, rest, close] of markup.matchAll(/<(\/?)([\w:]+)([^>]*?)(\/?)>/g)) {
    if (name === "defs") inDefs += close ? 0 : slash ? -1 : 1;
    if (inDefs || name === "defs" || (slash && name !== "g")) continue;
    const attrs = attributesOf(rest);
    const matrix = multiply(stack[stack.length - 1], matrixOf(attrs.transform));
    if (name === "g") {
      if (attrs.filter) throw new Error("cropping: a filter on a group is not handled");
      if (slash) stack.pop();
      else if (!close) stack.push(matrix);
      continue;
    }
    const points =
      name === "path" ? pointsOfPath(attrs.d)
      : name === "circle" ? [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy]) => [Number(attrs.cx) + sx * Number(attrs.r), Number(attrs.cy) + sy * Number(attrs.r)])
      : null;
    if (!points) throw new Error(`cropping: <${name}> not handled`);
    const blur = attrs.filter ? sigma[attrs.filter.slice(5, -1)] : 0;
    if (blur === undefined) throw new Error(`cropping: filter ${attrs.filter} not found`);
    const reach = STROKE_ROOM + 3 * blur;
    for (const [px, py] of points) {
      const [a, b, c, d, e, f] = matrix;
      const [sx, sy] = [a * px + c * py + e, b * px + d * py + f];
      [left, top, right, bottom] = [Math.min(left, sx - reach), Math.min(top, sy - reach), Math.max(right, sx + reach), Math.max(bottom, sy + reach)];
    }
  }
  const x = Math.max(0, Math.floor(left));
  const y = Math.max(0, Math.floor(top));
  return { x, y, w: Math.min(WIDTH, Math.ceil(right)) - x, h: Math.min(HEIGHT, Math.ceil(bottom)) - y };
}
// Only the clips and filters the layer uses: every layer would otherwise carry the whole pot's.
const usedDefs = (inner) => {
  const used = [...resolve(defs).matchAll(/<(clipPath|filter) id="([^"]+)"[\s\S]*?<\/\1>/g)].filter((m) => inner.includes(`url(#${m[2]})`)).map((m) => m[0]);
  return used.length ? `<defs>${used.join("")}</defs>` : "";
};
// ── Relative paths: the layers' paths are written in relative coordinates (`l`, `h`, `v`, `q`, repeated commands
// left implicit), shorter than the absolute ones the kit draws: 58.5 → 35.5 KB of brotli for the 21 layers
// (369.6 → 235.0 KB raw). Every coordinate is a whole number of tenths (the kit rounds each point to 0.1), so the
// differences are taken in whole tenths: the paths go through exactly the same points, which the run checks.
const tenthsOf = (token) => {
  if (!/^-?(?:\d+|\d*\.\d)$/.test(token)) throw new Error(`relative paths: ${token} is not a whole number of tenths`);
  return Math.round(Number(token) * 10);
};
const shortNumber = (tenths) => String(tenths / 10).replace(/^(-?)0\./, "$1.");
function relativePath(d) {
  const tokens = d.match(/[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)/g) ?? [];
  const segments = [];
  let i = 0, command = "", x = 0, y = 0, startX = 0, startY = 0;
  const point = (relative) => {
    const [px, py] = [tenthsOf(tokens[i++]), tenthsOf(tokens[i++])];
    return relative ? [x + px, y + py] : [px, py];
  };
  const delta = ([px, py]) => [px - x, py - y].map(shortNumber);
  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i])) command = tokens[i++];
    const kind = command.toUpperCase();
    const relative = command !== kind;
    if (kind === "Z") {
      if (i < tokens.length && !/[A-Za-z]/.test(tokens[i])) throw new Error("relative paths: numbers after Z");
      segments.push(["z", []]);
      [x, y] = [startX, startY];
    } else if (kind === "M") {
      const to = point(relative);
      segments.push(segments.length ? ["m", delta(to)] : ["M", to.map(shortNumber)]);
      [x, y, startX, startY] = [...to, ...to];
      command = relative ? "l" : "L";
    } else if (kind === "L" || kind === "H" || kind === "V") {
      const to =
        kind === "L" ? point(relative)
        : kind === "H" ? [tenthsOf(tokens[i++]) + (relative ? x : 0), y]
        : [x, tenthsOf(tokens[i++]) + (relative ? y : 0)];
      const [dx, dy] = delta(to);
      segments.push(dy === "0" ? ["h", [dx]] : dx === "0" ? ["v", [dy]] : ["l", [dx, dy]]);
      [x, y] = to;
    } else if (kind === "Q") {
      const [control, to] = [point(relative), point(relative)];
      segments.push(["q", [...delta(control), ...delta(to)]]);
      [x, y] = to;
    } else if (kind === "A") {
      // Radii, rotation and flags are not coordinates: kept as written.
      const shape = tokens.slice(i, (i += 5));
      const to = point(relative);
      segments.push(["a", [...shape, ...delta(to)]]);
      [x, y] = to;
    } else throw new Error(`relative paths: path command ${command} not handled`);
  }
  // A command repeating the one before is left implicit, a line after a move too; a minus sign or a second decimal
  // point separates two numbers on its own.
  let out = "", implicit = "", last = "";
  for (const [letter, numbers] of segments) {
    if (letter !== implicit) out += letter;
    else if (!numbers[0].startsWith("-") && !(numbers[0].startsWith(".") && last.includes("."))) out += " ";
    numbers.forEach((number, at) => {
      if (at && !number.startsWith("-") && !(number.startsWith(".") && last.includes("."))) out += " ";
      out += number;
      last = number;
    });
    implicit = letter === "m" ? "l" : letter === "M" ? "L" : letter === "z" ? "" : letter;
  }
  const same = (path) => pointsOfPath(path).map((p) => p.map((v) => v.toFixed(1)).join(" ")).join();
  if (same(out) !== same(d)) throw new Error(`relative paths: ${d} does not go through the same points as ${out}`);
  return out;
}
const croppedLayer = (inner) => {
  const markup = `${usedDefs(inner)}${inner}`;
  const box = boxOf(markup);
  const relative = markup.replace(/ d="([^"]*)"/g, (_, d) => ` d="${relativePath(d)}"`);
  return { box, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.x} ${box.y} ${box.w} ${box.h}" width="${box.w}" height="${box.h}">${relative}</svg>` };
};

if (PHOTO) {
  // The assembled pot alone, then its edges in red, both over the photograph's frame.
  const pot = `${LAYERS.boiler}${LAYERS.collector}${LAYERS.lid}`;
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, "photo.svg"), svgFile(pot));
  writeFileSync(join(OUT, "photo-edges.svg"), fullFrame(edgesOf(pot).replace('stroke="#ff5b14"', 'stroke="#e0002a"')));
  console.log("wrote photo.svg, photo-edges.svg");
  process.exit(0);
}

const body = [
  defs,
  `<g data-part="camera">`,
  LAYERS.stove,
  `<g data-part="knob-off">${LAYERS.knobOff}</g>`,
  `<g data-part="knob-on" style="opacity:0">${LAYERS.knobOn}</g>`,
  `<g data-part="glow" style="opacity:0">${LAYERS.glow}</g>`,
  LAYERS.grate,
  `<g data-part="boiler" transform="${lift("boiler")}">${LAYERS.boiler}</g>`,
  `<g clip-path="url(#mk-basket)"><g data-part="funnel" transform="${lift("funnel")}">${LAYERS.funnelLow}</g></g>`,
  `<g data-part="boiler" transform="${lift("boiler")}"><g clip-path="url(#mk-neck-front)"><g clip-path="url(#mk-neck-out)">${LAYERS.neckFront}</g></g></g>`,
  `<g data-part="funnel" transform="${lift("funnel")}">${LAYERS.funnelTop}</g>`,
  `<g data-part="filter" transform="${lift("filter")}">${LAYERS.filter}</g>`,
  `<g data-part="gasket" transform="${lift("gasket")}">${LAYERS.gasket}</g>`,
  `<g data-part="collector" transform="${lift("collector")}">${LAYERS.collector}</g>`,
  `<g data-part="lid" transform="${lift("lid")}">${LAYERS.lid}</g>`,
  `<g data-part="steam" style="opacity:0">${LAYERS.steam}</g>`,
  `</g>`,
];

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "Une Moka Express trois tasses en pièces au-dessus d’un réchaud à gaz : la chaudière octogonale avec sa soupape, l’entonnoir rempli de café moulu, le filtre, le joint, le collecteur avec sa jupe filetée, son bec, sa poignée et le petit bonhomme à moustache, le couvercle et son bouton à facettes. Faire défiler les remet en place une à une, puis le feu s’allume et la vapeur sort du bec.",
  body,
});

const EXTRA_CSS = `
.iso[data-theme="light"]{
  --anatomy-page:#efeee9;--anatomy-card:#efeee9;--anatomy-text:#5e5d58;--anatomy-strong:#141412;--anatomy-muted:#5e5d58;
  --anatomy-paper:#efeee9;--anatomy-face:#f7f6f2;--anatomy-top:#f8f7f3;
  --anatomy-shade-0:#d3d1c9;--anatomy-shade-1:#dcdad3;--anatomy-shade-2:#e4e2dc;--anatomy-shade-3:#ebeae4;
  --anatomy-lit-top:#ffffff;--anatomy-lit-shade:#f3f2ed;
  --anatomy-hi:#141412;--anatomy-mid:#8b8982;--anatomy-lo:#b3b1a9;--anatomy-faint:#d2d0c8;--anatomy-lit:#ff5b14;
  --anatomy-halo:#6f6d66;--anatomy-halo-opacity:.3;--anatomy-dot:#2a2a27;
  --anatomy-mono:"Fragment Mono",ui-monospace,Menlo,monospace;
}
.iso .iso-solid[data-lit]>.iso-fill{fill:var(--anatomy-paper)}
.iso .iso-solid[data-lit]>.iso-top{fill:var(--anatomy-top)}
.iso .iso-solid[data-lit]>.iso-shade[data-shade="0"]{fill:var(--anatomy-shade-0)}
.iso .iso-solid[data-lit]>.iso-shade[data-shade="1"]{fill:var(--anatomy-shade-1)}
.iso .iso-solid[data-lit]>.iso-shade[data-shade="2"]{fill:var(--anatomy-shade-2)}
.iso .iso-solid[data-lit]>.iso-shade[data-shade="3"]{fill:var(--anatomy-shade-3)}
.iso .iso-solid[data-seamless][data-lit]>.iso-shade[data-shade="0"]{stroke:var(--anatomy-shade-0)}
.iso .iso-solid[data-seamless][data-lit]>.iso-shade[data-shade="1"]{stroke:var(--anatomy-shade-1)}
.iso .iso-solid[data-seamless][data-lit]>.iso-shade[data-shade="2"]{stroke:var(--anatomy-shade-2)}
.iso .iso-solid[data-seamless][data-lit]>.iso-shade[data-shade="3"]{stroke:var(--anatomy-shade-3)}
.iso .iso-solid[data-seamless][data-lit]>.iso-top{stroke:var(--anatomy-top)}
.mk-holed>.iso-fill{fill-rule:evenodd}
.iso-svg .mk-print path{vector-effect:none}
.iso .mk-bk{--anatomy-paper:#2b2a27;--anatomy-face:#34332f;--anatomy-top:#3c3b36;--anatomy-shade-0:#1c1b19;--anatomy-shade-1:#222120;--anatomy-shade-2:#282725;--anatomy-shade-3:#2f2e2b;--anatomy-lit-top:#45443f;--anatomy-lit-shade:#363531;--anatomy-faint:#4a4944;--anatomy-lo:#56544f}
.iso .mk-cav{--anatomy-paper:#c9c7bf;--anatomy-top:#d6d4cd;--anatomy-shade-0:#b6b4ac;--anatomy-shade-1:#bdbbb3;--anatomy-shade-2:#c4c2ba;--anatomy-shade-3:#cbc9c1;--anatomy-faint:#aeaca4;--anatomy-lo:#9c9a93;--anatomy-mid:#85837c}
.mk-bore{fill:#bebcb4;stroke:none}
.mk-deep{fill:#a9a7a0;stroke:none}
.mk-water{fill:#d8d7d0;stroke:none}
.mk-coffee{fill:#1c1b19;stroke:none}
.mk-grain circle{fill:#5a5852;stroke:none}
.mk-glow{fill:#ff5b14;stroke:none;filter:url(#mk-blur)}
.iso-stage{outline:none}
.iso-stage:focus-visible{outline:2px solid #141412;outline-offset:4px}
body{font-family:Archivo,ui-sans-serif,system-ui,sans-serif}
`;

const live = `
const P = ${JSON.stringify(P)};
const PIECES = ${JSON.stringify(PIECES)};
const FRAME = ${JSON.stringify(FRAME)};
const RISE = ${RISE}, W = ${WIDTH}, H = ${HEIGHT}, PAD = 30, CMAX = 1.7;
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const camera = svg.querySelector('[data-part="camera"]');
const wide = { left: Math.min(...Object.values(FRAME).map((b) => b.left)), right: Math.max(...Object.values(FRAME).map((b) => b.right)), bottom: FRAME.stove.bottom };
// The camera keeps the whole stack in view: its box shrinks as the pieces come down, so it closes in.
const frameAt = (shares) => {
  let top = FRAME.stove.top;
  PIECES.forEach((piece, i) => { top = Math.min(top, FRAME[piece.name].top - RISE * piece.off * (1 - shares[i])); });
  const scale = Math.min(CMAX, (H - 2 * PAD) / (wide.bottom - top), (W - 2 * PAD) / (wide.right - wide.left));
  return "translate(" + (W / 2).toFixed(2) + " " + (H / 2).toFixed(2) + ") scale(" + scale.toFixed(4) + ") translate(" + (-(wide.left + wide.right) / 2).toFixed(2) + " " + (-(top + wide.bottom) / 2).toFixed(2) + ")";
};
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const groups = Object.fromEntries(PIECES.map((piece) => [piece.name, [...svg.querySelectorAll('[data-part="' + piece.name + '"]')]]));
const glow = svg.querySelector('[data-part="glow"]');
const steam = svg.querySelector('[data-part="steam"]');
const wisps = [...steam.querySelectorAll("[data-wisp]")];
const knobOff = svg.querySelector('[data-part="knob-off"]');
const knobOn = svg.querySelector('[data-part="knob-on"]');
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const shareOf = (piece, p) => ease(clamp((p - piece.from) / (piece.to - piece.from), 0, 1));
let p = 0, target = 0, last = 0, frame = 0, visible = false, touring = true, clock = 0, idle = 0;
// The idle tour: assemble over 7 s, brew 3 s, take apart over 5 s, rest 1.5 s.
const tourAt = (t) => { const c = t % 16.5; return c < 7 ? c / 7 : c < 10 ? 1 : c < 15 ? 1 - (c - 10) / 5 : 0; };
function draw(now) {
  let seated = 0, moving = null;
  const shares = PIECES.map((piece) => shareOf(piece, p));
  camera.setAttribute("transform", frameAt(shares));
  for (const [index, piece] of PIECES.entries()) {
    const share = shares[index];
    if (share > 0.999) seated++;
    else if (share > 0.001 && !moving) moving = piece;
    const transform = translateAlong(P, [0, 0, piece.off * (1 - share)]);
    for (const group of groups[piece.name]) {
      if (group.getAttribute("transform") !== transform) group.setAttribute("transform", transform);
      const lit = share > 0.001 && share < 0.999;
      for (const solid of group.querySelectorAll(".iso-solid")) solid.toggleAttribute("data-lit", lit);
    }
  }
  const heat = clamp((p - 0.9) / 0.08, 0, 1);
  glow.style.opacity = (heat * 0.3).toFixed(3);
  knobOn.style.opacity = heat.toFixed(3);
  knobOff.style.opacity = (1 - heat).toFixed(3);
  steam.style.opacity = heat.toFixed(3);
  wisps.forEach((wisp, index) => {
    const phase = ((now / 2600 + index / 3) % 1);
    wisp.setAttribute("transform", "translate(0 " + (-phase * 14).toFixed(2) + ")");
    wisp.style.opacity = (Math.sin(phase * Math.PI) * 0.9).toFixed(3);
  });
  const text = heat > 0.5 ? "sur le feu · 3 tasses · ≈ 130 ml" : seated === PIECES.length ? "montée · " + seated + "/" + PIECES.length : moving ? moving.label + " · " + seated + "/" + PIECES.length : seated ? "montée · " + seated + "/" + PIECES.length : "en pièces · 0/" + PIECES.length;
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuenow", String(Math.round(p * 100)));
  stage.setAttribute("aria-valuetext", text);
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  if (touring) { clock += dt; target = tourAt(clock); }
  p = still.matches ? target : p + (target - p) * (1 - Math.exp(-dt / 0.22));
  if (Math.abs(target - p) < 1e-4) p = target;
  draw(now);
  frame = visible ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const steer = (next) => { touring = false; target = clamp(next, 0, 1); clearTimeout(idle); idle = setTimeout(() => { touring = !still.matches; clock = target * 7; run(); }, 4200); run(); };
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
if (still.matches) { touring = false; target = 1; p = 1; }
stage.addEventListener("wheel", (event) => { event.preventDefault(); steer(target + event.deltaY * 0.0011); }, { passive: false });
let dragFrom = null;
stage.addEventListener("pointerdown", (event) => { if (event.pointerType !== "mouse") return; dragFrom = [event.clientY, target]; stage.setPointerCapture(event.pointerId); });
stage.addEventListener("pointermove", (event) => { if (dragFrom) steer(dragFrom[1] + (event.clientY - dragFrom[0]) / 420); });
stage.addEventListener("pointerup", () => { dragFrom = null; });
stage.addEventListener("keydown", (event) => {
  const stops = [0, ...PIECES.map((piece) => piece.to), 1];
  const here = stops.findIndex((stop) => stop >= target - 1e-3);
  let to = null;
  if (event.key === "ArrowDown" || event.key === "ArrowRight") to = stops[Math.min(stops.length - 1, here + 1)];
  if (event.key === "ArrowUp" || event.key === "ArrowLeft") to = stops[Math.max(0, here - 1)];
  if (event.key === "Home") to = 0;
  if (event.key === "End") to = 1;
  if (to === null) return;
  event.preventDefault();
  steer(to);
});
window.__moka = { set(value) { touring = false; clearTimeout(idle); target = p = clamp(value, 0, 1); draw(performance.now()); } };
draw(performance.now());
`;

const card = k.plateHtml({
  fig: "Fig 04",
  title: "Moka Express",
  hint: "molette, glisser ou flèches",
  readout: "en pièces · 0/6",
  keys: [
    { mark: "lit", label: "La pièce qui se pose" },
    { mark: "raised", label: "Chaudière, entonnoir, filtre, joint, collecteur, couvercle" },
  ],
  caption:
    "Une Moka Express trois tasses, en pièces au-dessus de son réchaud. On la remonte dans l’ordre : la chaudière sur le feu, l’entonnoir et son café, le filtre, le joint, le collecteur vissé par sa jupe avec sa poignée, le couvercle. Sur le feu, la vapeur de la chaudière pousse l’eau à travers le café et le fait monter par la cheminée du collecteur : environ 130 ml, trois petites tasses.",
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Cafetière italienne : molette, glisser ou flèches pour la monter pièce par pièce" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">${svg}</div>`,
});

const page = k.pageHtml({ title: "Moka Express", theme: "light", body: `<style>${EXTRA_CSS}</style>${card}`, script: kitScript() + live, width: 640 });
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "moka.html"), page);
console.log("wrote moka.html", (page.length / 1024).toFixed(0) + " KB", "scale", P.scale.toFixed(3));

// The layers the page stacks, cropped.
const layers = Object.fromEntries(
  Object.entries({
    stove: resolve(LAYERS.stove),
    "knob-off": resolve(LAYERS.knobOff),
    "knob-on": resolve(LAYERS.knobOn),
    glow: resolve(LAYERS.glow),
    grate: resolve(LAYERS.grate),
    boiler: resolve(LAYERS.boiler),
    "funnel-low": resolve(LAYERS.funnelLow),
    "neck-front": resolve(`<g clip-path="url(#mk-neck-front)"><g clip-path="url(#mk-neck-out)">${LAYERS.neckFront}</g></g>`),
    "funnel-top": resolve(LAYERS.funnelTop),
    filter: resolve(LAYERS.filter),
    gasket: resolve(LAYERS.gasket),
    collector: resolve(LAYERS.collector),
    lid: resolve(LAYERS.lid),
    ...Object.fromEntries(WISPS.map((shape, index) => [`steam-${index}`, resolve(wisp(shape, index))])),
    "edge-boiler": litOf(LAYERS.boiler),
    "edge-funnel": edgesOf(LAYERS.funnelLow, LAYERS.funnelTop),
    "edge-filter": edgesOf(LAYERS.filter),
    "edge-gasket": edgesOf(LAYERS.gasket),
    "edge-lid": litOf(LAYERS.lid),
  }).map(([name, inner]) => [name, croppedLayer(inner)]),
);
mkdirSync(ASSETS, { recursive: true });
for (const [name, { svg }] of Object.entries(layers)) writeFileSync(join(ASSETS, `${name}.svg`), svg);

// Full frame, out of the page: the collector's silhouettes (its glint is the lit screwing view) and the screwing views.
const files = { "edge-collector": fullFrame(edgesOf(LAYERS.collector)) };
// The screwing: the collector comes down onto the thread and makes one full turn clockwise, seen from above (a
// right-hand thread closes that way), as it drops the last SCREW.drop mm. `screw-start` is the piece as it comes
// down; frames 0… are lit (its outlines in the signal colour), one every 10°, round to the seated piece.
const SCREW = { turn: 2 * Math.PI, frames: 36, drop: 4 };
function collectorFrame(theta, lit) {
  ROT = theta;
  const content = collector();
  const frameDefs = `<defs><clipPath id="mk-opening"><path d="${poly(OPENING)}"/></clipPath></defs>`;
  ROT = 0;
  return `${resolve(frameDefs)}${resolve(content, { lit })}`;
}
files["screw-start"] = fullFrame(collectorFrame(SCREW.turn, false));
// The views the strip stacks (scripts/moka/strip.mjs), all cropped to the box they share: the strip moves by
// whole views in a window of that box.
const views = Array.from({ length: SCREW.frames + 1 }, (_, i) => collectorFrame(SCREW.turn * (1 - i / SCREW.frames), true));
const screwBox = views.map(boxOf).reduce((a, b) => {
  const [x, y] = [Math.min(a.x, b.x), Math.min(a.y, b.y)];
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
});
views.forEach((markup, i) => {
  const { x, y, w, h } = screwBox;
  files[`screw-${i}`] = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" width="${w}" height="${h}">${markup}</svg>`;
});
for (const [name, text] of Object.entries(files)) writeFileSync(join(OUT, `${name}.svg`), text);

// What the page needs: each layer's box and each piece's lift as a share of the frame, the basket's clip as a
// polygon in percent, and the camera at steps of p (scale, then the translation as a share of the figure's box).
const pct = (value, of) => +((value / of) * 100).toFixed(3);
const basketPolygon = [[lowEdge[0][0], -10], ...lowEdge, [lowEdge[lowEdge.length - 1][0], -10]].map(([x, y]) => `${pct(x, WIDTH)}% ${pct(Math.max(0, y), HEIGHT)}%`).join(", ");
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const wide = { left: Math.min(...Object.values(FRAME).map((b) => b.left)), right: Math.max(...Object.values(FRAME).map((b) => b.right)), bottom: FRAME.stove.bottom };
const cameraAt = (p, cmax = 1.7, pad = 30) => {
  let top = FRAME.stove.top;
  for (const piece of PIECES) {
    const share = easeInOut(Math.min(1, Math.max(0, (p - piece.from) / (piece.to - piece.from))));
    top = Math.min(top, FRAME[piece.name].top - RISE * piece.off * (1 - share));
  }
  const scale = Math.min(cmax, (HEIGHT - 2 * pad) / (wide.bottom - top), (WIDTH - 2 * pad) / (wide.right - wide.left));
  const cx = (wide.left + wide.right) / 2;
  const cy = (top + wide.bottom) / 2;
  return { scale: +scale.toFixed(4), tx: pct(WIDTH / 2 - scale * cx, WIDTH), ty: pct(HEIGHT / 2 - scale * cy, HEIGHT) };
};
const camera = [0, 0.7, 0.72, 0.74, 0.76, 0.78, 0.8, 0.82, 0.84, 0.86, 0.88, 0.9, 1].map((p) => ({ at: Math.round(p * 100), ...cameraAt(p) }));
// The pieces' `from`/`to` are the plate's own shares of p, not the page's: left out.
const moka = {
  size: [WIDTH, HEIGHT],
  layers: Object.fromEntries(Object.entries(layers).map(([name, { box }]) => [name, { x: pct(box.x, WIDTH), y: pct(box.y, HEIGHT), w: pct(box.w, WIDTH), h: pct(box.h, HEIGHT) }])),
  pieces: PIECES.map(({ name }) => ({ name, lift: pct(RISE * OFF[name], HEIGHT) })),
  basketPolygon,
  camera,
  fitAtOne: cameraAt(1),
  steamOrigin: [pct(STEAM_FOOT[0], WIDTH), pct(STEAM_FOOT[1], HEIGHT)],
  screwSeat: pct(RISE * SCREW.drop, HEIGHT),
  screw: { views: views.length, x: pct(screwBox.x, WIDTH), y: pct(screwBox.y, HEIGHT), w: pct(screwBox.w, WIDTH), h: pct(screwBox.h, HEIGHT) },
};
writeFileSync(join(ASSETS, "moka.json"), `${JSON.stringify(moka, null, 2)}\n`);
const kb = (texts) => (texts.reduce((sum, text) => sum + text.length, 0) / 1024).toFixed(0);
console.log("layers:", Object.keys(layers).length, "files,", kb(Object.values(layers).map(({ svg }) => svg)), "KB, in src/assets/moka");
console.log("out:", Object.keys(files).length, "files,", kb(Object.values(files)), "KB");
