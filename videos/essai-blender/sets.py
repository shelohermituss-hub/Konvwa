# Les décors : une fonction par décor (mise en place + lumière), l'habillage dans dress_<décor>.py.
# Règles : quatre murs, de vrais trous derrière portes et fenêtres, une lumière principale qui a une FORME,
# un fill de couleur complémentaire, des contres, des sources visibles qui éclairent vraiment.
import cz
from common import wall_y, wall_x, dress

PIECE = (0.0, 0.8)   # le centre de la pièce


def piece(moment='jour'):
    W, D, H = 7.0, 6.0, 3.0
    sol = cz.toon('p_solm', '#8a5630', pattern=('planks', 1.2, 0.16, '#4a2c18'), tex='wood', tex_scale=2, tex_strength=0.1)
    mur = cz.toon('p_murm', '#8fb0a8', tex='grain')
    cz.box('p_sol', (W, D, 0.1), (0, 0.8, -0.05), sol, bevel=0, ol=0)
    wall_y('p_fond', 2.8, -W / 2, W / 2, H, mur, holes=[(-2.2, -0.9, 0.9, 2.3)])   # une vraie fenêtre : le soleil entre
    wall_x('p_gauche', -W / 2, -2.2, 2.8, H, mur)
    wall_x('p_droite', W / 2, -2.2, 2.8, H, mur, holes=[(0.6, 1.6, 0.0, 2.2)])      # une porte
    cz.box('p_plafond', (W, D, 0.1), (0, 0.8, H + 0.05), cz.toon('p_plafm', '#e8e2d4', tex='grain'), bevel=0, ol=0)
    # dehors, derrière la fenêtre : un ciel lumineux (non éclairé, ne fait pas d'ombre : son nom contient 'sky')
    cz.plane('p_sky', 6, 4, (-1.5, 4.5, 1.8), cz.glow('p_skym', '#bfe0ff', 1.1))
    cz.box('p_plinthe', (W, 0.04, 0.12), (0, 2.73, 0.06), cz.toon('p_plm', '#5a4636'), bevel=0.005, ol=0.003)
    cz.prop('office_desk', 'p_bureau', (0.6, 1.4, 0), rot=0)
    cz.prop('office_chair', 'p_chaise', (0.42, 0.9, 0), rot=0)
    cz.prop('potted_plant', 'p_plante', (-2.6, 2.2, 0))
    cz.prop('wall_clock', 'p_horloge', (0.4, 2.74, 2.3))
    # la lumière : soleil par la fenêtre (une tache au sol), fill bleuté, contre
    cz.light('p_soleil', 'SUN', (-1.5, 6.0, 4.0), color='#ffe2b0', power=4.5, size=2, target=(-0.8, 0.6, 0.0))
    cz.light('p_fill', 'AREA', (1.5, -3.5, 2.8), color='#b8d0ff', power=380, size=4, target=(0, 1.0, 1.0))
    cz.light('p_contre', 'AREA', (2.4, 2.4, 2.8), color='#ffe8d0', power=260, size=2, target=(0, 0.8, 1.0))
    dress('dress_piece', moment=moment)
    cz.no_shadow()
