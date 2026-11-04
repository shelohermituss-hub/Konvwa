# Detail: the bar and the calls (engine/detail.py, `import detail as D`)

The owner after the night's three shorts (2026-10-30): "detail is still lacking, could be a lot better". Our frames next
to the originals: the originals' surfaces are never one flat colour (concrete has stains, pores and streaks, soil has
grain and relief), the far world sits in a little air, the ground at the edges is broken up by stones, grass and roots,
and the light has a rim. Ours were clean CG: uniform paint, razor edges, sharp far hills, an empty lawn line.
`detail_before_after.jpg` (this folder): basement e10 / e12 / e36, each before | after (`D.finish` + the shot's extras).

## Round 2 (2026-10-30): what made the visible difference
`detail_before_after.jpg` = 4 rows (basement e10, e12, e36, Cu Chi s24) x original | night's film | round 2.
Round 1 alone (procedural breakup) was invisible at phone size. What shows:
1. `D.scan_all()` - every film material whose NAME has a keyword (concrete, soil, brick, shingle, gravel, rock, siding,
   bark ... `D.SCANS`) gets a photo-scanned PBR set from package A laid INTO it (detail transfer): the scan divided by
   its own mean multiplies the film's colour, so a white wall stays white and the soil strata stay; its AO (relative)
   darkens crevices, its roughness and height map come along. World box mapping at the scan's real size (Poly Haven
   metres), 2k. Concrete reads as poured concrete with stains, brick as brick, soil as stony earth.
2. `D.relief(soil_objs, normal=(0, -1, 0), amount=0.2, clear=[props on the face])` - real displaced clods on the
   camera-facing cut faces (one grid skin per face rectangle, holes stay open, joins continue, 250k verts budget,
   0.2 s). Then `D.scatter('pebbles', surface=skin, facing=(0, -1, 0), density=30, size=(0.01, 0.035), colors=soil-ish)`.
3. `D.corners('both')` - screen-space ray tracing + horizon-scan GI and soft shadows on the shadowless fill lights:
   corners and contact lines darken (+0.15 s/frame). `'fill'` alone is cheaper. Since 2026-10-30 a light made with
   `cz.light(..., shadow=False)` stays shadowless (it was switched on anyway: on Cu Chi the 'fill' light's shadow map of
   every plant was ~half a frame on the Mac mini, and off it looked the same: SSIM 0.99+). Want its shadow: `shadow=True`.
4. `D.fog(density=0.0015-0.003, height=20, end=400)` + `D.dof(blur='subtle')` - far hills and forest sit in air.
5. `D.swap(trees, 'ph:tree_small_02', lod=0.08)` - Claude-made props replaced by a real model at the same base and
   height (LOD: the 2.06M-tri tree costs 0.85 s/frame x 7 at full res; at lod 0.08 = 165k tris it is ~0.1 s).

Round-2 cost per frame (1080x1920, 4 samples): e10 0.27 -> 0.45, e12 0.25 -> 0.45, e36 0.27 -> 0.52, s24 0.27 -> 0.55.
Build adds 1-7 s (scans: image mean once per texture; first LOD of a model 23 s, then cached). 40 shots x 70 frames
x +0.22 s = ~10 min on one Blender, ~2.6 min at the export's 4 jobs.

## The order (one order, fix round 2026-10-30)
Set + motion + camera bake first, then: `D.scan_all()` -> `D.relief(...)` -> `D.swap(...)` -> `D.finish(level='film',
ground=...)` -> `D.corners(...)` -> `D.fog(...)` -> `D.scatter(...)` -> `D.light(...)` -> `D.dof(...)`. The calls no longer
undo each other (`finish` keeps the GI `corners` set, whichever runs first), but scatter / dof / fog read the baked
camera, so they always come after it. Library models (package A) are never enriched or scanned: their scans are real.
Names: materials are matched by WORD (`soil2_dark` -> soil, `firebrick` -> brick, `terrain` is not `rain`,
`proof_panel` is not `roof`): name a material by what it is (`wet_concrete`, `backfill_soil`). `CZ DETAIL WARN scan`
names every material whose scan id is not in the asset cache (fetch it, or the surface stays procedural).
Overlap gate: fog, motes, scatter pieces and roots carry `cz_nocontact`; relief skins may overlap their own block and
stand in front of the section, and are checked against everything else (contact.md).

