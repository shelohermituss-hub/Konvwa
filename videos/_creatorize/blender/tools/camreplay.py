# Replay ONLY the cameras of a film's shots (no scene build: seconds for a 40-shot film) and dump every frame's camera
# pose, so tools/camstats.py can measure the exact motion (velocity / acceleration / jerk, rest at the cuts, seams):
#   blender -b --factory-startup -P tools/camreplay.py -- <film dir> <out.json> [--legacy]
# Each shot's camera call is read from its file (C.cam(F0, F1, keys, **kw) of the example common.py, M.Flight(keys, **kw)
# .bake(F0, F1), or M.Tour(...).bake(F0, F1)) and evaluated with F0 / F1 / T / math and the film's common constants;
# a shot whose keys need its own scene (variables computed in build) is listed as skipped. --legacy = the v4 Flight.
import ast, json, math, os, re, sys, io, contextlib
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), 'engine'))
import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
film, outp = os.path.abspath(argv[0]), argv[1]
if '--legacy' in argv: os.environ['CZ_FLIGHT'] = '4'
import cz, mega as M
FPS = cz.FPS
T = lambda f: (f - 1) / FPS
try: cfg = json.load(open(os.path.join(film, 'assemble.json'), encoding='utf-8-sig'))
except FileNotFoundError:            # (no assemble.json, e.g. the skill's examples: every sequence file, by first frame)
    def _f0(n):
        m_ = re.search(r'^F0\s*,\s*F1\s*=\s*(\d+)', open(os.path.join(film, n), encoding='utf-8-sig').read(), re.M)
        return int(m_.group(1)) if m_ else None
    seq = [(f0, n[:-3]) for n in os.listdir(film) if re.match(r'^[a-z]+\d+\.py$', n) for f0 in [_f0(n)] if f0 is not None]
    cfg = {'shots': [n for _, n in sorted(seq)]}


def consts(path):
    """Module-level NAME = <literal> assignments of a file (common.py's MASTER, CLIFF ...)."""
    out = {}
    if not os.path.exists(path): return out
    try: tree = ast.parse(open(path, encoding='utf-8-sig').read())
    except Exception: return out
    for n in tree.body:
        if isinstance(n, ast.Assign) and len(n.targets) == 1 and isinstance(n.targets[0], ast.Name):
            try: out[n.targets[0].id] = ast.literal_eval(n.value)
            except Exception:
                try: out[n.targets[0].id] = eval(compile(ast.Expression(n.value), path, 'eval'), {'math': math, **out})
                except Exception: pass
    return out


class NS: pass


common = NS()
extra = [a_ for a_ in argv[2:] if a_.endswith('.py')]          # more constant files (a test's shared set module)
# the shared module the shots import as C / K (`import set_common as C`: the camera tests), found next to the film or one
# folder up (fix round 2026-10-30: the shipped tour tests were all "skipped" because only common.py was read)
for s_ in cfg['shots']:
    try: src_ = open(os.path.join(film, s_ + '.py'), encoding='utf-8-sig').read()
    except Exception: continue
    for mod in re.findall(r'\b(\w+)\s+as\s+[CK]\b', src_):
        for cand in (os.path.join(film, mod + '.py'), os.path.join(os.path.dirname(film), mod + '.py')):
            if os.path.exists(cand) and cand not in extra and mod not in ('common', 'kit'): extra.append(cand); break
for k, v in {**consts(os.path.join(film, 'kit.py')), **consts(os.path.join(film, 'common.py')), **{k_: v_ for x in extra for k_, v_ in consts(x).items()}}.items(): setattr(common, k, v)
common.T = T
res, skipped = [], []
for s in cfg['shots']:
    py = os.path.join(film, s + '.py')
    src = open(py, encoding='utf-8-sig').read()
    m = re.search(r'^F0\s*,\s*F1\s*=\s*(\d+)\s*,\s*(\d+)', src, re.M)
    if not m: skipped.append((s, 'no F0, F1')); continue
    F0, F1 = int(m.group(1)), int(m.group(2))
    ns = {'F0': F0, 'F1': F1, 'T': T, 'math': math, 'C': common, 'K': common, 'M': M, 'Vector': Vector, **consts(py)}
    call = None; K = None; M._LAST_DIST = None; M._LAST_DI = None
    for n in ast.walk(ast.parse(src)):
        if isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute) and n.func.attr in ('cam', 'Flight', 'Tour'):
            call = n; break
    if call is None: skipped.append((s, 'no camera call')); continue
    ev = lambda node: eval(compile(ast.Expression(node), py, 'eval'), ns)
    cz.reset(); sc = bpy.context.scene; sc.render.fps = FPS; sc.frame_start, sc.frame_end = 1, F1 + 2
    buf = io.StringIO()
    try:
        kw = {k.arg: ev(k.value) for k in call.keywords if k.arg}
        with contextlib.redirect_stdout(buf):
            if call.func.attr == 'cam':
                keys = ev(call.args[2]); K = [(T(k[0]),) + tuple(k[1:]) for k in keys]
                M.Flight(K, **kw).bake(F0, F1)
            elif call.func.attr == 'Flight':
                K = ev(call.args[0]); M.Flight(K, **kw).bake(F0, F1)
            else:
                M.Tour(ev(call.args[0]) if call.args else kw.pop('stops'), **kw).bake(F0, F1)
    except Exception as e:
        skipped.append((s, f'{type(e).__name__}: {e}'[:160])); continue
    cam = sc.camera; fr = []
    # the subject distance (screen motion = eye motion / this): the keys' eye -> target, else the focus distance
    dist = getattr(M, '_LAST_DIST', None); DI = getattr(M, '_LAST_DI', None) or {}
    for f in range(F0 - 1, F1 + 2):
        sc.frame_set(f); mw = cam.matrix_world.copy(); q = mw.to_quaternion()
        fr.append({'f': f, 'e': list(mw.to_translation()), 'd': list(q @ Vector((0, 0, -1))), 'u': list(q @ Vector((0, 1, 0))),
                   'lens': cam.data.lens, 'fd': cam.data.dof.focus_distance if cam.data.dof.use_dof else None,
                   'dist': DI.get(f)})        # (the subject distance per frame: camstats then measures like cam_report)
    # sub-frame samples (motion blur sees the camera between frames): eye + view at f + 0.5
    half = []
    for f in range(F0, F1):
        sc.frame_set(f, subframe=0.5); mw = cam.matrix_world.copy()
        half.append(list(mw.to_translation()) + list(mw.to_quaternion() @ Vector((0, 0, -1))))
    rep = [l for l in buf.getvalue().splitlines() if l.startswith('CZ CAM')]
    if dist is None:
        try: dist = sum((Vector(k[2]) - Vector(k[1])).length for k in K) / len(K)
        except Exception: dist = None
    res.append({'shot': s, 'f0': F0, 'f1': F1, 'frames': fr, 'half': half, 'report': rep, 'dist': dist,
                'vfov': math.degrees(2 * math.atan(cam.data.sensor_height / 2 / cam.data.lens))})
json.dump({'film': film, 'shots': res, 'skipped': skipped}, open(outp, 'w'))
print(f'CAMREPLAY {len(res)} shots, {len(skipped)} skipped -> {outp}')
for s in skipped: print('  skipped', s)
