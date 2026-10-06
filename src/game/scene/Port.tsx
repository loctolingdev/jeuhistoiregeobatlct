import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type ReactElement } from "react";
import * as THREE from "three";
import { BUILDINGS, QUAY_EDGE_Z, WATER_Y, type Building } from "../world";
import { ashlarTexture, cobbleTexture, mapTexture, planksTexture, slateTexture } from "../textures";
import { M, Model } from "../models";
import { atmos } from "./atmos";

const WOOD = "#5b3f2a";
const DARK = "#2a211b";

function Water() {
  const ref = useRef<THREE.Mesh>(null);
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(420, 160, 80, 30);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  const base = useMemo(() => Float32Array.from(geo.attributes.position.array), [geo]);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const day = useMemo(() => new THREE.Color("#5f7f8c"), []);
  const night = useMemo(() => new THREE.Color("#1d2c3a"), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3];
      const z = base[i * 3 + 2];
      pos.setY(i, Math.sin(x * 0.15 + t * 0.9) * 0.12 + Math.cos(z * 0.22 + t * 0.7) * 0.1);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    if (mat.current) mat.current.color.copy(day).lerp(night, atmos.night);
  });
  return (
    <mesh ref={ref} geometry={geo} position={[0, WATER_Y, QUAY_EDGE_Z - 80]} receiveShadow>
      <meshStandardMaterial
        ref={mat}
        color="#5f7f8c"
        roughness={0.18}
        metalness={0.35}
        transparent
        opacity={0.92}
      />
    </mesh>
  );
}

function Quay() {
  const cobble = useMemo(() => cobbleTexture([40, 14]), []);
  const wall = useMemo(() => ashlarTexture(0, [40, 1]), []);
  return (
    <group>
      {/* Dalle du quai */}
      <mesh position={[0, -1, 16]} receiveShadow>
        <boxGeometry args={[150, 2, 48]} />
        <meshStandardMaterial map={cobble} roughness={0.95} />
      </mesh>
      {/* Mur de quai côté fleuve */}
      <mesh position={[0, -1.5, QUAY_EDGE_Z - 0.3]} receiveShadow>
        <boxGeometry args={[150, 3, 0.6]} />
        <meshStandardMaterial map={wall} roughness={0.9} />
      </mesh>
      {/* Bornes d'amarrage */}
      {Array.from({ length: 14 }).map((_, i) => (
        <mesh key={i} position={[-62 + i * 9.5, 0.35, QUAY_EDGE_Z + 0.6]} castShadow>
          <cylinderGeometry args={[0.22, 0.28, 0.7, 8]} />
          <meshStandardMaterial color="#2d2a28" roughness={0.6} metalness={0.4} />
        </mesh>
      ))}
      {/* Rive lointaine */}
      <mesh position={[0, -0.6, -120]}>
        <boxGeometry args={[420, 2, 30]} />
        <meshStandardMaterial color="#6f7a5a" roughness={1} />
      </mesh>
    </group>
  );
}

function Windows({ b, faceZ }: { b: Building; faceZ: number }) {
  const floors = Math.floor(b.h / 3.4);
  const cols = Math.max(2, Math.floor(b.w / 2.6));
  const items: ReactElement[] = [];
  for (let f = 0; f < floors; f++) {
    for (let c = 0; c < cols; c++) {
      const x = b.x - b.w / 2 + (b.w / cols) * (c + 0.5);
      const y = 1.9 + f * 3.3;
      if (f === 0 && b.kind !== "house" && Math.abs(x - b.x) < 2.6) continue;
      items.push(
        <group key={`${f}-${c}`} position={[x, y, faceZ - 0.04]}>
          <mesh>
            <planeGeometry args={[1.1, f === 0 ? 2.2 : 1.8]} />
            <meshStandardMaterial
              color="#1e2328"
              emissive="#ffb35c"
              emissiveIntensity={0}
              roughness={0.3}
              userData={{ glow: true }}
            />
          </mesh>
          <mesh position={[0, (f === 0 ? 1.1 : 0.9) + 0.12, 0.02]}>
            <boxGeometry args={[1.4, 0.22, 0.12]} />
            <meshStandardMaterial color="#e6d9bd" roughness={0.8} />
          </mesh>
        </group>,
      );
    }
  }
  return <>{items}</>;
}

