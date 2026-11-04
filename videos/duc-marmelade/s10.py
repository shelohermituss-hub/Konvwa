# S10 TRÔNE soir, 61,70-64,80 s (f1852-1945) : « Le royaume s'arrête en 1820. Les moqueries se sont tues. »
# (fondu, saut de temps) MS le trône vide au crépuscule, la couronne sur le coussin -> la gazette froissée au sol.
import os
import sys

F0, F1 = 1852, 1945
B0, B1 = F0 - 8, F1 + 8


def build(ctx):
    cz, cam = ctx.cz, ctx.cam
    here = os.path.dirname(os.path.abspath(__file__))
    sys.path.insert(0, here)
    import common
    import sets
    cz.setup(B1, world='#5a4a7a', world_strength=0.3)
    sets.trone('soir', 'all')
    sx, sy = sets.SEAT
    sets.crown_prop('so_crown', (sx, sy - 0.12, 1.03))
    gz = cz.plane('so_gazette', 0.36, 0.48, (0.9, sets.THRONE_Y - 0.9, 0.012), cz.toon('so_gazettem', img=common.T('gazette.png'), lift=0.6, tex='paper'), rot=(0, 0, 24))
    gz.data.transform(__import__('mathutils').Matrix.Diagonal((1, 1, 1, 1)))
    gc = (0.9, sets.THRONE_Y - 0.9, 0.02)
    c = cam.Cam(lens=30, fstop=3.0, min_fstop=2.4, bounds=((sets.X0 + 0.2, sets.Y0 + 0.2, 0.3), (sets.X1 - 0.2, sets.Y1 - 0.2, sets.H - 0.25)))
    cr = (sx, sy - 0.12, 1.1)
    c.frame(61.68, (0.35, 0.6, 1.25), cr, lens=30, focus=cr, fly=0, creep=0.0022)
    c.frame(63.25, (gc[0] + 0.1, gc[1] - 0.55, 0.95), gc, lens=30, focus=gc, fly=14, creep=0.0018)
    c.bake(B0, B1)
    return F0, F1
