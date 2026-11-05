# S08 SANS-SOUCI, 50,10-54,03 s (f1504-1621) : « Et pendant qu'on riait, ce royaume construisait. Le palais Sans-Souci. »
# (fondu depuis la salle du trône) MS les ouvriers taillent la pierre au chantier -> WS la façade du palais -> la caméra
# lève les yeux vers la montagne (fondu vers la Citadelle).
import os
import sys

F0, F1 = 1504, 1621
B0, B1 = F0 - 6, F1 + 8


def build(ctx):
    cz, cam = ctx.cz, ctx.cam
    here = os.path.dirname(os.path.abspath(__file__))
    sys.path.insert(0, here)
    import cast
    import sets
    W = cz.words()
    at = lambda w, n=1, after=0.0: cz.at(W, w, n, after)['start']
    cz.setup(B1, world='#9ad0e8', world_strength=0.5)
    sets.sanssouci()
    import bpy
    bpy.context.view_layer.update()
    a = cast.ouvrier('ouv1', '#c8442c')
    b = cast.ouvrier('ouv2', '#2c7fa8', '#e8c870')
    d = cast.ouvrier('ouv3', '#e0b030', '#c89a4a')
    # A taille le bloc au maillet (de face), B porte une pierre sur l'épaule, D pousse la charrette
    a.place(-1, -3.4, -0.4, -30)
    a.face(-1, 'determined')
    a.set(-1, dur=0.01, hyaw=-12, hroll=-4)
    mallet = cz.empty('ss_mallet', (0, 0, -50))
    cz.cyl('ss_mallet_h', 0.018, 0.32, (0, 0, -0.3), cz.toon('ss_polem', '#8a6a42'), ol=0.003, verts=8, parent=mallet)
    cz.box('ss_mallet_head', (0.16, 0.09, 0.09), (0, 0, 0.04), cz.toon('ss_polem', '#8a6a42'), bevel=0.01, ol=0.003, parent=mallet)
    a.hold(mallet, 'R', -1, 99, offset=(0.0, -0.02, 0.1), follow='arm')
    for k in range(14):
        t = 50.0 + k * 0.3
        a.set(t, dur=0.12, hR=(-0.16, -0.3, a.ht * 1.25), lean=4)
        a.set(t + 0.15, dur=0.1, hR=(-0.12, -0.42, a.ht * 0.55), lean=-10)
    b.place(-1, -7.6, 0.8, 0)
    b.face(-1, 'effort')
    blk = cz.box('ss_carryblock', (0.5, 0.32, 0.3), (0, 0, -50), cz.toon('ss_stonem', '#ffffff'), bevel=0.02, ol=0.005)
    b.set(-1, dur=0.01, hL=(0.16, -0.06, b.ht * 1.95), hR=(-0.16, -0.06, b.ht * 1.95), hyaw=14)
    b.hold(blk, 'L', -1, 99, offset=(-0.16, 0.0, 0.16))
    b.walk(49.9, 52.6, [(-7.6, 0.8), (-6.9, -0.6), (-6.4, -1.9)])
    d.place(-1, -1.4, -2.6, 210)
    d.face(-1, 'effort')
    d.set(-1, dur=0.01, lean=-16, hL=(0.18, -0.32, d.ht * 0.5), hR=(-0.18, -0.32, d.ht * 0.5))
    for c in (a, b, d):
        c.blink(51.2)
        c.bake(B0, B1)
    c = cam.Cam(lens=26, fstop=4.0, min_fstop=2.4)
    ah = (a.head, (0, 0, 0))
    c.frame(50.08, (-5.6, -2.7, 1.25), (-3.5, -0.1, 0.85), lens=26, focus=ah, fly=0, creep=0.0019, roll=-4)
    c.frame(52.65, (2.4, -12.5, 1.4), (0.0, 6.0, 4.3), lens=20, fstop=9.0, focus=(0, 6, 4), fly=18, creep=0.0016, roll=0)
    c.obj.data.clip_end = 3000
    c.bake(B0, B1)
    return F0, F1