function GlowingWindows({ children }: { children: React.ReactNode }) {
  const g = useRef<THREE.Group>(null);
  useFrame(() => {
    g.current?.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (m && m.userData?.glow) m.emissiveIntensity = atmos.night * 1.4;
    });
  });
  return <group ref={g}>{children}</group>;
}

function Roof({ b }: { b: Building }) {
  const slate = useMemo(() => slateTexture([6, 3]), []);
  const rh = Math.min(4.5, b.d * 0.4);
  return (
    <group position={[b.x, b.h, b.z]}>
      <mesh
        rotation={[0, 0, Math.PI / 2]}
        scale={[rh, b.w + 0.6, b.d / 2 + 0.4]}
        position={[0, rh / 2 - 0.02, 0]}
        castShadow
      >
        <cylinderGeometry args={[0.58, 0.58, 1, 3, 1]} />
        <meshStandardMaterial map={slate} roughness={0.85} />
      </mesh>
      {/* corniche */}
      <mesh position={[0, -0.1, 0]} castShadow>
        <boxGeometry args={[b.w + 0.5, 0.35, b.d + 0.5]} />
        <meshStandardMaterial color="#d9cbb0" roughness={0.9} />
      </mesh>
      {/* cheminées */}
      <mesh position={[b.w * 0.3, rh * 0.6, b.d * 0.15]} castShadow>
        <boxGeometry args={[0.8, 2.2, 0.8]} />
        <meshStandardMaterial color="#b9a88a" />
      </mesh>
    </group>
  );
}

function SolidHouse({ b }: { b: Building }) {
  const tex = useMemo(() => ashlarTexture(b.tone, [b.w / 3, b.h / 3]), [b]);
  const faceZ = b.z - b.d / 2;
  return (
    <group>
      <mesh position={[b.x, b.h / 2, b.z]} castShadow receiveShadow>
        <boxGeometry args={[b.w, b.h, b.d]} />
        <meshStandardMaterial map={tex} roughness={0.9} />
      </mesh>
      <mesh position={[b.x, 0.5, faceZ - 0.1]}>
        <boxGeometry args={[b.w + 0.1, 1, 0.2]} />
        <meshStandardMaterial color="#a89a80" />
      </mesh>
      {/* porte cochère */}
      <mesh position={[b.x, 1.6, faceZ - 0.03]}>
        <planeGeometry args={[2, 3.2]} />
        <meshStandardMaterial color={WOOD} roughness={0.8} />
      </mesh>
      <Windows b={b} faceZ={faceZ} />
      <Roof b={b} />
    </group>
  );
}

/** Bâtiment visitable : murs creux, porte, intérieur. */
function OpenBuilding({ b, children }: { b: Building; children?: React.ReactNode }) {
  const tex = useMemo(() => ashlarTexture(b.tone, [b.w / 3, b.h / 3]), [b]);
  const floor = useMemo(() => planksTexture([b.w / 3, b.d / 3]), [b]);
  const door = b.kind === "warehouse" ? 5 : 2.4;
  const T = 0.5;
  const x1 = b.x - b.w / 2;
  const x2 = b.x + b.w / 2;
  const z1 = b.z - b.d / 2;
  const z2 = b.z + b.d / 2;
  const sideW = (b.w - door) / 2;
  const doorH = b.kind === "warehouse" ? 4.5 : 3.2;
  const mat = <meshStandardMaterial map={tex} roughness={0.9} />;
  return (
    <group>
      <mesh position={[b.x, 0.02, b.z]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[b.w - 0.2, b.d - 0.2]} />
        <meshStandardMaterial map={floor} roughness={0.9} />
      </mesh>
      <mesh position={[b.x, b.h / 2, z2 - T / 2]} castShadow receiveShadow>
        <boxGeometry args={[b.w, b.h, T]} />
        {mat}
      </mesh>
      <mesh position={[x1 + T / 2, b.h / 2, b.z]} castShadow receiveShadow>
        <boxGeometry args={[T, b.h, b.d]} />
        {mat}
      </mesh>
      <mesh position={[x2 - T / 2, b.h / 2, b.z]} castShadow receiveShadow>
        <boxGeometry args={[T, b.h, b.d]} />
        {mat}
      </mesh>
      <mesh position={[x1 + sideW / 2, b.h / 2, z1 + T / 2]} castShadow receiveShadow>
        <boxGeometry args={[sideW, b.h, T]} />
        {mat}
      </mesh>
      <mesh position={[x2 - sideW / 2, b.h / 2, z1 + T / 2]} castShadow receiveShadow>
        <boxGeometry args={[sideW, b.h, T]} />
        {mat}
      </mesh>
      <mesh position={[b.x, (b.h + doorH) / 2, z1 + T / 2]} castShadow>
        <boxGeometry args={[door, b.h - doorH, T]} />
        {mat}
      </mesh>
      <Windows b={b} faceZ={z1} />
      {/* plafond pour l'intérieur */}
      <mesh position={[b.x, b.h - 0.1, b.z]} rotation-x={Math.PI / 2}>
        <planeGeometry args={[b.w, b.d]} />
        <meshStandardMaterial color="#4a3626" side={THREE.DoubleSide} />
      </mesh>
      <Roof b={b} />
      <pointLight
        position={[b.x, b.h - 1.5, b.z]}
        intensity={18}
        distance={b.w * 1.4}
        color="#ffd9a0"
        decay={1.6}
      />
      {children}
    </group>
  );
}

