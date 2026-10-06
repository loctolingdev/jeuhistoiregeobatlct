import { NPCS } from "./data";

/** Géométrie logique du monde : collisions, hauteurs, positions clés. */

export interface Box {
  x1: number;
  x2: number;
  z1: number;
  z2: number;
}

export const BOUNDS = { x1: -68, x2: 62, z1: -30, z2: 40 };
export const QUAY_EDGE_Z = -8;
export const WATER_Y = -1.3;

// Navire « François Bonnaffé »
export const SHIP = { x: 6, z: -22, scale: 2.4 };
export const DECK_Y = 2.2;
export const DECK: Box = { x1: -6.5, x2: 18.5, z1: -25.4, z2: -18.6 };
// Ouverture du modèle : x local = -2.3, z local = -1.8.
// Rotation de 90° : (x, z) local devient (z, -x) dans le port.
export const BOARDING_LOCAL = { x: -2.3, z: -1.8 };
export const GANGWAY = {
  x: SHIP.x + BOARDING_LOCAL.z * SHIP.scale,
  z1: QUAY_EDGE_Z,
  z2: SHIP.z - BOARDING_LOCAL.x * SHIP.scale,
  half: 1.1,
};
export const BOARDING_LANDING: Box = {
  x1: GANGWAY.x - GANGWAY.half,
  x2: GANGWAY.x + GANGWAY.half,
  z1: DECK.z2 - 0.25,
  z2: GANGWAY.z2 + 0.02,
};
export const CABIN_SPOT = { x: 16, z: -22 };
export const CABIN_BOX: Box = {
  x1: CABIN_SPOT.x + 0.3,
  x2: CABIN_SPOT.x + 2.9,
  z1: CABIN_SPOT.z - 2.75,
  z2: CABIN_SPOT.z + 2.75,
};
export const CABIN_ENTRY = { x: CABIN_SPOT.x + 1.3, y: DECK_Y, z: CABIN_SPOT.z + 0.5 };
export const CABIN_EXIT = { x: CABIN_SPOT.x - 1, y: DECK_Y, z: CABIN_SPOT.z };
export const CHEST_SPOT = { x: CABIN_SPOT.x + 1.2, y: DECK_Y, z: CABIN_SPOT.z - 1.2 };
export const HATCH_SPOT = { x: 2, z: -22 };
export const DELIVERY_SPOT = { x: GANGWAY.x, z: -6.5 };

// La cale partage les coordonnées du bateau, à l'étage sous le pont.
export const HOLD_ORIGIN = { x: SHIP.x, y: DECK_Y - 3.4, z: SHIP.z };
export const HOLD_BOX: Box = { x1: SHIP.x - 8.5, x2: SHIP.x + 8.5, z1: SHIP.z - 3, z2: SHIP.z + 3 };
export const LADDER_SPOT = { x: HATCH_SPOT.x, z: HATCH_SPOT.z };
export const HOLD_ENTRY = { x: LADDER_SPOT.x + 1.2, y: HOLD_ORIGIN.y, z: LADDER_SPOT.z };
export const DECK_ENTRY = { x: HATCH_SPOT.x + 2, y: DECK_Y, z: HATCH_SPOT.z };

export interface Building {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  kind: "house" | "warehouse" | "merchant";
  tone: number;
  /** Immeuble de l'îlot Bonnaffé (façade détaillée). */
  ilot?: boolean;
}

// Façades le long du quai (face à l'eau, vers -z)
export const BUILDINGS: Building[] = [
  { x: -58, z: 30, w: 10, d: 10, h: 11, kind: "house", tone: 0 },
  { x: -46, z: 30, w: 10, d: 10, h: 13, kind: "house", tone: 1 },
  { x: -34, z: 17, w: 16, d: 12, h: 9, kind: "warehouse", tone: 0 },
  { x: -18, z: 30, w: 12, d: 10, h: 14, kind: "house", tone: 2 },
  { x: -4, z: 30, w: 12, d: 10, h: 12, kind: "house", tone: 1 },
  { x: 10, z: 30, w: 13, d: 10, h: 16.8, kind: "house", tone: 2, ilot: true },
  { x: 22, z: 30, w: 8, d: 10, h: 12, kind: "house", tone: 2 },
  { x: 34, z: 18, w: 16, d: 12, h: 13, kind: "merchant", tone: 1 },
  { x: 52, z: 30, w: 12, d: 10, h: 12, kind: "house", tone: 0 },
];

