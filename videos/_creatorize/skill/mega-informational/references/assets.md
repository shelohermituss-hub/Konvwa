# Free assets: find, check, use, credit

The owner (2026-10-30): "we can use open source free to use models from anywhere, for trees, cars, grass, props,
anything ... We want quality and fidelity." Real things (trees, rocks, cars, tools, furniture, buildings, ground,
skies) come from free libraries. Python modelling is for what no library has (see "When to model" below).

## The library
- One shared cache per machine: env `CZ_ASSETS3D`, else `<Documents>/Creatorize Assets/3d` (`models/`, `textures/`,
  `hdris/`, `index.json`, `local.json`, `CREDITS.json`). An asset downloaded once serves every film.
- `tools/asset_index.py` is the catalog of about 12,500 entries from 8 key-free sources (refresh about 22 s):
  | prefix | source | what | licence |
  |---|---|---|---|
  | `ph:` | Poly Haven | 521 scanned/hero models, 869 PBR textures, 997 HDRIs (real units, up to 8k) | CC0 |
  | `acg:` | ambientCG | 2,225 PBR textures, 434 HDRIs, 34 models | CC0 |
  | `si:` | Smithsonian 3D | 3,577 museum scans (millimetres are converted to metres) | CC0 (Open Access) |
  | `nasa:` | NASA 3D Resources | 223 spacecraft, telescopes, rovers, asteroids (no fixed units: give a size) | public domain, no NASA logos |
  | `kh:` | Khronos glTF samples | 28 showcase models (helmets, cars, lanterns) | CC0 / CC-BY per model |
  | `pp:` | Poly Pizza | 1,790 low-poly models incl. Quaternius + Google Poly (`--live` finds more) | CC0 / CC-BY |
  | `kenney:` | Kenney | 50 3D kits; downloading a kit adds every model in it as `kenney:<kit>/<model>` | CC0 |
  | `sf:` | Sketchfab | 1,777 downloadable CC0/CC-BY models; downloads need the user's own token | CC0 / CC-BY |
- Licence gate: only CC0, public domain or CC-BY. NC, ND, editorial and unclear terms are dropped when the index is
  built and refused again on download. ShareAlike is refused unless `--allow-sa` is passed.
- Sketchfab: search works without a key. To download, the user puts their own API token in the user environment
  variable `SKETCHFAB_TOKEN` (sketchfab.com > Settings > Password & API). Never write the token into a file. Without
  it, `sf:` results rank lower and a query skips them.

## Find
```
python tools/asset_index.py search "oak tree" [--kind model|texture|hdri|pack|any] [--style real|lowpoly] [--n 10] [--live]
python tools/asset_index.py info ph:tree_small_02
```
(In a build the prompt gives the full command: the app's Python and the kit's tools folder.) A machine's FIRST search
finds an empty index and refreshes it by itself (~25 s, network); with no network it says so and you model in Python.
Search matches name, tags and categories, with plural forms and synonyms (car/sedan/vehicle, rock/boulder/stone...).
Each result shows its licence, author, polycount, real size and texture resolution. `LOCAL` means it is already in the
cache (it ranks higher). `--live` also asks Poly Pizza, Smithsonian and Sketchfab about this exact query. Prefer
`style real` (Poly Haven, Smithsonian, Sketchfab) for the megaproject look; low-poly kits are for stylised shots or
background filler.

