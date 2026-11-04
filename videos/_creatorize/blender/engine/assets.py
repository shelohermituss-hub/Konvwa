# assets.py - free open-source assets in the mega (3D Informational) engine: `import assets as A` inside build(ctx).
#   tree = A.model('ph:tree_small_02', height=7, base=(3, 4, 0), rot=30)        # an index id
#   car  = A.model('red sedan car', width=4.5, base=(0, 0, 0), look='tone')     # or a query: best match, fetched once
#   A.scatter('grass tuft', 300, ((-20, -20), (20, 20)), height=(0.3, 0.5))     # many copies, instanced (cheap)
#   ground.data.materials.append(A.pbr_from('ph:forrest_ground_01'))             # a full PBR material (real tile size)
#   A.world('ph:kloofendal_48d_partly_cloudy_puresky', strength=1.0)            # an HDRI world
#   A.credits()                                                                  # every asset this film used
# A model is imported ONCE per machine and resolution: transforms applied, parts joined into one mesh, upright, origin at
# its base centre, its real size kept (Poly Haven / Smithsonian / NASA are in metres; low-poly sources get a size from
# a table of real-world sizes when the shot gives none), its original PBR materials kept at full fidelity, then saved as
# <asset dir>/norm/<res>.blend. Every later shot appends that file (fast) and places linked duplicates (one mesh in
# memory for 50 trees) or collection instances (instance=True: thousands of grass tufts). Prints `CZ ASSET` lines.
# Index + downloads: tools/asset_index.py + tools/fetch_asset.py (shared cache: CZ_ASSETS3D, else
# <Documents>/Creatorize Assets/3d). CZ_ASSETS_OFFLINE=1: never download during a build (only cached assets).
import bpy, os, sys, json, math, time, hashlib, random
from pathlib import Path
from mathutils import Vector, Matrix, Euler
import cz

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), 'tools'))
import asset_index as X
import fetch_asset as F

NORM_V = 2                         # bump when the normalisation changes: every cached .blend is rebuilt
OFFLINE = os.environ.get('CZ_ASSETS_OFFLINE') == '1'
_USED = {}                         # id -> credit (this process: the film's description)
_MASTER = {}                       # (id, res, lod, look, tint) -> (collection, object)
_LOOKMAT = {}                      # (material name, look, tint) -> material
_META = {}
STATS = {'calls': 0, 'secs': 0.0}

# real-world sizes for sources without real units (low-poly packs): (words, measure, metres)
SIZE_HINT = [(('palm',), 'height', 9.0), (('pine', 'fir', 'spruce', 'conifer'), 'height', 12.0), (('tree',), 'height', 8.0),
             (('bush', 'shrub', 'hedge'), 'height', 1.3), (('grass', 'tuft', 'weed'), 'height', 0.35), (('flower', 'plant', 'fern'), 'height', 0.5),
             (('boulder',), 'size', 2.5), (('rock', 'stone'), 'size', 1.0), (('pebble',), 'size', 0.1),
             (('bus', 'coach'), 'width', 12.0), (('truck', 'lorry'), 'width', 8.0), (('van',), 'width', 5.2), (('tractor',), 'width', 4.0),
             (('car', 'sedan', 'suv', 'taxi', 'hatchback', 'police', 'vehicle'), 'width', 4.6), (('bicycle', 'bike'), 'width', 1.8),
             (('motorcycle', 'motorbike', 'scooter'), 'width', 2.1), (('boat',), 'width', 6.0), (('ship',), 'width', 80.0),
             (('plane', 'airplane', 'jet'), 'width', 35.0), (('helicopter',), 'width', 12.0),
             (('skyscraper',), 'height', 120.0), (('apartment', 'tower'), 'height', 30.0), (('house', 'cottage', 'home', 'building', 'cabin'), 'height', 7.5),
             (('barn',), 'height', 9.0), (('shed', 'hut'), 'height', 2.8), (('fence',), 'height', 1.2), (('door',), 'height', 2.1),
             (('lamp', 'streetlight'), 'height', 4.5), (('bench',), 'width', 1.8), (('chair', 'stool'), 'height', 0.9), (('table', 'desk'), 'height', 0.75),
             (('sofa', 'couch'), 'width', 2.1), (('bed',), 'width', 2.1), (('barrel', 'drum'), 'height', 0.9), (('crate', 'box'), 'size', 0.8),
             (('person', 'man', 'woman', 'human', 'character', 'soldier'), 'height', 1.75), (('dog',), 'height', 0.6), (('cat',), 'height', 0.3),
             (('horse',), 'height', 1.6), (('cow',), 'height', 1.5), (('hammer',), 'size', 0.33), (('wrench', 'spanner', 'screwdriver'), 'size', 0.3),
             (('drill',), 'size', 0.3), (('shovel', 'axe'), 'size', 1.1), (('ladder',), 'height', 3.0), (('bucket',), 'height', 0.35),
             (('cone',), 'height', 0.7), (('hydrant',), 'height', 0.75), (('bottle',), 'height', 0.28), (('phone',), 'size', 0.15),
             (('laptop',), 'width', 0.35), (('tank',), 'width', 7.0), (('rocket',), 'height', 60.0), (('crane',), 'height', 40.0),
             (('excavator', 'digger', 'bulldozer'), 'width', 9.0), (('windmill',), 'height', 15.0), (('lighthouse',), 'height', 25.0)]