const WALL = 0.5;

/** Colliders : pleins pour les maisons, murs creux (avec porte) pour les bâtiments visitables. */
export function buildColliders(): Box[] {
  const out: Box[] = [];
  for (const b of BUILDINGS) {
    const x1 = b.x - b.w / 2;
    const x2 = b.x + b.w / 2;
    const z1 = b.z - b.d / 2;
    const z2 = b.z + b.d / 2;
    if (b.kind === "house") {
      out.push({ x1, x2, z1, z2 });
      continue;
    }
    const door = b.kind === "warehouse" ? 5 : 2.4;
    out.push({ x1, x2, z1: z2 - WALL, z2 }); // fond
    out.push({ x1, x2: x1 + WALL, z1, z2 }); // gauche
    out.push({ x1: x2 - WALL, x2, z1, z2 }); // droite
    out.push({ x1, x2: b.x - door / 2, z1, z2: z1 + WALL }); // façade gauche
    out.push({ x1: b.x + door / 2, x2, z1, z2: z1 + WALL }); // façade droite
  }
  // Mobilier
  out.push({ x1: 36, x2: 40, z1: 20, z2: 22 }); // bureau du négociant
  // Bord du quai : on ne tombe pas à l'eau (sauf passerelle)
  out.push({ x1: BOUNDS.x1, x2: GANGWAY.x - GANGWAY.half, z1: -9.5, z2: QUAY_EDGE_Z });
  out.push({ x1: GANGWAY.x + GANGWAY.half, x2: BOUNDS.x2, z1: -9.5, z2: QUAY_EDGE_Z });
  const prop = (x: number, z: number, h = 0.5) =>
    out.push({ x1: x - h, x2: x + h, z1: z - h, z2: z + h });
  // Pont du navire : tonneaux, caisse, cabine
  prop(8, -24);
  prop(9.3, -24.2);
  prop(-2, -20);
  out.push({
    x1: CABIN_SPOT.x + 0.3,
    x2: CABIN_SPOT.x + 2.9,
    z1: CABIN_SPOT.z - 2.75,
    z2: CABIN_SPOT.z + 2.75,
  });
  const rect = (x: number, z: number, hw: number, hd: number) =>
    out.push({ x1: x - hw, x2: x + hw, z1: z - hd, z2: z + hd });
  // Quai : tonneaux, caisses, sacs
  for (const [x, z] of [
    [-12, -3],
    [-11, -1.4],
    [-8.6, -3.2],
    [18, 1],
    [19.3, 1.2],
    [30, -3],
    [-42, -4],
    [-41, -2.6],
  ])
    prop(x, z, 0.55);
  for (const [x, z] of [
    [14, -3],
    [15, -1.6],
    [22, -4],
    [-20, 2],
    [36, -2],
  ])
    prop(x, z, 0.6);
  prop(23, 1, 0.5);
  prop(24.5, 2.6, 0.5);
  prop(23.8, 1.8, 0.5);
  // Charrettes, étals, banc, arbres, canon, grue
  prop(-6, 8, 1.6);
  prop(26, 8, 1.6);
  rect(2, 14, 1.6, 2.2);
  rect(-10, 16, 1.6, 2.2);
  rect(8, 12, 1.4, 0.6);
  prop(-26, 32, 0.6);
  prop(44, 30, 0.6);
  rect(56, -5, 0.8, 1.3);
  prop(-6, -5, 1.25);
  // Lanternes
  for (const [x, z] of [
    [-30, -6.5],
    [-12, -6.5],
    [14, -6.5],
    [30, -6.5],
    [-4, 22],
    [24, 22],
    [-48, 22],
    [46, 22],
  ])
    prop(x, z, 0.25);
  // Chantier naval (groupe en -56, -2)
  rect(-56, -2, 3, 8);
  rect(-48, -6, 2.6, 0.5);
  prop(-60, -2.2, 0.6);
  prop(-60, -0.6, 0.6);
  // Entrepôt : tonneaux, caisses, sacs, balance, comptoir
  rect(-38.25, 21, 2.4, 0.6);
  rect(-28, 21.5, 1.6, 0.6);
  rect(-35.6, 18.2, 0.9, 0.6);
  prop(-33, 20, 0.6);
  rect(-31, 19, 1.2, 0.4);
  // Négociant : bibliothèque, fauteuil, coffre, lanterne
  rect(28, 23, 1.5, 0.4);
  rect(38, 22.6, 0.5, 0.45);
  prop(31, 15, 0.6);
  prop(40, 14, 0.3);
  // Personnages fixes
  for (const n of NPCS) prop(n.x, n.z, 0.35);
  // Marchandises posées au sol
  for (const g of GOOD_SPOTS) if (!g.y) prop(g.x, g.z, g.kind === "logs" ? 1.2 : 0.5);
  return out;
}

