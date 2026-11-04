---
name: mega-informational
description: Build "3D Informational" videos in Creatorize Suite with the Blender engine - realistic megaproject explainers where every clause of the narration is one step of a giant engineering idea built on screen (machines dig, lift, wrap, drill, float), in realistic EEVEE (engine/mega.py - physical sky and hard sun, real free 3D assets and scanned PBR textures, detailed hard-surface models, the reconstruction style's mannequins with verified hand holds, green see-through X-ray on the thing the narration names), nothing clipping (the overlap gate), a smooth eased camera in cuts or cutless mode. 9:16 (1080x1920) or 16:9. Use for every build, edit and Ultraedit of a "3D Informational" project (style id mega).
---

# 3D Informational on the Blender engine (mega-informational, v2)

Realistic 3D explainers: "Could you move Mount Everest to America?" answered step by step on screen. Each clause is ONE
picture of one step - a trench being dug, drills cutting, a slab lifted, a platform built, a globe with a route. The thing
the words name glows in see-through green X-ray on its word. Real things (trees, cars, rocks, tools, buildings, ground,
sky) are free open-source assets from the library; Python modelling is for what no library has. The world is lit by a
physical sky and a hard low sun, every big surface carries a photo-scanned texture, far things sit in a little air. The
camera eases from rest to rest (cuts) or travels one continuous path between focal points (cutless). The bar: the
look of the showcase films in `examples/` (open only the files named below).

v2 (2026-10-30) answers the owner's five problems with the night's shorts: Claude-made models (-> assets), clipping
overlaps (-> the contact gate), no animation library or hand holds (-> humans), lacking detail (-> the detail pass),
jaggy camera and rough cuts (-> eased Flight, cuts / cutless).

You write Python scene files that the app runs inside a hidden Blender. The engine (cz.py, mega.py, assets.py,
contact.py, human.py, hands.py, detail.py, Flow textures in assets/mega, the tools) is part of the app: never copy it
into the project. When the references are not enough, read the engine source only at the folder the build prompt names
(read-only): never search the disk for it (no `find /`) and never read another Creatorize install.

Read these, in order, and nothing else (about 19 k tokens; the whole reading of a build):
- `references/sop.md` - THE PROCEDURE in the app, gate by gate, and the shape of a shot file
- `references/engine_api.md` - the mega.py calls + the cz primitives, and where every v2 module is documented
- `references/camera.md` - THE CAMERA: cuts vs cutless, M.Flight (eased rest to rest), M.Tour (the owner's top priority)
- `references/assets.md` - free models, PBR textures and HDRIs: find, check on a sheet, use, credit
- `references/contact.md` - the overlap gate: nothing clips, floats or flickers; intended overlaps declared
- `references/detail.md` - the detail pass (D.*) and the detail bar (8 lines the critic scores)
- `references/storyboard_template.md` - the storyboard's shape (camera mode, assets, people, per-shot rows)
- `references/qa.md` - the gates and the look numbers
- `references/render.md` - the render tuner: every export picks the fastest settings that look the same on THIS
  machine and renders with ONE Blender unless more was measured faster; what a jungle frame costs (shadows of plants)
- `PITFALLS.md` - every failure already made once, as rules
Only when it applies:
- `references/humans.md` - the story has people (mannequins, the motion library, Mixamo clips, VERIFIED hand holds)
- `references/models.md` + `examples/roof/house.py` (a Python-built model at the bar) - you model something the
  library lacks (a cutaway, X-ray internals, a mechanism)
- `examples/basement/common.py` (+ the props_*.py it needs) - a cutaway in soil or rock (a hole, a tunnel, a cave, a
  foundation): start from it, including its section declaration and contact opt-outs
- `references/enrich.md` - Ultraedit only
- ONE everest props file when the film needs a machine it already models (models.md says which file has the
  excavator, the crane, the ship ...): copy that model's function, read nothing else of the film
Never open the other example files (everest/, roof/ shots and kits: ~70 files, ~140 k tokens, written before v2 with
v4 camera keys and hand-made trees): sop.md's shot file is the pattern.

## The build, step by step (sop.md has the gates)
1. **Words.** `W = cz.words()`, `cz.at(W, 'word', n)`. Frame of a word = round(start x 30) + 1; frame 1 = 0.0 s.
2. **Assets.** Every real thing the film shows gets a library asset BEFORE the storyboard: search, fetch, one contact
   sheet, LOOK, ids into storyboard.md (assets.md). Nothing usable after one refresh, or a fetch that fails twice:
   model it in Python (models.md), note it in storyboard.md, carry on.
3. **Storyboard** (storyboard_template.md). The camera mode first (camera.md's rule), then one shot per clause (~2 s),
   contiguous F0-F1 from frame 1 to the end: the literal picture, what moves on which word, what glows green on which
   word, the camera (one eased move, or hold / travel for tour shots). Recurring hero objects keep ONE design.
4. **The kit.** common.py: materials, hero models, a cutaway's `contact.section`, the TOUR of a cutless stretch.
   props_*.py: only what no library has, at the bar of models.md.
5. **Shots.** eNN.py (sop.md's shape): `F0, F1 = a, b` and `build(ctx)`: M.setup, the set (A.* by id), people (H /
   HD, `H.plant()` once after them), motion on the words, the X-ray, ONE camera (M.Flight or M.Tour), the detail pass
   last (D.*). assemble.json: shots, camera, tours, dips.
6. **Check + look.** check_layout until it says Clean (or Clean for export): only overlaps and shots that do not build
   block the export; a camera, HOLD, FOOTSLIDE, PARTIAL or CHECKFAIL line is a note: ONE fix at its cause, then
   storyboard.md, move on, never loop (qa.md gate 1). Then the stills per quality (qa.md).
7. **Enrich** (Ultraedit only; at Standard and Verified never call enrich_frame).
8. **DESCRIPTION.txt** with the asset credits (`.suite/CREDITS.json`, which the engine writes; CC-BY authors named).

## Ultraedit is a crew (since 2026-10-30)
At Ultraedit the build's Claude is the DIRECTOR: it launches the **asset scout** while it writes storyboard.md, then
writes common.py (the kit, the TOUR) and e01.py (the look every shot matches); 2-4 **shot builders** write and polish
contiguous runs of shots at the same time, a **critic** runs check_layout, scores every X-ray moment and the detail bar,
and the director signs off. Builders own only their shot files and props_<part>.py.

## Rules that never bend
- **Camera:** the film is `cuts` (every shot ONE eased move from rest to rest: M.Flight; the cut lands on still frames)
  or `cutless` (one camera through the set: M.Tour in common.py, every shot of the group calls
  `M.Tour(C.TOUR).bake(F0, F1)` unchanged), or mixed, chosen in the storyboard. 18-35 mm. Never whips, never zoom
  transitions, never hand-keyed cameras, no shake.
- **Real things come from free libraries, not Python:** `import assets as A`; trees, rocks, grass, cars, tools,
  furniture, buildings, ground textures, skies are `A.model / A.scatter / A.pbr_from / A.world` with ids checked on a
  sheet. Model in Python only cutaways, X-ray internals, parts that move and shapes no library has.
- **Nothing clips, floats or flickers** (contact.md): things rest ON their support, solids never pass into other
  models, no two surfaces of different materials in one plane (lift 1 cm), a cutaway is cut clean at its declared
  plane, the camera never enters a solid. Intended overlaps are declared (`contact.allow`, `contact.airborne`,
  `cz_section_ok`). Name the parts of one model with one prefix (`pump_body`, `pump_rod`). The app refuses to export
  while check_layout lists one overlap.
- **People** are the reconstruction style's mannequins and motion library, never primitives: `import human as H,
  hands as HD`; props in hands only through `HD.hold` / `HD.handover` (VERIFIED combos); `H.plant()` once after the
  people are built; `HD.hold_issues()` read.
- **Detail:** every shot's build ends with the detail pass, after the camera, in detail.md's order: `D.scan_all()`,
  cut faces `D.relief(..., clear=[props within 0.2 m])`, Claude-made trees / bushes `D.swap(..., lod=0.08)`,
  `D.finish(level='film', ground=<z>)`, `D.corners('both')`, far worlds `D.fog(0.0015-0.004)`, ground edges
  `D.scatter`, `D.dof('subtle')`. Machines `wear=1`.
- The named thing glows green ON its word (M.xray + M.xray_fade), not before, inside the frame at that frame.
- Numbers and labels as clean 3D text (M.text3d) or decals - never a 2D overlay slammed on.
- Frame cost: under ~1.5 s at full size; far copies of heavy assets with `lod=` and `instance=True`.
- No music unless the user asks. Sound effects only on picture events (a fall, a hit, a door): a module-level
  `SFX = [('type', seconds_from_shot_start[, gain_db[, pan]])]` in the shot file (sop.md); the app adds a soft swish on
  cuts by itself (none inside a cutless tour).
- Shot files name assets by id, never by words (a word query is pinned per project, but an id is what was checked).

## Banned in every style (the owner's no-slop rules)
- No red stamp / plaque / verdict overlays slammed on: show the fact as a real object.
- No notice that the voice is AI, ever, anywhere.
