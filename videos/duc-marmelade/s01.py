# S01 TRÔNE jour, 0,00-10,97 s (f1-330) : « En Haïti, il y a eu un vrai duc de la Marmelade… et un comte de Limonade.
# 1811. Dans le Nord, le général Henri Christophe se proclame roi : Henri Ier. »
# MS MARMELADE fier -> MS LIMONADE (les lunettes) -> CU plaque 1811 -> WS la salle, HENRI entre -> MS HENRI, la couronne
# apparaît sur « roi » -> CU contre-plongée « Henri Ier ».
import os
import sys

F0, F1 = 1, 330


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
    sets.trone('jour', 'none')                      # le mur des armoiries est encore nu : pas de noblesse avant s02
    import bpy
    bpy.context.view_layer.update()

    M = cast.marmelade()
    L = cast.limonade()
    Hn = cast.henri()
    # MARMELADE et LIMONADE au pied de l'estrade, tournés vers nous
    M.place(-1, -1.05, 0.75, 16)
    M.face(-1, 'smug')
    M.set(-1, dur=0.01, hyaw=10, hroll=4)
    M.set(at('vrai') - 0.12, dur=0.2, lean=-12, hR=(-0.02, -0.22, M.ht * 0.7))      # la main sur le cœur, un salut
    M.blink(at('vrai') + 0.25)
    M.face(at('Marmelade…'), 'biggrin')
    M.set(at('Marmelade…') - 0.1, dur=0.22, lean=4)
    M.pose(at('Marmelade…') + 0.05, 'hips', dur=0.2, antic=0.12)
    L.place(-1, 1.05, 0.55, -16)
    L.face(-1, 'neutral')
    L.set(-1, dur=0.01, hyaw=-12, hroll=-3)
    L.set(at('comte') - 0.15, dur=0.16, hR=(-0.07, -0.27, L.ht * 1.36))            # il remonte ses lunettes
    L.face(at('comte'), 'smug')
    L.set(at('Limonade.') + 0.35, dur=0.2, hR=(-0.2, -0.02, 0.1))
    L.blink(at('Limonade.') + 0.15)

    # HENRI entre par la porte du fond et vient devant l'estrade
    t_in, t_stop = at('Dans') + 0.1, at('se') - 0.1
    Hn.place(-1, 30.0, 30.0, 180)                                                  # hors du décor jusqu'à son entrée
    Hn.place(t_in - 0.02, sets.DOOR[0], sets.DOOR[1] + 0.6, 180)
    Hn.face(-1, 'determined')
    Hn.walk(t_in, t_stop, [(sets.DOOR[0], sets.DOOR[1] + 0.6), (-3.1, 2.6), (-2.0, 1.75), (-0.25, 1.85)])
    Hn.turn(t_stop, 8, 0.3)
    Hn.set(t_stop, dur=0.3, hyaw=10, hroll=4)
    # les deux nobles le regardent passer
    M.set(t_in + 0.4, dur=0.4, hyaw=40)
    M.look(t_in + 0.3, 0.6, 0.2)
    L.set(t_in + 0.6, dur=0.4, hyaw=-38, twist=-10)
    L.look(t_in + 0.5, -0.6, 0.2)
    # « se proclame roi » : les deux mains au-dessus de la tête, la couronne apparaît sur « roi »
    t_roi = at('roi')
    Hn.set(t_roi - 0.55, dur=0.25, hL=(0.16, -0.06, Hn.ht * 1.5), hR=(-0.16, -0.06, Hn.ht * 1.5))
    Hn.face(t_roi, 'smug')
    Hn.extra(t_roi, t_roi + 0.8, 'sparkle')
    Hn.pose(t_roi + 0.25, 'hips', dur=0.22)
    Hn.face(at('Ier.') - 0.05, 'determined')
    Hn.blink(at('Ier.') + 0.3)
    for c in (M, L, Hn):
        c.bake(F0, F1)
    crown = [o for o in bpy.data.objects if o.name.startswith(('henri_crown', 'henri_cross'))]
    for o in crown:
        common.visible(o, [(t_roi - 0.03, 1e9)], F0, F1)

    c = cam.Cam(lens=30, fstop=2.6, min_fstop=2.4, bounds=((sets.X0 + 0.2, sets.Y0 + 0.2, 0.3), (sets.X1 - 0.2, sets.Y1 - 0.2, sets.H - 0.25)))
    mh, lh, hh = (M.head, (0, 0, 0)), (L.head, (0, 0, 0)), (Hn.head, (0, 0, 0))
    c.shot(0.0, mh, 'mcu', yaw=18, rel=M, pitch=-11, roll=3, lens=30, head_y=0.36, head_x=0.45, focus=mh, fly=0, creep=0.0019)
    c.shot(3.30, lh, 'mcu', yaw=-16, rel=L, pitch=-7, roll=-4, lens=30, head_y=0.36, head_x=0.55, focus=lh, fly=16, creep=0.0019)
    pq = sets.PLAQUE
    c.frame(5.12, (0.25, 1.4, 2.4), pq, lens=32, focus=pq, fly=13, creep=0.0016, roll=-4)
    c.frame(5.92, (1.7, -3.1, 1.55), (-1.1, 2.7, 1.15), lens=17, fstop=6.5, focus=(-1.0, 1.0, 1.0), fly=10, creep=0.0012, roll=0)
    c.shot(8.85, hh, 'ms', yaw=10, rel=Hn, pitch=-6, roll=2, lens=28, head_y=0.38, at=9.15, focus=hh, fly=16, creep=0.0019, fstop=2.6)
    c.shot(10.25, hh, 'cu', yaw=-16, rel=Hn, pitch=-16, roll=-5, lens=32, head_y=0.42, focus=hh, fly=8, creep=0.0022)
    c.bake(F0, F1)
    return F0, F1
