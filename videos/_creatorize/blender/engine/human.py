# HUMANS for the 3D Informational (mega) engine: the 3D reconstruction's figure system ported to Blender.
#   import human as H
#   f = H.figure('main', at=(0, 0, 0), face=0)              # a role (figures.js ROLES) or a body ('male' | 'female' | 'custom:<file>')
#   f.play('Idle_Loop', 0, 2.5); f.play('G_Point_Forward', 2.5, 4.2)   # NLA strips, crossfades (blendFor), seconds
#   f.walk([(0, 0), (3, 1)], 4.2, 7.0)                      # root motion along a path, playback speed from the clip's stride
#   f.look_at(obj_or_point, 1.0, 3.0); f.xray([(2, 0), (2.6, 1)])   # head turns; the body fades to the X-ray look
#   H.crowd(30, (-5, -5, 5, 5), clips=['Idle_Loop', 'Idle_Talking_Loop'])   # instanced extras with offset clips
#   H.import_mixamo('~/Downloads/Waving.fbx')               # the user's own clip, retargeted + cached (never shipped)
#   H.clips('wave') / H.clips(tag='sit')                    # the catalog (builtin.json + quality.json + the user's clips)
# Bodies (recon assets/figures, read only): male = Mixamo Y Bot on the library's UE5 skeleton (1.80 m), female = the
# Quaternius jointed mannequin (CC0, 1.68 m); 65 bones (root, pelvis, spine_01-03, neck_01, Head, clavicle/upperarm/
# lowerarm/hand, fingers 01-03 + leaf, thigh/calf/foot/ball). Clips: the library's CC0 packs (templates/lowpoly/library/
# animations ual1, ual2, gestures, kaykit_ue) played exactly like recon's prepareClip (each bone's LOCAL rotation copied,
# the pelvis translation scaled by the pelvis-height ratio), cleaned like anims.js cleanClip (loop seams, end snaps, sneak
# drift), QA from assets/anims/quality.json (broken clips refused on that body). Converted once per body x clip into the
# machine cache (CZ_ASSETS3D or <Documents>/Creatorize Assets/3d)/humans/v1/ with the clip's ground lift + stride speed.
# Figure facing: yaw 0 = the figure looks toward -Y (a mega camera usually sits at -Y looking +Y); left hand at +X.
import bpy, json, math, os, re, time, hashlib
from pathlib import Path
from mathutils import Matrix, Quaternion, Vector, Euler
import cz

FPS = cz.FPS
HERE = Path(__file__).resolve().parent
TPL = HERE.parent.parent                                   # templates/
FIG_DIR = Path(os.environ.get('CZ_FIGURES') or TPL / 'recon' / 'assets' / 'figures')
ANIM_META = TPL / 'recon' / 'assets' / 'anims'
LIB_ANIMS = Path(os.environ.get('CZ_LIB') or TPL / 'lowpoly' / 'library') / 'animations'
CACHE_V = 'v1'
BODIES = {'male': {'file': 'mixamo_mannequin.glb', 'height': 1.8}, 'female': {'file': 'mannequin_f.glb', 'height': 1.68}}
FINISHES = ('matte', 'glossy', 'glow', 'xray')
ROLES = {   # figures.js ROLES (the main character stands apart: glossy orange)
    'main': ('male', 'glossy', '#e8742a'), 'suspect': ('male', 'matte', '#c9343a'), 'victim': ('female', 'matte', '#e6d9c2'),
    'detective': ('male', 'matte', '#3f6fc4'), 'witness': ('female', 'matte', '#3fa68c'), 'accomplice': ('male', 'matte', '#8a5fb0'),
    'official': ('male', 'matte', '#c9a43c'), 'prisoner': ('male', 'matte', '#cf611f'), 'police': ('male', 'matte', '#3c5a8a'),
    'swat': ('male', 'matte', '#5a6068'), 'unknown': ('male', 'matte', '#8a9097'), 'extra': ('male', 'matte', '#b9b2a6'),
    'worker': ('male', 'matte', '#d9a23a'), 'engineer': ('female', 'matte', '#3f8fd0'), 'scientist': ('female', 'glossy', '#e9ecef')}
PACKS = {'ual1': 'ual1.glb', 'ual2': 'ual2.glb', 'gestures': 'gestures.glb', 'kaykit': 'kaykit_ue.glb'}
ACTS = {   # figures.js HUMAN_ACTS: act name -> clip
    'stand': 'Idle_Loop', 'idle': 'Idle_Loop', 'walk': 'Walk_Loop', 'walkFormal': 'Walk_Formal_Loop', 'jog': 'Jog_Fwd_Loop', 'run': 'Sprint_Loop',
    'sit': 'Sitting_Idle_Loop', 'sitDown': 'Sitting_Enter', 'standUp': 'Sitting_Exit', 'sitChair': 'KK_Sit_Chair_Idle_Loop', 'typing': 'G_Typing_Seated_Loop',
    'typingStand': 'G_Typing_Standing_Loop', 'phone': 'Idle_TalkingPhone_Loop', 'talk': 'Idle_Talking_Loop', 'handsOnHead': 'G_Hands_On_Head_Loop',
    'point': 'G_Point_Forward', 'shrug': 'G_Shrug', 'facepalm': 'G_Facepalm', 'cuffed': 'Idle_FoldArms_Loop', 'think': 'Idle_No_Loop', 'yes': 'Yes',
    'carry': 'KK_Hold_A_Loop', 'walkCarry': 'Walk_Carry_Loop', 'pickup': 'KK_PickUp', 'door': 'KK_Interact', 'use': 'KK_Use_Item', 'fall': 'KK_Fall_Death_A',
    'die': 'Death01', 'hit': 'Hit_Chest', 'crouch': 'Crouch_Idle_Loop', 'sneak': 'KK_Sneak_Loop', 'lockpick': 'KK_Lockpicking_Loop', 'lie': 'KK_Lie_Idle_Loop',
    'throw': 'KK_Throw', 'push': 'Push_Loop', 'drive': 'Driving_Loop', 'aim': 'Pistol_Aim_Neutral', 'wave': 'KK_Wave'}
SEAT_H = 0.45      # seat top the sit clips sit on (scaled with the figure's height / 1.8)
SOURCE_PELVIS_REST = 0.91836   # lowpoly/library/tools/anim-runtime.js: |pelvis.position| of the UAL mannequin in its bind pose
SEATED = re.compile(r'sit|typing(?!_?stand)|lie|driv', re.I)
GESTURE = re.compile(r'^(point|shrug|facepalm|yes|wave|talk|phone|think|handsOnHead|cuffed|use|door|hit)$|^G_', re.I)
GROUND_BODY = re.compile(r'lie|lay|sit_?floor|situps|pushups|crawl|death|die\b|fall|knockback|roll|slide|kneel|swim|dodge', re.I)
GROUND_AIR = re.compile(r'jump|climb', re.I)
ALL = []           # every figure of this Blender run (hands.holdIssues, checks)
STATS = {'body_import_s': 0.0, 'clip_convert_s': 0.0, 'clip_load_s': 0.0, 'converted': 0, 'loaded': 0}


def ground_mode(n):
    n = str(n)
    return 'body' if GROUND_BODY.search(n) else 'air' if GROUND_AIR.search(n) else 'seat' if SEATED.search(n) else 'feet'


def blend_for(a, b):
    """figures.js blendFor: seconds of crossfade (sit <-> stand 0.5, seated 0.45, gestures 0.25, walk starts/stops 0.35, else 0.3)."""
    if a is None or a == b: return 0.0
    if bool(SEATED.search(a)) != bool(SEATED.search(b)): return 0.5
    if SEATED.search(a): return 0.45
    if GESTURE.search(a) or GESTURE.search(b): return 0.25
    return 0.35 if re.search(r'walk|jog|run|sneak', a + ' ' + b, re.I) else 0.3


def smoother(u): u = max(0.0, min(1.0, u)); return u * u * u * (u * (u * 6 - 15) + 10)


# ------------------------------------------------------------------------------------------------- cache + catalog
def cache_root():
    base = os.environ.get('CZ_ASSETS3D') or str(Path.home() / 'Documents' / 'Creatorize Assets' / '3d')
    p = Path(base) / 'humans' / CACHE_V; p.mkdir(parents=True, exist_ok=True); return p


_CAT = None
def catalog():
    """name -> entry (builtin.json entries + quality, the user's imported clips from <cache>/humans/user/catalog.json)."""
    global _CAT
    if _CAT is not None: return _CAT
    _CAT = {}
    try:
        for e in json.loads((ANIM_META / 'builtin.json').read_text(encoding='utf-8'))['entries']: _CAT[e['name']] = dict(e)
    except Exception as ex: print('CZ HUMAN catalog: builtin.json unreadable', ex)
    uc = cache_root().parent / 'user' / 'catalog.json'
    if uc.exists():
        try:
            for e in json.loads(uc.read_text(encoding='utf-8')).get('entries', []): _CAT.setdefault(e['name'], dict(e, kind='user'))
        except Exception: pass
    return _CAT


def quality(name, body):
    e = catalog().get(name) or {}
    return (e.get('qualityBy') or {}).get(body) or e.get('quality')


def clips(query='', tag=None, loop=None, body=None, verified=False, hands=None, allow_broken=False):
    """anims.js findAnims: catalog entries best first (tags count most, then name words); broken ones never unless asked."""
    terms = [t for t in re.split(r'[\s,]+', str(query).lower()) if t]; tags = [tag] if isinstance(tag, str) else list(tag or [])
    words = lambda n: ' ' + re.sub(r'[_\-.]+', ' ', re.sub(r'([a-z])([A-Z])', r'\1 \2', re.sub(r'^(KK|G)_', '', n))).lower() + ' '
    out = []
    for e in catalog().values():
        if loop is not None and bool(e.get('loop')) != bool(loop): continue
        if hands and e.get('hands') != hands: continue
        if tags and not all(t in (e.get('tags') or []) for t in tags): continue
        q = quality(e['name'], body)
        if q == 'broken' and not allow_broken: continue
        if verified and q != 'verified': continue
        s = 10 if tags else 0; nm = words(e['name']); su = str(e.get('suits', '')).lower()
        for t in terms:
            sg = t.rstrip('s')
            if t in (e.get('tags') or []) or sg in (e.get('tags') or []): s += 6
            s += 4 if (' ' + sg) in nm else 2 if sg in nm else 0
            if sg in su: s += 1
        if terms and s == 0: continue
        if e['name'].lower() == str(query).lower(): s += 50
        out.append((s + (0.5 if e.get('kind') == 'user' else 0) + (0.25 if q == 'verified' else 0), e))
    return [e for s, e in sorted(out, key=lambda x: (-x[0], x[1]['name']))]


# ------------------------------------------------------------------------------------------------- layered-action helpers
def set_slot(owner, slot):
    """Blender 5.2: an NLA strip / animation data picks a one-slot action's slot by itself; setting it again on an action
    appended from a library .blend crashed Blender (EXCEPTION_ACCESS_VIOLATION in foreach_action_slot_use), so only
    when none was picked."""
    try:
        if getattr(owner, 'action_slot', None) is None: owner.action_slot = slot
    except Exception: pass
