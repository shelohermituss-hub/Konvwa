# S04 TRÔNE jour, 26,83-33,40 s (f806-1002) : « Le duc de Plaisance. Le prince du Limbé. Le comte de Limonade. Et le
# duc… de la Marmelade. » Les quatre nobles en rang devant l'estrade, chacun derrière sa plaque ; la caméra passe de
# l'un à l'autre, chacun salue sur son nom ; suspense sur « Et le duc… », triomphe de MARMELADE ; poussée dans la coupe.
import os
import sys

F0, F1 = 806, 1002


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
    sets.trone('jour', 'all')
    import bpy
    bpy.context.view_layer.update()

    Hn = cast.henri()
    sx, sy = sets.SEAT
    Hn.place(-1, sx, sy, 0)
    Hn.sit(-1, 1.0, dur=0.01, feet_y=-0.34, feet_z=0.6)
    Hn.face(-1, 'smile')
    Hn.set(-1, dur=0.01, hyaw=10, hroll=4, hL=(0.24, -0.1, Hn.ht * 0.3), hR=(-0.24, -0.1, Hn.ht * 0.3))
    row = [(cast.plaisance(), 'tag_plaisance', 'Plaisance.'), (cast.limbe(), 'tag_limbe', 'Limbé.'),
           (cast.limonade(), 'tag_limonade', 'Limonade.'), (cast.marmelade(), 'tag_marmelade', 'Marmelade.')]
    xs = [-1.95, -0.65, 0.65, 1.95]
    gold = cz.toon('tr_goldm', '#d2a23e', sheen=0.5)
    for i, ((c, tag, word), x) in enumerate(zip(row, xs)):
        c.place(-1, x, 1.35, 8 if x < 0 else -8)
        c.face(-1, 'neutral')
        c.set(-1, dur=0.01, hyaw=12 if i % 2 else -12, hroll=4 if i % 2 else -4)
        # sa plaque sur un pupitre doré devant lui
        cz.cyl(f'nb_stand{i}', 0.02, 0.62, (x, 0.82, 0), gold, ol=0.002, verts=10)
        cz.box(f'nb_board{i}', (0.5, 0.02, 0.15), (x, 0.82, 0.68), gold, rot=(-20, 0, 0), bevel=0.004, ol=0.003)
        cz.plane(f'nb_tag{i}', 0.46, 0.46 * 150 / 640, (x, 0.8, 0.685), cz.toon(f'nb_tagm{i}', img=common.T(tag + '.png'), alpha_clip=True, lift=0.75), rot=(70, 0, 0))
        t = at(word, 2 if word == 'Limonade.' else 1, 27.0)
        if i < 3:
            c.set(t - 0.15, dur=0.22, lean=-18, hR=(-0.02, -0.22, c.ht * 0.7))     # la main sur le cœur, la révérence
            c.face(t, 'smile')
            c.set(t + 0.55, dur=0.3, lean=0, hR=(-0.2, -0.02, 0.1))
            c.blink(t + 0.7)
    M = row[3][0]
    t_duc = at('duc…')
    t_mar = at('Marmelade.', 1, 32.0)
    M.face(t_duc, 'worried')
    M.look(t_duc, 0.4, 0.2)
    M.face(t_mar, 'starstruck')
    M.pose(t_mar - 0.12, 'cheer', dur=0.18, antic=0.15, hL=(0.42, -0.14, 0.8), hR=(-0.42, -0.14, 0.8))
    M.extra(t_mar, t_mar + 0.9, 'sparkle')
    for c, _, _ in row:
        if c is not M:
            c.look(t_mar, 0.9 if c.pos.at(30)[0] < 1.0 else -0.9, 0.1)
    for c in [Hn] + [r[0] for r in row]:
        c.bake(F0, F1)

    c = cam.Cam(lens=30, fstop=2.6, min_fstop=2.4, bounds=((sets.X0 + 0.2, sets.Y0 + 0.2, 0.3), (sets.X1 - 0.2, sets.Y1 - 0.2, sets.H - 0.25)))
    heads = [(r[0].head, (0, 0, 0)) for r in row]
    c.shot(26.75, heads[0], 'mcu', yaw=14, pitch=-12, roll=5, lens=30, head_y=0.36, focus=heads[0], fly=0, creep=0.0019)
    c.shot(28.35, heads[1], 'mcu', yaw=10, pitch=14, roll=-5, lens=30, head_y=0.36, focus=heads[1], fly=14, creep=0.0019)
    c.shot(29.85, heads[2], 'mcu', yaw=-10, pitch=-9, roll=4, lens=30, head_y=0.36, focus=heads[2], fly=14, creep=0.0019)
    c.shot(32.42, heads[3], 'mcu', yaw=14, pitch=9, roll=6, lens=32, head_y=0.42, focus=heads[3], fly=30, creep=0.0028)
    c.push((F1 - 1) / 30, 0.25, 0.45)
    c.bake(F0, F1)
    return F0, F1
