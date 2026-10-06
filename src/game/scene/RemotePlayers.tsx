import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";
import { Person, type PersonHandle } from "./Characters";
import { remotePositions, useMp } from "../multiplayer";
import { useGame } from "../store";

function Remote({
  id,
  name,
  model,
  avatarUrl,
}: {
  id: string;
  name: string;
  model: string;
  avatarUrl: string | null;
}) {
  const person = useRef<PersonHandle>(null);
  const placed = useRef(false);
  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    const g = person.current?.group;
    const p = remotePositions.get(id);
    if (!g || !p) return;
    if (!placed.current) {
      g.position.set(p.x, p.y, p.z);
      placed.current = true;
    }
    const k = 1 - Math.exp(-10 * dt);
    g.position.x += (p.x - g.position.x) * k;
    g.position.y += (p.y - g.position.y) * k;
    g.position.z += (p.z - g.position.z) * k;
    let d = p.yaw - g.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    g.rotation.y += d * k;
    person.current?.setClip(p.clip);
  });
  return (
    <Person ref={person} model={model} position={[0, -50, 0]}>
      <Html position={[0, 2.2, 0]} center distanceFactor={14} zIndexRange={[10, 0]}>
        <div className="mp-tag">
          <span className="mp-avatar">
            {avatarUrl ? <img src={avatarUrl} alt="" draggable={false} /> : <span>👤</span>}
          </span>
          <span className="mp-tag-name">{name}</span>
        </div>
      </Html>
    </Person>
  );
}

/** Autres joueurs + envoi de notre position. */
export function RemotePlayers({ player }: { player: React.RefObject<THREE.Group | null> }) {
  const players = useMp((s) => s.players);
  const last = useRef({ x: 0, z: 0, t: 0, sent: "" });

  useFrame((_, dt) => {
    const g = player.current;
    if (!g || useGame.getState().phase !== "playing") return;
    const l = last.current;
    l.t += dt;
    if (l.t < 0.1) return;
    const speed = Math.hypot(g.position.x - l.x, g.position.z - l.z) / l.t;
    l.t = 0;
    l.x = g.position.x;
    l.z = g.position.z;
    const carrying = !!useGame.getState().carrying;
    const clip = speed > 6 ? "sprint" : speed > 0.5 ? "walk" : carrying ? "holding-both" : "idle";
    const key = `${g.position.x.toFixed(2)}|${g.position.z.toFixed(2)}|${g.rotation.y.toFixed(2)}|${clip}`;
    if (key === l.sent) return;
    l.sent = key;
    useMp
      .getState()
      .sendPos({ x: g.position.x, y: g.position.y, z: g.position.z, yaw: g.rotation.y, clip });
  });

  return (
    <>
      {Object.entries(players).map(([id, p]) => (
        <Remote
          key={`${id}-${p.model}`}
          id={id}
          name={p.name}
          model={p.model}
          avatarUrl={p.avatarUrl}
        />
      ))}
    </>
  );
}
