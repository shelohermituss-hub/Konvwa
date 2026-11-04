# scenepass.py - the scene optimizer's SCENE PASS (2026-10-30, docs/SCENE_OPTIMIZER.md). gruss: "for many props assets
# geometry nodes can be used for more efficiency like grass i think or things that it makes sense for and we need this
# scene optimizer permanently built into the actual style we are building so whatever vide people wanna make in any style
# when it's done the last step is hyper scene optimisation for their specific system cutting render times and delivering
# high fidelity video."
# Three changes to a BUILT scene, each a render-tuner knob (engine/tune.py KNOBS), so the probe, the per-shot check in
# the render's own Blender (tune.shot_plan) and render_plan.json judge them like every other setting: rendered on real
# frames, compared with the AS-BUILT frames (tunemetric.BAR), kept only when invisible and faster.
#   gn(1)        every static library placement (A.model / A.scatter: collection-instance empties, or an empty + a linked
#                duplicate mesh) becomes a point of ONE Geometry Nodes instancer per source asset (Instance on Points,
#                realize off): the exact world matrix per point (a 4x4 attribute), the same collection / materials /
#                ray visibility. The empties are hidden, not deleted (the knob undoes itself). Verified after building:
#                every evaluated instance's matrix must equal its empty's, else that asset stays as it was.
#   lod(k)       per point, its largest size on screen over the shot's camera path (sampled every few frames): the
#                smallest decimated tier (TIERS: 50 / 25 / 10 % of the placed mesh) that still has >= k triangles per
#                pixel of its screen area. Full detail only where the camera gets close. Tier meshes are cached per
#                machine (<asset cache>/lod/). k=1 aggressive, k=4 safe; 0 = off.
#   join(1)      static meshes that share a world matrix (object-space textures stay put), a collection, ray visibility
#                and data-linked materials, in the same 8 m cell, become one object per group (copies; the originals
#                are hidden). Never: animated (self or any parent: keys, drivers, constraints, NLA, shape keys),
#                referenced (parents, constraints, drivers, modifiers, node trees, the camera's focus), library roots,
#                text, materials with Generated / Object Info coordinates, held props, counters, ob['cz_keep'].
# D.scatter (pebbles, gravel, grass, debris) is one GN instancer already (detail.py): untouched.
# REPORT: what the last change did (counts before / after, tiers, seconds) -> the probe result and render_plan.json.
import bpy, json, math, os, sys, time, hashlib
from mathutils import Matrix, Vector

try:
    import numpy as np
except Exception:
    if os.environ.get('CZ_PYLIB') and os.environ['CZ_PYLIB'] not in sys.path: sys.path.append(os.environ['CZ_PYLIB'])
    import numpy as np

TIERS = (0.5, 0.25, 0.1)          # decimate ratios of the placed mesh (tier 0 = the mesh itself)
MIN_TRIS = 3000                   # meshes lighter than this are never decimated (no gain, shape loss)
CELL = 8.0                        # join cells (m): a join never spans the scene (shadow-tile culling stays fine-grained)
TOL = 1e-3                        # matrix check after the GN build
RANGE = [None]                    # (f0, f1) of the shot (tune.RANGE is passed in by tune.py)
REPORT = {}
_ST = {'gn': None, 'lod': 0.0, 'join': None}
_VIS = ('visible_camera', 'visible_diffuse', 'visible_glossy', 'visible_transmission', 'visible_volume_scatter', 'visible_shadow')


def say(s): print('CZ SCENE ' + s, flush=True)


# ---------------------------------------------------------------- what may change
def _animated(o):
    p = o
    while p is not None:
        ad = p.animation_data
        if ad and (ad.action or len(ad.drivers) or len(ad.nla_tracks)): return True
        if len(p.constraints) or p.rigid_body or p.rigid_body_constraint: return True
        d = getattr(p, 'data', None)
        if d is not None and getattr(d, 'animation_data', None) and (d.animation_data.action or len(d.animation_data.drivers)): return True
        if getattr(d, 'shape_keys', None): return True
        if p.type == 'ARMATURE': return True
        p = p.parent
    return False


