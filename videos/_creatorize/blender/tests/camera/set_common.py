# The camera test set (package D, 2026-10-30): a yard with four focal objects, textured enough for the picture tools
# (camjerk.py) to track. Used by the cuts film (cuts/c01-c03) and the cutless film (tour/t01-t04).
# Gate-clean (fix round 2026-10-30, M12): every shot passes check_layout's overlap gate and the camera lines (a copied
# set must not fail the gate): the stones keep apart and off the foci, the tower's bands are a declared wrap
# (contact.allow), the roof rests ON the hut, the pipe ON the ground.
import math, random
import bpy
import cz, mega as M
import contact as K

T = lambda f: (f - 1) / 30
# the four focal points (the tour visits them in this order)
FOCI = {'tower': (-6.0, 4.0, 3.0), 'tank': (5.0, 6.0, 1.6), 'pipe': (6.5, -3.0, 0.45), 'hut': (-4.0, -4.0, 1.4)}
KEEP = {'tower': 2.2, 'tank': 2.6, 'pipe': 4.4, 'hut': 3.0}      # no stone within this of a focus (m, footprint radius)


def build_set(frame_end):
    M.setup(frame_end, sun_elev=30, sun_rot=210, samples=4, mb=0.5)
    ground = M.pbr('ground', '#5d6b3f', rough=0.9)
    cz.box('ground', (60, 60, 0.2), (0, 0, -0.1), mat=ground, bevel=0, ol=0)
    rnd = random.Random(4)
    stone = M.pbr('stone', '#8a8478', rough=0.8)
    placed, i = [], 0
    while len(placed) < 140 and i < 2000:      # scattered stones: texture for the tracker, depth for parallax
        i += 1
        x, y = rnd.uniform(-25, 25), rnd.uniform(-25, 25); s = rnd.uniform(0.15, 0.6); r = rnd.uniform(0, 90)
        if any(math.hypot(x - f[0], y - f[1]) < KEEP[k] + s for k, f in FOCI.items()): continue
        if any(math.hypot(x - px, y - py) < (s + ps) * 0.75 + 0.05 for px, py, ps in placed): continue   # (0.75: the box's half-diagonal)
        placed.append((x, y, s))
        cz.box(f'st{len(placed) - 1}', (s, s * 0.8, s * 0.5), (x, y, s * 0.2), mat=stone, rot=(0, 0, r), bevel=0, ol=0)
    red, steel, blue, wood = M.pbr('red', '#b8402c', 0.5), M.steel('steel'), M.pbr('blue', '#3a6fb8', 0.4), M.pbr('wood', '#8a5a32', 0.8)
    x, y, z = FOCI['tower']
    tower = cz.box('tower', (1.6, 1.6, 6.0), (x, y, 0), mat=red, bevel=0.02, ol=0, origin='bottom')
    bands = [cz.box(f'tw{k}', (1.9, 1.9, 0.12), (x, y, 1.1 * k + 0.6), mat=steel, bevel=0, ol=0) for k in range(5)]
    K.allow(tower, bands, group='tower_bands')        # steel bands wrapped round the tower: an intended overlap
    x, y, z = FOCI['tank']
    cz.cyl('tank', 1.6, 3.2, (x, y, 0), mat=blue, ol=0)
    x, y, z = FOCI['pipe']
    cz.cyl('pipe', 0.45, 7.0, (x, y, 0.45), mat=steel, rot=(0, 90, 20), ol=0, origin='center')   # lying ON the ground
    x, y, z = FOCI['hut']
    cz.box('hut', (3.0, 2.4, 2.4), (x, y, 0), mat=wood, bevel=0.03, ol=0, origin='bottom')
    cz.box('roof', (3.4, 2.8, 0.25), (x, y, 2.4 + 0.125), mat=red, bevel=0.02, ol=0)                 # resting ON the hut


# the cutless tour: hold on each focus, travel between them (one camera for t01-t04, 4 x 60 frames = 8 s). Feasible at
# the 20 deg/s turn cap (fix round 2026-10-30): holds 0.6 s, legs ~1.8 s, the camera trucks along the yard at nearly the
# same yaw from further away, so each leg turns <= ~20 deg (a leg of T s turns at most ~12 x T deg at the cap).
TOUR = [dict(t=(T(1), T(19)), look=FOCI['tower'], dist=16, yaw=-8, pitch=16, lens=26, name='tower'),
        dict(t=(T(75), T(93)), look=FOCI['tank'], dist=16, yaw=4, pitch=16, lens=28, name='tank'),
        dict(t=(T(150), T(168)), look=FOCI['pipe'], dist=15, yaw=10, pitch=18, lens=28, name='pipe'),
        dict(t=(T(222), T(240)), look=FOCI['hut'], dist=15, yaw=-4, pitch=16, lens=26, name='hut')]
