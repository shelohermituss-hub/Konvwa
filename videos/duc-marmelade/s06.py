# S06 SALON, 42,50-46,83 s (f1276-1406) : « Parce qu'un titre, c'est juste le nom d'un endroit. Le duc d'Orléans porte
# le nom d'une ville. » MS la carte de France au mur, BOUILLON assis devant (de dos, flou) -> CU « ORLÉANS ».
import os
import sys

F0, F1 = 1276, 1406
B1 = F1 + 6                     # le fondu vers s07


def build(ctx):
    cz, cam = ctx.cz, ctx.cam
    here = os.path.dirname(os.path.abspath(__file__))
    sys.path.insert(0, here)
    import salon_cast
    import sets
    W = cz.words()
    at = lambda w, n=1, after=0.0: cz.at(W, w, n, after)['start']
    cz.setup(B1, world='#4a5070', world_strength=0.35)
    sets.salon()
    R, G, B, gz, bowl = salon_cast.stage()
    for c in (R, G):
        c.face(-1, 'unimpressed')
        c.set(-1, dur=0.01, hyaw=34 if c is R else 20)
    B.face(-1, 'annoyed')
    B.set(-1, dur=0.01, hyaw=-34)
    B.face(at("d'Orléans"), 'smug')
    for c in (R, G, B):
        c.bake(F0, B1)
    mx, my, mz = sets.MAPFR
    w = sets.MAPFR_W
    # ORLÉANS sur l'image (520, 470) / 1100 : sur le mur droit (face -X), +x de l'image = -Y du monde
    orl = (mx - 0.03, my - (520 - 550) / 1100 * w, mz + (550 - 470) / 1100 * w)
    c = cam.Cam(lens=26, fstop=3.2, min_fstop=2.4, bounds=((sets.SX0 + 0.2, sets.SY0 + 0.2, 0.3), (sets.SX1 - 0.2, sets.SY1 - 0.2, sets.SH - 0.2)))
    c.frame(42.45, (0.7, -0.9, 1.55), (mx, my, mz - 0.05), lens=24, focus=(mx, my, mz), fly=0, creep=0.0019, fstop=3.2)
    c.frame(44.75, (2.55, orl[1] - 0.05, orl[2] - 0.05), orl, lens=30, focus=orl, fly=16, creep=0.0016, fstop=3.2)
    c.bake(F0, B1)
    return F0, F1
