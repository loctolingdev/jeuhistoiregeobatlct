import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";

export const M = {
  ship: "/models/pirate/ship-large.glb",
  shipMedium: "/models/pirate/ship-medium.glb",
  shipSmall: "/models/pirate/ship-small.glb",
  rowboat: "/models/pirate/boat-row-small.glb",
  rowboatL: "/models/pirate/boat-row-large.glb",
  barrel: "/models/pirate/barrel.glb",
  crate: "/models/pirate/crate.glb",
  crateBottles: "/models/pirate/crate-bottles.glb",
  chest: "/models/pirate/chest.glb",
  mast: "/models/pirate/mast.glb",
  mastRopes: "/models/pirate/mast-ropes.glb",
  shovel: "/models/pirate/tool-shovel.glb",
  paddle: "/models/pirate/tool-paddle.glb",
  cannon: "/models/pirate/cannon.glb",
  lantern: "/models/town/lantern.glb",
  cart: "/models/town/cart.glb",
  cartHigh: "/models/town/cart-high.glb",
  stall: "/models/town/stall.glb",
  stallRed: "/models/town/stall-red.glb",
  stallGreen: "/models/town/stall-green.glb",
  bench: "/models/town/stall-bench.glb",
  tree: "/models/town/tree.glb",
  treeHigh: "/models/town/tree-high.glb",
  wheel: "/models/town/wheel.glb",
  banner: "/models/town/banner-red.glb",
} as const;

export const charModel = (name: string) => `/models/chars/${name}.glb`;

/** Clone (compatible squelettes) + ombres, optionnellement normalisé à une hauteur. */
export function useModel(url: string, height?: number) {
  const { scene, animations } = useGLTF(url);
  const object = useMemo(() => {
    const o = skeletonClone(scene);
    o.traverse((c) => {
      const m = c as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    if (height) {
      const box = new THREE.Box3().setFromObject(o);
      const size = box.getSize(new THREE.Vector3());
      o.scale.setScalar(height / (size.y || 1));
      const b2 = new THREE.Box3().setFromObject(o);
      o.position.y -= b2.min.y;
    }
    return o;
  }, [scene, height]);
  return { object, animations };
}

export function Model({
  url,
  position,
  rotation = 0,
  scale = 1,
}: {
  url: string;
  position: [number, number, number];
  rotation?: number;
  scale?: number;
}) {
  const { object } = useModel(url);
  return <primitive object={object} position={position} rotation-y={rotation} scale={scale} />;
}

Object.values(M).forEach((u) => useGLTF.preload(u));