let _colliders: Box[] | null = null;
const colliders = () => (_colliders ??= buildColliders());

// Collisions séparées par étage : les objets du pont ne bloquent pas la cale.
export function buildHoldColliders(): Box[] {
  const { x, z } = HOLD_ORIGIN;
  const out: Box[] = [
    { x1: x - 10, x2: HOLD_BOX.x1, z1: z - 4, z2: z + 4 },
    { x1: HOLD_BOX.x2, x2: x + 10, z1: z - 4, z2: z + 4 },
    { x1: x - 10, x2: x + 10, z1: z - 4, z2: HOLD_BOX.z1 },
    { x1: x - 10, x2: x + 10, z1: HOLD_BOX.z2, z2: z + 4 },
  ];
  const prop = (px: number, pz: number, half = 0.5) =>
    out.push({ x1: px - half, x2: px + half, z1: pz - half, z2: pz + half });
  for (let i = 0; i < 5; i++) prop(x - 4 + i * 1.4, z - 2.5);
  for (let i = 0; i < 4; i++) prop(x + 3 + i * 1.2, z + 2.4);
  prop(x + 6.3, z - 2.4, 0.8);
  prop(x, z + 1.8); // sel
  return out;
}
const holdColliders = buildHoldColliders();

export function inBox(x: number, z: number, b: Box, pad = 0) {
  return x > b.x1 - pad && x < b.x2 + pad && z > b.z1 - pad && z < b.z2 + pad;
}

export function onGangway(x: number, z: number) {
  return Math.abs(x - GANGWAY.x) < GANGWAY.half && z <= GANGWAY.z1 + 0.01 && z >= GANGWAY.z2 - 0.3;
}

/** Hauteur du sol sous le joueur, et si la position est marchable. */
export function groundAt(
  x: number,
  z: number,
  inHold = false,
  inCabin = false,
): { y: number; walkable: boolean; zone: "quai" | "pont" | "cale" | "cabine" } {
  if (inCabin) return { y: DECK_Y, walkable: inBox(x, z, CABIN_BOX), zone: "cabine" };
  if (inHold) return { y: HOLD_ORIGIN.y, walkable: inBox(x, z, HOLD_BOX), zone: "cale" };
  if (z >= QUAY_EDGE_Z) return { y: 0, walkable: true, zone: "quai" };
  if (inBox(x, z, BOARDING_LANDING) || inBox(x, z, DECK))
    return { y: DECK_Y, walkable: true, zone: "pont" };
  if (onGangway(x, z)) {
    const t = (QUAY_EDGE_Z - z) / (QUAY_EDGE_Z - GANGWAY.z2);
    return { y: Math.min(1, Math.max(0, t)) * DECK_Y, walkable: true, zone: "quai" };
  }
  return { y: WATER_Y, walkable: false, zone: "quai" };
}