def _protected():
    """Object names other engine code reaches by name at render time: number counters (mega.count_text), held props and
    figures (hands.HOLDS, human / char ALL)."""
    out = set()
    m = sys.modules.get('mega')
    for d in getattr(m, '_COUNTERS', []) or []:
        try: out.add(d['obj'])
        except Exception: pass
    for mn in ('hands', 'human', 'char'):
        mod = sys.modules.get(mn)
        for reg in ('HOLDS', 'ALL'):
            for it in (getattr(mod, reg, None) or []):
                try:
                    for v in (it.values() if isinstance(it, dict) else (vars(it).values() if hasattr(it, '__dict__') else [it])):
                        for x in (v if isinstance(v, (list, tuple)) else [v]):
                            if isinstance(x, bpy.types.Object): out.add(x.name)
                            elif isinstance(x, str): out.add(x)
                except Exception: pass             # (a removed object: nothing to protect)
    return out


def _users(objs):
    """{object: set of the IDs that use it, apart from collections and scenes}"""
    try: um = bpy.data.user_map(subset=set(objs))
    except Exception: return {o: {None} for o in objs}
    return {o: {u for u in um.get(o, ()) if not isinstance(u, (bpy.types.Collection, bpy.types.Scene))} for o in objs}


def _flags(o): return tuple(bool(getattr(o, a, True)) for a in _VIS) + (bool(getattr(o, 'is_holdout', False)),)


def _put_flags(o, fl):
    for a, v in zip(_VIS, fl):
        try: setattr(o, a, v)
        except Exception: pass


# ---------------------------------------------------------------- GN instancing
def _source(o, users, prot):
    """(key, collection, world matrix) of a static library placement, else None. key: what the instancer shares."""
    if o.hide_render or o.name in prot or o.get('cz_sp') or o.get('cz_keep') or _animated(o): return None
    if o.instance_type == 'COLLECTION' and o.instance_collection is not None and o.get('cz_id'):
        if users.get(o) or o.children: return None
        c = o.instance_collection
        if not len(c.all_objects): return None
        if any(_animated(x) for x in c.all_objects): return None
        return ('col', c.name, _flags(o), o.users_collection[0].name if o.users_collection else ''), c, o.matrix_world.copy()
    if o.instance_type == 'NONE' and o.type == 'EMPTY' and o.get('cz_id') and len(o.children) == 1:
        ch = o.children[0]
        if ch.type != 'MESH' or ch.hide_render or ch.children or ch.modifiers or ch.name in prot or _animated(ch): return None
        if users.get(o, set()) - {ch} or users.get(ch): return None
        slots = tuple((s.link, s.material.name if s.material else '') for s in ch.material_slots)
        return ('dup', ch.data.name, slots, _flags(ch), ch.users_collection[0].name if ch.users_collection else ''), ch, ch.matrix_world.copy()
    return None


def _dup_collection(ch, key):
    """A collection holding one copy of a linked-duplicate child at the origin (same mesh, same object materials)."""
    name = 'CZSP:' + hashlib.md5(repr(key).encode()).hexdigest()[:8] + ':' + ch.data.name[:40]
    c = bpy.data.collections.get(name)
    if c: return c
    c = bpy.data.collections.new(name)
    cp = ch.copy(); cp.parent = None; cp.matrix_world = Matrix.Identity(4); cp.animation_data_clear()
    for k in list(cp.keys()):
        if k.startswith('cz_'): del cp[k]
    c.objects.link(cp)
    return c


def _attr_matrix_write(at, mats):
    """mats: (n, 4, 4) row-major world matrices -> a FLOAT4X4 attribute (Blender stores matrices column-major)."""
    at.data.foreach_set('value', np.ascontiguousarray(np.transpose(mats, (0, 2, 1))).astype(np.float32).ravel())


def _node(nt, typ, **kw):
    n = nt.nodes.new(typ)
    for k, v in kw.items(): setattr(n, k, v)
    return n


