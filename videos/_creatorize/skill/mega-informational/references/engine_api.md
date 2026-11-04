# engine_api: mega.py (`import mega as M`)

Generated from engine/mega.py (blender-lab tools/mega_api_doc.py). Primitives come from cz: `cz.box(name, (w, d, h), loc, mat,
rot=(deg), bevel=, ol=0)`, `cz.cyl(name, r, h, loc, mat, verts=, ol=0)`, `cz.sphere`, `cz.plane(name, w, h, loc, mat, rot)`,
`cz.text(name, body, size, loc, mat, rot, extrude)`, `cz.empty`, `cz.bake(obj, path, values, f0)`, `cz.find(name)`. ALWAYS
pass `ol=0` (no outlines in this look) and M.* materials. Time: `t = (f - 1) / 30`, a word at s seconds = frame round(s*30)+1;
`W = cz.words()` and `cz.at(W, "word", n)` give the narration words.

The v2 modules (on the engine path in every shot; each documented in its own reference):
| import | what | doc |
|---|---|---|
| `import assets as A` | free models / PBR textures / HDRIs: `A.model`, `A.scatter`, `A.pbr_from`, `A.texture_set`, `A.world`, `A.hdri`, `A.search`, `A.fix`, `A.credits_text` | assets.md |
| `import contact as K` | the overlap gate's declarations: `K.section`, `K.allow`, `K.airborne`, `K.nocontact`, `K.shell` | contact.md |
| `import human as H`, `import hands as HD` | figures, clips, walks, sit, crowds, Mixamo import; holds, handovers, `HD.hold_issues()` | humans.md |
| `import detail as D` | `D.scan_all`, `D.relief`, `D.swap`, `D.scatter`, `D.corners`, `D.fog`, `D.dof`, `D.light`, `D.pbr`, `D.finish` (after the camera, detail.md's order) | detail.md |
| (not in shots) `engine/tune.py`, `engine/tunemetric.py`, `tools/render_tune.py`, `tools/tune_sheet.py` | the render tuner the export runs: `run.py --tuneprobe req.json` (probe), `run.py --plan render_plan.json` (`tune.apply`: every knob a cap), `render_tune.py <film> [--ablate] [--force] [--shots a,b]`, `render_queue.py --tune / --plan`; knobs `shadow_scale`, `far_casters`, `light_res`, `samples`, `vol_tile`, `vol_samples`, `gi_res`, `rt_res`, `gi_steps`, `shadow_steps`, `tex_limit` | render.md |
| (not in shots) `engine/scenepass.py` | the scene pass the tuner runs first (knobs `scene_gn`, `scene_lod`, `scene_join`): library placements -> one GN instancer per asset, LOD by screen size from the camera path, static joins; `render_tune.py --only scene_gn,...` probes just those; test `blender -b --factory-startup -P tests/render/t_scenepass.py` | render.md, docs/SCENE_OPTIMIZER.md |

### `setup(frame_end, sun_elev=28, sun_rot=135, sun_power=3.2, sky_strength=0.16, samples=4, mb=0.5, res=None, exposure=-0.2, ao=False, haze=0.0, sky_sat=1.7, light_sat=0.55, light_k=1.3, sun_disc=True)`

Fast realistic EEVEE: physical sky world (multiple scattering), a matching sun lamp with soft shadows,
AgX, motion blur (shutter mb, 0 = off). sun_rot: degrees around Z (0 = light from +Y toward -Y).

### `sun_dir()`



### `pbr(name, color='#888888', rough=0.6, metal=0.0, img=None, scale=1.0, bump=0.0, bump_scale=8.0, coord='Object', emit=None, emit_strength=0.0, spec=0.5, coat=0.0, tint=None, noise=0.0)`

Principled BSDF. img: a seamless texture (box-projected in object coords * scale), tint multiplies it.
bump: procedural noise bump strength (bump_scale its frequency). noise: colour variation 0..1.

### `rock(name='rock', color='#4a4b50', dark='#1e1f23', scale=1.0, bump=0.9, img=None, pits=True)`

Dark pitted basalt (the slab): two-tone voronoi pits + noise, strong bump. img= a Flow rock texture instead.

### `snow_rock(name='snowrock', rock_col='#5a5650', snow_col='#f4f7ff', thresh=0.55, scale=1.0, img_rock=None, img_snow=None, bump=0.5, snow_noise=0.18)`

Terrain shader: snow on flat ground (normal.z above thresh, broken by noise), rock on steep faces.

### `xray(name='xray', color='#22e83a', alpha=0.55, strength=0.9, fresnel=True)`

The reference's highlight: see-through emissive green (rim brighter). Animate visibility with xray_fade().

### `xray_fade(mat, keys, f0=1)`

keys [(t, 0..1)]: keyframes the material's overall opacity (the 'gate' node, or 'alpha' without fresnel).

### `emit(name, color, strength=5.0)`



### `steel(name='steel', color='#b8bcc4', rough=0.22, panels=0.0, panel_scale=4.0, img=None, scale=1.0)`

Polished steel; panels>0 draws panel seams (brick texture mortar as dark grooves + bump).

### `water(name='water', color='#0b3a4a', rough=0.04)`

Deep teal sea. Pair with ocean() geometry for real waves (sun glints come from the sun lamp + low roughness).

### `cloud_mat(name='cloud', img=None, strength=1.6)`

Flow cloud picture on black -> brightness is the alpha (assets/mega/clouds.png). Use on cz.plane cards.

### `card_mat(name, img, alpha=True, emit_strength=0.0, shadeless=False)`

A picture on a card (Flow clouds, signs, the ALASKA map...). shadeless: emission only (sky cards).

### `fbm(x, y, seed=0, octaves=6, ridged=False, lac=2.0, gain=0.5)`



### `heightfield(name, size, res, fn, mat=None, loc=(0, 0, 0), smooth=True)`

A grid mesh size=(w, d) with res=(nx, ny) vertices; fn(X, Y) -> Z (numpy arrays, local coords).

### `mountain_fn(peak_h=1.0, radius=1.0, seed=3, ridge=0.55, base=0.0, sharp=1.6, detail=0.04)`

An Everest-like peak: a radial cone shaped by ridged fbm (sharp arêtes) + small detail.

### `range_fn(height=0.3, scale=1.0, seed=5, ridged=True, floor=0.0)`

Endless snowy ridges for backgrounds (ridged fbm).

### `displace(ob, strength=0.1, scale=0.5, detail=6, subdiv=0, seed_offset=(0, 0, 0))`

Procedural displacement (Blender clouds texture) - roughen a cylinder / box into rock.

### `ocean(name='sea', size=400.0, res=10, scale=1.0, wave=0.6, choppy=1.0, mat=None, f0=1, f1=1800, loc=(0, 0, 0), spatial=1.0)`

Blender's ocean modifier plane, animated over [f0, f1] (time keyed).

## class `Flight` (v5, 2026-10-30: the cuts camera; full grammar in camera.md)

keys: `(t, eye, target[, lens[, roll[, hold]]])`. The keys draw C2 splines (eye, target, log lens, roll); the shot
travels them as ONE eased move: it starts at rest, eases in, cruises, eases out and ends at rest, so every cut lands
on still frames. Orientation is a quaternion look-at of the eased target. Old kwargs (smooth, retime, speed_ease,
push, ease='inout' ...) are accepted and ignored; `legacy=True` / env CZ_FLIGHT=4 = the old v4 camera (old films only).

### `Flight.__init__(keys, name='cam', lens=24, clip=(0.05, 5000), sensor=24, dof=None, ease='smooth', ease_in=0.4, ease_out=0.4, enter='rest', exit='rest', up=None, cuts=(), keep_cuts=False, lens_range=(14, 50), creep=0.0006, max_turn=None, legacy=False)`

ease: 'smooth' | 'sine' | 'smootherstep' | 'linear' | bezier handles (x1, y1, x2, y2). enter / exit = 'carry' only for
a move-matched cut. dof=(None | point | object | callable, fstop). up: a vector or a function of t (a globe wants the
surface normal). lens_range: lenses outside it are clamped.

### `Flight.bake(f0, f1, shake=0.0, seed=1)` / `Flight.at(t)`

Bakes per-frame keys (BEZIER + AUTO so motion blur follows the curve) and prints the report below.

## class `Tour` (the cutless camera)

### `Tour.__init__(stops, name='cam', lens=24, clip=(0.05, 5000), sensor=24, dof=None, ease='smooth', ease_in=0.4, ease_out=0.4, up=None, lens_range=(14, 50), max_turn=None, drift=0.02)`

stops: dicts `t=(arrive, leave) | time, look=point|object, eye=point | dist+yaw+pitch, lens, roll, drift, via=[eye points],
arc=False, pass_=True, name=`. Written ONCE in common.py; every shot of the group calls `M.Tour(C.TOUR).bake(F0, F1)` so
the parts are consecutive frames of one camera (camera.md). Each leg gets the time its turn needs (a leg of T s turns at
most ~12 x T deg), taken from the next hold first, holds >= 0.4 s; changed times print `CZ CAMTOUR` (retime the stops once).

### `cam_report(...)` (every bake)

Prints `CZ CAM peak/accel/jerk/turn/edges/lens` (float64, the same measure as tools/camstats.py), `CZ CAMJERK
<frames>` (jerk > 900 %/s^3; accel is reported only: an eased big move reaches 100-200 and is smooth), `CZ CAMEDGE` (a
cut not at rest), `CZ CAMCAP` (a turn over 20 deg/s), `CZ CAMLENS` (a lens clamped to 14-50 mm), and for a tour
`CZ CAMTOUR` (a stop's planned vs camera times) / `CZ CAMCAP cam tour: ... squeezed`. check_layout lists them as camera
NOTES: they never block the export; one fix at the cause, then storyboard.md (a tour's are the director's, in common.py).

### `Quat_roll(deg)`



### `visible(obj, spans, f0, f1, children=True)`

Show obj only during spans [(t0, t1)] (seconds), keyed hide_render per frame boundaries.

### `bake_path(obj, f0, f1, pos=None, rot=None, scale=None, stepped=False)`

Per-frame keys from functions of time t (seconds): pos(t)->xyz, rot(t)->degrees xyz, scale(t)->xyz or float.

### `join(name, objs, apply=False)`

Join many meshes into one object (fewer draw calls = faster EEVEE). apply=True also applies the result's
transform (otherwise the first part's rotation rides along into copies placed later: reactors lay on their side).

### `scatter(make, n, area, seed=1, z=0.0, rot=True, scale=(0.8, 1.2), avoid=None)`

Call make(i, (x, y, z), rotZ_deg, s) n times over area ((x0, y0), (x1, y1)); avoid(x, y) -> True skips.

### `text3d(name, body, size, loc, rot=(90, 0, 0), mat=None, extrude=0.02, align='CENTER', font=None)`
(Words in letters Arial Black lacks - Romanian ș ț ă, Vietnamese, Russian, Thai, Japanese, Korean, Chinese - get the kit's
own matching heavy font by themselves: leave `font=` out for them.)



### `count_text(obj, fmt, keys, f0, f1)`

Animated number text: a frame-change handler is not available headless in render jobs we bake as separate
text objects per frame - instead swap the body in a frame_change_pre handler (works in -b renders).

### `column(name, r, h, mat=None, rough=0.06, seed=1, nu=256, nv=96, taper=0.0, loc=(0, 0, 0), top=True, pits=0.5)`

A rock column (the cut slab): a cylinder mesh whose radius is perturbed by fbm (vertical strata + lumps) and
pitted. rough = relative radius variation. top=False leaves it open (a cap mesh sits there).

