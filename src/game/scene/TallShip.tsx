import { useGLTF, Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";

const SAIL = "#e8dcc0";
const SAIL_SHADE = "#d9c8a2";
const SPAR = "#3e2a1b";
const ROPE = "#2a211b";

/** Toile écrue avec coutures verticales et ralingue, inspirée des voiles de maquette. */
function sailTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d")!;
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, "#efe5cc");
  grd.addColorStop(1, "#d8c7a0");
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = "rgba(120,95,60,0.28)";
  g.lineWidth = 2;
  for (let x = 16; x < 256; x += 21) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, 256);
    g.stroke();
  }
  // bandes de ris
  g.strokeStyle = "rgba(110,85,55,0.35)";
  for (const y of [60, 100]) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(256, y);
    g.stroke();
  }
  g.strokeStyle = "rgba(90,70,45,0.6)";
  g.lineWidth = 6;
  g.strokeRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Bande de batterie : bois ocre, ligne noire et sabords fermés. */
function gunDeckTexture(ports: number) {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = "#d9b978";
  g.fillRect(0, 0, 1024, 64);
  g.fillStyle = "#1b1410";
  g.fillRect(0, 0, 1024, 8);
  g.fillRect(0, 56, 1024, 8);
  const step = 1024 / ports;
  for (let i = 0; i < ports; i++) {
    const x = i * step + step * 0.3;
    g.fillStyle = "#1b1410";
    g.fillRect(x, 16, step * 0.4, 32);
    g.fillStyle = "#8a2a1d";
    g.fillRect(x + 3, 19, step * 0.4 - 6, 26);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function sailGeometry(w: number, h: number, belly: number) {
  const g = new THREE.PlaneGeometry(w, h, 12, 8);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) / (w / 2);
    const y = p.getY(i) / (h / 2);
    p.setZ(i, belly * (1 - x * x) * (0.7 + 0.3 * (1 - y * y)));
    // voile plus étroite vers le haut, pied légèrement arrondi
    p.setX(i, p.getX(i) * (1 - 0.08 * (y + 1)));
    if (y < -0.99) p.setY(i, p.getY(i) + 0.08 * h * x * x);
  }
  g.computeVertexNormals();
  return g;
}

/** Voile triangulaire (foc / voile d'étai) légèrement gonflée. */
function triSail(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, belly = 0.25) {
  const n = 8;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const side = new THREE.Vector3(1, 0, 0);
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= n - i; j++) {
      const u = i / n;
      const v = j / n;
      const w = 1 - u - v;
      const p = a
        .clone()
        .multiplyScalar(w)
        .add(b.clone().multiplyScalar(u))
        .add(c.clone().multiplyScalar(v));
      p.addScaledVector(side, belly * 4 * u * v * w * 3);
      pos.push(p.x, p.y, p.z);
      uv.push(u, v);
    }
  }
  const row = (i: number) => (i * (2 * n + 3 - i)) / 2;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n - i; j++) {
      const a0 = row(i) + j;
      const b0 = row(i + 1) + j;
      idx.push(a0, b0, a0 + 1);
      if (j < n - i - 1) idx.push(a0 + 1, b0, b0 + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Brigantine : voile aurique trapézoïdale à l'arrière du mât d'artimon. */
function spankerGeometry(h: number, wTop: number, wBot: number) {
  const g = new THREE.PlaneGeometry(1, h, 8, 8);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) + 0.5; // 0 au mât → 1 vers la poupe
    const y = p.getY(i) / h + 0.5;
    const w = wBot + (wTop - wBot) * y;
    p.setX(i, 0.25 * Math.sin(Math.PI * u) * (0.6 + 0.4 * y));
    p.setZ(i, -u * w);
    p.setY(i, p.getY(i) + (y > 0.5 ? u * 0.4 * (y - 0.5) * 2 : 0));
  }
  g.computeVertexNormals();
  return g;
}

interface MastInfo {
  z: number;
  top: number;
}

/**
 * Vaisseau à trois-mâts inspiré des maquettes du XVIIIᵉ siècle :
 * bandes de batterie ocre et sabords, quatre étages de voiles carrées,
 * focs, voiles d'étai, brigantine, haubans, enfléchures et pavillons.
 */
