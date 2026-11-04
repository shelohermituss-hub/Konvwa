# S01 (0,0-2,7 s) : le héros entre, va à son bureau, se tourne vers nous et salue (plan d'exemple du modèle).
import os
import sys

F0, F1 = 1, 40


def build(ctx):
    cz, cam = ctx.cz, ctx.cam
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import cast
    import sets
    cz.setup(F1, world='#2a2622', world_strength=0.6)
    sets.piece('jour')
    h = cast.heros()
    h.place(-1, -2.4, 0.1, 90)
    h.face(-1, 'neutral')
    h.walk(0.05, 1.3, [(-2.4, 0.1), (-0.2, 0.1)])
    h.turn(1.35, 0, 0.25)
    h.face(1.4, 'smile')
    h.set(-1, dur=0.01, hyaw=16, hroll=4)
    h.pose(1.6, 'point', dur=0.2, antic=0.12)
    h.face(1.75, 'grin')
    h.pose(2.3, 'rest', dur=0.25)
    h.bake(F0, F1)
    c = cam.Cam(lens=28, fstop=4.5, bounds=((-3.2, -2.0, 0.3), (3.2, 2.6, 2.7)))
    c.frame(0.0, (-0.9, -3.6, 1.15), (-0.9, 0.4, 0.95), lens=26, focus=(-1.0, 0.1, 1.0), fly=0, creep=0.0019)
    c.shot(1.5, (h.head, (0, 0, 0)), 'mcu', yaw=16, rel=h, pitch=4, lens=35, focus=(h.head, (0, 0, 0)), fly=14, creep=0.0019)
    c.bake(F0, F1)
    return F0, F1