function Sack({
  position,
  color = "#b59b6b",
}: {
  position: [number, number, number];
  color?: string;
}) {
  return (
    <mesh position={position} castShadow scale={[1, 0.75, 0.8]}>
      <sphereGeometry args={[0.45, 10, 8]} />
      <meshStandardMaterial color={color} roughness={1} />
    </mesh>
  );
}

function Balance({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.9, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.08, 1.8, 6]} />
        <meshStandardMaterial color={DARK} />
      </mesh>
      <mesh position={[0, 1.8, 0]}>
        <boxGeometry args={[1.6, 0.06, 0.06]} />
        <meshStandardMaterial color="#8a6a3a" metalness={0.6} roughness={0.4} />
      </mesh>
      {[-0.75, 0.75].map((x) => (
        <mesh key={x} position={[x, 1.3, 0]}>
          <cylinderGeometry args={[0.3, 0.25, 0.05, 12]} />
          <meshStandardMaterial color="#9a7840" metalness={0.7} roughness={0.35} />
        </mesh>
      ))}
    </group>
  );
}

function Ledger({
  position,
  rotation = 0,
}: {
  position: [number, number, number];
  rotation?: number;
}) {
  return (
    <group position={position} rotation-y={rotation}>
      <mesh castShadow>
        <boxGeometry args={[0.5, 0.08, 0.36]} />
        <meshStandardMaterial color="#5a2a1e" />
      </mesh>
      <mesh position={[0, 0.045, 0]}>
        <boxGeometry args={[0.46, 0.01, 0.32]} />
        <meshStandardMaterial color="#efe3c4" />
      </mesh>
    </group>
  );
}

function WarehouseInterior() {
  return (
    <group>
      {[-40, -38.6, -37.2].map((x, i) => (
        <group key={x}>
          <Model url={M.barrel} position={[x, 0, 21]} scale={1} />
          <Model url={M.barrel} position={[x + 0.7, 1.2, 21]} scale={1} rotation={i} />
        </group>
      ))}
      <Model url={M.crate} position={[-27, 0, 21.5]} />
      <Model url={M.crate} position={[-27, 0.77, 21.5]} rotation={0.3} />
      <Model url={M.crateBottles} position={[-29, 0, 21.5]} />
      <Sack position={[-36, 0.35, 18]} />
      <Sack position={[-35.2, 0.35, 18.4]} color="#a68a5d" />
      <Sack position={[-35.6, 0.9, 18.2]} />
      <Balance position={[-33, 0, 20]} />
      {/* comptoir et registres */}
      <mesh position={[-31, 0.5, 19]} castShadow>
        <boxGeometry args={[2.4, 1, 0.8]} />
        <meshStandardMaterial color={WOOD} />
      </mesh>
      <Ledger position={[-31.4, 1.04, 19]} rotation={0.2} />
      <Ledger position={[-30.6, 1.04, 19.1]} rotation={-0.3} />
      <Model url={M.shovel} position={[-41.4, 0, 16]} rotation={1.2} />
    </group>
  );
}