export function TallShip({
  url,
  scale = 1,
  nameMap,
}: {
  url: string;
  scale?: number;
  nameMap?: THREE.Texture;
}) {
  const { scene } = useGLTF(url);
  const { hull, masts, box } = useMemo(() => {
    const o = skeletonClone(scene);
    const found: MastInfo[] = [];
    const hidden: THREE.Object3D[] = [];
    o.traverse((c) => {
      const m = c as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
      if (/^(sail|flag)/.test(c.name)) {
        hidden.push(c);
        if (c.name.startsWith("flag")) found.push({ z: c.position.z, top: c.position.y });
      }
    });
    hidden.forEach((c) => (c.visible = false));
    o.updateMatrixWorld(true);
    const bx = new THREE.Box3();
    o.traverse((c) => {
      const m = c as THREE.Mesh;
      if (!m.isMesh) return;
      let vis = true;
      for (let p: THREE.Object3D | null = m; p; p = p.parent) if (!p.visible) vis = false;
      if (vis && m.geometry) {
        m.geometry.computeBoundingBox();
        bx.union(m.geometry.boundingBox!.clone().applyMatrix4(m.matrixWorld));
      }
    });
    if (bx.isEmpty()) bx.setFromObject(o);
    found.sort((a, b) => b.z - a.z); // avant → arrière
    // le mât de misaine du modèle est court : on l'allonge comme sur un vaisseau
    const tallest = Math.max(...found.map((f) => f.top), 0);
    if (found[0] && found.length > 2) found[0].top = Math.max(found[0].top, tallest * 0.9);
    return { hull: o, masts: found, box: bx };
  }, [scene]);

  const deck = 2.2;
  const halfBeam = Math.max(0.9, (box.max.x - box.min.x) / 2 - 0.15);
  const bowZ = box.max.z;
  const fore = masts[0];
  const main = masts[1];
  const mizzen = masts[masts.length - 1];
  const sailMap = useMemo(() => sailTexture(), []);

  return (
    <group scale={scale}>
      <primitive object={hull} />
      <GunDecks box={box} />
      {/* Plaque fixée au tableau de poupe, dans le repère de la coque. */}
      {nameMap && (
        <mesh name="bonnaffe-sign" position={[0, 2.42, -6.57]} rotation-y={Math.PI}>
          <planeGeometry args={[1.75, 0.333]} />
          <meshStandardMaterial map={nameMap} roughness={0.85} side={THREE.DoubleSide} />
        </mesh>
      )}
      {masts.map((m, i) => (
        <MastRig
          key={i}
          mast={m}
          deck={deck}
          halfBeam={halfBeam}
          k={i === masts.length - 1 && masts.length > 2 ? 0.78 : i === 0 ? 0.92 : 1}
          map={sailMap}
          phase={i * 1.3}
        />
      ))}
      {fore && <Bowsprit bowZ={bowZ} deck={deck} fore={fore} map={sailMap} />}
      {/* étais entre les mâts + voiles d'étai */}
      {masts.slice(1).map((m, i) => {
        const prev = masts[i]!;
        return (
          <group key={`stay${i}`}>
            <Line
              points={[
                [0, m.top - 0.3, m.z],
                [0, prev.top * 0.72, prev.z],
              ]}
              color={ROPE}
              lineWidth={1}
            />
            <Staysail from={m} to={prev} deck={deck} map={sailMap} />
          </group>
        );
      })}
      {mizzen && main && <Spanker mast={mizzen} deck={deck} map={sailMap} />}
      {/* Pavillon de poupe sur sa hampe */}
      <mesh position={[0, deck + 1.6, box.min.z + 0.35]} rotation-x={-0.5}>
        <cylinderGeometry args={[0.03, 0.04, 2.2, 6]} />
        <meshStandardMaterial color={SPAR} />
      </mesh>
      <Flag position={[0, deck + 2.5, box.min.z - 0.1]} size={1.3} />
      {/* Lanternes de poupe */}
      {[-0.5, 0, 0.5].map((x) => (
        <mesh key={x} position={[x, deck + 1.1, box.min.z + 0.15]}>
          <cylinderGeometry args={[0.09, 0.12, 0.3, 6]} />
          <meshStandardMaterial color="#c9a24a" emissive="#f2c56b" emissiveIntensity={0.4} />
        </mesh>
      ))}
    </group>
  );
}