SIZE_HINT += [(('telescope',), 'width', 13.0), (('satellite', 'probe', 'orbiter', 'spacecraft'), 'width', 8.0), (('rover',), 'width', 3.0),
              (('station',), 'width', 100.0), (('asteroid',), 'size', 500.0), (('capsule',), 'height', 4.0), (('suit', 'astronaut'), 'height', 1.9)]
REAL_UNITS = {'polyhaven', 'ambientcg', 'smithsonian', 'sketchfab', 'khronos', 'file'}   # NASA's files: any unit
MAX_TRIS = int(os.environ.get('CZ_ASSET_MAX_TRIS', 5_000_000))   # a query never picks a heavier model (an id still can)
DEFAULT_SIZE = 3.0                # no units, no size given, no hint: 3 m and a CZ ASSET WARN


# ---------------------------------------------------------------- finding + fetching
def search(query, kind='model', n=10, style=None, live=False):
    """Ranked index entries [{id, name, license, author, polys, dims_m, score, local...}] (tools/asset_index.py)."""
    return X.search(query, kind, n, style, live)


def _fetchable(e, res='2k'):
    if e.get('needs_token') and not os.environ.get('SKETCHFAB_TOKEN'): return False
    return not OFFLINE or F.cached(e['id'], res) is not None       # offline: what is on disk (not only what is marked)


def _suite():
    """<project>/.suite: the project's generated folder (never part of a shot's render key or the source watch)."""
    proj = getattr(cz, 'PROJECT', None)
    if not proj: return None
    d = Path(proj) / '.suite'
    try: d.mkdir(exist_ok=True)
    except OSError: return None
    return d


def _query_memo(key, kind, style, id=None):
    """A word query resolves to ONE id per project (.suite/asset_queries.json): the check and the render of a shot place
    the same model even if the index changed in between (a refresh, a --live search). id given: record it."""
    d = _suite()
    if d is None: return None
    f = d / 'asset_queries.json'; k = f'{kind}|{style or ""}|{" ".join(X.words(str(key)))}'
    try:
        if id is None: return X._read_json(f, {}).get(k)
        with X._FileLock('asset_queries', folder=d):
            m = X._read_json(f, {})
            if m.get(k) != id: m[k] = id; X._write_json(f, m)
    except Exception as ex: print('CZ ASSET query memo', ex)
    return None


def resolve(key, kind='model', res='2k', style=None):
    """An index id, a local file path, or a query -> the fetched asset {'id','main'|'maps','title','author','license','page',...}.
    Offline (CZ_ASSETS_OFFLINE=1): only what is in the cache, any resolution on disk; a missing one raises LookupError
    naming the fetch command."""
    if kind == 'model' and os.path.isfile(str(key)):
        p = os.path.abspath(key)
        return {'id': 'file:' + Path(p).stem, 'main': p, 'kind': 'model', 'title': Path(p).stem, 'author': '(project file)',
                'license': '(supplied with the project)', 'page': p, 'src': 'file', 'dir': str(Path(p).parent)}
    id = key if (X.get(key) or (':' in str(key) and ' ' not in str(key).split(':', 1)[0])) else None
    if id is None:
        id = _query_memo(key, kind, style)
        if id and not (X.get(id) and _fetchable(X.get(id), res)): id = None
        if id: print(f'CZ ASSET query "{key}" -> {id} (this project\'s earlier pick; put the id in the shot file)')
    if id is None:
        # a query: the best match that is light enough for a 40-shot film (<= MAX_TRIS) and actually downloads
        hits = [h for h in X.search(key, kind, 25, style) if _fetchable(h, res) and (h.get('polys') or 0) <= MAX_TRIS]
        if not hits: raise LookupError(f'CZ ASSET no {kind} for "{key}"' + (' in the cache (offline)' if OFFLINE else '') +
                                       f' (tools/asset_index.py search "{key}" --live; none at all: model it in Python, models.md)')
        for h in hits[:6]:
            try: r = F.fetch(h['id'], res, log=print, offline=OFFLINE)
            except F.FetchError as ex: print(f'CZ ASSET skip {h["id"]}: {ex}'); continue
            id = h['id']; break
        else: raise LookupError(f'CZ ASSET no {kind} for "{key}" could be fetched')
        print(f'CZ ASSET query "{key}" -> {id} "{h["name"]}" {h.get("license")} by {h.get("author")} (put the id in the shot file)')
        _query_memo(key, kind, style, id)
    e = X.get(id)
    if e and e.get('kind') not in (kind, 'pack' if kind == 'model' else None):
        raise TypeError(f'CZ ASSET {id} is a {e.get("kind")}, not a {kind}: search with --kind {kind}')
    try: r = F.fetch(id, res, log=print, offline=OFFLINE)
    except F.FetchError as ex:
        raise LookupError(f'CZ ASSET {id}: {ex}. A fetch that fails twice: another search result, or model it in Python '
                          f'(models.md) and note it in storyboard.md') from None
    r['src'] = (e or {}).get('src', id.split(':', 1)[0])
    if r.get('main'): r['main'] = os.path.normpath(r['main'])
    _credit(r)
    return r