def _new_action(name, id_name='OB'):
    a = bpy.data.actions.new(name); a.use_fake_user = True
    slot = a.slots.new('OBJECT', 'fig'); lay = a.layers.new('L'); st = lay.strips.new(type='KEYFRAME')
    return a, slot, st.channelbag(slot, ensure=True)


def _fcurves(act, slot=None):
    if not act.layers: return []
    st = act.layers[0].strips[0]
    out = []
    for s in ([slot] if slot else act.slots):
        cb = st.channelbag(s)
        if cb: out += [(s, fc) for fc in cb.fcurves]
    return out


def _put(cb, path, idx, frames, vals, group=None):
    fc = cb.fcurves.new(path, index=idx)
    if group:
        g = cb.groups.get(group) or cb.groups.new(group); fc.group = g
    kp = fc.keyframe_points; kp.add(len(frames))
    flat = [0.0] * (2 * len(frames)); flat[0::2] = frames; flat[1::2] = vals
    kp.foreach_set('co', flat); kp.foreach_set('interpolation', [2] * len(frames))   # 2 = LINEAR
    fc.update(); return fc


# ------------------------------------------------------------------------------------------------- bodies
_BODY = {}
def _body(body):
    """The normalized body (armature + mesh, feet on z = 0 at rest), appended from the machine cache (made once)."""
    if body in _BODY and _BODY[body]['arm'].name in bpy.data.objects: return _BODY[body]
    t = time.time(); path = cache_root() / f'body_{body}.blend'
    if not path.exists(): _make_body(body, path)
    with bpy.data.libraries.load(str(path), link=False) as (src, dst):
        dst.objects = [n for n in src.objects if n.startswith('czbody_')]
    arm = next(o for o in dst.objects if o.type == 'ARMATURE'); mesh = next(o for o in dst.objects if o.type == 'MESH')
    meta = json.loads(arm.data.get('cz_meta', '{}'))
    _BODY[body] = {'arm': arm, 'mesh': mesh, 'meta': meta}
    STATS['body_import_s'] += time.time() - t
    return _BODY[body]


def _import_glb(path):
    before = set(bpy.data.objects); acts0 = set(bpy.data.actions)
    sc = bpy.context.scene; fps0 = sc.render.fps; sc.render.fps = FPS; sc.render.fps_base = 1.0
    bpy.ops.import_scene.gltf(filepath=str(path), bone_heuristic='BLENDER')
    sc.render.fps = fps0
    return [o for o in bpy.data.objects if o not in before], [a for a in bpy.data.actions if a not in acts0]


def _make_body(body, path):
    new, acts = _import_glb(FIG_DIR / BODIES[body]['file'])
    arm = next(o for o in new if o.type == 'ARMATURE'); mesh = next(o for o in new if o.type == 'MESH' and o.parent == arm)
    for a in acts: bpy.data.actions.remove(a)
    # the file's own node transforms (mannequin_f sits under a scaled parent: 1.81 -> 1.68 m) applied into the data
    bpy.context.view_layer.update(); mw = arm.matrix_world.copy(); arm.parent = None; arm.matrix_world = mw
    for o in new:
        if o not in (arm, mesh): bpy.data.objects.remove(o, do_unlink=True)
    with bpy.context.temp_override(selected_editable_objects=[arm, mesh], active_object=arm, object=arm):
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    arm.animation_data_clear(); arm.name = f'czbody_{body}_arm'; mesh.name = f'czbody_{body}'; arm.data.name = f'czbody_{body}'
    arm.matrix_world = Matrix()
    arm.data.pose_position = 'REST'; bpy.context.view_layer.update()
    vs = [mesh.matrix_world @ v.co for v in mesh.data.vertices]; zmin = min(v.z for v in vs)
    pts = _foot_points_rest(arm); sole = zmin - min(p.z for p in pts)
    bones = arm.data.bones
    meta = {'body': body, 'height': BODIES[body]['height'], 'zmin': zmin, 'sole': sole, 'pelvis': bones['pelvis'].head_local.z,
            'drawn_h': max(v.z for v in vs) - zmin, 'leg': _leg_len(arm)}
    arm.data['cz_meta'] = json.dumps(meta); arm.data.pose_position = 'POSE'
    bpy.data.libraries.write(str(path), {arm, mesh}, fake_user=True)
    print(f'CZ HUMAN body {body}: cached {path.name} (zmin {zmin:.3f} sole {sole:.3f} drawn {meta["drawn_h"]:.3f} m)')
    bpy.data.objects.remove(mesh, do_unlink=True); bpy.data.objects.remove(arm, do_unlink=True)


FOOT_BONES = ('foot_l', 'foot_r', 'ball_l', 'ball_r')
def _foot_points_rest(arm):
    out = []
    for n in FOOT_BONES:
        b = arm.data.bones.get(n)
        if b: out += [b.head_local, b.tail_local]
    return out


def _leg_len(arm):
    B = arm.data.bones
    return sum((B[f'thigh_{s}'].head_local - B[f'calf_{s}'].head_local).length + (B[f'calf_{s}'].head_local - B[f'foot_{s}'].head_local).length for s in 'lr') / 2


# ------------------------------------------------------------------------------------------------- built-in clips
_PACKCLIP = None
def _pack_of(name):
    global _PACKCLIP
    if _PACKCLIP is None:
        _PACKCLIP = {}
        for e in catalog().values():
            f = str(e.get('file', ''))
            for k, fn in PACKS.items():
                if f.endswith(fn): _PACKCLIP[e['name']] = k
    return _PACKCLIP.get(name)


_PACKS_LOADED = {}
def _pack(pack):
    """The clip pack as glTF node empties + one action per clip (imported once per Blender run, removed after conversion)."""
    if pack in _PACKS_LOADED: return _PACKS_LOADED[pack]
    new, acts = _import_glb(LIB_ANIMS / PACKS[pack])
    top = next(o for o in new if o.parent is None)
    tp = next((a for a in acts if a.name.startswith('A_TPose')), None)     # the library's bind pose (rest) where present
    for o in new:
        if o.animation_data: o.animation_data.action = None
    if tp:
        for o in new:
            if o.type == 'EMPTY' and o != top: o.rotation_mode = 'QUATERNION'
    bpy.context.view_layer.update()
    _PACKS_LOADED[pack] = {'objs': new, 'acts': {re.sub(r'\.\d{3}$', '', a.name): a for a in acts}, 'top': top,
                           'E': {re.sub(r'\.\d{3}$', '', o.name): o for o in new}}
    return _PACKS_LOADED[pack]


def _drop_packs():
    for p in _PACKS_LOADED.values():
        for o in p['objs']:
            if o.name in bpy.data.objects: bpy.data.objects.remove(o, do_unlink=True)
        for a in p['acts'].values():
            if a.name in bpy.data.actions and not a.get('cz_keep'): bpy.data.actions.remove(a)
    _PACKS_LOADED.clear()


def _clip_path(body, name):
    return cache_root() / 'clips' / body / (re.sub(r'[^\w.-]+', '_', name) + '.blend')


_CLIP = {}
def clip(name, body):
    """The clip as a Blender action fitted to that body (cached): action['cz'] = {dur, loop, lift[], speed, mode}."""
    name = ACTS.get(name, name); key = (body, name)
    if key in _CLIP and _CLIP[key].name in bpy.data.actions: return _CLIP[key]
    q = quality(name, body)
    if q == 'broken': raise ValueError(f'human: clip "{name}" is marked BROKEN on the {body} body ({(catalog().get(name) or {}).get("notes", "")}): '
                                       f'pick another (H.clips(...) lists the good ones)')
    path = _clip_path(body, name)
    if not path.exists():
        e = catalog().get(name)
        if not e: raise ValueError(f'human: no clip "{name}". Close ones: {[x["name"] for x in clips(name)[:6]]}')
        if e.get('kind') == 'user': raise ValueError(f'human: user clip "{name}" has no cached action for {body}: run H.import_mixamo again')
        t = time.time(); _convert_builtin(name, body, path); STATS['clip_convert_s'] += time.time() - t; STATS['converted'] += 1
    t = time.time()
    with bpy.data.libraries.load(str(path), link=False) as (src, dst): dst.actions = list(src.actions)
    act = dst.actions[0]; STATS['clip_load_s'] += time.time() - t; STATS['loaded'] += 1
    _CLIP[key] = act; return act


def _convert_builtin(name, body, path):
    """recon prepareClip in Blender terms: bone basis = restrel^-1 . K^-1 . L(t) . K (L = the glTF node's local rotation,
    K = node frame -> Blender bone frame, constant), the pelvis translation scaled by the pelvis ratio; then cleanClip."""
    B = _body(body); arm = B['arm']; meta = B['meta']
    pk = _pack(_pack_of(name) or 'ual1'); src = pk['acts'].get(name)
    if src is None: raise ValueError(f'human: clip "{name}" is not in its pack')
    E = pk['E']; root_e = E.get('root')
    K = (root_e.matrix_world.to_quaternion().inverted() @ arm.data.bones['root'].matrix_local.to_quaternion()).normalized()
    Ki = K.inverted(); top_q = (root_e.parent.matrix_world.to_quaternion() if root_e.parent else Quaternion())
    ratio = meta['pelvis'] / SOURCE_PELVIS_REST          # (anim-runtime.js prepareClip: |pelvis| of the UAL bind pose)
    entry = catalog().get(name, {}); loop = bool(entry.get('loop', name.endswith('_Loop')))
    act, slot, cb = _new_action(f'cz:{body}:{name}')
    f0, f1 = src.frame_range; dur = (f1 - f0) / FPS
    bones = arm.data.bones
    for s, fcs in _group_slots(src).items():
        bn = re.sub(r'\.\d{3}$', '', s.identifier[2:])
        b = bones.get(bn)
        if not b or bn == 'root': continue
        rest = (b.parent.matrix_local.inverted() @ b.matrix_local) if b.parent else b.matrix_local
        rq = rest.to_quaternion(); rqi = rq.inverted()
        rot = fcs.get('rotation_quaternion')
        if rot:
            frames = sorted({k.co[0] for fc in rot for k in fc.keyframe_points})
            vals = [[], [], [], []]; prev = None
            for fr in frames:
                L = Quaternion([rot[i].evaluate(fr) for i in range(4)]).normalized()
                if bn == 'pelvis' and not b.parent: L = top_q @ L
                q = (rqi @ Ki @ L @ K).normalized()
                if prev is not None and prev.dot(q) < 0: q.negate()
                prev = q
                for i in range(4): vals[i].append(q[i])
            ff = [f - f0 + 1 for f in frames]
            vals = _clean_quat(ff, vals, loop, dur)
            for i in range(4): _put(cb, f'pose.bones["{bn}"].rotation_quaternion', i, ff, vals[i], bn)
        loc = fcs.get('location')
        if loc and bn == 'pelvis':
            frames = sorted({k.co[0] for fc in loc for k in fc.keyframe_points})
            ps = []
            for fr in frames:
                T = Vector([loc[i].evaluate(fr) for i in range(3)]) * ratio            # node local, parent node frame
                head_par = Ki @ T                                                     # -> parent bone frame (root)
                d = head_par - rest.to_translation()
                ps.append(rqi @ d)
            if loop and len(ps) > 2:                                                  # a loop's straight-line drift out (KK_Sneak_Loop)
                up = max(range(3), key=lambda k: sum(abs((rest.to_quaternion() @ p)[k]) for p in ps))
                dr = ps[-1] - ps[0]
                if dr.length > 0.02:
                    for i, p in enumerate(ps): ps[i] = p - dr * (i / (len(ps) - 1))
            ff = [f - f0 + 1 for f in frames]
            for i in range(3): _put(cb, f'pose.bones["{bn}"].location', i, ff, [p[i] for p in ps], bn)
    info = _measure(arm, act, slot, dur, name, meta)
    info.update(dur=dur, loop=loop, name=name, body=body, quality=quality(name, body))
    act['cz'] = json.dumps(info)
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.data.libraries.write(str(path), {act}, fake_user=True)
    bpy.data.actions.remove(act)


