// Generates one top-down plate illustration per built-in dish into public/food/dish/<dishId>.svg.
// Original vector drawings composed from the shapes below; no third-party artwork.
// Run: node scripts/generate-dish-art.mjs
import { mkdirSync, writeFileSync } from "node:fs";

const CX = 400, CY = 282, TAU = Math.PI * 2;
const f = (n) => Math.round(n * 10) / 10;
const hash = (s) => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0;
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rand, list) => list[Math.floor(rand() * list.length)];

/** Smooth closed blob around the origin. */
function blob(rand, r, n = 9, jitter = 0.26) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU, rr = r * (1 - jitter + rand() * 2 * jitter);
    pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
  }
  const mid = (p, q) => `${f((p[0] + q[0]) / 2)} ${f((p[1] + q[1]) / 2)}`;
  let d = `M${mid(pts[n - 1], pts[0])}`;
  for (let i = 0; i < n; i++) d += `Q${f(pts[i][0])} ${f(pts[i][1])} ${mid(pts[i], pts[(i + 1) % n])}`;
  return d + "Z";
}

/** A piece is either a body string or [shadowShape, body]. Shadows always fall to the lower right. */
function place(x, y, rot, scale, piece) {
  const [shadow, body] = Array.isArray(piece) ? piece : ["", piece];
  const t = (dx, dy) => `transform="translate(${f(x + dx)} ${f(y + dy)}) rotate(${f(rot)}) scale(${f(scale)})"`;
  return (shadow ? `<g ${t(3, 6)} fill="#3b2614" stroke="#3b2614" opacity=".22">${shadow}</g>` : "") + `<g ${t(0, 0)}>${body}</g>`;
}
function scatter(rand, { n, R, minD = 0, cx = CX, cy = CY, rot = 360, s = [0.92, 1.1] }, draw) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    let p;
    for (let t = 0; t < 40; t++) {
      const a = rand() * TAU, r = R * Math.sqrt(rand());
      p = { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, i };
      if (pts.every((q) => Math.hypot(q.x - p.x, q.y - p.y) >= minD)) break;
    }
    pts.push(p);
  }
  pts.sort((a, b) => a.y - b.y);
  return pts.map((p) => place(p.x, p.y, (rand() - 0.5) * rot, s[0] + rand() * (s[1] - s[0]), draw(rand, p.i))).join("");
}
function ring(n, R, draw, { cx = CX, cy = CY, turn = 90, start = -90, s = 1 } = {}) {
  let out = "";
  for (let i = 0; i < n; i++) {
    const deg = start + (i / n) * 360, a = (deg * Math.PI) / 180;
    out += place(cx + Math.cos(a) * R, cy + Math.sin(a) * R, deg + turn, s, draw(i));
  }
  return out;
}

// ---------- vessels ----------
const tableShadow = (r) => `<circle cx="${CX + 6}" cy="${CY + 16}" r="${r}" fill="#5a4024" opacity=".3" filter="url(#blur)"/>`;
const plate = (accent) =>
  tableShadow(214) +
  `<circle cx="${CX}" cy="${CY}" r="215" fill="#fffdf6" stroke="#e6dcc6" stroke-width="2"/>` +
  `<circle cx="${CX}" cy="${CY}" r="199" fill="none" stroke="${accent}" stroke-width="4" opacity=".8"/>` +
  `<circle cx="${CX}" cy="${CY}" r="166" fill="#f7f1e2" stroke="#e5dbc4" stroke-width="3"/>`;
const bowl = (accent, light, deep) =>
  tableShadow(212) +
  `<defs><radialGradient id="broth" cx=".42" cy=".38" r=".75"><stop stop-color="${light}"/><stop offset="1" stop-color="${deep}"/></radialGradient></defs>` +
  `<circle cx="${CX}" cy="${CY}" r="213" fill="#fffdf6" stroke="#e6dcc6" stroke-width="2"/>` +
  `<circle cx="${CX}" cy="${CY}" r="201" fill="none" stroke="${accent}" stroke-width="4" opacity=".8"/>` +
  `<circle cx="${CX}" cy="${CY}" r="187" fill="#efe6d2"/>` +
  `<circle cx="${CX}" cy="${CY}" r="177" fill="url(#broth)"/>` +
  `<path d="M262 226A150 150 0 0 1 372 138" stroke="#fff" stroke-opacity=".38" stroke-width="8" stroke-linecap="round" fill="none"/>`;
const ovalPlate = (accent) =>
  `<ellipse cx="${CX + 6}" cy="${CY + 16}" rx="330" ry="196" fill="#5a4024" opacity=".3" filter="url(#blur)"/>` +
  `<ellipse cx="${CX}" cy="${CY}" rx="332" ry="198" fill="#fffdf6" stroke="#e6dcc6" stroke-width="2"/>` +
  `<ellipse cx="${CX}" cy="${CY}" rx="316" ry="182" fill="none" stroke="${accent}" stroke-width="4" opacity=".8"/>` +
  `<ellipse cx="${CX}" cy="${CY}" rx="284" ry="152" fill="#f7f1e2" stroke="#e5dbc4" stroke-width="3"/>`;
const sauce = (rand, color, opacity, r = 125) =>
  `<path d="${blob(rand, r, 12, 0.1)}" transform="translate(${CX} ${CY})" fill="${color}" opacity="${opacity}"/>`;

