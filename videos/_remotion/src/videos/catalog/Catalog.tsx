// Planche de contrôle des modèles 3D (outil interne) : chaque modèle, ou chaque pièce d'un pack, posé sur une grille
// avec son nom (« modèle:k »). inputProps { models: ["resto", …], cols, cam } ; une image fixe suffit.
import React, { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { AbsoluteFill, continueRender, delayRender, getInputProps, staticFile } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

type P = { models?: string[]; cols?: number; packs?: boolean; cam?: { pos: [number, number, number]; look: [number, number, number]; fov: number } };
const items = (o: THREE.Object3D) => { let n = o; while (n.children.length === 1) n = n.children[0]; return n.children.length ? n.children : [o]; };
const label = (txt: string) => {
  const cv = document.createElement("canvas"); cv.width = 512; cv.height = 96;
  const g = cv.getContext("2d")!; g.fillStyle = "#000"; g.fillRect(0, 0, 512, 96); g.fillStyle = "#ffd23f"; g.font = "bold 56px sans-serif"; g.fillText(txt, 12, 66);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv) })); s.scale.set(1.4, 0.26, 1); return s;
};
const Scene: React.FC<{ objs: { name: string; o: THREE.Object3D }[] }> = ({ objs }) => {
  const { camera, scene } = useThree();
  const p = getInputProps() as P, cols = p.cols ?? 6;
  const root = useMemo(() => {
    const r = new THREE.Group();
    objs.forEach(({ name, o }, i) => {
      const c = o.clone(true), b = new THREE.Box3().setFromObject(c), sz = b.getSize(new THREE.Vector3()), ct = b.getCenter(new THREE.Vector3());
      const s = 1.3 / Math.max(sz.x, sz.y, sz.z, 1e-4), g = new THREE.Group(), inner = new THREE.Group();
      c.position.set(-ct.x, -b.min.y, -ct.z); inner.add(c); inner.scale.setScalar(s); g.add(inner);
      const x = (i % cols) * 2 - cols + 1, z = -Math.floor(i / cols) * 2.4; g.position.set(x, 0, z); r.add(g);
      const l = label(`${name} ${sz.x.toFixed(1)}x${sz.y.toFixed(1)}x${sz.z.toFixed(1)}`); l.position.set(x, -0.2, z + 0.6); r.add(l);
    });
    r.add(new THREE.HemisphereLight("#ffffff", "#666666", 2.2)); const d = new THREE.DirectionalLight("#fff", 1.5); d.position.set(3, 8, 6); r.add(d);
    return r;
  }, [objs, cols]);
  const rows = Math.ceil(objs.length / cols), cam = camera as THREE.PerspectiveCamera;
  const cp = p.cam ?? { pos: [0, 2.5 + rows * 2.2, 4.5 + rows * 0.6] as [number, number, number], look: [0, 0, -rows * 1.1] as [number, number, number], fov: 60 };
  cam.position.set(...cp.pos); cam.lookAt(...cp.look); cam.fov = cp.fov; cam.updateProjectionMatrix();
  scene.background = new THREE.Color("#3a4250");
  return <primitive object={root} />;
};
export const Catalog: React.FC = () => {
  const [objs, setObjs] = useState<{ name: string; o: THREE.Object3D }[] | null>(null);
  const [h] = useState(() => delayRender("catalogue"));
  useEffect(() => {
    const p = getInputProps() as P, gl = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    Promise.all((p.models ?? []).map((m) => gl.loadAsync(staticFile(`assets/sketchfab/${m}.glb`)).then((g) => {
      const it = p.packs === false ? [g.scene] : items(g.scene);
      return it.length > 1 ? it.map((o, k) => ({ name: `${m}:${k}`, o })) : [{ name: m, o: g.scene }];
    }))).then((l) => { setObjs(l.flat()); continueRender(h); });
  }, [h]);
  if (!objs) return null;
  return <AbsoluteFill style={{ background: "#3a4250" }}><ThreeCanvas width={1920} height={1080} camera={{ fov: 60, near: 0.05, far: 500 }}><Scene objs={objs} /></ThreeCanvas></AbsoluteFill>;
};
