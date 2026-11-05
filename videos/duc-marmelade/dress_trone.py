# L'habillage de la salle du trône (appelé par sets.trone) : tableaux, chandeliers, vases, plantes, banquettes de
# velours, caissons dorés au plafond, un objet de premier plan. Le décor (murs, lumière) est dans sets.py.
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)


def dress(cz, mode='jour'):
    import sets
    from common import T
    soir = mode == 'soir'
    gold = cz.toon('tr_goldm', '#d2a23e', sheen=0.5)
    Y1, X0, X1, H, TY = sets.Y1, sets.X0, sets.X1, sets.H, sets.THRONE_Y
    # deux tableaux : la Citadelle (on la verra à la fin) et un trois-mâts
    cz.poster('tr_paint_cit', T('painting_citadelle.png'), 1.3, (3.05, Y1 - 0.05, 2.55), rot=0, frame='#b8862a', frame_w=0.07)
    cz.poster('tr_paint_ship', T('painting_navire.png'), 1.0, (-3.0, Y1 - 0.05, 3.75), rot=0, frame='#b8862a', frame_w=0.06)
    # chandeliers de part et d'autre de l'estrade
    for sx in (-1, 1):
        cz.prop('hall_candle', f'tr_candle{sx}', (sx * 1.45, TY - 0.35, 0), height=1.3, light=True, power=60 if soir else 25)
    # vases bleu et blanc sur hauts guéridons, entre les fenêtres
    for k, y in enumerate((-0.4, 2.3)):
        cz.prop('hall_vase', f'tr_vase{k}', (X0 + 0.55, y, 0), kind='baluster', h=0.75, glaze='bw', stand='tall')
    # plantes en pots dans les coins du fond
    cz.prop('potted_plant', 'tr_plantR', (4.35, Y1 - 0.6, 0), size=1.5, pot='#b8862a')
    cz.prop('potted_plant', 'tr_plantL', (-4.35, Y1 - 0.6, 0), size=1.5, pot='#b8862a')
    # banquettes de velours rouge sous le mur des armoiries
    vel = cz.toon('tr_velm', '#9c1424', sheen=0.35)
    for k, y in enumerate((-1.6, 1.6)):
        cz.box(f'tr_bench{k}_seat', (0.5, 1.7, 0.14), (X1 - 0.45, y, 0.42), vel, bevel=0.04, ol=0.005)
        for sy in (-1, 1):
            for sx in (-1, 1):
                cz.cyl(f'tr_bench{k}_leg{sy}{sx}', 0.03, 0.36, (X1 - 0.45 + sx * 0.19, y + sy * 0.75, 0), gold, r2=0.02, ol=0.003, verts=10)
    # caissons dorés au plafond
    for x in (-3.0, -1.0, 1.0, 3.0):
        cz.box(f'tr_ceilbeam_x{x}', (0.12, Y1 - sets.Y0, 0.08), (x, (sets.Y0 + Y1) / 2, H - 0.04), gold, bevel=0.01, ol=0.003)
    for y in (-1.5, 0.6, 2.7):
        cz.box(f'tr_ceilbeam_y{y}', (X1 - X0, 0.12, 0.08), (0, y, H - 0.04), gold, bevel=0.01, ol=0.003)
    # premier plan pour la profondeur des plans larges : un vase sur guéridon près de la caméra
    cz.prop('hall_vase', 'tr_vase_fg', (1.55, -2.75, 0), kind='meiping', h=0.6, glaze='rose', stand='tall')
