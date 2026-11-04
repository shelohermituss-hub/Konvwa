# Package E smoke shot: every detail.py call once on a small machine yard (run.py -- smoke.py --frames 30 --scale .5).
# A generator box with greebles, bolts, a label and hazard stripes on PBR fallbacks, scatter of every kind, fog, rim,
# depth of field, then D.finish(level='film', wear=1) (edge wear on). Prints CZ DETAIL lines; LOOK at the frame.
F0, F1 = 1, 60


def build(ctx):
    import cz, mega as M, detail as D
    M.setup(F1, sun_elev=24, sun_rot=150, samples=4)
    ground = M.heightfield('ground', (40, 40), (80, 80), lambda X, Y: 0.04 * M.fbm(X / 3, Y / 3, 2, 4), mat=D.pbr('soil', scale=1.0))
    body = cz.box('gen', (2.4, 1.2, 1.4), (0, 0, 0.85), D.pbr('paint_yellow', tint='#d9a21e', name='gen_paint'), bevel=0.03, ol=0)
    cz.box('skid', (2.8, 1.4, 0.15), (0, 0, 0.075), D.pbr('steel'), bevel=0.01, ol=0)
    slab = cz.box('slab', (6, 4, 0.3), (-3.5, 2.5, 0.15), D.pbr('concrete'), bevel=0.02, ol=0)
    D.greebles(body, '-y', n=18, seed=3)
    D.bolts(body, '+z', rows=2, cols=6)
    D.label('400 kVA', (0.6, -0.61, 1.05), rot=(90, 0, 0), size=0.09, parent=None)
    D.hazard(2.6, 0.08, (0, -0.71, 0.15), rot=(90, 0, 0))
    cz.box('rock_wall', (8, 1.5, 3), (2, 5, 1.5), D.pbr('rock'), bevel=0.05, ol=0)
    fl = M.Flight([(0, (4.5, -6.5, 2.2), (0, 0, 0.8), 28), ((F1 - 1) / 30, (3.2, -5.8, 1.9), (0, 0, 0.8), 28)])
    fl.bake(F0, F1)
    for kind, dens in (('pebbles', 30), ('gravel', 120), ('rocks', 0.6), ('debris', 6), ('grass', 25)):
        D.scatter(kind, surface=ground, density=dens, seed=len(kind), avoid=lambda x, y: abs(x) < 1.6 and abs(y) < 0.9)
    D.light('golden')
    D.fog(density=0.004, height=8.0)
    D.motes((0, -1, 1.2), size=(3, 2, 2), f0=F0, f1=F1)
    D.dof(focus=body, blur='medium')
    D.finish(level='film', ground=0.0, wear=1.0)
    print('CZ DETAIL smoke', D.stats())
    return F0, F1