def _credit_files():
    d = _suite(); proj = getattr(cz, 'PROJECT', None)
    return (d / 'CREDITS.json' if d else None), (Path(proj) / 'assets' / 'CREDITS.json' if proj else None)


def _credit(r):
    """Records the asset in <project>/.suite/CREDITS.json (locked + atomic: 4 check lanes and the render jobs write at
    once; in .suite so a new id never changes a shot's render key or restarts the frame servers)."""
    c = {'id': r['id'], 'title': r.get('title'), 'author': r.get('author'), 'license': r.get('license'), 'source_url': r.get('page'),
         'kind': r.get('kind')}
    if r['id'] in _USED: return
    _USED[r['id']] = c
    cf, _ = _credit_files()
    if cf is None: return
    try:
        if any(x.get('id') == c['id'] for x in X._read_json(cf, [])): return
        with X._FileLock('credits', folder=cf.parent):
            cr = X._read_json(cf, [])
            if not any(x.get('id') == c['id'] for x in cr): X._write_json(cf, cr + [c])
    except Exception as ex: print('CZ ASSET credits', ex)


def credits():
    """Every asset this film used (this build + what every shot recorded in <project>/.suite/CREDITS.json, + the
    assets/CREDITS.json of projects built before 2026-10-30)."""
    out = dict(_USED)
    for f in _credit_files():
        if f is None or not f.exists(): continue
        try:
            for c in X._read_json(f, []): out.setdefault(c['id'], c)
        except Exception: pass
    return list(out.values())


def credits_text():
    """The description block: one line per asset (title - author - licence - url)."""
    return '\n'.join(f"{c['title']} by {c['author']} ({c['license']}) {c.get('source_url') or ''}".strip() for c in credits()
                     if not str(c['id']).startswith('file:'))


# ---------------------------------------------------------------- import + normalise (once per machine)
def _meta(r):
    mp = Path(r['dir']) / 'meta.json'
    try: return json.loads(mp.read_text(encoding='utf-8')) if mp.exists() else {}
    except Exception: return {}


def fix(key, rot=None, scale=None, res='2k'):
    """Correct an asset once for every film: rot=(x, y, z) degrees applied at import (a model lying on its side),
    scale= a unit factor (a model in centimetres: 0.01). Its cached import is rebuilt."""
    r = resolve(key, 'model', res)
    mp = Path(r['dir']) / 'meta.json'; m = _meta(r)
    m['fix'] = {'rot': list(rot) if rot else None, 'scale': scale}
    mp.write_text(json.dumps(m, indent=1, ensure_ascii=False), encoding='utf-8')
    for k in [k for k in _MASTER if k[0] == r['id']]: del _MASTER[k]
    return m['fix']


def _import_file(path):
    ext = Path(path).suffix.lower()
    before = set(bpy.data.objects)
    sc = bpy.context.scene; keep = (sc.frame_start, sc.frame_end, sc.render.fps, sc.frame_current)
    if ext in ('.glb', '.gltf'): bpy.ops.import_scene.gltf(filepath=path)
    elif ext == '.fbx': bpy.ops.import_scene.fbx(filepath=path)
    elif ext == '.obj': bpy.ops.wm.obj_import(filepath=path)
    elif ext in ('.usd', '.usdz', '.usdc', '.usda'): bpy.ops.wm.usd_import(filepath=path)
    elif ext == '.stl': bpy.ops.wm.stl_import(filepath=path)
    elif ext == '.ply': bpy.ops.wm.ply_import(filepath=path)
    elif ext == '.blend':
        with bpy.data.libraries.load(path, link=False) as (src, dst): dst.objects = list(src.objects)
        for o in dst.objects:
            if o is not None: bpy.context.collection.objects.link(o)
    else: raise ValueError('CZ ASSET cannot import ' + ext)
    sc.frame_start, sc.frame_end, sc.render.fps = keep[:3]; sc.frame_set(keep[3])
    return [o for o in bpy.data.objects if o not in before]