def _group(name, cols):
    """Instance on Points per collection (points whose cz_pick == its index), joined, each instance given its point's
    exact matrix (Set Instance Transform from the cz_m attribute). Collections are set in the nodes (a collection socket
    on the modifier can't be set from Python in 5.2)."""
    ng = bpy.data.node_groups.get(name)
    if ng: bpy.data.node_groups.remove(ng)
    ng = bpy.data.node_groups.new(name, 'GeometryNodeTree')
    ng.interface.new_socket('Geometry', in_out='INPUT', socket_type='NodeSocketGeometry')
    ng.interface.new_socket('Geometry', in_out='OUTPUT', socket_type='NodeSocketGeometry')
    L = ng.links.new
    gi = _node(ng, 'NodeGroupInput'); go = _node(ng, 'NodeGroupOutput')
    pk = _node(ng, 'GeometryNodeInputNamedAttribute', data_type='INT'); pk.inputs['Name'].default_value = 'cz_pick'
    mx = _node(ng, 'GeometryNodeInputNamedAttribute', data_type='FLOAT4X4'); mx.inputs['Name'].default_value = 'cz_m'
    jn = _node(ng, 'GeometryNodeJoinGeometry')
    for i, c in enumerate(cols):
        ci = _node(ng, 'GeometryNodeCollectionInfo'); ci.transform_space = 'ORIGINAL'
        ci.inputs['Collection'].default_value = c
        ci.inputs['Separate Children'].default_value = False; ci.inputs['Reset Children'].default_value = False
        cm = _node(ng, 'FunctionNodeCompare', data_type='INT', operation='EQUAL')
        ia = [s for s in cm.inputs if s.type == 'INT']
        L(pk.outputs['Attribute'], ia[0]); ia[1].default_value = i
        ip = _node(ng, 'GeometryNodeInstanceOnPoints')
        L(gi.outputs[0], ip.inputs['Points']); L(cm.outputs[0], ip.inputs['Selection']); L(ci.outputs[0], ip.inputs['Instance'])
        L(ip.outputs['Instances'], jn.inputs[0])
    st = _node(ng, 'GeometryNodeSetInstanceTransform')
    L(jn.outputs[0], st.inputs['Instances']); L(mx.outputs['Attribute'], st.inputs['Transform'])
    L(st.outputs[0], go.inputs[0])
    return ng


class Inst:
    """One GN instancer: its points (world matrices), the collections it picks from (cols[0] = the source), the tier of
    every point and the hidden placements it replaces."""
    def __init__(self, key, src, mats, placed, cname):
        self.key, self.src, self.placed = key, src, placed
        self.mats = np.array([np.array(m) for m in mats], np.float64)          # (n, 4, 4)
        self.cols = [src]; self.tier = np.zeros(len(mats), np.int32); self.far = np.zeros(len(mats), np.int32)
        self.twins = []            # far_casters: the no-shadow twins of cols, same order
        nm = 'cz_sp_' + (src.name.split(':', 1)[-1] if src.name.startswith('CZA') else src.name)[:44]
        me = bpy.data.meshes.new(nm); n = len(mats)
        me.vertices.add(n); me.vertices.foreach_set('co', self.mats[:, :3, 3].astype(np.float32).ravel())
        me.attributes.new('cz_pick', 'INT', 'POINT'); _attr_matrix_write(me.attributes.new('cz_m', 'FLOAT4X4', 'POINT'), self.mats)
        me.update()
        self.ob = ob = bpy.data.objects.new(nm, me)
        (bpy.data.collections.get(cname) if cname and bpy.data.collections.get(cname) else bpy.context.scene.collection).objects.link(ob)
        fl = key[2] if key[0] == 'col' else None
        if fl: _put_flags(ob, fl)
        ob['cz_sp'] = 1; ob['cz_nocontact'] = True; ob['cz_sp_src'] = src.name
        first = placed[0]
        for k in ('cz_id',):
            if first.get(k) is not None: ob[k] = first[k]
        self.md = ob.modifiers.new('cz_scene_instances', 'NODES')
        self.rebuild()

    def rebuild(self):
        cols = self.cols + (self.twins if self.twins else [])
        self.md.node_group = _group('cz_sp_' + self.ob.name, cols)
        pick = self.tier + (len(self.cols) * self.far if self.twins else 0)
        self.ob.data.attributes['cz_pick'].data.foreach_set('value', pick.astype(np.int32))
        self.ob.data.update()
        self.ob['cz_tris'] = int(sum(self.tris(t) * int((self.tier == t).sum()) for t in range(len(self.cols))))

    def tris(self, t):
        c = self.cols[t]
        return sum(_mesh_tris(o.data) for o in c.all_objects if o.type == 'MESH' and not o.get('cz_shadow_proxy'))

    def remove(self):
        me = self.ob.data; ng = self.md.node_group
        bpy.data.objects.remove(self.ob, do_unlink=True)
        try: bpy.data.meshes.remove(me)
        except Exception: pass
        try: bpy.data.node_groups.remove(ng)
        except Exception: pass
        for p in self.placed:
            p.hide_render = False
            for ch in p.children:
                if ch.get('cz_sp_hid'): ch.hide_render = False; del ch['cz_sp_hid']