/** Deux bandes de batterie de chaque bord, comme sur la maquette. */
function GunDecks({ box }: { box: THREE.Box3 }) {
  const len = (box.max.z - box.min.z) * 0.58;
  const midZ = (box.max.z + box.min.z) / 2 - 0.2;
  const hx = (box.max.x - box.min.x) / 2;
  const tex = useMemo(() => [gunDeckTexture(13), gunDeckTexture(12)], []);
  const rows = [
    { y: 1.25, h: 0.32, x: hx - 0.08, t: tex[1] },
    { y: 1.78, h: 0.3, x: hx - 0.04, t: tex[0] },
  ];
  return (
    <group>
      {rows.map((r, i) =>
        [-1, 1].map((s) => (
          <mesh key={`${i}${s}`} position={[s * r.x, r.y, midZ]} rotation-y={(s * Math.PI) / 2}>
            <planeGeometry args={[len - i * 0.4, r.h]} />
            <meshStandardMaterial
              map={r.t}
              roughness={0.85}
              side={THREE.DoubleSide}
              polygonOffset
              polygonOffsetFactor={-2}
            />
          </mesh>
        )),
      )}
    </group>
  );
}

function MastRig({
  mast,
  deck,
  halfBeam,
  k,
  map,
  phase,
}: {
  mast: MastInfo;
  deck: number;
  halfBeam: number;
  k: number;
  map: THREE.Texture;
  phase: number;
}) {
  const top = mast.top - 0.2;
  const span = top - deck;
  const tiers = [
    { y0: deck + span * 0.14, y1: deck + span * 0.38, w: 3.9 * k }, // basse voile
    { y0: deck + span * 0.41, y1: deck + span * 0.64, w: 3.3 * k }, // hunier
    { y0: deck + span * 0.67, y1: deck + span * 0.83, w: 2.5 * k }, // perroquet
    { y0: deck + span * 0.86, y1: deck + span * 0.96, w: 1.7 * k }, // cacatois
  ];
  const geos = useMemo(
    () => tiers.map((t) => sailGeometry(t.w, t.y1 - t.y0, (t.y1 - t.y0) * 0.24)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [span, k],
  );
  const sails = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const g = sails.current;
    if (!g) return;
    const t = clock.elapsedTime;
    g.children.forEach((c, i) => {
      c.scale.z = 1 + Math.sin(t * 1.1 + phase + i * 0.7) * 0.08;
    });
  });
  return (
    <group position={[0, 0, mast.z]}>
      {/* bas-mât, mât de hune, mât de perroquet */}
      <mesh position={[0, deck + span * 0.25, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.14, span * 0.5 + 0.4, 8]} />
        <meshStandardMaterial color={SPAR} roughness={0.8} />
      </mesh>
      <mesh position={[0, deck + span * 0.62, -0.06]} castShadow>
        <cylinderGeometry args={[0.07, 0.09, span * 0.35, 8]} />
        <meshStandardMaterial color={SPAR} roughness={0.8} />
      </mesh>
      <mesh position={[0, deck + span * 0.9, -0.1]} castShadow>
        <cylinderGeometry args={[0.035, 0.055, span * 0.3, 6]} />
        <meshStandardMaterial color={SPAR} roughness={0.8} />
      </mesh>
      {/* hunes */}
      {[0.4, 0.66].map((f) => (
        <mesh key={f} position={[0, deck + span * f, 0]}>
          <boxGeometry args={[0.9 * k, 0.07, 0.6]} />
          <meshStandardMaterial color={SPAR} />
        </mesh>
      ))}
      <group ref={sails}>
        {tiers.map((t, i) => (
          <group key={i} position={[0, 0, 0.12]}>
            <mesh geometry={geos[i]} position={[0, (t.y0 + t.y1) / 2, 0]} castShadow>
              <meshStandardMaterial
                map={map}
                color={i % 2 ? SAIL_SHADE : SAIL}
                roughness={1}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>
        ))}
      </group>
      {/* vergues */}
      {tiers.map((t, i) => (
        <mesh key={`y${i}`} position={[0, t.y1 + 0.03, 0.08]} rotation-z={Math.PI / 2} castShadow>
          <cylinderGeometry args={[0.03, 0.055, t.w + 0.5, 6]} />
          <meshStandardMaterial color={SPAR} />
        </mesh>
      ))}
      {/* haubans + enfléchures */}
      {[-1, 1].map((s) => (
        <group key={s}>
          {[-0.6, -0.2, 0.2].map((dz) => (
            <Line
              key={dz}
              points={[
                [0, deck + span * 0.4, 0],
                [s * halfBeam, deck + 0.1, dz - 0.3],
              ]}
              color={ROPE}
              lineWidth={0.8}
            />
          ))}
          {[0.25, 0.45, 0.65, 0.85].map((f) => (
            <Line
              key={`r${f}`}
              points={[
                [
                  s * halfBeam * (1 - f),
                  deck + 0.1 + span * 0.3 * f,
                  -0.9 + f * 0.9 + 0.3 * (1 - f),
                ],
                [
                  s * halfBeam * (1 - f),
                  deck + 0.1 + span * 0.3 * f,
                  -0.1 * (1 - f) + 0.2 * (1 - f),
                ],
              ]}
              color={ROPE}
              lineWidth={0.5}
            />
          ))}
          {/* galhaubans vers le mât de hune */}
          <Line
            points={[
              [0, deck + span * 0.78, 0],
              [s * halfBeam, deck + 0.1, -0.9],
            ]}
            color={ROPE}
            lineWidth={0.6}
          />
          {/* bras de vergues */}
          {tiers.map((t, i) => (
            <Line
              key={`b${i}`}
              points={[
                [(s * (t.w + 0.4)) / 2, t.y1, 0.08],
                [s * halfBeam * 0.8, deck + 0.2, -1.6],
              ]}
              color={ROPE}
              lineWidth={0.4}
            />
          ))}
        </group>
      ))}
      <Pennant position={[0, top + 0.5, 0]} length={1.6 * k} />
    </group>
  );
}

