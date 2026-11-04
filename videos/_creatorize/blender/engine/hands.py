# HANDS AND HOLDING for the mega engine: a port of the 3D reconstruction's lib/hands.js. Every object a person holds goes
# through hold(): the prop rides the hand bone with an offset computed ONCE from the visible palm and the prop's grip
# frame (Child Of, keyed: no drift, no pop); the solve is recon's solveHand: the palm pushed out of / onto the object,
# the fingers closed joint after joint until their visible vertices touch it (closeFinger, the thumb swinging in from
# outside), every skin-blended finger vertex verified (verifyVerts), what no finger can fix moved off the palm along its
# normal. Use poses (USES: chest / head anchors, the ear, the mouth, 'scene') and the second hand of two-hand grips are IK;
# 'hang' turns the hand every frame so the prop hangs straight (hangStraight); rest() puts hands down on a surface every
# frame; hold_issues() is recon's HOLD check with its tolerances, on the drawn meshes (CZ HOLD lines).
#   import human as H, hands as HD
#   hammer = HD.kit('hammer', at=(1, 0, 0.8))                 # recon's own kit prop geometry (30 kinds with grips)
#   HD.hold(f, hammer, 'handle')                              # held all along (grip default: the kind's first)
#   HD.hold(f, can, 'wrap', side='L', t0=2.0, t1=6.0)         # picked up at 2 s from where it rests, put back at 6 s
#   HD.handover(a, b, hammer, 'handle', t=4.0, side_b='L')    # a until 4 s, b from 4 s (exchange point both can reach)
#   HD.rest(f, desk, 1.0, 5.0)                                # hands down onto a surface (typing, writing)
#   HD.hold_issues()                                          # prints CZ HOLD lines
# Data: engine/data/hands.json + kit_props.json, generated from hands.js + props.js by tools/hands_data/hands_data.mjs.
import bpy, bmesh, json, math, re
from pathlib import Path
from mathutils import Matrix, Quaternion, Vector
from mathutils.bvhtree import BVHTree
import cz
import human as H

FPS = cz.FPS
DD = Path(__file__).resolve().parent / 'data'
DATA = json.loads((DD / 'hands.json').read_text(encoding='utf-8'))
VERIFIED, POSES, USES, CLIP_SHORT, PROPS, BAR_BEST = DATA['verified'], DATA['poses'], DATA['uses'], DATA['clipShort'], DATA['props'], DATA.get('barBest') or {}
_KIT = None
FINGERS = ('thumb', 'index', 'middle', 'ring', 'pinky')
HOLDS, RESTS = [], []
REACH, LIFT = 0.5, 0.45
DBG = bool(__import__("os").environ.get("CZ_HANDDBG"))
ANCHOR = {'chest': 'spine_03', 'head': 'Head', 'pelvis': 'pelvis'}
AXB = {'x': 0, 'y': 2, 'z': 1}          # a recon axis -> the Blender axis (mirror)


def rv(v): return Vector((v[0], -v[2], v[1]))           # recon prop vector -> Blender prop vector
def uv(v, sg=1): return Vector((sg * v[0], -v[2], v[1]))  # recon use space (s, u, f) -> armature (x left, -y fwd, z up)
def smoother(u): return H.smoother(u)


# ------------------------------------------------------------------------------------------------- VERIFIED
def is_verified(kind, grip, body, side, clip):
    s = ((VERIFIED.get(f'{kind}|{grip}') or {}).get(body) or {}).get(side.upper())
    if s is None: return False
    short, *full = s.split(' ')
    return any(CLIP_SHORT.get(k) == clip for k in short) or clip in full


def verified_options(kind=None, grip=None, body=None, side=None):
    """[(kind|grip, body, hand, [clips])] rows of the VERIFIED table (filters optional)."""
    out = []
    for kg, row in VERIFIED.items():
        k, g = kg.split('|')
        if kind and k != kind or grip and g != grip: continue
        for b, sides in row.items():
            if body and b != body: continue
            for hd, s in sides.items():
                if side and hd != side.upper(): continue
                short, *full = s.split(' '); out.append((kg, b, hd, [CLIP_SHORT[c] for c in short if c in CLIP_SHORT] + full))
    return out


def _alt(kind, grip, body):
    opts = verified_options(kind, grip, body)
    if opts: return '; verified: ' + ', '.join(f'{b} {h} hand with {"/".join(c[:5])}' for _, b, h, c in opts[:4])
    opts = verified_options(kind)
    if opts: return '; verified grips of this kind: ' + ', '.join(sorted({o[0] for o in opts}))
    return '; verified kinds: ' + ', '.join(sorted({o.split('|')[0] for o in VERIFIED}))


