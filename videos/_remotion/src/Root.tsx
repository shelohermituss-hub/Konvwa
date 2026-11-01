// Compositions du style ANIMÉ. Chaque vidéo copie src/videos/bridge/ (le modèle du skill) dans src/videos/<nom>/,
// règle FPS = 60 et TOTAL dans son story.ts, puis s'ajoute ici.
import React from "react";
import { Composition } from "remotion";
import { BridgeShort, BRIDGE_FRAMES } from "./videos/bridge/Bridge";
import { FPS as BRIDGE_FPS } from "./videos/bridge/story";
import { TestBox } from "./videos/test/Test";

export const Root: React.FC = () => (
  <>
    {/* Modèle d'origine du skill (anglais, 30 i/s) : sert de référence pour le look, pas à publier. */}
    <Composition id="BridgeShort" component={BridgeShort} durationInFrames={BRIDGE_FRAMES} fps={BRIDGE_FPS} width={1080} height={1920} />
    {/* Test minimal du rendu WebGL (cube rouge) : vérifie qu'une machine sait rendre la 3D. */}
    <Composition id="TestBox" component={TestBox} durationInFrames={60} fps={60} width={1080} height={1920} />
  </>
);