function Staysail({
  from,
  to,
  deck,
  map,
}: {
  from: MastInfo;
  to: MastInfo;
  deck: number;
  map: THREE.Texture;
}) {
  const geo = useMemo(() => {
    const a = new THREE.Vector3(0, from.top * 0.62, from.z);
    const b = new THREE.Vector3(0, to.top * 0.46, to.z - 0.3);
    const c = new THREE.Vector3(0, deck + (from.top - deck) * 0.45, from.z + 0.2);
    return triSail(a, b, c, 0.15);
  }, [from.top, from.z, to.top, to.z, deck]);
  return (
    <mesh geometry={geo} castShadow>
      <meshStandardMaterial map={map} color={SAIL} roughness={1} side={THREE.DoubleSide} />
    </mesh>
  );
}

function Spanker({ mast, deck, map }: { mast: MastInfo; deck: number; map: THREE.Texture }) {
  const h = (mast.top - deck) * 0.34;
  const geo = useMemo(() => spankerGeometry(h, 2.2, 3.4), [h]);
  const y0 = deck + 0.9;
  return (
    <group position={[0, y0 + h / 2, mast.z - 0.1]}>
      <mesh geometry={geo} castShadow>
        <meshStandardMaterial map={map} color={SAIL_SHADE} roughness={1} side={THREE.DoubleSide} />
      </mesh>
      {/* gui et corne */}
      <mesh position={[0, -h / 2, -1.8]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.04, 0.05, 3.8, 6]} />
        <meshStandardMaterial color={SPAR} />
      </mesh>
      <mesh position={[0, h / 2 + 0.2, -1.1]} rotation-x={Math.PI / 2 - 0.18}>
        <cylinderGeometry args={[0.035, 0.045, 2.4, 6]} />
        <meshStandardMaterial color={SPAR} />
      </mesh>
    </group>
  );
}

