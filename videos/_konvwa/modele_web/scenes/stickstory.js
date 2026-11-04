// Exemple de départ (style stickstory) : un lieu, le personnage principal, une étiquette de lieu. À remplacer.
import { shot } from '../engine.js';

// ---- 1: le premier plan ----
shot({ t0: 0, build(S) {
  const P = S.place('kitchen', { mood: 'day' });
  const you = S.char('main', { at: 'center' });
  S.label('19:02 · MAISON');
  S.camera('static', P.cam.full);
  return { you };
} });
