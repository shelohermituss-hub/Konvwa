# Les décors du « Duc de la Marmelade » : une fonction par décor (mise en place + lumière), l'habillage dans
# dress_<décor>.py. Quatre murs, de vrais trous derrière portes et fenêtres, une lumière principale qui a une FORME.
import math
import os

import cz
from common import T, dress, wall_x, wall_y

# ---------------- TRÔNE : la salle du trône de Sans-Souci (x -5..5, y -3.5..5, plafond 5 m)
X0, X1, Y0, Y1, H = -5.0, 5.0, -3.5, 5.0, 5.0
PLAQUE = (0.0, 5.0 - 0.85, 3.98)    # la plaque « 1811 » (devant le lambrequin)
THRONE_Y = 2.6                      # bord avant de l'estrade ; le roi assis en (0, THRONE_Y + 1.4)
SEAT = (0.0, THRONE_Y + 1.4)
DOOR = (-3.0, Y1)                   # la porte du fond (Henri entre par là)
WINDOWS = [(-2.4, -1.2), (0.4, 1.6), (3.0, 4.2)]   # fenêtres du mur gauche (y), z 0.9..3.9
MAP_TABLE = (2.7, -0.6)             # la table de la carte (centre), plateau à 0.86 m
MAP_TOP = 0.86
SHIELDS = []                        # [(objet, groupe)] : groupes 0 princes, 1 ducs, 2 comtes, 3 barons
GROUPS = [(4, 2, 2, 0.5, 0.45), (8, 2, 4, 0.42, 0.38), (22, 3, 8, 0.31, 0.28), (37, 5, 8, 0.27, 0.24)]   # (n, rangs, colonnes, pas, taille)


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
    nuit = mode == 'nuit'     # nuit bleu-violet lumineuse (lune par les fenêtres, bougies chaudes)
    soir = mode == 'soir'
    floor = cz.toon('tr_floorm', '#ffffff', img=T('floor_checker.png'), proj='box', proj_scale=1 / 3.0)
    wall = cz.toon('tr_wallm', '#ffffff', img=T('wall_ochre.png'), proj='box', proj_scale=0.5, tint='#d8cfc0' if soir else ('#5a6cc0' if nuit else None))
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
    da, db = DOOR[0] - 0.65, DOOR[0] + 0.65
    for nm, sz, loc in (('tr_baseB', (da - X0, 0.04, 0.22), ((X0 + da) / 2, Y1 - 0.02, 0.11)), ('tr_baseB2', (X1 - db, 0.04, 0.22), ((db + X1) / 2, Y1 - 0.02, 0.11)), ('tr_baseR', (0.04, Y1 - Y0, 0.22), (X1 - 0.02, (Y0 + Y1) / 2, 0.11)),
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
    cz.plane('tr_hall', 2.6, 3.4, (DOOR[0], Y1 + 2.4, 1.7), cz.glow('tr_hall_skym', '#f4e2b8' if not soir else '#8a5a7a', 0.9))
    cz.box('tr_hallfloor', (2.4, 2.6, 0.2), (DOOR[0], Y1 + 1.2, -0.1), floor, bevel=0, ol=0)
    for sx in (-1, 1):
        cz.box(f'tr_hallwall{sx}', (0.1, 2.6, 3.2), (DOOR[0] + sx * 1.0, Y1 + 1.2, 1.6), wall, bevel=0, ol=0)

    # l'estrade et le trône (copie du trône du moteur avec nos images : props/throne.py)
    cz.prop('throne', 'tr_throne', (0, THRONE_Y, 0), lacquer='#9c1424', dais='#5a1412', gold='#d9a72e', cushion='#c21f2a')
    cz.prop('stage_curtain', 'tr_drapeback', (0, Y1 - 0.25, 0), kind='straight', width=3.4, height=H - 0.4, folds=9, color='#8a1824')
    cz.prop('stage_curtain', 'tr_valance', (0, Y1 - 0.4, H - 0.85), kind='valance', width=3.8, height=0.8, swags=3, color='#9c1424')
    pl = cz.plane('tr_plaque', 1.3, 1.3 * 420 / 1024, (0, Y1 - 0.85, 3.98), cz.toon('tr_plaquem', img=T('plaque_1811.png'), alpha_clip=True, lift=0.7))
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
    cz.light('tr_chand_light', 'POINT', (0, 0.6, 3.7), color='#ffc27a', power=260 if soir else (130 if nuit else 90), size=0.6, shadow=False)

    # LA LUMIÈRE
    if nuit:
        cz.light('tr_sun', 'SUN', (X0 - 4, -0.5, 5.4), color='#8fa8ff', power=1.6, size=1.0, target=(X0 + 3.2, 1.6, 0.0))
        cz.light('tr_fill', 'AREA', (3.4, -3.2, 4.2), color='#5a68d0', power=800, size=5, target=(0, 1.5, 1.0))
        cz.light('tr_rim', 'AREA', (2.8, 4.6, 4.2), color='#ff9a5a', power=620, size=2.5, target=(0, 3.0, 1.2))
    elif soir:
        cz.light('tr_sun', 'SUN', (X0 - 4, 0.5, 2.6), color='#ff8a4a', power=3.0, size=3, target=(X0 + 4.5, 1.6, 0.0))
        cz.light('tr_fill', 'AREA', (3.0, -3.0, 4.2), color='#7a6ad8', power=1400, size=5, target=(0, 1.5, 1.0))
        cz.light('tr_rim', 'AREA', (2.5, 4.4, 4.0), color='#ff9a5a', power=500, size=2.5, target=(0, 3.0, 1.2))
    else:
        cz.light('tr_sun', 'SUN', (X0 - 4, -0.5, 5.4), color='#ffe0a0', power=9.0, size=1.0, target=(X0 + 3.2, 1.6, 0.0))
        cz.light('tr_fill', 'AREA', (3.4, -3.2, 4.2), color='#8fd2de', power=220, size=5, target=(0, 1.5, 1.0))
        cz.light('tr_rim', 'AREA', (2.8, 4.6, 4.2), color='#ffd8a0', power=420, size=2.5, target=(0, 3.0, 1.2))
    dress('dress_trone', mode=mode)
    cz.no_shadow(('glass', 'Glass', 'pane', 'sky', 'outside', 'tr_hall'))


# ---------------- SALON : un salon parisien, après-midi gris (x -3.5..3.5, y -3..3.5, plafond 3.6)
SX0, SX1, SY0, SY1, SH = -3.5, 3.5, -3.0, 3.5, 3.6
SWIN = (-2.5, -0.9, 0.8, 3.0)       # la fenêtre du mur du fond (x0, x1, z0, z1)
FIRE = (SX0, 0.6)                   # la cheminée (mur gauche, centre y)
ARMCHAIR = (1.75, 1.6)              # le fauteuil de BOUILLON (centre du siège), tourné vers -Y et un peu vers la gauche
ARM_YAW = 25
MAPFR = (SX1, 0.2, 1.9)             # la carte de France sur le mur droit (centre)
MAPFR_W = 1.15


def armchair(name, loc, yaw, velvet='#5a2a6a', wood='#4a2414', seat_h=0.4):
    """Un fauteuil Empire : bois sombre doré, velours ; le siège à seat_h. Racine = centre du siège au sol."""
    root = cz.empty(name, (loc[0], loc[1], 0))
    root.rotation_euler = (0, 0, math.radians(yaw))
    v = cz.toon(name + '_velm', velvet, sheen=0.35)
    w = cz.toon(name + '_woodm', wood, tex='wood', tex_strength=0.1)
    cz.box(name + '_seat', (0.66, 0.6, 0.14), (0, 0, seat_h - 0.07), v, bevel=0.04, ol=0.005, parent=root)
    cz.box(name + '_frame', (0.7, 0.64, 0.08), (0, 0, seat_h - 0.18), w, bevel=0.01, ol=0.005, parent=root)
    cz.box(name + '_back', (0.66, 0.14, 0.62), (0, 0.32, seat_h + 0.28), v, bevel=0.05, ol=0.005, parent=root)
    cz.box(name + '_backw', (0.72, 0.08, 0.7), (0, 0.38, seat_h + 0.3), w, bevel=0.02, ol=0.005, parent=root)
    for sx in (-1, 1):
        cz.box(f'{name}_arm{sx}', (0.1, 0.56, 0.08), (sx * 0.36, 0.02, seat_h + 0.2), w, bevel=0.02, ol=0.004, parent=root)
        cz.box(f'{name}_armpost{sx}', (0.06, 0.06, 0.22), (sx * 0.36, -0.24, seat_h + 0.07), w, bevel=0.01, ol=0.003, parent=root)
        for sy in (-1, 1):
            cz.cyl(f'{name}_leg{sx}{sy}', 0.03, seat_h - 0.22, (sx * 0.31, sy * 0.27, 0), w, r2=0.02, ol=0.003, verts=10, parent=root)
    return root


def salon(mode='jour'):
    """Le salon parisien de 1811 : papier peint lilas, fenêtre sur la rue (l'enseigne GODZY en face), cheminée qui
    éclaire, carte de France encadrée, guéridon et soupière, le fauteuil de BOUILLON."""
    wall = cz.toon('sa_wallm', '#ffffff', img=T('wall_salon.png'), proj='box', proj_scale=0.6, tint='#6c7cc0' if mode == 'nuit' else None)
    floor = cz.toon('sa_floorm', '#7a4a2a', pattern=('planks', 1.0, 0.12, '#3e2414'), tex='wood', tex_scale=2, tex_strength=0.12)
    white = cz.toon('sa_whitem', '#ece4d4', tex='grain', tex_strength=0.05)
    gold = cz.toon('tr_goldm', '#d2a23e', sheen=0.5)
    cz.box('sa_floor', (SX1 - SX0 + 0.4, SY1 - SY0 + 0.4, 0.2), (0, (SY0 + SY1) / 2, -0.1), floor, bevel=0, ol=0)
    cz.box('sa_ceiling', (SX1 - SX0 + 0.4, SY1 - SY0 + 0.4, 0.2), (0, (SY0 + SY1) / 2, SH + 0.1), cz.toon('sa_ceilm', '#e6dccc', tex='grain'), bevel=0, ol=0)
    wall_y('sa_back', SY1 + 0.05, SX0, SX1, SH, wall, holes=[(SWIN[0], SWIN[1], SWIN[2], SWIN[3])])
    wall_y('sa_front', SY0 - 0.05, SX0, SX1, SH, wall)
    wall_x('sa_left', SX0 - 0.05, SY0, SY1, SH, wall)
    wall_x('sa_right', SX1 + 0.05, SY0, SY1, SH, wall)
    # boiseries basses blanches, corniche
    for nm, sz, loc in (('sa_dadoB', (SX1 - SX0, 0.05, 0.9), (0, SY1 - 0.03, 0.45)), ('sa_dadoL', (0.05, SY1 - SY0, 0.9), (SX0 + 0.03, (SY0 + SY1) / 2, 0.45)),
                        ('sa_dadoR', (0.05, SY1 - SY0, 0.9), (SX1 - 0.03, (SY0 + SY1) / 2, 0.45))):
        cz.box(nm, sz, loc, white, bevel=0.005, ol=0.003)
    for nm, sz, loc in (('sa_corB', (SX1 - SX0, 0.12, 0.14), (0, SY1 - 0.06, SH - 0.1)), ('sa_corL', (0.12, SY1 - SY0, 0.14), (SX0 + 0.06, (SY0 + SY1) / 2, SH - 0.1)),
                        ('sa_corR', (0.12, SY1 - SY0, 0.14), (SX1 - 0.06, (SY0 + SY1) / 2, SH - 0.1))):
        cz.box(nm, sz, loc, white, bevel=0.01, ol=0.003)
    # la fenêtre : chambranle, petits bois, rideaux ; dehors la façade d'en face et l'enseigne GODZY
    x0, x1, z0, z1 = SWIN
    xc = (x0 + x1) / 2
    for nm, sz, loc in (('t', (x1 - x0 + 0.24, 0.16, 0.14), (xc, SY1 - 0.02, z1 + 0.07)), ('b', (x1 - x0 + 0.3, 0.24, 0.08), (xc, SY1 - 0.06, z0 - 0.04)),
                        ('l', (0.12, 0.16, z1 - z0), (x0 - 0.06, SY1 - 0.02, (z0 + z1) / 2)), ('r', (0.12, 0.16, z1 - z0), (x1 + 0.06, SY1 - 0.02, (z0 + z1) / 2))):
        cz.box(f'sa_win{nm}', sz, loc, white, bevel=0.01, ol=0.004)
    cz.box('sa_winmull', (0.04, 0.04, z1 - z0), (xc, SY1 + 0.02, (z0 + z1) / 2), white, bevel=0, ol=0.002)
    for z in (z0 + 0.55, z0 + 1.1, z0 + 1.65):
        cz.box(f'sa_wintr{z:.2f}', (x1 - x0, 0.04, 0.04), (xc, SY1 + 0.02, z), white, bevel=0, ol=0.002)
    for side, x in (('L', x0 - 0.3), ('R', x1 + 0.3)):
        cz.prop('stage_curtain', f'sa_cur{side}', (x, SY1 - 0.18, 0), kind='drape', width=0.8, height=3.3, folds=5, side=side, color='#3e5a8a')
    cz.box('sa_outside_facade', (9, 0.3, 9), (xc, SY1 + 5.0, 4.0), cz.toon('sa_outside_facadem', '#9aa0aa', tex='grain', tex_strength=0.1), bevel=0, ol=0)
    for k in range(4):
        for j in range(3):
            cz.box(f'sa_outside_fwin{k}{j}', (0.8, 0.05, 1.2), (xc - 3.0 + k * 2.0, SY1 + 4.82, 1.6 + j * 2.2),
                   cz.glow('sa_outside_fwinm', '#ffd890', 0.8) if (k + j) % 3 == 0 else cz.toon('sa_outside_fwindm', '#3a4252'), bevel=0, ol=0)
    cz.plane('sa_outside_godzy', 1.5, 1.5 * 260 / 1024, (xc + 0.15, SY1 + 4.8, 2.55), cz.toon('sa_outside_godzym', img=T('sign_godzy.png'), lift=0.8))
    cz.box('sa_outside_street', (9, 6, 0.1), (xc, SY1 + 2.0, -0.6), cz.toon('sa_outside_streetm', '#5a5f66'), bevel=0, ol=0)
    cz.plane('sa_sky', 16, 10, (xc, SY1 + 6.0, 5.0), cz.glow('sa_skym', '#b9c4d6', 1.0))
    # la cheminée (mur gauche) et son feu
    fy = FIRE[1]
    marble = cz.toon('sa_marblem', '#e8e0d4', tex='grain', tex_strength=0.06)
    cz.box('sa_fire_body', (0.4, 1.6, 1.15), (SX0 + 0.2, fy, 0.575), marble, bevel=0.02, ol=0.005)
    cz.box('sa_fire_shelf', (0.5, 1.8, 0.08), (SX0 + 0.25, fy, 1.19), marble, bevel=0.02, ol=0.005)
    cz.box('sa_fire_hole', (0.06, 0.9, 0.7), (SX0 + 0.39, fy, 0.38), cz.toon('sa_fire_holem', '#1a1210'), bevel=0, ol=0)
    for k in range(3):
        cz.sphere(f'sa_fire_flame{k}', 0.12 - k * 0.025, (SX0 + 0.38, fy - 0.15 + k * 0.15, 0.22 + (k % 2) * 0.05), cz.glow('sa_flamem', '#ff9a3a', 2.4), ol=0.0, segs=12, rings=8)
    cz.light('sa_fire_light', 'POINT', (SX0 + 0.75, fy, 0.5), color='#ff8a3a', power=260, size=0.3, shadow=False)
    cz.poster('sa_mirror', T('painting_navire.png'), 0.9, (SX0, fy, 2.05), rot=90, frame='#b8862a', frame_w=0.05)
    for k, dy in enumerate((-0.7, 0.7)):
        cz.prop('gb_candle', f'sa_candle{k}', (SX0 + 0.25, fy + dy, 1.23), lit=True, power=20)
    # la carte de France (mur droit), la porte
    cz.poster('sa_mapfr', T('map_france.png'), MAPFR_W, MAPFR, rot=-90, frame='#b8862a', frame_w=0.06)
    cz.prop('door', 'sa_door', (SX1, -1.9, 0), rot=-90, open=0.0, color='#e8e0d0', sign=None)
    # le guéridon et la soupière, le fauteuil de BOUILLON
    ax, ay = ARMCHAIR
    armchair('sa_armchair', ARMCHAIR, ARM_YAW)
    wood = cz.toon('sa_woodm', '#4a2414', tex='wood', tex_strength=0.1)
    gx, gy = ax - 0.85, ay - 0.35
    cz.cyl('sa_gueridon_top', 0.38, 0.04, (gx, gy, 0.66), marble, ol=0.004, verts=32)
    cz.cyl('sa_gueridon_foot', 0.05, 0.62, (gx, gy, 0.04), wood, ol=0.003, verts=12)
    cz.cyl('sa_gueridon_base', 0.22, 0.05, (gx, gy, 0.0), wood, ol=0.003, verts=24)
    cz.cyl('sa_tureen', 0.15, 0.14, (gx, gy, 0.7), cz.toon('sa_porcelainm', '#f4f0e8'), r2=0.11, ol=0.004, verts=28)
    cz.sphere('sa_tureen_lid', 0.12, (gx, gy, 0.84), cz.toon('sa_porcelainm', '#f4f0e8'), scale=None, ol=0.004, segs=20, rings=10)
    cz.cyl('sa_tureen_band', 0.152, 0.03, (gx, gy, 0.76), gold, ol=0.0, verts=28)
    # tapis, lustre
    cz.box('sa_rug', (3.6, 3.0, 0.02), (0.0, 0.5, 0.01), cz.toon('sa_rugm', '#7a2a3a', pattern=('carpet', 0.5, '#5a1a2a')), bevel=0, ol=0)
    ring('sa_chand', 0.45, 0.025, (0, 0.4, 2.85), gold)
    cz.cyl('sa_chand_rod', 0.02, SH - 2.85, (0, 0.4, 2.85), gold, ol=0.002, verts=8)
    for k in range(6):
        a = math.pi * 2 * k / 6
        cz.sphere(f'sa_chand_f{k}', 0.025, (0.45 * math.cos(a), 0.4 + 0.45 * math.sin(a), 2.95), cz.glow('tr_flamem', '#ffcf6a', 2.2), ol=0.0, segs=10, rings=6)
    # LA LUMIÈRE : jour gris froid par la fenêtre (clé), le feu (contre chaud), un fill violet bas
    nuit = mode == 'nuit'
    cz.light('sa_window', 'AREA', (xc, SY1 + 0.6, 2.2), rot=(0, 0, 0), color='#5a70d8' if nuit else '#9cb4ff', power=330 if nuit else 900, size=2.2, target=(0.3, 0.4, 0.8))
    cz.light('sa_sun', 'SUN', (xc, SY1 + 4.0, 5.0), color='#8aa0ff' if nuit else '#c8d6ff', power=0.9 if nuit else 2.2, size=4, target=(xc + 0.8, 0.8, 0.0))
    cz.light('sa_fill', 'AREA', (2.5, -2.6, 2.6), color='#7a5ad8' if nuit else '#a58ad8', power=200 if nuit else 260, size=3, target=(0, 0.8, 1.0))
    if nuit:
        cz.light('sa_chand_light', 'POINT', (0, 0.4, 2.7), color='#ffc27a', power=160, size=0.5, shadow=False)
    cz.no_shadow(('glass', 'pane', 'sky', 'outside'))


# ---------------- dehors : SANS-SOUCI (Milot) et la CITADELLE (le sommet)
def _sky(img, power=1.0):
    cz.prop('out_sky_drum', 'ex_sky_drum', (0, 0, 0), img=T(img), radius=60.0, z0=-14.0, z1=78.0, strength=power)


def _ground(mat, size=130):
    cz.box('ex_ground', (size, size, 0.2), (0, 0, -0.1), mat, bevel=0, ol=0)


def palm(name, loc, h=5.0, lean=8.0, seed=1):
    """Un palmier : tronc annelé penché, une couronne de palmes retombantes (feuilles pointues, pas des pagaies)."""
    import random as _r
    rnd = _r.Random(seed)
    trunk = cz.toon('ex_palm_trunkm', '#7a5a3a', tex='wood', tex_strength=0.12)
    leaf = cz.toon('ex_palm_leafm', '#3f8a3e')
    root = cz.empty(name, loc)
    root.rotation_euler = (math.radians(lean), 0, math.radians(rnd.uniform(0, 360)))
    for k in range(8):
        cz.cyl(f'{name}_tr{k}', 0.17 - k * 0.008, h / 8 + 0.02, (0, 0, k * h / 8), trunk, r2=0.15 - k * 0.008, ol=0.006, verts=12, parent=root)
    for k in range(9):
        a = 2 * math.pi * k / 9 + rnd.uniform(-0.2, 0.2)
        lf = cz.empty(f'{name}_lfpv{k}', (0, 0, h), parent=root)
        lf.rotation_euler = (0, 0, a)
        o = cz.cyl(f'{name}_lf{k}', 0.32, 1.9, (0, 0, 0), leaf, r2=0.0, verts=4, ol=0.006, parent=lf)
        o.data.transform(__import__('mathutils').Matrix.Diagonal((1, 0.18, 1, 1)))   # jamais scale= sur un objet cerné
        o.rotation_euler = (math.radians(-105 - rnd.uniform(0, 25)), 0, 0)
    return root


def sanssouci():
    """Le palais Sans-Souci au pied de la montagne, en plein soleil, et son chantier au premier plan."""
    _sky('pano_jour.png', 1.0)
    _ground(cz.toon('ex_grassm', '#ffffff', img=T('grass.png'), proj='box', proj_scale=0.25))
    ochre = cz.toon('ss_wallm', '#ffffff', img=T('wall_ochre.png'), proj='box', proj_scale=0.35)
    white = cz.toon('ss_whitem', '#f0e8d8', tex='grain', tex_strength=0.05)
    stone_m = cz.toon('ss_stonem', '#ffffff', img=T('stone_wall.png'), proj='box', proj_scale=0.6)
    glass = cz.toon('ss_glassm', '#24323e')
    # le podium, l'escalier, la façade à deux niveaux, le toit
    cz.box('ss_podium', (20, 8, 1.2), (0, 9.0, 0.6), stone_m, bevel=0.02, ol=0.01)
    for k in range(8):
        cz.box(f'ss_step{k}', (5.0 - k * 0.12, 0.3, 0.15 * (k + 1)), (0, 5.0 - (7 - k) * 0.3 - 0.15, 0.075 * (k + 1)), stone_m, bevel=0.01, ol=0.006)
    cz.box('ss_facade', (16, 6, 7.0), (0, 9.0, 1.2 + 3.5), ochre, bevel=0.03, ol=0.012)
    cz.box('ss_cornice', (16.6, 6.6, 0.35), (0, 9.0, 8.35), white, bevel=0.03, ol=0.01)
    cz.box('ss_floorband', (16.2, 6.2, 0.2), (0, 9.0, 4.7), white, bevel=0.02, ol=0.008)
    roof = cz.cyl('ss_roof', 11.4, 2.6, (0, 9.0, 8.5), cz.toon('ss_roofm', '#9a3a2a', tex='grain', tex_strength=0.1), r2=3.0, verts=4, ol=0.012)
    roof.rotation_euler = (0, 0, math.radians(45))
    roof.data.transform(__import__('mathutils').Matrix.Diagonal((1.0, 0.42, 1.0, 1)))
    for row, z in ((0, 2.9), (1, 6.3)):
        for k in range(9):
            x = -7.0 + k * 1.75
            if row == 0 and abs(x) < 1.0:
                continue
            cz.box(f'ss_win{row}{k}', (0.95, 0.06, 1.7), (x, 5.97, z), glass, bevel=0, ol=0.0)
            cz.box(f'ss_winf{row}{k}', (1.15, 0.12, 0.14), (x, 5.95, z + 0.92), white, bevel=0.01, ol=0.004)
            cz.box(f'ss_wins{row}{k}', (1.15, 0.12, 0.1), (x, 5.95, z - 0.9), white, bevel=0.01, ol=0.004)
            cz.box(f'ss_winm{row}{k}', (0.05, 0.08, 1.7), (x, 5.95, z), white, bevel=0, ol=0.0)
    # le portique : quatre colonnes, l'entablement, le fronton, la porte
    for k, x in enumerate((-2.4, -0.8, 0.8, 2.4)):
        cz.prop('stage_column', f'ss_col{k}', (x, 5.4, 1.2), height=5.2, marble='#f2ead8', gold='#d2a23e')
    cz.box('ss_entab', (6.2, 1.2, 0.5), (0, 5.6, 6.65), white, bevel=0.02, ol=0.008)
    import bmesh
    bm = bmesh.new()
    f = [bm.verts.new((x, y, z)) for y in (5.0, 6.0) for x, z in ((-3.3, 6.9), (3.3, 6.9), (0.0, 8.2))]
    bm.faces.new((f[0], f[1], f[2]))
    bm.faces.new((f[5], f[4], f[3]))
    for i in range(3):
        j = (i + 1) % 3
        bm.faces.new((f[i], f[i + 3], f[j + 3], f[j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ped = cz._mesh_obj('ss_pediment', bm, white)
    cz.place(ped, (0, 0, 0))
    cz.outline(ped, 0.008)
    cz.box('ss_door', (1.6, 0.08, 2.8), (0, 5.97, 2.6), cz.toon('ss_doorm', '#5a2a18', tex='wood'), bevel=0.01, ol=0.005)
    # palmiers, massifs, le chemin
    for k, (x, y, h) in enumerate(((-11, 3, 6.0), (11.5, 2.5, 5.4), (-14, 9, 6.5), (14, 9.5, 6.0), (-7.5, -3, 4.6))):
        palm(f'ex_palm{k}', (x, y, 0), h, 6 + k * 2, k + 3)
    for k, x in enumerate((-6.5, -4.5, 4.5, 6.5)):
        cz.prop('out_shrub', f'ss_shrub{k}', (x, 4.2, 0), kind='bush', size=1.3, bloom='#e04a6a' if k % 2 else '#f0c040', seed=k + 2)
    cz.box('ss_path', (5.2, 12, 0.02), (0, -1.6, 0.01), cz.toon('ss_pathm', '#c8a878', pattern=('speckle', 0.04, '#9a7a50')), bevel=0, ol=0)
    # le chantier au premier plan (gauche) : échafaudage, pierres taillées, caisse GODZY, charrette
    pole = cz.toon('ss_polem', '#8a6a42', tex='wood')
    for k, x in enumerate((-7.8, -6.0, -4.2)):
        for y in (5.2, 6.0):
            cz.cyl(f'ss_scaf{k}{y}', 0.05, 7.2, (x, y - 0.4, 1.2), pole, ol=0.004, verts=8)
    for z in (3.2, 5.6):
        cz.box(f'ss_plank{z}', (4.0, 0.9, 0.06), (-6.0, 5.2, z), pole, bevel=0.005, ol=0.004)
    for k, (x, y, r) in enumerate(((-4.2, 1.2, 10), (-3.4, 0.6, -14), (-4.0, 0.1, 30), (-3.7, 0.7, 5))):
        z = 0.3 if k < 3 else 0.9
        cz.box(f'ss_block{k}', (0.9, 0.6, 0.6), (x, y, z), stone_m, rot=(0, 0, r), bevel=0.03, ol=0.006)
    crate = cz.box('ss_crate', (0.9, 0.7, 0.7), (-5.6, -0.2, 0.35), cz.toon('ss_cratem', '#b88a4a', tex='wood', tex_strength=0.15), bevel=0.02, ol=0.006)
    cz.plane('ss_crate_godzy', 0.78, 0.78 * 340 / 1024, (-5.6, -0.56, 0.38), cz.toon('ss_crate_godzym', img=T('crate_godzy.png'), lift=0.75))
    cz.prop('out_cart', 'ss_cart', (-2.4, -1.2, 0), rot=30, load='goods')
    # lumière : plein soleil de l'après-midi, ciel bleu en fill
    cz.light('ex_sun', 'SUN', (-20, -25, 30), color='#fff0d0', power=4.6, size=1.5, target=(0, 4, 0))
    cz.light('ex_fill', 'AREA', (8, -14, 10), color='#a8d8f0', power=4000, size=12, target=(0, 4, 2))
    cz.no_shadow(('sky', 'glass'))


CIT_MARK = (3.4, -15.2)     # la borne « 900 m »
CANNONS = [(-6.0 + k * 1.7, -8.6) for k in range(8)]
RAMP = (8.6, -10.5)         # la rampe où l'on hisse un canon


def cannon(name, loc, rot=0.0, godzy=False, tilt=6.0):
    """Un canon de fer noir sur un affût de bois à quatre roues, la gueule vers -Y."""
    root = cz.empty(name, loc)
    root.rotation_euler = (0, 0, math.radians(rot))
    wood = cz.toon('ct_woodm', '#6a4426', tex='wood', tex_strength=0.12)
    iron = cz.toon('ct_ironm', '#2a2a2e', sheen=0.4)
    cz.box(name + '_carr', (0.5, 1.1, 0.3), (0, 0.1, 0.32), wood, bevel=0.02, ol=0.004, parent=root)
    for sx in (-1, 1):
        for sy in (-1, 1):
            w = cz.cyl(f'{name}_wh{sx}{sy}', 0.17, 0.08, (sx * 0.3, sy * 0.38 + 0.1, 0.17), wood, rot=(0, 90, 0), ol=0.004, verts=16, parent=root)
            w.location.x -= 0.04 * sx
    pv = cz.empty(name + '_barrelpv', (0, 0.25, 0.55), parent=root)
    pv.rotation_euler = (math.radians(90 + tilt), 0, math.radians(180))
    cz.cyl(name + '_barrel', 0.14, 1.55, (0, 0, -0.35), iron, r2=0.1, ol=0.005, verts=20, parent=pv)
    cz.sphere(name + '_breech', 0.13, (0, 0, -0.36), iron, ol=0.004, segs=16, rings=8, parent=pv)
    cz.cyl(name + '_muzzle', 0.12, 0.08, (0, 0, 1.15), iron, ol=0.004, verts=20, parent=pv)
    if godzy:
        cz.plane(name + '_godzy', 0.3, 0.3 * 260 / 1024, (0, 0.3, 0.72), cz.toon('ct_godzym', img=T('sign_godzy.png'), lift=0.8), rot=(70, 0, 180), parent=root)
    return root


def citadelle(mode='jour'):
    """Le sommet : la proue de pierre de la Citadelle, le parapet et ses canons, les boulets, la rampe, la borne
    « 900 m ». mode 'jour' (soleil haut, ciel turquoise) ou 'couchant' (rouge-or, ombres longues, le panneau MARMELADE)."""
    cou = mode == 'couchant'
    _sky('pano_couchant.png' if cou else 'pano_jour.png', 1.0)
    _ground(cz.toon('ex_grassm', '#ffffff', img=T('grass.png'), proj='box', proj_scale=0.25, tint='#d8a8a0' if cou else None), 46)
    # au-delà du plateau, la mer de nuages en contrebas (on est à 900 m)
    import random as _r
    rnd = _r.Random(5)
    cloud = cz.toon('ex_cloudm', '#ffd0c0' if cou else '#ffffff', lift=0.4)
    for k in range(70):
        a = 2 * math.pi * k / 70 + rnd.uniform(-0.04, 0.04)
        r = rnd.uniform(28, 44)
        cz.sphere(f'ex_cloud{k}', rnd.uniform(2.5, 5.0), (r * math.sin(a), r * math.cos(a), rnd.uniform(-3.5, -1.2)), cloud, ol=0.0, segs=16, rings=8)
    cz.box('ex_cliff', (46, 46, 30), (0, 0, -15.2), cz.toon('ex_cliffm', '#5a6a4a' if not cou else '#6a4a5a', tex='grain'), bevel=0, ol=0)
    stone_m = cz.toon('ct_stonem', '#ffffff', img=T('stone_wall.png'), proj='box', proj_scale=0.4, tint='#ffc8a8' if cou else None)
    # la forteresse : un prisme à proue (pointe vers -Y), murs de 11 m, couronne de créneaux
    import bmesh
    from mathutils import Vector
    pts = [(-11, 14), (11, 14), (11, 4), (3.2, -3.2), (0, -6.0), (-3.2, -3.2), (-11, 4)]
    bm = bmesh.new()
    lo = [bm.verts.new((x, y, 0)) for x, y in pts]
    hi = [bm.verts.new((x * 0.97, y * 0.97 + 0.3, 11.0)) for x, y in pts]
    bm.faces.new(list(reversed(lo)))
    bm.faces.new(hi)
    n = len(pts)
    for i in range(n):
        bm.faces.new((lo[i], lo[(i + 1) % n], hi[(i + 1) % n], hi[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = cz._mesh_obj('ct_fortress', bm, stone_m)
    cz.place(o, (0, 0, 0))
    cz.outline(o, 0.02)
    for i in range(n):   # créneaux le long du sommet
        a, b = Vector(pts[i]) * 0.97 + Vector((0, 0.3)), Vector(pts[(i + 1) % n]) * 0.97 + Vector((0, 0.3))
        L = (b - a).length
        m = int(L / 1.4)
        for k in range(m):
            p = a.lerp(b, (k + 0.5) / m)
            ang = math.degrees(math.atan2((b - a).y, (b - a).x))
            cz.box(f'ct_merlon{i}_{k}', (0.7, 0.6, 0.8), (p.x, p.y, 11.4), stone_m, rot=(0, 0, ang), bevel=0.02, ol=0.006)
    for k in range(5):   # meurtrières et embrasures sur la proue
        for sx in (-1, 1):
            cz.box(f'ct_gunport{k}{sx}', (0.6, 0.2, 0.5), (sx * (1.2 + k * 0.4), -4.7 + k * 0.42, 6.0 + (k % 2) * 2.4), cz.toon('ct_darkm', '#1e1a18'),
                   rot=(0, 0, sx * -42), bevel=0, ol=0.0)
    # la terrasse des canons devant : parapet bas, canons, pyramides de boulets
    cz.box('ct_terrace', (18, 6.5, 0.3), (0, -10.5, 0.15), stone_m, bevel=0.02, ol=0.008)
    cz.box('ct_parapet', (18, 0.6, 0.95), (0, -13.6, 0.78), stone_m, bevel=0.02, ol=0.008)
    for i, (x, y) in enumerate(CANNONS):
        cannon(f'ct_cannon{i}', (x, y - 3.4, 0.3), 0, godzy=(i == 3))
    iron = cz.toon('ct_ironm', '#2a2a2e', sheen=0.4)
    for p, (x, y) in enumerate(((-7.6, -9.0), (7.2, -9.4))):
        k = 0
        for lvl in range(4):
            for i in range(4 - lvl):
                for j in range(4 - lvl):
                    cz.sphere(f'ct_ball{p}_{k}', 0.12, (x + (i + lvl * 0.5) * 0.24, y + (j + lvl * 0.5) * 0.24, 0.42 + lvl * 0.2), iron, ol=0.0, segs=12, rings=6)
                    k += 1
    # la rampe (à droite) et le chemin qui monte ; la borne 900 m
    ramp = cz.box('ct_ramp', (2.4, 7.0, 0.3), (RAMP[0], RAMP[1] - 3.5, 0.0), stone_m, rot=(-4.5, 0, 0), bevel=0.02, ol=0.008)
    cz.box('ct_mark', (0.5, 0.35, 1.0), (CIT_MARK[0], CIT_MARK[1], 0.5), stone_m, bevel=0.06, ol=0.006)
    cz.plane('ct_mark_lbl', 0.46, 0.46 * 200 / 512, (CIT_MARK[0], CIT_MARK[1] - 0.18, 0.75), cz.toon('ct_marklblm', img=T('lbl_900.png'), alpha_clip=True, lift=0.8))
    for k, (x, y, h) in enumerate(((-14, -14, 5.5), (15, -6, 6.0), (-16, 2, 6.4))):
        palm(f'ex_palm{k}', (x, y, 0), h, 8 + k, k + 7)
    for k in range(8):
        cz.prop('out_shrub', f'ct_shrub{k}', (-12 + k * 3.4, -17.5 + (k % 3), 0), kind='bush', size=1.1, seed=k + 11)
    if cou:   # le panneau de route MARMELADE au premier plan (s11)
        wood = cz.toon('ct_postm', '#6a4426', tex='wood')
        cz.cyl('ct_signpost', 0.06, 2.0, (-1.3, -19.0, 0), wood, ol=0.004, verts=10)
        cz.box('ct_signboard', (1.3, 0.05, 0.34), (-0.8, -19.05, 1.7), wood, rot=(0, 0, 0), bevel=0.01, ol=0.004)
        cz.plane('ct_signtext', 1.22, 1.22 * 260 / 1024, (-0.8, -19.08, 1.7), cz.toon('ct_signtextm', img=T('sign_marmelade.png'), lift=0.8))
        cz.box('ct_signtip', (0.24, 0.05, 0.24), (-0.1, -19.05, 1.7), wood, rot=(0, 45, 0), bevel=0.0, ol=0.004)
        cz.light('ex_sun', 'SUN', (40, -30, 6), color='#ff8a4a', power=3.4, size=2.0, target=(0, 0, 0))
        cz.light('ex_fill', 'AREA', (-10, -24, 8), color='#c86ab8', power=5200, size=14, target=(0, -6, 3))
    else:
        cz.light('ex_sun', 'SUN', (-18, -30, 34), color='#fff0d0', power=4.6, size=1.5, target=(0, -6, 0))
        cz.light('ex_fill', 'AREA', (14, -24, 10), color='#a8d8f0', power=4000, size=14, target=(0, -6, 3))
    cz.no_shadow(('sky', 'glass'))


def crown_prop(name, loc, R=0.24):
    """La couronne d'Henri posée seule (s10) : la même que cast.crown, sans la tête."""
    root = cz.empty(name, loc)
    g = cz.toon('kv_goldm', '#d9a72e', sheen=0.5)
    cz.cyl(name + '_band', R * 0.66, R * 0.22, (0, 0, 0), g, ol=0.004, verts=40, parent=root)
    cz.sphere(name + '_cap', R * 0.6, (0, 0, R * 0.16), cz.toon('kv_velvetm', '#9c1424', sheen=0.4), ol=0.004, segs=24, rings=12, parent=root)
    for k in range(8):
        a = math.pi * 2 * k / 8
        x, y = R * 0.66 * math.cos(a), R * 0.66 * math.sin(a)
        cz.cyl(f'{name}_pt{k}', R * 0.07, R * 0.2, (x, y, R * 0.2), g, r2=0.0, ol=0.002, verts=8, parent=root)
        cz.sphere(f'{name}_pearl{k}', R * 0.045, (x, y, R * 0.42), cz.toon('kv_pearlm', '#f6f0e4'), ol=0.0, segs=10, rings=6, parent=root)
    cz.box(name + '_crossv', (R * 0.06, R * 0.06, R * 0.26), (0, 0, R * 0.9), g, bevel=0.003, ol=0.002, parent=root)
    cz.box(name + '_crossh', (R * 0.18, R * 0.06, R * 0.06), (0, 0, R * 0.94), g, bevel=0.003, ol=0.002, parent=root)
    return root