function Bowsprit({
  bowZ,
  deck,
  fore,
  map,
}: {
  bowZ: number;
  deck: number;
  fore: MastInfo;
  map: THREE.Texture;
}) {
  const tip = new THREE.Vector3(0, deck + 1.5, bowZ + 3.4);
  const base = new THREE.Vector3(0, deck + 0.2, bowZ - 0.8);
  const len = tip.distanceTo(base);
  const mid = tip.clone().add(base).multiplyScalar(0.5);
  const angle = Math.atan2(tip.y - base.y, tip.z - base.z);
  const jibs = useMemo(() => {
    const s = fore.top - deck;
    const foot = new THREE.Vector3(0, deck + 0.5, fore.z + 0.6);
    const along = (f: number) => base.clone().lerp(tip, f);
    return [
      triSail(
        new THREE.Vector3(0, deck + s * 0.95, fore.z),
        tip,
        along(0.55).setY(deck + 1.2),
        0.3,
      ), // clinfoc
      triSail(
        new THREE.Vector3(0, deck + s * 0.75, fore.z),
        along(0.75),
        along(0.3).setY(deck + 0.9),
        0.3,
      ), // grand foc
      triSail(new THREE.Vector3(0, deck + s * 0.5, fore.z), along(0.4), foot, 0.25), // petit foc
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fore.top, fore.z, bowZ]);
  return (
    <group>
      <mesh position={mid} rotation-x={Math.PI / 2 - angle} castShadow>
        <cylinderGeometry args={[0.05, 0.12, len, 6]} />
        <meshStandardMaterial color={SPAR} />
      </mesh>
      {/* civadière sous le beaupré */}
      <mesh
        position={base
          .clone()
          .lerp(tip, 0.65)
          .add(new THREE.Vector3(0, -0.15, 0))}
        rotation-z={Math.PI / 2}
      >
        <cylinderGeometry args={[0.03, 0.04, 2.2, 6]} />
        <meshStandardMaterial color={SPAR} />
      </mesh>
      {jibs.map((g, i) => (
        <mesh key={i} geometry={g} castShadow>
          <meshStandardMaterial map={map} color={SAIL} roughness={1} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <Line points={[[0, fore.top - 0.2, fore.z], tip.toArray()]} color={ROPE} lineWidth={1} />
      <Line points={[tip.toArray(), [0, 1.0, bowZ]]} color={ROPE} lineWidth={0.8} />
    </group>
  );
}

function Pennant({ position, length }: { position: [number, number, number]; length: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([0, 0.08, 0, 0, -0.08, 0, 0, 0, -length], 3),
    );
    g.computeVertexNormals();
    return g;
  }, [length]);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = Math.sin(clock.elapsedTime * 2 + length) * 0.25;
  });
  return (
    <mesh ref={ref} geometry={geo} position={position}>
      <meshStandardMaterial color="#f4f1e8" side={THREE.DoubleSide} />
    </mesh>
  );
}

function Flag({ position, size }: { position: [number, number, number]; size: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const geo = useMemo(() => new THREE.PlaneGeometry(size, size * 0.62, 10, 4), [size]);
  const base = useMemo(() => Float32Array.from(geo.attributes.position.array), [geo]);
  useFrame(({ clock }) => {
    const p = geo.attributes.position as THREE.BufferAttribute;
    const t = clock.elapsedTime;
    for (let i = 0; i < p.count; i++) {
      const x = base[i * 3] / size + 0.5;
      p.setZ(i, Math.sin(x * 5 - t * 4) * 0.08 * x * size);
    }
    p.needsUpdate = true;
  });
  return (
    <mesh
      ref={ref}
      geometry={geo}
      position={[position[0], position[1], position[2] - size / 2]}
      rotation-y={Math.PI / 2}
    >
      <meshStandardMaterial color="#f4f1e8" side={THREE.DoubleSide} roughness={0.9} />
    </mesh>
  );
}