def _mesh_tris(me):
    lt = np.empty(len(me.polygons), np.int32); me.polygons.foreach_get('loop_total', lt)
    return int((lt - 2).clip(min=0).sum())


INST = []


def _verify(inst):
    """Every evaluated instance of the instancer must sit exactly where its placement did (count + matrices)."""
    dg = bpy.context.evaluated_depsgraph_get(); dg.update()
    got = []
    for d in dg.object_instances:
        if d.is_instance and d.parent is not None and d.parent.original == inst.ob:
            got.append(np.array(d.matrix_world))
    src_objs = list(inst.src.all_objects)          # (the tuner's shadow proxies live in the collection too: instanced alike)
    want = []
    for m in inst.mats:
        for o in src_objs: want.append(m @ np.array(o.matrix_world))
    if len(got) != len(want): return f'{len(got)} instances evaluated, {len(want)} placed'
    G, W = np.array(got), np.array(want)
    used = np.zeros(len(W), bool); worst = 0.0
    for g in G:
        d = np.linalg.norm(W[:, :3, 3] - g[:3, 3], axis=1); d[used] = np.inf; j = int(np.argmin(d)); used[j] = True
        worst = max(worst, float(np.abs(W[j] - g).max()))
    return None if worst < TOL * max(1.0, float(np.abs(W[:, :3, 3]).max()) / 100) else f'matrix differs by {worst:.4f}'


def gn_on():
    t0 = time.time(); sc = bpy.context.scene; prot = _protected()
    REPORT['before'] = inventory()
    cand = [o for o in sc.objects if o.get('cz_id') and not o.get('cz_sp') and not o.hide_render]
    users = _users(cand + [c for o in cand for c in o.children])
    groups = {}
    for o in cand:
        s = _source(o, users, prot)
        if s is None: continue
        key, src, m = s
        g = groups.setdefault(key, [None, [], [], key[-1]])
        if key[0] == 'dup': g[0] = g[0] or _dup_collection(src, key)
        else: g[0] = src
        g[1].append(m); g[2].append(o)
    made, skipped, placements = [], [], 0
    for key, (src, mats, placed, cname) in groups.items():
        inst = Inst(key, src, mats, placed, cname)
        for p in placed:
            p.hide_render = True
            for ch in p.children:
                if not ch.hide_render: ch.hide_render = True; ch['cz_sp_hid'] = 1
        err = _verify(inst)
        if err:
            inst.remove(); skipped.append(f'{src.name}: {err}'); continue
        made.append(inst); placements += len(placed)
    INST[:] = made; _ST['gn'] = True
    REPORT['gn'] = dict(placements=placements, instancers=len(made), assets=[i.src.name for i in made][:40], skipped=skipped[:10],
                        secs=round(time.time() - t0, 2), after=inventory())
    say(f'gn: {placements} library placements -> {len(made)} GN instancers ({time.time() - t0:.2f} s)' + (f'; kept as built: {skipped[:3]}' if skipped else ''))
    return len(made)


def gn_off():
    lod_off()
    for i in INST: i.remove()
    INST[:] = []; _ST['gn'] = None


