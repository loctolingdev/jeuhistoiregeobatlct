import { Html, useAnimations } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import * as THREE from "three";
import { charModel, M, Model, useModel } from "../models";
import { NPCS, GOODS, ZONES } from "../data";
import { missionList, useGame } from "../store";
import { input, movementVector, consumeInteract } from "../controls";
import {
  BOUNDS,
  CABIN_ENTRY,
  CABIN_EXIT,
  CABIN_SPOT,
  CHEST_SPOT,
  CRATES,
  DELIVERY_SPOT,
  GOOD_SPOTS,
  HATCH_SPOT,
  HOLD_ORIGIN,
  LADDER_SPOT,
  DECK_Y,
  HOLD_ENTRY,
  DECK_ENTRY,
  groundAt,
  resolve,
} from "../world";
import { usePrompt } from "../prompt";
import { useMp } from "../multiplayer";
import { audio } from "../audio";
import { Sack } from "./Port";

const PERSON_H = 1.75;

export interface PersonHandle {
  group: THREE.Group | null;
  setClip: (c: string) => void;
}

/** Personnage animé (clip : idle / walk / sprint…). */
export const Person = forwardRef<
  PersonHandle,
  {
    model: string;
    clip?: string;
    position?: [number, number, number];
    rotation?: number;
    children?: React.ReactNode;
  }
>(function Person({ model, clip = "idle", position = [0, 0, 0], rotation = 0, children }, ref) {
  const group = useRef<THREE.Group>(null);
  const { object, animations } = useModel(charModel(model), PERSON_H);
  const { actions } = useAnimations(animations, group);
  const current = useRef<string | null>(null);
  const setClip = (c: string) => {
    if (current.current === c) return;
    if (current.current) actions[current.current]?.fadeOut(0.2);
    actions[c]?.reset().fadeIn(0.2).play();
    current.current = c;
  };
  useEffect(() => {
    setClip(clip);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions, clip]);
  useImperativeHandle(ref, () => ({ group: group.current, setClip }));
  return (
    <group ref={group} position={position} rotation-y={rotation}>
      <primitive object={object} />
      {children}
    </group>
  );
});

function NpcMarker({ name, job, talked }: { name: string; job: string; talked: boolean }) {
  return (
    <Html position={[0, 2.35, 0]} center distanceFactor={14} zIndexRange={[10, 0]}>
      <div className="npc-tag">
        <span className={talked ? "npc-tag-dot npc-tag-dot--done" : "npc-tag-dot"}>
          {talked ? "✓" : "!"}
        </span>
        <span className="npc-tag-name">{name}</span>
        <span className="npc-tag-job">{job}</span>
      </div>
    </Html>
  );
}

export function Npcs() {
  const talked = useGame((s) => s.npcs);
  return (
    <>
      {NPCS.map((n) => (
        <group key={n.id} position={[n.x, 0, n.z]}>
          <Person
            model={n.model}
            clip={n.id === "charpentier" ? "interact-right" : "idle"}
            rotation={n.rotation}
          />
          <NpcMarker name={n.name} job={n.job} talked={talked.includes(n.id)} />
        </group>
      ))}
    </>
  );
}

/** Passants qui circulent sur les quais (ambiance). */
function Walker({
  model,
  path,
  speed,
  offset,
}: {
  model: string;
  path: [number, number][];
  speed: number;
  offset: number;
}) {
  const ref = useRef<PersonHandle>(null);
  const t = useRef(offset);
  const total = path.length;
  useFrame((_, d) => {
    const g = ref.current?.group;
    if (!g) return;
    t.current += Math.min(d, 0.05) * speed;
    const seg = Math.floor(t.current) % total;
    const f = t.current % 1;
    const a = path[seg];
    const b = path[(seg + 1) % total];
    g.position.set(a[0] + (b[0] - a[0]) * f, 0, a[1] + (b[1] - a[1]) * f);
    g.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]);
  });
  return <Person ref={ref} model={model} clip="walk" />;
}

export function Crowd() {
  return (
    <>
      <Walker
        model="character-female-b"
        path={[
          [-40, 2],
          [30, 2],
        ]}
        speed={0.035}
        offset={0}
      />
      <Walker
        model="character-male-f"
        path={[
          [40, 6],
          [-30, 6],
        ]}
        speed={0.03}
        offset={0.3}
      />
      <Walker
        model="character-female-c"
        path={[
          [-20, 20],
          [20, 20],
          [20, 10],
          [-20, 10],
        ]}
        speed={0.06}
        offset={1.2}
      />
      <Walker
        model="character-male-b"
        path={[
          [-50, -5],
          [-20, -5],
        ]}
        speed={0.07}
        offset={0.5}
      />
    </>
  );
}

