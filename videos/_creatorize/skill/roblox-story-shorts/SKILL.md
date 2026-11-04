---
name: roblox-story-shorts
description: Build a Roblox story short (9:16, 1080x1920) in a Creatorize project - blocky R6 avatars with decal faces act out every sentence of the narration literally, a cut every 1-1.5 s on the words, the camera always moving, white captions in the upper fifth, vine booms on the punchlines. Use for any topic ("in this world, every time you X..."). Covers writing scenes/scene.js with the rbx engine, sets / props / animals / vehicles, faces per beat, SFX cues, and the gates (stills, clip check). For writing the narration itself use script/SKILL.md.
---

# Roblox story shorts (build)

You turn a narration (already voiced, transcribed and tightened by the app) into `scenes/scene.js`: one deterministic
three.js scene the app renders. Everything is declared up front and evaluated at time t. Read, in this order:
`references/api.md` (the whole engine: sets, people, camera, props, effects), `references/shots.md` (how the refs cut),
`references/PITFALLS.md` (what went wrong before: read it, every line cost a re-render), then `references/faces.md` and
`references/sfx.md` while you stage. `examples/` has two finished scenes (sneeze = from scratch, levitate = recreation).

## The project (what is where)
```
project.json              { "style": "roblox", ... }   (do not edit by hand)
engine.js                 the engine (read-only; never edit, never copy into scenes)
faces/ fonts/ vendor/     engine files (faces/<name>.png = every face decal)
scenes/scene.js            YOUR scene: import { ... } from '../engine.js';
script.txt                the narration ([SHOT: ...] hints from the script step)
audio/clean.wav           the voice, ALREADY TIGHTENED (dead air cut). Write the scene in this time.
audio/clean.json          word times {words:[{word,start,end}]} in that same time -> captions('audio/clean.json')
audio/script_timed.txt    the narration with phrase times (easiest to read)
audio/sfx.json            hand-written SFX cues [{t, name, gain?, align?}] (or sfx() calls in the scene)
```
The app owns everything else (mix, export). Never touch audio files, never write a timemap, never render video yourself.

## Workflow
1. **Read the words.** `audio/script_timed.txt` + `audio/clean.json`. Note the end time of the last word (= video length + 0.5).
2. **Beat list** (in your head or a comment block at the top of scene.js): one beat per clause, each with: time range
   (cut ON a word start), location, who, pose + face, camera (close / medium / wide / OTS / low angle), any prop, SFX.
   Literal visualisation: every noun/verb gets its own picture (see shots.md). 25-45 shots for 30-50 s.
3. **Locations.** One `set()` for the first location, `place(name, [300*k, 0, 0])` for every other one (300+ units apart),
   `useLight(t, L)` at every cut between locations. No set fits? `room({...})` / `outdoor({...})` + props + `build()`.
4. **Cast.** `avatar({...})` per character PER LOCATION (a person in two places = two avatars, each hidden outside its
   time window with `.hide(t)/.show(t)`): never let one avatar's `pos` interpolate across a cut between locations.
   Extras: `crowd()` / `lineUp()` / `randomLook()` (they keep people apart and out of furniture).
5. **Keys.** Poses, faces (a new face every beat on the hero), walks (`pos` keys), `headPitch`, opacity, `sit: true`.
6. **Shots.** `cam(t0, t1, {pos, look, fov})` per beat; prefer `rel(a, [...])` + `head(a)` so the camera follows.
   The engine moves every shot by itself (push-in / pull-out); add `to:` only for a bigger deliberate move.
7. **Captions + SFX.** `captions('audio/clean.json')` (defaults match the refs). 5-10 `sfx(t, 'vine_boom')` on punchlines
   + quiet layers (sfx.md).
8. **Gates (all three, in order, before you say done):**
   - **Stills:** `render_frames` at the middle of EVERY shot (batch them) and LOOK at each one: is the subject in frame,
     face readable, nothing blocking the camera, the right location lit? Fix and re-render the bad ones.
   - **Clip check:** `check_layout` -> fix every CLIP (depth >= 0.4), CUT, HIDDEN and CAM finding (minor < 0.4 may stay).
     Re-run until it reports none of those.
   - **Scene errors:** `check_preview` is clean (no console errors, no 'unknown set/prop/face' warnings).
   Then say done, with the shot count and anything you could not fix.

## Hard rules
- Never `Math.random()` or clocks: use `rng(seed)`. Same t = same frame.
- Import only from `'../engine.js'`. All paths (captions, sfx) are relative to the project folder.
- Units: 1 stud; avatar 5.3 tall, 4 wide with arms; floor y 0; room ceilings y 10 (set opts `h` changes it).
- `rotY` in degrees: 0 faces +z (towards the usual camera), 180 faces -z.
- Characters face the camera side in their close-ups: the camera goes where the face is (`rel(a,[0,4.6,4.4])` = in front).
- Keep shots 0.3-2.0 s (median ~1.15 s); a longer shot only for one continuous action.
- The camera is never static; never put it inside a wall, a prop or a car pillar (check_layout says CAM).
- No label / title / sign text in the top ~22 % of the frame (the captions live there). The LAST shot is the payoff, big
  and readable (a face or the gag), never a wide of a tiny figure; tiny people get a camera at their size (PITFALLS).
