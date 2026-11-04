# Outils communs du film (les aides des films du moteur, engine_api.md §12) : murs à vrais trous, visibilité, porter,
# allonger, surélever, habillage protégé, badges sur la poitrine. Les fichiers de séquence l'importent.
import math
import os

from mathutils import Matrix, Vector

import cz

HERE = os.path.dirname(os.path.abspath(__file__))
FPS = 30
fr = cz.frame_of


def T(name):
    """Chemin absolu d'une image du film (tex/<name>)."""
    return os.path.join(HERE, 'tex', name)


def visible(obj, spans, f0, f1):
    """obj (et ses enfants) visible au rendu seulement dans les intervalles [(t_on, t_off), ...]."""
    for o in [obj] + list(obj.children_recursive):
        for f in range(f0, f1 + 1):
            t = (f - 1) / FPS
            on = any(a <= t < b for a, b in spans)
            prev = None if f == f0 else (not any(a <= (f - 2) / FPS < b for a, b in spans))
            if f == f0 or prev != (not on):
                o.hide_render = not on
                o.keyframe_insert('hide_render', frame=f)


def show(root, t_on=-1e9, t_off=1e9, F0=1, F1=2, away=(0, 0, -80)):
    """Garde un objet à sa place seulement entre t_on et t_off (rangé loin sous le sol sinon)."""
    base = root.location.copy()
    cz.bake(root, 'location', [tuple(base) if t_on <= (f - 1) / FPS < t_off else tuple(base + Vector(away))
                               for f in range(F0, F1 + 1)], F0, interp='CONSTANT')


def lie(c, loc, roll=35.0, head='-X'):
    """Allonge c sur le dos en loc (tête vers -X, visage en haut, tourné vers la caméra). Placer c en (0, 0, 0)."""
    pv = cz.empty(c.name + '_liepv', loc)
    M = (Matrix.Rotation(math.radians(roll), 4, 'X') @ Matrix.Rotation(math.radians(90 if head == '-X' else -90), 4, 'Z')
         @ Matrix.Rotation(math.radians(-90), 4, 'X'))
    pv.rotation_euler = M.to_euler()
    c.root.parent = pv
    return pv


def lift(c, z):
    """Pose c sur un plancher surélevé (estrade, marche cachée) : sa racine suit un repère à la hauteur z."""
    pv = cz.empty(c.name + '_liftpv', (0, 0, z))
    c.root.parent = pv
    return pv


def to_local(c, t, world):
    """Point du monde -> coordonnées de main de c au temps t (pour set(hR=...))."""
    x, y = c.pos.at(t)
    yaw = c.yaw.at(t)
    d = Matrix.Rotation(math.radians(-yaw), 3, 'Z') @ (Vector(world) - Vector((x, y, 0)))
    return (d.x, d.y - c.T['bodyy'].at(t), d.z - (c.hh + c.T['bodyz'].at(t)))


def wall_y(name, y, x0, x1, H, mat, holes=(), t=0.1):
    """Mur le long de X en y, avec de vrais trous rectangulaires [(xa, xb, za, zb)] (portes, fenêtres : la lumière entre)."""
    xs = sorted({x0, x1} | {h[0] for h in holes} | {h[1] for h in holes})
    for i in range(len(xs) - 1):
        a, b = xs[i], xs[i + 1]
        hs = [h for h in holes if h[0] <= a + 1e-6 and h[1] >= b - 1e-6]
        if not hs:
            cz.box(f'{name}_{i}', (b - a, t, H), ((a + b) / 2, y, H / 2), mat, bevel=0, ol=0)
            continue
        za, zb = hs[0][2], hs[0][3]
        if za > 0.001:
            cz.box(f'{name}_{i}lo', (b - a, t, za), ((a + b) / 2, y, za / 2), mat, bevel=0, ol=0)
        if zb < H - 0.001:
            cz.box(f'{name}_{i}hi', (b - a, t, H - zb), ((a + b) / 2, y, (H + zb) / 2), mat, bevel=0, ol=0)


def wall_x(name, x, y0, y1, H, mat, holes=(), t=0.1):
    """Mur le long de Y en x, avec de vrais trous [(ya, yb, za, zb)]."""
    ys = sorted({y0, y1} | {h[0] for h in holes} | {h[1] for h in holes})
    for i in range(len(ys) - 1):
        a, b = ys[i], ys[i + 1]
        hs = [h for h in holes if h[0] <= a + 1e-6 and h[1] >= b - 1e-6]
        if not hs:
            cz.box(f'{name}_{i}', (t, b - a, H), (x, (a + b) / 2, H / 2), mat, bevel=0, ol=0)
            continue
        za, zb = hs[0][2], hs[0][3]
        if za > 0.001:
            cz.box(f'{name}_{i}lo', (t, b - a, za), (x, (a + b) / 2, za / 2), mat, bevel=0, ol=0)
        if zb < H - 0.001:
            cz.box(f'{name}_{i}hi', (t, b - a, H - zb), (x, (a + b) / 2, (H + zb) / 2), mat, bevel=0, ol=0)


def dress(modname, **kw):
    """Appelle dress(cz, **kw) de dress_<décor>.py ; un habillage cassé n'arrête pas le plan (il dit pourquoi)."""
    import importlib
    import sys
    if HERE not in sys.path:
        sys.path.insert(0, HERE)
    if not os.path.exists(os.path.join(HERE, modname + '.py')):
        return
    try:
        mod = importlib.import_module(modname)
        importlib.reload(mod)
        mod.dress(cz, **kw)
    except Exception as e:
        import traceback
        print('CZ DRESS FAILED', modname, repr(e))
        traceback.print_exc(limit=4)


def _chest(c, x, z, lift=0.006):
    """Un point sur la surface VISIBLE du torse (le torse porte sa profondeur en échelle d'objet)."""
    rt, h = c.rt, c.ht
    r = rt if z <= h - rt else math.sqrt(max(0.0, rt * rt - (z - (h - rt)) ** 2))
    r = max(r, 1e-4)
    k = max(0.0, 1 - (x / r) ** 2)
    sy = 0.8 * c.belly
    y = -r * math.sqrt(k) - lift / sy
    ang = math.degrees(math.asin(max(-1.0, min(1.0, x / r)))) * 0.85
    return (x, y, z), ang


def decal(c, name, img, w, h, x, z, parent=None):
    """Un badge / un logo sur la poitrine."""
    loc, ang = _chest(c, x, z)
    return cz.plane(name, w, h, loc, cz.toon(name + 'm', img=img, alpha_clip=True, lift=0.75), rot=(90, 0, ang), parent=parent or c.body)