/** Résolution de collision cercle/AABB. */
export function resolve(x: number, z: number, r = 0.4, inHold = false, inCabin = false) {
  if (inCabin)
    return {
      x: Math.max(CABIN_BOX.x1 + r, Math.min(CABIN_BOX.x2 - r, x)),
      z: Math.max(CHEST_SPOT.z + 0.7 + r, Math.min(CABIN_BOX.z2 - r, z)),
    };
  for (let pass = 0; pass < 3; pass++)
    for (const b of inHold ? holdColliders : colliders()) {
      const cx = Math.max(b.x1, Math.min(x, b.x2));
      const cz = Math.max(b.z1, Math.min(z, b.z2));
      const dx = x - cx;
      const dz = z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        const d = Math.sqrt(d2) || 0.0001;
        if (d2 === 0) {
          // centre à l'intérieur : pousser vers le bord le plus proche
          const opts = [
            { v: x - b.x1, nx: b.x1 - r, nz: z },
            { v: b.x2 - x, nx: b.x2 + r, nz: z },
            { v: z - b.z1, nx: x, nz: b.z1 - r },
            { v: b.z2 - z, nx: x, nz: b.z2 + r },
          ].sort((a, c) => a.v - c.v);
          x = opts[0].nx;
          z = opts[0].nz;
        } else {
          x = cx + (dx / d) * r;
          z = cz + (dz / d) * r;
        }
      }
    }
  return { x, z };
}

/** Le segment caméra traverse-t-il un bâtiment ? (collision caméra simple) */
export function pointBlocked(x: number, y: number, z: number) {
  for (const b of BUILDINGS) {
    if (
      y < b.h &&
      x > b.x - b.w / 2 &&
      x < b.x + b.w / 2 &&
      z > b.z - b.d / 2 &&
      z < b.z + b.d / 2
    ) {
      if (b.kind !== "house") {
        // à l'intérieur d'un bâtiment visitable : seul le toit bloque
        const inner =
          x > b.x - b.w / 2 + 0.6 &&
          x < b.x + b.w / 2 - 0.6 &&
          z > b.z - b.d / 2 + 0.6 &&
          z < b.z + b.d / 2 - 0.6;
        if (inner && y < b.h - 0.6) continue;
      }
      return true;
    }
  }
  return false;
}

// Colis à charger (mission 3)
export const CRATES = [
  { id: "colis-1", x: -26, z: 6 },
  { id: "colis-2", x: -22, z: 8 },
  { id: "colis-3", x: -18, z: 5 },
];

// Marchandises cliquables dans le monde
export const GOOD_SPOTS: {
  good: string;
  x: number;
  z: number;
  y?: number;
  kind: "barrel" | "crate" | "sack" | "jar" | "logs" | "bale";
}[] = [
  { good: "vin", x: -10, z: -2, kind: "barrel" },
  { good: "sucre", x: 16, z: -3, kind: "crate" },
  { good: "cafe", x: -38, z: 18, kind: "sack" },
  { good: "indigo", x: -30, z: 20, kind: "jar" },
  { good: "cacao", x: -40, z: 14, kind: "sack" },
  { good: "epices", x: 38, z: 22.2, y: 1.05, kind: "jar" },
  { good: "farine", x: 24, z: 2, kind: "sack" },
  { good: "textiles", x: -28, z: 14, kind: "bale" },
  { good: "bois", x: -48, z: 4, kind: "logs" },
  { good: "sel", x: HOLD_ORIGIN.x, y: HOLD_ORIGIN.y, z: HOLD_ORIGIN.z + 1.8, kind: "barrel" },
];
