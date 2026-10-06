import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import {
  BOARDING_LANDING,
  CABIN_SPOT,
  CHEST_SPOT,
  DECK,
  DECK_Y,
  GANGWAY,
  HATCH_SPOT,
  HOLD_ORIGIN,
  LADDER_SPOT,
  QUAY_EDGE_Z,
  SHIP,
} from "../world";
import { M, Model } from "../models";
import { TallShip } from "./TallShip";
import { planksTexture } from "../textures";
import { Sack } from "./Port";
import { useGame } from "../store";

function nameTexture() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 96;
  const g = c.getContext("2d");
  if (!g) return new THREE.CanvasTexture(c);
  g.fillStyle = "#2b1d12";
  g.fillRect(0, 0, 512, 96);
  g.strokeStyle = "#b8924a";
  g.lineWidth = 4;
  g.strokeRect(6, 6, 500, 84);
  g.fillStyle = "#e3c27a";
  g.font = "bold 44px Georgia, serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("FRANÇOIS BONNAFFÉ", 256, 50);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function Ship() {
  const deckTex = useMemo(() => planksTexture([8, 2]), []);
  const name = useMemo(() => nameTexture(), []);
  const inHold = useGame((s) => s.inHold);
  const inCabin = useGame((s) => s.inCabin);
  const chestOpened = useGame((s) => s.chestOpened);
  const sway = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (sway.current) sway.current.rotation.x = Math.sin(clock.elapsedTime * 0.5) * 0.006;
  });
  const deckW = DECK.x2 - DECK.x1;
  const deckD = DECK.z2 - DECK.z1;
  const rampTex = useMemo(() => planksTexture([1, 4]), []);
  const rampLen = Math.hypot(QUAY_EDGE_Z - GANGWAY.z2, DECK_Y);
  const rampAngle = Math.atan2(DECK_Y, QUAY_EDGE_Z - GANGWAY.z2);

  return (
    <group>
      <group ref={sway} position={[SHIP.x, 0, SHIP.z]} visible={!inHold}>
        <group position={[-SHIP.x, 0, -SHIP.z]}>
          <group
            position={[SHIP.x, DECK_Y - 2.1 * SHIP.scale - 0.04, SHIP.z]}
            rotation-y={Math.PI / 2}
          >
            <TallShip url={M.ship} scale={SHIP.scale} nameMap={name} />
          </group>
          {/* pont marchable */}
          <mesh
            position={[(DECK.x1 + DECK.x2) / 2, DECK_Y - 0.05, (DECK.z1 + DECK.z2) / 2]}
            receiveShadow
          >
            <boxGeometry args={[deckW, 0.1, deckD]} />
            <meshStandardMaterial map={deckTex} roughness={0.9} />
          </mesh>
          {/* écoutille */}
          <mesh position={[HATCH_SPOT.x, DECK_Y + 0.02, HATCH_SPOT.z]} rotation-x={-Math.PI / 2}>
            <planeGeometry args={[1.8, 1.8]} />
            <meshStandardMaterial color="#1a120c" />
          </mesh>
          <mesh position={[HATCH_SPOT.x, DECK_Y + 0.08, HATCH_SPOT.z]}>
            <boxGeometry args={[2, 0.12, 2]} />
            <meshStandardMaterial color="#4a3020" wireframe />
          </mesh>
          {/* cabine du capitaine : coque fermée dehors, intérieur détaillé une fois dedans */}
          <group position={[CABIN_SPOT.x + 1.6, DECK_Y, CABIN_SPOT.z]}>
            {!inCabin ? (
              <>
                <mesh position={[0, 1.3, 0]} castShadow>
                  <boxGeometry args={[2.6, 2.6, 5.5]} />
                  <meshStandardMaterial color="#5a3b24" roughness={0.8} />
                </mesh>
                <mesh position={[-1.31, 1.1, 0]} rotation-y={-Math.PI / 2}>
                  <planeGeometry args={[1, 2]} />
                  <meshStandardMaterial color="#2a1a10" />
                </mesh>
                <mesh position={[-1.34, 2.05, 0]} rotation-y={-Math.PI / 2}>
                  <planeGeometry args={[1.25, 0.12]} />
                  <meshStandardMaterial color="#c5a35a" metalness={0.5} roughness={0.45} />
                </mesh>
              </>
            ) : (
              <CabinInterior chestOpened={chestOpened} />
            )}
          </group>
          {/* cargaison sur le pont */}
          <Model url={M.barrel} position={[8, DECK_Y, -24]} />
          <Model url={M.barrel} position={[9.3, DECK_Y, -24.2]} rotation={1} />
          <Model url={M.crate} position={[-2, DECK_Y, -20]} rotation={0.4} />
          <mesh
            position={[GANGWAY.x, DECK_Y - 0.05, (BOARDING_LANDING.z1 + BOARDING_LANDING.z2) / 2]}
            receiveShadow
          >
            <boxGeometry
              args={[GANGWAY.half * 2, 0.1, BOARDING_LANDING.z2 - BOARDING_LANDING.z1]}
            />
            <meshStandardMaterial map={deckTex} roughness={0.9} />
          </mesh>
        </group>
      </group>

      {/* passerelle */}
      <mesh
        position={[GANGWAY.x, DECK_Y / 2 + 0.05, (QUAY_EDGE_Z + GANGWAY.z2) / 2]}
        rotation-x={rampAngle}
        castShadow
        receiveShadow
        visible={!inHold}
      >
        <boxGeometry args={[GANGWAY.half * 2, 0.15, rampLen]} />
        <meshStandardMaterial map={rampTex} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          position={[
            GANGWAY.x + s * GANGWAY.half,
            DECK_Y / 2 + 0.7,
            (QUAY_EDGE_Z + GANGWAY.z2) / 2,
          ]}
          rotation-x={rampAngle}
          visible={!inHold}
        >
          <boxGeometry args={[0.06, 0.06, rampLen]} />
          <meshStandardMaterial color="#c9b48a" />
        </mesh>
      ))}
    </group>
  );
}

