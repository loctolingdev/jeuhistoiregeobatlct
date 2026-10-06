import { Canvas } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useRef } from "react";
import * as THREE from "three";
import { Port } from "./scene/Port";
import { Hold, Ship } from "./scene/Ship";
import { Crowd, Goods, Npcs, Player } from "./scene/Characters";
import { Atmosphere, CameraRig } from "./scene/Rig";
import { input, pressInteract, shouldIgnoreKeyboard } from "./controls";
import { useGame } from "./store";
import { audio } from "./audio";
import { GameUI } from "./ui/GameUI";
import { RemotePlayers } from "./scene/RemotePlayers";

export function GameCanvas() {
  const playerRef = useRef<THREE.Group | null>(null);
  const setPlayer = useCallback((g: THREE.Group | null) => {
    playerRef.current = g;
  }, []);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const muted = useGame((s) => s.muted);
  const inHold = useGame((s) => s.inHold);

  useEffect(() => audio.setMuted(muted), [muted]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const s = useGame.getState();
      if (shouldIgnoreKeyboard(e.target)) return;
      input.keys.add(e.code);
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code))
        e.preventDefault();
      if (s.phase !== "playing") return;
      if (e.code === "KeyE") {
        if (s.panel === "dialog") s.nextDialogPage();
        else if (s.panel === "good") s.setPanel(null);
        else pressInteract();
      }
      if (e.code === "Escape") s.setPanel(s.panel ? null : "options");
      if (e.code === "KeyJ") s.setPanel(s.panel === "journal" ? null : "journal");
      if (e.code === "KeyM") s.setPanel(s.panel === "map" ? null : "map");
    };
    const up = (e: KeyboardEvent) => input.keys.delete(e.code);
    const blur = () => input.keys.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  return (
    <div className="fixed inset-0 select-none overflow-hidden bg-background">
      <div
        className="absolute inset-0 touch-none"
        onPointerDown={(e) => {
          drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || d.id !== e.pointerId) return;
          input.camYaw -= (e.clientX - d.x) * 0.006;
          input.camPitch = Math.max(
            0.05,
            Math.min(1.25, input.camPitch + (e.clientY - d.y) * 0.004),
          );
          d.x = e.clientX;
          d.y = e.clientY;
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onWheel={(e) => {
          input.camDist = Math.max(4, Math.min(24, input.camDist + e.deltaY * 0.01));
        }}
      >
        <Canvas
          shadows
          dpr={[1, 1.5]}
          camera={{ position: [0, 30, -50], fov: 55, near: 0.1, far: 400 }}
          gl={{ antialias: true }}
        >
          <Atmosphere />
          <CameraRig player={playerRef} />
          <Suspense fallback={null}>
            <group visible={!inHold}>
              <Port />
            </group>
            <Ship />
            <Hold />
            <group visible={!inHold}>
              <Npcs />
              <Crowd />
            </group>
            <Goods />
            <Player onRef={setPlayer} />
            <RemotePlayers player={playerRef} />
          </Suspense>
        </Canvas>
      </div>
      <GameUI />
    </div>
  );
}