function MerchantInterior() {
  const map = useMemo(() => mapTexture(), []);
  return (
    <group>
      {/* bureau */}
      <mesh position={[38, 0.9, 21]} castShadow>
        <boxGeometry args={[4, 0.12, 2]} />
        <meshStandardMaterial color="#4b2e1c" roughness={0.5} />
      </mesh>
      {[
        [36.2, 20.2],
        [39.8, 20.2],
        [36.2, 21.8],
        [39.8, 21.8],
      ].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 0.45, z]}>
          <boxGeometry args={[0.15, 0.9, 0.15]} />
          <meshStandardMaterial color="#3a2416" />
        </mesh>
      ))}
      <mesh position={[37.6, 0.97, 21]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[1.4, 1]} />
        <meshStandardMaterial map={map} />
      </mesh>
      <Ledger position={[39.2, 1.0, 20.7]} />
      {/* lettres */}
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          position={[36.6 + i * 0.25, 0.97, 21.4]}
          rotation={[-Math.PI / 2, 0, i * 0.4]}
        >
          <planeGeometry args={[0.25, 0.35]} />
          <meshStandardMaterial color="#f1e6cc" />
        </mesh>
      ))}
      {/* carte du monde murale */}
      <mesh position={[34, 4.5, 23.7]} rotation-y={Math.PI}>
        <planeGeometry args={[5, 3]} />
        <meshStandardMaterial map={map} />
      </mesh>
      {/* bibliothèque */}
      <mesh position={[28, 2.2, 23]} castShadow>
        <boxGeometry args={[3, 4.4, 0.8]} />
        <meshStandardMaterial color="#3d2617" />
      </mesh>
      {Array.from({ length: 12 }).map((_, i) => (
        <mesh key={i} position={[26.8 + (i % 6) * 0.45, 1.3 + Math.floor(i / 6) * 1.4, 22.55]}>
          <boxGeometry args={[0.35, 1, 0.1]} />
          <meshStandardMaterial color={["#6b2a1f", "#2d4a3a", "#5a4320"][i % 3]} />
        </mesh>
      ))}
      {/* fauteuil */}
      <mesh position={[38, 0.6, 22.6]} castShadow>
        <boxGeometry args={[1, 1.2, 0.9]} />
        <meshStandardMaterial color="#6b2a24" />
      </mesh>
      <Model url={M.chest} position={[31, 0, 15]} rotation={0.4} />
      <Model url={M.lantern} position={[40, 0, 14]} />
    </group>
  );
}

function Shipyard() {
  const ribs = useMemo(() => Array.from({ length: 9 }), []);
  return (
    <group position={[-56, 0, -2]}>
      {/* cale de construction */}
      <mesh position={[0, 0.15, 0]} receiveShadow>
        <boxGeometry args={[6, 0.3, 16]} />
        <meshStandardMaterial map={planksTexture([2, 5])} />
      </mesh>
      {/* quille et membrures */}
      <mesh position={[0, 0.6, 0]} castShadow>
        <boxGeometry args={[0.4, 0.5, 14]} />
        <meshStandardMaterial color="#6d4b2f" />
      </mesh>
      {ribs.map((_, i) => (
        <mesh key={i} position={[0, 2.2, -6 + i * 1.5]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[2.3 - Math.abs(i - 4) * 0.15, 0.12, 6, 14, Math.PI]} />
          <meshStandardMaterial color="#7a5636" />
        </mesh>
      ))}
      <Model url={M.mast} position={[5, 0, 4]} rotation={Math.PI / 2} scale={0.8} />
      {/* piles de bois */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[8, 0.25 + i * 0.5, -4]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.25, 0.25, 5, 8]} />
          <meshStandardMaterial color="#8a6744" />
        </mesh>
      ))}
      {/* cordages enroulés */}
      {[0, 1].map((i) => (
        <mesh key={i} position={[-4, 0.15, -3 + i * 1.6]} rotation-x={Math.PI / 2} castShadow>
          <torusGeometry args={[0.45, 0.15, 6, 16]} />
          <meshStandardMaterial color="#b49a6a" roughness={1} />
        </mesh>
      ))}
      <Model url={M.shovel} position={[-3.5, 0, 3]} rotation={0.3} />
      <Model url={M.paddle} position={[-3.8, 0, 4]} rotation={1.3} />
    </group>
  );
}

