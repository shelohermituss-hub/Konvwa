# Models at the bar

**First: is it in the library?** Real things (trees, rocks, grass, cars, trucks, tools, furniture, buildings, ground,
sky) come from the free asset library: `references/assets.md` (search, contact sheet, `A.model` / `A.scatter` /
`A.pbr_from` / `A.world`, credits). Build in Python only what no library has: cutaways and sections, X-ray internals,
mechanisms whose parts move on the words, one-off megastructures, and hero machines the library has no good match
for. A Claude-made tree or bush already in a kit: `D.swap(objs, '<id>', lod=0.08)` (detail.md). People: humans.md.

When you do build it, the examples' props files are the bar (open only the ONE file with the machine you need, ~12 k
tokens each; never the shot files): examples/everest/props_a.py (excavators: tracks with links + rollers, boom / stick
with hydraulic rams + chrome rods + hoses, a cab with tinted glass + frame + handrails + seat, counterweight, decals,
worn paint), props_b.py (lattice cranes with jibs + trolleys + cables, a magnet hall, site equipment: containers,
generators, cable drums), props_c.py (globe, sea, ballast tanks, a ship hull with deckhouse, lifeboats, masts),
props_d.py (a reactor hall with grating floors, walking crowds, an eagle with feather cards, a flag), examples/roof/
house.py (a hero model built in STAGES across the film) + props_r1/r2.py (trees from layered leaf clusters, cars, weather).

## How
- Many parts, each a cz primitive or a numpy mesh (M.heightfield, M.column for rock); bevel every hard edge
  (cz.box bevel= 0.02-0.04 of the size); join the parts of one model with `M.join(name, parts, apply=True)` (it bakes
  every part's bevel before joining: the old join kept only the first part's bevel and everything read as plastic).
- Materials: PBR with roughness 0.4-0.6 on paint, metal 0.15, tinted glass (roughness 0.05) with something behind it.
  Big surfaces: a scanned texture (`A.pbr_from(id)` / `D.pbr(id_or_kind)`), or name the material with a keyword
  (concrete, soil, brick, gravel, rock, siding ...) so `D.scan_all()` lays a scan into it; Flow textures (assets/mega:
  basalt, snow, mountain_rock, dirt_dark, lava_cracks, steel_panels, earth_day, clouds, alaska_map, hazard,
  radiation_sign, roof_*) for what no scan covers. Grime, stains and edge wear come from `D.finish` (detail.md).
- Parts of one model share one name prefix (`pump_body`, `pump_rod`): the overlap gate never checks them against each
  other (contact.md). Rest the model ON its support.
- Repeats (columns, magnets, reactors, people, trees): build one, place linked copies (`o.copy()` keeping `o.data`) or
  join many into one mesh: fewer objects = a faster frame.
- Cut-out cards (clouds, leaves, feathers): a solid DITHERED material with an alpha clip; BLENDED transparency only for
  the X-ray and true glass (it sorts badly and ghosted bushes in the roof film).
- Scale: pick one (1 unit = 1 m for houses, ~100 m for geography) and keep props at real proportions.