function CabinInterior({ chestOpened }: { chestOpened: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.03, 0]} rotation-x={-Math.PI / 2} receiveShadow>
        <boxGeometry args={[2.45, 5.3, 0.05]} />
        <meshStandardMaterial color="#6d4a2e" roughness={0.9} />
      </mesh>
      <mesh position={[1.25, 1.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.12, 2.6, 5.3]} />
        <meshStandardMaterial color="#5a3b24" roughness={0.85} />
      </mesh>
      <mesh position={[0, 1.3, -2.65]} castShadow receiveShadow>
        <boxGeometry args={[2.5, 2.6, 0.12]} />
        <meshStandardMaterial color="#5a3b24" roughness={0.85} />
      </mesh>
      <mesh position={[0, 1.3, 2.65]} castShadow receiveShadow>
        <boxGeometry args={[2.5, 2.6, 0.12]} />
        <meshStandardMaterial color="#5a3b24" roughness={0.85} />
      </mesh>
      <mesh position={[-1.25, 2.55, 0]} receiveShadow>
        <boxGeometry args={[0.12, 0.1, 5.3]} />
        <meshStandardMaterial color="#3b2618" roughness={0.95} />
      </mesh>
      {/* Bureau du capitaine */}
      <mesh position={[0.35, 0.72, 1.45]} castShadow>
        <boxGeometry args={[1.35, 0.12, 0.85]} />
        <meshStandardMaterial color="#3e2718" roughness={0.7} />
      </mesh>
      {[0, 1].map((i) => (
        <mesh key={i} position={[0.35 + (i ? 0.5 : -0.5), 0.36, 1.45]} castShadow>
          <boxGeometry args={[0.09, 0.72, 0.09]} />
          <meshStandardMaterial color="#2c1b12" />
        </mesh>
      ))}
      {/* Livre de bord et carte */}
      <mesh position={[0.05, 0.79, 1.42]} rotation-y={-0.15}>
        <boxGeometry args={[0.55, 0.06, 0.42]} />
        <meshStandardMaterial color="#7e2f27" roughness={0.7} />
      </mesh>
      <mesh position={[0.72, 0.8, 1.48]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[0.42, 0.52]} />
        <meshStandardMaterial color="#d9c99c" roughness={0.95} />
      </mesh>
      {/* Carte murale */}
      <mesh position={[1.18, 1.7, -0.8]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[1.9, 1.05]} />
        <meshStandardMaterial color="#cbb88a" roughness={1} />
      </mesh>
      {/* Coffre final */}
      <group position={[CHEST_SPOT.x - (CABIN_SPOT.x + 1.6), 0, CHEST_SPOT.z - CABIN_SPOT.z]}>
        <Model url={M.chest} position={[0, 0, 0]} scale={0.95} />
        <pointLight
          position={[0, 1, 0]}
          intensity={chestOpened ? 9 : 3}
          distance={4}
          decay={2}
          color="#e8b85a"
        />
        {chestOpened && (
          <mesh position={[0, 0.72, 0]} rotation-x={-Math.PI / 2}>
            <boxGeometry args={[0.9, 0.05, 0.05]} />
            <meshStandardMaterial color="#f2cf64" emissive="#f2cf64" emissiveIntensity={1.4} />
          </mesh>
        )}
      </group>
      <pointLight position={[0, 2.1, 0]} intensity={8} distance={7} decay={2} color="#ffd18a" />
    </group>
  );
}