function GoodProp({ kind }: { kind: string }) {
  if (kind === "barrel") return <Model url={M.barrel} position={[0, 0, 0]} />;
  if (kind === "crate") return <Model url={M.crate} position={[0, 0, 0]} />;
  if (kind === "sack") return <Sack position={[0, 0.35, 0]} />;
  if (kind === "bale")
    return (
      <mesh position={[0, 0.4, 0]} castShadow>
        <boxGeometry args={[1, 0.8, 0.7]} />
        <meshStandardMaterial color="#7d5a7a" roughness={1} />
      </mesh>
    );
  if (kind === "logs")
    return (
      <group>
        {[0, 1, 2].map((i) => (
          <mesh
            key={i}
            position={[0, 0.25 + (i === 2 ? 0.42 : 0), i === 2 ? 0 : i * 0.5 - 0.25]}
            rotation-z={Math.PI / 2}
            castShadow
          >
            <cylinderGeometry args={[0.24, 0.24, 2.4, 8]} />
            <meshStandardMaterial color="#8a6744" />
          </mesh>
        ))}
      </group>
    );
  return (
    <group>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[i * 0.3 - 0.3, 0.2, 0]} castShadow>
          <cylinderGeometry args={[0.12, 0.14, 0.4, 10]} />
          <meshStandardMaterial color={i === 1 ? "#2b3d7a" : "#8a5a32"} roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

export function Goods() {
  const inHold = useGame((s) => s.inHold);
  const found = useGame((s) => s.goods);
  const openGood = useGame((s) => s.openGood);
  const identify = useGame((s) => s.identifyGood);
  return (
    <>
      {GOOD_SPOTS.filter((g) => (g.good === "sel") === inHold).map((g) => (
        <group
          key={g.good}
          position={[g.x, g.y ?? 0, g.z]}
          onClick={(e) => {
            e.stopPropagation();
            if (useGame.getState().phase !== "playing") return;
            openGood(g.good);
            identify(g.good);
          }}
          onPointerOver={() => (document.body.style.cursor = "pointer")}
          onPointerOut={() => (document.body.style.cursor = "")}
        >
          <GoodProp kind={g.kind} />
          {!found.includes(g.good) && (
            <Html position={[0, 1.7, 0]} center distanceFactor={12} zIndexRange={[10, 0]}>
              <div className="good-tag">{GOODS.find((x) => x.id === g.good)?.emoji} ?</div>
            </Html>
          )}
        </group>
      ))}
    </>
  );
}

function CratesToLoad() {
  const loaded = useGame((s) => s.cratesLoaded);
  const carrying = useGame((s) => s.carrying);
  if (loaded >= CRATES.length) return null;
  const c = CRATES[loaded];
  return (
    <>
      {!carrying && (
        <group position={[c.x, 0, c.z]}>
          <Model url={M.crate} position={[0, 0, 0]} />
          <Html position={[0, 1.6, 0]} center distanceFactor={12} zIndexRange={[10, 0]}>
            <div className="good-tag">📦 Colis {loaded + 1}/3</div>
          </Html>
        </group>
      )}
      {carrying && (
        <group position={[DELIVERY_SPOT.x, 0, DELIVERY_SPOT.z]}>
          <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, 0]}>
            <ringGeometry args={[1.1, 1.4, 32]} />
            <meshBasicMaterial color="#e3b04b" transparent opacity={0.85} />
          </mesh>
        </group>
      )}
    </>
  );
}

type Target = { label: string; x: number; z: number; r: number; act: () => void };

const FWD = new THREE.Vector3();
const RIGHT = new THREE.Vector3();

