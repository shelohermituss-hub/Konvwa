# contact.py - the 3D Informational (mega) overlap gate (mega v2 package B, 2026-10-30). gruss after the night's three
# shorts: "some elements are clipping out because of overlaps, it looks unprofessional". The Blender port of recon's
# lib/contact.js + lib/collide.js + the coplanar audit, judged ON SCREEN (what the camera of the shot sees, in pixels).
#
# At sampled frames of a shot (every ~0.25 s + every X-ray peak + the frame after something appears) it finds, for the
# solid objects in view (evaluated geometry: modifiers, displacement, geometry-node instances):
#   through   a solid's surface passes into another closed solid of another model (>= 15 % of its surface inside, and
#             not wholly hidden inside it), with the depth and where it shows
#   floating  a grounded prop (not moving, not airborne) whose lowest points are above what is under them
#   coplanar  two surfaces facing the same way (almost) in one plane: they z-fight / flicker (also inside one joined mesh)
#   cutaway   a solid poking out of a declared section plane (section()) or out of a see-through shell (shell())
#   camclip   the camera's near plane cuts a solid, or the camera sits inside one
#   sweep     two objects that pass through each other BETWEEN the sampled frames (a dense box pass finds the frame)
# Opt-outs (on the object or any parent): ob['cz_airborne'] = True (flies, falls, is thrown: never "floating"),
# ob['cz_nocontact'] = True (never checked: effects, guides), ob['cz_group'] = 'roots,soil' (objects sharing a group may
# overlap: a root growing into the soil, a pipe through its wall), ob['cz_section_ok'] = True (may cross the section).
# run.py --check calls run(); every finding prints once (its worst frame):
#   CZ CONTACT <type> <shot> f=<frame> <a> x <b> depth=<m> px=<n> fix: <how>
#   CZ CONTACTINFO <hidden-type|coplanar-small> ...      info, never a failure
#   CZ CONTACT partial <shot> f=<first unchecked> checked x <k>/<n> depth=0.000 px=0 fix: ...   the budget ran out: a
#       NOTE (never "clean", never a failure); the summary then says `CZ CONTACTCHECK partial (...)`
#   CZ CONTACTCHECK clean (<n> solids, <frames> frames, <ms> ms/frame)   |   CZ CONTACTCHECK <n> findings ...
# Fix round (2026-10-30, Fable review): hide_render walls / keys never hide or hold (B3); heavy library meshes by proxy,
# world data + pair geometry cached across frames, budget by set size, partial lines (B4); coplanar gates from 12 px.
import bpy, math, os, re, sys, time, json
from mathutils import Vector
from mathutils.bvhtree import BVHTree
if os.environ.get('CZ_PYLIB') and os.environ['CZ_PYLIB'] not in sys.path: sys.path.append(os.environ['CZ_PYLIB'])
try:
    import numpy as np
except Exception:          # (mega needs numpy too: the app installs it, blender/numpy.ts)
    np = None

FPS = 30
ENV_SIZE = 25.0            # units: bigger than this is environment (terrain, the soil block): holds others, never judged
PX_THROUGH = 8             # a solid smaller than this on screen is not checked
PX_FLOAT = 16
PX_MIN_DEFECT = 3          # a gap / poke / near-plane cut under 3 px never shows
PX_THROUGH_DEPTH = 6       # a penetration shallower than 6 px on screen reads as touching (a clamp on its pipe)
FRAC = 0.15                # through: share of the smaller surface inside the other (recon: 0.3 of vertices)
K = 160                    # surface samples per object (area weighted)
# coplanar patches smaller than this (side, px) are listed as info, not findings: a 5 px z-fight (everest e15's container
# decals on their shells) never reads on a phone; from 12 px it flickers visibly (fix round, 2026-10-30)
PX_COPLANAR = float(os.environ.get('CZ_CONTACT_COPLANAR_PX', '12'))
# a mesh with more triangles than this (a 2 M-tri Poly Haven tree) is checked through a proxy: exact surface samples and
# lowest points from the full mesh, a vertex-clustered copy (<= ~60 k tris) for the BVH; never the "inside" of a through
HEAVY = int(os.environ.get('CZ_CONTACT_HEAVY', '150000'))
DEFORM = {'ARMATURE', 'MESH_DEFORM', 'LATTICE', 'CAST', 'WAVE', 'NODES', 'SHRINKWRAP', 'HOOK', 'CURVE', 'DISPLACE',
          'SIMPLE_DEFORM', 'SURFACE_DEFORM', 'LAPLACIANDEFORM', 'OCEAN', 'SOFT_BODY', 'CLOTH', 'SMOOTH', 'CORRECTIVE_SMOOTH'}
BSDF = {'ShaderNodeBsdfPrincipled', 'ShaderNodeBsdfDiffuse', 'ShaderNodeBsdfGlossy', 'ShaderNodeBsdfMetallic',
        'ShaderNodeBsdfToon', 'ShaderNodeSubsurfaceScattering', 'ShaderNodeBsdfSheen', 'ShaderNodeBsdfTranslucent',
        'ShaderNodeBsdfRefraction', 'ShaderNodeBsdfGlass', 'ShaderNodeBsdfAnisotropic', 'ShaderNodeBsdfHairPrincipled',
        'ShaderNodeBsdfHair', 'ShaderNodeEeveeSpecular', 'ShaderNodeGroup'}
INDIR = Vector((0.5774, 0.5771, 0.5776)).normalized()
FIX = {
    'through': 'move or resize one so they touch without passing through (rest it ON the surface: its lowest point at the '
               'top of the other), or, if one really goes into the other (a pipe through its wall, a root in the soil), give '
               'both the same ob["cz_group"]',
    'floating': 'lower it onto what is under it (its lowest point on that surface: a ray down / the support\'s top z), or '
                'fix it to what holds it; ob["cz_airborne"] = True only if it really flies, falls or is thrown',
    'coplanar': 'two surfaces facing the same way in one plane flicker (z-fight): lift the top one at least 1 cm (more far '
                'from the camera), shrink one so they do not overlap, or paint the detail into one surface',
    'cutaway': 'it pokes out of the cut: bisect it at the section plane (like half_cut), move it behind the plane, or keep it '
               'inside its see-through shell; ob["cz_section_ok"] = True only if it is meant to stand in front of the cut',
    'camclip': 'the camera is too close: the near plane cuts it open. Move that Flight key back, or lower the camera\'s '
               'clip start (M.Flight(..., clip=(0.01, ...))) if the camera must be that close',
    'sweep': 'they pass through each other while moving (between the checked frames): change one path or its timing so '
             'they miss or meet at a surface; ob["cz_group"] on both only if the pass-through is the point',
}


# ---------------------------------------------------------------- what shots call
def _tag(obs, key, val):
    for o in obs:
        if o is None: continue
        if isinstance(o, (list, tuple)): _tag(o, key, val); continue
        if isinstance(o, dict): _tag(list(o.values()), key, val); continue
        try: o[key] = val
        except Exception: pass


def airborne(*obs): _tag(obs, 'cz_airborne', True)
def nocontact(*obs): _tag(obs, 'cz_nocontact', True)
def shell(*obs): _tag(obs, 'cz_shell', True)


def allow(*obs, group='ok'):
    """These objects may overlap each other (an intended overlap: a root in the soil, a pipe through its wall)."""
    for o in obs:
        if isinstance(o, (list, tuple)): allow(*o, group=group); continue
        if o is None: continue
        g = [x for x in str(o.get('cz_group', '')).split(',') if x]
        if group not in g: g.append(group)
        o['cz_group'] = ','.join(g)


def section(point, normal, name='section', box=None):
    """Declare a cut plane of a cutaway film: `normal` points to the open side (toward the camera). Solids may reach
    the plane but not poke through it. box=(x0, x1, y0, y1, z0, z1): only that part of space is cut (the soil block,
    not the house standing on it)."""
    sc = bpy.context.scene
    try: L = json.loads(sc.get('cz_sections', '[]'))
    except Exception: L = []
    L = [s for s in L if s.get('name') != name]
    L.append(dict(name=name, p=list(map(float, point)), n=list(map(float, normal)), box=list(map(float, box)) if box else None))
    sc['cz_sections'] = json.dumps(L)