## Check before using (always)
```
<blender> -b --factory-startup -P <tools>/asset_sheet.py -- ph:tree_small_02 acg:Ground054 ph:kloofendal_48d_partly_cloudy_puresky --out .suite/assets_sheet.png [--look tone] [--views 3]
```
(The build prompt gives the exact Blender path: it is the ONE Blender command a build runs. `--out` inside `.suite/`,
never another project folder: those are part of every shot's render key.)
It renders one row per asset with 3 turntable views in the mega look, a label (id, licence, real size, triangles,
first and cached load time) and a scale reference (a 1.75 m figure, or a 10 cm cube for small props). Read the PNG.
Reject an asset that is lying down, has missing textures (white or pink), a wrong size, broken leaves, or is too heavy.
If it lies on its side, fix it once for every film with `A.fix(id, rot=(90, 0, 0))`; for wrong units use `A.fix(id, scale=0.01)`.

## Use (in build(ctx))
```python
import assets as A
tree = A.model('ph:tree_small_02', height=6.5, base=(-3.5, 4, 0), rot=20)            # hero: full detail
A.scatter('ph:tree_small_02', 12, ((-25, 14), (25, 28)), height=(5, 8), lod=0.25)    # background: decimated + instanced
A.scatter('ph:rock_moss_set_02', 30, area, size=(0.5, 1.5))                          # instanced: 30 copies cost one
car = A.model('kenney:car-kit/sedan', width=4.6, base=(0, 0, 0), rot=90, look='tone')
ground.data.materials.append(A.pbr_from('ph:forrest_ground_01'))                    # real tile size, box-projected
A.world('ph:kloofendal_48d_partly_cloudy_puresky', strength=0.8, sun=False)          # an HDRI sky instead of M.setup's
```
- Size: `height=` sets Z, `width=` sets the longest side of the footprint (a car's length), `size=` sets the largest
  dimension. With none of them, the real size is used: Poly Haven, Smithsonian and Sketchfab models are in metres.
  Low-poly and NASA models get a real-world size from a table (car 4.6 m long, tree 8 m, house 7.5 m...).
- `base` = where its base centre stands; `rot` = degrees about Z (or an `(x, y, z)` tuple).
- `look`: `'orig'` (default, the asset's own PBR at full fidelity), `'tone'` (slightly calmer saturation, no mirror
  gloss: blends low-poly or very saturated assets into the realistic look), `'clay'` (a single matte colour `tint`
  that keeps the normal map and leaf cut-outs: a ghosted or "model" read, an X-ray context). `tint='#rrggbb'`
  multiplies the colour in any look.
- `res='1k'|'2k'|'4k'|'8k'` = texture resolution. 2k is the default (a 1080x1920 frame rarely shows more); use 4k
  only for a hero close-up, 1k for background.
- `lod=0.25` decimates the mesh (cached per ratio). Use it for far copies of heavy scans: Poly Haven trees are
  0.5-17 M triangles. A query never picks a model over 5 M triangles (`CZ_ASSET_MAX_TRIS`); an id still can.
- `instance=True` (the default in `scatter`) places a collection instance. It is the cheapest option, but the mesh is
  not a child, so contact checks read the root's `cz_dims`. Every root has `cz_id`, `cz_dims` (placed size in metres)
  and `cz_tris`.
- A word query (`A.model('red car')`) takes the best match that downloads, prints `CZ ASSET query ... -> <id>`, and
  credits it. The first pick is pinned for the project (`.suite/asset_queries.json`), so the check and the render
  place the same model. It is still a shortcut: for anything on screen, search, check the sheet, then use the id.
- A texture id in `A.model` or a model id in `A.texture_set` / `A.pbr_from` raises a TypeError naming the kind.
  `A.pbr_from` makes one material per texture + settings (a second call with another tint or scale gets its own);
  `name=` is a cache key.
- `CZ_ASSETS_OFFLINE=1`: nothing downloads (renders on the Mac mini or a night run use only what is cached, at any
  resolution on disk). A missing id raises with the fetch command: `tools/fetch_asset.py <id> [--res 2k]`.
- Downloads of one asset are serialised across processes (a lock per asset): 4 check lanes asking for the same new id
  download it once. A fetch that fails twice (404, no network): another search result, or model it in Python and note
  it in storyboard.md.
- Copying the cache to another computer (the Mac mini): run `tools/fetch_asset.py --repair` first (old Windows paths in
  meta.json -> forward slashes, missing local marks set); the engine also repairs each meta.json it reads.

## Costs (measured on the PC, RTX 5080, Blender 5.2)
| what | first time | every later shot |
|---|---|---|
| Poly Haven tree 2.06 M tris (2k) | download 35 MB + import 3.5 s | 0.14 s (appends the cached .blend) |
| the same tree, `lod=0.25` (0.52 M tris) | +21 s decimate, once | about 0.1 s |
| rock set 63k / wrench 11k / grass 1k / cars 2k / Kenney house 1k | 0.02-0.25 s | 0.01 s |
| Smithsonian chair 150k (Draco) | 0.25 s | 0.01 s |
| test yard: 8 masters, 13 trees, 400 grass, car, house, rock, props | build 27.6 s (cold) | build 1.7 s, frame 2.1 s full HD |
| PBR texture set / HDRI | download 1-3 s | 0 (images load at render) |

## Credit (the video description)
Every asset a build uses is recorded in `<project>/.suite/CREDITS.json` (title, author, licence, source url),
written under a lock by every Blender at once (projects built before 2026-10-30: `assets/CREDITS.json`, still read).
It lives in `.suite/` so a new id never changes a shot's render key. `A.credits()` lists them and `A.credits_text()`
gives the description block. CC-BY assets require the author's name in the description, so never remove an entry.

## When to model in Python instead
- Cutaways and X-ray internals: a section through a wall, soil layers, pipes inside a house, an engine opened up. A
  scanned asset is a closed shell with nothing inside, so build those with `cz`/`M` primitives and `M.xray`.
- Things that must move part by part: an excavator arm, a crane jib, a door swinging, a bridge being built in
  stages. Library models are usually one joined mesh. Model the moving parts and use library pieces as dressing
  around them.
- Exact engineering shapes the narration describes (a particular dam profile, a tunnel boring machine head) when no
  library model matches. Search first (`--live`), then model.
- Terrain at geographic scale: `M.heightfield` / `M.mountain_fn`. Dress it with library rocks, trees and textures
  (`A.pbr_from`).
- Mixing works well: a Python-modelled hero (the cutaway house) in a library world (trees, cars, ground, sky).
