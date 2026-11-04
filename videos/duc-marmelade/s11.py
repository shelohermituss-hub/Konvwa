# S11 CITADELLE couchant, 64,80-69,60 s (f1946-2088) : « La Citadelle, elle, est toujours debout. Et Marmelade aussi. »
# (fondu) WS la Citadelle au soleil couchant -> le panneau « MARMELADE » au premier plan, la forteresse floue derrière.
import os
import sys

F0, F1 = 1946, 2088
B0 = F0 - 8


def build(ctx):
    cz, cam = ctx.cz, ctx.cam
    here = os.path.dirname(os.path.abspath(__file__))
    sys.path.insert(0, here)
    import sets
    cz.setup(F1, world='#8a6aa8', world_strength=0.45)
    sets.citadelle('couchant')
    c = cam.Cam(lens=22, fstop=11.0, min_fstop=2.0)
    c.obj.data.clip_end = 3000
    c.frame(64.78, (7.0, -30.0, 2.2), (0.0, -2.0, 6.5), lens=22, fstop=11.0, focus=(0, -2, 6), fly=0, creep=0.0014)
    sg = (-0.8, -19.08, 1.7)
    c.frame(67.20, (-0.5, -23.2, 1.55), (-0.7, -18.0, 2.25), lens=30, fstop=2.2, focus=sg, fly=14, creep=0.0012)
    c.bake(B0, F1)
    return F0, F1
