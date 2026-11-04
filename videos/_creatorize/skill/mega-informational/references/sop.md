# SOP in the app (gate by gate)

What the app already did: the voice cleaned (audio/clean.wav), the words timed (audio/timeline.json,
audio/script_timed.txt), project.json "end" set, Blender installed and running hidden. You never open, install or call
Blender (the one exception: the asset contact sheet the build prompt gives you), never copy the engine, never render the
final video.

| gate | you do | done when |
|---|---|---|
| 1 words | read script_timed.txt | you know every clause's frames |
| 2 assets | list every real thing the film shows; search, fetch at 2k, ONE contact sheet (assets.md). The index fills itself on its first search (~25 s). Still nothing after that, a fetch that fails twice, or a thing still wrong after one replacement: model it in Python (models.md), write "modelled: <thing> (why)" in storyboard.md, carry on | you LOOKED at the sheet; every id upright, textured, the right size, not too heavy; ids written in storyboard.md |
| 3 storyboard | storyboard.md from storyboard_template.md: camera mode (camera.md), assets, people, steps, shots, X-ray words, camera per shot; a cutaway film: its ONE master framing | shots tile frame 1 to the end, ~2 s each; the named thing is in frame on its word |
| 4 kit | common.py (materials, hero models, a cutaway's `K.section`, the TOUR of a cutless stretch), props_*.py only for what no library has (models.md) | each model checked in a close render_frames still |
| 5 shots | e01.py ... (the shape below) + assemble.json (`"shots"`, `"camera"`, `"tours"`, `"dips"`) | every shot builds and check_layout lists no script error and no CZ CONTACT line (qa.md gate 1: the other lines get ONE fix, then a note) |
| 6 look | render_frames start / middle / end of every shot (Standard: the middle only) | qa.md gate 2 + the detail bar pass on every still |
| 7 enrich | enrich.md on the key moments (Ultraedit only) | the targets' extras are built for real |
| 8 polish | fix what the stills show; Ultraedit: a second round | check_layout as in gate 5 again; DESCRIPTION.txt has the asset credits (`.suite/CREDITS.json`) |

## A shot file (copy its ORDER, not its content; the example films predate v2: open only the files SKILL.md names)
```python
# e07.py  "... the crane lifts the slab onto the pier"  (storyboard row 7)
F0, F1 = 181, 240
SFX = [('thud', 1.45)]          # optional: sounds on picture events, (type, seconds from the shot's start[, gain dB[, pan]])


def build(ctx):
    import os, sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import cz, mega as M, assets as A, contact as K, detail as D, common as C
    T = lambda f: (f - 1) / 30                                    # frame -> seconds
    ease = lambda u: (lambda v: v * v * (3 - 2 * v))(min(1.0, max(0.0, u)))
    M.setup(F1, sun_elev=22, sun_rot=300, light_k=1.1)
    C.world()                                                     # the kit: ground, materials, a cutaway's K.section
    A.model('ph:tree_small_02', height=7, base=(-12, 9, 0), rot=30)          # storyboard ids, never words
    A.scatter('ph:tree_small_02', 10, ((-40, 20), (40, 45)), seed=4, height=(6, 9), lod=0.25)
    xm = M.xray('e07_xr')
    slab = C.slab(xray=xm)                                        # this film's hero model (common.py), its named part in xm
    t = cz.at(cz.words(), 'lifts')['start']                       # the word, in seconds
    M.bake_path(slab, F0, F1, pos=lambda s: (0, 0, 6 * ease((s - t) / 1.2)))   # rests on the ground, lifts ON its word
    M.xray_fade(xm, [(T(F0), 0), (t - 0.1, 0), (t + 0.03, 1.0), (T(F1), 0.6)])        # green ON the word
    # people: f = H.figure('worker', at=(3, -2, 0), face=200); f.play('Idle_Loop', T(F0)); ...; H.plant(); HD.hold_issues()
    M.Flight([(T(F0), (14, -22, 6), (0, 0, 3), 24), (T(F1), (10, -18, 7), (0, 0, 4), 24)]).bake(F0, F1)   # cuts: ONE eased move
    # a tour shot instead: M.Tour(C.TOUR).bake(F0, F1)
    K.airborne(slab)                                              # intended: it hangs from the crane
    D.scan_all(); D.finish(level='film', ground=0); D.corners('both')        # the detail pass, in detail.md's order,
    D.scatter('pebbles', area=((-3, -2), (3, 2)), density=20); D.dof(blur='subtle')   # after the camera bake
    return F0, F1
```

## A shot's build(ctx), in this order
1. `M.setup(F1, sun_elev=, sun_rot=, ...)` (the light below).
2. The set: the kit from common.py, library assets by their storyboard ids (`A.model(id, height=/width=, base=, rot=)`,
   `A.scatter(...)` for many, far copies `lod=0.25, instance=True`, `A.pbr_from(id)` for big surfaces, `A.world(hdri)`
   when a real sky fits). Rest every object ON its support (its lowest point at the support's top z).
3. People (humans.md): `H.figure(...)`, clips by name, `f.walk` at the stride speed (about 1 s per metre on
   Walk_Loop), props only via `HD.hold` / `HD.handover`; then `H.plant()` ONCE after all the people (planted feet
   held), then `HD.hold_issues()`. A `CZ HOLD` / `CZ FOOTSLIDE` line gets ONE fix at its cause (stand closer, another
   grip, another hand, a walk that arrives facing the right way), then a note in storyboard.md and move on.
4. Motion baked on the words (M.bake_path / cz.bake / M.visible), the X-ray on its word (M.xray + M.xray_fade).
5. The camera: cuts `M.Flight(keys).bake(F0, F1)` (2-3 keys, one kind of move); cutless `M.Tour(C.TOUR).bake(F0, F1)`.
6. Intended overlaps declared (contact.md): `K.allow(a, b, group=)`, `K.airborne(ob)`, `ob['cz_section_ok'] = True`.
   Sounds (optional): a module-level `SFX = [('type', seconds_from_shot_start[, gain_db[, pan]])]` on picture events (a
   fall, a hit, a door): types impact thud pop click whoosh swish splash glass door footstep ..., `tag:<words>`, or a
   library id `sfx.<cat>.<nn>`. Not on every cut: the app adds a soft swish on cuts by itself (none inside a tour).
7. The detail pass, after the camera, in detail.md's order: `D.scan_all()` -> `D.relief(cut faces, normal, amount=0.2,
   clear=[props within 0.2 m])` -> `D.swap(Claude-made trees, '<tree id>', lod=0.08)` -> `D.finish(level='film',
   ground=<z or None>)` -> `D.corners('both')` -> `D.fog(0.0015-0.004)` for far worlds -> `D.scatter(...)` on ground
   edges -> `D.light(...)` -> `D.dof(blur='subtle')`.

## Framing a cutaway film
A section through ground, a building or a machine (a hole becoming a basement, a tunnel, a cave): define ONE master framing
(the whole section with its ground line, the camera centred, small calm moves) that most shots return to, so each step
reads in context; tighter shots only for one detail. A cutaway that stays in one place is usually `cutless` (camera.md).
Declare the cut once in the kit's world(): `import contact as K; K.section((0, YC, 0), (0, -1, 0), 'section',
box=(x0, x1, y0, y1, z0, z1))` (examples/basement/common.py). In every shot the named thing is inside the frame on its
word: check the camera at that frame, not at the shot's start.

## Library
`library_search`: leave `base` out (it defaults to this style; `mega` is not a base name); `scope: "all"` for other styles.
The free 3D asset library is a different thing: `tools/asset_index.py` (assets.md).

## Light (M.setup)
- `M.setup(F1, sun_elev=15-35, sun_rot=<deg>, sun_power=3-4, light_k=1.0-1.3, light_sat=0.55-1.0, haze=0-0.6)`.
  The camera sees a saturated physical sky; the scene is lit by a calmer copy (shadows stay neutral grey).
- Put the sun to the side or behind the subject at a low angle: long shadows and rim light (`D.light(..., rim=)` adds a
  rim sun). Snow wants bluer shadows (light_sat ~0.9-1.15). Interiors: area lights + emissive practicals (strength <=
  1.5), darker ceilings; `D.corners('both')` darkens their corners.
- `samples=16` while building; the export renders at 4. `D.corners` turns screen-space ray tracing on (+0.15 s/frame):
  the budget allows it. Don't add other ray tracing.
