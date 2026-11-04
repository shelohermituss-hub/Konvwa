# La mise en scène commune du salon (s05, s06) : RIEUR et GAZETIER debout avec la gazette, BOUILLON dans son fauteuil
# avec son bol de bouillon fumant. Chaque séquence ajoute son jeu par-dessus.
import math

import bpy

import cast
import common
import cz
import sets

RIEUR = (-0.55, 0.75, 12)
GAZ = (-1.35, 1.05, 28)


def stage():
    R = cast.rieur()
    G = cast.gazetier()
    B = cast.bouillon()
    R.place(-1, RIEUR[0], RIEUR[1], RIEUR[2])
    G.place(-1, GAZ[0], GAZ[1], GAZ[2])
    for c in (R, G):
        c.face(-1, 'neutral')
    R.set(-1, dur=0.01, hyaw=10, hroll=4, hR=(-0.15, -0.3, R.ht * 0.42), hL=(0.15, -0.3, R.ht * 0.42))
    G.set(-1, dur=0.01, hyaw=-14, hroll=-4, twist=-12)
    gz = cz.empty('sa_gazette', (0, 0, -50))
    cz.plane('sa_gazette_p', 0.36, 0.48, (0, 0, 0), cz.toon('sa_gazettem', img=common.T('gazette.png'), lift=0.7, tex='paper'), parent=gz)
    R.hold(gz, 'R', -1, 99, offset=(0.15, -0.04, 0.02), aim=(-0.4, -3.0, 0.7))
    # BOUILLON assis, le bol de bouillon sur les genoux
    ax, ay = sets.ARMCHAIR
    a = math.radians(sets.ARM_YAW)
    B.place(-1, ax - 0.05 * math.sin(a), ay + 0.05 * math.cos(a), sets.ARM_YAW)
    bpy.context.view_layer.update()
    B.sit(-1, 0.4, dur=0.01)
    B.face(-1, 'smug')
    B.set(-1, dur=0.01, hyaw=-14, hroll=-4, hL=(0.08, -0.3, B.ht * 0.42), hR=(-0.1, -0.3, B.ht * 0.48))
    bowl = cz.empty('sa_bowl', (0, 0, -50))
    cz.cyl('sa_bowl_cup', 0.09, 0.07, (0, 0, -0.04), cz.toon('sa_porcelainm', '#f4f0e8'), r2=0.12, ol=0.004, verts=24, parent=bowl)
    cz.cyl('sa_bowl_soup', 0.112, 0.004, (0, 0, 0.025), cz.toon('sa_soupm', '#c88a3a'), ol=0.0, verts=24, parent=bowl)
    st = cz.prop('out_smoke', 'sa_bowl_steam', (0, 0, 0.03), parent=bowl, height=0.2, n=4, r0=0.01, drift=0.02, col='#ffffff', col2='#e8e8f0')
    B.hold(bowl, 'L', -1, 99, offset=(-0.08, -0.04, 0.06))
    for o in bpy.data.objects:
        if o.name.startswith('sa_bowl_steam'):
            o['cz_contact_ok'] = 1
    return R, G, B, gz, bowl
