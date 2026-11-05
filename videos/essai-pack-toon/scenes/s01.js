// Scène de départ : un exemple du pack qui marche (lire pour la technique, puis remplacer par le film).
// Exemple de départ (style toon) : un lieu habillé, le personnage principal, une réaction sur un mot. À remplacer.
import { shot } from '../engine.js';

// ---- 1: le premier plan ----
shot({ t0: 0, build(S) {
  const P = S.place('living-room', { seed: 2, mood: 'day', era: 'modern' });
  const you = S.char('main', { at: P.spots.center.slice(0, 2), ry: P.spots.center[2], face: 'happy' });
  you.face('shocked', S.t0 + 1.2);
  S.camera('creep', P.cams.wide);
  return { you };
} });
