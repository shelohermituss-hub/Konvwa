# S05 SALON, 33,40-42,50 s (f1003-1275) : « En Europe, on se moque. Un duc de la Marmelade ! Heureusement, la France
# avait elle aussi un duc… de Bouillon. Malheureusement, celui-là, personne ne le trouvait drôle. »
# WS le salon, les deux rieurs sur la gazette -> MCU la gazette + RIEUR hilare -> MS les deux qui pleurent de rire ->
# vol vers le fauteuil : MCU BOUILLON, bol fumant, l'air digne -> MS les rieurs s'arrêtent net.
import os
import sys

F0, F1 = 1003, 1275


def build(ctx):
    cz, cam = ctx.cz, ctx.cam
    here = os.path.dirname(os.path.abspath(__file__))
    sys.path.insert(0, here)
    import salon_cast
    import sets
    W = cz.words()
    at = lambda w, n=1, after=0.0: cz.at(W, w, n, after)['start']
    cz.setup(F1, world='#4a5070', world_strength=0.35)
    sets.salon()
    R, G, B, gz, bowl = salon_cast.stage()
    t_mo = at('moque.')
    for c, d in ((R, 0.0), (G, 0.08)):
        c.face(t_mo - 0.05 + d, 'laugh')
        for k in range(12):                       # secoués de rire
            t = t_mo + d + k * 0.17
            c.set(t, dur=0.08, lean=8 + (k % 2) * 6, bodyz=0.012 * (k % 2))
        c.set(t_mo + d + 12 * 0.17, dur=0.25, lean=4, bodyz=0.0)
    G.pose(t_mo + 0.3, 'rest', dur=0.2, hR=(-0.1, -0.3, G.ht * 0.8))          # il montre la gazette du doigt
    G.pose(at('Marmelade', 1, 35.0) + 0.1, 'rest', dur=0.2, hR=(-0.26, -0.06, G.ht * 0.4), hL=(0.2, -0.1, G.ht * 0.42))
    t_heu = at('Heureusement,')
    G.face(t_heu, 'grin', big=False)
    G.set(t_heu, dur=0.2, hL=(0.04, -0.26, G.ht * 1.28))                  # il s'essuie une larme
    G.set(t_heu + 0.6, dur=0.25, hL=(0.2, -0.02, 0.1))
    R.extra(t_mo + 0.4, t_heu + 1.6, 'tears')
    # BOUILLON : digne, il souffle sur son bouillon ; sur « Bouillon » il nous regarde
    t_bo = at('Bouillon.')
    B.set(t_bo - 0.5, dur=0.25, hL=(0.06, -0.3, B.ht * 0.62))
    B.face(t_bo, 'smug')
    B.set(t_bo, dur=0.25, hyaw=-6, hroll=-6)
    B.blink(t_bo + 0.4)
    # « Malheureusement… » : les rires s'arrêtent net, ils regardent BOUILLON, qui les fusille du regard
    t_mal, t_pers = at('Malheureusement,'), at('personne')
    B.face(t_mal + 0.4, 'annoyed')
    B.set(t_mal + 0.3, dur=0.3, hyaw=-34)
    for c in (R, G):
        c.face(t_mal + 0.2, 'neutral', big=False)
        c.face(t_pers, 'unimpressed')
        c.set(t_mal + 0.2, dur=0.2, lean=0, bodyz=0.0)
        c.look(t_pers + 0.2, 0.8, 0.0)
        c.set(t_pers + 0.2, dur=0.3, hyaw=34 if c is R else 20)
        c.face(at('drôle.') - 0.1, 'worried')
        c.extra(at('drôle.'), at('drôle.') + 1.0, 'sweat')
    for c in (R, G, B):
        c.bake(F0, F1)

    c = cam.Cam(lens=26, fstop=2.6, min_fstop=2.4, bounds=((sets.SX0 + 0.2, sets.SY0 + 0.2, 0.3), (sets.SX1 - 0.2, sets.SY1 - 0.2, sets.SH - 0.2)))
    rh, gh, bh = (R.head, (0, 0, 0)), (G.head, (0, 0, 0)), (B.head, (0, 0, 0))
    mid = ((salon_cast.RIEUR[0] + salon_cast.GAZ[0]) / 2, (salon_cast.RIEUR[1] + salon_cast.GAZ[1]) / 2, 0.9)
    c.frame(33.38, (0.9, -2.5, 1.45), (-1.1, 1.2, 1.0), lens=20, fstop=5.0, focus=rh, fly=0, creep=0.0016)
    c.frame(34.95, (-0.4, -0.55, 1.05), (-0.58, 0.6, 0.95), lens=30, focus=gz, fly=14, creep=0.0019, fstop=2.6)
    c.frame(36.55, (-0.1, -1.6, 1.2), mid, lens=28, focus=rh, fly=14, creep=0.0019)
    c.shot(39.05, bh, 'mcu', yaw=14, rel=B, pitch=6, lens=32, head_y=0.42, focus=bh, fly=22, creep=0.0022)
    c.frame(39.75, (0.0, -1.5, 1.15), mid, lens=28, focus=rh, fly=12, creep=0.0019)
    c.bake(F0, F1)
    return F0, F1
