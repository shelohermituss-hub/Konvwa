import React from "react";
import { AbsoluteFill, getInputProps, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { EffectComposer } from "@react-three/postprocessing";
import { ToneMappingEffect, ToneMappingMode } from "postprocessing";
// Test minimal du rendu WebGL : un cube rouge, avec (inputProps { fx: true }) ou sans la chaîne de post-traitement.
const tone = new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL });
export const TestBox: React.FC = () => {
  const f = useCurrentFrame();
  const fx = (getInputProps() as { fx?: boolean }).fx;
  return (
    <AbsoluteFill style={{ background: "#cfe3f2" }}>
      <ThreeCanvas width={1080} height={1920} camera={{ fov: 40, position: [0, 0, 5] }}>
        <ambientLight intensity={1} />
        <mesh rotation={[0.4, f * 0.05, 0]}><boxGeometry args={[1.5, 1.5, 1.5]} /><meshStandardMaterial color="red" /></mesh>
        {fx ? <EffectComposer multisampling={0}><primitive object={tone} dispose={null} /></EffectComposer> : null}
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