def _group_slots(act):
    out = {}
    for s, fc in _fcurves(act):
        d = out.setdefault(s, {}); lst = d.setdefault(fc.data_path, [None] * (4 if fc.data_path == 'rotation_quaternion' else 3))
        if fc.array_index < len(lst): lst[fc.array_index] = fc
    for s in out:
        for k in list(out[s]):
            if any(x is None for x in out[s][k]): del out[s][k]
    return out


def _clean_quat(frames, vals, loop, dur):
    """anims.js cleanClip on one bone: a one-shot's last key that snaps (>40 deg, 6x the step before) is dropped (as the
    previous); a loop whose last pose is off its first is blended toward it over its last quarter (<= 0.4 s)."""
    n = len(frames)
    if n < 4: return vals
    Q = [Quaternion([vals[i][k] for i in range(4)]) for k in range(n)]
    if not loop:
        a = math.degrees(Q[-1].rotation_difference(Q[-2]).angle); b = math.degrees(Q[-2].rotation_difference(Q[-3]).angle)
        if a > 40 and a > 6 * max(b, 1): Q[-1] = Q[-2].copy()
    else:
        first, last = Q[0].copy(), Q[-1]
        if first.dot(last) < 0: first.negate()
        if math.degrees(first.rotation_difference(last).angle) > 0.75:
            err = first @ last.inverted(); w = min(0.4, dur / 4) * FPS; fend = frames[-1]
            for k in range(n):
                u = smoother((frames[k] - (fend - w)) / max(1e-6, w))
                if u > 0: Q[k] = (Quaternion().slerp(err, u) @ Q[k]).normalized()
    return [[q[i] for q in Q] for i in range(4)]