def _np():
    import numpy as np
    return np


def _bbox(me):
    np = _np()
    n = len(me.vertices)
    if not n: return Vector((0, 0, 0)), Vector((0, 0, 0))
    co = np.empty(n * 3, np.float32); me.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
    return Vector(co.min(0)), Vector(co.max(0))


def _tris(me):
    np = _np()
    lt = np.empty(len(me.polygons), np.int32); me.polygons.foreach_get('loop_total', lt)
    return int((lt - 2).clip(min=0).sum())


def _build_master(r, lod, fixd):
    """Import, bake every part into one mesh in world space (modifiers, poses and instances realised), upright fix,
    origin at the base centre. Returns the master object (not linked to the scene)."""
    t0 = time.time()
    tmp = bpy.data.collections.new('CZA_tmp'); bpy.context.scene.collection.children.link(tmp)
    lc = bpy.context.view_layer.layer_collection.children[tmp.name]; old = bpy.context.view_layer.active_layer_collection
    bpy.context.view_layer.active_layer_collection = lc
    try:
        objs = []
        for p in (r.get('parts') or [r['main']]): objs += _import_file(p)
    finally:
        bpy.context.view_layer.active_layer_collection = old
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    S = set(objs); parts = []
    for o in objs:
        if o.type not in ('MESH', 'CURVE', 'SURFACE', 'META', 'FONT'): continue
        if any(w in o.name.lower() for w in ('collision', 'collider', '_col', 'ucx_')) and o.type == 'MESH' and len(objs) > 1: continue
        ev = o.evaluated_get(dg)
        me = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=True, depsgraph=dg)
        me.transform(o.matrix_world); parts.append(me)
    for inst in dg.object_instances:          # geometry-node / particle / glTF GPU instances (scattered leaves)
        if not inst.is_instance or inst.object.type != 'MESH': continue
        par = inst.parent.original if inst.parent else None
        if par not in S: continue
        me = bpy.data.meshes.new_from_object(inst.object, preserve_all_data_layers=True, depsgraph=dg)
        me.transform(inst.matrix_world.copy()); parts.append(me)
    if not parts: raise ValueError('CZ ASSET no mesh in ' + r['main'])
    for o in objs:
        try: bpy.data.objects.remove(o, do_unlink=True)
        except ReferenceError: pass
    # join: one object per asset (the fastest to draw), material slots kept
    obs = []
    for i, me in enumerate(parts):
        ob = bpy.data.objects.new(f'CZA_part{i}', me); tmp.objects.link(ob); obs.append(ob)
    if len(obs) > 1:
        for o in bpy.context.selected_objects: o.select_set(False)
        for o in obs: o.select_set(True)
        bpy.context.view_layer.objects.active = obs[0]
        bpy.ops.object.join()
    ob = obs[0]; me = ob.data
    fr = (fixd or {}).get('rot')
    if fr: me.transform(Euler([math.radians(a) for a in fr]).to_matrix().to_4x4())
    fs = (fixd or {}).get('scale')
    if fs: me.transform(Matrix.Scale(fs, 4))
    lo, hi = _bbox(me)
    big = max(hi - lo)
    if not fs and (r.get('src') == 'smithsonian' and big > 30 or r.get('src') in REAL_UNITS and big > 1000):
        me.transform(Matrix.Scale(0.001, 4)); lo, hi = lo * 0.001, hi * 0.001       # millimetres (museum scans)
        print(f'CZ ASSET {r["id"]} was in millimetres ({big:.0f}): scaled to metres')
    me.transform(Matrix.Translation(Vector((-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z))))
    if lod and lod < 1.0:
        tri0 = _tris(me)
        dm = ob.modifiers.new('lod', 'DECIMATE'); dm.ratio = lod; dm.use_collapse_triangulate = True
        bpy.context.view_layer.update(); dg = bpy.context.evaluated_depsgraph_get()
        me2 = bpy.data.meshes.new_from_object(ob.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
        ob.modifiers.clear(); old = ob.data; ob.data = me2; bpy.data.meshes.remove(old); me = me2
        print(f'CZ ASSET lod {lod}: {tri0} -> {_tris(me)} tris')
    tmp.objects.unlink(ob); bpy.data.collections.remove(tmp)
    ob.name = 'CZA_' + r['id'].replace(':', '_')[:50]; me.name = ob.name
    lo, hi = _bbox(me)
    ob['cz_dims'] = list(hi - lo); ob['cz_tris'] = _tris(me); ob['cz_id'] = r['id']
    print(f'CZ ASSET import {r["id"]} {time.time() - t0:.1f}s tris {ob["cz_tris"]} dims {tuple(round(x, 3) for x in ob["cz_dims"])}')
    return ob


def _norm_path(r, res, lod, fixd):
    # hashed on the paths RELATIVE to the asset folder (forward slashes): the same cache copied to the Mac keeps its .blends
    rel = lambda p: os.path.relpath(p, r['dir']).replace(os.sep, '/') if p else None
    tag = hashlib.md5(json.dumps([NORM_V, fixd or None, lod or None, rel(r.get('main')), [rel(p) for p in r.get('parts') or []] or None],
                                 sort_keys=True).encode()).hexdigest()[:8]
    return Path(r['dir']) / 'norm' / f'{res}{"_lod" + str(int(lod * 100)) if lod and lod < 1 else ""}_{tag}.blend'


def _master(key, res='2k', lod=None, style=None):
    """(collection, object, resolved) of the normalised asset: memory, else the cached .blend, else import + cache."""
    r = resolve(key, 'model', res, style)
    k = (r['id'], res, lod)
    if k in _MASTER:
        try:
            c, o = _MASTER[k]; c.name; o.name
            return c, o, r
        except ReferenceError: del _MASTER[k]
    m = _meta(r); fixd = m.get('fix')
    np_ = _norm_path(r, res, lod, fixd); cname = 'CZA:' + r['id'][:40] + '@' + res + (f'~{lod}' if lod else '')
    t0 = time.time()
    if np_.exists():
        with bpy.data.libraries.load(str(np_), link=False) as (src, dst): dst.collections = [c for c in src.collections if c.startswith('CZA:')][:1]
        c = dst.collections[0]; o = c.objects[0]; how = 'cache'
    else:
        o = _build_master(r, lod, fixd)
        c = bpy.data.collections.new(cname); c.objects.link(o)
        np_.parent.mkdir(parents=True, exist_ok=True)
        tmpf = np_.with_name(np_.name + f'.{os.getpid()}.tmp')
        bpy.data.libraries.write(str(tmpf), {c}, path_remap='RELATIVE_ALL', fake_user=True, compress=False)
        os.replace(tmpf, np_); how = 'import+cached'
        stem = np_.name.rsplit('_', 1)[0] + '_'           # older caches of this res / lod (other version or fix): gone
        for old in np_.parent.glob(stem + '*.blend'):
            if old != np_ and old.name[len(stem):-6].isalnum() and len(old.name[len(stem):-6]) == 8:
                try: old.unlink()
                except OSError: pass
    c.name = cname
    _MASTER[k] = (c, o)
    dt = time.time() - t0; STATS['calls'] += 1; STATS['secs'] += dt
    print(f'CZ ASSET {r["id"]}@{res} {how} {dt:.2f}s tris {o.get("cz_tris")} dims {tuple(round(x, 2) for x in o.get("cz_dims", (0, 0, 0)))} ({r.get("license")})')
    return c, o, r


# ---------------------------------------------------------------- looks
def _principled(m):
    return next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None) if m and m.use_nodes else None


