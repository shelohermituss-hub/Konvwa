# La distribution du « Duc de la Marmelade » : une fonction par personnage (char.Char), dessins originaux.
# Une couleur forte par personnage, un détail de costume lisible sur un téléphone (règle du moteur, catalog.md §5).
#   HENRI (le roi Henri Ier)      manteau bleu roi, épaulettes d'or, écharpe rouge, boutons d'or, couronne
#   MARMELADE (le duc)            habit orange marmelade, gilet crème, chaîne d'or et médaille, bicorne à cocarde orange
#   LIMONADE (le comte)           habit jaune citron, écharpe verte, lunettes rondes, plume à la main (secrétaire d'État)
#   PLAISANCE, LIMBE (nobles)     habits vert prairie / turquoise, chaîne d'or
#   RIEUR, GAZETIER (Europe)      redingote lilas + haut-de-forme + monocle ; redingote grise + casquette
#   BOUILLON (le duc français)    habit prune, col d'hermine, perruque poudrée, gros ventre
#   OUVRIERS (la Citadelle)       chemises rouge / bleu / paille, chapeaux de paille
# Les têtes : SKIN (le teint) est réglé ici pour tout le film (essai blanc du style / brun : renders/test/lineup*).
import math
import os

import bmesh
from mathutils import Matrix, Vector

import char as ch
import cz

SKIN_HT = os.environ.get('KV_SKIN', '#f4f3ef')      # teint des Haïtiens (KV_SKIN=#ffffff : la tête blanche du style)
SKIN_EU = os.environ.get('KV_SKIN_EU', '#f4f3ef')   # teint des Européens
GOLD = '#d9a72e'


# ---------------- aides (sur la surface VISIBLE du torse : le torse porte sa profondeur en échelle d'objet)
def _chest(c, x, z, lift=0.006):
    rt, h = c.rt, c.ht
    r = rt if z <= h - rt else math.sqrt(max(0.0, rt * rt - (z - (h - rt)) ** 2))
    r = max(r, 1e-4)
    k = max(0.0, 1 - (x / r) ** 2)
    sy = 0.8 * c.belly
    y = -r * math.sqrt(k) - lift / sy
    ang = math.degrees(math.asin(max(-1.0, min(1.0, x / r)))) * 0.85
    return (x, y, z), ang


