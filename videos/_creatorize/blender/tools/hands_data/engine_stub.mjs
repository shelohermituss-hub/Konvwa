// A headless stand-in for templates/recon/engine.js: only what lib/props.js and lib/hands.js touch at import time and
// while a kit prop builds (THREE, material tiers, theme id). Used by hands_data.mjs (never by the app).
import * as THREE from '../../../recon/vendor/three.module.js';
export { THREE };
const mat = () => new THREE.MeshStandardMaterial();
const fnProxy = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : fnProxy()), apply: () => mat() });
export const MAT = new Proxy({}, { get: () => (...a) => mat() });
export const THEME_ID = 'studio';
export const THEME = null;
export const IMG = {};
export const SETTINGS = {};
export const LAYOUT_CHECKS = [];
export const C = new Proxy({}, { get: () => '#888888' });
export const selectable = () => {};
export const MOD = fnProxy();
export default {};