def look_material(mat, look='orig', tint=None):
    """orig: the asset's own material (tint multiplies its colour). tone: the same textures calmed toward the mega
    palette (a little less saturation, no mirror-gloss: roughness >= 0.3). clay: its shape only - one matte colour
    (tint, default warm grey), keeping its normal map and alpha cut-outs (leaves stay leaves)."""
    if look == 'orig' and not tint: return mat
    key = (mat.name if mat else None, look, tuple(tint) if isinstance(tint, (list, tuple)) else tint)
    if key in _LOOKMAT:
        try: _LOOKMAT[key].name; return _LOOKMAT[key]
        except ReferenceError: pass
    if mat is None: mat = bpy.data.materials.new('cza_none'); mat.use_nodes = True
    m = mat.copy(); m.name = f'{mat.name}~{look}' + (f'~{tint}' if tint else '')
    p = _principled(m)
    if p is None: _LOOKMAT[key] = m; return m
    nt = m.node_tree; bc = p.inputs['Base Color']
    src = bc.links[0].from_socket if bc.links else None
    if look == 'clay':
        for l in list(bc.links): nt.links.remove(l)
        bc.default_value = cz.col(tint or '#b9b2a6')
        for nm in ('Metallic', 'Roughness'):
            for l in list(p.inputs[nm].links): nt.links.remove(l)
        p.inputs['Metallic'].default_value = 0.0; p.inputs['Roughness'].default_value = 0.62
    else:
        if look == 'tone':
            hs = nt.nodes.new('ShaderNodeHueSaturation'); hs.inputs['Saturation'].default_value = 0.85; hs.inputs['Value'].default_value = 0.97
            if src: nt.links.new(src, hs.inputs['Color'])
            else: hs.inputs['Color'].default_value = bc.default_value
            src = hs.outputs[0]
            rg = p.inputs['Roughness']
            if rg.links:
                mx = nt.nodes.new('ShaderNodeMath'); mx.operation = 'MAXIMUM'; mx.inputs[1].default_value = 0.3
                nt.links.new(rg.links[0].from_socket, mx.inputs[0]); nt.links.new(mx.outputs[0], rg)
            else: rg.default_value = max(0.3, rg.default_value)
        if tint:
            mu = nt.nodes.new('ShaderNodeMix'); mu.data_type = 'RGBA'; mu.blend_type = 'MULTIPLY'; mu.inputs[0].default_value = 1.0
            if src: nt.links.new(src, mu.inputs[6])
            else: mu.inputs[6].default_value = bc.default_value
            mu.inputs[7].default_value = cz.col(tint); src = mu.outputs[2]
        if src: nt.links.new(src, bc)
    _LOOKMAT[key] = m
    return m


