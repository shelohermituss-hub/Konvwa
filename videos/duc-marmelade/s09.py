# S09 CITADELLE jour, 54,03-61,70 s (f1622-1851) : « Et là-haut, à 900 mètres, la Citadelle : jusqu'à 20 000 ouvriers,
# 365 canons, contre une armée française qui n'est jamais venue. »
# (fondu) XWS la forteresse au-dessus des nuages -> CU la borne « 900 m » -> WS la Citadelle -> MS la file des ouvriers
# qui portent les pierres -> WS la rangée de canons -> MS la vigie à la longue-vue : la mer vide, haussement d'épaules.
import os
import sys

F0, F1 = 1622, 1851
B0, B1 = F0 - 8, F1 + 8


def build(ctx):
    cz, cam = ctx.cz, ctx.cam
    here = os.path.dirname(os.path.abspath(__file__))
    sys.path.insert(0, here)
    import cast
    import common
    import sets
    W = cz.words()
    at = lambda w, n=1, after=0.0: cz.at(W, w, n, after)['start']
    cz.setup(B1, world='#9ad0e8', world_strength=0.5)
    sets.citadelle('jour')
    import bpy
    bpy.context.view_layer.update()
    # la file des ouvriers sur la terrasse (dessus à 0.3 m), chacun une pierre sur l'épaule, de droite à gauche
    cols = ['#c8442c', '#2c7fa8', '#e0b030', '#3f9a4c', '#a8442c', '#1f9aa0']
    file_ = []
    for i, col in enumerate(cols):
        w = cast.ouvrier(f'ouvf{i}', col, ['#d8b25a', '#e8c870', '#c89a4a'][i % 3])
        common.lift(w, 0.3)
        y = -9.7 - (i % 2) * 0.45
        x0 = 6.5 + i * 1.3
        w.place(-1, x0, y, 90)
        w.face(-1, ['effort', 'determined'][i % 2])
        w.set(-1, dur=0.01, hL=(0.16, -0.06, w.ht * 1.95), hR=(-0.16, -0.06, w.ht * 1.95), hyaw=-18)
        st = cz.box(f'ct_carry{i}', (0.46, 0.3, 0.28), (0, 0, -50), cz.toon('ct_stonem', '#ffffff'), bevel=0.02, ol=0.005)
        w.hold(st, 'L', -1, 99, offset=(-0.16, 0.0, 0.15))
        w.walk(55.6, 58.4, [(x0, y), (x0 - 4.6, y)], step=5.0)
        file_.append(w)
    # la vigie, au coin de la terrasse, regarde la mer (vers +X) à la longue-vue
    v = cast.ouvrier('vigie', '#5a6a8a', '#c89a4a')
    common.lift(v, 0.3)
    v.place(-1, 8.2, -12.9, 90)
    v.face(-1, 'neutral')
    v.set(-1, dur=0.01, hR=(-0.02, -0.36, v.ht * 1.36), hL=(0.04, -0.26, v.ht * 1.3), hyaw=-6)
    spy = cz.empty('ct_spy', (0, 0, -50))
    cz.cyl('ct_spy_tube', 0.035, 0.42, (0, 0, 0), cz.toon('ct_brassm', '#c99a2e', sheen=0.5), r2=0.028, ol=0.003, verts=14, parent=spy)
    v.hold(spy, 'R', -1, 99, offset=(0.0, -0.02, 0.0), rot=(90, 0, 0), follow='root')
    t_ja = at('jamais')
    v.turn(t_ja - 0.5, 235, 0.4)                       # il se retourne vers nous (la caméra est derrière lui, à gauche)
    v.pose(t_ja - 0.15, 'shrug', dur=0.2, antic=0.12)
    v.face(t_ja, 'unimpressed')
    v.set(t_ja - 0.1, dur=0.25, hyaw=14, hroll=8)
    for c in file_ + [v]:
        c.bake(B0, B1)
    c = cam.Cam(lens=22, fstop=9.0, min_fstop=2.4)
    c.obj.data.clip_end = 3000
    mk = (sets.CIT_MARK[0], sets.CIT_MARK[1] - 0.18, 0.75)
    c.frame(54.00, (16.0, -36.0, 9.0), (0.0, -3.0, 5.0), lens=22, fstop=11.0, focus=(0, -3, 5), fly=0, creep=0.0012)
    c.frame(54.80, (mk[0] + 0.25, mk[1] - 1.25, 0.95), mk, lens=32, fstop=3.0, focus=mk, fly=12, creep=0.0016, roll=-5)
    wh = (file_[1].head, (0, 0, 0))
    c.frame(56.95, (3.6, -12.9, 1.65), (7.2, -9.9, 1.35), lens=24, fstop=4.0, focus=wh, fly=30, creep=0.0016, roll=3)
    c.frame(57.95, (-8.4, -10.6, 2.0), (3.0, -12.9, 0.7), lens=20, fstop=6.0, focus=(-3.0, -12.0, 0.7), fly=14, creep=0.0016, roll=-3)
    vh = (v.head, (0, 0, 0))
    c.frame(58.65, (6.2, -11.5, 1.55), (9.1, -13.1, 1.22), lens=26, fstop=3.0, focus=vh, fly=0, creep=0.0018, roll=4)
    c.bake(B0, B1)
    return F0, F1