# ---------------------------------------------------------------- LOD by screen size
def _cam_samples(step=None):
    """(world->camera 4x4, focal length in pixels, near) per sampled frame of the shot."""
    sc = bpy.context.scene; cam = sc.camera
    if cam is None: return []
    f0, f1 = RANGE[0] or (sc.frame_start, sc.frame_end)
    n = max(2, min(60, (f1 - f0) // (step or 4) + 1))
    fr = sorted({int(round(f0 + (f1 - f0) * i / (n - 1))) for i in range(n)})
    keep = sc.frame_current; out = []
    rx = sc.render.resolution_x * sc.render.resolution_percentage / 100; ry = sc.render.resolution_y * sc.render.resolution_percentage / 100
    for f in fr:
        sc.frame_set(f); cd = cam.data
        fit = cd.sensor_fit
        if fit == 'AUTO': fpx = cd.lens / cd.sensor_width * max(rx, ry)
        elif fit == 'HORIZONTAL': fpx = cd.lens / cd.sensor_width * rx
        else: fpx = cd.lens / cd.sensor_height * ry
        if cd.type != 'PERSP': fpx = max(rx, ry) / max(cd.ortho_scale, 1e-3)
        out.append((np.array(cam.matrix_world.inverted()), fpx, max(cd.clip_start, 1e-3), cd.type == 'PERSP'))
    sc.frame_set(keep)
    return out


def _bounds(c):
    """(local centre, radius) of a collection's meshes at the origin."""
    P = []
    for o in c.all_objects:
        if o.type != 'MESH' or o.get('cz_shadow_proxy'): continue
        mw = np.array(o.matrix_world)
        bb = np.array([list(v) for v in o.bound_box] or [[0, 0, 0]], np.float64)
        P.append(bb @ mw[:3, :3].T + mw[:3, 3])
    if not P: return np.zeros(3), 0.0
    P = np.concatenate(P); lo, hi = P.min(0), P.max(0)
    return (lo + hi) / 2, float(np.linalg.norm(hi - lo) / 2)


def screen_px(inst, cams):
    """Largest projected diameter (pixels) of every point's bounding sphere over the camera samples. Off-screen and
    behind the camera: as if seen at that distance, halved (only its shadow reaches the frame, shadow maps are coarser)."""
    c, r = _bounds(inst.src)
    if r <= 0 or not cams: return np.full(len(inst.mats), 1e9)
    C = inst.mats[:, :3, :3] @ c + inst.mats[:, :3, 3]
    R = r * np.abs(np.linalg.det(inst.mats[:, :3, :3])) ** (1 / 3)
    best = np.zeros(len(C))
    rs = bpy.context.scene.render; pc = rs.resolution_percentage / 100
    for W, fpx, near, persp in cams:
        Q = C @ W[:3, :3].T + W[:3, 3]; z = -Q[:, 2]; d = np.linalg.norm(Q, axis=1)
        if not persp:
            best = np.maximum(best, 2 * R * fpx); continue
        inside = d <= R * 1.05
        front = z > near
        sx, sy = np.abs(Q[:, 0]) - R, np.abs(Q[:, 1]) - R
        # in the frame (its sphere touches the frame + a 15 % margin): the frame's half size per metre of depth
        hw = rs.resolution_x * pc / 2 / fpx * 1.15; hh = rs.resolution_y * pc / 2 / fpx * 1.15
        vis = front & (sx < z * hw) & (sy < z * hh)
        s = np.where(vis, 2 * R * fpx / np.maximum(z, R), 0.5 * 2 * R * fpx / np.maximum(d, R))
        s = np.where(inside, 1e9, s)
        best = np.maximum(best, s)
    return best


def _lod_cache_dir():
    if os.environ.get('CZ_LOD_CACHE'):
        os.makedirs(os.environ['CZ_LOD_CACHE'], exist_ok=True); return os.environ['CZ_LOD_CACHE']
    try:
        sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'tools'))
        import asset_index as X
        d = os.path.join(str(X.cache_root()), 'lod')
    except Exception:
        d = os.path.join(os.path.expanduser('~'), '.cache', 'creatorize', 'lod')
    os.makedirs(d, exist_ok=True); return d