# ------------------------------------------------------------------------------------------------- the hand rig (once per body)
_RIG = {}
def rig(body):
    """recon handData per side, in the armature's rest space: the palm frame (X, F = wrist -> middle knuckle, N = out of the
    palm; the palm point on the visible palm surface), finger chains (joints, flexion / opposition / spread axes), the
    visible vertices per phalanx (sampled, rigid + skin weights) and the palm vertices."""
    if body in _RIG: return _RIG[body]
    B = H._body(body); arm, me = B['arm'], B['mesh'].data
    bones = arm.data.bones; gn = {g.index: g.name for g in B['mesh'].vertex_groups}
    W = {}; dom = {}
    for v in me.vertices:
        ws = [(gn.get(g.group, ''), g.weight) for g in v.groups if g.weight > 1e-4]
        if not ws: continue
        W[v.index] = ws; dom.setdefault(max(ws, key=lambda x: x[1])[0], []).append(v.index)
    out = {}
    for s in 'lr':
        hb = bones[f'hand_{s}']; Hh = hb.head_local.copy()
        mid, idx, pk = (bones[f'{f}_01_{s}'].head_local for f in ('middle', 'index', 'pinky'))
        F = (mid - Hh).normalized(); N = F.cross(idx - pk).normalized()
        if N.z > 0: N.negate()                                  # palms face down in the bind T-pose
        X = F.cross(N).normalized(); N = X.cross(F).normalized()
        L = (mid - Hh).length; xc = ((idx + pk) / 2 - Hh).dot(X)
        palmV = [me.vertices[i].co.copy() for i in dom.get(f'hand_{s}', [])]
        cand = sorted((p - Hh).dot(N) for p in palmV if .35 < (p - Hh).dot(F) / L < .8 and abs((p - Hh).dot(X) - xc) < .018 and (p - Hh).dot(N) > 0)
        nsurf = cand[int(len(cand) * .9)] if cand else .012
        P = Hh + X * xc + F * (.58 * L) + N * nsurf
        palm = Matrix((X, F, N)).transposed().to_4x4(); palm.translation = P
        palm_pts = [p for p in palmV if (p - Hh).dot(N) > 0 and ((p - P) - N * (p - P).dot(N)).length < .065]
        chains = {}; bidx = {}
        for fn in FINGERS:
            names = [f'{fn}_0{k}_{s}' for k in (1, 2, 3)]
            if any(n not in bones for n in names): continue
            J = [bones[n].head_local.copy() for n in names]
            leaf = f'{fn}_04_leaf_{s}'; v3 = [me.vertices[i].co for i in dom.get(names[2], []) + dom.get(leaf, [])]
            tip = bones[leaf].head_local.copy() if leaf in bones else bones[names[2]].tail_local.copy()
            d3 = (tip - J[2]).normalized()
            if v3: tip = J[2] + d3 * max((p - J[2]).dot(d3) for p in v3)
            J.append(tip)
            axes = []
            for k in range(3):
                d = (J[k + 1] - J[k]).normalized()
                axes.append(d.cross(N).normalized() if fn != 'thumb' else d.cross(X * (-1 if s == 'r' else 1)).normalized())
            ch = {'fn': fn, 'names': names, 'J': J, 'axes': axes, 'rest': [bones[n].matrix_local.to_quaternion() for n in names], 'opp': None, 'spr': None}
            for k in range(3):                                   # a positive angle moves the tip toward the palm side (N)
                a = [0, 0, 0]; a[k] = .2
                if (_tip(ch, a) - Hh).dot(N) < (_tip(ch, [0, 0, 0]) - Hh).dot(N) - 1e-7: ch['axes'][k] = -ch['axes'][k]
            if fn == 'thumb':
                ch['opp'] = F.copy()
                if (_tip(ch, [0, 0, 0], .3) - Hh).dot(N) < (_tip(ch, [0, 0, 0]) - Hh).dot(N) - 1e-7: ch['opp'] = -ch['opp']
                ch['spr'] = N.copy()
                if (_tip(ch, [0, 0, 0], 0, .3) - idx).length < (_tip(ch, [0, 0, 0]) - idx).length: ch['spr'] = -ch['spr']
            for k, n in enumerate(names): bidx[n] = (fn, k)
            bidx[leaf] = (fn, 2)
            samp = []
            for k in range(3):
                ids = dom.get(names[k], []) + (dom.get(leaf, []) if k == 2 else [])
                n = 1 if fn == 'thumb' and k == 0 else max(1, len(ids) // 120)     # (hands.js: 1 in len/120)
                samp.append([me.vertices[i].co.copy() for i in ids[::n]])
            ch['samp'] = samp
            chains[fn] = ch
        # skin-blended hand vertices (verifyVerts): weights over (finger, phalanx) and the rest (rigid with the hand)
        hv = []
        for n, ids in dom.items():
            if not re.match(rf'^(hand|thumb|index|middle|ring|pinky)(_0[1-4](_leaf)?)?_{s}$', n): continue
            for i in ids:                                   # (hands.js verifyVerts: every hand vertex)
                ws = W[i]; t = sum(w for _, w in ws) or 1
                fw = [(bidx.get(b), w / t) for b, w in ws]
                if any(b for b, _ in fw): hv.append((me.vertices[i].co.copy(), fw))
        hand_v = [i for n, ids in dom.items() if re.match(rf'^(hand|thumb|index|middle|ring|pinky)(_0[1-4](_leaf)?)?_{s}$', n) for i in ids]
        fverts = {fn: dom.get(f'{fn}_02_{s}', []) + dom.get(f'{fn}_03_{s}', []) + dom.get(f'{fn}_04_leaf_{s}', []) for fn in FINGERS}
        ua, la = bones[f'upperarm_{s}'].head_local, bones[f'lowerarm_{s}'].head_local
        out[s] = {'palm': palm, 'palm_in_hand': hb.matrix_local.inverted() @ palm, 'chains': chains, 'F': F, 'N': N, 'X': X, 'P': P,
                  'palm_pts': palm_pts, 'hv': hv, 'verts': hand_v, 'fverts': fverts, 'arm_len': (ua - la).length + (la - Hh).length,
                  'hand_name': f'hand_{s}'}
    # the body (not hands / arms) for clearBody, and the head (ear / mouth frames)
    body_v = [me.vertices[i].co.copy() for n, ids in dom.items() if not re.match(r'^(hand|thumb|index|middle|ring|pinky|lowerarm|upperarm)', n) for i in ids[::3]]
    head_v = [me.vertices[i].co.copy() for n in ('Head', 'neck_01') for i in dom.get(n, [])[::2]]
    out['body_v'], out['head_v'] = body_v, head_v
    _RIG[body] = out; return out


def fk(ch, ang, opp=0.0, spr=0.0):
    """recon fk in rest space: [M0, M1, M2], phalanx k's rest points -> posed (opposition, spread, then flexion at joint 0)."""
    J, A = ch['J'], ch['axes']; Ms = []; M = Matrix.Identity(4)
    for k in range(3):
        R = Matrix.Identity(3)
        if k == 0 and ch['opp'] is not None and opp: R = R @ Quaternion(ch['opp'], opp).to_matrix()
        if k == 0 and ch['spr'] is not None and spr: R = R @ Quaternion(ch['spr'], spr).to_matrix()
        R = R @ Quaternion(A[k], ang[k]).to_matrix()
        M = M @ Matrix.Translation(J[k]) @ R.to_4x4() @ Matrix.Translation(-J[k]); Ms.append(M)
    return Ms


def _tip(ch, ang, opp=0.0, spr=0.0): return fk(ch, ang, opp, spr)[2] @ ch['J'][3]


def _local_q(ch, ang, opp, spr):
    """Each phalanx's own rotation (rest space) -> pose bone basis quaternions."""
    out = []
    for k in range(3):
        q = Quaternion()
        if k == 0 and ch['opp'] is not None and opp: q = q @ Quaternion(ch['opp'], opp)
        if k == 0 and ch['spr'] is not None and spr: q = q @ Quaternion(ch['spr'], spr)
        q = q @ Quaternion(ch['axes'][k], ang[k]); Rk = ch['rest'][k]
        out.append((Rk.inverted() @ q @ Rk).normalized())
    return out


# ------------------------------------------------------------------------------------------------- grips + props
def kind_of(prop): return prop.get('cz_kind') or re.sub(r'\.\d{3}$', '', prop.name)


def _local_box(prop):
    inv = prop.matrix_world.inverted(); lo = Vector((1e9,) * 3); hi = Vector((-1e9,) * 3)
    for o in [prop] + list(prop.children_recursive):
        if o.type != 'MESH': continue
        for c in o.bound_box:
            p = inv @ (o.matrix_world @ Vector(c)); lo = Vector(map(min, lo, p)); hi = Vector(map(max, hi, p))
    return lo, hi


def _grips(prop, kind):
    gs = prop.get('cz_grips'); gs = json.loads(gs) if isinstance(gs, str) else (gs or (PROPS.get(kind) or {}).get('grips') or {})
    if not gs: raise ValueError(f'hands: "{kind}" has no grips (kinds with grips: {", ".join(sorted(PROPS))}); give the prop kind= or cz_grips')
    return gs


def resolve_grip(prop, kind, grip=None, side=None):
    gs = _grips(prop, kind); name = grip or next(iter(gs)); g = gs.get(name)
    if g is None: raise ValueError(f'hands: "{kind}" has no grip "{grip}" (its grips: {", ".join(gs)})')
    want = g.get('hand', 'any'); s = (side or ('L' if want == 'L' else 'R')).lower()[0]
    mir = (g.get('mirror', 'x') if (want != 'any' and want.lower() != s) or (want == 'any' and s == 'l') else None)
    return name, g, s, mir


def _fit(prop, kind):
    """recon prop coords -> this prop's local coords (a kit prop: exact; any other model of the kind: fitted to its bbox)."""
    size = (PROPS.get(kind) or {}).get('size'); lo, hi = _local_box(prop); c = (lo + hi) / 2; sc = Vector((1, 1, 1))
    if size and not prop.get('cz_kit'): bs = hi - lo; sc = Vector((bs.x / max(1e-6, size[0]), bs.y / max(1e-6, size[2]), bs.z / max(1e-6, size[1])))
    if prop.get('cz_kit'): c = Vector((0, 0, 0)); lo = Vector((0, 0, 0))
    return lambda p: Vector((c.x + p.x * sc.x, c.y + p.y * sc.y, lo.z + p.z * sc.z))


def grip_frame(prop, kind, g, mir, flip=False):
    """recon gripFrame: (X = F x N, F, N) at pos, prop-local Blender coordinates; flip = turned 180 deg about the prop's up."""
    fit = _fit(prop, kind); p, Fv, Nv = rv(g['pos']), rv(g['fingers']).normalized(), rv(g['palm'])
    if mir:
        k = AXB[mir]
        for v in (p, Fv, Nv): v[k] = -v[k]
    p = fit(p); Nv = (Nv - Fv * Nv.dot(Fv)).normalized(); Xv = Fv.cross(Nv).normalized()
    G = Matrix((Xv, Fv, Nv)).transposed().to_4x4(); G.translation = p
    if flip: G = Matrix.Rotation(math.pi, 4, 'Z') @ G
    return G


def _vec_mir(v, mir, flip):
    v = rv(v)
    if mir: v[AXB[mir]] = -v[AXB[mir]]
    if flip: v = Vector((-v.x, -v.y, v.z))
    return v


RAYD = Vector((.5774, .5771, .5776)).normalized()      # hands.js insidePart's ray (skewed: never along an edge of a box)
RAYD2 = Vector((-.6123, .3311, -.7181)).normalized(); RAYD3 = Vector((.2133, -.9127, .3485)).normalized()
_CLOSED = {}


def _is_closed(o, me):
    """hands.js propTris' closed parts: a kit part carries the exported flag (planes, tubes, rings ... open); any other
    mesh is closed when no edge has a single face (a sheet, an open cup's rim: open)."""
    if 'cz_open' in o: return not o['cz_open']
    k = (me.name, len(me.vertices), len(me.polygons))
    if k not in _CLOSED:
        cnt = {}
        for p in me.polygons:
            for ek in p.edge_keys: cnt[ek] = cnt.get(ek, 0) + 1
        _CLOSED[k] = bool(cnt) and all(c >= 2 for c in cnt.values())
    return _CLOSED[k]


class Geo:
    """hands.js propTris + surfDist + insidePart + signedDist: the prop's parts in a frame (a BVH each, its box, closed
    or open), the unsigned distance to the nearest surface, and INSIDE = ray parity against a closed part. (Round 3: the
    port had taken the sign from the nearest face's normal, which is wrong at every edge and corner: a finger beside a
    sheet's edge read 30-99 mm 'inside' the papers, fingers stopped closing in mid-air near a can's rim.)"""
    def __init__(self, prop, M=None, world=False):
        # world=True: world space, but stored around the prop's origin (BVH trees are float32: at 20 m from the world origin a
        # ray restarted 1e-6 m past a hit found the same triangle again and the parity counted it twice)
        inv = prop.matrix_world.inverted(); dg = bpy.context.evaluated_depsgraph_get()
        self.o = prop.matrix_world.translation.copy() if world else Vector()
        I = (Matrix.Translation(-self.o) @ prop.matrix_world) if world else (M if M is not None else Matrix())
        self.parts = []; av, af = [], []
        for o in [prop] + list(prop.children_recursive):
            if o.type != 'MESH' or o.get('cz_nohold'): continue
            # (each part's place in the prop from the parent chain's local matrices, not inv @ o.matrix_world: once the prop
            # has its Child Of the two world matrices are not refreshed together, and the second hand's solve saw the prop
            # somewhere else - every finger 'gap 50 mm', fingers closed into the box: the box thumb 60 mm inside)
            L = Matrix(); x = o
            while x is not None and x != prop: L = x.matrix_local @ L; x = x.parent
            if x is None: L = inv @ o.matrix_world
            oe = o.evaluated_get(dg); me = oe.to_mesh(); T = I @ L
            vs = [T @ v.co for v in me.vertices]; fs = [tuple(p.vertices) for p in me.polygons]
            closed = _is_closed(o, me); oe.to_mesh_clear()
            if not vs or not fs: continue
            lo = Vector(map(min, *vs)) if len(vs) > 1 else vs[0].copy(); hi = Vector(map(max, *vs)) if len(vs) > 1 else vs[0].copy()
            self.parts.append((BVHTree.FromPolygons(vs, fs) if closed else None, lo, hi))
            n0 = len(av); av += vs; af += [tuple(n0 + i for i in f) for f in fs]
        self.all = BVHTree.FromPolygons(av, af)
        if av:
            self.lo = Vector(map(min, *av)); self.hi = Vector(map(max, *av))
        else: self.lo = self.hi = Vector()

    @staticmethod
    def _odd(bvh, p, d):
        n = 0; o = p
        for _ in range(64):
            loc, nrm, i, dd = bvh.ray_cast(o, d)
            if loc is None: break
            n += 1; o = loc + d * 2e-5
        return n % 2 == 1

    def inside(self, p):
        # (parity on two rays, a third when they disagree: one ray through a long thin cylinder's sliver triangles miscounted
        # with the staff's orientation - a fingertip read 25 mm 'inside' a 15 mm radius pole at some frames only)
        p = p - self.o
        for bvh, lo, hi in self.parts:
            if bvh is None or not (lo.x <= p.x <= hi.x and lo.y <= p.y <= hi.y and lo.z <= p.z <= hi.z): continue
            a = self._odd(bvh, p, RAYD); b = self._odd(bvh, p, RAYD2)
            if a == b:
                if a: return True
            elif self._odd(bvh, p, RAYD3): return True
        return False

    def dist(self, p, cap=1.0):
        loc, nrm, i, d = self.all.find_nearest(p - self.o, cap)
        return cap if loc is None else d

    def sd(self, p, cap=1.0):                  # signed: < 0 = inside by that depth (capped)
        d = self.dist(p, cap)
        return -d if self.inside(p) else d


def _bvh(prop, M=None): return Geo(prop, M)


class Q:
    """Point queries against the prop in a frame, the prop moved by `shift` along N (recon's move())."""
    def __init__(self, geo, N): self.g, self.N, self.shift = geo, N, 0.0
    def sd(self, p, cap=.05):                 # signed distance (< 0 inside), capped
        return self.g.sd(p - self.N * self.shift, cap)
    def dist(self, p, cap=.05): return self.g.dist(p - self.N * self.shift, cap)
    def inside(self, p): return self.g.inside(p - self.N * self.shift)


def _caps_hit(ch, Ms, q, frm, margin):
    """hands.js capsHit: any visible vertex sample of phalanges frm..2 within margin of the prop, or inside it."""
    for k in range(frm, 3):
        M = Ms[k]
        for v in ch['samp'][k]:
            p = M @ v
            if q.dist(p, margin + 1e-4) < margin or q.inside(p): return True
    return False


def close_finger(ch, tgt, opp, q, margin, spread=0.0, frm=0.0):
    """recon closeFinger: the thumb swings in from outside until it touches; then joints k..2 close together (in the pose's
    proportions) until any of their phalanges touches; a phalanx that already touches stays, the joints after it may close."""
    tgt = tgt or [0, 0, 0]; ang = [0.0, 0.0, 0.0] if ch['opp'] is not None else [x * frm for x in tgt]; stopped = [False] * 3; o = 0.0
    if ch['opp'] is not None:
        o = min(0.0, opp)
        while o > -1.2 and _caps_hit(ch, fk(ch, ang, o, spread), q, 0, margin): o -= .06
        if opp > o:
            lo, hi, hit = o, opp, False
            for i in range(1, 21):
                x = o + (opp - o) * i / 20
                if _caps_hit(ch, fk(ch, ang, x, spread), q, 0, margin): hi = x; lo = o + (opp - o) * (i - 1) / 20; hit = True; break
            if hit:
                for _ in range(7):
                    m = (lo + hi) / 2
                    if _caps_hit(ch, fk(ch, ang, m, spread), q, 0, margin): hi = m
                    else: lo = m
                o = lo
            else: o = opp
    for k in range(3):
        if _caps_hit(ch, fk(ch, ang, o, spread), q, k, margin): stopped[k] = True; continue
        base = ang[:]; span = [max(0.0, tgt[i] - base[i]) if i >= k else 0.0 for i in range(3)]
        if all(x < 1e-4 for x in span): continue
        at = lambda l: [base[i] + span[i] * l for i in range(3)]
        lo, hi, hit = 0.0, 1.0, False
        for i in range(1, 25):
            l = i / 24
            if _caps_hit(ch, fk(ch, at(l), o, spread), q, k, margin): hi = l; lo = (i - 1) / 24; hit = True; break
        if hit:
            for _ in range(7):
                m = (lo + hi) / 2
                if _caps_hit(ch, fk(ch, at(m), o, spread), q, k, margin): hi = m
                else: lo = m
            stopped[k] = True
        ang = at(lo if hit else 1.0)
        if not hit: break
    return {'ang': ang, 'opp': o, 'spread': spread, 'stopped': stopped}


def _verify(S, angles, q):
    """recon verifyVerts: the deepest skin-blended finger vertex inside the prop, per finger."""
    Mp = {fn: fk(S['chains'][fn], a['ang'], a['opp'], a.get('spread', 0)) for fn, a in angles.items()}; D = {}
    for v, fw in S['hv']:
        p = Vector((0, 0, 0)); fn = None
        for b, w in fw:
            if b and b[0] in Mp: p += (Mp[b[0]][b[1]] @ v) * w; fn = fn or b[0]
            else: p += v * w
        if not fn: continue
        d = q.sd(p, .03)
        if d < 0: D[fn] = max(D.get(fn, 0.0), -d)
    return D


def solve_hand(R, s, prop, G, pose_name, scale=1.0, contact=None, palm_touch=True):
    """recon solveHand: X = the prop in the armature's rest space (palm @ G^-1), shift = how far the solve moved it off the
    palm along N, angles per finger. 8 rounds: palm out of / onto the object, fingers closed + verified, then a push."""
    pose = POSES[pose_name]; S = R[s]; N = S['N']; pc = S['P']
    M = S['palm'] @ Matrix.Scale(1.0 / scale, 4) @ G.inverted()
    q = Q(_bvh(prop, M), N); margin = {fn: .0006 for fn in S['chains']}; angles = {}
    contact = contact if contact is not None else pose.get('contact', [])
    for rnd in range(8):
        for _ in range(6):                                       # 1. the palm: never inside; resting on it for palm poses
            deep, near = 0.0, 1.0
            for p in S['palm_pts']:
                d = q.sd(p, .08)
                if d < 0: deep = max(deep, -d)
                else: near = min(near, d)
            step = deep + .0006 if deep > 2e-4 else (-(near - .0008) if rnd == 0 and pose.get('palm') and palm_touch and .0015 < near < .03 else 0.0)
            if not step: break
            q.shift += step
        worst = 0.0
        for _ in range(3):                                       # 2. fingers close, the skinned vertices verify
            for fn, ch in S['chains'].items():
                th = fn == 'thumb'
                angles[fn] = close_finger(ch, pose['thumb']['flex'] if th else pose['f'][fn], pose['thumb'].get('opp', 0) if th else 0.0, q, margin[fn],
                                          pose['thumb'].get('spread', 0) if th else 0.0, 0.0 if th else pose.get('from', 0.0))
            if 'thumb' in S['chains'] and 'thumb' in contact and _distal_gap(S['chains']['thumb'], angles['thumb'], q) > .002:
                best, bg = angles['thumb'], _distal_gap(S['chains']['thumb'], angles['thumb'], q)
                for dsp in (-.3, .3, -.6, .6, -.9):
                    a = close_finger(S['chains']['thumb'], pose['thumb']['flex'], pose['thumb'].get('opp', 0), q, margin['thumb'], pose['thumb'].get('spread', 0) + dsp)
                    gp = _distal_gap(S['chains']['thumb'], a, q)
                    if gp < bg - 1e-4: best, bg = a, gp
                    if bg <= .002: break
                angles['thumb'] = best
            bad = _verify(S, angles, q); anyb = False; worst = 0.0
            for fn, d in bad.items():
                if d > 2e-4: margin[fn] = min(.006, margin[fn] + d + .0008); anyb = True; worst = max(worst, d)
            if not anyb: break
        if worst <= 2e-4: break
        if DBG: print("CZ HANDDBG round", rnd, "shift", round(q.shift * 1000, 1), {k: round(v * 1000, 1) for k, v in bad.items()}, {k: round(v * 1000, 1) for k, v in margin.items()})
        q.shift += worst + .0008                                 # 3. still inside: the object moves off the hand
    rep = {}
    for fn, ch in S['chains'].items():
        a = angles[fn]; Ms = fk(ch, a['ang'], a['opp'], a.get('spread', 0))
        gap = min((q.sd(Ms[k] @ v, .05) for k in range(3) for v in ch['samp'][k]), default=1)
        rep[fn] = {'gap_mm': round(max(0, gap) * 1000, 1), 'need': fn in contact}
    return {'angles': angles, 'shift': q.shift, 'report': rep, 'pose': pose_name, 'contact': contact}


def _distal_gap(ch, a, q):
    Ms = fk(ch, a['ang'], a['opp'], a.get('spread', 0))
    return min((q.sd(Ms[k] @ v, .05) for k in (1, 2) for v in ch['samp'][k]), default=1)


# ------------------------------------------------------------------------------------------------- keys, IK, actions, bakes
def _key(owner, path, keys, interp='LINEAR'):
    for t, v in keys:
        setattr(owner, path, v); owner.keyframe_insert(path, frame=1 + t * FPS)
    ad = owner.id_data.animation_data
    if ad and ad.action:
        for s, fc in H._fcurves(ad.action):
            if fc.data_path.endswith(path) and (not hasattr(owner, 'name') or f'"{owner.name}"' in fc.data_path or fc.data_path == path):
                for kp in fc.keyframe_points: kp.interpolation = interp


def _clear_keys(c):
    ad = c.id_data.animation_data
    if ad and ad.action:
        for s_, fc in list(H._fcurves(ad.action)):
            if f'"{c.name}"' in fc.data_path: fc.keyframe_points.clear()


def _empty(name, mw=None, parent=None):
    e = bpy.data.objects.new(name, None); bpy.context.scene.collection.objects.link(e); e.empty_display_size = .05
    if parent is not None:
        e.parent = parent; bpy.context.view_layer.update(); e.matrix_parent_inverse = parent.matrix_world.inverted()
    if mw is not None: e.matrix_world = mw
    return e


def _ik(f, s, target, keys, name, rot=True):
    """Arm IK (upperarm + lowerarm) to the target's location + the hand bone's rotation copied from it, keyed."""
    if f.arm.pose is None: bpy.context.view_layer.update()
    lo = f.arm.pose.bones[f'lowerarm_{s}']; hb = f.arm.pose.bones[f'hand_{s}']
    # (on the HAND bone, use_tail off: the chain lowerarm + upperarm brings the hand's HEAD (the wrist) to the target; the
    # imported lowerarm's tail is not at the wrist, so an IK on the lowerarm tail missed by ~1 cm)
    ik = hb.constraints.new('IK'); ik.name = f'ik {name}'; ik.target = target; ik.chain_count = 2; ik.use_tail = False; ik.use_stretch = False
    cr = None
    if rot: cr = hb.constraints.new('COPY_ROTATION'); cr.name = f'rot {name}'; cr.target = target; _key(cr, 'influence', keys)
    _key(ik, 'influence', keys)
    return ik, cr


def _finger_track(f, s, sol, keys, name):
    """The solved finger pose as an NLA strip (REPLACE, finger bones only) on its own top track, its influence keyed."""
    R = rig(f.body)[s]; act, slot, cb = H._new_action(f'hand {f.name} {name}')
    for fn, ch in R['chains'].items():
        a = sol['angles'].get(fn)
        if not a: continue
        for k, b in enumerate(_local_q(ch, a['ang'], a['opp'], a.get('spread', 0))):
            # (two keys an hour apart: the strip spans the whole shot. A one-key action made a 1-frame strip, and past a strip's end
            # Blender reads its animated influence AT that end: a pick-up's fingers never closed, a put-down's never opened)
            for i in range(4): H._put(cb, f'pose.bones["{ch["names"][k]}"].rotation_quaternion', i, [1.0, 1.0 + 3600 * FPS], [b[i], b[i]], ch['names'][k])
    tr = f.ad.nla_tracks.new(); tr.name = f'hand {name}'
    st = tr.strips.new(name, 1, act); H.set_slot(st, slot)
    st.blend_type = 'REPLACE'; st.extrapolation = 'HOLD'; st.use_animated_influence = True
    for t, v in keys: st.influence = v; st.keyframe_insert('influence', frame=1 + t * FPS)
    return st


def _span(f, t0=None, t1=None):
    a = t0 if t0 is not None else (f.strips[0][0] if f.strips else 0.0); b = t1 if t1 is not None else (max(x[1] for x in f.strips) if f.strips else 5.0)
    return a, b


def _bake(f, frames, mute, step):
    """Per-frame solve (recon's after-the-clip runtime): with `mute` constraints off, every frame step(frame) reads the
    evaluated pose and keys its targets."""
    sc = bpy.context.scene; f0 = sc.frame_current
    for c in mute: c.mute = True
    for fr in frames: sc.frame_set(fr); step(fr)
    for c in mute: c.mute = False
    sc.frame_set(f0)


# ------------------------------------------------------------------------------------------------- hold
class Hold:
    def __repr__(self): return f'<Hold {self.f.name} {self.kind}|{self.grip} {self.side.upper()} {self.t0}-{self.t1}>'


def _samples(f, t0, t1):
    if not f.strips: return []
    a, b = _span(f, t0, t1); n = max(2, int((b - a) * 4)); return [a + (b - a) * i / n for i in range(n + 1)]


def hold(f, prop, grip=None, side=None, t0=None, t1=None, use=None, kind=None, strict=True, flip=False, rest_world=None,
         reach=REACH, lift=LIFT, _no_use=False):
    """f holds prop (grip name, side 'R'|'L'). t0 / t1: picked up at t0 from where it rests now (the hand reaches for it
    over `reach` s before), put back at t1 (else held all along). use: override the grip's use (USES)."""
    kind = kind or kind_of(prop); R = rig(f.body)
    gname, g, s, mir = resolve_grip(prop, kind, grip, side)
    for c in sorted({f.clip_at(t) for t in _samples(f, t0, t1)} - {None}):
        if not is_verified(kind, gname, f.body, s, c):
            msg = f'hands.hold: {kind}|{gname} in the {f.body} {"left" if s == "l" else "right"} hand with the clip "{c}" is not VERIFIED{_alt(kind, gname, f.body)}'
            if strict: raise ValueError(msg)
            print('CZ HOLD ' + msg)
    h = Hold(); h.f, h.prop, h.kind, h.grip, h.side, h.t0, h.t1, h.g, h.flip = f, prop, kind, gname, s, t0, t1, g, flip
    h.use = use or g.get('use', 'clip'); ud = USES.get(h.use) or USES['clip']; h.ud = ud; h.pose = g.get('pose', 'wrap')
    G = grip_frame(prop, kind, g, mir, flip)
    # a handle's bar: the palm's place over it per body x prop x grip x hand x pose x flip (recon BAR_BEST, baked from its search)
    if g.get('bar') and not g.get('second'):
        bb = BAR_BEST.get(f'{f.body}|{kind}|{gname}|{s}|{h.pose}|{1 if flip else 0}')
        if bb: G = G @ Matrix.Translation((0, bb[0], bb[1]))
    sc = f.s; pin = R[s]['palm_in_hand'].copy(); pin.translation *= sc; h.pin = pin
    bpy.context.view_layer.update()
    X = rest_world.copy() if rest_world is not None else prop.matrix_world.copy(); h.X = X
    # (the BASIS, not matrix_world: with the giver's Child Of already on the prop, a matrix_world write is read back through that
    # constraint at the current frame, the basis was not X and the taker's grip sat 13 mm into the hammer)
    if rest_world is not None and prop.parent is None: prop.matrix_basis = X; bpy.context.view_layer.update()
    h.sol = solve_hand(R, s, prop, G, h.pose, sc, g.get('contact'), g.get('palmTouch', True) is not False)
    if DBG: print('CZ HANDDBG hold', f.name, kind, gname, s, 'flip', flip, 'mir', mir, 'shift mm', round(h.sol['shift'] * 1000, 1), {k: v['gap_mm'] for k, v in h.sol['report'].items()})
    T1 = G @ Matrix.Translation((0, 0, -h.sol['shift'] * sc)); h.G, h.T1 = G, T1          # the palm on the prop (prop-local)
    h.up = _vec_mir(g.get('up', [0, 1, 0]), mir, flip).normalized()
    # the prop rides the hand (Child Of, no scale: it keeps its size), keyed on while held
    co = prop.constraints.new('CHILD_OF'); co.name = f'held by {f.name} {s}'; co.target = f.arm; co.subtarget = f'hand_{s}'
    co.use_scale_x = co.use_scale_y = co.use_scale_z = False; co.set_inverse_pending = False
    co.inverse_matrix = pin @ T1.inverted() @ X.inverted(); h.co = co
    if ud.get('anchor') == 'scene': co.influence = 0.0                       # a fixed prop: it stays, the hands go to it
    else: _key(co, 'influence', [(0, 1.0)] if t0 is None and t1 is None else ([(0, 0.0)] + ([(t0, 1.0)] if t0 is not None else [(0, 1.0)]) + ([(t1, 0.0)] if t1 is not None else [])), 'CONSTANT')
    hk = [(0, 1.0)] if t0 is None else [(0, 0.0), (t0 - reach, 0.0), (t0, 1.0)]
    if t1 is not None: hk += [(t1, 1.0), (t1 + reach, 0.0)]
    h.weight_keys = hk
    h.strip = _finger_track(f, s, h.sol, hk, f'{kind} {gname} {s}')
    h.iks = []; h.hang = None
    target_rest = X @ T1 @ pin.inverted()
    if t0 is not None or t1 is not None:                                     # reach for it where it rests
        e = _empty(f'reach {f.name} {kind} {s}', target_rest); keys = []
        if t0 is not None: keys += [(t0 - reach, 0.0), (t0, 1.0), (t0 + lift, 0.0)]
        if t1 is not None: keys += [(t1 - lift, 0.0), (t1, 1.0), (t1 + reach, 0.0)]
        h.iks.append(_ik(f, s, e, sorted(keys), f'reach {kind}')); h.reach_empty = e
    a0, a1 = _span(f, t0, t1)
    on = ([(0, 1.0)] if t0 is None else [(t0, 0.0), (t0 + lift, 1.0)]) + ([(t1 - lift, 1.0), (t1, 0.0)] if t1 is not None else [])
    anc = ud.get('anchor')
    if anc == 'scene':
        e = _empty(f'scene {f.name} {kind} {s}', target_rest); h.iks.append(_ik(f, s, e, on, f'scene {kind}'))
    elif anc in ANCHOR and not _no_use:
        use_w = _use_frame(f, h, R, prop, kind, G, mir, flip)
        bn = ANCHOR[anc]; B = f.arm.data.bones[bn]
        ue = _empty(f'use {f.name} {kind}', None)
        uc = ue.constraints.new('CHILD_OF'); uc.target = f.arm; uc.subtarget = bn; uc.set_inverse_pending = False
        bpy.context.view_layer.update(); uc.inverse_matrix = (f.arm.matrix_world @ B.matrix_local).inverted(); ue.matrix_world = use_w
        bpy.context.view_layer.update()
        it = _empty(f'ik {f.name} {kind} {s}', None, ue); it.matrix_world = ue.matrix_world @ T1 @ pin.inverted()   # (relative to the evaluated use frame)
        h.iks.append(_ik(f, s, it, on, f'use {kind}')); h.use_empty = ue
    elif ud.get('hang'):
        _hang(h, f, s, a0, a1, on)
    if g.get('second'):                                                     # the second hand: its own grip, solve, IK
        s2 = 'l' if s == 'r' else 'r'; G2 = grip_frame(prop, kind, g['second'], mir, flip)
        sol2 = solve_hand(R, s2, prop, G2, g['second'].get('pose', h.pose), sc, g['second'].get('contact'), g['second'].get('palmTouch', True) is not False)
        T2 = G2 @ Matrix.Translation((0, 0, -sol2['shift'] * sc))
        pin2 = R[s2]['palm_in_hand'].copy(); pin2.translation *= sc
        e2 = _empty(f'ik2 {f.name} {kind} {s2}', None, prop); bpy.context.view_layer.update()
        e2.matrix_world = prop.matrix_world @ T2 @ pin2.inverted()         # (relative to the prop as evaluated now: held or at rest)
        h.iks2 = _ik(f, s2, e2, hk, f'second {kind}')
        _finger_track(f, s2, sol2, hk, f'{kind} {gname} {s2}')
        h.second = {'side': s2, 'G': G2, 'T': T2, 'pin': pin2, 'sol': sol2, 'empty': e2}
    else: h.second = None
    HOLDS.append(h); prop['cz_held'] = 1
    return h


def _use_frame(f, h, R, prop, kind, G, mir, flip):
    """recon setupUse / earFrame / clearBody: the prop's world pose at rest in the anchor's frame (figure axes at the bone)."""
    ud = h.ud; sg = 1 if h.side == 'l' else -1; k = f.meta['drawn_h'] / 1.8
    B = f.arm.data.bones[ANCHOR[ud['anchor']]]; A = B.head_local.copy()
    # (hands.js h.anchorPt: the grip points themselves, G not T1 - the palm-push shift is the hand's business, not the use pose's)
    gp = h.G.translation.copy() if not h.g.get('second') else (h.G.translation + grip_frame(prop, kind, h.g['second'], mir, flip).translation) / 2
    tipv = _vec_mir(h.g.get('tip', [0, 0, -.055]), mir, flip)
    def frame(P, y, z):
        Y = uv(y, sg).normalized(); Z = uv(z, sg); Z = (Z - Y * Z.dot(Y)).normalized(); Xr = Y.cross(Z)
        Rp = Matrix((Xr, -Z, Y)).transposed().to_4x4()                  # Blender prop axes (x, -z_recon, y_recon)
        if h.flip: Rp = Rp @ Matrix.Rotation(math.pi, 4, 'Z')
        return Rp
    if ud.get('ear') or ud.get('mouth'):
        hs = [Vector((sg * (p - A).x, (p - A).z, -(p - A).y)) for p in R['head_v']]           # use space (s, u, f)
        if ud.get('ear'):
            best = None
            for p in hs:
                if .02 < p.y < .12 and abs(p.z) < .04 and (best is None or p.x > best.x): best = p
            ear = best or Vector((.085, .06, 0)); mouth = Vector((.03, -.03, .085))
            y = Vector((-1, 0, .12)).normalized(); z = mouth - ear; z = (z - y * z.dot(y)).normalized(); P = ear + Vector((.006, 0, .012))
        else:
            y, z = Vector(ud['y']), Vector(ud['z']); P = Vector((0, -.03, .095)) + Vector(ud.get('pos', (0, 0, 0))) * .3
        Y = uv(y, sg).normalized(); Z = uv(z, sg); Z = (Z - Y * Z.dot(Y)).normalized(); Rp = Matrix((Y.cross(Z), -Z, Y)).transposed().to_4x4()
        Rp.translation = A + uv(P, sg) - Rp.to_3x3() @ tipv
        mv = Vector((sg, 0, 0)) if ud.get('ear') else Vector((0, 0, 1))
    else:
        P = Vector(ud.get('pos', (0, 0, .3))) * k
        if ud.get('centre'): P.x = 0
        Rp = frame(P, ud.get('y', (0, 1, 0)), ud.get('z', (0, 0, 1)))
        Rp.translation = A + uv(P, sg) - Rp.to_3x3() @ gp
        mv = Vector((0, 0, 1)) if ud.get('clear', 'f') == 'f' else Vector((sg, 0, 0))
    # clear the body: push the prop along `mv` (use space) until no body vertex is within 1.5 cm (ear / mouth: 2 mm)
    clear = .002 if (ud.get('ear') or ud.get('mouth')) else .015; pts = R['head_v'] if (ud.get('ear') or ud.get('mouth')) else R['body_v']
    d = uv(mv, 1).normalized(); pushed = 0.0
    for it in range(40):
        geo = _bvh(prop, Rp); worst = -1.0
        for p in pts:
            sd = geo.sd(p, .05)
            if sd >= clear: continue
            worst = max(worst, clear - sd)
        if worst <= 0: break
        st = min(.05, worst + .002); Rp = Matrix.Translation(d * st) @ Rp; pushed += st
    h.pushed = pushed
    # within reach (Round 3): the use pose scaled from recon's 1.8 m figure left the male's wrists 7-11 mm past full
    # stretch (staff / broom across the body): the pose moves toward the shoulder of the hand that is short until every
    # holding wrist is inside 96 % of its arm (hands.js reports the same case as 'the use pose is N cm out of reach')
    hands_ = [(h.side, h.G)] + ([('l' if h.side == 'r' else 'r', grip_frame(prop, kind, h.g['second'], mir, flip))] if h.g.get('second') else [])
    h.reach_pull = 0.0
    for it in range(12):
        worst, wv = 0.0, None
        for s_, Gs in hands_:
            Rs = R[s_]; sh = f.arm.data.bones[f'upperarm_{s_}'].head_local
            w = (Rp @ Gs @ Rs['palm_in_hand'].inverted()).translation; e = (w - sh).length - .96 * Rs['arm_len']
            if e > worst: worst, wv = e, (sh - w).normalized()
        if worst <= 0: break
        Rp = Matrix.Translation(wv * (worst + .002)) @ Rp; h.reach_pull += worst + .002
    return f.arm.matrix_world @ Rp


def _hang(h, f, s, a0, a1, on):
    """recon hangStraight, every frame: the hand turns about its own origin so the prop's up (g.up) points up (a bag hangs,
    a hammer hangs head down); then lifted if the prop would go under the floor."""
    e = _empty(f'hang {f.name} {h.kind} {s}'); e.rotation_mode = 'QUATERNION'
    hb = f.arm.pose.bones[f'hand_{s}']; cr = hb.constraints.new('COPY_ROTATION'); cr.name = f'hang {h.kind}'; cr.target = e
    _key(cr, 'influence', on); PinR = (h.pin @ h.T1.inverted()).to_quaternion(); up = h.up
    def step(fr):
        Mh = f.arm.matrix_world @ hb.matrix; Rh = Mh.to_quaternion()
        yW = (Rh @ PinR) @ up; q = yW.rotation_difference(Vector((0, 0, 1)))
        e.rotation_quaternion = (q @ Rh).normalized(); e.location = Mh.translation
        e.keyframe_insert('rotation_quaternion', frame=fr); e.keyframe_insert('location', frame=fr)
    _bake(f, range(int(1 + a0 * FPS), int(2 + a1 * FPS)), [cr], step)
    h.hang = (e, cr)


def handover(a, b, prop, grip=None, t=None, kind=None, at=None, y=None, settle=0.4, overlap=0.2, lift=0.7, reach=0.7, strict=True, side_a=None, side_b=None):
    """a holds the prop until t, b from t on (recon handover + fitExchange). The exchange pose: searched between them (k of
    the way, height, and sideways toward the two hands) so both wrists stay inside their arm's reach; at t the prop changes
    owner without moving (exclusive Child Ofs). Facing each other: a's right hand to b's LEFT. Returns (hold_a, hold_b)."""
    if t is None: raise ValueError('handover: needs t (the moment the prop changes hands)')
    kind = kind or kind_of(prop); bpy.context.view_layer.update()
    pa, pb = a.root.matrix_world.translation.copy(), b.root.matrix_world.translation.copy()
    d = (pb - pa); d.z = 0; yaw = math.atan2(d.x, -d.y); side = Vector((-d.y, d.x, 0)).normalized()
    hgt = (a.height + b.height) / 2
    fa = Vector((math.sin(a.root.rotation_euler.z), -math.cos(a.root.rotation_euler.z), 0)); fb = Vector((math.sin(b.root.rotation_euler.z), -math.cos(b.root.rotation_euler.z), 0))
    flip = fa.dot(fb) < -0.2
    ga, g_, sa, ma = resolve_grip(prop, kind, grip, side_a); _, gb_, sb, mb = resolve_grip(prop, kind, grip, side_b)
    Ga = grip_frame(prop, kind, g_, ma, False); Gb = grip_frame(prop, kind, gb_, mb, flip)
    Rz = Matrix.Rotation(yaw, 4, 'Z')   # (hands.js fitExchange: the prop's front (recon +Z = Blender -Y) toward b; the port had yaw + pi: 4.6 cm out of reach)
    hands_ = []
    for f_, s_, G_ in ((a, sa, Ga), (b, sb, Gb)):
        pin = rig(f_.body)[s_]['palm_in_hand'].copy(); pin.translation *= f_.s
        hands_.append((G_, pin, f_.arm.matrix_world @ f_.arm.data.bones[f'upperarm_{s_}'].head_local, rig(f_.body)[s_]['arm_len'] * f_.s * .95))
    best = None
    for k in (.5, .45, .55, .4, .6, .35, .65):
        for yy in ([y] if y is not None else [v * hgt / 1.8 for v in (1.0, .95, 1.05, .9, 1.1, 1.15, .85, 1.2, 1.25, 1.3)]):
            for lat in (0, .05, -.05, .1, -.1, .15, -.15):
                mid = pa.lerp(pb, k) + side * lat; mid.z = max(pa.z, pb.z) + yy
                Xc = Matrix.Translation(mid) @ Rz @ Matrix.Translation(-Ga.translation)
                sh = max((((Xc @ G_ @ pin.inverted()).translation - shp).length - L) for G_, pin, shp, L in hands_)
                sc_ = max(sh, -.02) + abs(lat) * .02 + abs(k - .5) * .01
                if best is None or sc_ < best[0] - 1e-4: best = (sc_, Xc, k, yy, sh, lat)
    X = at.copy() if at is not None else best[1]
    ha = hold(a, prop, ga, side_a, None, t + overlap, kind=kind, strict=strict, rest_world=X, reach=0.35, lift=lift, _no_use=True)
    hb = hold(b, prop, ga, side_b, t, None, kind=kind, strict=strict, flip=flip, rest_world=X, reach=reach, lift=lift)
    ha.pair, hb.pair = hb, ha; ha.exchange = hb.exchange = X
    _clear_keys(ha.co); _key(ha.co, 'influence', [(0, 1.0), (t, 0.0)], 'CONSTANT')     # exactly one owner at a time
    for ik, cr in ha.iks:                                       # the giver lifts it to the exchange pose, holds it there to t + overlap
        for c in (ik, cr):
            if c is None: continue
            _clear_keys(c); _key(c, 'influence', [(t - settle - lift, 0.0), (t - settle, 1.0), (t + overlap, 1.0), (t + overlap + 0.5, 0.0)])
    if ha.hang:
        _clear_keys(ha.hang[1]); _key(ha.hang[1], 'influence', [(0, 1.0), (t - settle - lift, 1.0), (t - settle, 0.0)])
    ha.reach_short = hb.reach_short = best[4] if at is None else 0.0
    if ha.reach_short > 0.005:
        print(f'CZ HOLD handover {a.name} -> {b.name}: the exchange point is {ha.reach_short * 100:.1f} cm out of reach: stand them '
              f'{max(.05, ha.reach_short * 2):.2f} m closer (one hand: about 0.7 m apart, two-hand props about 0.9 m)')
    return ha, hb


def rest(f, surface, t0, t1=None, sides='LR', clearance=0.002, max_down=0.25):
    """recon rest(): every frame each hand comes down onto the surface right under it (the clip's hand orientation and
    fingers kept) and never goes into it; eased in / out over 0.3 s; a hand a hold uses at that moment yields to it."""
    surf = surface if isinstance(surface, (list, tuple)) else [surface]
    vs, fs = [], []
    dg = bpy.context.evaluated_depsgraph_get()
    for s_ in surf:
        for o in [s_] + list(s_.children_recursive):
            if o.type != 'MESH': continue
            oe = o.evaluated_get(dg); me = oe.to_mesh(); n0 = len(vs); vs += [o.matrix_world @ v.co for v in me.vertices]
            fs += [tuple(n0 + i for i in p.vertices) for p in me.polygons]; oe.to_mesh_clear()
    bvh = BVHTree.FromPolygons(vs, fs); out = []
    a1 = t1 if t1 is not None else _span(f)[1]
    for s in sides.lower():
        R = rig(f.body)[s]; hb = f.arm.pose.bones[f'hand_{s}']
        samp = [(R['palm_in_hand'].translation, None)] + [(v, (fn, k)) for fn, ch in R['chains'].items() for k in (1, 2) for v in ch['samp'][k][::2]]
        e = _empty(f'rest {f.name} {s}'); e.rotation_mode = 'QUATERNION'
        keys = [(t0 - .3, 0.0), (t0, 1.0)] + ([(t1, 1.0), (t1 + .3, 0.0)] if t1 is not None else [])
        busy = [hh for hh in HOLDS if hh.f is f and (hh.side == s or (hh.second and hh.second['side'] == s))]
        ik, cr = _ik(f, s, e, keys, f'rest {s}'); gaps = {}
        rest_bones = {n: f.arm.data.bones[n].matrix_local for n in [f'hand_{s}'] + [n for ch in R['chains'].values() for n in ch['names']]}
        def step(fr, R=R, hb=hb, e=e, s=s, samp=samp, gaps=gaps):
            pbs = f.arm.pose.bones; Mw = f.arm.matrix_world; Mh = Mw @ hb.matrix; best = None
            for v, b in samp:
                if b is None: p = Mh @ v                                      # the palm point (hand-bone space)
                else:
                    n = R['chains'][b[0]]['names'][b[1]]; p = Mw @ pbs[n].matrix @ rest_bones[n].inverted() @ v
                loc, nrm, i, dd = bvh.ray_cast(p + Vector((0, 0, .25)), Vector((0, 0, -1)), .6)
                if loc is None: continue
                gp = p.z - loc.z
                if gp < -.03: continue
                best = gp if best is None else min(best, gp)
            gaps[fr] = best
            dz = 0.0 if best is None else max(-.05, min(max_down * f.s, best - clearance))
            e.location = Mh.translation - Vector((0, 0, dz)); e.rotation_quaternion = Mh.to_quaternion()
            e.keyframe_insert('location', frame=fr); e.keyframe_insert('rotation_quaternion', frame=fr)
        _bake(f, range(int(1 + (t0 - .3) * FPS), int(2 + (a1 + .3) * FPS)), [ik, cr], step)
        out.append({'f': f, 'side': s, 'surface': surf, 't0': t0, 't1': t1, 'gaps': gaps, 'bvh': bvh, 'ik': ik})
    RESTS.extend(out); return out


# ------------------------------------------------------------------------------------------------- the HOLD check
def hold_issues(frames_per_hold=4, verbose=True):
    """recon holdIssues / measureHold on the drawn meshes at held frames. Tolerances (recon): hand inside the prop > 1 mm,
    the prop inside the body > 2 mm, floats > 5 mm off the palm (palm poses), a contact finger > 3 mm off (air), the second
    hand > 6 mm off its grip, the hand > 5 mm off its IK target (out of reach), not VERIFIED with the clip. Lines:
      CZ HOLD <frame> <figure>: <kind>|<grip> <R|L>: <problem>
      CZ HOLD OK <figure>: <kind>|<grip> <R|L> (<n> frames)
      CZ HOLD REST <frame> <figure> <L|R>: hovers N mm above / N mm into <surface>"""
    sc = bpy.context.scene; out = []
    for h in HOLDS:
        f = h.f; R = rig(f.body); S = R[h.side]
        ts = [t for t in _samples(f, h.t0, h.t1) if (h.t0 is None or t >= h.t0 + 1.0) and (h.t1 is None or t <= h.t1 - 1.0)]
        if not ts: ts = _samples(f, h.t0, h.t1)[1:-1] or _samples(f, h.t0, h.t1)
        if len(ts) > frames_per_hold: ts = [ts[int(i * (len(ts) - 1) / (frames_per_hold - 1))] for i in range(frames_per_hold)]
        bad = 0; gi = {g.index: g.name for g in f.mesh.vertex_groups}
        for t in ts:
            fr = int(round(1 + t * FPS)); sc.frame_set(fr); dg = bpy.context.evaluated_depsgraph_get()
            me = f.mesh.evaluated_get(dg).to_mesh(); W = f.mesh.matrix_world
            geo = Geo(h.prop, world=True)
            sd = geo.sd
            lines = []
            for side_, S_, sol, label in [(h.side, S, h.sol, '')] + ([(h.second['side'], R[h.second['side']], h.second['sol'], ' second hand')] if h.second else []):
                deep, where = 0.0, None
                for i in S_['verts'][::2]:
                    d = sd(W @ me.vertices[i].co)
                    if d < -deep: deep, where = -d, i
                if deep > .001:
                    v = me.vertices[where]; nm = gi.get(max(v.groups, key=lambda x: x.weight).group, '?') if v.groups else '?'
                    lines.append(f'{label.strip() + ": " if label else ""}the {nm} is {deep * 1000:.1f} mm inside the {h.kind}')
                pose = POSES.get(sol['pose'], {})
                if pose.get('palm') and side_ == h.side:
                    hw = f.arm.matrix_world @ f.arm.pose.bones[f'hand_{side_}'].matrix; pc = (hw @ S_['palm_in_hand']).translation
                    pg = min((geo.dist(W @ me.vertices[i].co, .1) for i in S_['verts'][::2] if (W @ me.vertices[i].co - pc).length < .09), default=1)
                    if pg > .005: lines.append(f'floats {pg * 1000:.1f} mm off the palm')
                for fn in sol['contact']:
                    ids = S_['fverts'].get(fn) or []
                    if not ids: continue
                    g_ = min(geo.dist(W @ me.vertices[i].co, .05) for i in ids)
                    if g_ > .003: lines.append(f'{"left " if side_ == "l" else "right "}{fn} finger {g_ * 1000:.1f} mm off (air)')
            for ik, cr in h.iks + ([h.iks2] if h.second else []):
                if ik.influence > .99:
                    bn = next(pb for pb in f.arm.pose.bones if ik.name in pb.constraints)
                    e = (f.arm.matrix_world @ bn.head - ik.target.matrix_world.translation).length
                    if e > .005: lines.append(f'the hand is {e * 1000:.0f} mm off its IK target (out of reach: move the person or the prop)')
            c = f.clip_at(t)
            if c and not is_verified(h.kind, h.grip, f.body, h.side, c): lines.append(f'not VERIFIED with the clip {c}')
            f.mesh.evaluated_get(dg).to_mesh_clear()
            for l in lines: out.append(f'CZ HOLD {fr} {f.name}: {h.kind}|{h.grip} {h.side.upper()}: {l}'); bad += 1
        if not bad: out.append(f'CZ HOLD OK {f.name}: {h.kind}|{h.grip} {h.side.upper()} ({len(ts)} frames)')
        h.issues = bad
    for r in RESTS:
        for fr, g in sorted(r['gaps'].items())[::10]:
            t = (fr - 1) / FPS
            if t < r['t0'] or (r['t1'] is not None and t > r['t1']) or g is None: continue
            sc.frame_set(fr); gg = _rest_gap(r)
            if gg is not None and gg > .006: out.append(f'CZ HOLD REST {fr} {r["f"].name} {r["side"].upper()}: hovers {gg * 1000:.0f} mm above it')
            if gg is not None and gg < -.002: out.append(f'CZ HOLD REST {fr} {r["f"].name} {r["side"].upper()}: {-gg * 1000:.0f} mm into it')
    if verbose:
        for l in out: print(l)
    return out


def _rest_gap(r):
    f = r['f']; dg = bpy.context.evaluated_depsgraph_get(); me = f.mesh.evaluated_get(dg).to_mesh(); W = f.mesh.matrix_world; best = None
    for i in rig(f.body)[r['side']]['verts'][::4]:
        p = W @ me.vertices[i].co; loc, nrm, j, d = r['bvh'].ray_cast(p + Vector((0, 0, .25)), Vector((0, 0, -1)), .6)
        if loc is None: continue
        g = p.z - loc.z
        if g < -.03: continue
        best = g if best is None else min(best, g)
    f.mesh.evaluated_get(dg).to_mesh_clear(); return best


# ------------------------------------------------------------------------------------------------- kit props (recon's own geometry)
_MATS = {}
def kit(kind, at=(0, 0, 0), yaw=0.0, color=None):
    """recon's kit prop (props.js geometry exported by hands_data.mjs: the shape its grips were verified on), origin at its
    footprint centre on the floor, front -Y, Z up. obj['cz_kind'] = kind. 30 kinds: HD.kit_kinds()."""
    global _KIT
    if _KIT is None: _KIT = json.loads((DD / 'kit_props.json').read_text(encoding='utf-8'))['props']
    parts = _KIT.get(kind)
    if not parts: raise ValueError(f'hands.kit: no kit prop "{kind}" (kinds: {", ".join(sorted(_KIT))})')
    import mega as M
    root = bpy.data.objects.new(kind, None); bpy.context.scene.collection.objects.link(root); root.empty_display_size = .05
    for p in parts:
        me = bpy.data.meshes.new(p['name']); v = p['v']; f = p['f']
        me.from_pydata([(v[i], v[i + 1], v[i + 2]) for i in range(0, len(v), 3)], [], [(f[i], f[i + 1], f[i + 2]) for i in range(0, len(f), 3)])
        bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5); bm.to_mesh(me); bm.free()
        me.update()
        try: me.shade_smooth()
        except Exception: pass
        col = color or p['color']; key = col
        if key not in _MATS: _MATS[key] = M.pbr(f'kit_{col}', col, rough=.55)
        me.materials.append(_MATS[key])
        o = bpy.data.objects.new(p['name'], me); bpy.context.scene.collection.objects.link(o); o.parent = root
        if p.get("open"): o["cz_open"] = 1
        if p.get("noHold"): o["cz_nohold"] = 1
    root['cz_kind'] = kind; root['cz_kit'] = 1
    root.location = Vector(tuple(at) + (0,) * (3 - len(at))); root.rotation_euler.z = math.radians(yaw)
    bpy.context.view_layer.update(); return root


def kit_kinds():
    global _KIT
    if _KIT is None: _KIT = json.loads((DD / 'kit_props.json').read_text(encoding='utf-8'))['props']
    return sorted(_KIT)
