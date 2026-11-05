# S03 TRÔNE jour, 20,37-26,83 s (f613-805) : « Chacun reçoit des armoiries, une devise, un domaine… et un titre.
# Et pour les titres, on prend les noms des villes du Nord. »
# MS deux : HENRI tend l'écu aux oranges à MARMELADE -> CU l'écu + la banderole « PAR LE ROI » -> MCU MARMELADE ravi
# -> plongée sur la table : la carte du Nord et ses villes.
import os
import sys

F0, F1 = 613, 805


def build(ctx):
    cz, cam = ctx.cz, ctx.cam
    here = os.path.dirname(os.path.abspath(__file__))
    sys.path.insert(0, here)
    import cast
    import common
    import sets
    W = cz.words()
    at = lambda w, n=1, after=0.0: cz.at(W, w, n, after)['start']
    cz.setup(F1, world='#cdeef2', world_strength=0.3)
    sets.trone('jour', 'all')
    import bpy
    bpy.context.view_layer.update()

    Hn = cast.henri()
    M = cast.marmelade()
    Hn.place(-1, 0.35, 1.75, -35)
    Hn.face(-1, 'smile')
    Hn.set(-1, dur=0.01, hyaw=-8, hroll=-3)
    M.place(-1, -0.6, 1.05, 50)
    M.face(-1, 'neutral')
    M.set(-1, dur=0.01, hyaw=12, hroll=4)

    # l'écu aux trois oranges (une carte découpée sur un dos doré) et sa banderole de devise
    sh = cz.empty('ar_shield', (0, 0, -50))
    sh['cz_contact_ok'] = 1     # l'écu tenu à la main : il flotte au-dessus du tapis par construction
    cz.plane('ar_shield_front', 0.42, 0.42 * 300 / 256, (0, -0.006, 0), cz.toon('ar_shieldm', img=common.T('shield_marmelade.png'), alpha_clip=True, lift=0.72), parent=sh)
    cz.box('ar_shield_back', (0.36, 0.008, 0.4), (0, 0.004, 0.02), cz.toon('tr_goldm', '#d2a23e', sheen=0.5), bevel=0, ol=0.0, parent=sh)
    rib = cz.plane('ar_ribbon', 0.52, 0.52 * 220 / 1024, (0, -0.012, -0.3), cz.toon('ar_ribbonm', img=common.T('ribbon_devise.png'), alpha_clip=True, lift=0.72), parent=sh)
    t_arm, t_dev = at('armoiries,'), at('devise,')
    t_give = t_arm + 0.15
    Hn.hold(sh, 'R', -1, t_give, offset=(0.0, -0.06, 0.12), aim=(-0.4, -2.5, 1.0))
    Hn.pose(t_arm - 0.25, 'present', dur=0.2, antic=0.1)
    M.set(t_arm - 0.1, dur=0.2, hL=(0.06, -0.34, M.ht * 0.7))
    M.hold(sh, 'L', t_give + 0.02, 99, offset=(0.02, -0.14, 0.14), aim=(-0.4, -3.0, 1.2))
    M.set(t_give + 0.1, dur=0.25, hL=(0.08, -0.36, M.ht * 0.85))
    Hn.pose(t_give + 0.15, 'hips', dur=0.25)
    M.turn(t_give + 0.1, 20, 0.35)
    M.face(t_arm, 'surprised')
    M.face(t_dev, 'smile')
    vals = []
    for f in range(F0, F1 + 1):
        k = ((f - 1) / 30 - (t_dev - 0.05)) / 0.22
        s = 0.001 if k <= 0 else (1.0 if k >= 1 else max(0.001, cz.back_out(k, 1.6)))
        vals.append((s, s, s))
    cz.bake(rib, 'scale', vals, F0)
    M.face(at('titre.') - 0.05, 'starstruck')
    M.set(at('titre.') - 0.12, dur=0.14, squash=1.06)
    M.set(at('titre.') + 0.1, dur=0.2, squash=1.0)
    M.blink(at('Et', 1, 24.0) + 0.2)
    for c in (Hn, M):
        c.bake(F0, F1)

    c = cam.Cam(lens=30, fstop=2.6, min_fstop=2.4, bounds=((sets.X0 + 0.2, sets.Y0 + 0.2, 0.3), (sets.X1 - 0.2, sets.Y1 - 0.2, sets.H - 0.25)))
    hh, mh = (Hn.head, (0, 0, 0)), (M.head, (0, 0, 0))
    mid = (-0.12, 1.4, 1.0)
    c.frame(20.35, (-0.6, -1.6, 1.25), mid, lens=26, focus=mid, fly=0, creep=0.0019, fstop=3.0, roll=-3)
    c.shot(23.48, mh, 'cu', yaw=16, rel=M, pitch=-12, roll=4, lens=32, head_y=0.42, at=23.48, focus=mh, fly=24, creep=0.0022)
    tx, ty = sets.MAP_TABLE
    c.frame(24.55, (tx - 0.1, ty - 0.3, 2.35), (tx - 0.1, ty - 0.02, sets.MAP_TOP), lens=17, focus=(tx, ty, sets.MAP_TOP), fly=12, creep=0.0016, fstop=5.0, roll=0)
    c.bake(F0, F1)
    return F0, F1