def _look_master(c, o, look, tint, key):
    """For instances: a collection whose object carries the look's materials (one per asset + look)."""
    if look == 'orig' and not tint: return c
    k = key + (look, str(tint))
    if k in _MASTER:
        try: _MASTER[k][0].name; return _MASTER[k][0]
        except ReferenceError: pass
    c2 = bpy.data.collections.new(c.name + f'~{look}'); o2 = bpy.data.objects.new(o.name + f'~{look}', o.data); c2.objects.link(o2)
    _set_looks(o2, look, tint)
    _MASTER[k] = (c2, o2)
    return c2


def _set_looks(ob, look, tint):
    if look == 'orig' and not tint: return
    for s in ob.material_slots:
        base = s.material
        s.link = 'OBJECT'; s.material = look_material(base, look, tint)


# ---------------------------------------------------------------- placing
def _hint(r, dims):
    if r.get('src') in REAL_UNITS: return None
    e = X.get(r['id']) or {}
    ws = set(X.words(r.get('title', '')) + [t for t in e.get('tags', [])])
    for keys, meas, val in SIZE_HINT:
        if any(k in ws for k in keys): return meas, val
    print(f'CZ ASSET WARN {r["id"]} has no real units and no size: placed {DEFAULT_SIZE} m - pass size= / height= / width=')
    return 'size', DEFAULT_SIZE


def _scale_for(dims, size=None, height=None, width=None):
    if height: return height / max(dims[2], 1e-6)
    if width: return width / max(dims[0], dims[1], 1e-6)
    if size: return size / max(max(dims), 1e-6)
    return 1.0


def model(key_or_query, size=None, height=None, width=None, base=(0, 0, 0), rot=0, look='orig', tint=None,
          res='2k', lod=None, instance=False, name=None, parent=None, style=None, shadow=True):
    """Place a free asset. key_or_query: an index id ('ph:tree_small_02'), a model file path, or words ('pine tree').
    size= its largest dimension, height= its Z height, width= its longest footprint side (a car's length), in metres;
    none given: its real size (or the SIZE_HINT size for low-poly sources without units). base: where its base centre
    sits. rot: degrees about Z (or an (x, y, z) tuple). look: 'orig' | 'tone' | 'clay' (+ tint '#rrggbb').
    res: texture resolution 1k / 2k / 4k / 8k. lod: 0..1 decimate ratio for far copies (cached too).
    instance=True: a collection instance (cheapest; the mesh is not a child: contact checks read cz_dims instead).
    Returns the parent empty (custom props cz_id, cz_dims = its placed size, cz_tris)."""
    t0 = time.time()
    c, o, r = _master(key_or_query, res, lod, style)
    dims = list(o.get('cz_dims', (1, 1, 1)))
    if not (size or height or width):
        h = _hint(r, dims)
        if h: size, height, width = {'size': (h[1], None, None), 'height': (None, h[1], None), 'width': (None, None, h[1])}[h[0]]
    s = _scale_for(dims, size, height, width)
    nm = name or r['id'].split(':', 1)[-1].split('/')[-1][:40]
    root = bpy.data.objects.new(nm, None); root.empty_display_size = max(dims) * 0.5
    (parent.users_collection[0] if parent is not None and parent.users_collection else bpy.context.scene.collection).objects.link(root)
    if parent is not None: root.parent = parent
    root.location = base
    root.rotation_euler = [math.radians(a) for a in rot] if isinstance(rot, (list, tuple)) else (0, 0, math.radians(rot))
    root.scale = (s, s, s)
    if instance:
        root.instance_type = 'COLLECTION'; root.instance_collection = _look_master(c, o, look, tint, (r['id'], res, lod))
    else:
        ch = bpy.data.objects.new(nm + '_mesh', o.data)       # linked duplicate: the mesh is shared, not copied
        root.users_collection[0].objects.link(ch); ch.parent = root
        _set_looks(ch, look, tint)
        if not shadow:
            try: ch.visible_shadow = False
            except Exception: pass
    root['cz_id'] = r['id']; root['cz_dims'] = [d * s for d in dims]; root['cz_tris'] = o.get('cz_tris', 0)
    STATS['place_secs'] = STATS.get('place_secs', 0.0) + (time.time() - t0)
    return root