def tube(name, pts, r0, r1, mat, parent, ol=0.004, n=20, ring=12):
    """Un tube effilé le long d'une courbe de Bézier cubique (écharpes, chaînes, cordons)."""
    P = [Vector(p) for p in pts]

    def at(t):
        a = [P[0].lerp(P[1], t), P[1].lerp(P[2], t), P[2].lerp(P[3], t)]
        b = [a[0].lerp(a[1], t), a[1].lerp(a[2], t)]
        return b[0].lerp(b[1], t)
    bm = bmesh.new()
    rings = []
    for i in range(n + 1):
        t = i / n
        c = at(t)
        tg = (at(min(1, t + 1e-3)) - at(max(0, t - 1e-3))).normalized()
        up = Vector((0, 0, 1)) if abs(tg.z) < 0.9 else Vector((1, 0, 0))
        u = tg.cross(up).normalized()
        v = tg.cross(u).normalized()
        r = r0 + (r1 - r0) * t
        rings.append([bm.verts.new(c + (u * math.cos(2 * math.pi * k / ring) + v * math.sin(2 * math.pi * k / ring)) * r) for k in range(ring)])
    for i in range(n):
        for k in range(ring):
            bm.faces.new((rings[i][k], rings[i][(k + 1) % ring], rings[i + 1][(k + 1) % ring], rings[i + 1][k]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = cz._mesh_obj(name, bm, mat)
    cz.place(o, (0, 0, 0), parent=parent)
    if ol:
        cz.outline(o, ol)
    return o


def _flat(o, sx, sy, sz):
    o.data.transform(Matrix.Diagonal((sx, sy, sz, 1)))
    return o


# ---------------- costumes
def coat(trim=GOLD, buttons=5, lapel=None, vest=None):
    """Un habit : revers (couleur lapel), gilet (vest) entre les revers, boutons d'or sur la poitrine, col montant."""
    def build(c):
        ht, rt = c.ht, c.rt
        if vest:
            loc, _ = _chest(c, 0, ht * 0.6, 0.004)
            cz.box(c.name + '_vest', (rt * 0.62, 0.01, ht * 0.5), loc, cz.toon(c.name + '_vestm', vest), bevel=0, ol=0.0, parent=c.body)
        for sx in (1, -1):
            loc, ang = _chest(c, sx * rt * 0.32, ht * 0.66, 0.008)
            cz.box(c.name + f'_lapel{sx}', (rt * 0.34, 0.012, ht * 0.46), loc, cz.toon(c.name + '_lapelm', lapel or trim),
                   rot=(0, sx * 18, ang), bevel=0.002, ol=0.002, parent=c.body)
        bm = cz.toon(c.name + '_btnm', trim)
        for i in range(buttons):
            z = ht * (0.62 - i * 0.1)
            for sx in ((1, -1) if vest else (0,)):
                loc, _ = _chest(c, sx * rt * 0.12, z, 0.014)
                cz.sphere(c.name + f'_btn{i}{sx}', 0.014 * c.s, loc, bm, ol=0.002, parent=c.body, segs=12, rings=6)
        # col montant blanc (cravate) sous le menton
        loc, _ = _chest(c, 0, ht * 0.9, 0.01)
        cz.sphere(c.name + '_cravat', 0.05 * c.s, loc, cz.toon('kv_cravatm', '#f4efe2', tex='paper', tex_strength=0.05), ol=0.003, parent=c.body, segs=16, rings=8)
    return build


def epaulettes(color=GOLD, fringe=True):
    def build(c):
        m = cz.toon(c.name + '_epm', color, sheen=0.4)
        for sx in (1, -1):
            o = cz.sphere(c.name + f'_ep{sx}', 0.075 * c.s, (sx * c.rt * 0.86, 0, c.ht * 0.86), m, ol=0.004, parent=c.body, segs=20, rings=10)
            _flat(o, 1.15, 1.25, 0.42)
            if fringe:
                for k in range(5):
                    a = (k - 2) * 0.32
                    cz.cyl(c.name + f'_epf{sx}{k}', 0.007, 0.06, (sx * c.rt * 0.86 + sx * 0.06 * math.cos(a), 0.06 * math.sin(a), c.ht * 0.79), m,
                           ol=0.0, parent=c.body, verts=6)
    return build


def sash(color='#c21f2a'):
    """Écharpe en diagonale (épaule gauche -> hanche droite), sur la surface visible du torse."""
    def build(c):
        ht, rt = c.ht, c.rt
        pts = [_chest(c, rt * 0.62, ht * 0.88, 0.016)[0], _chest(c, rt * 0.25, ht * 0.62, 0.02)[0],
               _chest(c, -rt * 0.2, ht * 0.38, 0.02)[0], _chest(c, -rt * 0.6, ht * 0.18, 0.016)[0]]
        o = tube(c.name + '_sash', pts, 0.026 * c.s, 0.026 * c.s, cz.toon(c.name + '_sashm', color, sheen=0.3), c.body, ol=0.003)
        _flat(o, 1.0, 0.45, 1.0)
    return build


def chain(medal=True):
    """Chaîne d'or en U sur la poitrine, médaille ronde au bout."""
    def build(c):
        ht, rt = c.ht, c.rt
        pts = [_chest(c, rt * 0.55, ht * 0.86, 0.016)[0], _chest(c, rt * 0.4, ht * 0.52, 0.02)[0],
               _chest(c, -rt * 0.4, ht * 0.52, 0.02)[0], _chest(c, -rt * 0.55, ht * 0.86, 0.016)[0]]
        g = cz.toon('kv_goldm', GOLD, sheen=0.5)
        tube(c.name + '_chain', pts, 0.009 * c.s, 0.009 * c.s, g, c.body, ol=0.002)
        if medal:
            loc, ang = _chest(c, 0, ht * 0.5, 0.026)
            o = cz.cyl(c.name + '_medal', 0.04 * c.s, 0.012, loc, g, rot=(90, 0, ang), ol=0.003, parent=c.body, verts=24)
            cz.cyl(c.name + '_medalc', 0.022 * c.s, 0.006, (loc[0], loc[1] - 0.012, loc[2]), cz.toon('kv_rubym', '#c21f2a'),
                   rot=(90, 0, ang), ol=0.0, parent=c.body, verts=16)
    return build


def star(color=GOLD, x=0.45, z=0.7):
    """Une plaque d'ordre (étoile à huit branches) sur le côté gauche de la poitrine."""
    def build(c):
        loc, ang = _chest(c, c.rt * x, c.ht * z, 0.014)
        bm = bmesh.new()
        ctr = bm.verts.new((0, 0, 0))
        ring = []
        for k in range(16):
            r = (0.05 if k % 2 == 0 else 0.022) * c.s
            a = math.pi * 2 * k / 16
            ring.append(bm.verts.new((r * math.cos(a), 0, r * math.sin(a))))
        for k in range(16):
            bm.faces.new((ctr, ring[k], ring[(k + 1) % 16]))
        o = cz._mesh_obj(c.name + '_star', bm, cz.toon('kv_starm', color, sheen=0.5))
        cz.place(o, loc, rot=(0, 0, ang), parent=c.body)
    return build


def crown():
    """Couronne royale : bandeau d'or, huit fleurons, perles, calotte de velours rouge, croix au sommet."""
    def build(c):
        R = c.R
        g = cz.toon('kv_goldm', GOLD, sheen=0.5)
        top = R * 0.78
        band = cz.cyl(c.name + '_crownband', R * 0.66, R * 0.22, (0, 0, top), g, ol=0.004, parent=c.head, verts=40)
        band['cz_contact_ok'] = 1
        cz.sphere(c.name + '_crowncap', R * 0.6, (0, 0, top + R * 0.16), cz.toon('kv_velvetm', '#9c1424', sheen=0.4), ol=0.004, parent=c.head, segs=24, rings=12)
        for k in range(8):
            a = math.pi * 2 * k / 8
            x, y = R * 0.66 * math.cos(a), R * 0.66 * math.sin(a)
            cz.cyl(c.name + f'_crownpt{k}', R * 0.07, R * 0.2, (x, y, top + R * 0.2), g, r2=0.0, ol=0.002, parent=c.head, verts=8)
            cz.sphere(c.name + f'_crownpearl{k}', R * 0.045, (x, y, top + R * 0.42), cz.toon('kv_pearlm', '#f6f0e4'), ol=0.0, parent=c.head, segs=10, rings=6)
            if k % 2 == 0:
                cz.sphere(c.name + f'_crownjewel{k}', R * 0.05, (x * 1.02, y * 1.02, top + R * 0.1),
                          cz.toon('kv_jewel%d' % (k // 2), ['#c21f2a', '#1f6ed4', '#1f9a4a', '#c21f2a'][k // 2], sheen=0.6), ol=0.0, parent=c.head, segs=10, rings=6)
        cz.box(c.name + '_crossv', (R * 0.06, R * 0.06, R * 0.26), (0, 0, top + R * 0.9), g, bevel=0.003, ol=0.002, parent=c.head)
        cz.box(c.name + '_crossh', (R * 0.18, R * 0.06, R * 0.06), (0, 0, top + R * 0.94), g, bevel=0.003, ol=0.002, parent=c.head)
    return build


def bicorne(color='#16120f', cockade='#e2731c'):
    """Bicorne noir galonné d'or porté en travers, cocarde de couleur sur le devant."""
    def build(c):
        R = c.R
        bm = bmesh.new()
        n = 24
        pts = []
        for i in range(n + 1):
            u = -1 + 2 * i / n
            pts.append((u * R * 1.3, R * (0.12 + 0.95 * math.sqrt(max(0.0, 1 - u * u)))))   # une demi-lune
        vs = [bm.verts.new((x, 0, z)) for x, z in pts]
        bs = [bm.verts.new((x, 0, 0.0)) for x, z in pts]
        for i in range(n):
            bm.faces.new((bs[i], bs[i + 1], vs[i + 1], vs[i]))
        o = cz._mesh_obj(c.name + '_bicorne', bm, cz.toon(c.name + '_hatm', color))
        mod = o.modifiers.new('t', 'SOLIDIFY')
        mod.thickness = R * 0.32
        mod.offset = 0.0
        cz.place(o, (0, 0, R * 0.62), parent=c.head)
        cz.outline(o, 0.005)
        o['cz_contact_ok'] = 1
        cz.cyl(c.name + '_cockade', R * 0.2, 0.02, (R * 0.42, -R * 0.2, R * 1.25), cz.toon(c.name + '_cockm', cockade), rot=(90, 0, 0), ol=0.002, parent=c.head, verts=24)
    return build


def tophat(color='#1a1614', band='#7d5aa6'):
    def build(c):
        R = c.R
        m = cz.toon(c.name + '_thm', color)
        cz.cyl(c.name + '_thbrim', R * 0.95, R * 0.06, (0, 0, R * 0.8), m, ol=0.004, parent=c.head, verts=40)
        cz.cyl(c.name + '_thcrown', R * 0.62, R * 0.95, (0, 0, R * 0.82), m, r2=R * 0.68, ol=0.004, parent=c.head, verts=40)
        cz.cyl(c.name + '_thband', R * 0.635, R * 0.16, (0, 0, R * 0.86), cz.toon(c.name + '_thbandm', band), ol=0.0, parent=c.head, verts=40)
    return build


def cap(color='#3b4650'):
    def build(c):
        R = c.R
        m = cz.toon(c.name + '_capm', color)
        o = cz.sphere(c.name + '_capdome', R * 0.86, (0, R * 0.05, R * 0.55), m, ol=0.004, parent=c.head, segs=24, rings=12)
        _flat(o, 1.06, 1.06, 0.55)
        o = cz.cyl(c.name + '_capvisor', R * 0.42, 0.02, (0, -R * 0.82, R * 0.62), m, rot=(-12, 0, 0), ol=0.003, parent=c.head, verts=24)
        _flat(o, 1.0, 0.6, 1.0)
    return build


def strawhat(color='#d8b25a'):
    def build(c):
        R = c.R
        m = cz.toon(c.name + '_strawm', color, tex='paper', tex_strength=0.12)
        cz.cyl(c.name + '_strawbrim', R * 1.35, R * 0.05, (0, 0, R * 0.72), m, ol=0.004, parent=c.head, verts=40)
        cz.cyl(c.name + '_strawcrown', R * 0.66, R * 0.42, (0, 0, R * 0.74), m, r2=R * 0.5, ol=0.004, parent=c.head, verts=32)
        cz.cyl(c.name + '_strawband', R * 0.665, R * 0.1, (0, 0, R * 0.76), cz.toon('kv_bandred', '#a8322a'), ol=0.0, parent=c.head, verts=32)
    return build


def _torus(name, r, t, loc, mat, parent, n=32, m=8):
    """Un anneau (verres de lunettes, monocle) dont l'axe est Y : il fait face à la caméra (-Y)."""
    bm = bmesh.new()
    rows = []
    for i in range(n):
        a = 2 * math.pi * i / n
        rows.append([bm.verts.new(((r + t * math.cos(2 * math.pi * j / m)) * math.cos(a), t * math.sin(2 * math.pi * j / m),
                                   (r + t * math.cos(2 * math.pi * j / m)) * math.sin(a))) for j in range(m)])
    for i in range(n):
        for j in range(m):
            bm.faces.new((rows[i][j], rows[(i + 1) % n][j], rows[(i + 1) % n][(j + 1) % m], rows[i][(j + 1) % m]))
    o = cz._mesh_obj(name, bm, mat)
    cz.place(o, loc, parent=parent)
    o['cz_contact_ok'] = 1
    return o


def spectacles(color='#2a1a10', r=0.07):
    """Lunettes rondes en anneaux OUVERTS (des disques pleins se lisent comme des lunettes de soleil), devant le visage."""
    def build(c):
        R = c.R
        m = cz.toon('kv_specm', color, 0.8)
        for sx in (1, -1):
            _torus(c.name + f'_lens{sx}', r * c.s, 0.007 * c.s, (sx * R * 0.3, -R * 1.02, R * 0.04), m, c.head)
        cz.box(c.name + '_bridge', (R * 0.16, 0.008, 0.01), (0, -R * 1.06, R * 0.07), m, bevel=0, ol=0, parent=c.head)
    return build


def monocle():
    def build(c):
        R = c.R
        m = cz.toon('kv_monoclem', GOLD, 0.8)
        _torus(c.name + '_monocle', 0.062 * c.s, 0.007 * c.s, (-R * 0.3, -R * 1.02, R * 0.04), m, c.head)
        tube(c.name + '_monocord', [(-R * 0.36, -R * 1.04, -R * 0.02), (-R * 0.6, -R * 0.95, -R * 0.4), (-R * 0.7, -R * 0.7, -R * 0.8), (-R * 0.6, -R * 0.5, -R * 1.2)],
             0.004, 0.004, m, c.head, ol=0.0, n=12, ring=6)
    return build


def ermine():
    """Col d'hermine (blanc à mouchetures noires) autour du cou."""
    def build(c):
        ht = c.ht
        o = cz.cyl(c.name + '_ermine', c.rt * 1.02, 0.07, (0, 0, ht * 0.84), cz.toon(c.name + '_erminem', '#f6f2ea', pattern=('speckle', 0.05, '#1a1410')),
                   ol=0.004, parent=c.body, verts=32)
        o['cz_contact_ok'] = 1
    return build


def wig(color='#ece8e0'):
    """Perruque poudrée : calotte claire + deux rouleaux sur chaque tempe + catogan."""
    def build(c):
        ch.hair_cap(color, front=0.6, sides=-0.1, back=-0.75, thick=0.03, puff=1.08)(c)
        R = c.R
        m = cz.toon(c.name + '_wigm', color)
        for sx in (1, -1):
            for k in range(2):
                cz.cyl(c.name + f'_curl{sx}{k}', R * 0.13, R * 0.42, (sx * R * 0.92, R * 0.1, R * (-0.05 - k * 0.27)), m, rot=(90, 0, 0), ol=0.003, parent=c.head, verts=16)
        cz.sphere(c.name + '_queue', R * 0.16, (0, R * 1.0, -R * 0.35), cz.toon('kv_bowm', '#1a1410'), ol=0.003, parent=c.head, segs=12, rings=8)
    return build


def short_hair(color='#1a1210', front=0.66):
    return ch.hair_cap(color, front=front, sides=0.02, back=-0.7, thick=0.022, puff=1.04)


def hair_afro(color='#14100c', puff=1.3):
    """Coiffure afro : gros nuage de cheveux qui élargit la silhouette."""
    return ch.hair_cap(color, front=0.74, sides=0.1, back=-0.55, thick=0.05, puff=puff)


def hair_bun(color='#14100c'):
    """Cheveux tirés en arrière avec un chignon sur le haut du crâne."""
    return ch.hair_cap(color, front=0.7, sides=0.05, back=-0.7, thick=0.022, puff=1.04, bun=(0.085, 1.16, 0.0))


def hair_spiky(color='#3a2410'):
    """Cheveux en pointes (sept pointes autour de la tête, une mèche dressée)."""
    return ch.hair_cap(color, front=0.7, sides=0.05, back=-0.7, thick=0.03, puff=1.1, spikes=7)


def hair_tuft(color='#7a3a1a'):
    """Cheveux courts avec une mèche qui se dresse sur le front."""
    return ch.hair_cap(color, front=0.66, sides=0.02, back=-0.7, thick=0.022, puff=1.04, bangs=0.18, part=0.2, tuft=(0.1, 18))


def whiskers(color='#3a2a20'):
    """Favoris (côtelettes) le long des joues."""
    def build(c):
        R = c.R
        m = cz.toon(c.name + '_whm', color)
        for sx in (1, -1):
            o = cz.capsule(c.name + f'_wh{sx}', R * 0.1, R * 0.5, (sx * R * 0.93, -R * 0.08, -R * 0.35), m, ol=0.003, parent=c.head)
            o['cz_contact_ok'] = 1
    return build


# ---------------- les personnages
def henri(name='henri'):
    return ch.Char(name, shirt='#1d3f8f', skin=SKIN_HT, torso=(0.172, 0.5), shoe='#14100c',
                   hair=short_hair('#d8d4cc', 0.7),
                   extras=ch.combo(coat(GOLD, 5, lapel='#c21f2a'), epaulettes(), sash('#c21f2a'), star(), crown()),
                   face_style={'brow_w': 1.12})


def marmelade(name='marmelade'):
    return ch.Char(name, shirt='#e2731c', skin=SKIN_HT, torso=(0.18, 0.46), belly=1.22, shoe='#3a2416',
                   hair=hair_tuft('#7a3a1a'),
                   extras=ch.combo(coat(GOLD, 4, lapel='#b84f10', vest='#f3e6c4'), chain(), bicorne('#16120f', '#f08a1c')),
                   face_style={'brow_w': 1.05})


def limonade(name='limonade'):
    return ch.Char(name, shirt='#e8c92a', skin=SKIN_HT, torso=(0.15, 0.5), shoe='#2a1a10',
                   hair=hair_spiky('#3a2410'),
                   extras=ch.combo(coat('#2f8a3a', 4, lapel='#c9a614'), sash('#2f8a3a'), spectacles('#2a1a10', 0.075)),
                   face_style={'brow_w': 1.0})


def noble(name, color, lapel, hair=None):
    return ch.Char(name, shirt=color, skin=SKIN_HT, torso=(0.165, 0.47), shoe='#2a1a10',
                   hair=hair or short_hair('#1a1210', 0.66), extras=ch.combo(coat(GOLD, 4, lapel=lapel), chain(False)),
                   face_style={'brow_w': 1.0})


def plaisance(name='plaisance'):
    return noble(name, '#3f9a4c', '#256b30', hair_afro('#14100c'))


def limbe(name='limbe'):
    return noble(name, '#1f9aa0', '#14686c', hair_bun('#14100c'))


def rieur(name='rieur'):
    return ch.Char(name, shirt='#8a64b8', skin=SKIN_EU, torso=(0.16, 0.48), shoe='#14100c',
                   hair=ch.hair_cap('#6a5a4c', front=0.64, sides=0.0, back=-0.7, thick=0.022),
                   extras=ch.combo(coat('#5c3d86', 3, lapel='#5c3d86', vest='#efe6d2'), tophat('#1a1614', '#5c3d86'), monocle(), whiskers('#5a4a3c')),
                   face_style={'brow_w': 1.0})


def gazetier(name='gazetier'):
    return ch.Char(name, shirt='#5f6f7d', skin=SKIN_EU, torso=(0.16, 0.46), belly=1.1, shoe='#2a1a10',
                   hair=ch.hair_cap('#7a3f20', front=0.62, sides=0.0, back=-0.7, thick=0.022),
                   extras=ch.combo(coat('#3c4852', 3, lapel='#3c4852', vest='#d8cfb8'), cap('#3b4650')),
                   face_style={'brow_w': 1.0})


def bouillon(name='bouillon'):
    return ch.Char(name, shirt='#6a1e5a', skin=SKIN_EU, torso=(0.19, 0.47), belly=1.38, shoe='#14100c',
                   hair=wig('#ece8e0'),
                   extras=ch.combo(coat(GOLD, 4, lapel='#4a1240', vest='#e9d9a8'), ermine(), star('#e8e2d0', 0.5, 0.62)),
                   face_style={'brow_w': 1.1})


def ouvrier(name, shirt, hat='#d8b25a'):
    return ch.Char(name, shirt=shirt, skin=SKIN_HT, torso=(0.16, 0.45), shoe='#5a3a22',
                   hair=short_hair(['#14100c', '#4a2a14', '#7a3a1a', '#2a2a2e'][sum(map(ord, name)) % 4], 0.68), extras=strawhat(hat), face_style={'brow_w': 1.0})
