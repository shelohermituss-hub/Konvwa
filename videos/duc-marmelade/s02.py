# S02 TRÔNE jour, 10,97-20,37 s (f331-612) : « Mais un roi sans cour, ça fait un peu vide. Alors, une semaine plus tard,
# il fabrique une noblesse entière : quatre princes, huit ducs, vingt-deux comtes, trente-sept barons. »
# XWS plongée : HENRI seul sur le trône, l'ennui -> MS HENRI, l'idée -> le mur des armoiries : les groupes apparaissent
# sur leurs mots pendant que la caméra glisse le long du mur, des princes aux barons.
import os
import sys

F0, F1 = 331, 612


def build(ctx):
    cz, cam = ctx.cz, ctx.cam
    here = os.path.dirname(os.path.abspath(__file__))
    sys.path.insert(0, here)
    import cast
    import sets
    W = cz.words()
    at = lambda w, n=1, after=0.0: cz.at(W, w, n, after)['start']
    cz.setup(F1, world='#cdeef2', world_strength=0.3)
    sets.trone('jour', 'hidden')
    import bpy
    bpy.context.view_layer.update()

    Hn = cast.henri()
    sx, sy = sets.SEAT
    Hn.place(-1, sx, sy, 0)
    Hn.sit(-1, 1.0, dur=0.01, feet_y=-0.34, feet_z=0.6)
    Hn.face(-1, 'bored')
    Hn.set(-1, dur=0.01, hyaw=14, hroll=6, lean=6)
    Hn.set(-1, dur=0.01, hL=(0.2, -0.12, Hn.ht * 0.25), hR=(-0.02, -0.26, Hn.ht * 0.98))   # le menton dans la main
    Hn.look(11.6, -0.5, -0.2)
    Hn.blink(12.2)
    Hn.face(at('ça'), 'unimpressed')
    Hn.look(at('vide.'), 0.4, -0.3)
    # « Alors… » : l'idée ; « fabrique » : le doigt en l'air
    t_al = at('Alors,')
    Hn.face(t_al, 'thinking')
    Hn.set(t_al - 0.1, dur=0.25, lean=-4, hyaw=8, hroll=2)
    Hn.pose(t_al + 0.05, 'think', dur=0.2)
    t_fab = at('fabrique')
    Hn.pose(t_fab - 0.15, 'rest', dur=0.18, antic=0.14, hL=(0.2, -0.12, Hn.ht * 0.25), hR=(-0.34, -0.14, Hn.ht * 2.05))   # le doigt en l'air, au-dessus de la tête
    Hn.face(t_fab, 'excited')
    Hn.set(t_fab - 0.1, dur=0.12, squash=0.93)
    Hn.set(t_fab + 0.06, dur=0.18, squash=1.0)
    Hn.face(at('entière :') + 0.1, 'grin', big=False)
    Hn.bake(F0, F1)

    # les armoiries apparaissent par groupes, sur « quatre », « huit », « vingt-deux », « trente-sept »
    starts = [at('quatre'), at('huit'), at('vingt-deux'), at('trente-sept')]
    spans = [0.35, 0.45, 0.55, 0.65]
    by = {}
    for o, g in sets.SHIELDS:
        by.setdefault(g, []).append(o)
    for g, objs in by.items():
        n = len(objs)
        for k, o in enumerate(objs):
            t0 = starts[g] - 0.05 + spans[g] * (k / max(1, n - 1))
            vals = []
            for f in range(F0, F1 + 1):
                kk = ((f - 1) / 30 - t0) / 0.2
                s = 0.001 if kk <= 0 else (1.0 if kk >= 1 else max(0.001, cz.back_out(kk, 1.6)))
                vals.append((s, s, s))
            cz.bake(o, 'scale', vals, F0)

    c = cam.Cam(lens=18, fstop=6.0, min_fstop=2.4, bounds=((sets.X0 + 0.2, sets.Y0 + 0.2, 0.3), (sets.X1 - 0.2, sets.Y1 - 0.2, sets.H - 0.25)))
    hh = (Hn.head, (0, 0, 0))
    c.frame(10.97, (3.4, -3.1, 4.3), (-0.2, 3.4, 0.9), lens=15, fstop=7.0, focus=hh, fly=0, creep=0.0010, roll=-5)
    c.shot(13.45, hh, 'mcu', yaw=14, rel=Hn, pitch=-9, roll=4, lens=30, head_y=0.4, focus=hh, fly=18, creep=0.0019, fstop=2.6)
    wall = sets.X1
    c.frame(16.95, (1.3, -1.6, 2.6), (wall, -2.5, 3.3), lens=22, fstop=5.0, focus=(wall, -2.5, 3.3), fly=16, creep=0.0, roll=0)
    c.frame(19.30, (1.6, 1.4, 2.6), (wall, 3.5, 3.2), lens=22, fstop=5.0, focus=(wall, 3.5, 3.2), fly=34, creep=0.0012, roll=3)
    c.bake(F0, F1)
    return F0, F1