def _decimated(ob, ratio):
    """A decimated copy of ob's mesh (materials in the same slots), cached per machine by the mesh's content."""
    me = ob.data; n = len(me.vertices)
    co = np.empty(n * 3, np.float32); me.vertices.foreach_get('co', co)
    h = hashlib.sha1(co[:: max(1, len(co) // 4096)].tobytes() + f'{n}|{len(me.polygons)}|{ratio}|v1'.encode()).hexdigest()[:16]
    path = os.path.join(_lod_cache_dir(), f'{h}.blend'); mname = f'czlod_{h}'
    m2 = bpy.data.meshes.get(mname)
    if m2 is None and os.path.exists(path):
        try:
            with bpy.data.libraries.load(path, link=False) as (src, dst): dst.meshes = [mname] if mname in src.meshes else []
            m2 = dst.meshes[0] if dst.meshes else None
        except Exception as e: say(f'lod cache read {path}: {e}'); m2 = None
    how = 'cache'
    if m2 is None:
        how = 'decimate'
        tmp = bpy.data.objects.new('czlod_tmp', me); bpy.context.scene.collection.objects.link(tmp)
        dm = tmp.modifiers.new('lod', 'DECIMATE'); dm.ratio = ratio; dm.use_collapse_triangulate = True
        dg = bpy.context.evaluated_depsgraph_get(); dg.update()
        m2 = bpy.data.meshes.new_from_object(tmp.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
        bpy.data.objects.remove(tmp, do_unlink=True)
        m2.name = mname
        mats = list(m2.materials); m2.materials.clear()              # (the cache holds geometry only: no duplicate textures)
        try:
            tmpf = path + f'.{os.getpid()}.tmp'
            bpy.data.libraries.write(tmpf, {m2}, fake_user=True, compress=False); os.replace(tmpf, path)
        except Exception as e: say(f'lod cache write: {e}')
        for m in mats: m2.materials.append(m)
    if len(m2.materials) != len(me.materials):
        m2.materials.clear()
        for m in me.materials: m2.materials.append(m)
    return m2, how


def _tier_collection(src, ratio):
    """src's objects with decimated meshes (same object-level materials, flags), as a collection; None if src holds no
    mesh worth decimating."""
    name = f'{src.name[:50]}#lod{int(ratio * 100)}'
    c = bpy.data.collections.get(name)
    if c: return c
    obs = [o for o in src.all_objects if o.type == 'MESH' and not o.get('cz_shadow_proxy')]
    if not obs or any(_mesh_tris(o.data) < MIN_TRIS for o in obs): return None
    c = bpy.data.collections.new(name); hows = []
    for o in obs:
        m2, how = _decimated(o, ratio); hows.append(how)
        cp = bpy.data.objects.new(o.name[:50] + f'_lod{int(ratio * 100)}', m2)
        cp.matrix_world = o.matrix_world.copy()
        for i, s in enumerate(o.material_slots):
            if i < len(cp.material_slots):
                cp.material_slots[i].link = s.link
                if s.link == 'OBJECT': cp.material_slots[i].material = s.material
        _put_flags(cp, _flags(o))
        c.objects.link(cp)
    c['cz_sp_how'] = ','.join(hows)
    return c


def lod_on(k):
    """Points get the smallest tier with >= k triangles per pixel of their largest screen area."""
    if not INST: gn_on()
    lod_off()
    t0 = time.time(); cams = _cam_samples(); rep = []
    tris0 = tris1 = 0
    for inst in INST:
        px = screen_px(inst, cams); area = math.pi / 4 * px ** 2
        T = inst.tris(0); tris0 += T * len(px)
        tier = np.zeros(len(px), np.int32)
        if T >= MIN_TRIS:
            for ti, r in enumerate(TIERS, start=1):
                tier = np.where((tier == ti - 1) & (r * T >= k * area), ti, tier)
        need = sorted(set(int(t) for t in tier) - {0})
        cols = [inst.src]
        ok = True
        for ti in range(1, (max(need) if need else 0) + 1):
            c = _tier_collection(inst.src, TIERS[ti - 1])
            if c is None: ok = False; break
            cols.append(c)
        if not ok: tier[:] = 0; cols = [inst.src]
        inst.cols = cols; inst.tier = tier; inst.rebuild()
        tris1 += inst.ob['cz_tris']
        rep.append(dict(asset=inst.src.name, points=len(px), tris=T, tiers=[int((tier == t).sum()) for t in range(len(TIERS) + 1)],
                        px_max=round(float(px.max()), 0), px_median=round(float(np.median(px)), 0)))
    _ST['lod'] = float(k)
    REPORT['lod'] = dict(k=k, tris_before=int(tris0), tris_after=int(tris1), assets=rep, camera_samples=len(cams), secs=round(time.time() - t0, 2))
    say(f'lod k={k}: library tris {tris0 / 1e6:.2f} M -> {tris1 / 1e6:.2f} M over {len(cams)} camera samples ({time.time() - t0:.2f} s)')
    for a in rep: say(f'  {a["asset"][:48]}: {a["points"]} points, {a["tris"]} tris, tiers full/50/25/10 % = {a["tiers"]}, px max {a["px_max"]:.0f} median {a["px_median"]:.0f}')
    return tris1


def lod_off():
    if not _ST['lod']: return
    for inst in INST:
        inst.cols = [inst.src]; inst.tier[:] = 0; inst.rebuild()
    _ST['lod'] = 0.0


# ---------------------------------------------------------------- far casters on the instancers (tune.far_casters)
def far_casters(v, cam_path):
    """Points farther than v m from every camera position cast no shadow: they pick a no-shadow twin of their tier's
    collection (shared meshes, visible_shadow off). 0 = all cast. -> number of points switched."""
    n = 0
    for inst in INST:
        inst.far[:] = 0; inst.twins = []
        if v and cam_path:
            c, r = _bounds(inst.src)
            C = inst.mats[:, :3, :3] @ c + inst.mats[:, :3, 3]
            R = r * np.abs(np.linalg.det(inst.mats[:, :3, :3])) ** (1 / 3)
            P = np.array([list(p) for p in cam_path])
            d = np.min(np.linalg.norm(C[:, None, :] - P[None, :, :], axis=2), axis=1) - R
            inst.far = (d > v).astype(np.int32)
            if inst.far.any():
                for col in inst.cols:
                    t = bpy.data.collections.get(col.name[:56] + '_noshadow')
                    if t is None:
                        t = bpy.data.collections.new(col.name[:56] + '_noshadow')
                        for ob in col.all_objects:
                            cp = ob.copy(); t.objects.link(cp)
                            try: cp.visible_shadow = False
                            except Exception: pass
                    inst.twins.append(t)
                n += int(inst.far.sum())
        inst.rebuild()
    return n


def source_collections():
    """The collections the instancers draw at full detail (tune.shadow_proxy decimates their shadow casters)."""
    return [i.src for i in INST]


# ---------------------------------------------------------------- joins
def _mat_kind(m):
    """What a join may do to a material's look: 'free' (nothing object-dependent: parts may sit anywhere), 'object'
    (object-space coordinates / normals: only parts sharing one world matrix), 'never' (Generated coordinates follow
    the object's bounds, Object Info is per object)."""
    if m is None or not m.use_nodes: return 'free'
    def walk(nt, seen):
        if nt is None or nt.name in seen: return 'free'
        seen.add(nt.name); k = 'free'
        for n in nt.nodes:
            if n.type == 'OBJECT_INFO': return 'never'
            if n.type == 'TEX_COORD':
                if n.outputs['Generated'].is_linked: return 'never'
                if n.outputs['Object'].is_linked and n.object is None: k = 'object'
            if n.type == 'ATTRIBUTE' and getattr(n, 'attribute_type', '') in ('OBJECT', 'INSTANCER'): return 'never'
            if n.type == 'NORMAL_MAP' and n.space in ('OBJECT', 'BLENDER_OBJECT'): k = 'object'
            if n.type == 'VECT_TRANSFORM' and 'OBJECT' in (n.convert_from, n.convert_to): k = 'object'
            if n.type.startswith('TEX_') and n.type not in ('TEX_COORD', 'TEX_ENVIRONMENT', 'TEX_SKY') and 'Vector' in n.inputs \
                    and not n.inputs['Vector'].is_linked and (n.type != 'TEX_IMAGE' or n.projection == 'BOX'):
                return 'never'         # (a procedural texture or a box-projected image with no vector reads Generated)
            if n.type == 'GROUP':
                g = walk(n.node_tree, seen)
                if g == 'never': return 'never'
                if g == 'object': k = 'object'
        return k
    return walk(m.node_tree, set())


SAFE_MODS = {'BEVEL', 'WEIGHTED_NORMAL', 'EDGE_SPLIT', 'TRIANGULATE', 'SOLIDIFY', 'MIRROR', 'SUBSURF'}
_JOIN = {'made': [], 'hid': []}


def join_on():
    join_off()
    t0 = time.time(); sc = bpy.context.scene; prot = _protected()
    cand = [o for o in sc.objects if o.type == 'MESH' and not o.hide_render and not o.get('cz_sp') and not o.get('cz_id') and not o.get('cz_keep')
            and not o.children and o.name not in prot and o.data.users == 1 and not o.particle_systems
            and all(m.type in SAFE_MODS for m in o.modifiers) and not (o.parent and o.parent.get('cz_id'))]
    cand = [o for o in cand if not _animated(o) and all(s.link == 'DATA' for s in o.material_slots)]
    kinds = {}
    def kind(o):
        k = 'free'
        for s in o.material_slots:
            if s.material is None: continue
            if s.material.name not in kinds: kinds[s.material.name] = _mat_kind(s.material)
            mk = kinds[s.material.name]
            if mk == 'never': return 'never'
            if mk == 'object': k = 'object'
        return k
    ok = {o: kind(o) for o in cand}
    cand = [o for o in cand if ok[o] != 'never']
    users = _users(cand)
    cand = [o for o in cand if not users.get(o)]
    groups = {}
    for o in cand:
        mw = o.matrix_world
        bb = [mw @ Vector(v) for v in o.bound_box]; ctr = sum(bb, Vector()) / 8
        # parts whose materials read object space must share one world matrix; the rest may sit anywhere in the cell
        mkey = tuple(round(x, 5) for row in mw for x in row) if ok[o] == 'object' else 'free'
        key = (mkey, o.users_collection[0].name if o.users_collection else '', _flags(o),
               bool(o.is_shadow_catcher), tuple(sorted({s.material.name for s in o.material_slots if s.material})),
               tuple(int(math.floor(c / CELL)) for c in ctr))
        groups.setdefault(key, []).append(o)
    before = len([o for o in sc.objects if not o.hide_render])
    made = hid = 0
    for key, objs in groups.items():
        if len(objs) < 2: continue
        dg = bpy.context.evaluated_depsgraph_get()
        cps = []
        for o in objs:
            me = bpy.data.meshes.new_from_object(o.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
            cp = bpy.data.objects.new(o.name[:40] + '_j', me); cp.matrix_world = o.matrix_world.copy()
            _put_flags(cp, _flags(o)); cp.is_shadow_catcher = o.is_shadow_catcher
            for c in o.users_collection: c.objects.link(cp)
            cps.append(cp)
        for x in bpy.context.selected_objects: x.select_set(False)
        for cp in cps: cp.select_set(True)
        bpy.context.view_layer.objects.active = cps[0]
        try: bpy.ops.object.join()
        except Exception as e:
            say(f'join failed ({e}): left as built')
            for cp in cps:
                try: m = cp.data; bpy.data.objects.remove(cp, do_unlink=True); bpy.data.meshes.remove(m)
                except Exception: pass
            continue
        j = cps[0]; j.name = 'cz_sp_join_' + objs[0].name[:30]; j['cz_sp_join'] = len(objs); j['cz_nocontact'] = True
        _JOIN['made'].append(j)
        for o in objs: o.hide_render = True; _JOIN['hid'].append(o)
        made += 1; hid += len(objs)
    _ST['join'] = True
    after = len([o for o in sc.objects if not o.hide_render])
    kc = {k: sum(1 for v in ok.values() if v == k) for k in ('free', 'object', 'never')}
    REPORT['join'] = dict(candidates=len(cand), materials=kc, joined=hid, into=made, objects_before=before, objects_after=after, secs=round(time.time() - t0, 2))
    say(f'join: {hid} static meshes -> {made} objects ({len(cand)} could; static meshes by material: {kc}; objects {before} -> {after}, {time.time() - t0:.2f} s)')
    return made


def join_off():
    for j in _JOIN['made']:
        try: m = j.data; bpy.data.objects.remove(j, do_unlink=True); bpy.data.meshes.remove(m)
        except Exception: pass
    for o in _JOIN['hid']:
        try: o.hide_render = False
        except ReferenceError: pass
    _JOIN['made'], _JOIN['hid'] = [], []; _ST['join'] = None


# ---------------------------------------------------------------- the knobs (tune.KNOBS)
def get_gn(): return 1 if _ST['gn'] else 0
def put_gn(v):
    if int(v) and not _ST['gn']: gn_on()
    elif not int(v) and _ST['gn']: gn_off()
def get_lod(): return _ST['lod']
def put_lod(v):
    v = float(v)
    if v > 0: lod_on(v)
    else: lod_off()
def get_join(): return 1 if _ST['join'] else 0
def put_join(v):
    if int(v) and not _ST['join']: join_on()
    elif not int(v) and _ST['join']: join_off()


def inventory():
    """Counts that drive the frame cost: visible objects, collection-instance empties, GN instancers + their points,
    library triangles placed, every drawn instance (depsgraph)."""
    sc = bpy.context.scene
    vis = [o for o in sc.objects if not o.hide_render]
    dg = bpy.context.evaluated_depsgraph_get()           # (the viewport depsgraph: it ignores hide_render, so filter)
    drawn = sum(1 for d in dg.object_instances if d.object.type == 'MESH' and (d.is_instance or not d.object.original.get('cz_sp'))
                and not ((d.parent.original if d.is_instance and d.parent else d.object.original).hide_render))
    return dict(objects=len(vis), meshes=sum(1 for o in vis if o.type == 'MESH'),
                collection_instances=sum(1 for o in vis if o.instance_type == 'COLLECTION' and o.instance_collection),
                gn_instancers=sum(1 for o in vis if o.get('cz_sp')), gn_points=sum(len(o.data.vertices) for o in vis if o.get('cz_sp')),
                library_tris=sum(int(o.get('cz_tris', 0)) for o in vis if o.get('cz_id')), drawn_meshes=drawn)
