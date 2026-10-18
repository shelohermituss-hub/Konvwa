// Loads the engine's universal runtime (the same files the browser loads) so the CLI uses ONE source of truth for scene rules,
// transition lengths, sound cues and timing. The DOM-only parts are never called from Node.
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const RUNTIME_FILES = ['core.js', 'dom.js', 'fx.js', 'mount.js', 'hooks.js', 'scenes.js', 'depth.js']

for (const f of RUNTIME_FILES) await import(pathToFileURL(path.join(ENGINE, 'runtime', f)).href)

/** The MOTION namespace: FORMATS, HOOK, CUES, TRANSITIONS, catalog, timesFor… */
export const M = globalThis.MOTION
