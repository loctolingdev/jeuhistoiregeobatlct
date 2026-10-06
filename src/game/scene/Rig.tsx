import { Environment, Lightformer } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { input } from "../controls";
import { useGame } from "../store";
import { CABIN_BOX, CABIN_ENTRY, HOLD_BOX, HOLD_ORIGIN, pointBlocked } from "../world";
import { atmos } from "./atmos";

const TARGET = new THREE.Vector3();
const DESIRED = new THREE.Vector3();
const STEP = new THREE.Vector3();

export function CameraRig({ player }: { player: React.RefObject<THREE.Group | null> }) {
  const introStart = useRef(0);
  const lastPhase = useRef("menu");
  const lastHold = useRef(false);
  const lastCabin = useRef(false);
  useFrame(({ camera, clock }, raw) => {
    const dt = Math.min(raw, 0.05);
    const { phase, inHold, inCabin } = useGame.getState();
    const t = clock.elapsedTime;
    if (phase !== lastPhase.current) {
      lastPhase.current = phase;
      introStart.current = t;
    }
    if (phase === "menu") {
      const a = t * 0.04;
      camera.position.set(Math.sin(a) * 70, 34, -40 + Math.cos(a) * 30);
      camera.lookAt(0, 0, 4);
      return;
    }
    if (phase === "intro") {
      const k = Math.min(1, (t - introStart.current) / 11);
      const e = k * k * (3 - 2 * k);
      camera.position.set(
        THREE.MathUtils.lerp(-60, 4, e),
        THREE.MathUtils.lerp(60, 5, e),
        THREE.MathUtils.lerp(-70, 10, e),
      );
      camera.lookAt(
        THREE.MathUtils.lerp(0, 4, e),
        THREE.MathUtils.lerp(0, 1.5, e),
        THREE.MathUtils.lerp(0, 0, e),
      );
      input.camYaw = 0;
      lastCabin.current = false;
      return;
    }
    const p = player.current;
    if (!p) return;
    TARGET.set(p.position.x, p.position.y + 1.6, p.position.z);
    if (inHold) {
      DESIRED.set(
        THREE.MathUtils.clamp(
          TARGET.x + Math.sin(input.camYaw) * 3,
          HOLD_BOX.x1 + 0.2,
          HOLD_BOX.x2 - 0.2,
        ),
        HOLD_ORIGIN.y + 2.55,
        THREE.MathUtils.clamp(
          TARGET.z + Math.cos(input.camYaw) * 3,
          HOLD_BOX.z1 + 0.2,
          HOLD_BOX.z2 - 0.2,
        ),
      );
      if (!lastHold.current) camera.position.copy(DESIRED);
      else camera.position.lerp(DESIRED, 1 - Math.exp(-10 * dt));
      camera.lookAt(TARGET);
      lastHold.current = true;
      lastCabin.current = false;
      return;
    }
    if (inCabin) {
      const cp = Math.cos(input.camPitch * 0.75);
      DESIRED.set(
        THREE.MathUtils.clamp(
          TARGET.x + Math.sin(input.camYaw) * 2.15 * cp,
          CABIN_BOX.x1 + 0.18,
          CABIN_BOX.x2 - 0.18,
        ),
        CABIN_ENTRY.y + 1.8,
        THREE.MathUtils.clamp(
          TARGET.z + Math.cos(input.camYaw) * 2.15 * cp,
          CABIN_BOX.z1 + 0.25,
          CABIN_BOX.z2 - 0.25,
        ),
      );
      if (!lastCabin.current) camera.position.copy(DESIRED);
      else camera.position.lerp(DESIRED, 1 - Math.exp(-10 * dt));
      camera.lookAt(TARGET);
      lastCabin.current = true;
      return;
    }
    const cp = Math.cos(input.camPitch);
    DESIRED.set(
      TARGET.x + Math.sin(input.camYaw) * input.camDist * cp,
      TARGET.y + Math.sin(input.camPitch) * input.camDist,
      TARGET.z + Math.cos(input.camYaw) * input.camDist * cp,
    );
    // collision caméra : on raccourcit si un bâtiment est traversé
    let dist = 1;
    for (let i = 1; i <= 14; i++) {
      const f = i / 14;
      STEP.lerpVectors(TARGET, DESIRED, f);
      if (pointBlocked(STEP.x, STEP.y, STEP.z)) {
        dist = Math.max(0.15, (i - 1) / 14);
        break;
      }
    }
    DESIRED.lerpVectors(TARGET, DESIRED, dist);
    DESIRED.y = Math.max(DESIRED.y, p.position.y + 0.6);
    if (lastHold.current) camera.position.copy(DESIRED);
    else camera.position.lerp(DESIRED, 1 - Math.exp(-10 * dt));
    lastHold.current = false;
    lastCabin.current = false;
    camera.lookAt(TARGET);
  });
  return null;
}

