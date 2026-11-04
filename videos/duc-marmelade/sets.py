# Les décors du « Duc de la Marmelade » : une fonction par décor (mise en place + lumière), l'habillage dans
# dress_<décor>.py. Quatre murs, de vrais trous derrière portes et fenêtres, une lumière principale qui a une FORME.
import math
import os

import cz
from common import T, dress, wall_x, wall_y

# ---------------- TRÔNE : la salle du trône de Sans-Souci (x -5..5, y -3.5..5, plafond 5 m)
X0, X1, Y0, Y1, H = -5.0, 5.0, -3.5, 5.0, 5.0
THRONE_Y = 2.6                      # bord avant de l'estrade ; le roi assis en (0, THRONE_Y + 1.4)
SEAT = (0.0, THRONE_Y + 1.4)
DOOR = (-3.0, Y1)                   # la porte du fond (Henri entre par là)
WINDOWS = [(-2.4, -1.2), (0.4, 1.6), (3.0, 4.2)]   # fenêtres du mur gauche (y), z 0.9..3.9
MAP_TABLE = (2.7, -0.6)             # la table de la carte (centre), plateau à 0.86 m
MAP_TOP = 0.86
SHIELDS = []                        # [(objet, groupe)] : groupes 0 princes, 1 ducs, 2 comtes, 3 barons
GROUPS = [(4, 2, 2, 0.56, 0.5), (8, 2, 4, 0.46, 0.42), (22, 3, 8, 0.34, 0.3), (37, 5, 8, 0.3, 0.27)]   # (n, rangs, colonnes, pas, taille)


def ring(name, r, t, loc, mat, n=48, m=10):
    """Un anneau (tore) : lustres, couronnes de bougies."""
    import bmesh
    bm = bmesh.new()
    rows = []
    for i in range(n):
        a = 2 * math.pi * i / n
        rows.append([bm.verts.new(((r + t * math.cos(2 * math.pi * j / m)) * math.cos(a), (r + t * math.cos(2 * math.pi * j / m)) * math.sin(a),
                                   t * math.sin(2 * math.pi * j / m))) for j in range(m)])
    for i in range(n):
        for j in range(m):
            bm.faces.new((rows[i][j], rows[(i + 1) % n][j], rows[(i + 1) % n][(j + 1) % m], rows[i][(j + 1) % m]))
    o = cz._mesh_obj(name, bm, mat)
    cz.place(o, loc)
    cz.outline(o, 0.004)
    return o