// ---------- pieces ----------
const shine = (d, w = 3, o = 0.5) => `<path d="${d}" stroke="#fff" stroke-opacity="${o}" stroke-width="${w}" stroke-linecap="round" fill="none"/>`;
const wedgePath = "M-27 2Q0 -32 27 2Q0 16 -27 2Z";
const P = {
  porkCube: () => [
    `<rect x="-23" y="-20" width="46" height="40" rx="10"/>`,
    `<rect x="-23" y="-20" width="46" height="40" rx="10" fill="#7d3013"/><path d="M-23 -6h46v10h-46z" fill="#e0a05e"/>` +
      `<path d="M-23 -10A10 10 0 0 1 -13 -20H13A10 10 0 0 1 23 -10V-6H-23Z" fill="#5c200e"/>` +
      shine("M-14 -14q14 -5 27 0") + `<path d="M-12 13q12 4 24 0" stroke="#c7673a" stroke-opacity=".7" stroke-width="2.5" stroke-linecap="round" fill="none"/>`,
  ],
  rib: (meat = "#a13a16", glaze = "#c9612a") => [
    `<rect x="-34" y="-15" width="68" height="30" rx="14"/>`,
    `<rect x="-34" y="-15" width="68" height="30" rx="14" fill="${meat}"/><rect x="-26" y="-11" width="42" height="9" rx="4.5" fill="${glaze}" opacity=".85"/>` +
      `<circle cx="29" cy="0" r="7.5" fill="#f4e7cf" stroke="#cdb690" stroke-width="1.5"/><circle cx="29" cy="0" r="2.5" fill="#d9c4a0"/>` + shine("M-22 -8q12 -4 26 0", 2.5),
  ],
  tomato: () => [
    `<path d="${wedgePath}"/>`,
    `<path d="${wedgePath}" fill="#d63f27"/><path d="M-18 1Q0 -19 18 1Q0 8 -18 1Z" fill="#f08a62"/>` +
      `<ellipse cx="-7" cy="-3" rx="2.2" ry="3.2" fill="#f8dc94"/><ellipse cx="0" cy="-6" rx="2.2" ry="3.2" fill="#f8dc94"/><ellipse cx="7" cy="-3" rx="2.2" ry="3.2" fill="#f8dc94"/>` +
      shine("M-20 -5Q-9 -20 6 -22", 2.5, 0.45),
  ],
  egg: (rand, r = 30) => {
    const d = blob(rand, r, 9, 0.25), d2 = blob(rand, r * 0.55, 7, 0.3);
    return [`<path d="${d}"/>`, `<path d="${d}" fill="#f2bd3a"/><path d="${d2}" transform="translate(-3 -4)" fill="#fbdf80"/>`];
  },
  broccoli: (rand) => {
    let heads = "", lights = "";
    for (let i = 0; i < 7; i++) {
      const a = (i / 6) * TAU, r = i === 6 ? 0 : 15, x = Math.cos(a) * r, y = Math.sin(a) * r - 4;
      heads += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(11 + rand() * 3)}" fill="#3d8a3a"/>`;
      lights += `<circle cx="${f(x - 3)}" cy="${f(y - 3)}" r="5.5" fill="#66ae52"/><circle cx="${f(x + 4)}" cy="${f(y + 3)}" r="1.8" fill="#2c6a2c"/>`;
    }
    return [`<circle cy="-2" r="29"/>`, `<rect x="-6" y="10" width="12" height="24" rx="5" fill="#a9cf7a"/>` + heads + lights];
  },
  shred: (rand, len, color, w) => {
    const d = `M${f(-len / 2)} 0Q0 ${f((rand() - 0.5) * len * 0.5)} ${f(len / 2)} 0`;
    return `<path d="${d}" transform="translate(1.5 2.5)" stroke="#3b2614" stroke-opacity=".16" stroke-width="${w}" stroke-linecap="round" fill="none"/><path d="${d}" stroke="${color}" stroke-width="${w}" stroke-linecap="round" fill="none"/>`;
  },
  cucumber: (rand) => {
    const d = blob(rand, 21, 7, 0.22);
    return [`<path d="${d}"/>`, `<path d="${d}" fill="#3f8238"/><path d="${d}" transform="translate(2 2) scale(.78)" fill="#d6e8ab"/><ellipse cx="-3" cy="2" rx="1.6" ry="3" fill="#f1f6d6"/><ellipse cx="5" cy="5" rx="1.6" ry="3" fill="#f1f6d6"/><ellipse cx="6" cy="-4" rx="1.6" ry="3" fill="#f1f6d6"/>`];
  },
  mushroom: () => [
    `<circle r="22"/>`,
    `<circle r="22" fill="#6a472c" stroke="#4c3120" stroke-width="2"/><path d="M-13 0H13M-7 -11L7 11M7 -11L-7 11" stroke="#f0e2c6" stroke-width="5" stroke-linecap="round"/>` + shine("M-15 -9q5 -7 13 -9", 2.5, 0.3),
  ],
  chicken: (rand, r = 22, fill = "#c98a4a", light = "#e2b075") => {
    const d = blob(rand, r, 8, 0.22);
    return [`<path d="${d}"/>`, `<path d="${d}" fill="${fill}"/><path d="${blob(rand, r * 0.5, 6, 0.3)}" transform="translate(-3 -3)" fill="${light}" opacity=".85"/>` + shine(`M${f(-r * 0.5)} ${f(-r * 0.45)}q${f(r * 0.4)} ${f(-r * 0.3)} ${f(r * 0.9)} 0`, 2.5, 0.4)];
  },
  tofuFried: () => [
    `<rect x="-20" y="-20" width="40" height="40" rx="6"/>`,
    `<rect x="-20" y="-20" width="40" height="40" rx="6" fill="#d99536"/><rect x="-15" y="-15" width="30" height="30" rx="4" fill="#f0c063"/>` + shine("M-11 -10h16", 2.5, 0.45),
  ],
  tofuWhite: () => [
    `<rect x="-16" y="-16" width="32" height="32" rx="5"/>`,
    `<rect x="-16" y="-16" width="32" height="32" rx="5" fill="#fdf8e8" stroke="#e7c9a8" stroke-width="1.5"/><path d="M-16 6h32v5a5 5 0 0 1-5 5h-22a5 5 0 0 1-5-5z" fill="#d2472c" opacity=".22"/>`,
  ],
  peanut: () => [
    `<ellipse rx="10" ry="7"/>`,
    `<ellipse rx="10" ry="7" fill="#d8a15c"/><path d="M-6 0H6" stroke="#b47d3c" stroke-width="1.5"/><ellipse cx="-3" cy="-2.5" rx="3.5" ry="1.6" fill="#fff" opacity=".4"/>`,
  ],
  chili: () => [
    `<path d="M-16 0Q0 -9 16 2" stroke-width="8" stroke-linecap="round" fill="none"/>`,
    `<path d="M-16 0Q0 -9 16 2" stroke="#9a1c14" stroke-width="8" stroke-linecap="round" fill="none"/><path d="M-12 -2Q0 -8 10 -1" stroke="#dc5a4c" stroke-width="2" stroke-linecap="round" fill="none"/>`,
  ],
  wing: () => [
    `<ellipse cx="-12" rx="30" ry="20"/><ellipse cx="22" cy="2" rx="20" ry="14"/>`,
    `<ellipse cx="-12" rx="30" ry="20" fill="#8a3a14"/><ellipse cx="22" cy="2" rx="20" ry="14" fill="#8a3a14"/><circle cx="42" cy="3" r="5" fill="#f1e2c4"/>` +
      `<ellipse cx="-14" cy="-5" rx="21" ry="9" fill="#b85a22" opacity=".85"/><ellipse cx="22" cy="-1" rx="12" ry="5" fill="#b85a22" opacity=".85"/>` + shine("M-28 -9q14 -7 28 -2", 3, 0.5),
  ],
  beef: (rand) => {
    const d = blob(rand, 25, 8, 0.2);
    return [`<path d="${d}"/>`, `<path d="${d}" fill="#6a3220"/><path d="M-12 -4q12 -6 24 0M-10 7q10 -5 20 0" stroke="#93503a" stroke-width="2.5" stroke-linecap="round" fill="none"/>` + shine("M-13 -12q8 -5 18 -3", 2.5, 0.3)];
  },
  pepper: (rand, fill = "#4f9a3c", light = "#8cc86a") => {
    const d = blob(rand, 17, 6, 0.3);
    return [`<path d="${d}"/>`, `<path d="${d}" fill="${fill}"/><path d="${d}" transform="scale(.58)" fill="none" stroke="${light}" stroke-width="3.5"/>`];
  },
  porkSlice: () => [
    `<ellipse rx="26" ry="12"/>`,
    `<ellipse rx="26" ry="12" fill="#b8734a"/><ellipse rx="26" ry="12" fill="none" stroke="#ecd0b0" stroke-width="2.5" stroke-dasharray="34 90"/>` + shine("M-14 -5q12 -4 24 0", 2, 0.35),
  ],
  cabbage: (rand) => {
    const d = blob(rand, 30, 8, 0.3);
    return [`<path d="${d}"/>`, `<path d="${d}" fill="#dcebaa" stroke="#b6cf7c" stroke-width="2"/><path d="M-18 6Q0 -4 18 -8M-2 -2L-6 -16M4 -3L10 12" stroke="#f8fbe4" stroke-width="3" stroke-linecap="round" fill="none"/>`];
  },
  lettuce: () => [
    `<path d="M-72 0C-52 -27 40 -31 72 -6Q78 0 72 6C40 31 -52 27 -72 0Z"/>`,
    `<path d="M-72 0C-52 -27 40 -31 72 -6Q78 0 72 6C40 31 -52 27 -72 0Z" fill="#5fa844"/><path d="M-20 -19C10 -22 44 -18 66 -6Q70 0 66 6C44 18 10 22 -20 19Z" fill="#79bd58"/>` +
      `<path d="M-68 0H52" stroke="#e2f1bd" stroke-width="5" stroke-linecap="round"/><path d="M-30 0L-12 -14M-4 0L16 -15M-30 0L-12 14M-4 0L16 15M24 0L42 -11M24 0L42 11" stroke="#e2f1bd" stroke-opacity=".7" stroke-width="2" stroke-linecap="round"/>`,
  ],
  spinach: (rand) => {
    const d = blob(rand, 26, 7, 0.35);
    return [`<path d="${d}"/>`, `<path d="${d}" fill="#2f7d38"/><path d="M-16 4Q0 -2 16 -6M-2 0L-5 -13M4 -2L8 10" stroke="#63b260" stroke-width="2.5" stroke-linecap="round" fill="none"/>`];
  },
  eggplant: () => [
    `<rect x="-24" y="-14" width="48" height="28" rx="9"/>`,
    `<rect x="-24" y="-14" width="48" height="28" rx="9" fill="#e7d9a6"/><path d="M-24 -5A9 9 0 0 1 -15 -14H15A9 9 0 0 1 24 -5V-2H-24Z" fill="#5a2a6e"/>` +
      `<path d="M-12 7h22" stroke="#c9a968" stroke-width="2.5" stroke-linecap="round"/>` + shine("M-14 -9h18", 2, 0.4),
  ],
  potatoWedge: (rand) => {
    const d = blob(rand, 21, 7, 0.2);
    return [`<path d="${d}"/>`, `<path d="${d}" fill="#e8bf58" stroke="#c58f2e" stroke-width="2.5"/>` + shine("M-10 -8q8 -5 17 -2", 2.5, 0.45)];
  },
  pumpkin: () => [
    `<path d="M-44 6Q0 -44 44 6Q0 22 -44 6Z"/>`,
    `<path d="M-44 6Q0 -44 44 6Q0 22 -44 6Z" fill="#4f6f2c"/><path d="M-39 6Q0 -34 39 6Q0 20 -39 6Z" fill="#f29a2c"/><path d="M-28 6Q0 -18 28 6Q0 14 -28 6Z" fill="#f8b955"/>`,
  ],
  woodEar: (rand) => {
    const d = blob(rand, 24, 10, 0.35);
    return [`<path d="${d}"/>`, `<path d="${d}" fill="#2b201a"/><path d="${blob(rand, 12, 6, 0.4)}" fill="none" stroke="#6b5a4e" stroke-width="2.5"/>` + shine("M-14 -10q7 -6 15 -5", 2.5, 0.25)];
  },
  centuryEgg: () => [
    `<path d="M-24 4Q0 -30 24 4Q0 14 -24 4Z"/>`,
    `<path d="M-24 4Q0 -30 24 4Q0 14 -24 4Z" fill="#4a3320"/><path d="M-14 3Q0 -14 14 3Q0 9 -14 3Z" fill="#6d7a5c"/>` + shine("M-16 -4Q-7 -17 5 -19", 2.5, 0.4),
  ],
  shrimp: () => {
    const arc = `d="M-20 16A26 26 0 1 1 20 16" fill="none" stroke-linecap="round"`;
    return [
      `<path ${arc} stroke-width="18"/>`,
      `<path d="M20 20L35 31L22 37L11 30Z" fill="#d8502e"/><circle cx="-21" cy="19" r="10" fill="#d8502e"/><path d="M-25 27Q-31 41 -19 47M-19 27Q-17 39 -7 41" stroke="#d8502e" stroke-width="1.6" fill="none" stroke-linecap="round"/>` +
        `<path ${arc} stroke="#ee6a42" stroke-width="18"/><path d="M-20 16A26 26 0 1 1 20 16" fill="none" stroke="#c8482a" stroke-width="18" stroke-dasharray="2 11" opacity=".55"/>` +
        `<path ${arc} stroke="#fbb596" stroke-width="5" opacity=".85"/><circle cx="-25" cy="20" r="2.2" fill="#2b1a12"/>`,
    ];
  },
  eggFlower: (rand) => `<path d="${blob(rand, 26, 7, 0.5)}" fill="#f6d568" opacity=".92"/><path d="${blob(rand, 12, 6, 0.4)}" fill="#fdeeb0"/>`,
  seaweed: (rand) => `<path d="${blob(rand, 28, 9, 0.45)}" fill="#26352a" opacity=".93"/><path d="M-14 -4q10 -8 22 -2M-10 8q10 -5 20 2" stroke="#4a6a52" stroke-width="2" stroke-linecap="round" fill="none"/>`,
  corn: () => {
    let kernels = "";
    for (let i = 0; i < 10; i++) kernels += `<circle cx="${f(Math.cos((i / 10) * TAU) * 17.5)}" cy="${f(Math.sin((i / 10) * TAU) * 17.5)}" r="5.6" fill="#f9dc6a"/>`;
    return [`<circle r="26"/>`, `<circle r="26" fill="#eab52a"/>${kernels}<circle r="9" fill="#f7e9b2"/>`];
  },
  carrot: () => [`<circle r="15"/>`, `<circle r="15" fill="#ee8630" stroke="#d6701e" stroke-width="1.5"/><circle r="8" fill="#f6a64f"/>`],
  yam: () => [`<ellipse rx="24" ry="17"/>`, `<ellipse rx="24" ry="17" fill="#fbf8ec" stroke="#e3dac2" stroke-width="2"/><circle cx="-7" cy="-3" r="1.5" fill="#e3dac2"/><circle cx="6" cy="4" r="1.5" fill="#e3dac2"/><circle cx="9" cy="-6" r="1.5" fill="#e3dac2"/>`],
  tigerPepper: (rand) => {
    let spots = "";
    for (let i = 0; i < 6; i++) spots += `<path d="${blob(rand, 5 + rand() * 4, 6, 0.35)}" transform="translate(${f(-42 + i * 17 + rand() * 6)} ${f((rand() - 0.5) * 14)})" fill="${i % 3 === 2 ? "#d5e39a" : "#3a2a16"}" opacity=".62"/>`;
    return [
      `<rect x="-58" y="-15" width="116" height="30" rx="15"/>`,
      `<path d="M-58 0h-13" stroke="#3c6a26" stroke-width="6" stroke-linecap="round"/><path d="M-58 0C-58 -16 -30 -17 0 -15C30 -13 52 -10 60 0C52 10 30 13 0 15C-30 17 -58 16 -58 0Z" fill="#5c9c3a"/>${spots}` + shine("M-44 -8Q-10 -12 36 -6", 2.5, 0.35),
    ];
  },
  zucchini: () => [
    `<path d="M-22 0A22 22 0 0 1 22 0Z"/>`,
    `<path d="M-22 0A22 22 0 0 1 22 0Z" fill="#eef3c8"/><path d="M-22 0A22 22 0 0 1 22 0" fill="none" stroke="#4e8a3a" stroke-width="4.5"/><circle cx="-7" cy="-6" r="2" fill="#d3dd9c"/><circle cy="-9" r="2" fill="#d3dd9c"/><circle cx="7" cy="-6" r="2" fill="#d3dd9c"/>`,
  ],
  scape: () => [
    `<path d="M-20 0H20" stroke-width="10" stroke-linecap="round" fill="none"/>`,
    `<path d="M-20 0H20" stroke="#3f7d2c" stroke-width="10" stroke-linecap="round"/><path d="M-19 -1.5H19" stroke="#6bb04a" stroke-width="5" stroke-linecap="round"/>`,
  ],
};

