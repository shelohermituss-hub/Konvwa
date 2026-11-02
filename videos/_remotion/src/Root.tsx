// Compositions du style ANIMÉ. Chaque vidéo copie src/videos/bridge/ (le modèle du skill) dans src/videos/<nom>/,
// règle FPS = 60 et TOTAL dans son story.ts, puis s'ajoute ici.
import React from "react";
import { Composition } from "remotion";
import { BridgeShort, BRIDGE_FRAMES } from "./videos/bridge/Bridge";
import { FPS as BRIDGE_FPS } from "./videos/bridge/story";
import { TestBox } from "./videos/test/Test";
import { TalkieShort, TALKIE_FRAMES } from "./videos/talkie/Talkie";
import { PuanteurShort, PUANTEUR_FRAMES } from "./videos/puanteur/Puanteur";
import { RatsShort, RATS_FRAMES } from "./videos/rats/Rats";
import { LookTest, LOOK_FRAMES } from "./videos/look/Look";
import { JarreShort, JARRE_FRAMES } from "./videos/jarre/Jarre";

export const Root: React.FC = () => (
  <>
    {/* Modèle d'origine du skill (anglais, 30 i/s) : sert de référence pour le look, pas à publier. */}
    <Composition id="BridgeShort" component={BridgeShort} durationInFrames={BRIDGE_FRAMES} fps={BRIDGE_FPS} width={1080} height={1920} />
    {/* « La tour qui faisait fondre les voitures » : première vidéo ANIMÉ en français, 1080 x 1920, 60 i/s. */}
    <Composition id="TalkieShort" component={TalkieShort} durationInFrames={TALKIE_FRAMES} fps={60} width={1080} height={1920} />
    {/* « La Grande Puanteur » (Londres, 1858) : deuxième vidéo ANIMÉ en français. */}
    <Composition id="PuanteurShort" component={PuanteurShort} durationInFrames={PUANTEUR_FRAMES} fps={60} width={1080} height={1920} />
    {/* « Les rats d'Hanoï » (1902) : troisième vidéo ANIMÉ, la première avec des sous-titres. */}
    <Composition id="RatsShort" component={RatsShort} durationInFrames={RATS_FRAMES} fps={60} width={1080} height={1920} />
    {/* Test du nouveau rendu d'après les références de la chaîne (objets 3D Sketchfab, HDRI, caméra continue). */}
    <Composition id="LookTest" component={LookTest} durationInFrames={LOOK_FRAMES} fps={60} width={1080} height={1920} />
    <Composition id="JarreShort" component={JarreShort} durationInFrames={JARRE_FRAMES} fps={60} width={1080} height={1920} />
    {/* Test minimal du rendu WebGL (cube rouge) : vérifie qu'une machine sait rendre la 3D. */}
    <Composition id="TestBox" component={TestBox} durationInFrames={60} fps={60} width={1080} height={1920} />
  </>
);
