# S07 TRÔNE jour, 46,83-50,10 s (f1407-1503) : « Le comte de Limonade aussi. Ce qui change, c'est qui rit. »
# (fondu depuis le salon) CU « LIMONADE » sur la carte du Nord, LIMONADE penché au-dessus -> MCU HENRI, regard entendu.
import os
import sys

F0, F1 = 1407, 1503
B0, B1 = F0 - 6, F1 + 8         # les fondus depuis s06 et vers s08


def build(ctx):
    cz, cam = ctx.cz, ctx.cam
    here = os.path.dirname(os.path.abspath(__file__))
    sys.path.insert(0, here)
    import cast
    import sets
    W = cz.words()
    at = lambda w, n=1, after=0.0: cz.at(W, w, n, after)['start']
    cz.setup(B1, world='#cdeef2', world_strength=0.3)
    sets.trone('jour', 'all')
    import bpy
    bpy.context.view_layer.update()
    tx, ty = sets.MAP_TABLE
    L = cast.limonade()
    Hn = cast.henri()
    L.place(-1, tx + 0.5, ty + 0.95, 0)                    # de l'autre côté de la table, derrière LIMONADE sur la carte
    L.face(-1, 'smile')
    L.set(-1, dur=0.01, lean=-6, hpitch=4, hyaw=-10, hroll=-4)
    L.pose(46.6, 'rest', dur=0.2, hR=(-0.05, -0.42, L.ht * 0.3))   # il pose le doigt sur sa ville
    Hn.place(-1, tx - 1.6, ty + 0.6, 30)
    Hn.face(-1, 'neutral')
    Hn.set(-1, dur=0.01, hyaw=-16, hroll=-4)
    t_ce = at('Ce', 1, 48.0)
    Hn.turn(t_ce - 0.4, 15, 0.3)
    Hn.face(t_ce, 'knowing')
    Hn.set(t_ce, dur=0.3, hyaw=-18, hroll=-5)
    Hn.look(t_ce + 0.1, -0.5, 0.1)
    Hn.blink(at('rit.') - 0.25)
    Hn.face(at('rit.'), 'smug')
    for c in (L, Hn):
        c.bake(B0, B1)
    # LIMONADE sur la carte : (1180, 420) / 1600 x 1100
    mw = 1.82
    mh = mw * 1100 / 1600
    lim = (tx + (1180 - 800) / 1600 * mw, ty + (550 - 420) / 1100 * mh, sets.MAP_TOP)
    c = cam.Cam(lens=30, fstop=2.6, min_fstop=2.4, bounds=((sets.X0 + 0.2, sets.Y0 + 0.2, 0.3), (sets.X1 - 0.2, sets.Y1 - 0.2, sets.H - 0.25)))
    c.frame(46.80, (lim[0] + 0.05, lim[1] - 1.05, 1.5), (lim[0] + 0.05, ty + 0.62, 1.02), lens=24, focus=lim, fly=0, creep=0.0019, fstop=4.0)
    hh = (Hn.head, (0, 0, 0))
    c.shot(48.15, hh, 'mcu', yaw=16, rel=Hn, pitch=2, lens=32, head_y=0.42, at=48.15, focus=hh, fly=14, creep=0.0024)
    c.bake(B0, B1)
    return F0, F1