// ---------- small garnishes ----------
const bits = (rand, n, R, draw, extra = {}) => scatter(rand, { n, R, s: [0.85, 1.15], ...extra }, draw);
const scallion = (rand, n, R = 105, extra) => bits(rand, n, R, () => `<circle r="4.5" fill="#d9eeb0" stroke="#4b9a3a" stroke-width="2.5"/>`, extra);
const garlic = (rand, n, R = 105, extra) => bits(rand, n, R, (r) => `<path d="${blob(r, 4.6, 5, 0.3)}" fill="#f9f0d2" stroke="#dccb98" stroke-width=".9"/>`, extra);
const sesame = (rand, n, R = 105) => bits(rand, n, R, () => `<ellipse rx="3.6" ry="2" fill="#f7e8b8" stroke="#d8c184" stroke-width=".6"/>`);
const chiliRings = (rand, n, R = 105) => bits(rand, n, R, () => `<circle r="4.5" fill="none" stroke="#d2362a" stroke-width="3"/>`);
const dots = (rand, n, R, fill, r = 4.5) => bits(rand, n, R, (rr) => `<path d="${blob(rr, r, 5, 0.3)}" fill="${fill}"/>`);

// ---------- dishes ----------
const mix = (...makers) => (rand, i) => makers[i % makers.length](rand);
const DISHES = {
  "braised-pork": { table: "#f2d6bf", draw: (r) => plate("#b5492c") + sauce(r, "#a8481c", 0.5, 122) + scatter(r, { n: 15, R: 100, minD: 42 }, P.porkCube) + scallion(r, 14) + sesame(r, 26) },
  "tomato-eggs": { table: "#f8e2ae", draw: (r) => plate("#d8432b") + sauce(r, "#e96a45", 0.45, 126) + scatter(r, { n: 24, R: 104, minD: 34 }, mix(P.tomato, (x) => P.egg(x, 29))) + scallion(r, 18) },
  "yam-ribs": { table: "#e3ead3", draw: (r) => bowl("#8fa66a", "#f5ecca", "#dccb97") + scatter(r, { n: 14, R: 125, minD: 50 }, mix(() => P.rib("#c79f82", "#dcbda3"), P.yam, P.yam)) + dots(r, 9, 140, "#c8301e", 4.2) + scallion(r, 16, 140) },
  "garlic-broccoli": { table: "#e4edcc", draw: (r) => plate("#4f9a3c") + scatter(r, { n: 14, R: 104, minD: 48 }, P.broccoli) + garlic(r, 46) },
  "potato-strips": {
    table: "#f7e8b9",
    draw: (r) => plate("#e0a92e") + scatter(r, { n: 95, R: 96 }, (x) => P.shred(x, 78, pick(x, ["#f2dc8e", "#ecd07a", "#f7e7ab"]), 6)) +
      scatter(r, { n: 12, R: 96 }, (x) => P.shred(x, 34, "#4f9a3c", 5)) + scatter(r, { n: 9, R: 96 }, (x) => P.shred(x, 26, "#c8301e", 5)),
  },
  "cucumber-salad": { table: "#dcebd0", draw: (r) => plate("#3c7a34") + sauce(r, "#7a4a22", 0.22, 124) + scatter(r, { n: 24, R: 104, minD: 32 }, P.cucumber) + garlic(r, 34) + chiliRings(r, 12) },
  "mushroom-chicken": { table: "#efdcbe", draw: (r) => plate("#8a5a2c") + sauce(r, "#7a4a22", 0.42, 124) + scatter(r, { n: 22, R: 104, minD: 36 }, mix((x) => P.chicken(x, 23, "#b9773a", "#d9a05e"), P.mushroom)) + scallion(r, 16) },
  tofu: { table: "#f6dfb8", draw: (r) => plate("#d2772a") + sauce(r, "#a8421c", 0.4, 124) + scatter(r, { n: 26, R: 104, minD: 33 }, mix(P.tofuFried, (x) => P.pepper(x), P.tofuFried, (x) => P.pepper(x, "#cf3a2a", "#ee8a78"))) + scallion(r, 14) },
  "kung-pao-chicken": {
    table: "#f4d2bf",
    draw: (r) => plate("#a52a1c") + sauce(r, "#a8481c", 0.45, 124) + scatter(r, { n: 30, R: 104, minD: 24 }, (x) => P.chicken(x, 15, "#b56a2e", "#d9954f")) +
      scatter(r, { n: 18, R: 106, minD: 14 }, P.peanut) + scatter(r, { n: 11, R: 104, minD: 20 }, P.chili) + scallion(r, 16),
  },
  "cola-wings": { table: "#f3d6b6", draw: (r) => plate("#7a3a16") + sauce(r, "#a04a1c", 0.5, 124) + scatter(r, { n: 8, R: 92, minD: 66, s: [1, 1.12] }, P.wing) + sesame(r, 46) },
  "sweet-sour-ribs": { table: "#f7d1bd", draw: (r) => plate("#c2411f") + sauce(r, "#8a2a10", 0.52, 124) + scatter(r, { n: 12, R: 98, minD: 46 }, () => P.rib()) + sesame(r, 56) },
  "tomato-beef": { table: "#f7dbc4", draw: (r) => bowl("#b8392a", "#d9603a", "#a83220") + scatter(r, { n: 18, R: 128, minD: 46 }, mix(P.beef, P.tomato)) + scallion(r, 18, 140) },
  "pepper-pork": { table: "#e2ecce", draw: (r) => plate("#4f9a3c") + sauce(r, "#7a4a22", 0.25, 122) + scatter(r, { n: 34, R: 104, minD: 26 }, mix(P.porkSlice, (x) => P.pepper(x))) + garlic(r, 18) },
  "fish-fragrant-pork": {
    table: "#f7d8c0",
    draw: (r) => plate("#c2411f") + sauce(r, "#b23a1c", 0.38, 124) + scatter(r, { n: 46, R: 98 }, (x) => P.shred(x, 56, pick(x, ["#b8744a", "#a86238", "#c88a5c"]), 7)) +
      scatter(r, { n: 24, R: 98 }, (x) => P.shred(x, 50, "#ee8a2f", 5)) + scatter(r, { n: 22, R: 98 }, (x) => P.shred(x, 48, "#4f9a3c", 5)) + scatter(r, { n: 14, R: 98 }, (x) => P.shred(x, 40, "#2d221c", 6)),
  },
  "mapo-tofu": { table: "#f6d5c2", draw: (r) => plate("#b12f1a") + sauce(r, "#b12f1a", 0.92, 138) + sauce(r, "#d8532e", 0.5, 100) + scatter(r, { n: 19, R: 104, minD: 38, rot: 50 }, P.tofuWhite) + dots(r, 70, 122, "#6a2a14") + scallion(r, 26, 118) },
  "torn-cabbage": { table: "#e9efce", draw: (r) => plate("#7fae3f") + scatter(r, { n: 22, R: 100, minD: 34 }, P.cabbage) + scatter(r, { n: 9, R: 100, minD: 30 }, P.chili) + garlic(r, 22) },
  "oyster-lettuce": {
    table: "#e3edcf",
    draw: (r) => {
      let leaves = "";
      for (let i = 0; i < 8; i++) leaves += place(CX + (r() - 0.5) * 16, CY - 102 + i * 29, (r() - 0.5) * 12, 1.25, P.lettuce());
      return plate("#5a2e12") + leaves + `<path d="M330 186Q430 212 356 246T444 300T362 352T440 388" stroke="#5a2e12" stroke-width="13" stroke-linecap="round" fill="none" opacity=".88"/>` +
        `<path d="M336 186Q426 210 360 242" stroke="#fff" stroke-opacity=".25" stroke-width="3" stroke-linecap="round" fill="none"/>` + garlic(r, 44, 72);
    },
  },
  "three-treasures": { table: "#f1dcc9", draw: (r) => plate("#5a2a6e") + sauce(r, "#6b3a1c", 0.35, 124) + scatter(r, { n: 27, R: 104, minD: 34 }, mix(P.eggplant, P.potatoWedge, (x) => P.pepper(x))) + garlic(r, 16) },
  "tiger-pepper": {
    table: "#e6edcb",
    draw: (r) => {
      let peppers = "";
      for (let i = 0; i < 7; i++) peppers += place(CX + (r() - 0.5) * 40, CY - 96 + i * 32, -14 + (r() - 0.5) * 22, 1.25, P.tigerPepper(r));
      return plate("#3c7a34") + sauce(r, "#5a2e12", 0.3, 122) + peppers + garlic(r, 26, 96);
    },
  },
  "chive-eggs": { table: "#f6e6b0", draw: (r) => plate("#3f8f3a") + scatter(r, { n: 15, R: 98, minD: 40 }, (x) => P.egg(x, 31)) + scatter(r, { n: 70, R: 104 }, (x) => P.shred(x, 34, pick(x, ["#3f8f3a", "#2f7a30", "#58a548"]), 5)) },
  "spinach-eggs": { table: "#e6eecc", draw: (r) => plate("#2f7d38") + scatter(r, { n: 28, R: 104, minD: 34 }, mix(P.spinach, (x) => P.egg(x, 28))) },
  "steamed-pumpkin": { table: "#f9dcad", draw: (r) => plate("#e07f1c") + ring(11, 98, P.pumpkin, { s: 1.15 }) + ring(5, 38, P.pumpkin, { s: 0.85, start: -60 }) + dots(r, 7, 20, "#c8301e", 5) },
  "wood-ear-salad": { table: "#e4e9d4", draw: (r) => plate("#4a3a30") + sauce(r, "#7a4a22", 0.2, 124) + scatter(r, { n: 22, R: 102, minD: 34 }, P.woodEar) + dots(r, 16, 104, "#3f9440", 7) + chiliRings(r, 14) + garlic(r, 22) },
  "century-tofu": {
    table: "#dfe9dd",
    draw: (r) => {
      let cuts = "";
      for (let x = -48; x <= 48; x += 24) cuts += `<path d="M${CX + x} ${CY - 68}V${CY + 68}" stroke="#e2d9bf" stroke-width="2"/>`;
      return plate("#3b5a4a") + sauce(r, "#5a3418", 0.3, 132) + ring(8, 118, P.centuryEgg, { s: 1.2 }) +
        `<rect x="${CX - 67}" y="${CY - 64}" width="144" height="144" rx="12" fill="#3b2614" opacity=".2"/><rect x="${CX - 72}" y="${CY - 72}" width="144" height="144" rx="12" fill="#fdfaf0" stroke="#e6dfc8" stroke-width="2"/>${cuts}` +
        `<path d="${blob(r, 52, 9, 0.3)}" transform="translate(${CX} ${CY})" fill="#5a3418" opacity=".28"/>` + scallion(r, 24, 62) + chiliRings(r, 8, 56);
    },
  },
  "boiled-shrimp": {
    table: "#fadbc6",
    draw: (r) => plate("#ef6c45") + ring(9, 112, P.shrimp, { turn: 0, s: 1.15 }) +
      `<circle cx="${CX + 3}" cy="${CY + 6}" r="50" fill="#3b2614" opacity=".2"/><circle cx="${CX}" cy="${CY}" r="50" fill="#fffdf6" stroke="#e0d5bd" stroke-width="2"/><circle cx="${CX}" cy="${CY}" r="39" fill="#4a2a14"/>` +
      `<path d="M374 268A30 30 0 0 1 398 250" stroke="#fff" stroke-opacity=".3" stroke-width="4" stroke-linecap="round" fill="none"/>` + scallion(r, 7, 26) + dots(r, 8, 28, "#f1d27a", 3.5),
  },
  "steamed-fish": {
    table: "#dfe9e0",
    zoom: 1.08,
    draw: (r) => {
      const body = "M-235 0C-165 -88 60 -84 150 -18L228 -64Q212 0 228 64L150 18C60 84 -165 88 -235 0Z";
      let top = "";
      for (let i = 0; i < 46; i++) top += place(CX - 150 + r() * 250, CY + (r() - 0.5) * 60, (r() - 0.5) * 70, 1, P.shred(r, 44 + r() * 26, pick(r, ["#4b9a3a", "#6db554", "#eef3d2", "#f1d27a", "#d2362a", "#4b9a3a"]), 4));
      return ovalPlate("#4f8a7a") + `<ellipse cx="${CX}" cy="${CY + 6}" rx="246" ry="112" fill="#6b3a1c" opacity=".3"/>` +
        `<g transform="translate(${CX + 4} ${CY + 9})" fill="#3b2614" opacity=".22"><path d="${body}"/></g>` +
        `<defs><linearGradient id="fish" x2="0" y2="1"><stop stop-color="#8e9c9c"/><stop offset=".45" stop-color="#c9d2cf"/><stop offset="1" stop-color="#f3f1e6"/></linearGradient></defs>` +
        `<g transform="translate(${CX} ${CY})"><path d="${body}" fill="url(#fish)" stroke="#7d8a88" stroke-width="2"/>` +
        `<path d="M150 -18L228 -64Q212 0 228 64L150 18Q160 0 150 -18Z" fill="#8e9c9c"/><path d="M168 -22L214 -48M172 0H216M168 22L214 48" stroke="#6f7c7a" stroke-width="2" stroke-linecap="round"/>` +
        `<path d="M-168 -52Q-146 0 -168 52" stroke="#7d8a88" stroke-width="3" fill="none"/><circle cx="-196" cy="-12" r="9" fill="#fff"/><circle cx="-196" cy="-12" r="4.5" fill="#22262a"/>` +
        `<path d="M-110 -50L-80 30M-40 -58L-10 36M30 -54L60 34" stroke="#fdfbf2" stroke-width="7" stroke-linecap="round" opacity=".9"/><path d="M-120 -64Q0 -82 110 -44" stroke="#6f7c7a" stroke-width="3" fill="none" opacity=".6"/></g>` + top;
    },
  },
  "garlic-shrimp": { table: "#f9dfbc", draw: (r) => plate("#e0a92e") + sauce(r, "#e9b860", 0.35, 126) + ring(8, 104, P.shrimp, { turn: 0, s: 1.15 }) + place(CX, CY, 20, 1.15, P.shrimp()) + garlic(r, 110, 128) + scallion(r, 20, 120) },
  "tomato-egg-soup": { table: "#f8dcc0", draw: (r) => bowl("#d8432b", "#f3a868", "#e07a45") + scatter(r, { n: 11, R: 135, minD: 54 }, P.eggFlower) + scatter(r, { n: 8, R: 128, minD: 56 }, P.tomato) + scallion(r, 20, 145) },
  "seaweed-egg-soup": { table: "#e2ead8", draw: (r) => bowl("#3b5a4a", "#f1e8c4", "#d8ca93") + scatter(r, { n: 11, R: 132, minD: 52 }, P.seaweed) + scatter(r, { n: 11, R: 135, minD: 50 }, P.eggFlower) + dots(r, 10, 140, "#ee9a78", 4) + scallion(r, 18, 145) },
  "corn-ribs": { table: "#f8e3ae", draw: (r) => bowl("#e0a92e", "#f7ecc0", "#e3d08f") + scatter(r, { n: 17, R: 126, minD: 50 }, mix(P.corn, () => P.rib("#c79f82", "#dcbda3"), P.carrot)) + scallion(r, 16, 145) },
  "egg-fried-rice": {
    table: "#f8e5b4",
    draw: (r) => plate("#e0a92e") + `<path d="${blob(r, 142, 14, 0.06)}" transform="translate(${CX + 3} ${CY + 7})" fill="#3b2614" opacity=".2"/><path d="${blob(r, 142, 14, 0.06)}" transform="translate(${CX} ${CY})" fill="#f1e5c0"/>` +
      scatter(r, { n: 360, R: 134 }, (x) => `<ellipse rx="8.5" ry="3.8" fill="${pick(x, ["#fffbee", "#faf1d8", "#fdf6e2"])}" stroke="#dccb98" stroke-width=".7"/>`) +
      scatter(r, { n: 26, R: 124, minD: 22 }, (x) => P.egg(x, 12)) + bits(r, 26, 128, () => `<rect x="-5" y="-5" width="10" height="10" rx="2" fill="#ee8630"/>`) + scallion(r, 34, 128),
  },
  "scallion-noodles": {
    table: "#f2dfbe",
    draw: (r) => {
      let strands = "";
      for (let i = 0; i < 34; i++) {
        const th = r() * Math.PI, ox = (r() - 0.5) * 220, oy = (r() - 0.5) * 220, ph = r() * TAU, pts = [];
        for (let k = -5; k <= 5; k++) {
          const t = k * 36, w = Math.sin(k * 1.25 + ph) * 20;
          pts.push([CX + ox + Math.cos(th) * t - Math.sin(th) * w, CY + oy + Math.sin(th) * t + Math.cos(th) * w]);
        }
        let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
        for (let k = 1; k < pts.length - 1; k++) d += `Q${f(pts[k][0])} ${f(pts[k][1])} ${f((pts[k][0] + pts[k + 1][0]) / 2)} ${f((pts[k][1] + pts[k + 1][1]) / 2)}`;
        strands += `<path d="${d}" stroke="#b07f3c" stroke-width="12" fill="none" stroke-linecap="round"/><path d="${d}" stroke="${pick(r, ["#ecc98a", "#e6bd78", "#f1d49b"])}" stroke-width="8.5" fill="none" stroke-linecap="round"/>`;
      }
      return plate("#6a5420") + `<circle cx="${CX}" cy="${CY}" r="150" fill="#8a5a22" opacity=".45"/><clipPath id="mound"><circle cx="${CX}" cy="${CY}" r="150"/></clipPath><g clip-path="url(#mound)">${strands}</g>` +
        scatter(r, { n: 34, R: 112 }, (x) => P.shred(x, 28, pick(x, ["#3f4a1c", "#55622a", "#2f3a16"]), 5)) + scatter(r, { n: 14, R: 112 }, (x) => P.shred(x, 22, "#5fa844", 5));
    },
  },
  "zucchini-eggs": { table: "#e7efcc", draw: (r) => plate("#e0a92e") + scatter(r, { n: 30, R: 104, minD: 32 }, mix(P.zucchini, P.zucchini, (x) => P.egg(x, 28))) + garlic(r, 14) },
  "garlic-scape-pork": { table: "#e3ecce", draw: (r) => plate("#b9774e") + sauce(r, "#7a4a22", 0.25, 122) + scatter(r, { n: 18, R: 100, minD: 34 }, P.porkSlice) + scatter(r, { n: 44, R: 104, minD: 14 }, P.scape) },
};

mkdirSync(new URL("../public/food/dish/", import.meta.url), { recursive: true });
for (const [id, dish] of Object.entries(DISHES)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="560" viewBox="0 0 800 560"><defs><filter id="blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14"/></filter></defs>` +
    `<rect width="800" height="560" fill="${dish.table}"/><path d="M0 40H800M0 524H800" stroke="#fff" stroke-opacity=".5" stroke-width="5"/><path d="M0 56H800M0 508H800" stroke="#fff" stroke-opacity=".35" stroke-width="2"/>` +
    `<g transform="translate(${CX} ${CY - 2}) scale(${dish.zoom ?? 1.2}) translate(${-CX} ${-CY})">${dish.draw(rng(hash(id)))}</g></svg>\n`;
  writeFileSync(new URL(`../public/food/dish/${id}.svg`, import.meta.url), svg);
}
console.log(`Wrote ${Object.keys(DISHES).length} dish illustrations.`);