function Crane({ position }: { position: [number, number, number] }) {
  const rope = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (rope.current) rope.current.rotation.z = Math.sin(clock.elapsedTime * 0.8) * 0.05;
  });
  return (
    <group position={position}>
      <mesh position={[0, 4, 0]} castShadow>
        <boxGeometry args={[0.6, 8, 0.6]} />
        <meshStandardMaterial color={WOOD} />
      </mesh>
      <mesh position={[0, 7.6, -2.5]} rotation-x={-0.25} castShadow>
        <boxGeometry args={[0.35, 0.35, 6]} />
        <meshStandardMaterial color={WOOD} />
      </mesh>
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[1.2, 1.2, 1.2, 12, 1, true]} />
        <meshStandardMaterial color="#6d4b2f" side={THREE.DoubleSide} />
      </mesh>
      <group ref={rope} position={[0, 8.3, -5.3]}>
        <mesh position={[0, -2.5, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 5, 4]} />
          <meshStandardMaterial color="#c9b48a" />
        </mesh>
        <group position={[0, -5.4, 0]}>
          <Model url={M.crate} position={[0, 0, 0]} />
        </group>
      </group>
    </group>
  );
}

function Gulls() {
  const g = useRef<THREE.Group>(null);
  const birds = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => ({
        r: 14 + i * 3,
        h: 14 + (i % 3) * 3,
        s: 0.15 + i * 0.02,
        p: i,
      })),
    [],
  );
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    g.current?.children.forEach((c, i) => {
      const b = birds[i];
      const a = t * b.s + b.p;
      c.position.set(Math.cos(a) * b.r, b.h + Math.sin(t + i) * 0.5, -10 + Math.sin(a) * b.r * 0.6);
      c.rotation.y = -a;
      c.children.forEach(
        (w, k) => (w.rotation.z = (k ? -1 : 1) * (0.3 + Math.sin(t * 6 + i) * 0.35)),
      );
    });
  });
  return (
    <group ref={g}>
      {birds.map((_, i) => (
        <group key={i}>
          {[0, 1].map((k) => (
            <mesh key={k} position={[k ? 0.35 : -0.35, 0, 0]}>
              <boxGeometry args={[0.7, 0.04, 0.22]} />
              <meshStandardMaterial color="#e9e6e0" />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function Lanterns() {
  const spots: [number, number][] = [
    [-30, -6.5],
    [-12, -6.5],
    [14, -6.5],
    [30, -6.5],
    [-4, 22],
    [24, 22],
    [-48, 22],
    [46, 22],
  ];
  const lights = useRef<THREE.PointLight[]>([]);
  const glows = useRef<THREE.MeshStandardMaterial[]>([]);
  useFrame(() => {
    lights.current.forEach((l) => l && (l.intensity = atmos.night * 22));
    glows.current.forEach((m) => m && (m.emissiveIntensity = 0.2 + atmos.night * 2.5));
  });
  return (
    <>
      {spots.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <Model url={M.lantern} position={[0, 0, 0]} scale={2.2} />
          <mesh position={[0, 3.1, 0]}>
            <sphereGeometry args={[0.18, 8, 6]} />
            <meshStandardMaterial
              ref={(m) => {
                if (m) glows.current[i] = m;
              }}
              color="#ffcf8a"
              emissive="#ffae4a"
              emissiveIntensity={0.2}
            />
          </mesh>
          {i < 5 && (
            <pointLight
              ref={(l) => {
                if (l) lights.current[i] = l;
              }}
              position={[0, 3.2, 0]}
              distance={14}
              decay={1.6}
              color="#ffb766"
              intensity={0}
            />
          )}
        </group>
      ))}
    </>
  );
}

function QuayProps() {
  return (
    <group>
      {/* tonneaux empilés */}
      {[
        [-12, -3],
        [-11, -1.4],
        [-8.6, -3.2],
        [18, 1],
        [19.3, 1.2],
        [30, -3],
        [-42, -4],
        [-41, -2.6],
      ].map(([x, z], i) => (
        <Model key={i} url={M.barrel} position={[x, 0, z]} rotation={i} />
      ))}
      <Model url={M.barrel} position={[-11.5, 1.2, -2.3]} rotation={2} />
      {[
        [14, -3],
        [15, -1.6],
        [22, -4],
        [-20, 2],
        [36, -2],
      ].map(([x, z], i) => (
        <Model key={i} url={M.crate} position={[x, 0, z]} rotation={i * 0.7} />
      ))}
      <Model url={M.cart} position={[-6, 0, 8]} rotation={0.4} scale={2.6} />
      <Model url={M.cartHigh} position={[26, 0, 8]} rotation={-0.8} scale={2.6} />
      <Model url={M.stallRed} position={[2, 0, 14]} rotation={Math.PI / 2} scale={3} />
      <Model url={M.stallGreen} position={[-10, 0, 16]} rotation={Math.PI / 2} scale={3} />
      <Model url={M.bench} position={[8, 0, 12]} scale={2.6} />
      <Model url={M.treeHigh} position={[-26, 0, 32]} scale={3} />
      <Model url={M.tree} position={[44, 0, 30]} scale={3} />
      <Model url={M.cannon} position={[56, 0, -5]} rotation={Math.PI} scale={1.3} />
      <Crane position={[-6, 0, -5]} />
      {/* sacs */}
      <Sack position={[23, 0.35, 1]} />
      <Sack position={[24.5, 0.35, 2.6]} color="#c4ad80" />
      <Sack position={[23.8, 0.9, 1.8]} />
      {/* enseigne */}
      <mesh position={[-34, 7.5, 10.7]}>
        <planeGeometry args={[6, 1.2]} />
        <meshStandardMaterial color="#3b2a1d" />
      </mesh>
    </group>
  );
}

function OtherBoats() {
  const bob = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!bob.current) return;
    bob.current.children.forEach((c, i) => {
      c.position.y = WATER_Y - 0.4 + Math.sin(clock.elapsedTime * 0.8 + i) * 0.12;
      c.rotation.z = Math.sin(clock.elapsedTime * 0.6 + i) * 0.02;
    });
  });
  return (
    <group ref={bob}>
      <group position={[-34, 0, -24]} rotation-y={Math.PI / 2}>
        <Model url={M.shipMedium} position={[0, 0, 0]} scale={2.2} />
      </group>
      <group position={[42, 0, -26]} rotation-y={-Math.PI / 2}>
        <Model url={M.shipSmall} position={[0, 0, 0]} scale={2.2} />
      </group>
      <group position={[-60, 0, -40]} rotation-y={0.6}>
        <Model url={M.shipMedium} position={[0, 0, 0]} scale={2.2} />
      </group>
      <group position={[-16, 0, -11]} rotation-y={0.2}>
        <Model url={M.rowboat} position={[0, 0.5, 0]} scale={1.6} />
      </group>
      <group position={[26, 0, -12]} rotation-y={-1.1}>
        <Model url={M.rowboatL} position={[0, 0.5, 0]} scale={1.6} />
      </group>
    </group>
  );
}

export function Port() {
  return (
    <group>
      <Water />
      <Quay />
      <GlowingWindows>
        {BUILDINGS.map((b, i) => {
          if (b.kind === "warehouse")
            return (
              <OpenBuilding key={i} b={b}>
                <WarehouseInterior />
              </OpenBuilding>
            );
          if (b.kind === "merchant")
            return (
              <OpenBuilding key={i} b={b}>
                <MerchantInterior />
              </OpenBuilding>
            );
          if (b.ilot) return <IlotBuilding key={i} b={b} />;
          return <SolidHouse key={i} b={b} />;
        })}
      </GlowingWindows>
      <IlotSign />
      <Shipyard />
      <QuayProps />
      <OtherBoats />
      <Lanterns />
      <Gulls />
    </group>
  );
}

function signTexture() {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#e8dcc2";
  g.fillRect(0, 0, 1024, 128);
  g.strokeStyle = "#6b5232";
  g.lineWidth = 6;
  g.strokeRect(8, 8, 1008, 112);
  g.fillStyle = "#3a2a18";
  g.font = "bold 64px Georgia, serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("ÎLOT BONNAFFÉ", 512, 66);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Plaque sur la façade de l'îlot Bonnaffé, entre les arcades et le balcon. */
function IlotSign() {
  const tex = useMemo(() => signTexture(), []);
  return (
    <mesh position={[10, 4.45, 24.62]} rotation-y={Math.PI}>
      <planeGeometry args={[5, 0.62]} />
      <meshStandardMaterial map={tex} roughness={0.8} />
    </mesh>
  );
}

const STONE_LIGHT = "#e3d6bb";
const STONE_TRIM = "#d2c3a3";
const GLASS = "#2e3d47";
const IRON = "#1c1c1e";

/**
 * Immeuble de l'îlot Bonnaffé, inspiré de la photo : pierre blonde,
 * arcades au rez-de-chaussée, long balcon en fer forgé, hautes fenêtres
 * à garde-corps, corniche et balustrade en toit-terrasse.
 */
function IlotBuilding({ b }: { b: Building }) {
  const tex = useMemo(() => ashlarTexture(2, [b.w / 2.5, b.h / 2.5]), [b]);
  const faceZ = b.z - b.d / 2;
  const cols = [-4.8, -1.6, 1.6, 4.8];
  const floors = [6.0, 9.4, 12.6]; // bas des fenêtres des étages
  const winH = [2.8, 2.5, 2.1];
  const rails: ReactElement[] = [];
  // Balusters du grand balcon (façade + retours)
  for (let x = -b.w / 2 - 0.3; x <= b.w / 2 + 0.3; x += 0.28) {
    rails.push(
      <mesh key={`r${x.toFixed(2)}`} position={[x, 5.35, -0.88]}>
        <boxGeometry args={[0.04, 0.95, 0.04]} />
        <meshStandardMaterial color={IRON} metalness={0.6} roughness={0.4} />
      </mesh>,
    );
  }
  return (
    <group>
      {/* Volume en pierre */}
      <mesh position={[b.x, 16 / 2, b.z]} castShadow receiveShadow>
        <boxGeometry args={[b.w, 16, b.d]} />
        <meshStandardMaterial map={tex} roughness={0.85} />
      </mesh>
      <group position={[b.x, 0, faceZ]}>
        {/* Soubassement à bossages */}
        <mesh position={[0, 2.05, -0.08]}>
          <boxGeometry args={[b.w + 0.1, 4.1, 0.16]} />
          <meshStandardMaterial color={STONE_TRIM} roughness={0.9} />
        </mesh>
        {[1.0, 2.0, 3.0].map((y) => (
          <mesh key={y} position={[0, y, -0.17]}>
            <boxGeometry args={[b.w + 0.1, 0.05, 0.02]} />
            <meshStandardMaterial color="#a8987a" />
          </mesh>
        ))}
        {/* Arcades */}
        {cols.map((x) => (
          <group key={`a${x}`} position={[x, 0, -0.18]}>
            <mesh position={[0, 1.55, 0]} rotation-y={Math.PI}>
              <planeGeometry args={[1.9, 3.1]} />
              <meshStandardMaterial color={GLASS} roughness={0.2} metalness={0.3} />
            </mesh>
            <mesh position={[0, 3.1, 0]} rotation-y={Math.PI}>
              <circleGeometry args={[0.95, 20, 0, Math.PI]} />
              <meshStandardMaterial color={GLASS} roughness={0.2} metalness={0.3} />
            </mesh>
            {/* clé d'arc sculptée */}
            <mesh position={[0, 3.95, -0.06]}>
              <boxGeometry args={[0.35, 0.5, 0.14]} />
              <meshStandardMaterial color={STONE_LIGHT} />
            </mesh>
          </group>
        ))}
        {/* Porte centrale */}
        <mesh position={[0, 1.6, -0.18]} rotation-y={Math.PI}>
          <planeGeometry args={[1.3, 3.2]} />
          <meshStandardMaterial color={WOOD} roughness={0.8} />
        </mesh>
        {/* Bandeau + consoles sous le balcon */}
        <mesh position={[0, 4.65, -0.25]}>
          <boxGeometry args={[b.w + 0.3, 0.3, 0.5]} />
          <meshStandardMaterial color={STONE_LIGHT} />
        </mesh>
        {[-6.2, -3.2, 0, 3.2, 6.2].map((x) => (
          <mesh key={`c${x}`} position={[x, 4.25, -0.3]}>
            <boxGeometry args={[0.35, 0.7, 0.5]} />
            <meshStandardMaterial color={STONE_LIGHT} />
          </mesh>
        ))}
        {/* Grand balcon en fer forgé */}
        <mesh position={[0, 4.85, -0.5]} castShadow>
          <boxGeometry args={[b.w + 0.8, 0.14, 1.0]} />
          <meshStandardMaterial color={STONE_TRIM} />
        </mesh>
        <mesh position={[0, 5.85, -0.88]}>
          <boxGeometry args={[b.w + 0.7, 0.07, 0.07]} />
          <meshStandardMaterial color={IRON} metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh position={[0, 5.2, -0.88]}>
          <boxGeometry args={[b.w + 0.7, 0.04, 0.04]} />
          <meshStandardMaterial color={IRON} metalness={0.6} roughness={0.4} />
        </mesh>
        {rails}
        {/* Fenêtres des étages */}
        {floors.map((y, fi) =>
          cols.map((x) => (
            <group key={`w${fi}${x}`} position={[x, y, 0]}>
              {/* encadrement */}
              <mesh position={[0, winH[fi]! / 2, -0.05]}>
                <boxGeometry args={[1.55, winH[fi]! + 0.3, 0.1]} />
                <meshStandardMaterial color={STONE_LIGHT} />
              </mesh>
              <mesh position={[0, winH[fi]! / 2, -0.11]} rotation-y={Math.PI}>
                <planeGeometry args={[1.2, winH[fi]!]} />
                <meshStandardMaterial color={GLASS} roughness={0.15} metalness={0.4} />
              </mesh>
              {/* petits bois */}
              <mesh position={[0, winH[fi]! / 2, -0.12]}>
                <boxGeometry args={[0.05, winH[fi]!, 0.02]} />
                <meshStandardMaterial color="#f2ede2" />
              </mesh>
              <mesh position={[0, winH[fi]! * 0.62, -0.12]}>
                <boxGeometry args={[1.2, 0.05, 0.02]} />
                <meshStandardMaterial color="#f2ede2" />
              </mesh>
              {/* entablement au-dessus */}
              <mesh position={[0, winH[fi]! + 0.25, -0.14]}>
                <boxGeometry args={[1.8, 0.16, 0.28]} />
                <meshStandardMaterial color={STONE_LIGHT} />
              </mesh>
              {/* garde-corps à balustres (étages supérieurs) */}
              {fi > 0 && (
                <>
                  <mesh position={[0, 0.05, -0.25]}>
                    <boxGeometry args={[1.6, 0.1, 0.4]} />
                    <meshStandardMaterial color={STONE_LIGHT} />
                  </mesh>
                  {[-0.6, -0.3, 0, 0.3, 0.6].map((bx) => (
                    <mesh key={bx} position={[bx, 0.3, -0.38]}>
                      <cylinderGeometry args={[0.05, 0.06, 0.45, 6]} />
                      <meshStandardMaterial color={STONE_LIGHT} />
                    </mesh>
                  ))}
                  <mesh position={[0, 0.55, -0.38]}>
                    <boxGeometry args={[1.6, 0.08, 0.14]} />
                    <meshStandardMaterial color={STONE_LIGHT} />
                  </mesh>
                </>
              )}
              {/* panneau sculpté sous la fenêtre */}
              {fi < 2 && (
                <mesh position={[0, -0.45, -0.06]}>
                  <boxGeometry args={[1.4, 0.45, 0.08]} />
                  <meshStandardMaterial color={STONE_TRIM} />
                </mesh>
              )}
            </group>
          )),
        )}
        {/* Chaînes d'angle */}
        {[-b.w / 2 + 0.25, b.w / 2 - 0.25].map((x) => (
          <mesh key={`p${x}`} position={[x, 10.4, -0.1]}>
            <boxGeometry args={[0.5, 11, 0.2]} />
            <meshStandardMaterial color={STONE_TRIM} />
          </mesh>
        ))}
        {/* Corniche */}
        <mesh position={[0, 15.4, -0.3]} castShadow>
          <boxGeometry args={[b.w + 0.6, 0.35, 0.6]} />
          <meshStandardMaterial color={STONE_LIGHT} />
        </mesh>
        <mesh position={[0, 15.8, -0.4]} castShadow>
          <boxGeometry args={[b.w + 0.9, 0.3, 0.8]} />
          <meshStandardMaterial color={STONE_LIGHT} />
        </mesh>
      </group>
      {/* Balustrade du toit-terrasse */}
      <mesh position={[b.x, 16.05, b.z]}>
        <boxGeometry args={[b.w, 0.1, b.d]} />
        <meshStandardMaterial color="#9a9284" />
      </mesh>
      {Array.from({ length: 22 }, (_, i) => (
        <mesh
          key={`bt${i}`}
          position={[b.x - b.w / 2 + 0.4 + i * ((b.w - 0.8) / 21), 16.35, faceZ + 0.1]}
        >
          <cylinderGeometry args={[0.07, 0.09, 0.55, 6]} />
          <meshStandardMaterial color={STONE_LIGHT} />
        </mesh>
      ))}
      <mesh position={[b.x, 16.7, faceZ + 0.1]}>
        <boxGeometry args={[b.w, 0.12, 0.25]} />
        <meshStandardMaterial color={STONE_LIGHT} />
      </mesh>
    </group>
  );
}

export { Sack };
