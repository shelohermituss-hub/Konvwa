// « La jarre qui sentait les séismes » (Zhang Heng, an 132) : style ANIMÉ, nouveau rendu calé sur les références.
// Un monde three.js (world.ts) posé à chaque image d'après story.ts : encre du monde -> flou de profondeur -> lueurs ->
// tone mapping neutre -> étalonnage ; passages filés (flou de vitesse), éclair (flash blanc), sous-titres discrets.
import React, { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { AbsoluteFill, continueRender, delayRender, getInputProps, staticFile, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { EffectComposer, N8AO } from "@react-three/postprocessing";
import { BlendFunction, BloomEffect, ToneMappingEffect, ToneMappingMode } from "postprocessing";
import { World, loadKit } from "./world";
import { InkPass, noInkFallback } from "./ink";
import { LensBlur, GrainEffect } from "./lensblur";
import { GradeEffect, GRADES, GRADE_STRENGTH, gradeFor } from "./grade";
import { Kit } from "./build";
import { TOTAL, SHOTS, FPS, layersAt, dofAt, whipBlur, T } from "./story";
import { W, WE, WORDS } from "./words";

export const JARRE_FRAMES = TOTAL;

/** A/B switches for test stills only (Remotion inputProps `{ post: { ink: false, ... } }`); everything is on by default. */
type PostToggles = { ink: boolean; lens: boolean; pre: boolean; bloom: boolean; grade: boolean; grain: boolean; ao: boolean };
const toggles = (): PostToggles => ({ ink: false, lens: true, pre: true, bloom: true, grade: false, grain: false, ao: true, ...((getInputProps() as { post?: Partial<PostToggles> }).post ?? {}) });

/** Bloom for emissive sources only (depth.md 6.4). Its MIP chain always starts at 540x960 (half of 1080x1920),
 *  whatever the output size, so the glow keeps the same size relative to the frame (e-fold ~30 px at 1080p,
 *  ~1.5 % of the frame height) at 540, 1080 and 1440 widths. ADD blend: HDR-safe (SCREEN darkens values > 1). */
const makeBloom = () => {
  const b = new BloomEffect({ blendFunction: BlendFunction.ADD, intensity: 0.5, luminanceThreshold: 1.0, luminanceSmoothing: 0.2, mipmapBlur: true, levels: 6, radius: 0.6 });
  const mip = b.mipmapBlurPass;
  const setSize = mip.setSize.bind(mip);
  mip.setSize = (w: number, h: number) => setSize(Math.round((1920 * w) / Math.max(h, 1)), 1920);
  return b;
};

const fwd = new THREE.Vector3(), fpt = new THREE.Vector3();

const useKit = () => {
  const [kit, setKit] = useState<Kit | null>(null);
  const [handle] = useState(() => delayRender("look kit"));
  useEffect(() => { loadKit().then((k) => { setKit(k); continueRender(handle); }); }, [handle]);
  return kit;
};

const Inner: React.FC<{ id: number; kit: Kit }> = ({ id, kit }) => {
  const f = useCurrentFrame();
  const { camera, scene } = useThree();
  const world = useMemo(() => new World(kit), [kit]);
  const target = useMemo(() => new THREE.Vector3(), []);
  const on = useMemo(toggles, []);
  const fx = useMemo(() => ({
    ink: new InkPass(scene, camera as THREE.PerspectiveCamera),
    lens: new LensBlur({ maxCoC: 24, nearScale: 1.2 }),
    bloom: makeBloom(),
    tone: new ToneMappingEffect({ mode: ToneMappingMode.AGX }),
    grade: new GradeEffect(GRADES.day, GRADE_STRENGTH.day),
    grain: new GrainEffect({ amount: 0.025, cellPx: 1.5 }), // film grain, OFF by default (inputProps post.grain): the reference measures no grain and it quadruples the file size
  }), [camera, scene]);
  // <primitive dispose={null}> remplace la méthode dispose de l'objet par null : on appelle celle de la classe (sinon
  // la fin d'un fondu enchaîné, qui démonte la vue superposée, plante le rendu : « fx.ink.dispose is not a function »)
  useEffect(() => () => InkPass.prototype.dispose.call(fx.ink), [fx]);
  const post = useMemo(() => (
    <EffectComposer multisampling={(getInputProps() as { post?: { msaa?: number } }).post?.msaa ?? 4}>
      {/* @react-three/postprocessing 2.x wants elements only: the switched-off passes are filtered out */}
      {[
        on.ink ? <primitive key="ink" object={fx.ink} dispose={null} /> : null,
        // occlusion ambiante : les ombres douces dans les coins, sous les objets, entre les colonnes (le relief du décor)
        on.ao ? <N8AO key="ao" aoRadius={1.4} distanceFalloff={0.8} intensity={3.5} quality="medium" halfRes color="#1a0e08" /> : null,
        on.lens && on.pre ? <primitive key="pre" object={fx.lens.pre} dispose={null} /> : null,
        on.lens ? <primitive key="lens" object={fx.lens.main} dispose={null} /> : null,
        on.bloom ? <primitive key="bloom" object={fx.bloom} dispose={null} /> : null,
        <primitive key="tone" object={fx.tone} dispose={null} />,
        on.grade ? <primitive key="grade" object={fx.grade} dispose={null} /> : null,
        on.grain ? <primitive key="grain" object={fx.grain} dispose={null} /> : null,
      ].filter((e): e is JSX.Element => e !== null)}
    </EffectComposer>
  ), [fx, on]);
  const cam = camera as THREE.PerspectiveCamera;
  target.copy(world.update(id, f, cam, scene));
  noInkFallback(world.root);
  // thin-lens focus: distance along the view axis to the shot's focus point (default: the camera's look target)
  const d = dofAt(f);
  cam.getWorldDirection(fwd);
  if (d.focus) fpt.set(...d.focus(f)); else fpt.copy(target);
  fx.lens.focus = Math.max(0.3, fpt.sub(cam.position).dot(fwd));
  fx.lens.cInf = d.cInf;
  gradeFor(fx.grade, SHOTS[id - 1].light);
  fx.grain.seed = f; // deterministic per frame
  return (
    <>
      <primitive object={world.root} dispose={null} />
      {(getInputProps() as { post?: { composer?: boolean } }).post?.composer === false ? null : post}
    </>
  );
};

/** test stills only: inputProps `{ post: { dpr: 0.5 } }` forces the WebGL buffer size (R3F clamps dpr to >= 1 by default) */
const dprOverride = () => (getInputProps() as { post?: { dpr?: number } }).post?.dpr;
const ShotView: React.FC<{ id: number; kit: Kit; alpha: number }> = ({ id, kit, alpha }) => (
  <AbsoluteFill style={{ opacity: alpha }}>
    <ThreeCanvas width={1080} height={1920} {...(dprOverride() ? { dpr: dprOverride() } : {})} shadows gl={{ antialias: false, stencil: false, powerPreference: "high-performance", toneMappingExposure: 1.0 }}
      camera={{ fov: 40, near: 0.2, far: 1500 }}>
      <Inner id={id} kit={kit} />
    </ThreeCanvas>
  </AbsoluteFill>
);

// ---------------- sous-titres (style des références) ----------------
// 1 à 3 mots à la fois, en minuscules comme la phrase, blanc gras (Inter 800), contour fin et petite ombre, ≈ 3 % de la
// hauteur, à 70 % de la hauteur de l'image, sans mot en couleur.
const FONT = "Inter Konvwa";
const fontReady = (() => {
  if (typeof document === "undefined") return null;
  const h = delayRender("police des sous-titres");
  const f = new FontFace(FONT, `url(${staticFile("fonts/inter-800.woff2")})`, { weight: "800" });
  f.load().then((ff) => { (document.fonts as unknown as { add: (x: FontFace) => void }).add(ff); continueRender(h); }).catch(() => continueRender(h));
  return h;
})();
type Group = { a: number; b: number; words: number[] };
const GROUPS: Group[] = (() => {
  const out: Group[] = [];
  let cur: number[] = [];
  const flush = () => { if (cur.length) out.push({ a: W[cur[0]], b: WE[cur[cur.length - 1]], words: cur }); cur = []; };
  WORDS.forEach((w, i) => {
    cur.push(i);
    const len = cur.reduce((n, k) => n + WORDS[k].length + 1, 0);
    if (/[.,:;!?…]$/.test(w) || cur.length >= 3 || len > 12) flush();
  });
  flush();
  out.forEach((g, i) => { g.b = i + 1 < out.length ? out[i + 1].a : g.b + 0.6; });
  return out;
})();
const Captions: React.FC = () => {
  const t = useCurrentFrame() / FPS;
  void fontReady;
  const g = GROUPS.find((x) => t >= x.a - 0.03 && t < x.b);
  if (!g) return null;
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", top: "69%", width: "100%", textAlign: "center", fontFamily: `"${FONT}", Arial, sans-serif`, fontWeight: 800,
        fontSize: 58, letterSpacing: 0.5, color: "#ffffff", WebkitTextStroke: "5px #15121a", paintOrder: "stroke fill",
        textShadow: "0 4px 10px rgba(0,0,0,0.45)" }}>
        {g.words.map((k) => WORDS[k].replace(/\u202f/g, " ")).join(" ")}
      </div>
    </AbsoluteFill>
  );
};

export const JarreShort: React.FC = () => {
  const f = useCurrentFrame();
  const kit = useKit();
  if (!kit) return null;
  // l'éclair (« le Ciel gronde ») : deux flashs blancs
  const tb = f / FPS - T.bolt;
  const flash = tb > 0 && tb < 0.45 ? [0.85, 0.5, 0, 0.7, 0.3, 0.1][Math.min(5, Math.floor(tb * 13))] : 0;
  return (
    <AbsoluteFill style={{ background: "#cfe3f2" }}>
      <AbsoluteFill style={{ filter: whipBlur(f) > 0 ? `blur(${(whipBlur(f) * 16).toFixed(1)}px)` : undefined }}>
        {layersAt(f).map((l, i) => <ShotView key={i ? "over" : "base"} id={l.id} kit={kit} alpha={l.alpha} />)}
      </AbsoluteFill>
      {flash > 0 && <AbsoluteFill style={{ background: "#ffffff", opacity: flash }} />}
      {(getInputProps() as { captions?: boolean }).captions === false ? null : <Captions />}
    </AbsoluteFill>
  );
};
