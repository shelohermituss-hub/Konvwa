// Exemple de départ (style vox éditorial) : un tableau quadrillé, une carte, un chiffre, un soulignement. À remplacer.
import { shot, card, words, scribble } from '../engine.js';

// ---- 1: le premier plan ----
shot({ t0: 0, trans: 'blur', build(S) {
  S.board('grid'); S.light = 'desk';
  const st = {};
  st.card = card({ w: 7.4, h: 5.2, color: '#fbf8f0' }); st.card.position.set(0, .4, .18); S.add(st.card, { in: 'none' });
  st.n = words('72', { size: 2.4, font: 'gothic' }); st.n.position.set(-2, 1.2, .21); S.add(st.n, { in: 'none' });
  st.ul = scribble('underline', { w: 3, h: .4, at: 1.5, dur: .35 }); st.ul.position.set(1.8, .2, .2); S.add(st.ul, { in: 'none' });
  S.view = { zoom: 1.1, y: .5 }; S.drift = { zoom: .05, x: .1 };
  return st;
} });