const SKY_DAY = new THREE.Color("#bfcad0");
const SKY_SUNSET = new THREE.Color("#d9a888");
const SKY_NIGHT = new THREE.Color("#28324a");
const FOG_GREY = new THREE.Color("#a9aeb0");
const SUN_DAY = new THREE.Color("#fff1d6");
const SUN_SET = new THREE.Color("#ffb070");
const MOON = new THREE.Color("#9fb4dd");

const CYCLE_SECONDS = 480;

export function Atmosphere() {
  const { scene } = useThree();
  const sun = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const bg = useMemo(() => new THREE.Color(), []);
  const lastStore = useRef(0);
  const fog = useMemo(() => new THREE.Fog("#bfcad0", 60, 220), []);

  useEffect(() => {
    scene.fog = fog;
    scene.background = bg;
  }, [scene, fog, bg]);

  useFrame(({ clock }, raw) => {
    const s = useGame.getState();
    let tod = s.timeOfDay;
    if (s.phase === "playing") tod = (tod + Math.min(raw, 0.05) / CYCLE_SECONDS) % 1;
    if (clock.elapsedTime - lastStore.current > 1) {
      lastStore.current = clock.elapsedTime;
      if (tod !== s.timeOfDay) s.setTimeOfDay(tod);
    }
    // 0..0.55 jour (matin → coucher), 0.55..1 soirée/nuit
    const dayArc = Math.min(tod / 0.55, 1);
    const elev = Math.sin(dayArc * Math.PI);
    const sunset = tod > 0.42 && tod < 0.62 ? 1 - Math.abs(tod - 0.52) / 0.1 : 0;
    const night =
      tod >= 0.58 ? Math.min(1, (tod - 0.58) / 0.06) * (tod > 0.95 ? (1 - tod) / 0.05 : 1) : 0;
    atmos.night = night;

    bg.copy(SKY_DAY).lerp(SKY_SUNSET, Math.max(0, sunset)).lerp(SKY_NIGHT, night);
    const w = s.weather;
    if (w === "nuages" || w === "pluie") bg.lerp(FOG_GREY, w === "pluie" ? 0.55 : 0.35);
    if (w === "brouillard") bg.lerp(FOG_GREY, 0.6);
    fog.color.copy(bg);
    const far = w === "brouillard" ? 70 : w === "pluie" ? 140 : 230;
    fog.near = w === "brouillard" ? 8 : 50;
    fog.far = far;

    if (sun.current) {
      const a = dayArc * Math.PI;
      sun.current.position.set(Math.cos(a) * 60, 10 + Math.max(elev, 0.25) * 70, -30);
      sun.current.color.copy(SUN_DAY).lerp(SUN_SET, Math.max(0, sunset)).lerp(MOON, night);
      const dim = w === "soleil" ? 1 : w === "nuages" ? 0.55 : 0.45;
      sun.current.intensity = (1.0 + elev * 1.6) * dim * (1 - night * 0.7);
    }
    if (hemi.current) hemi.current.intensity = 0.55 + (1 - night) * 0.5;
  });

  return (
    <>
      <hemisphereLight ref={hemi} args={["#dfe6ea", "#7d7360", 0.9]} />
      <directionalLight
        ref={sun}
        position={[40, 60, -30]}
        intensity={2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-75}
        shadow-camera-right={75}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
        shadow-camera-far={200}
        shadow-bias={-0.0005}
      />
      <Environment resolution={64}>
        <Lightformer
          intensity={1.2}
          position={[0, 10, 0]}
          scale={[30, 30, 1]}
          rotation-x={Math.PI / 2}
          color="#f1ebe0"
        />
        <Lightformer
          intensity={0.6}
          color="#9fb2bf"
          position={[-10, 2, -10]}
          rotation-y={Math.PI / 4}
          scale={[30, 4, 1]}
        />
      </Environment>
      <Rain />
    </>
  );
}

function Rain() {
  const COUNT = 1500;
  const ref = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      p[i * 3] = (Math.random() - 0.5) * 60;
      p[i * 3 + 1] = Math.random() * 30;
      p[i * 3 + 2] = (Math.random() - 0.5) * 60;
    }
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    return g;
  }, []);
  useFrame(({ camera }, raw) => {
    const pts = ref.current;
    if (!pts) return;
    const raining = useGame.getState().weather === "pluie";
    pts.visible = raining;
    if (!raining) return;
    const dt = Math.min(raw, 0.05);
    pts.position.set(camera.position.x, 0, camera.position.z);
    const a = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < COUNT; i++) {
      let y = a.getY(i) - 22 * dt;
      if (y < 0) y += 30;
      a.setY(i, y);
    }
    a.needsUpdate = true;
  });
  return (
    <points ref={ref} geometry={geo} frustumCulled={false}>
      <pointsMaterial color="#c8d2dc" size={0.08} transparent opacity={0.7} />
    </points>
  );
}
