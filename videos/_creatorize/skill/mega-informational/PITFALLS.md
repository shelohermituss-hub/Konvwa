# PITFALLS (every failure of the showcase films and the night's shorts, as rules)

## The build itself
- Reading every example film (76 files, ~140 k tokens) burns the context before shot 1: read only SKILL.md's list;
  sop.md's shot file is the pattern.
- Looping on a non-blocking line (camera, CZ HOLD, CZ FOOTSLIDE, a partial check) never reached the end: ONE fix at its
  cause, a note in storyboard.md, move on. Only script errors and CZ CONTACT lines block the export.
- Running signoff.py / camreplay / a bare `blender` from a doc: those are the engine's own tests (the wrong Python on
  Windows, no Blender on the Mac PATH). In a build only the asset sheet command the prompt gives runs Blender.

## Camera
- v4's speed profile started and ended every shot at ~50 % of its peak speed, so 0 of 220 cuts landed on rest ("the
  cuts are rough, the ramp is not smooth"): M.Flight v5 eases rest to rest by itself; never add edge whips (keys a few
  frames from F0 / F1) and never `enter`/`exit='carry'` unless the next shot carries the same move.
- Sideways whips and a fast zoom at every cut read as "frantic, horrible": one eased move per shot, no zoom transitions.
- A move too big for its time shows as CZ CAMJERK / CAMCAP: fewer or closer keys, or more frames - never a faster ease.
- Long lenses (60-85 mm) flatten the scale: 18-35 mm.
- Hand-keyed cameras bypass the grammar: always M.Flight or M.Tour.
- A tour whose stops are far apart with nothing between looks at empty ground mid-travel: closer stops or `via=`.
- A tour part whose set differs from its neighbour (a prop, a light, a material) shows as SEAMFAIL: same set in every part.
- A one-frame black flash at a cut is not a transition: never change the picture to satisfy a measurement.
- The old examples (everest e10 / e29 / e31, roof r05 / r12) were keyed for v4 with whips: don't copy their camera keys.

## Assets
- Claude-made trees, cars, rocks and tools read as CG next to the originals: library assets (assets.md) first.
- A word query can pick a weak match ("pine tree" -> Pine Roots): search, check the sheet, then use ids.
- Poly Haven grass models are thin 1.7 m strips that read as dark specks when scattered small: lawns use D.scatter's
  grass or D.pbr ground, not scattered grass models.