def scatter(key_or_query, n, area, seed=1, z=0.0, size=None, height=None, width=None, rot=True, avoid=None,
            instance=True, **kw):
    """n copies over area ((x0, y0), (x1, y1)); size / height / width may be (lo, hi) ranges; z a number or f(x, y);
    avoid(x, y) -> True skips a spot. Instanced by default (grass, trees, rocks: thousands cost little)."""
    rnd = random.Random(seed); out = []; tries = 0
    pick = lambda v: rnd.uniform(*v) if isinstance(v, (tuple, list)) else v
    while len(out) < n and tries < n * 20:
        tries += 1
        x, y = rnd.uniform(area[0][0], area[1][0]), rnd.uniform(area[0][1], area[1][1])
        if avoid and avoid(x, y): continue
        zz = z(x, y) if callable(z) else z
        out.append(model(key_or_query, size=pick(size), height=pick(height), width=pick(width), base=(x, y, zz),
                         rot=rnd.uniform(0, 360) if rot is True else (rot or 0), instance=instance,
                         name=f'{str(key_or_query)[:20]}_{len(out)}', **kw))
    return out


# ---------------------------------------------------------------- textures + HDRIs
def texture_set(id_or_query, res='2k'):
    """{'color', 'normal' (OpenGL), 'rough', 'ao', 'disp', 'metal', 'opacity', 'arm': path} of a PBR texture
    (only the maps the source has), plus 'size_m' (its real tile size in metres when the source knows it)."""
    r = resolve(id_or_query, 'texture', res)
    out = dict(r.get('maps') or {})
    e = X.get(r['id']) or {}
    if e.get('dims_m'): out['size_m'] = e['dims_m'][0]
    return out


def _tex(nt, path, vec, colorspace, box):
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = cz.image(path, colorspace)
    if box: t.projection = 'BOX'; t.projection_blend = 0.25
    nt.links.new(vec, t.inputs[0])
    return t