def _measure(arm, act, slot, dur, name, meta):
    """Once per body x clip: the ground lift over the clip (the lowest drawn sole on z = 0, 'feet' clips) and the stride
    speed (m/s of the planted foot of an in-place travelling clip = recon animSpeed)."""
    sc = bpy.context.scene; linked = arm.name not in sc.collection.objects
    if linked: sc.collection.objects.link(arm)
    ad = arm.animation_data_create(); ad.action = act; set_slot(ad, slot)
    arm.data.pose_position = 'POSE'
    n = max(2, int(round(dur * 15)) + 1); ts, lows, feet = [], [], {s: [] for s in 'lr'}
    pb = arm.pose.bones
    for i in range(n):
        t = dur * i / (n - 1); f = 1 + t * FPS
        sc.frame_set(int(f), subframe=f - int(f))
        pts = [pb[x].head for x in FOOT_BONES if x in pb] + [pb[x].tail for x in FOOT_BONES if x in pb]
        ts.append(t); lows.append(min(p.z for p in pts) + meta['sole'])
        for s in 'lr': feet[s].append(min((pb[f'foot_{s}'].tail.copy(), pb[f'ball_{s}'].head.copy()), key=lambda p: p.z))
    ad.action = None
    if linked: sc.collection.objects.unlink(arm)
    mode = ground_mode(name)
    lift = [round(-z, 4) for z in lows] if mode == 'feet' else [round(-meta['zmin'], 4)] * n
    speed = 0.0
    if re.search(r'walk|jog|run|sprint|sneak|crouch_fwd|strafe', name, re.I):
        vs = []
        for s in 'lr':
            P = feet[s]; zmin = min(p.z for p in P)
            for i in range(1, n):
                if P[i].z < zmin + 0.02 and P[i - 1].z < zmin + 0.02:
                    vs.append((Vector((P[i].x, P[i].y)) - Vector((P[i - 1].x, P[i - 1].y))).length / (ts[i] - ts[i - 1]))
        if vs: vs.sort(); speed = vs[len(vs) // 2]
    return {'lift': lift, 'lift_dt': dur / (n - 1), 'speed': round(speed, 4), 'mode': mode}


def clip_info(name, body):
    return json.loads(clip(name, body)['cz'])


_FT = {}
def foot_track(name, body, n=60):
    """The clip's ball joints (armature space, the unscaled body) at n + 1 clip times over its length, by FK straight from
    the action's curves (no frame change, ~5 ms): {'l': [Vector], 'r': [Vector], 'dur', 'loop', 'n'}. walk() drives the
    root with it (the stance foot stays put)."""
    name = ACTS.get(name, name); key = (body, name)
    if key in _FT: return _FT[key]
    act = clip(name, body); info = json.loads(act['cz']); arm = _body(body)['arm']; B = arm.data.bones
    fcs = {}
    for s_, fc in _fcurves(act):
        m = re.match(r'pose\.bones\["(.+)"\]\.(rotation_quaternion|location)$', fc.data_path)
        if m: fcs.setdefault((m.group(1), m.group(2)), [None] * (4 if m.group(2) == 'rotation_quaternion' else 3))[fc.array_index] = fc
    chains = {}
    for s in 'lr':
        b = B[f'ball_{s}']; ch = []
        while b: ch.append(b); b = b.parent
        chains[s] = [(b, (b.parent.matrix_local.inverted() @ b.matrix_local) if b.parent else b.matrix_local.copy()) for b in reversed(ch)]
    out = {'l': [], 'r': [], 'dur': info['dur'], 'loop': info['loop'], 'n': n}
    for i in range(n + 1):
        fr = 1 + info['dur'] * i / n * FPS
        for s in 'lr':
            M = Matrix()
            for b, rest in chains[s]:
                q = fcs.get((b.name, 'rotation_quaternion')); l = fcs.get((b.name, 'location')); basis = Matrix()
                if l and all(l): basis = Matrix.Translation(Vector([l[k].evaluate(fr) for k in range(3)]))
                if q and all(q): basis = basis @ Quaternion([q[k].evaluate(fr) for k in range(4)]).normalized().to_matrix().to_4x4()
                M = M @ rest @ basis
            out[s].append(M.translation.copy())
    _FT[key] = out; return out


def _pass_phase(ft, dc, end=None):
    """The clip second to start a walk of dc clip seconds at, so it ends on a passing pose (the two balls nearest along
    the walk, the swing foot up) and starts as near one as that allows."""
    n, d = ft['n'], ft['dur'] or 1.0
    gap = [abs(ft['l'][i].y - ft['r'][i].y) for i in range(n)]
    gmax = max(gap) or 1.0
    passes = [i * d / n for i in range(n) if gap[i] <= gap[i - 1] and gap[i] <= gap[(i + 1) % n] and gap[i] < .25 * gmax]
    if not passes: return 0.0
    if end is not None:
        # of the two passing poses, the one whose planted foot already stands where the end clip puts that foot (an idle
        # stands staggered: ending the walk on the other foot slid it 16 cm in the fade, more than a leg IK can hold)
        def cost(p):
            s = min('lr', key=lambda x: _ft_at(ft, x, p).z); a, b = _ft_at(ft, s, p), _ft_at(end, s, 0.0)
            return (a.xy - b.xy).length
        p = min(passes, key=cost); return (p - dc) % d
    near = lambda c: min(min(abs(((c - p) + d / 2) % d - d / 2) for p in passes), d)
    return min((((p - dc) % d) for p in passes), key=near)


def _ft_at(ft, s, c):
    """foot_track sample at clip second c (a loop wraps, a one-shot holds its ends)."""
    d = ft['dur'] or 1.0; n = ft['n']
    u = ((c % d) / d) * n if ft['loop'] else max(0.0, min(n, c / d * n))
    i = int(math.floor(u)); k = u - i; i = min(i, n); j = min(n, i + 1)
    if ft['loop'] and i >= n: i, j = 0, 1
    return ft[s][i].lerp(ft[s][j], k)


# ------------------------------------------------------------------------------------------------- materials
_MATS = {}
def _finish_mats(finish, color, joint=None):
    key = (finish, color, joint)
    if key in _MATS: return _MATS[key]
    c = cz.col(color); jc = cz.col(joint) if joint else tuple(c[i] * 0.12 * 0.3 + cz.col('#1c1e23')[i] * 0.7 for i in range(3)) + (1,)
    out = []
    for part, col in (('body', c), ('joints', jc)):
        m = bpy.data.materials.new(f'fig_{finish}_{part}_{color}'); m.use_nodes = True; nt = m.node_tree
        bs = nt.nodes.get('Principled BSDF'); o = nt.nodes.get('Material Output')
        bs.inputs['Base Color'].default_value = col
        if finish == 'glossy':
            bs.inputs['Roughness'].default_value = 0.36 if part == 'joints' else 0.3
            for k, v in (('Coat Weight', 0.6 if part == 'joints' else 1.0), ('Coat Roughness', 0.2 if part == 'joints' else 0.1)):
                if k in bs.inputs: bs.inputs[k].default_value = v
        elif finish == 'glow':
            bs.inputs['Roughness'].default_value = 0.6
            em = nt.nodes.new('ShaderNodeEmission'); em.inputs[0].default_value = c; em.inputs[1].default_value = 0.45 if part == 'joints' else 0.85
            rim = nt.nodes.new('ShaderNodeEmission'); rim.inputs[0].default_value = tuple(c[i] + (1 - c[i]) * 0.55 for i in range(3)) + (1,); rim.inputs[1].default_value = 1.5
            lw = nt.nodes.new('ShaderNodeLayerWeight'); lw.inputs[0].default_value = 0.3
            mx = nt.nodes.new('ShaderNodeMixShader'); nt.links.new(lw.outputs['Facing'], mx.inputs[0]); nt.links.new(em.outputs[0], mx.inputs[1]); nt.links.new(rim.outputs[0], mx.inputs[2])
            ad = nt.nodes.new('ShaderNodeAddShader'); nt.links.new(bs.outputs[0], ad.inputs[0]); nt.links.new(mx.outputs[0], ad.inputs[1])
            nt.links.new(ad.outputs[0], o.inputs[0])
        else:
            bs.inputs['Roughness'].default_value = 0.7 if part == 'joints' else 0.85
        out.append(m)
    _MATS[key] = out; return out


def _xray_wrap(mat, color='#22e83a', alpha=0.55):
    """The figure's material with mega's X-ray look mixed in by a keyed value node 'cz_xr' (0 = solid, 1 = X-ray: the
    see-through emissive green with the brighter rim, as mega.xray)."""
    m = mat.copy(); m.name = mat.name + '_xr'; nt = m.node_tree; o = nt.nodes.get('Material Output')
    surf = o.inputs[0].links[0].from_socket
    em = nt.nodes.new('ShaderNodeEmission'); em.inputs[0].default_value = cz.col(color); em.inputs[1].default_value = 0.9
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    lw = nt.nodes.new('ShaderNodeLayerWeight'); lw.inputs[0].default_value = 0.35
    fa = nt.nodes.new('ShaderNodeMath'); fa.operation = 'MULTIPLY_ADD'; nt.links.new(lw.outputs['Facing'], fa.inputs[0]); fa.inputs[1].default_value = 0.5; fa.inputs[2].default_value = alpha
    cl = nt.nodes.new('ShaderNodeMath'); cl.operation = 'MINIMUM'; cl.inputs[1].default_value = 1.0; nt.links.new(fa.outputs[0], cl.inputs[0])
    xm = nt.nodes.new('ShaderNodeMixShader'); nt.links.new(cl.outputs[0], xm.inputs[0]); nt.links.new(tr.outputs[0], xm.inputs[1]); nt.links.new(em.outputs[0], xm.inputs[2])
    v = nt.nodes.new('ShaderNodeValue'); v.name = v.label = 'cz_xr'; v.outputs[0].default_value = 0.0
    mx = nt.nodes.new('ShaderNodeMixShader'); nt.links.new(v.outputs[0], mx.inputs[0]); nt.links.new(surf, mx.inputs[1]); nt.links.new(xm.outputs[0], mx.inputs[2])
    nt.links.new(mx.outputs[0], o.inputs[0])
    try: m.surface_render_method = 'BLENDED'
    except Exception: pass
    return m


# ------------------------------------------------------------------------------------------------- the figure
class Figure:
    def __init__(self, name, body, finish, color, at, face, height, joint=None, xray_color='#22e83a', shadow=True):
        self.name, self.body, self.finish, self.color = name, body, finish, color
        B = _body(body); self.meta = B['meta']
        self.height = height or self.meta['height']; self.s = self.height / self.meta['drawn_h']        # (recon: the figure's height / the body's drawn height)
        self.root = bpy.data.objects.new(f'fig_{name}', None); bpy.context.scene.collection.objects.link(self.root)
        self.root.empty_display_size = 0.3
        self.arm = bpy.data.objects.new(f'fig_{name}_arm', B['arm'].data); bpy.context.scene.collection.objects.link(self.arm)
        self.arm.parent = self.root; self.arm.scale = (self.s,) * 3
        self.mesh = bpy.data.objects.new(f'fig_{name}_body', B['mesh'].data); bpy.context.scene.collection.objects.link(self.mesh)
        self.mesh.parent = self.arm; md = self.mesh.modifiers.new('arm', 'ARMATURE'); md.object = self.arm
        self.mesh.visible_shadow = shadow
        mats = _finish_mats('matte' if finish == 'xray' else finish, color, joint)
        self._xr = finish == 'xray' or xray_color is not None
        if self._xr: mats = [_xray_wrap(m, xray_color or '#22e83a') for m in mats]
        for i, slot in enumerate(self.mesh.material_slots):        # (shared mesh data: the materials live on the object)
            slot.link = 'OBJECT'; slot.material = mats[1] if 'joint' in (B['mesh'].data.materials[i].name if B['mesh'].data.materials[i] else '') else mats[0]
        self.mats = mats
        if finish == 'xray': self.xray([(0, 1)])
        self.ad = self.arm.animation_data_create(); self.ad.action = None
        self.tracks = [self.ad.nla_tracks.new(), self.ad.nla_tracks.new()]
        self.tracks[0].name, self.tracks[1].name = 'A', 'B'
        self.strips = []           # [(t0, t1, clip, info, strip)]
        self.ctime = {}            # strip index -> (first frame, clip seconds per frame): strips whose time follows a walk
        self.path_keys = []        # root motion
        self.place(at, face)
        ALL.append(self)

    # placement + facing ----------------------------------------------------------------------------------------
    def place(self, at=(0, 0, 0), face=0, t=None):
        at = tuple(at) + (0,) * (3 - len(at)); self.root.location = at
        self.root.rotation_euler = (0, 0, self._yaw(face, at))
        if t is not None:
            self.root.keyframe_insert('location', frame=1 + t * FPS); self.root.keyframe_insert('rotation_euler', frame=1 + t * FPS)
        return self

    def _yaw(self, face, at):
        if face is None: return self.root.rotation_euler.z
        if isinstance(face, (int, float)): return math.radians(face)
        p = face.matrix_world.to_translation() if hasattr(face, 'matrix_world') else Vector(tuple(face) + (0,) * (3 - len(face)))
        d = Vector((p.x - at[0], p.y - at[1]))
        return math.atan2(d.x, -d.y) if d.length > 1e-6 else 0.0      # yaw 0 looks toward -Y

    def turn(self, t, face, dur=0.4):
        """Turn in place to face a point / yaw (deg) over dur seconds (smooth)."""
        z0 = self.root.rotation_euler.z; z1 = self._yaw(face, self.root.location)
        while z1 - z0 > math.pi: z1 -= 2 * math.pi
        while z1 - z0 < -math.pi: z1 += 2 * math.pi
        for k in range(0, 7):
            u = k / 6; self.root.rotation_euler.z = z0 + (z1 - z0) * smoother(u)
            self.root.keyframe_insert('rotation_euler', index=2, frame=1 + (t + dur * u) * FPS)
        return self

    # clips ------------------------------------------------------------------------------------------------------
    def play(self, name, t0, t1=None, speed=1.0, loop=None, blend=None, offset=0.0):
        """Play a clip from t0 to t1 (s). One-shots last their own length / speed unless t1 is given (then they hold their
        last pose); loops repeat. Every change of clip crossfades (blend_for, or blend= seconds). Calls in time order."""
        name = ACTS.get(name, name); act = clip(name, self.body); info = json.loads(act['cz'])
        lp = info['loop'] if loop is None else loop
        if t1 is None: t1 = t0 + (info['dur'] / max(1e-3, speed) if not lp else 4.0)
        if self.strips and t0 < self.strips[-1][0] + 0.05: raise ValueError(f'{self.name}.play("{name}", {t0}): calls must be in time order (last at {self.strips[-1][0]})')
        prev = self.strips[-1] if self.strips else None
        b = blend if blend is not None else (blend_for(prev[2], name) if prev else 0.0)
        if prev: b = min(b, max(0.0, (t0 - prev[0]) * 0.8))
        tr = self.tracks[len(self.strips) % 2]
        st = tr.strips.new(f'{name}@{t0:.2f}', int(1 + t0 * FPS), act)
        set_slot(st, act.slots[0])
        st.blend_type = 'REPLACE'; st.use_auto_blend = False; st.use_sync_length = False
        self.strips.append([t0, t1, name, info, st, b, speed, lp, offset])
        self._relayout()
        self._ground()
        return self

    def _relayout(self):
        """Crossfades on two tracks (NLA): strip i plays from its t0 to the end of the next one's fade-in; a B-track strip
        fades in over the A strip under it and out while the next A strip starts; A strips never fade (from the rest pose)."""
        S = self.strips
        for i, (t0, t1, name, info, st, b, sp, lp, off) in enumerate(S):
            nb = S[i + 1][5] if i + 1 < len(S) else 0.0
            end = S[i + 1][0] + nb if i + 1 < len(S) else t1
            clen = info['dur'] * FPS; span = max(1.0, (end - t0) * FPS)
            st.scale = 1.0; st.repeat = 1.0
            if lp:
                a0 = 1 + (off % max(1e-6, info['dur'])) * FPS
                st.action_frame_start = a0; st.action_frame_end = a0 + clen
                st.scale = 1.0 / max(1e-3, sp); st.repeat = max(0.01, span / (clen * st.scale))
            else:
                st.action_frame_start = 1; st.action_frame_end = 1 + max(clen, span * sp)    # past its last key: holds the end pose
                st.scale = 1.0 / max(1e-3, sp)
            st.frame_start_ui = 1 + t0 * FPS
            st.frame_end_ui = 1 + t0 * FPS + span
            st.blend_in = (b * FPS if i % 2 else 0.0); st.blend_out = (nb * FPS if i % 2 else 0.0)
            st.extrapolation = 'HOLD' if i == 0 else ('HOLD_FORWARD' if i == len(S) - 1 else 'NOTHING')

    def _clip_time(self, i, t):
        t0, t1, name, info, st, b, sp, lp, off = self.strips[i]
        if i in self.ctime:                                            # (a walk: the clip time follows the distance)
            fa, tab = self.ctime[i]; k = int(round(1 + t * FPS)) - fa
            return (tab[max(0, min(len(tab) - 1, k))] + off) % info['dur'] if lp else tab[max(0, min(len(tab) - 1, k))]
        return (((t - t0) * sp + off) % info['dur']) if lp else min(info['dur'], max(0.0, (t - t0) * sp))

    def pose_weights(self, t):
        """[(strip index, weight)] at time t (the crossfades as _relayout plays them)."""
        S = self.strips; i = 0
        while i + 1 < len(S) and t >= S[i + 1][0]: i += 1
        b = S[i][5]
        if i > 0 and b > 0 and t < S[i][0] + b:
            w = (t - S[i][0]) / b; return [(i - 1, 1 - w), (i, w)]
        return [(i, 1.0)]

    def clip_at(self, t):
        """The clip that dominates at t (hands.py VERIFIED checks)."""
        return self.strips[max(self.pose_weights(t), key=lambda x: x[1])[0]][2] if self.strips else None

    def _ground(self):
        """The armature's z lift per frame (recon GROUND table): the clips' lowest drawn sole on z = 0, crossfaded like the
        clips, scaled with the figure (an NLA track 'ground' over the clip tracks; the active action stays free for keys)."""
        a = self.arm; S = self.strips; frames, vals = [], []
        f0 = int(1 + S[0][0] * FPS); f1 = int(1 + max(s[1] for s in S) * FPS) + 2
        for f in range(f0, f1 + 1):
            t = (f - 1) / FPS; z = 0.0
            for i, w in self.pose_weights(t):
                info = S[i][3]; L = info['lift']; k = self._clip_time(i, t) / info['lift_dt']
                i0 = int(min(len(L) - 1, max(0, math.floor(k)))); i1 = min(len(L) - 1, i0 + 1)
                z += w * (L[i0] + (L[i1] - L[i0]) * (k - i0))
            frames.append(f); vals.append(z * self.s)
        old = bpy.data.actions.get(f'fig_{self.name}_ground')
        if old: bpy.data.actions.remove(old)
        act, slot, cb = _new_action(f'fig_{self.name}_ground')
        _put(cb, 'location', 2, frames, vals)
        ad = a.animation_data_create()
        tr = ad.nla_tracks.get('ground') or ad.nla_tracks.new()
        tr.name = 'ground'
        for s in list(tr.strips): tr.strips.remove(s)
        st = tr.strips.new('ground', 1, act)
        set_slot(st, slot)
        st.blend_type = 'REPLACE'; st.extrapolation = 'HOLD'

    def act(self, name, t0, t1=None, **kw):
        return self.play(ACTS.get(name, name), t0, t1, **kw)

    # walking ----------------------------------------------------------------------------------------------------
    def walk(self, path, t0, t1=None, clip_name='Walk_Loop', speed=None, turn=0.6, end_clip='Idle_Loop', end_for=2.0):
        """Walk along path [(x, y), ...] from t0; t1 = when the figure stands still at the end (None: at the clip's own
        stride speed x speed). Round 3 (foot slide < 2 cm, recon's sequence walk): the CLIP TIME FOLLOWS THE DISTANCE (the
        strip's time is keyed frame by frame, so the stance foot is planted at any speed), the root speed ramps up after
        the clip has half faded in and down to rest as the end clip fades in (smoother ramps, recon rootAt), and the root
        is driven by the stance foot: every frame it moves so the planted ball joint stays where it is, so a corner turns
        the body ABOUT the planted foot instead of swinging the foot round the hips. The heading follows the path (eased
        over `turn` metres x speed); the path points are corrected until the walk ends on the last point (< 1 cm)."""
        info = clip_info(clip_name, self.body); v0 = info['speed'] * self.s
        if v0 <= 0: raise ValueError(f'human.walk: "{clip_name}" has no stride (not a travelling clip)')
        z0 = self.root.location.z; start = self.root.location.copy(); y_start = self.root.rotation_euler.z
        P = [Vector(tuple(p)[:2] + (z0,)) for p in path]
        if (P[0].xy - start.xy).length > 0.05: P.insert(0, start.copy())
        target = P[-1].copy()
        prev = self.strips[-1][2] if self.strips else None
        Bi = blend_for(prev, clip_name) if prev else 0.0; Bo = blend_for(clip_name, end_clip) if end_clip else 0.0
        a_, b_ = 0.5 * Bi, Bi + 0.3; bo = Bo + 0.3                         # ramp up from t0 + a_ over b_; down over bo
        ft = foot_track(clip_name, self.body)
        end_ft = foot_track(end_clip, self.body) if end_clip else None
        best = None
        for it in range(10):
            segs = [(P[i + 1] - P[i]).length for i in range(len(P) - 1)]; L = sum(segs)
            if t1 is not None and it == 0: t_stop = t1
            if t1 is not None: V = L / max(.05, t_stop - t0 - a_ - b_ / 2 - bo / 2)
            else: V = v0 * (speed or 1.0); t_stop = t0 + a_ + b_ / 2 + bo / 2 + L / V
            fa, fb = int(math.floor(1 + t0 * FPS)), int(math.ceil(1 + t_stop * FPS))
            ts = [(f - 1) / FPS for f in range(fa, fb + 1)]
            vel = [V * smoother((t - t0 - a_) / b_) * (1 - smoother((t - (t_stop - bo)) / bo)) for t in ts]
            D = [0.0]
            for k in range(1, len(ts)): D.append(D[-1] + (vel[k] + vel[k - 1]) / 2 * (ts[k] - ts[k - 1]))
            D = [d * L / max(1e-9, D[-1]) for d in D]                       # (exactly L at the stop)
            # the heading as a function of the distance walked: each leg's direction, a centred average over turn x V metres
            def yaw_at(d):
                acc = 0.0
                for i, sl in enumerate(segs):
                    if d <= acc + sl or i == len(segs) - 1: dv = P[i + 1] - P[i]; return math.atan2(dv.x, -dv.y)
                    acc += sl
            w = max(.05, turn * V / 2); grid = [L * i / 400 for i in range(401)]; raw = []
            yp = y_start
            for d in grid:
                y = yaw_at(d)
                while y - yp > math.pi: y -= 2 * math.pi
                while y - yp < -math.pi: y += 2 * math.pi
                raw.append(y); yp = y
            sm = []
            for i, d in enumerate(grid):
                ws = [raw[j] for j, e in enumerate(grid) if abs(e - d) <= w]; sm.append(sum(ws) / len(ws))
            def yaw_s(d):
                u = min(399.999, max(0.0, d / max(1e-9, L) * 400)); i = int(u); return sm[i] + (sm[i + 1] - sm[i]) * (u - i)
            # the first steps turn from the figure's own heading into the path (over the ramp-up)
            yaws = []
            for k, t in enumerate(ts):
                y = yaw_s(D[k]); g = smoother((t - t0 - Bi) / max(.3, a_ + b_))     # (after the clip has faded in: turning in the fade dragged a foot 20 cm)
                while y - y_start > math.pi: y -= 2 * math.pi
                while y - y_start < -math.pi: y += 2 * math.pi
                yaws.append(y_start + (y - y_start) * g)
            # the clip's phase at the start: the walk ENDS on a passing pose (the feet side by side, one lifted), so the fade
            # into the end clip has no planted foot to drag across the floor (a stride pose faded to idle slid 20-26 cm)
            c0 = _pass_phase(ft, L / v0, end_ft)
            cts = [c0 + D[k] / v0 for k in range(len(ts))]                     # clip seconds
            # the stance foot drives the root: each foot's 'keep me still' root step, weighted by how planted it is (its
            # height over the clip's lowest: double support blends the two, no switch jump)
            zl = {s: min(p.z for p in ft[s]) for s in 'lr'}
            root = [start.copy()]
            for k in range(1, len(ts)):
                R0 = Matrix.Rotation(yaws[k - 1], 3, 'Z'); R1 = Matrix.Rotation(yaws[k], 3, 'Z'); acc = Vector((0, 0, 0)); ws = 0.0
                for s in 'lr':
                    p0, p1 = _ft_at(ft, s, cts[k - 1]), _ft_at(ft, s, cts[k])
                    w = math.exp(-max(0.0, (p0.z + p1.z) / 2 - zl[s]) / .006)
                    step = R0 @ (Vector((p0.x, p0.y, 0)) * self.s) - R1 @ (Vector((p1.x, p1.y, 0)) * self.s)
                    acc += step * w; ws += w
                r = root[-1] + acc / max(1e-9, ws); r.z = z0; root.append(r)
            err = target - root[-1]; err.z = 0
            if best is None or err.length < best[0]: best = (err.length, dict(err=err, root=root, yaws=yaws, cts=cts, V=V, t_stop=t_stop, fa=fa, fb=fb, L=L))
            if err.length < .01 or it == 7: break
            for i in range(1, len(P)): P[i] = P[i] + err * (.7 * i / (len(P) - 1)) if len(P) > 2 else P[i] + err * .7
        bd = best[1]; err, root, yaws, cts, V, t_stop, fa, fb, L = (bd[k] for k in ('err', 'root', 'yaws', 'cts', 'V', 't_stop', 'fa', 'fb', 'L'))
        # what the path correction leaves (a sharp turn at the start, a pass phase that jumped): spread smoothly over the
        # walk so it ends ON the point; a few cm per step, which H.plant() holds at every touch-down
        resid = err.length
        if resid >= .01:
            for k in range(len(root)): root[k] = root[k] + err * smoother(k / max(1, len(root) - 1))
        rate = V / v0
        if not 0.6 <= rate <= 1.6: print(f'CZ HUMAN {self.name}: walk plays {clip_name} at {rate:.2f}x (looks odd outside 0.6-1.6x: give the walk more / less time or use Jog_Fwd_Loop / Walk_Formal_Loop)')
        t_end = t_stop - Bo / 2 if end_clip else t_stop
        self.play(clip_name, t0, t_end if end_clip else t_stop, speed=rate)
        i_walk = len(self.strips) - 1; st = self.strips[i_walk][4]
        # the strip's time keyed frame by frame (cyclic in the action's range): clip time = distance / stride speed
        st.use_animated_time = True; st.use_animated_time_cyclic = True
        a0 = st.action_frame_start; ext = int(math.ceil((Bo + .1) * FPS))
        frames = list(range(fa, fb + 1)) + list(range(fb + 1, fb + 1 + ext)); ctab = cts + [cts[-1]] * ext
        for f, c in zip(frames, ctab):
            st.strip_time = a0 + c * FPS; st.keyframe_insert('strip_time', frame=f)
        for fc in st.fcurves:
            for kp in fc.keyframe_points: kp.interpolation = 'LINEAR'
        self.ctime[i_walk] = (fa, ctab)
        for k, f in enumerate(range(fa, fb + 1)):
            self.root.location = root[k]; self.root.rotation_euler.z = yaws[k]
            self.root.keyframe_insert('location', frame=f); self.root.keyframe_insert('rotation_euler', index=2, frame=f)
        for s, fc in _fcurves(self.root.animation_data.action):
            for kp in fc.keyframe_points: kp.interpolation = 'LINEAR'
        if end_clip: self.play(end_clip, t_end, t_stop + end_for)
        else: self._ground()
        self.walk_info = {'clip': clip_name, 'stride_speed': v0, 'speed': V, 'rate': rate, 'length': L, 't0': t0, 't1': t_stop,
                          'end_error_cm': round((target - root[-1]).xy.length * 100, 2), 'spread_cm': round(resid * 100, 1), 'iterations': it + 1}
        return self

    # sitting ---------------------------------------------------------------------------------------------------------
    def sit(self, seat, t0, t1=None, clip_name='Sitting_Idle_Loop', face=None):
        """Sit on a seat: seat = an object (its top under the pelvis) or a height (m). The sit clips sit on SEAT_H x
        height/1.8; the figure is lifted / lowered so the seat height matches."""
        h = seat if isinstance(seat, (int, float)) else (max((seat.matrix_world @ Vector(c)).z for c in seat.bound_box))
        if not isinstance(seat, (int, float)):
            c = seat.matrix_world.to_translation(); self.place((c.x, c.y, self.root.location.z), face if face is not None else None)
        self.play(clip_name, t0, t1)
        self.seat_dz = h - SEAT_H * self.height / 1.8
        self.root.location.z += self.seat_dz
        return self

    # head --------------------------------------------------------------------------------------------------------
    def look_at(self, target, t0, t1=None, w=0.85, ease=0.35):
        """Turn the head (and a little of the neck) toward an object / point between t0 and t1 (eased in and out)."""
        if not hasattr(target, 'matrix_world'):
            e = bpy.data.objects.new(f'fig_{self.name}_look', None); bpy.context.scene.collection.objects.link(e)
            e.location = Vector(tuple(target) + (0,) * (3 - len(target))); target = e
        for bn, ww in (('neck_01', 0.35), ('Head', 1.0)):
            if self.arm.pose is None: bpy.context.view_layer.update()     # (a new armature object has no pose until evaluated)
            pb = self.arm.pose.bones.get(bn)
            if not pb: continue
            # (the head / neck bones point up their Y; the face looks along their +Z: aim that)
            c = pb.constraints.new('DAMPED_TRACK'); c.target = target; c.track_axis = 'TRACK_Z'; c.name = f'look@{t0:.2f}'
            for t, v in ((t0 - 0.01, 0.0), (t0 + ease, w * ww * 0.6)) + (((t1 - ease, w * ww * 0.6), (t1, 0.0)) if t1 else ()):
                c.influence = v; c.keyframe_insert('influence', frame=1 + t * FPS)
        return self

    # looks -------------------------------------------------------------------------------------------------------
    def xray(self, keys):
        """keys [(t, 0..1)]: 0 = the solid finish, 1 = mega's X-ray look (needs figure(..., xray=True) or finish 'xray')."""
        for m in self.mats:
            v = m.node_tree.nodes.get('cz_xr')
            if not v: raise ValueError('figure.xray: make the figure with xray=True (or finish="xray")')
            for t, x in keys: v.outputs[0].default_value = x; v.outputs[0].keyframe_insert('default_value', frame=1 + t * FPS)
        return self

    def visible(self, spans):
        try:
            import mega
            mega.visible(self.root, spans, 1, 1 + max(s[1] for s in spans) * FPS)
        except Exception as e: print('CZ HUMAN visible', e)
        return self

    def bone_world(self, name, frame=None):
        if frame is not None: bpy.context.scene.frame_set(int(frame))
        pb = self.arm.pose.bones[name]; return self.arm.matrix_world @ pb.matrix

    def __repr__(self): return f'<Figure {self.name} {self.body} {self.finish}>'


def figure(who='main', finish=None, color=None, at=(0, 0, 0), face=0, height=None, name=None, xray=False, joint=None, shadow=True):
    """A person. who = a role (ROLES) | 'male' | 'female' | 'custom:<glb/fbx path>' (any humanoid, auto bone map).
    finish matte | glossy | glow | xray; xray=True: can fade to the X-ray look (f.xray(keys))."""
    if str(who).startswith('custom:'): return custom_figure(who[7:], at=at, face=face, height=height, name=name)
    body, fin, col = ROLES.get(who, (who if who in BODIES else 'male', 'matte', '#b9b2a6'))
    if who not in ROLES and who not in BODIES: raise ValueError(f'human.figure: "{who}" is not a role ({", ".join(ROLES)}) or a body (male, female, custom:<file>)')
    n = name or f'{who}{sum(1 for f in ALL if f.name.startswith(str(who)))}'
    return Figure(n, body, finish or fin, color or col, at, face, height, joint=joint, xray_color='#22e83a' if xray else None, shadow=shadow)


def crowd(n, area, clips_=('Idle_Loop', 'Idle_Talking_Loop', 'Idle_No_Loop'), t0=0.0, t1=10.0, seed=1, bodies=('male', 'female'),
          finish='matte', colors=('#b9b2a6', '#8a9097', '#9aa3ad', '#c9b79c'), face=None, spacing=0.75, avoid=None):
    """Extras: n figures in area (x0, y0, x1, y1), spaced >= spacing m, each a different body / colour / clip phase
    (shared mesh + armature data: only the pose and the NLA are per figure)."""
    import random
    R = random.Random(seed); pts = []; out = []
    tries = 0
    while len(pts) < n and tries < n * 60:
        tries += 1; p = Vector((R.uniform(area[0], area[2]), R.uniform(area[1], area[3]), 0))
        if any((p - q).length < spacing for q in pts): continue
        if avoid and avoid(p): continue
        pts.append(p)
    for i, p in enumerate(pts):
        b = bodies[i % len(bodies)]
        f = Figure(f'crowd{seed}_{i}', b, finish, colors[R.randrange(len(colors))], p, face if face is not None else R.uniform(-180, 180), None)
        c = clips_[R.randrange(len(clips_))]
        try: f.play(c, t0, t1, offset=R.uniform(0, 3.0), speed=R.uniform(0.92, 1.08))
        except ValueError: f.play('Idle_Loop', t0, t1, offset=R.uniform(0, 3.0))
        out.append(f)
    return out


# ------------------------------------------------------------------------------------------------- retargeting (Mixamo, any humanoid)
UE = ['root', 'pelvis', 'spine_01', 'spine_02', 'spine_03', 'spine_04', 'spine_05', 'neck_01', 'neck_02', 'Head']
for _s in 'lr':
    UE += [f'{b}_{_s}' for b in ('clavicle', 'upperarm', 'lowerarm', 'hand', 'thigh', 'calf', 'foot', 'ball', 'ball_leaf')]
    UE += [f'{f}_{k}_{_s}' for f in ('thumb', 'index', 'middle', 'ring', 'pinky') for k in ('01', '02', '03', '04_leaf')]
UELOW = {n.lower(): n for n in UE}
LIMB = {'shoulder': 'clavicle', 'arm': 'upperarm', 'upperarm': 'upperarm', 'forearm': 'lowerarm', 'lowerarm': 'lowerarm', 'hand': 'hand', 'upleg': 'thigh',
        'upperleg': 'thigh', 'thigh': 'thigh', 'leg': 'calf', 'lowerleg': 'calf', 'calf': 'calf', 'shin': 'calf', 'foot': 'foot', 'toebase': 'ball', 'toes': 'ball', 'toe': 'ball',
        'toe_end': 'ball_leaf', 'toeend': 'ball_leaf', 'ball': 'ball', 'clavicle': 'clavicle', 'collar': 'clavicle'}
TRUNK = {'hips': 'pelvis', 'pelvis': 'pelvis', 'spine': 'spine_01', 'spine1': 'spine_02', 'spine2': 'spine_03', 'chest': 'spine_02', 'upperchest': 'spine_03',
         'neck': 'neck_01', 'head': 'Head'}


def ue_name(name):
    """anims.js ueName: the UE5 bone a source bone stands for (mixamorig:LeftForeArm -> lowerarm_l, DEF-forearm.L ...), or None."""
    if not name: return None
    if name in UE: return name
    if name.lower() in UELOW: return UELOW[name.lower()]
    n = re.sub(r'^.*[:|]', '', name); n = re.sub(r'^mixamorig\d*_?', '', n, flags=re.I); n = re.sub(r'^(bip0?1|def|j_bip_[clr]|cc_base)[_ \-]?', '', n, flags=re.I)
    if n.lower() in TRUNK: return TRUNK[n.lower()]
    side = None
    m = re.match(r'^(left|right)[_ ]?(.*)$', n, re.I) or re.match(r'^(.*?)[_.](l|r|left|right)$', n, re.I)
    if m:
        if re.match(r'^(left|right)$', m.group(1), re.I): side, n = m.group(1)[0].lower(), m.group(2)
        else: side, n = m.group(2)[0].lower(), m.group(1)
    if not side: return None
    f = re.match(r'^(?:hand)?(thumb|index|middle|ring|pinky)[_ ]?(\d)$', n, re.I)
    if f:
        k = int(f.group(2)); fn = f.group(1).lower()
        return f'{fn}_0{k}_{side}' if 1 <= k <= 3 else f'{fn}_04_leaf_{side}' if k == 4 else None
    b = LIMB.get(re.sub(r'[\s_]', '', n.lower())) or LIMB.get(n.lower())
    return f'{b}_{side}' if b else None


DIR = {'pelvis': 'spine_01', 'spine_01': 'spine_02', 'spine_02': 'spine_03', 'spine_03': 'neck_01', 'neck_01': 'Head'}
for _s in 'lr':
    DIR.update({f'clavicle_{_s}': f'upperarm_{_s}', f'upperarm_{_s}': f'lowerarm_{_s}', f'lowerarm_{_s}': f'hand_{_s}', f'hand_{_s}': f'middle_01_{_s}',
                f'thigh_{_s}': f'calf_{_s}', f'calf_{_s}': f'foot_{_s}', f'foot_{_s}': f'ball_{_s}'})
    for _f in ('thumb', 'index', 'middle', 'ring', 'pinky'): DIR.update({f'{_f}_01_{_s}': f'{_f}_02_{_s}', f'{_f}_02_{_s}': f'{_f}_03_{_s}'})


def _frame(pos):
    """The rig's facing frame from its rest joints (x = the figure's left, y = forward, z = up), as a rotation matrix."""
    up = (pos('Head') - pos('pelvis')).normalized(); left = (pos('thigh_l') - pos('thigh_r')); left = (left - up * left.dot(up)).normalized()
    fwd = up.cross(left).normalized()
    return Matrix((left, fwd, up)).transposed()


def _snap(M):
    out = Matrix.Identity(3)
    for j in range(3):
        c = Vector((M[0][j], M[1][j], M[2][j])); i = max(range(3), key=lambda k: abs(c[k]))
        v = Vector((0, 0, 0)); v[i] = math.copysign(1, c[i]) if abs(c[i]) > 0.9 else 0
        if v.length == 0: v = c.normalized()
        for k in range(3): out[k][j] = v[k]
    return out


def retarget(src_arm, src_action, body, name, in_place=True):
    """recon anims.js retarget() in Blender: every mapped bone gets the source bone's armature-space rotation change since
    its rest, applied to the target's rest after the two rest bones are lined up (direction + roll); the pelvis
    translation scaled by the leg-length ratio; in place = the straight-line travel removed (its speed kept)."""
    B = _body(body); T = B['arm']; meta = B['meta']
    smap = {}
    for b in src_arm.data.bones:
        u = ue_name(b.name)
        if u and u not in smap: smap[u] = b.name
    need = ['pelvis', 'thigh_l', 'thigh_r', 'calf_l', 'calf_r', 'foot_l', 'foot_r', 'Head']
    miss = [n for n in need if n not in smap]
    if miss: raise ValueError(f'human.retarget: the clip skeleton has no {miss} (bones: {[b.name for b in src_arm.data.bones][:12]} ...)')
    SB, TB = src_arm.data.bones, T.data.bones
    S_rest = {u: (src_arm.matrix_world @ SB[n].matrix_local) for u, n in smap.items()}
    sP = lambda u: S_rest[u].to_translation(); tP = lambda u: TB[u].head_local
    R = _snap(_frame(tP) @ _frame(sP).transposed()).to_quaternion(); Ri = R.inverted()
    sleg = sum((sP(f'thigh_{s}') - sP(f'calf_{s}')).length + (sP(f'calf_{s}') - sP(f'foot_{s}')).length for s in 'lr') / 2
    ratio = meta['leg'] / max(1e-6, sleg)
    A = {}
    for tb in T.data.bones:
        u = tb.name; a = None
        if u in smap and DIR.get(u) in smap and DIR.get(u) in TB:
            ps = R @ (sP(DIR[u]) - sP(u)); pt = tP(DIR[u]) - tP(u)
            if ps.length > 1e-5 and pt.length > 1e-5: a = pt.rotation_difference(ps)
        if a is None: a = A.get(tb.parent.name, Quaternion()) if tb.parent else Quaternion()
        A[u] = a
    sc = bpy.context.scene; ad = src_arm.animation_data_create(); ad.action = src_action
    try: set_slot(ad, src_action.slots[0])
    except Exception: pass
    f0, f1 = src_action.frame_range; frames = list(range(int(f0), int(math.ceil(f1)) + 1))
    act, slot, cb = _new_action(f'cz:{body}:{name}')
    rot = {u: [[], [], [], []] for u in smap if u in TB and not u.endswith('leaf') and u != 'root'}
    hips = []; prev = {}
    for fr in frames:
        sc.frame_set(fr)
        Wt = {}
        for tb in T.data.bones:          # parents first (bones are in hierarchy order)
            u = tb.name
            if u in rot:
                Sq = (src_arm.matrix_world @ src_arm.pose.bones[smap[u]].matrix).to_quaternion()
                D = Sq @ S_rest[u].to_quaternion().inverted()
                Wt[u] = (R @ D @ Ri) @ A[u] @ tb.matrix_local.to_quaternion()
            else:
                pw = Wt.get(tb.parent.name) if tb.parent else None
                Wt[u] = (pw @ (tb.parent.matrix_local.inverted() @ tb.matrix_local).to_quaternion()) if pw is not None else tb.matrix_local.to_quaternion()
        for tb in T.data.bones:
            u = tb.name
            if u not in rot: continue
            pq = Wt[tb.parent.name] if tb.parent else Quaternion()
            rest = (tb.parent.matrix_local.inverted() @ tb.matrix_local).to_quaternion() if tb.parent else tb.matrix_local.to_quaternion()
            q = ((pq @ rest).inverted() @ Wt[u]).normalized()
            if u in prev and prev[u].dot(q) < 0: q.negate()
            prev[u] = q
            for i in range(4): rot[u][i].append(q[i])
        hp = (src_arm.matrix_world @ src_arm.pose.bones[smap['pelvis']].head) - sP('pelvis')
        hips.append(R @ hp * ratio)
    ad.action = None
    ff = [f - f0 + 1 for f in frames]
    for u, v in rot.items():
        for i in range(4): _put(cb, f'pose.bones["{u}"].rotation_quaternion', i, ff, v[i], u)
    flat = lambda v: Vector((v.x, v.y, 0)); travel = flat(hips[-1]) - flat(hips[0]); dur = (f1 - f0) / FPS
    moves = travel.length > 0.25 * TB['pelvis'].head_local.z * 0 + 0.25
    tbp = TB['pelvis']; rq = tbp.matrix_local.to_quaternion().inverted()
    locs = []
    for k, hp in enumerate(hips):
        v = hp - (travel * (k / max(1, len(hips) - 1)) if in_place and moves else Vector())
        locs.append(rq @ v)
    for i in range(3): _put(cb, 'pose.bones["pelvis"].location', i, ff, [l[i] for l in locs], 'pelvis')
    info = _measure(T, act, slot, dur, name, meta)
    info.update(dur=dur, loop=bool(re.search(r'loop|walk|run|idle|cycle', name, re.I)), name=name, body=body, quality=None, retargeted=True,
                bones=len(rot), travel_speed=round(travel.length / max(1e-6, dur), 3) if moves else 0.0)
    if moves and in_place and info['speed'] == 0: info['speed'] = info['travel_speed']
    act['cz'] = json.dumps(info)
    return act, info


def import_mixamo(path, name=None, bodies=('male', 'female'), in_place=True, tags=None):
    """The user's own clip (a Mixamo FBX they downloaded with their own account, or any humanoid FBX / GLB / BVH):
    retargeted onto both bodies and cached in <cache>/humans/user (never in the repo or the app). Returns the clip name."""
    path = Path(os.path.expanduser(str(path))); t = time.time()
    before = set(bpy.data.objects); acts0 = set(bpy.data.actions)
    ext = path.suffix.lower()
    if ext == '.fbx': bpy.ops.import_scene.fbx(filepath=str(path), automatic_bone_orientation=False, ignore_leaf_bones=False)
    elif ext in ('.glb', '.gltf'): _import_glb(path)
    elif ext == '.bvh': bpy.ops.import_anim.bvh(filepath=str(path), axis_forward='-Z', axis_up='Y', frame_start=1, use_fps_scale=True)
    else: raise ValueError(f'human.import_mixamo: {ext} is not FBX / GLB / GLTF / BVH')
    new = [o for o in bpy.data.objects if o not in before]; acts = [a for a in bpy.data.actions if a not in acts0]
    arm = next((o for o in new if o.type == 'ARMATURE'), None)
    if not arm or not acts: raise ValueError(f'human.import_mixamo: {path.name} has no armature with animation')
    nm = name or re.sub(r'\s+', ' ', path.stem).strip()
    ud = cache_root().parent / 'user'; ud.mkdir(parents=True, exist_ok=True)
    infos = {}
    for b in bodies:
        act, info = retarget(arm, acts[0], b, nm, in_place=in_place)
        p = _clip_path(b, nm); p.parent.mkdir(parents=True, exist_ok=True)
        bpy.data.libraries.write(str(p), {act}, fake_user=True); _CLIP[(b, nm)] = act; infos[b] = info
    src_kind = 'mixamo' if 'mixamo' in ' '.join(b.name for b in arm.data.bones).lower() else 'humanoid'
    for o in new: bpy.data.objects.remove(o, do_unlink=True)
    for a in acts: bpy.data.actions.remove(a)
    cf = ud / 'catalog.json'; cat = json.loads(cf.read_text(encoding='utf-8')) if cf.exists() else {'version': 1, 'entries': []}
    cat['entries'] = [e for e in cat['entries'] if e['name'] != nm]
    h = hashlib.sha1(path.read_bytes()).hexdigest()[:12]
    i0 = infos[bodies[0]]
    cat['entries'].append({'name': nm, 'id': nm, 'kind': 'user', 'source': src_kind,
                           'from': path.name, 'hash': h, 'loop': i0['loop'], 'duration': round(i0['dur'], 3), 'inPlace': in_place, 'speed': i0['speed'],
                           'tags': tags or [], 'hands': 'none', 'bodies': list(bodies), 'added': time.strftime('%Y-%m-%d')})
    cf.write_text(json.dumps(cat, indent=1), encoding='utf-8')
    global _CAT; _CAT = None
    print(f'CZ HUMAN import {path.name} -> "{nm}" ({i0["bones"]} bones, {i0["dur"]:.2f} s, speed {i0["speed"]} m/s) in {time.time() - t:.1f}s')
    return nm


_CUSTOM = {}
def _custom_source(src):
    """The rigged model as (armature, [skinned meshes]) kept hidden as the template (imported once per run): a GLB / GLTF /
    FBX path, or an assets.py key / query (A.model) whose download is a rigged humanoid."""
    if src in _CUSTOM and _CUSTOM[src][0].name in bpy.data.objects: return _CUSTOM[src]
    p = Path(os.path.expanduser(str(src)))
    before = set(bpy.data.objects); acts0 = set(bpy.data.actions)
    if p.suffix.lower() in ('.glb', '.gltf', '.fbx') and p.exists():
        if p.suffix.lower() == '.fbx': bpy.ops.import_scene.fbx(filepath=str(p), automatic_bone_orientation=False, ignore_leaf_bones=False)
        else: _import_glb(p)
        new = [o for o in bpy.data.objects if o not in before]
    else:
        import assets as A
        top = A.model(src); new = [top] + list(top.children_recursive)
    for a in [a for a in bpy.data.actions if a not in acts0]: bpy.data.actions.remove(a)
    arm = next((o for o in new if o.type == 'ARMATURE'), None)
    if arm is None: raise ValueError(f'human.figure("custom:{src}"): the model has no skeleton (a rigged humanoid is needed: GLB / FBX with an armature)')
    meshes = [o for o in new if o.type == 'MESH' and any(m.type == 'ARMATURE' and m.object == arm for m in o.modifiers)]
    if not meshes: raise ValueError(f'human.figure("custom:{src}"): no mesh is skinned to its skeleton')
    bpy.context.view_layer.update()
    mw = arm.matrix_world.copy(); arm.parent = None; arm.matrix_world = mw
    for o in meshes:
        w = o.matrix_world.copy(); o.parent = arm; o.matrix_world = w
    for o in new:
        if o not in meshes and o != arm: bpy.data.objects.remove(o, do_unlink=True)
    arm.animation_data_clear()
    for o in [arm] + meshes: o.hide_render = True; o.hide_viewport = True
    _CUSTOM[src] = (arm, meshes); return _CUSTOM[src]


def custom_figure(src, at=(0, 0, 0), face=0, height=None, name=None, body=None, finish='matte', color='#b9b2a6'):
    """customchar.js in Blender: ANY rigged humanoid (an uploaded GLB / FBX, a Mixamo character, a library model) as a
    figure. Its bones are auto-mapped (ue_name: mixamorig:LeftForeArm, DEF-forearm.L, Bip01 L Forearm, UE names ...); a
    hidden mannequin of the nearest build plays the clips (play / walk / sit / look_at / plant all work unchanged), and every
    mapped bone of the model copies its mannequin bone's world turn since rest, applied to its own rest after the two
    bone directions are lined up (an A-pose model follows a T-pose clip right), the hips its place. The model is scaled so
    its hip height is the mannequin's (feet on the floor). Holds (hands.py) stay mannequin-only. Returns the Figure (f.custom
    = {arm, meshes, mapped})."""
    t = time.time(); tarm0, tmeshes = _custom_source(src)
    T = tarm0.data.bones; smap = {}
    for b in T:
        u = ue_name(b.name)
        if u and u not in smap: smap[u] = b.name
    need = ['pelvis', 'thigh_l', 'thigh_r', 'calf_l', 'calf_r', 'foot_l', 'foot_r', 'upperarm_l', 'upperarm_r', 'lowerarm_l', 'lowerarm_r', 'Head']
    miss = [n for n in need if n not in smap]
    if miss: raise ValueError(f'human.figure("custom:{src}"): no {miss} in its skeleton ({[b.name for b in T][:14]} ...): not a humanoid rig the auto map knows')
    cw = tarm0.matrix_world
    cpos = lambda u: cw @ T[smap[u]].head_local
    hip_c = cpos('pelvis').z - min(cpos('foot_l').z, cpos('foot_r').z)
    body = body or 'male'
    f = Figure(name or f'custom{sum(1 for x in ALL if x.name.startswith("custom"))}', body, finish, color, at, face, height)
    f.mesh.hide_render = True; f.mesh.hide_viewport = True                          # (the driver: never drawn)
    B = f.arm.data.bones; meta = f.meta
    hip_m = (B['pelvis'].head_local.z - min(B['foot_l'].head_local.z, B['foot_r'].head_local.z)) * f.s
    k = hip_m / max(1e-6, hip_c)
    # the copy: a linked duplicate (data shared, its own pose), under the figure's root, facing like the mannequin
    arm = tarm0.copy(); bpy.context.scene.collection.objects.link(arm); arm.hide_render = arm.hide_viewport = False
    sP = lambda u: cw @ T[smap[u]].head_local
    tP = lambda u: B[u].head_local
    Rf = _snap(_frame(tP) @ _frame(sP).transposed())                               # model facing -> mannequin facing
    arm.parent = f.root
    arm.matrix_parent_inverse = Matrix()
    # model rest (world, at the root's origin) = Rf @ (k * (cw @ x)); its pelvis over the mannequin's
    base = Rf.to_4x4() @ Matrix.Scale(k, 4) @ cw
    off = (B['pelvis'].head_local * f.s) - (base @ T[smap['pelvis']].head_local)
    arm.matrix_basis = Matrix.Translation(off) @ base
    meshes = []
    for m0 in tmeshes:
        m = m0.copy(); bpy.context.scene.collection.objects.link(m); m.hide_render = m.hide_viewport = False
        m.parent = arm; m.matrix_parent_inverse = Matrix(); m.matrix_basis = cw.inverted() @ m0.matrix_world
        for md in m.modifiers:
            if md.type == 'ARMATURE': md.object = arm
        meshes.append(m)
    bpy.context.view_layer.update()
    if arm.pose is None or f.arm.pose is None: bpy.context.view_layer.update()
    # the helpers: one empty per mapped bone, a child of the mannequin bone, whose world turn at the mannequin's REST is the
    # model bone's rest turn after its direction is lined up with the mannequin bone's (A_u)
    f.arm.data.pose_position = 'REST'; arm.data.pose_position = 'REST'; bpy.context.view_layer.update()
    AW, MW = arm.matrix_world, f.arm.matrix_world; mapped = 0; helpers = []
    for tb in arm.data.bones:                                                       # (parents first)
        u = ue_name(tb.name)
        if not u or u not in B or smap.get(u) != tb.name: continue
        Wc = AW @ tb.matrix_local; Wm = MW @ B[u].matrix_local
        A_u = Quaternion()
        nu = DIR.get(u)
        if nu and nu in smap and nu in B:
            dc = (AW @ arm.data.bones[smap[nu]].head_local) - (AW @ tb.head_local); dm = (MW @ B[nu].head_local) - (MW @ B[u].head_local)
            if dc.length > 1e-5 and dm.length > 1e-5: A_u = dc.rotation_difference(dm)
        e = bpy.data.objects.new(f'cz {f.name} {u}', None); bpy.context.scene.collection.objects.link(e); e.empty_display_size = .02
        e.hide_render = True; e.hide_viewport = True
        e.parent = f.arm; e.parent_type = 'BONE'; e.parent_bone = u
        bpy.context.view_layer.update()
        e.matrix_world = Matrix.Translation(Wc.translation) @ (A_u.to_matrix() @ Wc.to_3x3().normalized()).to_4x4()
        helpers.append((tb.name, e, u))
    f.arm.data.pose_position = 'POSE'; arm.data.pose_position = 'POSE'; bpy.context.view_layer.update()
    for bn, e, u in helpers:
        pb = arm.pose.bones[bn]
        c = pb.constraints.new('COPY_ROTATION'); c.target = e; c.name = 'cz follow'
        if u == 'pelvis':
            cl = pb.constraints.new('COPY_LOCATION'); cl.target = e; cl.name = 'cz follow hips'
        mapped += 1
    f.custom = {'arm': arm, 'meshes': meshes, 'mapped': mapped, 'scale': k, 'src': str(src), 'bones': len(arm.data.bones)}
    print(f'CZ HUMAN custom {Path(str(src)).name}: {mapped} of {len(arm.data.bones)} bones follow the {body} clips (scale {k:.3f}) in {time.time() - t:.2f}s')
    return f


def report():
    """Timings of this run (first import vs cached)."""
    return dict(STATS, figures=len(ALL))


def foot_slide(figs=None, limit_cm=2.0, verbose=True):
    """The foot-slide check: every frame of each figure's clips, each foot's contact point (ball joint) in world space;
    planted = within 2.5 cm of the ground under it (the figure's root z) and moving < 0.25 m/s vertically. A planted
    phase whose contact point travels more than limit_cm (horizontal) slides. Lines:
      CZ FOOTSLIDE <figure> <L|R> <t0>-<t1>s <cm> cm (<clip>)      CZ FOOTSLIDE OK <figure> (max <cm> cm, <n> steps)"""
    out = [r['line'] for r in _slides(figs, limit_cm)]
    if verbose:
        for l in out: print(l)
    return out


def _slides(figs=None, limit_cm=2.0):
    """Every planted phase of every figure's feet ({'f', 'side', 'fr0', 'fr1', 'cm', 'clip', 'yaw_deg', 'root_cm', 'line'});
    the clean figures get one OK record (cm = their worst)."""
    sc = bpy.context.scene; out = []; f0 = sc.frame_current
    for f in (figs or ALL):
        if not f.strips: continue
        a, b = int(1 + f.strips[0][0] * FPS), int(1 + max(s[1] for s in f.strips) * FPS)
        if getattr(f, 'seat_dz', None) is not None and not any(ground_mode(s[2]) == 'feet' for s in f.strips): continue
        tr = {s: [] for s in 'lr'}; roots = {}
        for fr in range(a, b + 1):
            sc.frame_set(fr); z0 = f.root.matrix_world.translation.z; roots[fr] = (f.root.matrix_world.translation.copy(), f.root.matrix_world.to_euler().z)
            for s in 'lr':
                p = f.arm.matrix_world @ f.arm.pose.bones[f'ball_{s}'].head; tr[s].append((fr, p.copy(), z0))
        worst = 0.0; steps = 0; mine = []
        for s in 'lr':
            ph = []; zlow = min(p.z - z0 for fr, p, z0 in tr[s])
            for i, (fr, p, z0) in enumerate(tr[s]):
                vz = abs(p.z - tr[s][i - 1][1].z) * FPS if i else 0
                clip = f.clip_at((fr - 1) / FPS) or ''
                planted = p.z - z0 < zlow + .015 and vz < .25 and ground_mode(clip) == 'feet'       # (near this foot's lowest)
                if planted: ph.append((fr, p))
                if (not planted or i == len(tr[s]) - 1) and len(ph) >= 3:
                    d = (Vector((ph[-1][1].x, ph[-1][1].y)) - Vector((ph[0][1].x, ph[0][1].y))).length * 100; steps += 1; worst = max(worst, d)
                    if d > limit_cm:
                        r0, r1 = roots[ph[0][0]], roots[ph[-1][0]]
                        mine.append({'f': f, 'side': s, 'fr0': ph[0][0], 'fr1': ph[-1][0], 'cm': d, 'clip': f.clip_at((ph[0][0] - 1) / FPS),
                                     'yaw_deg': abs(math.degrees((r1[1] - r0[1] + math.pi) % (2 * math.pi) - math.pi)), 'root_cm': (r1[0] - r0[0]).xy.length * 100,
                                     'line': f'CZ FOOTSLIDE {f.name} {s.upper()} {(ph[0][0] - 1) / FPS:.2f}-{(ph[-1][0] - 1) / FPS:.2f}s {d:.1f} cm ({f.clip_at((ph[0][0] - 1) / FPS)})'})
                if not planted: ph = []
        out += mine
        if not mine: out.append({'f': f, 'ok': True, 'cm': worst, 'line': f'CZ FOOTSLIDE OK {f.name} (max {worst:.1f} cm, {steps} steps)'})
    sc.frame_set(f0)
    return out


PLANTS = []
def plant(figs=None, cap=0.3, ease=3):
    """Planted feet stay put (recon figures.js pTable / legs(), here in WORLD space after everything is laid out): every
    phase in which a foot rests on the floor (the foot-slide check's own test) is found on the evaluated figure, and that
    foot is held where it touches down by a leg IK (thigh + calf, the ankle to a keyed target, the foot's own world turn
    kept), eased in / out over `ease` frames outside the phase. Catches what the clips and crossfades leave: idle clips
    that shuffle 5-10 cm, the fade from a walk into a stand, a turn's start. A phase needing more than `cap` m is left
    alone (the check reports it). Call ONCE after every play / walk / hold of the shot: H.plant()."""
    sc = bpy.context.scene; f0 = sc.frame_current; n_ph = 0; t = time.time()
    for f in (figs or ALL):
        if not f.strips or not any(ground_mode(s[2]) == 'feet' for s in f.strips): continue
        a, b = int(1 + f.strips[0][0] * FPS), int(1 + max(s[1] for s in f.strips) * FPS)
        if f.arm.pose is None: bpy.context.view_layer.update()
        old = [c for s in 'lr' for c in f.arm.pose.bones[f'foot_{s}'].constraints if c.name.startswith('plant')]
        for c in old: c.mute = True
        rec = {s: [] for s in 'lr'}
        for fr in range(a, b + 1):
            sc.frame_set(fr); z0 = f.root.matrix_world.translation.z
            for s in 'lr':
                Mf = f.arm.matrix_world @ f.arm.pose.bones[f'foot_{s}'].matrix
                rec[s].append((fr, (f.arm.matrix_world @ f.arm.pose.bones[f'ball_{s}'].head).copy(), Mf.copy(), z0))
        for s in 'lr':
            R = rec[s]; zlow = min(p.z - z0 for fr, p, M_, z0 in R); W = [0.0] * len(R); C = [Vector((0, 0, 0))] * len(R)
            planted = []
            for i, (fr, p, M_, z0) in enumerate(R):
                vz = abs(p.z - R[i - 1][1].z) * FPS if i else 0
                planted.append(p.z - z0 < zlow + .015 and vz < .25 and ground_mode(f.clip_at((fr - 1) / FPS) or '') == 'feet')
            i = 0
            while i < len(R):
                if not planted[i]: i += 1; continue
                j = i
                while j + 1 < len(R) and planted[j + 1]: j += 1
                if j - i >= 1:
                    anc = R[i][1].xy.copy(); far = max((anc - R[k][1].xy).length for k in range(i, j + 1))
                    if os.environ.get("CZ_PLANTDBG") and far > .03: print("CZ PLANTDBG", f.name, s, R[i][0], R[j][0], round(far * 100, 1))
                    if far > 0.004 and far < cap:
                        n_ph += 1
                        for k in range(max(0, i - ease), min(len(R), j + ease + 1)):
                            w = 1.0 if i <= k <= j else smoother(1 - (i - k) / (ease + 1)) if k < i else smoother(1 - (k - j) / (ease + 1))
                            if w > W[k]: W[k] = w; d = anc - R[k][1].xy; C[k] = Vector((d.x, d.y, 0))
                i = j + 1
            if not any(W): continue
            e = bpy.data.objects.get(f'plant {f.name} {s}') or bpy.data.objects.new(f'plant {f.name} {s}', None)
            if e.name not in sc.collection.objects: sc.collection.objects.link(e)
            e.empty_display_size = .05; e.rotation_mode = 'QUATERNION'; e.animation_data_clear()
            pb = f.arm.pose.bones[f'foot_{s}']
            for c in list(pb.constraints):
                if c.name.startswith('plant'): pb.constraints.remove(c)
            ik = pb.constraints.new('IK'); ik.name = 'plant ik'; ik.target = e; ik.chain_count = 2; ik.use_tail = False; ik.use_stretch = False
            cr = pb.constraints.new('COPY_ROTATION'); cr.name = 'plant rot'; cr.target = e
            for k, (fr, p, Mf, z0) in enumerate(R):
                e.location = Mf.translation + C[k] * W[k]; e.rotation_quaternion = Mf.to_quaternion()
                e.keyframe_insert('location', frame=fr); e.keyframe_insert('rotation_quaternion', frame=fr)
                for c in (ik, cr): c.influence = W[k]; c.keyframe_insert('influence', frame=fr)
            PLANTS.append((f, s))
    sc.frame_set(f0)
    print(f'CZ HUMAN plant: {n_ph} planted phases held in {time.time() - t:.2f}s')
    return n_ph


def foot_issues(figs=None, limit_cm=2.0, verbose=True):
    """run.py --check's foot-slide gate (package B wiring): one line per planted foot that slides more than limit_cm, nothing
    when every foot stays put:  CZ FOOTSLIDE <figure> f=<frame> slide=<cm> fix: <how>"""
    out = []
    for r in _slides(figs, limit_cm):
        if r.get('ok'): continue
        f = r['f']; clip = r['clip'] or ''
        if r['yaw_deg'] > 8 and r['root_cm'] < 5: how = f'the figure turns {r["yaw_deg"]:.0f} deg on the spot (f.turn): let the walk arrive facing that way, or turn less than 20 deg'
        elif r['root_cm'] > 1 and not re.search(r'walk|jog|run|sprint|sneak', clip, re.I): how = f'the figure moves {r["root_cm"]:.0f} cm under the standing clip {clip}: move it with f.walk, or place() it before the clip'
        elif re.search(r'walk|jog|run|sprint|sneak', clip, re.I): how = f'{clip}: give the walk a straighter path or more time (f.walk t1=), keep the playback rate 0.8-1.3x'
        else: how = f'the crossfade into / out of {clip}: a longer blend= on the next f.play, or another clip (H.clips)'
        out.append(f'CZ FOOTSLIDE {f.name} f={r["fr0"]} slide={r["cm"]:.1f} fix: {r["side"].upper()} foot {(r["fr0"] - 1) / FPS:.2f}-{(r["fr1"] - 1) / FPS:.2f}s; {how}')
    if verbose:
        for l in out: print(l)
    return out