- A full-res Poly Haven tree (2 M tris) x 7 = +0.85 s/frame: far copies with `lod=` (0.08-0.25) and `instance=True`.
- Some Smithsonian models render white (base colour not connected) and old ones 404: check the sheet, take another.
- A word query in a shot file could place another model at render time than at check time (the index changed in
  between): shot files use ids (a query's first pick is now pinned per project anyway).
- `width=` is the LONGEST footprint side: a car is `width=4.4-4.8` (its length), not its 1.8 m width.
- A cache fetched on Windows stored `2k\x.jpg` paths: the Mac re-downloaded every Poly Haven asset. Fixed (forward
  slashes, repaired on read); run `tools/fetch_asset.py --repair` before copying a cache to another computer.

## Contact
- Props placed "about there" floated or sank: put the lowest point at the support's top z.
- A decal or panel laid exactly on a face of another material flickers: lift it 1 cm.
- Pipes, stones and roots poking out of a cutaway's face: bisect at the plane, or `cz_section_ok` when it is the texture.
- Parts of one model named without a common prefix are checked against each other: name them `pump_body`, `pump_rod`.
- Relief lumps (0.2 m) swallow props closer to the face: pass them as `clear=` to D.relief and look at the frame.

## People
- Persons built from primitives (the old props_d.py rigs) are retired for anything closer than a far crowd: H.figure.
- A prop parented to a bone or placed "near" a hand: always HD.hold / HD.handover with a VERIFIED grip.
- A handover between people standing too far apart misses the reach: stand them 0.8-0.9 m apart, right hand to LEFT.
- Feet slid at walk starts / stops and corners (12-35 cm): `H.plant()` once after the people are built holds every
  planted foot (max 1.2 cm measured). A 180 deg `f.turn` on the spot twists the legs: let the walk arrive facing the
  right way.

## Models and materials
- Plain boxes as machines / equipment piles read as placeholders: real parts (models.md).
- Joined parts lost their bevels (fixed in M.join): still bevel each part before joining.
- BLENDED cut-out materials ghost (see-through bushes): DITHERED + alpha clip for leaves, feathers, clouds-as-cards.
- A full fresnel water reflection goes white at grazing angles: use M.water (diffuse teal + 40 % tinted gloss).
- Bright yellow / green emission washes out to cream under AgX: emission <= 1.5, push the colour's saturation instead.
- The sky node's own sun disc sits elsewhere than the lamp: M.setup draws the sun on the lamp (sun_disc=False hides it).
- EEVEE 5.2's Ambient Occlusion shader node returns ~1 everywhere without ray tracing: contact darkening comes from
  D.corners, shadows and the dirt line instead.
- Edge wear on panel walls lit every seam as a white line: `wear=1` only for machines.
- Bevelling an object whose mesh a C.flash X-ray overlay shares broke the overlay: shared meshes are skipped by D.finish.
- Fog over 400 m at 0.004 turned the sky pale: 0.0015-0.002 outdoors.
- Motes at 600 / 1 cm / glowing read as snow: 160 specks of 1.5-4 mm, barely glowing.
- Scattered stones too light (snow blobs) or 3-10 cm grey on a cut face (floating balls): 1-3.5 cm in the soil's colours.

## Render time (references/render.md)
- The Cu Chi export ran 4 Blenders on the Mac mini: 19 s a frame each, the GPU 97 % busy, memory full (14 G wired, 8 G
  compressed); one alone was 5 s a frame. Never start several Blenders: the export's render tuner decides (one unless a
  measured test proves more is faster with no memory pressure).
- A jungle frame was 87 % library plants and 77 % shadows (PC, one feature off at a time): hundreds of instanced plants
  drawn into the shadow maps of 11 shadow-casting lights, every TAA sample. Far plants at `lod=` 0.1-0.25, and keep the
  shadow-casting fill lights few; render settings are the tuner's job, not the shot's (never lower samples or shadows in
  a shot file to make it faster).
- The scene pass (engine/scenepass.py) turns library placements into GN instances by itself at render time; a shot
  never builds its own instancers or LOD copies for speed. What it must leave alone it finds by itself (animated,
  parented, targeted, held), but a placement the shot reaches BY NAME after the build (a frame handler, a driver
  expression string) is invisible to it: tag it `ob['cz_keep'] = True` (the scene pass never touches it).
- Foliage does not decimate invisibly: half the triangles of the Cu Chi trees = 0.44x frame time but SSIM 0.926 (the
  canopy turns to blobs). Pick the asset's `lod=` when placing it (0.1-0.25 for far rows) and let the gate judge the rest.
- Object-space textures (M.pbr, D.triplanar, the detail group) mean a join may only merge parts sharing ONE world
  matrix: M.join of parts with different transforms shifts their textures (the scene pass refuses those joins).

## Light
- A saturated sky as the light turns every shadow deep blue: M.setup lights with a calmer copy (light_sat, light_k).
- Flat, bright frames: lower the sun (15-25 deg), less fill (light_k 1.0), a rim from behind.

## Pictures
- The image service once handed back another scene's picture: LOOK at every enrich target before building from it.

## Enrich targets
- 0.20.0 sent our Everest showcase frame along as a style reference, and the image service returned OUR mountain for
  members' unrelated projects. enrich_frame now sends only your own frame and the app throws away any target whose
  structure does not match it. Never build from a target that does not show your own shot.