export function Player({ onRef }: { onRef: (g: THREE.Group | null) => void }) {
  const person = useRef<PersonHandle>(null);
  const carried = useRef<THREE.Group>(null);
  const profileName = useMp((state) => state.name);
  const avatarUrl = useMp((state) => state.avatarUrl);
  const yaw = useRef(Math.PI);
  const zoneTimer = useRef(0);
  const posTimer = useRef(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    onRef(person.current?.group ?? null);
    const g = person.current?.group;
    if (g) g.position.set(4, 0, 0);
    setReady(true);
  }, [onRef]);

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    const g = person.current?.group;
    if (!g || !ready) return;
    const s = useGame.getState();
    if (carried.current) carried.current.visible = !!s.carrying;
    if (s.phase !== "playing") {
      person.current?.setClip("idle");
      return;
    }
    const blocked = s.panel !== null;

    // Déplacement relatif à la caméra
    const mv = blocked ? { x: 0, y: 0, len: 0 } : movementVector();
    const sprint = input.keys.has("ShiftLeft") || input.keys.has("ShiftRight");
    const speed = (sprint ? 8 : 4.6) * (s.carrying ? 0.75 : 1);
    if (mv.len > 0.05) {
      FWD.set(-Math.sin(input.camYaw), 0, -Math.cos(input.camYaw));
      RIGHT.set(Math.cos(input.camYaw), 0, -Math.sin(input.camYaw));
      const dx = (FWD.x * mv.y + RIGHT.x * mv.x) * speed * dt;
      const dz = (FWD.z * mv.y + RIGHT.z * mv.x) * speed * dt;
      let nx = g.position.x + dx;
      let nz = g.position.z + dz;
      if (!s.inHold && !s.inCabin) {
        // Les limites de la cale sont gérées par ses propres murs.
        nx = Math.max(BOUNDS.x1, Math.min(BOUNDS.x2, nx));
        nz = Math.max(BOUNDS.z1, Math.min(BOUNDS.z2, nz));
      }
      const r = resolve(nx, nz, 0.4, s.inHold, s.inCabin);
      const gr = groundAt(r.x, r.z, s.inHold, s.inCabin);
      if (gr.walkable) {
        g.position.x = r.x;
        g.position.z = r.z;
      }
      const target = Math.atan2(dx, dz);
      let diff = target - yaw.current;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      yaw.current += diff * (1 - Math.exp(-12 * dt));
      g.rotation.y = yaw.current;
      person.current?.setClip(sprint ? "sprint" : "walk");
    } else {
      person.current?.setClip(s.carrying ? "holding-both" : "idle");
    }
    const ground = groundAt(g.position.x, g.position.z, s.inHold, s.inCabin);
    g.position.y += (ground.y - g.position.y) * (1 - Math.exp(-14 * dt));
    if ((ground.zone === "pont") !== s.onShip) s.setOnShip(ground.zone === "pont");

    // Découverte des lieux / parties du navire
    zoneTimer.current += dt;
    if (zoneTimer.current > 0.4) {
      zoneTimer.current = 0;
      for (const z of ZONES) {
        if (z.id === "navire") {
          if (ground.zone !== "quai") s.visitZone(z.id, z.name, z.fact);
          continue;
        }
        if (
          Math.hypot(g.position.x - z.x, g.position.z - z.z) < z.radius &&
          !s.zones.includes(z.id)
        ) {
          if (z.id === "quais" || ground.zone === "quai") s.visitZone(z.id, z.name, z.fact);
        }
      }
      if (ground.zone === "pont") s.visitShipPart("pont");
      if (ground.zone === "cale") s.visitShipPart("cale");
      if (ground.zone === "cabine") s.visitShipPart("cabine");
    }
    posTimer.current += dt;
    if (posTimer.current > 0.2) {
      posTimer.current = 0;
      useGame.setState({ playerPos: { x: g.position.x, z: g.position.z } });
    }

    // Interactions
    const targets: Target[] = [];
    for (const n of s.inHold || s.inCabin ? [] : NPCS)
      targets.push({
        label: `Parler à ${n.name} (${n.job})`,
        x: n.x,
        z: n.z,
        r: 2.6,
        act: () => {
          s.openDialog(n.id);
          s.talkTo(n.id, n.fact);
          audio.blip(523);
        },
      });
    for (const gs of GOOD_SPOTS.filter((item) => (item.good === "sel") === s.inHold && !s.inCabin))
      targets.push({
        label: `Examiner : ${GOODS.find((x) => x.id === gs.good)?.name}`,
        x: gs.x,
        z: gs.z,
        r: 2,
        act: () => {
          s.openGood(gs.good);
          s.identifyGood(gs.good);
          audio.blip(660);
        },
      });
    if (!s.inHold && !s.inCabin && s.cratesLoaded < CRATES.length && !s.carrying) {
      const c = CRATES[s.cratesLoaded];
      targets.push({
        label: "Soulever le colis",
        x: c.x,
        z: c.z,
        r: 2,
        act: () => s.setCarrying(c.id),
      });
    }
    if (s.carrying && !s.inHold && !s.inCabin)
      targets.push({
        label: "Déposer le colis au pied de la passerelle",
        x: DELIVERY_SPOT.x,
        z: DELIVERY_SPOT.z,
        r: 2.4,
        act: () => s.deliverCrate(),
      });
    if (ground.zone === "pont") {
      targets.push({
        label: "Descendre dans la cale",
        x: HATCH_SPOT.x,
        z: HATCH_SPOT.z,
        r: 1.8,
        act: () => {
          g.position.set(HOLD_ENTRY.x, HOLD_ENTRY.y, HOLD_ENTRY.z);
          s.setInHold(true);
          s.visitShipPart("cale");
        },
      });
      targets.push({
        label: "Entrer dans la cabine du capitaine",
        x: CABIN_SPOT.x,
        z: CABIN_SPOT.z,
        r: 2,
        act: () => {
          g.position.set(CABIN_ENTRY.x, CABIN_ENTRY.y, CABIN_ENTRY.z);
          s.setInCabin(true);
          s.visitShipPart("cabine");
          s.learnFact(
            "La cabine, à l'arrière du navire, servait au capitaine : on y gardait les cartes, le livre de bord et les papiers de la cargaison.",
          );
          s.notify("Cabine : cartes, livre de bord et papiers de cargaison", "🧭");
        },
      });
    }
    if (s.inCabin) {
      const mainMissionsDone = missionList(s)
        .slice(0, 5)
        .every((m) => m.done);
      targets.push({
        label:
          s.chestOpened || mainMissionsDone
            ? "Ouvrir le coffre du capitaine"
            : "Examiner le coffre du capitaine (verrouillé)",
        x: CHEST_SPOT.x,
        z: CHEST_SPOT.z,
        r: 1.8,
        act: () => {
          s.openChest();
          audio.blip(mainMissionsDone ? 880 : 440);
        },
      });
      targets.push({
        label: "Sortir de la cabine",
        x: CABIN_EXIT.x,
        z: CABIN_EXIT.z,
        r: 2,
        act: () => {
          g.position.set(CABIN_EXIT.x, CABIN_EXIT.y, CABIN_EXIT.z);
          s.setInCabin(false);
        },
      });
    }
    if (ground.zone === "cale")
      targets.push({
        label: "Remonter sur le pont",
        x: LADDER_SPOT.x,
        z: LADDER_SPOT.z,
        r: 2,
        act: () => {
          g.position.set(DECK_ENTRY.x, DECK_ENTRY.y, DECK_ENTRY.z);
          s.setInHold(false);
        },
      });

    let best: Target | null = null;
    let bestD = Infinity;
    for (const t of targets) {
      const d = Math.hypot(g.position.x - t.x, g.position.z - t.z);
      if (d < t.r && d < bestD) {
        best = t;
        bestD = d;
      }
    }
    const label = blocked ? null : (best?.label ?? null);
    if (usePrompt.getState().text !== label) usePrompt.setState({ text: label });
    if (consumeInteract() && best && !blocked) best.act();
  });

  return (
    <>
      <Person ref={person} model="character-male-b">
        <Html position={[0, 2.2, 0]} center distanceFactor={14} zIndexRange={[10, 0]}>
          <div className="mp-tag">
            <span className="mp-avatar">
              {avatarUrl ? <img src={avatarUrl} alt="" draggable={false} /> : <span>👤</span>}
            </span>
            <span className="mp-tag-name">{profileName}</span>
          </div>
        </Html>
      </Person>
      <CarriedCrate refEl={carried} personRef={person} />
      <CratesToLoad />
    </>
  );
}

function CarriedCrate({
  refEl,
  personRef,
}: {
  refEl: React.RefObject<THREE.Group | null>;
  personRef: React.RefObject<PersonHandle | null>;
}) {
  useFrame(() => {
    const g = personRef.current?.group;
    if (g && refEl.current) {
      refEl.current.position.set(g.position.x, g.position.y + 1.85, g.position.z);
      refEl.current.rotation.y = g.rotation.y;
    }
  });
  return (
    <group ref={refEl} visible={false}>
      <Model url={M.crate} position={[0, 0, 0]} scale={0.7} />
    </group>
  );
}