# ---------------------------------------------------------------- helpers
def _chain(o):
    while o is not None:
        yield o; o = o.parent


def _flag(o, key): return any(p.get(key) for p in _chain(o))


def _groups(o):
    g = set()
    for p in _chain(o):
        v = p.get('cz_group')
        if v: g |= {x.strip() for x in str(v).split(',') if x.strip()}
    return g


_MK = {}


def _mat_kind(m):
    if m is None: return 'solid'
    k = _MK.get(m.name)
    if k: return k
    k = 'solid'
    if getattr(m, 'surface_render_method', '') == 'BLENDED' or getattr(m, 'blend_method', 'OPAQUE') == 'BLEND': k = 'blend'
    elif m.node_tree:
        ty = {n.bl_idname for n in m.node_tree.nodes}
        if not (ty & BSDF) and ({'ShaderNodeEmission', 'ShaderNodeBsdfTransparent'} & ty): k = 'emit'
    _MK[m.name] = k
    return k


def _obj_kind(o):
    ks = [_mat_kind(s.material) for s in o.material_slots] or ['solid']
    return 'solid' if 'solid' in ks else ('blend' if 'blend' in ks else 'emit')


def _coll_ok(o):
    try: return not any(c.hide_render for c in o.users_collection)
    except Exception: return True


_HIDINST = set()           # objects instanced only by instancers hidden from the render (this frame): their copies too


def _hidden_instances(sc):
    """Per frame: the objects whose every instancer is hidden from the render (a collection instance shown later by a
    hide_render key). The viewport depsgraph the rays use still holds them."""
    _HIDINST.clear(); vis = set()
    for o in sc.objects:
        c = getattr(o, 'instance_collection', None)
        if o.instance_type != 'COLLECTION' or c is None: continue
        names = {x.name for x in c.all_objects}
        if any(p.hide_render for p in _chain(o)) or not _coll_ok(o): _HIDINST.update(names)
        else: vis |= names
    _HIDINST.difference_update(vis)


def _rendered(ob):
    """Is this ray hit drawn in the render now? scene.ray_cast uses the viewport depsgraph, which still holds objects
    hidden by hide_render (a wall shown later by M.visible / a hide_render key, a hidden collection, a camera-invisible
    object): those never hide a defect and never hold a prop (fix round B3, 2026-10-30)."""
    src = getattr(ob, 'original', None) or ob
    try:
        if src.name in _HIDINST: return False
        if any(p.hide_render for p in _chain(src)) or not getattr(src, 'visible_camera', True): return False
    except Exception: return True
    return _coll_ok(src)


def _deforms(o):
    if any(m.type in DEFORM for m in getattr(o, 'modifiers', [])): return True
    d = getattr(o, 'data', None)
    if getattr(d, 'shape_keys', None): return True
    ad = getattr(d, 'animation_data', None)
    return bool(ad and ad.action) or o.type != 'MESH'


def _fcurves(idb):
    ad = getattr(idb, 'animation_data', None)
    if not ad or not ad.action: return []
    try: return list(ad.action.fcurves)
    except Exception:
        out = []
        for lay in ad.action.layers:
            for st in lay.strips:
                for cb in st.channelbags: out += list(cb.fcurves)
        return out


def _moves(o):
    for p in _chain(o):
        if p.animation_data is not None and p.animation_data.action is not None: return True
        if p.constraints: return True
    return False


class _Local:
    __slots__ = ('co', 'tri', 'closed', 'lo', 'hi', 'area', 'smp_t', 'smp_b', 'mi', 'heavy', 'err', 'smp_p', 'smp_n', 'feet')


_LOCAL = {}
_STAT = {'read': 0.0, 'heavy': 0}


def _proxy(co, tri, target=60000):
    """Vertex clustering (numpy): a coarse copy of a heavy mesh for its BVH (cell = the longest side / cells). Returns
    verts, tris, cell size. 2 M tris -> ~0.5 s once per mesh per shot."""
    lo = co.min(0); ext = max(float((co.max(0) - lo).max()), 1e-6)
    for cells in (96, 64, 40, 24):
        h = ext / cells
        q = np.floor((co - lo) / h).astype(np.int64)
        key = (q[:, 0] * (cells + 2) + q[:, 1]) * (cells + 2) + q[:, 2]
        uk, inv = np.unique(key, return_inverse=True)
        t = inv[tri]
        t = t[(t[:, 0] != t[:, 1]) & (t[:, 1] != t[:, 2]) & (t[:, 0] != t[:, 2])]
        s = np.sort(t, 1); n = np.int64(len(uk))
        _, ix = np.unique((s[:, 0] * n + s[:, 1]) * n + s[:, 2], return_index=True)
        t = t[np.sort(ix)]
        if len(t) <= target or cells == 24: break
    cnt = np.bincount(inv, minlength=len(uk)).astype(np.float64)
    rep = np.stack([np.bincount(inv, weights=co[:, i], minlength=len(uk)) for i in range(3)], 1) / cnt[:, None]
    return rep, t.astype(np.int32), h