## The one call (every shot, after the camera)
`D.finish(level='film', ground=<z of the ground or None>)` - every eligible material gets surface breakup (stains
~2 m, mottling ~40 cm, pores ~2 cm, roughness variation, a fine bump), weathering streaks down vertical faces, a dirt line
up from `ground` (never below it: cellar walls in a cutaway stay clean), dusty tops; sharp low-poly meshes get a small
bevel; fast-GI AO on, crisper shadows. Never touched: X-ray, emission, glass, water, gas, clouds, text, any BLENDED
material, linked copies (C.flash's overlays), anything with `['cz_detail'] = 0`. `wear=1` adds edge wear on bevelled
outer edges (machines, hero props only: on panelled walls the seams are bevels too). `level='draft'` = lighter, cheaper.

## Extras by name (pick what the shot needs)
| call | for | cost measured |
|---|---|---|
| `D.pbr(id_or_kind, scale, tint)` | big surfaces: package A's texture (`A.pbr_from` / `A.texture_set`), else a fallback by kind (concrete, soil, rock, wood, steel, plaster, brick, asphalt ...), detail built in | compile once |
| `D.scatter(kind, area=((x0,y0),(x1,y1)) or surface=obj, density, z, avoid, size, facing)` | pebbles / gravel / rocks / grass / debris (twigs + leaves) instanced, ONLY where the camera looks, thinner with distance. Call after the camera bake. | 0.02-0.2 s build; 31k pieces: 0.29 s/frame total |
| `D.roots(at, 'y', span, top, depth, n, avoid)` | thin roots hanging in a soil cut face | one mesh |
| `D.greebles(obj, '-y', n)` `D.bolts(obj, face)` `D.label(text, loc, rot)` `D.hazard(w, h, loc, rot)` | machines / interiors: panels, vents, pipes, bolt rows, printed plates, hazard stripes | one mesh each |
| `D.light('day' / 'golden' / 'overcast' / 'interior' / 'night', rim=, hdri=)` | a rim sun from behind (silhouettes; it casts shadows), full-res contact shadows, an HDRI from package A lighting the scene while the camera keeps M.setup's sky | a rim shadow map (not measured; small) |
| `D.fog(density=0.0015-0.004, height=12)` | aerial haze (far hills soften, depth reads); interiors / beams 0.02-0.08 with `shafts=True` | ~0 at 0.0015 |
| `D.motes(center, size)` | a few dust specks drifting in a beam (secondary motion) | ~0 |
| `D.dof(focus=obj / point / None, blur='subtle' 5 px / 'medium' 9 / 'macro' 16)` | blur sized in pixels of the 1080 frame (f-stop solved per frame from the lens and focus) so it reads on a phone | ~0 |

## Numbers (PC, RTX 5080, Blender 5.2.3, 1080x1920, 4 samples = the export's settings)
| shot | before s/frame | finish s/frame | finish + extras s/frame |
|---|---|---|---|
| e10 (wide, cut face + house) | 0.27 | 0.37 | 0.33-0.38 |
| e12 (interior wall close-up) | 0.25 | 0.36 | 0.31-0.35 |
| e36 (outside, lawn + pipe) | 0.27 | 0.37 | 0.37 |
`D.finish` itself: 0.03-0.08 s per shot build. The first frame of a shot compiles its shaders: 15-33 s with the detail
group when the shader cache is cold, 1.7-3 s once Blender's on-disk cache has them (the same materials recur in every
shot of a film, so a film pays it about once per material per machine). 40 shots x ~70 frames x +0.1 s = ~5 min more
on one Blender (~1.2 min at the export's 4 jobs).

## The detail bar (the critic scores every shot; a 0 on any line = fix round)
1. **No flat surface**: every surface over ~10 % of the frame shows variation at 2 scales (stains + grain) - concrete,
   plaster, soil, paint, metal. (D.finish / D.pbr.)
2. **Material truth**: concrete reads as concrete (pores, streaks), soil as soil (grain, stones), metal as metal
   (specular, slight breakup), paint as paint. A texture from package A on every big surface where one exists.
3. **Edges**: no razor-sharp CG edge on a prop near the camera (bevel); machines show light edge wear (`wear=1`).
4. **Ground edge broken**: where ground meets a wall, a cut or a lawn line, something breaks the line (stones, grass,
   debris, roots); no empty ground plane filling the frame.
5. **Depth**: foreground / midground / background; far things sit in a little air (D.fog 0.0015-0.004) and the far
   background is slightly soft (D.dof 'subtle') - the subject stays sharp.
6. **Light**: key + rim on the subject's silhouette; contact shadows under props.
7. **Life**: something small moves besides the main action where it fits (motes in a beam, grass, water, smoke).
8. **Still clean**: the X-ray green, the labels and the subject read at once on a phone; detail never turns into
   noise (no speckle, no white specks, no busy texture behind the X-ray). Fail = too much: turn amounts down.

## Pitfalls found building it
- EEVEE 5.2's Ambient Occlusion shader node returns ~1 everywhere without ray tracing (measured): no AO-driven grime.
  Contact darkening comes from shadows and the dirt line instead.
- Edge wear on panel walls lit every seam as a white line: wear is opt-in (`wear=1`) for machines.
- Bevelling an object whose mesh a C.flash X-ray overlay shares broke the overlay (it vanished): shared meshes are skipped.
- Fog over 400 m at 0.004 turned the sky pale: keep 0.0015-0.002 outdoors (the volume ends `end` m out: 220 by
  default, 400 for a far valley at <= 0.002).
- Motes at 600 / 1 cm / glowing read as snow: 160 specks of 1.5-4 mm, no glow (default 0 since the fix round: even 0.05
  read as white specks on lit surfaces).
- The rim sun casts shadows (fix round): a shadowless rim lit the inside of cutaway rooms through their walls.
- Scatter rocks / pebbles too light read as snow blobs: the default colours are mid-dark greys.
- Stones scattered on a cut face at 3-10 cm and grey read as floating balls (Cu Chi): 1-3.5 cm in the soil's colours.
- A scan's mean must be taken in LINEAR space (8-bit images store sRGB): v1 darkened every scanned surface ~2.5x.
- Relief lumps (0.2 m) swallow props sitting closer to the face (the e10 arrows at 12 cm): pass them as `clear=`.
  Fixed in the fix round: the clear box is the union over the shot's frames while each prop is shown (an arrow growing
  by a scale key was measured tiny at build time), and only props within `amount` + 5 cm of the face clear it; e10
  f463 shows whole shafts. A face that is not axis-aligned (a rotated block) gets no skin and a `CZ DETAIL WARN relief`.
- `SCANS['bark']` pointed at a MODEL (ph:pine_roots): bark is `ph:bark_brown_02` now (cached on the PC).
- A full-res Poly Haven tree (2M tris) x 7 = +0.85 s/frame: always swap with lod.
