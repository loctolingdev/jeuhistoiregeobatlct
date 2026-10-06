import * as THREE from "three";

const cache = new Map<string, THREE.Texture>();

function make(
  key: string,
  size: number,
  draw: (g: CanvasRenderingContext2D, s: number) => void,
  repeat: [number, number],
) {
  const k = `${key}:${repeat.join("x")}`;
  const hit = cache.get(k);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  cache.set(k, t);
  return t;
}

function rnd(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Pavés / dalles de quai en pierre claire. */
export function cobbleTexture(repeat: [number, number]) {
  return make(
    "cobble",
    256,
    (g, s) => {
      const r = rnd(7);
      g.fillStyle = "#8f8574";
      g.fillRect(0, 0, s, s);
      const rows = 8;
      const h = s / rows;
      for (let y = 0; y < rows; y++) {
        const off = (y % 2) * (h * 0.7);
        for (let x = -1; x < 6; x++) {
          const w = s / 5;
          const l = 150 + r() * 40;
          g.fillStyle = `rgb(${l + 18},${l + 8},${l - 12})`;
          g.fillRect(x * w + off + 2, y * h + 2, w - 4, h - 4);
          g.fillStyle = `rgba(60,50,40,${0.08 + r() * 0.12})`;
          g.fillRect(x * w + off + 2 + r() * w * 0.5, y * h + 2 + r() * h * 0.5, w * 0.3, h * 0.3);
        }
      }
    },
    repeat,
  );
}

/** Pierre de taille pour les façades (blocs réguliers). */
export function ashlarTexture(tone: number, repeat: [number, number]) {
  return make(
    `ashlar${tone}`,
    256,
    (g, s) => {
      const r = rnd(11 + tone);
      const base = [
        [214, 199, 170],
        [203, 188, 160],
        [222, 208, 182],
      ][tone % 3];
      g.fillStyle = `rgb(${base[0] - 30},${base[1] - 30},${base[2] - 30})`;
      g.fillRect(0, 0, s, s);
      const rows = 6;
      const h = s / rows;
      for (let y = 0; y < rows; y++) {
        const off = (y % 2) * (s / 6);
        for (let x = -1; x < 4; x++) {
          const w = s / 3;
          const v = (r() - 0.5) * 16;
          g.fillStyle = `rgb(${base[0] + v},${base[1] + v},${base[2] + v})`;
          g.fillRect(x * w + off + 1.5, y * h + 1.5, w - 3, h - 3);
        }
      }
      for (let i = 0; i < 60; i++) {
        g.fillStyle = `rgba(90,80,60,${r() * 0.08})`;
        g.fillRect(r() * s, r() * s, 2 + r() * 10, 2 + r() * 10);
      }
    },
    repeat,
  );
}

/** Planches de bois sombre. */
export function planksTexture(repeat: [number, number]) {
  return make(
    "planks",
    256,
    (g, s) => {
      const r = rnd(3);
      const n = 8;
      for (let i = 0; i < n; i++) {
        const l = 80 + r() * 25;
        g.fillStyle = `rgb(${l + 30},${l + 10},${l - 15})`;
        g.fillRect(0, (i * s) / n, s, s / n);
        g.fillStyle = "rgba(30,18,10,0.6)";
        g.fillRect(0, (i * s) / n, s, 2);
        for (let k = 0; k < 6; k++) {
          g.fillStyle = `rgba(40,25,15,${r() * 0.25})`;
          g.fillRect(r() * s, (i * s) / n + r() * (s / n), 20 + r() * 60, 1);
        }
      }
    },
    repeat,
  );
}

/** Ardoise pour les toits. */
export function slateTexture(repeat: [number, number]) {
  return make(
    "slate",
    128,
    (g, s) => {
      const r = rnd(5);
      g.fillStyle = "#3d434b";
      g.fillRect(0, 0, s, s);
      const rows = 8;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < 8; x++) {
          const l = 70 + r() * 25;
          g.fillStyle = `rgb(${l - 8},${l},${l + 10})`;
          g.fillRect(x * 16 + (y % 2) * 8 + 1, y * 16 + 1, 14, 14);
        }
      }
    },
    repeat,
  );
}

/** Carte maritime ancienne (pour le bureau du négociant). */
export function mapTexture() {
  return make(
    "map",
    256,
    (g, s) => {
      g.fillStyle = "#d9c79c";
      g.fillRect(0, 0, s, s);
      g.strokeStyle = "rgba(90,60,30,0.5)";
      for (let i = 0; i < 8; i++) {
        g.beginPath();
        g.moveTo(0, (i * s) / 8);
        g.lineTo(s, (i * s) / 8);
        g.moveTo((i * s) / 8, 0);
        g.lineTo((i * s) / 8, s);
        g.stroke();
      }
      g.fillStyle = "#a88d5c";
      g.beginPath();
      g.ellipse(70, 90, 50, 70, 0.4, 0, Math.PI * 2);
      g.ellipse(190, 150, 45, 55, -0.3, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "#7a2e22";
      g.setLineDash([4, 4]);
      g.beginPath();
      g.moveTo(80, 100);
      g.quadraticCurveTo(140, 40, 190, 150);
      g.stroke();
      g.fillStyle = "#5a3a1a";
      g.font = "italic 16px serif";
      g.fillText("Mer Océane", 100, 230);
    },
    [1, 1],
  );
}