def trone(mode='jour', shields='all'):
    """La salle du trône. mode 'jour' (après-midi doré) ou 'soir' (tombée du jour, violet et braise).
    shields : 'none' (mur nu, avant la noblesse), 'all' (le mur plein), 'hidden' (construits, cachés : la séquence les fait apparaître)."""
    SHIELDS.clear()
    soir = mode == 'soir'
    floor = cz.toon('tr_floorm', '#ffffff', img=T('floor_checker.png'), proj='box', proj_scale=1 / 3.0)
    wall = cz.toon('tr_wallm', '#ffffff', img=T('wall_ochre.png'), proj='box', proj_scale=0.5, tint='#d8cfc0' if soir else None)
    white = cz.toon('tr_whitem', '#efe6d4', tex='grain', tex_strength=0.05)
    gold = cz.toon('tr_goldm', '#d2a23e', sheen=0.5)
    red = cz.toon('tr_redm', '#8a1824', sheen=0.3)
    cz.box('tr_floor', (X1 - X0 + 0.4, Y1 - Y0 + 0.4, 0.2), (0, (Y0 + Y1) / 2, -0.1), floor, bevel=0, ol=0)
    cz.box('tr_ceiling', (X1 - X0 + 0.4, Y1 - Y0 + 0.4, 0.2), (0, (Y0 + Y1) / 2, H + 0.1), cz.toon('tr_ceilm', '#f2e8d2', tex='grain'), bevel=0, ol=0)
    wall_y('tr_back', Y1 + 0.05, X0, X1, H, wall, holes=[(DOOR[0] - 0.65, DOOR[0] + 0.65, 0.0, 3.0)])
    wall_y('tr_front', Y0 - 0.05, X0, X1, H, wall)
    wall_x('tr_left', X0 - 0.05, Y0, Y1, H, wall, holes=[(a, b, 0.9, 3.9) for a, b in WINDOWS])
    wall_x('tr_right', X1 + 0.05, Y0, Y1, H, wall)
    # plinthes rouges, corniche d'or, pilastres blancs
    for nm, sz, loc in (('tr_baseB', (X1 - X0, 0.04, 0.22), (0, Y1 - 0.02, 0.11)), ('tr_baseR', (0.04, Y1 - Y0, 0.22), (X1 - 0.02, (Y0 + Y1) / 2, 0.11)),
                        ('tr_baseL', (0.04, Y1 - Y0, 0.22), (X0 + 0.02, (Y0 + Y1) / 2, 0.11))):
        cz.box(nm, sz, loc, red, bevel=0.004, ol=0.003)
    for nm, sz, loc in (('tr_corB', (X1 - X0, 0.16, 0.2), (0, Y1 - 0.08, H - 0.3)), ('tr_corR', (0.16, Y1 - Y0, 0.2), (X1 - 0.08, (Y0 + Y1) / 2, H - 0.3)),
                        ('tr_corL', (0.16, Y1 - Y0, 0.2), (X0 + 0.08, (Y0 + Y1) / 2, H - 0.3)), ('tr_corF', (X1 - X0, 0.16, 0.2), (0, Y0 + 0.08, H - 0.3))):
        cz.box(nm, sz, loc, gold, bevel=0.01, ol=0.004)
    for x in (-4.2, -1.9, 1.9, 4.2):
        cz.box(f'tr_pilB{x}', (0.36, 0.1, H - 0.5), (x, Y1 - 0.05, (H - 0.5) / 2), white, bevel=0.01, ol=0.004)
    for y in (-3.0, -0.2, 2.3, 4.6):
        cz.box(f'tr_pilL{y}', (0.1, 0.36, H - 0.5), (X0 + 0.05, y, (H - 0.5) / 2), white, bevel=0.01, ol=0.004)
    # fenêtres : chambranles blancs, petits bois, ciel dehors (émissif, sans ombre), palmiers en silhouette
    for i, (a, b) in enumerate(WINDOWS):
        yc = (a + b) / 2
        for nm, sz, loc in (('t', (0.22, b - a + 0.3, 0.16), (X0 + 0.02, yc, 3.98)), ('b', (0.3, b - a + 0.3, 0.12), (X0 + 0.06, yc, 0.84)),
                            ('l', (0.22, 0.14, 3.2), (X0 + 0.02, a - 0.07, 2.4)), ('r', (0.22, 0.14, 3.2), (X0 + 0.02, b + 0.07, 2.4))):
            cz.box(f'tr_win{i}{nm}', sz, loc, white, bevel=0.01, ol=0.004)
        cz.box(f'tr_win{i}mull', (0.05, 0.05, 3.0), (X0 - 0.02, yc, 2.4), white, bevel=0, ol=0.002)
        for z in (1.65, 2.4, 3.15):
            cz.box(f'tr_win{i}tr{z}', (0.05, b - a, 0.05), (X0 - 0.02, yc, z), white, bevel=0, ol=0.002)
        cz.box(f'tr_win{i}arch', (0.2, b - a + 0.5, 0.5), (X0 + 0.02, yc, 4.35), gold, bevel=0.02, ol=0.004)
    sky = cz.glow('tr_skym', '#ffb47a' if soir else '#cdeef2', 1.0 if soir else 1.25)
    cz.plane('tr_sky', 14, 7, (X0 - 6.0, 1.0, 2.6), sky, rot=(90, 0, 90))
    cz.box('tr_outside_ground', (6, 14, 0.1), (X0 - 3.5, 1.0, -0.05), cz.toon('tr_outside_groundm', '#7ab86a' if not soir else '#7a4a5a'), bevel=0, ol=0)
    # dehors par la porte du fond : une galerie claire
    cz.box('tr_hall', (2.0, 2.5, 3.2), (DOOR[0], Y1 + 1.4, 1.6), cz.glow('tr_hall_skym', '#f4e2b8' if not soir else '#8a5a7a', 0.9), bevel=0, ol=0)

    # l'estrade et le trône (copie du trône du moteur avec nos images : props/throne.py)
    cz.prop('throne', 'tr_throne', (0, THRONE_Y, 0), lacquer='#9c1424', dais='#5a1412', gold='#d9a72e', cushion='#c21f2a')
    cz.prop('stage_curtain', 'tr_drapeback', (0, Y1 - 0.25, 0), kind='straight', width=3.4, height=H - 0.4, folds=9, color='#8a1824')
    cz.prop('stage_curtain', 'tr_valance', (0, Y1 - 0.4, H - 0.85), kind='valance', width=3.8, height=0.8, swags=3, color='#9c1424')
    pl = cz.plane('tr_plaque', 1.5, 1.5 * 420 / 1024, (0, Y1 - 0.42, 4.05), cz.toon('tr_plaquem', img=T('plaque_1811.png'), alpha_clip=True, lift=0.7))
    for sx in (-1, 1):
        cz.prop('stage_column', f'tr_col{sx}', (sx * 2.25, THRONE_Y + 0.6, 0), height=H - 0.4, marble='#f0e6d0', gold='#d2a23e')
    # rideaux des fenêtres
    for i, (a, b) in enumerate(WINDOWS):
        for side, y in (('L', a - 0.35), ('R', b + 0.35)):
            cz.prop('stage_curtain', f'tr_wcur{i}{side}', (X0 + 0.25, y, 0), rot=90, kind='drape', width=0.9, height=4.3, folds=5, side=side, color='#9c1424')
    # le tapis rouge de la porte au trône
    cz.box('tr_carpet', (1.5, 5.4, 0.02), (0, THRONE_Y - 2.75, 0.01), cz.toon('tr_carpetm', '#a81c28', pattern=('carpet', 0.4, '#8a1420')), bevel=0, ol=0)
    for sx in (-1, 1):
        cz.box(f'tr_carpetb{sx}', (0.1, 5.4, 0.022), (sx * 0.7, THRONE_Y - 2.75, 0.012), gold, bevel=0, ol=0)

    # le mur des armoiries (mur droit, face à -X) : 4 groupes, chiffres d'or dessous
    y = Y0 + 0.35
    imgs = [f'shield_{i:02d}.png' for i in range(12)]
    for g, (n, rows, cols, pitch, size) in enumerate(GROUPS):
        w = cols * pitch
        k = 0
        for r in range(rows):
            for c in range(cols):
                if k >= n:
                    break
                z = 3.95 - r * pitch * 1.15 - (0.12 if g == 0 else 0)
                yy = y + (c + 0.5) * pitch
                img = imgs[(k * 7 + g * 3) % 12]
                if g == 1 and k == 0:
                    img = 'shield_marmelade.png'
                o = cz.plane(f'tr_shield{g}_{k}', size, size * 300 / 256, (X1 - 0.03, yy, z),
                             cz.toon('tr_shm_' + img[:-4], img=T(img), alpha_clip=True, lift=0.7), rot=(90, 0, -90))
                SHIELDS.append((o, g))
                k += 1
        lbl = ['lbl_princes', 'lbl_ducs', 'lbl_comtes', 'lbl_barons'][g]
        lw = min(w, 1.6)
        o = cz.plane(f'tr_shlabel{g}', lw, lw * 160 / 512, (X1 - 0.03, y + w / 2, 3.95 - rows * pitch * 1.15 - 0.05),
                     cz.toon('tr_lblm' + lbl, img=T(lbl + '.png'), alpha_clip=True, lift=0.75), rot=(90, 0, -90))
        SHIELDS.append((o, g))
        y += w + 0.15
    for o, g in SHIELDS:
        if shields == 'none':
            o.hide_render = True
        elif shields == 'hidden':
            o.scale = (0.001, 0.001, 0.001)

    # la table de la carte
    tx, ty = MAP_TABLE
    wood = cz.toon('tr_woodm', '#5a2e18', tex='wood', tex_strength=0.12)
    cz.box('tr_mtable_top', (2.0, 1.25, 0.08), (tx, ty, MAP_TOP - 0.04), wood, bevel=0.02, ol=0.005)
    for sx in (-1, 1):
        for sy in (-1, 1):
            cz.cyl(f'tr_mtable_leg{sx}{sy}', 0.05, MAP_TOP - 0.08, (tx + sx * 0.88, ty + sy * 0.5, 0), wood, r2=0.035, ol=0.004, verts=16)
    cz.plane('tr_map', 1.82, 1.82 * 1100 / 1600, (tx, ty, MAP_TOP + 0.004), cz.toon('tr_mapm', img=T('map_nord.png'), lift=0.6), rot=(0, 0, 0))

    # le lustre (bougies) et sa lumière
    ring('tr_chand_ring', 0.75, 0.03, (0, 0.6, 3.8), gold)
    ring('tr_chand_ring2', 0.42, 0.025, (0, 0.6, 3.62), gold)
    cz.sphere('tr_chand_boss', 0.12, (0, 0.6, 3.66), gold, ol=0.003, segs=16, rings=8)
    cz.cyl('tr_chand_rod', 0.025, H - 3.8, (0, 0.6, 3.8), gold, ol=0.002, verts=8)
    for k in range(10):
        a = math.pi * 2 * k / 10
        x, y2 = 0.75 * math.cos(a), 0.6 + 0.75 * math.sin(a)
        cz.cyl(f'tr_chand_c{k}', 0.025, 0.14, (x, y2, 3.86), white, ol=0.002, verts=10)
        cz.sphere(f'tr_chand_f{k}', 0.03, (x, y2, 4.04), cz.glow('tr_flamem', '#ffcf6a', 2.2), ol=0.0, segs=10, rings=6)
    cz.light('tr_chand_light', 'POINT', (0, 0.6, 3.7), color='#ffc27a', power=260 if soir else 90, size=0.6, shadow=False)

    # LA LUMIÈRE
    if soir:
        cz.light('tr_sun', 'SUN', (X0 - 4, 0.5, 2.6), color='#ff8a4a', power=3.0, size=3, target=(X0 + 4.5, 1.6, 0.0))
        cz.light('tr_fill', 'AREA', (3.0, -3.0, 4.2), color='#7a6ad8', power=1400, size=5, target=(0, 1.5, 1.0))
        cz.light('tr_rim', 'AREA', (2.5, 4.4, 4.0), color='#ff9a5a', power=500, size=2.5, target=(0, 3.0, 1.2))
    else:
        cz.light('tr_sun', 'SUN', (X0 - 4, -0.5, 5.4), color='#ffe0a0', power=6.0, size=1.2, target=(X0 + 3.2, 1.6, 0.0))
        cz.light('tr_fill', 'AREA', (3.4, -3.2, 4.2), color='#8fd2de', power=380, size=5, target=(0, 1.5, 1.0))
        cz.light('tr_rim', 'AREA', (2.8, 4.6, 4.2), color='#ffd8a0', power=420, size=2.5, target=(0, 3.0, 1.2))
    dress('dress_trone', mode=mode)
    cz.no_shadow(('glass', 'Glass', 'pane', 'sky', 'outside', 'tr_hall'))