def pbr_from(id_or_query, scale=None, res='2k', coord='Object', box=None, disp=0.3, tint=None, name=None, normal=1.0, ao=0.8,
             rough_add=0.0):
    """A Principled material from a free PBR texture set. scale: tiles per metre (None = the texture's real size, else
    a 2 m tile). coord 'Object' (box-projected: works on any mesh, no UVs needed) or 'UV'. disp: height map as bump
    strength (0 = off). tint multiplies the colour. ao: how strongly the AO map darkens the colour.
    One material per texture + settings (a second call with another tint / scale gets its own); name= is the cache key."""
    ts = texture_set(id_or_query, res)
    opts = (scale, coord, box, disp, str(tint) if tint else None, normal, ao, rough_add)
    tag = '' if opts == (None, 'Object', None, 0.3, None, 1.0, 0.8, 0.0) else '~' + hashlib.md5(repr(opts).encode()).hexdigest()[:6]
    nm = name or ('pbr_' + Path(ts['color']).stem[:40] + tag)
    m = bpy.data.materials.get(nm)
    if m: return m
    m = bpy.data.materials.new(nm); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); p = nt.nodes.new('ShaderNodeBsdfPrincipled')
    nt.links.new(p.outputs[0], out.inputs[0])
    sc = scale if scale else 1.0 / (ts.get('size_m') or 2.0)
    box = (coord == 'Object') if box is None else box
    tc = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (sc, sc, sc)
    nt.links.new(tc.outputs['UV' if coord == 'UV' else coord], mp.inputs[0]); vec = mp.outputs[0]
    col = _tex(nt, ts['color'], vec, 'sRGB', box).outputs[0]
    if ts.get('ao') and ao:
        a = _tex(nt, ts['ao'], vec, 'Non-Color', box)
        mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'; mx.inputs[0].default_value = ao
        nt.links.new(col, mx.inputs[6]); nt.links.new(a.outputs[0], mx.inputs[7]); col = mx.outputs[2]
    if tint:
        mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'; mx.inputs[0].default_value = 1.0
        nt.links.new(col, mx.inputs[6]); mx.inputs[7].default_value = cz.col(tint); col = mx.outputs[2]
    nt.links.new(col, p.inputs['Base Color'])
    if ts.get('rough') or ts.get('arm'):
        rt = _tex(nt, ts.get('rough') or ts['arm'], vec, 'Non-Color', box)
        rs = rt.outputs[0]
        if not ts.get('rough'):
            sp = nt.nodes.new('ShaderNodeSeparateColor'); nt.links.new(rt.outputs[0], sp.inputs[0]); rs = sp.outputs[1]
            if not ts.get('metal'): nt.links.new(sp.outputs[2], p.inputs['Metallic'])
        if rough_add:
            ad = nt.nodes.new('ShaderNodeMath'); ad.operation = 'ADD'; ad.use_clamp = True; ad.inputs[1].default_value = rough_add
            nt.links.new(rs, ad.inputs[0]); rs = ad.outputs[0]
        nt.links.new(rs, p.inputs['Roughness'])
    if ts.get('metal'):
        nt.links.new(_tex(nt, ts['metal'], vec, 'Non-Color', box).outputs[0], p.inputs['Metallic'])
    nsock = None
    if ts.get('normal') and normal:
        nm_ = nt.nodes.new('ShaderNodeNormalMap'); nm_.inputs['Strength'].default_value = normal
        nt.links.new(_tex(nt, ts['normal'], vec, 'Non-Color', box).outputs[0], nm_.inputs['Color']); nsock = nm_.outputs[0]
    if ts.get('disp') and disp:
        b = nt.nodes.new('ShaderNodeBump'); b.inputs['Strength'].default_value = disp; b.inputs['Distance'].default_value = 0.02
        nt.links.new(_tex(nt, ts['disp'], vec, 'Non-Color', box).outputs[0], b.inputs['Height'])
        if nsock: nt.links.new(nsock, b.inputs['Normal'])
        nsock = b.outputs[0]
    if nsock: nt.links.new(nsock, p.inputs['Normal'])
    if ts.get('opacity'):
        nt.links.new(_tex(nt, ts['opacity'], vec, 'Non-Color', box).outputs[0], p.inputs['Alpha'])
        try: m.surface_render_method = 'DITHERED'
        except Exception: pass
    return m


def hdri(id_or_query, res='2k'):
    """Path of a free HDRI (.hdr / .exr) in the cache."""
    return resolve(id_or_query, 'hdri', res)['main']


def world(id_or_query, strength=1.0, rot=0.0, res='2k', camera_strength=None, sun=True):
    """Light (and show) the scene with an HDRI. rot: degrees about Z. camera_strength: what the camera sees of it
    (None = the same). sun=False hides mega's sun lamp (the HDRI's own sun lights the scene)."""
    p = hdri(id_or_query, res)
    sc = bpy.context.scene; w = sc.world or bpy.data.worlds.new('world'); sc.world = w; w.use_nodes = True
    nt = w.node_tree; nt.nodes.clear()
    tc = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Rotation'].default_value = (0, 0, math.radians(rot))
    nt.links.new(tc.outputs['Generated'], mp.inputs[0])
    env = nt.nodes.new('ShaderNodeTexEnvironment'); env.image = bpy.data.images.load(p, check_existing=True)
    nt.links.new(mp.outputs[0], env.inputs[0])
    bg = nt.nodes.new('ShaderNodeBackground'); bg.inputs[1].default_value = strength; nt.links.new(env.outputs[0], bg.inputs[0])
    o = nt.nodes.new('ShaderNodeOutputWorld')
    if camera_strength is not None and camera_strength != strength:
        bc = nt.nodes.new('ShaderNodeBackground'); bc.inputs[1].default_value = camera_strength; nt.links.new(env.outputs[0], bc.inputs[0])
        lp = nt.nodes.new('ShaderNodeLightPath'); mx = nt.nodes.new('ShaderNodeMixShader')
        nt.links.new(lp.outputs['Is Camera Ray'], mx.inputs[0]); nt.links.new(bg.outputs[0], mx.inputs[1]); nt.links.new(bc.outputs[0], mx.inputs[2])
        nt.links.new(mx.outputs[0], o.inputs[0])
    else: nt.links.new(bg.outputs[0], o.inputs[0])
    if not sun:
        for ob in bpy.data.objects:
            if ob.type == 'LIGHT' and ob.data.type == 'SUN': ob.hide_render = True
        d = bpy.data.objects.get('sun_disc')
        if d: d.hide_render = True
    return p