/** La cale : pièce sous le pont (instanciée à part, accessible par l'écoutille). */
export function Hold() {
  const inHold = useGame((s) => s.inHold);
  const floor = useMemo(() => planksTexture([5, 3]), []);
  const wall = useMemo(() => planksTexture([5, 1]), []);
  const { x, y, z } = HOLD_ORIGIN;
  return (
    <group visible={inHold}>
      <mesh position={[x, y, z]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[18, 6.8]} />
        <meshStandardMaterial map={floor} />
      </mesh>
      {[
        [x, -3.4, 18, 0],
        [x, 3.4, 18, Math.PI],
      ].map(([px, pz, w, r], i) => (
        <mesh key={i} position={[px, y + 1.6, z + pz]} rotation-y={r}>
          <planeGeometry args={[w, 3.2]} />
          <meshStandardMaterial map={wall} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {[-9, 9].map((dx) => (
        <mesh key={dx} position={[x + dx, y + 1.6, z]} rotation-y={Math.PI / 2}>
          <planeGeometry args={[6.8, 3.2]} />
          <meshStandardMaterial map={wall} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {/* barrots */}
      {Array.from({ length: 6 }).map((_, i) => (
        <mesh key={i} position={[x - 7.5 + i * 3, y + 3.1, z]}>
          <boxGeometry args={[0.3, 0.3, 6.8]} />
          <meshStandardMaterial color="#3e2a1a" />
        </mesh>
      ))}
      {/* échelle */}
      <group position={[LADDER_SPOT.x, y, LADDER_SPOT.z]}>
        {[-0.4, 0.4].map((s) => (
          <mesh key={s} position={[0, 1.6, s]}>
            <boxGeometry args={[0.1, 3.2, 0.1]} />
            <meshStandardMaterial color="#6d4b2f" />
          </mesh>
        ))}
        {Array.from({ length: 7 }).map((_, i) => (
          <mesh key={i} position={[0, 0.3 + i * 0.45, 0]}>
            <boxGeometry args={[0.08, 0.06, 0.8]} />
            <meshStandardMaterial color="#6d4b2f" />
          </mesh>
        ))}
      </group>
      {/* cargaison arrimée */}
      {Array.from({ length: 5 }).map((_, i) => (
        <Model key={i} url={M.barrel} position={[x - 4 + i * 1.4, y, z - 2.5]} rotation={i} />
      ))}
      {Array.from({ length: 4 }).map((_, i) => (
        <Model key={i} url={M.crate} position={[x + 3 + i * 1.2, y, z + 2.4]} rotation={i * 0.3} />
      ))}
      <Sack position={[x + 6, y + 0.35, z - 2.6]} />
      <Sack position={[x + 6.8, y + 0.35, z - 2.2]} color="#a68a5d" />
      <Sack position={[x + 6.3, y + 0.9, z - 2.4]} />
      <Model url={M.lantern} position={[x, y, z]} scale={1.4} />
      <pointLight
        position={[x, y + 2.6, z]}
        intensity={30}
        distance={16}
        decay={1.5}
        color="#ffc277"
      />
      <pointLight
        position={[x - 6, y + 2.6, z]}
        intensity={14}
        distance={10}
        decay={1.5}
        color="#ffc277"
      />
    </group>
  );
}