def _local(o, dg, key=None, ev=None):
    """The evaluated mesh in the object's own space (cached unless it deforms): verts, triangles, closed or not.
    Undeformed copies of one mesh (A.model's linked duplicates) share one read."""
    if key is None:
        key = o.name
        if ev is None and o.type == 'MESH' and not o.modifiers and not _deforms(o): key = '#' + o.data.name
    if key in _LOCAL and not (ev is None and _deforms(o)): return _LOCAL[key]
    t0 = time.time()
    ev = ev or o.evaluated_get(dg)
    try: me = ev.to_mesh()
    except Exception: return None
    try:
        if me is None or not len(me.polygons): return None
        me.calc_loop_triangles()
        nv, nt = len(me.vertices), len(me.loop_triangles)
        co = np.empty(nv * 3, np.float32); me.vertices.foreach_get('co', co)
        tri = np.empty(nt * 3, np.int32); me.loop_triangles.foreach_get('vertices', tri)
        mi = np.empty(nt, np.int32); me.loop_triangles.foreach_get('material_index', mi)
        le = np.empty(len(me.loops), np.int32); me.loops.foreach_get('edge_index', le)
        cnt = np.bincount(le, minlength=len(me.edges)) if len(le) else np.zeros(0)
    finally:
        try: ev.to_mesh_clear()
        except Exception: pass
    L = _Local()
    L.co = co.reshape(-1, 3).astype(np.float64); L.tri = tri.reshape(-1, 3); L.mi = mi
    L.closed = bool(len(cnt)) and not bool((cnt == 1).any())
    L.lo, L.hi = L.co.min(0), L.co.max(0)
    a, b, c = L.co[L.tri[:, 0]], L.co[L.tri[:, 1]], L.co[L.tri[:, 2]]
    cr = np.cross(b - a, c - a)
    L.area = np.linalg.norm(cr, axis=1) * 0.5
    # area-weighted surface samples, kept off the triangle edges (so a neighbour in the same plane never counts)
    rng = np.random.default_rng(len(L.tri) * 7 + 3)
    s = L.area.sum()
    if s <= 0: return None
    L.smp_t = rng.choice(len(L.tri), size=K, p=L.area / s)
    r1, r2 = np.sqrt(rng.random(K)), rng.random(K)
    bc = np.stack([1 - r1, r1 * (1 - r2), r1 * r2], 1)
    L.smp_b = bc * 0.8 + 0.2 / 3
    L.heavy, L.err, L.smp_p, L.smp_n, L.feet = False, 0.0, None, None, None
    if nt > HEAVY:
        # exact samples + lowest points from the full mesh, then a coarse proxy for everything that needs a BVH
        T = L.tri[L.smp_t]; B = L.smp_b
        L.smp_p = L.co[T[:, 0]] * B[:, :1] + L.co[T[:, 1]] * B[:, 1:2] + L.co[T[:, 2]] * B[:, 2:]
        n_ = cr[L.smp_t]; L.smp_n = n_ / np.maximum(np.linalg.norm(n_, axis=1, keepdims=True), 1e-12)
        z = L.co[:, 2]; ft = L.co[z <= z.min() + 0.02 * max(float(L.hi[2] - L.lo[2]), 1e-6)]
        L.feet = ft[::max(1, len(ft) // 400)]
        L.co, L.tri, L.err = _proxy(L.co, L.tri)
        L.mi = np.zeros(len(L.tri), np.int32); L.heavy = True; _STAT['heavy'] += 1
        a, b, c = L.co[L.tri[:, 0]], L.co[L.tri[:, 1]], L.co[L.tri[:, 2]]
        L.area = np.linalg.norm(np.cross(b - a, c - a), axis=1) * 0.5
    _LOCAL[key] = L
    _STAT['read'] += time.time() - t0
    return L


def _corners(L):
    return np.array([[x, y, z] for x in (L.lo[0], L.hi[0]) for y in (L.lo[1], L.hi[1]) for z in (L.lo[2], L.hi[2])])


_WC = {}                   # item name -> [L, matrix bytes, wv, bvh, samples, warea]: a static item's world data, reused
                           # on every later frame (fix round B4: the BVH of a still set was rebuilt every frame)


class _Item:
    def __init__(s, name, ob, L, mw, model_src):
        s.name, s.ob, s.L = name, ob, L
        s.M = np.array(mw, dtype=np.float64)
        s.src = model_src                       # the original object for the model / flags / groups
        w = _corners(L) @ s.M[:3, :3].T + s.M[:3, 3]
        s.lo, s.hi = w.min(0), w.max(0)
        s.size = s.hi - s.lo; s.big = float(s.size.max())
        s.fam = None
        mk = s.M.tobytes(); c = _WC.get(name)
        if c is None or c[0] is not L or c[1] != mk:
            c = _WC[name] = [L, mk, None, None, None, 0.0]
        s._c = c
        # proxy error in world units (a heavy mesh's clustering cell x its scale)
        s.err = float(L.err * np.linalg.norm(s.M[:3, :3], axis=0).max()) if L.heavy else 0.0

    @property
    def warea(s): return s._c[5]

    @property
    def wv(s):
        if s._c[2] is None: s._c[2] = s.L.co @ s.M[:3, :3].T + s.M[:3, 3]
        return s._c[2]

    @property
    def bvh(s):
        if s._c[3] is None: s._c[3] = BVHTree.FromPolygons(s.wv.tolist(), s.L.tri.tolist(), all_triangles=True)
        return s._c[3]

    def lowpts(s, n=1500):
        """Points to find its lowest points from: the vertices (strided), plus a heavy mesh's true bottom band."""
        V = s.wv[::max(1, len(s.wv) // n)]
        if s.L.feet is not None: V = np.concatenate([V, s.L.feet @ s.M[:3, :3].T + s.M[:3, 3]])
        return V

    def samples(s):
        """(K, 3) world points on the surface + (K, 3) their face normals."""
        if s._c[4] is None:
            V = s.wv
            if s.L.smp_p is not None:          # heavy: exact samples of the full mesh, kept in its own space
                P = s.L.smp_p @ s.M[:3, :3].T + s.M[:3, 3]
                try: N = s.L.smp_n @ np.linalg.inv(s.M[:3, :3])
                except Exception: N = s.L.smp_n @ s.M[:3, :3].T
                N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-12)
            else:
                T = s.L.tri[s.L.smp_t]
                a, b, c = V[T[:, 0]], V[T[:, 1]], V[T[:, 2]]
                P = a * s.L.smp_b[:, :1] + b * s.L.smp_b[:, 1:2] + c * s.L.smp_b[:, 2:]
                N = np.cross(b - a, c - a); N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-12)
            # the surface area in world units (scale applied)
            A_, B_, C_ = V[s.L.tri[:, 0]], V[s.L.tri[:, 1]], V[s.L.tri[:, 2]]
            s._c[5] = float(np.linalg.norm(np.cross(B_ - A_, C_ - A_), axis=1).sum() * 0.5)
            s._c[4] = (P, N)
        return s._c[4]


def _inside(bvh, p, far=1e5):
    """Ray parity: an odd number of surface crossings along a fixed odd direction = inside a closed mesh."""
    n, o = 0, Vector(p)
    for _ in range(64):
        loc, nrm, idx, d = bvh.ray_cast(o, INDIR, far)
        if loc is None: break
        n += 1; o = loc + INDIR * 1e-5
    return n % 2 == 1


def _hit(a, b, pad=0.0):
    return bool((a.lo <= b.hi + pad).all() and (b.lo <= a.hi + pad).all())


def _vol(lo, hi):
    d = np.maximum(hi - lo, 0); return float(d[0] * d[1] * d[2])


class _Cam:
    def __init__(s, sc, dg):
        s.ob = sc.camera
        r = sc.render; s.W = r.resolution_x * r.resolution_percentage / 100; s.H = r.resolution_y * r.resolution_percentage / 100
        if not s.ob: return
        P = np.array(s.ob.calc_matrix_camera(dg, x=int(r.resolution_x), y=int(r.resolution_y), scale_x=r.pixel_aspect_x, scale_y=r.pixel_aspect_y))
        V = np.array(s.ob.matrix_world.inverted())
        s.PV = P @ V; s.fy = P[1, 1] * s.H / 2
        s.pos = np.array(s.ob.matrix_world.to_translation())
        s.near = s.ob.data.clip_start
        s.fwd = np.array(s.ob.matrix_world.to_quaternion() @ Vector((0, 0, -1)))

    def w(s, pts):
        return pts @ s.PV[3, :3] + s.PV[3, 3]

    def px(s, pts):
        """screen x, y (pixels, y down) and w (depth) of world points (n, 3)"""
        c = pts @ s.PV[:, :3].T + s.PV[:, 3]
        w = c[:, 3]; ws = np.where(np.abs(w) < 1e-9, 1e-9, w)
        return (c[:, 0] / ws + 1) * 0.5 * s.W, (1 - c[:, 1] / ws) * 0.5 * s.H, w

    def ppm(s, p):
        """pixels per world unit at point p (a point at / behind the camera plane counts as at the near plane)"""
        if not s.ob: return 1e3
        return s.fy / max(float(s.w(np.asarray(p, dtype=np.float64)[None])[0]), s.near, 1e-3)

    def box(s, lo, hi):
        """on screen?, size in px of a world box"""
        if not s.ob: return True, 1e6
        c = np.array([[x, y, z] for x in (lo[0], hi[0]) for y in (lo[1], hi[1]) for z in (lo[2], hi[2])])
        x, y, w = s.px(c)
        if (w <= s.near).all(): return False, 0.0
        if (w <= s.near).any(): return True, float(max(s.W, s.H))     # around / beside the camera
        x0, x1 = max(0.0, x.min()), min(s.W, x.max()); y0, y1 = max(0.0, y.min()), min(s.H, y.max())
        if x1 <= x0 or y1 <= y0: return False, 0.0
        return True, float(max(x1 - x0, y1 - y0))

    def onscreen(s, p):
        if not s.ob: return True
        x, y, w = s.px(np.asarray(p, dtype=np.float64)[None])
        return bool(w[0] > s.near and 0 <= x[0] <= s.W and 0 <= y[0] <= s.H)


def _clean(n): return ''.join(ch if ch.isalnum() or ch in '._-#>' else '_' for ch in str(n))[:60] or 'mesh'


# ---------------------------------------------------------------- one frame
SOLID_NAMES = set()        # every solid object seen (on screen or not): what a ray may stand on
MAX_ITEMS = 450            # the biggest on screen (recon: 600 props); the rest is too small to show a defect


def _held_map():
    """hands.py's holds (package C, when the shot has people): object name -> {'held:<figure>'} for the person's mesh,
    rig and every prop it holds; and the set of held prop names."""
    hd = sys.modules.get('hands'); out, props = {}, set()
    for h in (getattr(hd, 'HOLDS', None) or []):
        try:
            f = h.f; g = {'held:' + str(getattr(f, 'name', id(f)))}
            for o in (getattr(f, 'mesh', None), getattr(f, 'arm', None), getattr(f, 'root', None), h.prop):
                if o is None: continue
                stack = [o]
                while stack:
                    x = stack.pop(); out[x.name] = out.get(x.name, set()) | g; stack.extend(x.children)
            props.add(h.prop.name)
        except Exception: pass
    return out, props


def _gather(sc, dg, cam, inst_cap=300):
    held, held_props = _held_map()
    pre = []
    for o in sc.objects:
        if o.type not in ('MESH', 'CURVE', 'SURFACE', 'META') or o.hide_render or not _coll_ok(o): continue
        if not getattr(o, 'visible_camera', True) or _flag(o, 'cz_nocontact'): continue
        kind = _obj_kind(o); sh = bool(_flag(o, 'cz_shell'))
        if kind != 'solid' and not sh: continue
        if kind == 'solid': SOLID_NAMES.add(o.name)
        # on screen and big enough, judged from its (evaluated) bound box BEFORE its mesh is read: shots with 2000 parts
        try:
            bb = np.array([tuple(v) for v in o.bound_box]); M_ = np.array(o.matrix_world)
            w = bb @ M_[:3, :3].T + M_[:3, 3]
            on, px = cam.box(w.min(0), w.max(0))
        except Exception: on, px = True, 1e6
        if not on or px < PX_THROUGH:
            # (the camera's near plane / inside test needs what is around the camera even when "small")
            if not (cam.ob is not None and (w.min(0) - 1 <= cam.pos).all() and (cam.pos <= w.max(0) + 1).all()): continue
        pre.append((px, o, kind, sh))
    pre.sort(key=lambda x: -x[0])
    items = []
    for px, o, kind, sh in pre[:MAX_ITEMS]:
        L = _local(o, dg)
        if L is None: continue
        it = _Item(o.name, o, L, o.matrix_world, o); it.kind = kind; it.shell = sh
        it.mats = [s.material.name if s.material else '' for s in o.material_slots]
        items.append(it)
    # geometry-node / collection instances (scattered rocks, a forest of linked trees): each copy is its own item
    n = 0
    for di in dg.object_instances:
        if not di.is_instance or n >= inst_cap: continue
        io = di.instance_object; par = di.parent
        if io is None or io.type != 'MESH' or par is None: continue
        po = par.original
        if po.hide_render or _flag(po, 'cz_nocontact') or _obj_kind(io.original if io.original else io) != 'solid': continue
        L = _local(io, dg, key='@' + io.data.name, ev=io) if ('@' + io.data.name) not in _LOCAL else _LOCAL['@' + io.data.name]
        if L is None: continue
        it = _Item(f'{po.name}>{io.name}#{n}', po, L, di.matrix_world.copy(), po); it.kind = 'solid'; it.shell = False
        it.mats = [s.material.name if s.material else '' for s in io.material_slots]
        it.inst = True; items.append(it); n += 1
    # model = the top-most parent that is still prop-sized (a house, a machine), else the object itself
    box = {}
    for it in items:
        for p in list(_chain(it.src))[1:]:
            b = box.get(p.name)
            box[p.name] = (np.minimum(b[0], it.lo), np.maximum(b[1], it.hi)) if b else (it.lo.copy(), it.hi.copy())
    for it in items:
        m = it.name if not getattr(it, 'inst', False) else it.src.name
        for p in list(_chain(it.src))[1:]:
            b = box[p.name]
            if float((b[1] - b[0]).max()) <= ENV_SIZE: m = p.name
        # parts of one assembly built by one function share a name prefix ('dis_run', 'dis_elb1', 'dis_band0'): one model
        # and copies of one object ('debris.017', 'debris.240': a scatter, a pile) are one family too
        if m == it.name:
            base = re.sub(r'\.\d{3,}$', '', it.name).strip('_')
            if '_' in base: m = 'family:' + base.split('_')[0]
            elif base != it.name: m = 'family:' + base
        it.model = m
        # copies of one library asset (A.model / A.scatter: a pile of rocks, a row of trees, grass tufts) are one family:
        # never checked against each other, like copies of one object ('debris.017'); each is still checked on its own
        # against everything else (fix round: A.scatter copies were flagged against each other, D.scatter pieces not)
        cid = next((p.get('cz_id') for p in _chain(it.src) if p.get('cz_id')), None)
        it.fam = ('asset:' + str(cid)) if cid else None
        it.groups = _groups(it.src); it.airborne = _flag(it.src, 'cz_airborne'); it.secok = _flag(it.src, 'cz_section_ok')
        # a prop in a person's hand (hands.py HOLDS) is held by that person: never "floating", never "through" its holder
        for p in _chain(it.src):
            g = held.get(p.name)
            if g: it.groups = it.groups | g; it.airborne = it.airborne or p.name in held_props; break
        it.on, it.px = cam.box(it.lo, it.hi)
        flat = it.size[2] < 0.25 * max(it.size[0], it.size[1])
        it.env = it.big > ENV_SIZE or (flat and it.px > 0.6 * cam.W and it.big > 4)
    return items


class _State:
    def __init__(s, shot, deadline, cap=None):
        s.shot, s.deadline = shot, deadline
        s.cap = cap or deadline + 11.0
        s.found = {}                # (type, a, b) -> finding (the worst frame kept)
        s.info = {}                 # hidden overlaps: said, never a failure
        s.cop_done = set(); s.partial = False

    def late(s):
        # the budget counts checking time; reading meshes (once per mesh per shot: a 2 M-tri tree ~1 s) comes on top,
        # up to the hard cap (CZ_CONTACT_CAP, 15 s)
        now = time.time()
        if now > s.deadline + _STAT['read'] or now > s.cap: s.partial = True; return True
        return False

    def add(s, typ, f, a, b, depth, px, at=None):
        a, b = _clean(a), _clean(b)
        k = (typ, a, b) if typ in ('floating', 'cutaway', 'camclip') else (typ,) + tuple(sorted((a, b)))
        old = s.found.get(k)
        px = min(px, 3840)                       # (a point at the lens: never more than the frame)
        if old is None or px > old["px"]:
            s.found[k] = dict(type=typ, f=f, a=a, b=b, depth=float(depth), px=int(round(px)), at=at,
                              frames=(old['frames'] if old else set()) | {f})
        else: old['frames'].add(f)

    def note(s, typ, f, a, b, depth, px):
        """info, not a finding (an overlap the camera can't see): printed as CZ CONTACTINFO, never fails the gate"""
        k = (typ,) + tuple(sorted((_clean(a), _clean(b))))
        if k not in s.info: s.info[k] = dict(type=typ, f=f, a=_clean(a), b=_clean(b), depth=float(depth), px=int(round(px)))


def _thin(it):
    """A pole / pipe / rod (its longest side >= 4x the middle one): points along its centre line (64) + its radius."""
    ext = (it.L.hi - it.L.lo) * np.linalg.norm(it.M[:3, :3], axis=0)
    o = np.argsort(ext)
    if ext[o[2]] < 4 * max(ext[o[1]], 1e-6): return None
    c = (it.L.lo + it.L.hi) / 2; n = 64
    P = np.repeat(c[None], n, 0); P[:, o[2]] = np.linspace(it.L.lo[o[2]], it.L.hi[o[2]], n)
    return P @ it.M[:3, :3].T + it.M[:3, 3], float(ext[o[1]]) / 2


def _shows(sc, dg, cam, p, names, near):
    """Is the meeting point p in view: the camera's ray reaches it, or first meets one of the two solids within `near` of
    it (anything else in front - a wall, the soil - hides it). Effects (glass, x-ray, glow) are looked through."""
    if not cam.ob or sc is None: return True
    c = Vector(cam.pos); q = Vector(p); d = q - c; L = d.length
    if L < 1e-6: return True
    d.normalize(); o = c.copy()
    for _ in range(10):
        ok, loc, nrm, idx, ob, mx = sc.ray_cast(dg, o, d, distance=L + near - (o - c).length)
        if not ok: return True
        src = ob.original if getattr(ob, 'original', None) else ob
        if (_obj_kind(src) != 'solid' and src.name not in SOLID_NAMES) or not _rendered(ob): o = loc + d * 1e-4; continue
        return (loc - c).length >= L - near or (src.name in names and (loc - q).length <= near)
    return True


_PAIR = {}                 # (a, b, a's matrix, b's matrix) -> the pair's through geometry (camera-free), see _pair_geo


def _pair_geo(A, B, sweep):
    """Camera-free part of `through` for one pair: per direction (X into closed Y) the deepest sunk point, its depth, the
    sunk share and the meeting line (X's surface within a band of Y's + Y's surface nearest the sunk part)."""
    out = []
    ovl, ovh = np.maximum(A.lo, B.lo), np.minimum(A.hi, B.hi)
    if _vol(ovl, ovh) < 0.03 * min(_vol(A.lo, A.hi), _vol(B.lo, B.hi)) and min(A.size.min(), B.size.min()) > 0.02: return out
    # apart, or one wholly inside the other (hidden). (A proxy may miss a shallow crossing: heavy pairs go on.)
    if not sweep and not (A.L.heavy or B.L.heavy) and not A.bvh.overlap(B.bvh): return out
    for X, Y in ((A, B), (B, A)):
        if not Y.L.closed or Y.L.heavy: continue
        P, _ = X.samples()
        m = ((P >= Y.lo - 1e-6) & (P <= Y.hi + 1e-6)).all(1)
        dep, pts, seam = [], [], []
        for p in P[m]:
            if _inside(Y.bvh, p):
                loc, nrm, idx, d = Y.bvh.find_nearest(Vector(p))
                if d is not None: dep.append(d); pts.append(p); seam.append(np.array(loc))
        frac = len(dep) / len(P)
        th = _thin(X)
        if th is not None:            # a pole / pipe / cable: its centre line inside the other, at any share
            ax, rad = th
            ma = ((ax >= Y.lo - 1e-6) & (ax <= Y.hi + 1e-6)).all(1)
            adep, apts, aseam = [], [], []
            for p in ax[ma]:
                if _inside(Y.bvh, p):
                    loc, nrm, idx, d = Y.bvh.find_nearest(Vector(p))
                    if d is not None and d > rad * 0.5: adep.append(d); apts.append(p); aseam.append(np.array(loc))
            if adep and not (frac > 0.97 and len(adep) == int(ma.sum()) == len(ax)):
                dep, pts, seam = dep + adep, pts + apts, seam + aseam
                frac = max(frac, FRAC)
        if not dep: continue
        if (frac > 0.97 and not sweep) or frac < (0.03 if sweep else FRAC): continue   # wholly inside (unseen) / a graze
        j = int(np.argmax(dep)); d = dep[j]; at = pts[j]
        if d < 0.004: continue
        # the meeting line as the camera would see it: X's own surface where it crosses Y's (within a band of Y's
        # surface, inside or out); then the points on Y's surface nearest the sunk part
        band = max(0.02, 0.25 * d); edge = []
        mb = ((P >= Y.lo - band) & (P <= Y.hi + band)).all(1)
        for p in P[mb]:
            loc, nrm, idx, dd = Y.bvh.find_nearest(Vector(p), band)
            if loc is not None: edge.append(p)
        out.append((X, Y, d, at, frac, edge + seam))
    return out


def _through(items, f, cam, st, typ='through', only=None, sc=None, dg=None):
    """only: the pairs to test (the sweep); there a mover wholly inside the other counts too (it had to get in).
    A pole / pipe / cable (_thin) counts at any sunk share: its centre line inside the other solid. A penetration whose
    meeting line the camera can't see (behind a wall, under the soil) is info, not a finding (st.info)."""
    sweep = only is not None
    sol = [it for it in items if it.kind == 'solid' and it.on and not it.env and it.px >= PX_THROUGH]
    sol.sort(key=lambda it: it.lo[0])
    hits = []
    for i, A in enumerate(sol):
        for B in sol[i + 1:]:
            if B.lo[0] > A.hi[0]: break
            if not _hit(A, B) or A.model == B.model or (A.fam and A.fam == B.fam) or (A.groups & B.groups): continue
            if only is not None and (A.name, B.name) not in only and (B.name, A.name) not in only: continue
            # (a heavy mesh is judged by its exact samples only: its proxy is never the closed "inside" of a through)
            if not ((A.L.closed and not A.L.heavy) or (B.L.closed and not B.L.heavy)): continue
            if st.late(): return hits
            # the geometry of a pair that has not moved is the same on every frame: computed once, then only what the
            # camera sees is judged again (fix round: e15's 450-solid heap cost 2 s a frame, 2 of 15 frames checked)
            key = None if sweep else (A.name, B.name, A._c[1], B._c[1])
            geo = _PAIR.get(key) if key is not None else None
            if geo is None:
                geo = _pair_geo(A, B, sweep)
                if key is not None: _PAIR[key] = geo
            best = None
            for X, Y, d, at, frac, seam in geo:
                ppx = min(d * cam.ppm(at), max(cam.W, cam.H))
                if ppx < PX_THROUGH_DEPTH or not cam.onscreen(at): continue
                if best is None or ppx > best[3]: best = (X, Y, d, ppx, at, frac, seam)
            if best:
                X, Y, d, ppx, at, frac, seam = best
                # already a finding at least this big (a static pair seen on an earlier frame): nothing new to learn
                old = st.found.get((typ,) + tuple(sorted((_clean(X.name), _clean(Y.name)))))
                if old is not None and old['px'] >= min(int(round(ppx)), 3840): old['frames'].add(f); hits.append((X.name, Y.name)); continue
                # where they meet, is it in view? (meeting points spread over the seam: 48, or 24 when this pair was
                # already judged hidden on an earlier frame)
                names = {X.name, Y.name, X.src.name, Y.src.name}
                nk = 24 if ('hidden-' + typ,) + tuple(sorted((_clean(X.name), _clean(Y.name)))) in st.info else 48
                order = list(range(len(seam)))[::max(1, len(seam) // nk)][:nk]
                th = _thin(X); near = max(0.03, 0.3 * d) + (2 * th[1] if th else 0.0)    # (a pole hides its own seam)
                vis = any(cam.onscreen(seam[k]) and _shows(sc, dg, cam, seam[k], names, near) for k in order)
                if vis: st.add(typ, f, X.name, Y.name, d, ppx, at); hits.append((X.name, Y.name))
                else: st.note('hidden-' + typ, f, X.name, Y.name, d, ppx)
    return hits


def _floating(items, f, cam, st, sc, dg):
    by = {}
    for it in items:
        if it.kind != 'solid' or it.env or it.airborne: continue
        by.setdefault(it.model, []).append(it)
    names_solid = _solid_names(items)
    cands = []
    for mdl, parts in by.items():
        if st.late(): break
        lo = np.min([p.lo for p in parts], 0); hi = np.max([p.hi for p in parts], 0); sz = hi - lo; big = float(sz.max())
        on, px = cam.box(lo, hi)
        if not on or px < PX_FLOAT: continue
        if all(p.size[2] < 0.1 * min(p.size[0], p.size[1]) and p.size[2] < 0.05 for p in parts): continue   # decals, plates
        own = {p.name for p in parts} | {mdl}
        for p in parts:                    # its own x-ray copies / children ride on it, they never hold it
            stack = list(p.ob.children) if not getattr(p, 'inst', False) else []
            while stack:
                c = stack.pop(); own.add(c.name); stack.extend(c.children)
        V = np.concatenate([p.lowpts() for p in parts])
        zmin = V[:, 2].min(); band = max(0.002, 0.03 * sz[2])
        low = V[V[:, 2] <= zmin + band]; low = low[np.argsort(low[:, 2])]
        feet = []
        for p in low:
            if all(math.hypot(q[0] - p[0], q[1] - p[1]) > 0.2 * big for q in feet): feet.append(p)
            if len(feet) >= 6: break
        ctr = (lo + hi) / 2
        ppm = cam.ppm(ctr)
        tol = max(min(0.08, 0.06 * big), PX_MIN_DEFECT / ppm, 0.01 * big)
        reach = max(0.4 * big, min(2.5 * big, 6.0))
        # held by its underside (round 2, from the everest stills: an excavator's bucket hangs lower than its tracks, a
        # platform's rim overhangs the bogies it stands on): its down-facing surface touching any other solid, or a ray
        # down from it landing within tol = it rests, whatever its very lowest point does
        D = []
        for p in parts:
            P_, N_ = p.samples(); D.extend(P_[N_[:, 2] < -0.5])
        D = D[::max(1, len(D) // 32)][:32]
        near_j = [j for j in items if j.kind == 'solid' and j.model != mdl and j.name not in own and not j.env
                  and len(j.L.tri) < 200000 and (j.lo <= hi + tol).all() and (lo - tol <= j.hi).all()]
        if any(j.bvh.find_nearest(Vector(q), tol)[0] is not None for j in near_j for q in D): continue
        sup = False
        for q in D[:16]:
            o = Vector((q[0], q[1], q[2] + 0.005))
            for _ in range(8):
                ok, loc, nrm, idx, ob, mx = sc.ray_cast(dg, o, Vector((0, 0, -1)), distance=tol + 0.01)
                if not ok: break
                nm = ob.original.name if getattr(ob, 'original', None) else ob.name
                if nm in own or nm not in names_solid or not _rendered(ob): o = loc + Vector((0, 0, -0.0005)); continue
                sup = True; break
            if sup: break
        if sup: continue
        gaps, unders = [], []
        # each foot twice: at its edge (a house deck on its walls' tops) and a little inset (a corner exactly on an edge)
        for p in [f_ for p0 in feet for f_ in (p0 + (ctr - p0) * np.array([0.005, 0.005, 0]), p0 + (ctr - p0) * np.array([0.08, 0.08, 0]))]:
            q = Vector((p[0], p[1], p[2] + 0.01))
            g, under, o = math.inf, None, q.copy()
            # its foot inside another closed solid = embedded (a root in its mound, a post in its footing): held
            # ... and a point just under it inside one = it stands on it (robust to coincident faces: its own x-ray copy
            # lying exactly on the ground hid the ground from the ray)
            qa, qb = np.array(q), np.array((p[0], p[1], p[2] - min(0.004, tol)))
            emb = next((j for j in items if j.kind == 'solid' and j.L.closed and not j.L.heavy and j.model != mdl and len(j.L.tri) < 200000
                        and any((j.lo <= x).all() and (x <= j.hi).all() and _inside(j.bvh, x) for x in ((qa, qb) if not j.env else (qb,)))), None)
            if emb is not None: gaps.append(0.0); unders.append(emb.name); continue
            for _ in range(16):
                ok, loc, nrm, idx, ob, mx = sc.ray_cast(dg, o, Vector((0, 0, -1)), distance=reach + 0.02 - (q.z - o.z))
                if not ok: break
                nm = ob.original.name if getattr(ob, 'original', None) else ob.name
                # itself and effects (glow, gas, labels): look further down. Water and glass DO hold things (a pontoon).
                # Something hidden from the render holds nothing (it is not there in the film)
                if nm in own or not _rendered(ob) or (nm not in names_solid and _obj_kind(ob.original if getattr(ob, 'original', None) else ob) != 'blend'):
                    o = loc + Vector((0, 0, -0.001)); continue
                # a face turned down = the ray started inside that solid: embedded in it (a pipe in the soil), held
                g = 0.0 if nrm.z < -0.2 else q.z - loc.z - 0.01; under = nm; break
            gaps.append(g); unders.append(under)
        if not gaps or all(not math.isfinite(g) for g in gaps): continue      # nothing below within reach: hangs by design
        gmin = min(gaps)
        if gmin <= tol: continue
        # fixed at its side to something standing beside it (a sign on its pole, a pipe on a wall)
        mid = (lo[2] + hi[2]) / 2
        if any(j.model != mdl and j.kind == 'solid' and not j.env and j.lo[2] <= mid <= j.hi[2]
               and (j.lo <= hi + tol).all() and (lo - tol <= j.hi).all() and j.size[2] >= 0.1 * sz[2] for j in items): continue
        k = int(np.argmin(gaps))
        # is the gap in view? (round 2: e02's excavators float 2.2 m but the gap is under the frame edge): the middle of
        # each foot's gap, on screen and reached by the camera's ray (or meeting the thing itself / its support near it)
        fpts = [f_ for p0 in feet for f_ in (p0 + (ctr - p0) * np.array([0.005, 0.005, 0]), p0 + (ctr - p0) * np.array([0.08, 0.08, 0]))]
        names = own | {u for u in unders if u}
        vis = any(math.isfinite(g) and g > tol and cam.onscreen(np.array((q[0], q[1], q[2] - g / 2)))
                  and _shows(sc, dg, cam, (q[0], q[1], q[2] - g / 2), names, max(0.03, g / 2)) for q, g in zip(fpts, gaps))
        if not vis:
            if gmin * ppm >= PX_MIN_DEFECT: st.note('hidden-floating', f, mdl, unders[k] or 'ground', gmin, gmin * ppm)
            continue
        cands.append((mdl, parts, gmin, unders[k] or 'ground', ctr, gmin * ppm))
    return [c for c in cands if c[5] >= PX_MIN_DEFECT]


def _seen(sc, dg, cam, p, names, tol=0.02):
    """p is the first thing the camera sees along its ray (or within tol of it), and the hit is one of names."""
    if not cam.ob: return True
    c = Vector(cam.pos); d = Vector(p) - c; L = d.length
    if L < 1e-6: return False
    d.normalize(); o = c.copy()
    for _ in range(8):
        ok, loc, nrm, idx, ob, mx = sc.ray_cast(dg, o, d, distance=L + tol - (o - c).length)
        if not ok: return True
        nm = ob.original.name if getattr(ob, 'original', None) else ob.name
        if (loc - c).length >= L - tol or nm in names: return True
        if _obj_kind(ob.original if getattr(ob, 'original', None) else ob) != 'solid' or not _rendered(ob): o = loc + d * 1e-4; continue
        return False
    return True


def _coplanar(items, f, cam, st, sc=None, dg=None):
    sol = [it for it in items if it.kind == 'solid' and it.on and it.px >= PX_THROUGH and len(it.L.tri) < 60000 and not it.L.heavy]
    sol.sort(key=lambda it: it.lo[0])
    def tol_at(p):
        w = float(cam.w(np.asarray(p)[None])[0]) if cam.ob else 10.0
        n = cam.near if cam.ob else 0.1
        return min(0.01, max(0.0002, w * w / (n * 2 ** 23)))
    def test(A, B, self_=False):
        P, N = A.samples(); hit = []
        tol = tol_at((A.lo + A.hi) / 2)
        m = ((P >= B.lo - tol) & (P <= B.hi + tol)).all(1)
        for i in np.nonzero(m)[0]:
            if cam.ob and float(np.dot(N[i], cam.pos - P[i])) <= 0: continue     # turned away from the camera: unseen
            p = Vector(P[i])
            if self_:
                own = set(A.L.tri[A.L.smp_t[i]].tolist())
                for loc, nrm, idx, d in B.bvh.find_nearest_range(p, tol):
                    # (a triangle sharing a corner with the sampled one is its neighbour in the same face, not a 2nd layer)
                    if idx != A.L.smp_t[i] and nrm is not None and float(np.dot(N[i], nrm)) > 0.996 and d < tol \
                            and not (own & set(A.L.tri[idx].tolist())) and _matname(A, idx) != _matname(A, A.L.smp_t[i]):
                        hit.append((i, d)); break
            else:
                loc, nrm, idx, d = B.bvh.find_nearest(p, tol)
                # (the same material on both: both draw the same colour, a flicker between them never shows)
                if loc is not None and float(np.dot(N[i], np.array(nrm))) > 0.996 and _matname(A, A.L.smp_t[i]) != _matname(B, idx):
                    hit.append((i, d))
        if len(hit) < 3: return
        # the shared area on screen: the hit share of the sampled surface
        area = A.warea * len(hit) / len(P)
        vis = [i for i, _ in hit if cam.onscreen(P[i])]
        if sc is not None: vis = [i for i in vis[:6] if _seen(sc, dg, cam, P[i], {A.name, B.name, A.src.name, B.src.name})]
        if not vis: return                                  # covered by something else (under the ground, inside a wall)
        at = P[vis[0]]; ppx = math.sqrt(max(area, 1e-12)) * cam.ppm(at)
        if ppx < 4: return
        b_ = B.name if not self_ else A.name + '(self)'
        if ppx < PX_COPLANAR: st.note('coplanar-small', f, A.name, b_, max(d for _, d in hit), ppx); return
        st.add('coplanar', f, A.name, b_, max(d for _, d in hit), ppx, at)
    for i, A in enumerate(sol):
        if st.late(): return
        if A.name not in st.cop_done:
            st.cop_done.add(A.name); test(A, A, True)
        for B in sol[i + 1:]:
            if B.lo[0] > A.hi[0] + 0.01: break
            k = tuple(sorted((A.name, B.name)))
            if k in st.cop_done or not _hit(A, B, 0.01): continue
            st.cop_done.add(k)
            a, b = (A, B) if A.L.area.sum() <= B.L.area.sum() else (B, A)
            test(a, b)


def _cutaway(items, f, cam, st, sections):
    for it in items:
        if it.kind != 'solid' or not it.on or it.secok or it.shell: continue
        V = it.wv[::max(1, len(it.wv) // 4000)]
        for s in sections:
            p0, n = np.array(s['p']), np.array(s['n']); n = n / max(np.linalg.norm(n), 1e-9)
            W = V
            if s.get('box'):
                b = s['box']; W = V[(V[:, 0] >= b[0]) & (V[:, 0] <= b[1]) & (V[:, 1] >= b[2]) & (V[:, 1] <= b[3]) & (V[:, 2] >= b[4]) & (V[:, 2] <= b[5])]
                if not len(W): continue
            d = (W - p0) @ n
            j = int(np.argmax(d)); dm = float(d[j])
            if dm <= 0.005 or float(d.min()) > -0.005: continue      # behind the cut, or wholly in front (a label)
            ppx = dm * cam.ppm(W[j])
            if ppx >= PX_MIN_DEFECT and cam.onscreen(W[j]): st.add('cutaway', f, it.name, s['name'], dm, ppx, W[j])
    # see-through shells (shell()): something mostly inside must stay inside
    for S in [it for it in items if it.shell and it.L.closed and not it.L.heavy]:
        for it in items:
            if it is S or it.kind != 'solid' or it.model == S.model or not _hit(it, S) or (it.groups & S.groups): continue
            if st.late(): return
            P, _ = it.samples(); ins = np.array([_inside(S.bvh, p) for p in P])
            fr = ins.mean()
            if fr < 0.5 or fr > 0.98: continue
            out = P[~ins]; dd = [S.bvh.find_nearest(Vector(p))[3] or 0 for p in out]
            j = int(np.argmax(dd)); ppx = dd[j] * cam.ppm(out[j])
            if ppx >= PX_MIN_DEFECT: st.add('cutaway', f, it.name, S.name, dd[j], ppx, out[j])


def _solid_names(items):
    return {it.name for it in items if it.kind == 'solid'} | {it.src.name for it in items if it.kind == 'solid'} | SOLID_NAMES


def _matname(it, t):
    m = getattr(it, 'mats', None)
    if not m: return ''
    i = int(it.L.mi[t]) if it.L.mi is not None and t < len(it.L.mi) else 0
    return m[min(max(i, 0), len(m) - 1)]


def _camclip(items, f, cam, st, sc, dg, solid=None):
    """The camera inside a closed solid, or its near plane cutting one open (a fan of 35 rays to the clip start)."""
    if not cam.ob: return
    c = Vector(cam.pos); n = cam.near
    for it in items:
        if it.kind == 'solid' and it.L.closed and not it.L.heavy and (it.lo - n <= cam.pos).all() and (cam.pos <= it.hi + n).all():
            if _inside(it.bvh, cam.pos):
                st.add('camclip', f, it.name, 'camera', 0.0, max(cam.W, cam.H)); return
    fr = [cam.ob.matrix_world @ v for v in cam.ob.data.view_frame(scene=sc)]       # the frame's 4 corners
    fwd = Vector(cam.fwd)
    solid = solid if solid is not None else _solid_names(items)
    hits, NR = {}, 0
    for u in (0.0, 0.25, 0.5, 0.75, 1.0):
        for v in (0.0, 0.17, 0.34, 0.5, 0.66, 0.83, 1.0):
            NR += 1
            a = fr[0].lerp(fr[3], u); b = fr[1].lerp(fr[2], u); q = a.lerp(b, v)
            d = (q - c); d.normalize(); far = n / max(1e-3, d.dot(fwd))
            o = c.copy()
            for _ in range(6):
                left = far - (o - c).length
                if left <= 0: break
                ok, loc, nrm, idx, ob, mx = sc.ray_cast(dg, o, d, distance=left)
                if not ok: break
                nm = ob.original.name if getattr(ob, 'original', None) else ob.name
                if nm not in solid or not _rendered(ob): o = loc + d * 1e-4; continue
                dep = (loc - c).dot(fwd); h = hits.setdefault(nm, [0, dep]); h[0] += 1; h[1] = min(h[1], dep); break
    for nm, (k, dep) in hits.items():
        st.add('camclip', f, nm, 'camera', dep, math.sqrt(k / NR * cam.W * cam.H))


# ---------------------------------------------------------------- the shot
def key_frames(f0, f1):
    """X-ray peaks (M.xray materials' gate/alpha keys at >= 0.5) and the frame after something appears."""
    out = set()
    for m in bpy.data.materials:
        nt = m.node_tree
        if not nt or not (nt.nodes.get('gate') or nt.nodes.get('alpha')): continue
        for fc in _fcurves(nt):
            for k in fc.keyframe_points:
                if k.co[1] >= 0.5 and f0 <= k.co[0] <= f1: out.add(int(round(k.co[0])))
    for o in bpy.context.scene.objects:
        for fc in _fcurves(o):
            if fc.data_path != 'hide_render': continue
            for k in fc.keyframe_points:
                if k.co[1] < 0.5 and f0 <= k.co[0] + 2 <= f1: out.add(int(round(k.co[0])) + 2)
    return out


def run(f0, f1, shot='shot', step_s=None, budget_s=None, limit=16, keys=(), quiet=False):
    """Check the built shot frames f0..f1; prints the CZ CONTACT lines and returns the findings."""
    if np is None:
        print('CZ CONTACTCHECK skipped (no numpy in this Blender)'); return []
    T0 = time.time()
    step_s = float(step_s or os.environ.get('CZ_CONTACT_STEP', '0.25'))
    fixed = bool(budget_s or os.environ.get('CZ_CONTACT_BUDGET'))
    budget_s = float(budget_s or os.environ.get('CZ_CONTACT_BUDGET', '4.0'))
    cap_s = float(os.environ.get('CZ_CONTACT_CAP', '15'))
    sc = bpy.context.scene
    st = _State(shot, T0 + budget_s, T0 + max(cap_s, budget_s))
    _LOCAL.clear(); _MK.clear(); SOLID_NAMES.clear(); _WC.clear(); _PAIR.clear(); _STAT.clear(); _STAT.update(read=0.0, heavy=0)
    try: sections = json.loads(sc.get('cz_sections', '[]'))
    except Exception: sections = []
    step = max(1, int(round(step_s * FPS)))
    reg = list(range(f0, f1 + 1, step)) + [f1]
    kf = sorted(key_frames(f0, f1) | set(int(k) for k in keys if f0 <= k <= f1))
    frames = []
    for f in kf + reg:                       # X-ray peaks first: the budget never skips the named thing's moment
        if all(abs(f - g) > 1 for g in frames): frames.append(f)
    frames = frames[:28]
    tf, nfr, nsol, prev, mov = 0.0, 0, 0, {}, set()
    cop_frames, solid_names, everseen = 0, set(), {}
    done = []
    for f in frames:
        if st.late(): break
        t1 = time.time()
        sc.frame_set(f); dg = bpy.context.evaluated_depsgraph_get(); cam = _Cam(sc, dg); _hidden_instances(sc)
        _t = time.time(); items = _gather(sc, dg, cam); done.append(f); _STAT["t_gather"] = _STAT.get("t_gather", 0) + time.time() - _t
        if len(done) == 1 and not fixed:     # a big set gets more time: 4 s, +1 s per 50 solids, up to 10 s (+ mesh reads)
            st.deadline = T0 + max(budget_s, min(10.0, len(items) / 50.0))
        for it in items:
            mk = it.M.tobytes()
            if it.name in prev and prev[it.name] != mk: mov.add(it.name)
            prev[it.name] = mk; everseen.setdefault(it.name, it)
        nsol = max(nsol, sum(1 for it in items if it.kind == 'solid' and it.on))
        solid_names |= _solid_names(items)
        _t = time.time(); _through(items, f, cam, st, sc=sc, dg=dg); _STAT["t_through"] = _STAT.get("t_through", 0) + time.time() - _t
        _t = time.time(); fl = _floating(items, f, cam, st, sc, dg); _STAT["t_floating"] = _STAT.get("t_floating", 0) + time.time() - _t
        if fl:     # in motion (falling, thrown, lowered into place): its bottom moves more than 2 % of its size in 3 frames
            g = f + 3 if f + 3 <= f1 else max(f0, f - 3)
            def zlow(parts, now):
                zs = [(_corners(p.L) @ (np.array(p.ob.matrix_world) if now else p.M)[:3, :3].T + (np.array(p.ob.matrix_world) if now else p.M)[:3, 3])[:, 2].min()
                      for p in parts if not getattr(p, 'inst', False)]
                return min(zs) if zs else 0.0
            za = [zlow(c[1], False) for c in fl]
            sc.frame_set(g); zb = [zlow(c[1], True) for c in fl]
            sc.frame_set(f); dg = bpy.context.evaluated_depsgraph_get(); _hidden_instances(sc)
            for (mdl, parts, gap, under, ctr, ppx), a, b in zip(fl, za, zb):
                big = max(float((p.hi - p.lo).max()) for p in parts)
                if g != f and abs(b - a) > max(0.02 * big, PX_MIN_DEFECT / cam.ppm(ctr)): continue
                st.add('floating', f, mdl, under, gap, ppx, ctr)
        if cop_frames < 3 or any(it.name in mov for it in items):
            _t = time.time(); _coplanar(items, f, cam, st, sc, dg); cop_frames += 1; _STAT["t_coplanar"] = _STAT.get("t_coplanar", 0) + time.time() - _t
        if sections or any(it.shell for it in items): _cutaway(items, f, cam, st, sections)
        _t = time.time(); _camclip(items, f, cam, st, sc, dg); _STAT["t_camclip"] = _STAT.get("t_camclip", 0) + time.time() - _t
        tf += time.time() - t1; nfr += 1
    # sweep: a dense pass of boxes on the frames in between finds passes the samples missed, then those frames get the
    # full through test; the camera's ray fan runs on them too (a camera flying through a wall between two samples)
    extra = 0; swept = False
    dense = [g for g in range(f0, f1 + 1, 2) if all(abs(g - h) > 1 for h in frames)]
    if not st.late() and dense:
        swept = True
        seen = {k[1:] for k in st.found if k[0] == 'through'}
        cand = {}
        sc.frame_set(frames[0]); dg = bpy.context.evaluated_depsgraph_get(); cam0 = _Cam(sc, dg); _hidden_instances(sc)
        base_all = _gather(sc, dg, cam0); base_all += [it for n, it in everseen.items() if n not in {b.name for b in base_all}]   # (a mover off screen at the first frame still counts)
        base = {it.name: it for it in base_all if it.kind == 'solid' and not it.env and not getattr(it, 'inst', False)}
        still = [it for it in base_all if it.kind == 'solid' and it.L.closed and it.name not in mov and not getattr(it, 'inst', False)]
        movers = [n for n in mov if n in base]
        for g in dense:
            if st.late(): swept = False; break
            sc.frame_set(g); dg = bpy.context.evaluated_depsgraph_get(); extra += 1; _hidden_instances(sc)
            _camclip(still, g, _Cam(sc, dg), st, sc, dg, solid=solid_names)
            if not movers: continue
            cur = {n: _Item(n, base[n].ob, base[n].L, base[n].ob.matrix_world, base[n].src) for n in movers}
            for n in movers:
                A, a0 = cur[n], base[n]
                for b in base.values():
                    if b.name == n or b.model == a0.model or (a0.fam and a0.fam == b.fam) or (b.groups & a0.groups): continue
                    B = cur.get(b.name, b)
                    if not _hit(A, B): continue
                    r = _vol(np.maximum(A.lo, B.lo), np.minimum(A.hi, B.hi)) / max(1e-12, min(_vol(A.lo, A.hi), _vol(B.lo, B.hi)))
                    k = tuple(sorted((n, b.name)))
                    if k in seen or r < 0.15: continue
                    if k not in cand or r > cand[k][1]: cand[k] = (g, r)
        for g in sorted({v[0] for v in cand.values()})[:6]:
            if st.late(): swept = False; break
            sc.frame_set(g); dg = bpy.context.evaluated_depsgraph_get(); cam = _Cam(sc, dg); _hidden_instances(sc)
            _through(_gather(sc, dg, cam), g, cam, st, typ='sweep', only={k for k, v in cand.items() if v[0] == g}, sc=sc, dg=dg)
    sc.frame_set(f0)
    ms = 1000 * tf / max(1, nfr)
    out = sorted(st.found.values(), key=lambda x: (x['f'], x['type']))
    left = [f for f in frames if f not in done]
    if not quiet:
        for x in out[:limit]:
            print(f"CZ CONTACT {x['type']} {shot} f={x['f']} {x['a']} x {x['b']} depth={x['depth']:.3f} px={x['px']} fix: {FIX[x['type']]}")
        # (overlaps the camera can't see, z-fights under 12 px: info for the builder, never a failure; check.ts and
        # signoff.py skip them)
        for x in sorted(st.info.values(), key=lambda x: x['f'])[:limit]:
            if any(y['a'] in (x['a'], x['b']) and y['b'] in (x['a'], x['b']) for y in out): continue
            why = '(too small to flicker)' if x['type'] == 'coplanar-small' else '(not in view)'
            print(f"CZ CONTACTINFO {x['type']} {shot} f={x['f']} {x['a']} x {x['b']} depth={x['depth']:.3f} px={x['px']} {why}")
        tot = time.time() - T0
        more = f" (+{len(out) - limit} more)" if len(out) > limit else ''
        heavy = f", {_STAT['heavy']} heavy meshes by proxy, {_STAT['read']:.1f} s reading meshes" if _STAT['heavy'] else ''
        if st.partial or ms > 300:     # where the time went (seconds over the whole shot)
            heavy += ' [' + ', '.join(f'{k[2:]} {v:.1f} s' for k, v in _STAT.items() if k.startswith('t_')) + ']'
        part = f' +{len(st.info)} info' if st.info else ''
        if st.partial:
            # never "clean" when it did not look everywhere (fix round B4): one line in the CZ CONTACT shape (type
            # `partial`, a note: check.ts / signoff.py list it, it never blocks the export) + a partial summary
            what = (f'{len(done)} of {len(frames)} frames' + ('' if swept or not dense else ', no sweep pass'))
            fl_ = ','.join(str(f) for f in left[:12]) or 'the sweep'
            print(f"CZ CONTACT partial {shot} f={left[0] if left else f1} checked x {len(done)}/{len(frames)} depth=0.000 px=0 "
                  f"fix: the overlap check ran out of time ({tot:.1f} s) after {what}; unchecked: f={fl_}. LOOK at those frames "
                  f"for clips and gaps, or give far heavy props ob['cz_nocontact'] = True (scenery the camera never comes near)")
        if out:
            kinds = ', '.join(f'{k} x{sum(1 for x in out if x["type"] == k)}' for k in FIX if any(x['type'] == k for x in out))
            print(f'CZ CONTACTCHECK {len(out)} findings{more} in {nfr} frames ({kinds}): {nsol} solids, {ms:.0f} ms/frame, '
                  f'{tot:.1f} s{heavy}{part}' + (f' PARTIAL ({len(done)}/{len(frames)} frames)' if st.partial else ''))
        elif st.partial:
            print(f'CZ CONTACTCHECK partial ({nsol} solids, {len(done)}/{len(frames)} frames + {extra} sweep, {ms:.0f} ms/frame, '
                  f'{tot:.1f} s{heavy}){part}: NOT clean, the time budget ran out')
        else:
            print(f'CZ CONTACTCHECK clean ({nsol} solids, {nfr} frames + {extra} sweep, {ms:.0f} ms/frame, {tot:.1f} s{heavy}){part}')
    return out
