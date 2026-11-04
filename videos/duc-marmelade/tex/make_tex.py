# Les images du film (Pillow) : sols, murs, plaques, écus, cartes, gazette, panneaux. Lancé une fois, les PNG sont
# commités (le PC n'a pas les mêmes polices). usage : python tex/make_tex.py [nom ...]
import math
import os
import random
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SERIF = '/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf'
HEAVY = os.path.join(HERE, '..', '..', '_creatorize', 'blender', 'assets', 'fonts', 'cz-latin.ttf')
SERIF_IT = '/usr/share/fonts/truetype/liberation/LiberationSerif-BoldItalic.ttf'


def F(path, size):
    return ImageFont.truetype(path if os.path.exists(path) else SERIF, size)


def save(img, name):
    img.save(os.path.join(HERE, name))
    print('tex', name, img.size)


def hexc(h, a=255):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (a,)


def mottle(img, amount=18, blobs=260, seed=1, r=(20, 90)):
    """Taches douces de peinture (variation de valeur), dessinées en RGBA sur l'image RGB."""
    rnd = random.Random(seed)
    w, h = img.size
    lay = Image.new('RGBA', img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    for _ in range(blobs):
        x, y, rr = rnd.uniform(0, w), rnd.uniform(0, h), rnd.uniform(*r)
        v = rnd.choice((0, 255))
        d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=(v, v, v, rnd.randint(4, amount)))
    lay = lay.filter(ImageFilter.GaussianBlur(14))
    return Image.alpha_composite(img.convert('RGBA'), lay).convert('RGB')


def text_center(d, xy, s, font, fill, stroke=0, sfill=None, spacing=0):
    d.text(xy, s, font=font, fill=fill, anchor='mm', stroke_width=stroke, stroke_fill=sfill)


# ---------------- TRÔNE
def floor_checker():
    """Damier de marbre crème / rouge sang de bœuf, 4 x 4 carreaux (une répétition = 3 m), veines et usure."""
    N, S = 4, 256
    img = Image.new('RGB', (N * S, N * S))
    d = ImageDraw.Draw(img, 'RGBA')
    rnd = random.Random(7)
    for i in range(N):
        for j in range(N):
            c = hexc('#eadcc0') if (i + j) % 2 == 0 else hexc('#8c2b22')
            d.rectangle([i * S, j * S, (i + 1) * S - 1, (j + 1) * S - 1], fill=c)
            for _ in range(5):   # veines
                x, y = i * S + rnd.uniform(0, S), j * S + rnd.uniform(0, S)
                pts = [(x, y)]
                for _ in range(8):
                    x += rnd.uniform(-30, 30)
                    y += rnd.uniform(-30, 30)
                    pts.append((x, y))
                vc = (255, 255, 255, 40) if (i + j) % 2 else (120, 90, 60, 45)
                d.line(pts, fill=vc, width=2)
    img = mottle(img, 14, 200, 3)
    d = ImageDraw.Draw(img, 'RGBA')
    for k in range(N + 1):   # joints
        d.line([(k * S, 0), (k * S, N * S)], fill=(60, 40, 30, 150), width=3)
        d.line([(0, k * S), (N * S, k * S)], fill=(60, 40, 30, 150), width=3)
    save(img, 'floor_checker.png')


def wall_ochre(name='wall_ochre.png', base='#d9a441', seed=2):
    img = Image.new('RGB', (1024, 1024), hexc(base)[:3])
    img = mottle(img, 22, 320, seed)
    d = ImageDraw.Draw(img, 'RGBA')
    rnd = random.Random(seed)
    for _ in range(6):   # fines fissures
        x, y = rnd.uniform(0, 1024), rnd.uniform(0, 1024)
        pts = [(x, y)]
        for _ in range(10):
            x += rnd.uniform(-14, 14)
            y += rnd.uniform(4, 22)
            pts.append((x, y))
        d.line(pts, fill=(90, 60, 30, 70), width=2)
    save(img, name)


def plaque(text, name, w=1024, h=420):
    """Cartouche doré à volutes avec un texte gravé sombre."""
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([20, 30, w - 20, h - 30], radius=90, fill=hexc('#c99a2e'), outline=hexc('#6a4a10'), width=14)
    d.rounded_rectangle([60, 70, w - 60, h - 70], radius=60, fill=hexc('#e8c25a'), outline=hexc('#8a6418'), width=8)
    for sx in (60, w - 60):
        d.ellipse([sx - 50, h / 2 - 50, sx + 50, h / 2 + 50], fill=hexc('#c99a2e'), outline=hexc('#6a4a10'), width=10)
    text_center(d, (w / 2 + 4, h / 2 + 6), text, F(SERIF, int(h * 0.48)), hexc('#7a5212'))
    text_center(d, (w / 2, h / 2), text, F(SERIF, int(h * 0.48)), hexc('#3a2408'))
    save(img, name)


def phoenix(name='throne_phoenix.png', w=512, h=640):
    """Le panneau du dossier du trône : un phénix couronné qui renaît des flammes, or sur velours rouge."""
    img = Image.new('RGB', (w, h), hexc('#8e1622')[:3])
    img = mottle(img, 16, 120, 5)
    d = ImageDraw.Draw(img)
    g, gd = hexc('#e2b23e'), hexc('#7a5212')
    d.rectangle([14, 14, w - 15, h - 15], outline=g, width=14)
    cx = w / 2
    for k in range(7):   # flammes
        x = cx + (k - 3) * 52
        d.polygon([(x - 34, h - 70), (x, h - 230 - (40 if k % 2 else 0)), (x + 34, h - 70)], fill=hexc('#f08a1c'), outline=gd)
    for sx in (-1, 1):   # ailes déployées
        pts = [(cx, 300)]
        for k in range(6):
            pts.append((cx + sx * (60 + k * 32), 300 - 150 + k * 22 - (k % 2) * 30))
        pts.append((cx + sx * 40, 400))
        d.polygon(pts, fill=g, outline=gd)
    d.ellipse([cx - 55, 250, cx + 55, 430], fill=g, outline=gd, width=4)   # corps
    d.ellipse([cx - 32, 170, cx + 32, 240], fill=g, outline=gd, width=4)   # tête
    d.polygon([(cx + 28, 200), (cx + 60, 210), (cx + 28, 218)], fill=hexc('#c97a1c'))
    d.polygon([(cx - 30, 170), (cx - 24, 130), (cx - 10, 160), (cx, 120), (cx + 10, 160), (cx + 24, 130), (cx + 30, 170)], fill=g, outline=gd)
    save(img, name)


def crest(name='throne_crest.png', w=512, h=256):
    img = Image.new('RGB', (w, h), hexc('#8e1622')[:3])
    d = ImageDraw.Draw(img)
    g, gd = hexc('#e2b23e'), hexc('#7a5212')
    d.ellipse([w / 2 - 70, 40, w / 2 + 70, 180], fill=g, outline=gd, width=6)
    for k in range(16):
        a = math.pi * 2 * k / 16
        d.line([(w / 2 + 80 * math.cos(a), 110 + 80 * math.sin(a)), (w / 2 + 112 * math.cos(a), 110 + 112 * math.sin(a))], fill=g, width=8)
    save(img, name)


SHIELD_FIELDS = ['#1f3f8f', '#c21f2a', '#2f8a3a', '#e2731c', '#e8c92a', '#1f9aa0', '#6a1e5a', '#f2ead8']


def shield(name, field, charge, gold='#e2b23e', w=256, h=300):
    """Un écu à la française : champ de couleur, bordure d'or, une pièce (étoile, chevron, tour, fruit, lion, soleil)."""
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pts = [(8, 8), (w - 8, 8), (w - 8, h * 0.58)] + [(w / 2 + (w / 2 - 8) * math.cos(a), h * 0.58 + (h * 0.4) * math.sin(a))
                                                    for a in [math.pi * k / 20 for k in range(1, 20)]] + [(8, h * 0.58)]
    d.polygon(pts, fill=hexc(gold), outline=hexc('#5a3c0c'))
    inner = [(x * 0.86 + w * 0.07, y * 0.86 + h * 0.06) for x, y in pts]
    d.polygon(inner, fill=hexc(field))
    g = hexc(gold) if field not in ('#e8c92a', '#f2ead8', '#e2731c') else hexc('#1a1410')
    cx, cy = w / 2, h * 0.46
    if charge == 'star':
        star = []
        for k in range(10):
            r = 60 if k % 2 == 0 else 26
            a = -math.pi / 2 + math.pi * k / 5
            star.append((cx + r * math.cos(a), cy + r * math.sin(a)))
        d.polygon(star, fill=g)
    elif charge == 'chevron':
        d.polygon([(cx - 90, cy + 50), (cx, cy - 40), (cx + 90, cy + 50), (cx + 60, cy + 50), (cx, cy - 2), (cx - 60, cy + 50)], fill=g)
    elif charge == 'tower':
        d.rectangle([cx - 40, cy - 40, cx + 40, cy + 60], fill=g)
        for k in range(3):
            d.rectangle([cx - 40 + k * 32, cy - 62, cx - 24 + k * 32, cy - 40], fill=g)
        d.rectangle([cx - 12, cy + 20, cx + 12, cy + 60], fill=hexc(field))
    elif charge == 'sun':
        d.ellipse([cx - 34, cy - 34, cx + 34, cy + 34], fill=g)
        for k in range(12):
            a = math.pi * 2 * k / 12
            d.line([(cx + 44 * math.cos(a), cy + 44 * math.sin(a)), (cx + 72 * math.cos(a), cy + 72 * math.sin(a))], fill=g, width=10)
    elif charge == 'orange':   # les armes de MARMELADE : trois oranges
        for ox, oy in ((-46, -30), (46, -30), (0, 44)):
            d.ellipse([cx + ox - 34, cy + oy - 34, cx + ox + 34, cy + oy + 34], fill=hexc('#f08a1c'), outline=hexc('#7a3a08'), width=5)
            d.ellipse([cx + ox - 8, cy + oy - 44, cx + ox + 14, cy + oy - 28], fill=hexc('#2f8a3a'))
    elif charge == 'lemon':
        for ox, oy in ((-46, -30), (46, -30), (0, 44)):
            d.ellipse([cx + ox - 38, cy + oy - 26, cx + ox + 38, cy + oy + 26], fill=hexc('#f4dc3a'), outline=hexc('#6a5a08'), width=5)
    elif charge == 'cross':
        d.rectangle([cx - 14, cy - 70, cx + 14, cy + 70], fill=g)
        d.rectangle([cx - 70, cy - 14, cx + 70, cy + 14], fill=g)
    else:   # bande
        d.polygon([(30, 40), (70, 30), (w - 30, h * 0.75), (w - 70, h * 0.8)], fill=g)
    save(img, name)


def shields():
    charges = ['star', 'chevron', 'tower', 'sun', 'cross', 'band']
    for i in range(12):
        shield(f'shield_{i:02d}.png', SHIELD_FIELDS[i % len(SHIELD_FIELDS)] if SHIELD_FIELDS[i % len(SHIELD_FIELDS)] not in ('#e2731c',) else '#1f3f8f',
               charges[i % len(charges)])
    shield('shield_marmelade.png', '#1f3f8f', 'orange')
    shield('shield_limonade.png', '#2f8a3a', 'lemon')


def label(text, name, w=512, h=160, color='#e2b23e', ink='#3a2408'):
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    f = F(SERIF, int(h * 0.62))
    while d.textlength(text, font=f) > w - 20:
        f = F(SERIF, f.size - 4)
    text_center(d, (w / 2, h / 2), text, f, hexc(color), stroke=int(h * 0.05), sfill=hexc(ink))
    save(img, name)


def ribbon(text, name, w=1024, h=220):
    """Banderole de devise : ruban crème à bouts fourchus, lettres rouges."""
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    c, o = hexc('#f2e6c4'), hexc('#6a4a20')
    for sx in (0, 1):   # bouts
        x0 = 0 if sx == 0 else w - 170
        pts = [(x0, 60), (x0 + 170, 60), (x0 + 170, h - 20), (x0, h - 20), (x0 + 50, h / 2 + 20)] if sx == 0 else \
              [(x0, 60), (x0 + 170, 60), (x0 + 120, h / 2 + 20), (x0 + 170, h - 20), (x0, h - 20)]
        d.polygon(pts, fill=hexc('#d8c8a0'), outline=o)
    d.rectangle([110, 30, w - 110, h - 50], fill=c, outline=o, width=6)
    f = F(SERIF, 92)
    while d.textlength(text, font=f) > w - 280:
        f = F(SERIF, f.size - 4)
    text_center(d, (w / 2, h / 2 - 10), text, f, hexc('#9c1424'))
    save(img, name)


def scroll(lines, name, w=640, h=820):
    """Un parchemin déroulé (lettres patentes) avec des lignes de titre."""
    img = Image.new('RGB', (w, h), hexc('#efdfb4')[:3])
    img = mottle(img, 26, 160, 11)
    d = ImageDraw.Draw(img, 'RGBA')
    d.rectangle([0, 0, w - 1, 46], fill=(170, 130, 70, 255))
    d.rectangle([0, h - 47, w - 1, h - 1], fill=(170, 130, 70, 255))
    y = 140
    for txt, size, col in lines:
        f = F(SERIF, size)
        while d.textlength(txt, font=f) > w - 80:
            f = F(SERIF, f.size - 2)
        text_center(d, (w / 2, y), txt, f, hexc(col))
        y += size * 1.35
    for k in range(5):   # lignes d'écriture
        yy = y + 30 + k * 46
        if yy < h - 120:
            d.line([(70, yy), (w - 70 - (k * 37) % 120, yy)], fill=(90, 60, 30, 120), width=5)
    d.ellipse([w / 2 - 50, h - 170, w / 2 + 50, h - 70], fill=(170, 30, 30, 255), outline=(100, 10, 10, 255), width=5)   # sceau
    save(img, name)


def map_nord(name='map_nord.png', w=1600, h=1100):
    """Carte du Nord d'Haïti, dessinée à la main sur parchemin : la côte, les montagnes, les villes et leurs noms."""
    img = Image.new('RGB', (w, h), hexc('#ecdcae')[:3])
    img = mottle(img, 24, 220, 13)
    d = ImageDraw.Draw(img, 'RGBA')
    sea = [(0, 0), (w, 0), (w, 230), (1380, 250), (1250, 300), (1120, 270), (980, 330), (900, 300), (820, 250), (700, 280),
           (560, 230), (420, 260), (300, 210), (150, 240), (0, 200)]
    d.polygon(sea, fill=(110, 170, 190, 255))
    d.line(sea[2:] + [sea[-1]], fill=(60, 80, 90, 255), width=8)
    for k in range(18):   # vagues
        x, y = 80 + k * 85, 60 + (k % 3) * 45
        d.arc([x, y, x + 50, y + 26], 200, 340, fill=(240, 250, 255, 200), width=5)
    rnd = random.Random(4)
    for _ in range(26):   # montagnes
        x, y = rnd.uniform(150, 1500), rnd.uniform(560, 1000)
        s = rnd.uniform(40, 80)
        d.polygon([(x - s, y), (x, y - s * 1.1), (x + s, y)], fill=(150, 120, 80, 200), outline=(90, 60, 30, 255))
    towns = [('CAP-HENRY', 900, 360, True), ('LIMONADE', 1180, 420, False), ('MILOT', 930, 560, False), ('PLAISANCE', 470, 640, False),
             ('LIMBÉ', 620, 470, False), ('MARMELADE', 560, 900, False), ('GRANDE-RIVIÈRE', 1260, 700, False), ('PORT-DE-PAIX', 200, 330, False)]
    for t, x, y, big in towns:
        r = 22 if big else 15
        d.ellipse([x - r, y - r, x + r, y + r], fill=(160, 30, 30, 255), outline=(60, 10, 10, 255), width=4)
        f = F(SERIF, 58 if big else 50)
        d.text((x, y + r + 8), t, font=f, fill=(50, 30, 15, 255), anchor='mt', stroke_width=5, stroke_fill=(236, 220, 174, 255))
    d.text((w - 60, h - 50), 'ROYAUME D\'HAÏTI - LE NORD', font=F(SERIF_IT, 46), fill=(90, 60, 30, 255), anchor='rs')
    d.rectangle([10, 10, w - 11, h - 11], outline=(90, 60, 30, 255), width=12)
    save(img, name)


def gazette(name='gazette.png', w=900, h=1200):
    """La gazette de Paris : manchette « UN DUC DE LA MARMELADE ! », colonnes, une gravure."""
    img = Image.new('RGB', (w, h), hexc('#ece4d0')[:3])
    img = mottle(img, 18, 120, 21)
    d = ImageDraw.Draw(img, 'RGBA')
    text_center(d, (w / 2, 90), 'LA GAZETTE', F(SERIF, 110), (30, 26, 22, 255))
    d.line([(40, 160), (w - 40, 160)], fill=(30, 26, 22, 255), width=6)
    text_center(d, (w / 2, 190), 'PARIS - 1811', F(SERIF, 34), (30, 26, 22, 255))
    d.line([(40, 220), (w - 40, 220)], fill=(30, 26, 22, 255), width=3)
    f = F(HEAVY, 120)
    for k, line in enumerate(('UN DUC DE LA', 'MARMELADE !')):
        ff = f
        while d.textlength(line, font=ff) > w - 80:
            ff = F(HEAVY, ff.size - 4)
        text_center(d, (w / 2, 320 + k * 140), line, ff, (20, 16, 14, 255))
    d.rectangle([60, 520, 440, 820], outline=(30, 26, 22, 255), width=5)   # gravure : un pot de confiture
    d.ellipse([170, 600, 330, 780], fill=(225, 120, 30, 255), outline=(30, 26, 22, 255), width=5)
    d.rectangle([190, 560, 310, 610], fill=(200, 190, 170, 255), outline=(30, 26, 22, 255), width=5)
    for col in (0, 1):
        for k in range(18 if col else 7):
            x0 = 470 if col else 60
            y = (540 if col else 850) + k * 34
            if y < h - 40:
                d.line([(x0, y), (x0 + (380 if col else 380) - (k * 29) % 70, y)], fill=(60, 56, 50, 200), width=9)
    save(img, name)


def map_france(name='map_france.png', w=1100, h=1100):
    """Carte de France encadrée (silhouette simplifiée), villes : Paris, Orléans, Bouillon, Bordeaux, Lyon, Marseille."""
    img = Image.new('RGB', (w, h), hexc('#e6d6a8')[:3])
    img = mottle(img, 22, 200, 31)
    d = ImageDraw.Draw(img, 'RGBA')
    fr = [(470, 90), (600, 120), (760, 150), (830, 230), (900, 330), (860, 460), (900, 560), (880, 700), (930, 820), (800, 900),
          (640, 960), (560, 1000), (420, 980), (300, 960), (260, 840), (300, 700), (220, 560), (120, 470), (90, 400), (230, 380),
          (330, 330), (360, 220)]
    d.polygon(fr, fill=(196, 214, 160, 255), outline=(80, 70, 40, 255))
    d.line(fr + [fr[0]], fill=(80, 70, 40, 255), width=8)
    towns = [('PARIS', 560, 330), ('ORLÉANS', 520, 470), ('BOUILLON', 760, 230), ('BORDEAUX', 330, 760), ('LYON', 740, 650), ('MARSEILLE', 760, 900)]
    for t, x, y in towns:
        big = t in ('ORLÉANS', 'BOUILLON')
        r = 20 if big else 13
        d.ellipse([x - r, y - r, x + r, y + r], fill=(160, 30, 30, 255), outline=(60, 10, 10, 255), width=4)
        f = F(SERIF, 64 if big else 44)
        d.text((x, y + r + 6), t, font=f, fill=(40, 30, 20, 255), anchor='mt', stroke_width=5, stroke_fill=(230, 216, 170, 255))
    d.rectangle([10, 10, w - 11, h - 11], outline=(80, 60, 30, 255), width=12)
    save(img, name)


def sign(text, name, w=1024, h=300, bg='#2a5a3a', ink='#f2e6c4', font=None):
    img = Image.new('RGB', (w, h), hexc(bg)[:3])
    img = mottle(img, 20, 80, 41)
    d = ImageDraw.Draw(img, 'RGBA')
    d.rectangle([12, 12, w - 13, h - 13], outline=hexc(ink), width=10)
    f = F(font or HEAVY, int(h * 0.55))
    while d.textlength(text, font=f) > w - 90:
        f = F(font or HEAVY, f.size - 4)
    text_center(d, (w / 2, h / 2), text, f, hexc(ink))
    save(img, name)


def painting(name, kind, w=900, h=640):
    """Un tableau peint : 'citadelle' (la forteresse sur sa montagne, ciel d'or) ou 'navire' (un trois-mâts sur la mer)."""
    img = Image.new('RGB', (w, h))
    d = ImageDraw.Draw(img, 'RGBA')
    for y in range(h):   # ciel en dégradé
        k = y / h
        c = (int(250 - 60 * k), int(200 - 30 * k), int(120 + 60 * k)) if kind == 'citadelle' else (int(150 + 60 * k), int(200 + 30 * k), int(230))
        d.line([(0, y), (w, y)], fill=c)
    if kind == 'citadelle':
        d.polygon([(0, h), (0, 470), (180, 380), (380, 250), (520, 300), (700, 420), (w, 400), (w, h)], fill=(70, 120, 70, 255))
        d.polygon([(330, 262), (520, 250), (560, 215), (330, 200)], fill=(120, 110, 100, 255), outline=(50, 40, 30, 255))
        d.polygon([(560, 215), (610, 240), (520, 252)], fill=(100, 92, 84, 255), outline=(50, 40, 30, 255))
        for k in range(5):
            d.rectangle([350 + k * 34, 190, 366 + k * 34, 200], fill=(120, 110, 100, 255))
        d.polygon([(0, h), (0, 560), (300, 520), (600, 560), (w, 530), (w, h)], fill=(50, 95, 60, 255))
    else:
        d.rectangle([0, 420, w, h], fill=(40, 100, 140, 255))
        for k in range(14):
            x = (k * 83) % w
            d.arc([x, 440 + (k % 4) * 40, x + 70, 470 + (k % 4) * 40], 200, 340, fill=(220, 240, 250, 200), width=4)
        d.polygon([(250, 420), (650, 420), (600, 470), (300, 470)], fill=(90, 50, 30, 255))
        for mx, mh in ((340, 300), (450, 340), (560, 280)):
            d.line([(mx, 420), (mx, 420 - mh)], fill=(60, 40, 25, 255), width=8)
            d.polygon([(mx - 70, 420 - mh + 30), (mx + 70, 420 - mh + 30), (mx + 60, 400), (mx - 60, 400)], fill=(240, 232, 210, 255))
        d.rectangle([440, 100, 470, 120], fill=(200, 30, 40, 255))
    img = mottle(img, 16, 120, 51)
    save(img, name)


def all_throne():
    painting('painting_citadelle.png', 'citadelle')
    painting('painting_navire.png', 'navire')
    floor_checker()
    wall_ochre()
    wall_ochre('wall_ochre_dark.png', '#b9812f', 6)
    plaque('1811', 'plaque_1811.png')
    phoenix()
    crest()
    shields()
    for t, n in (('4 PRINCES', 'lbl_princes'), ('8 DUCS', 'lbl_ducs'), ('22 COMTES', 'lbl_comtes'), ('37 BARONS', 'lbl_barons')):
        label(t, n + '.png')
    ribbon('PAR LE ROI', 'ribbon_devise.png')
    scroll([('LETTRES PATENTES', 46, '#3a2408'), ('DUC DE LA', 64, '#9c1424'), ('MARMELADE', 82, '#9c1424')], 'scroll_titre.png')
    map_nord()
    for t, n in (('PLAISANCE', 'tag_plaisance'), ('LIMBÉ', 'tag_limbe'), ('LIMONADE', 'tag_limonade'), ('MARMELADE', 'tag_marmelade')):
        label(t, n + '.png', 640, 150, '#f2e6c4', '#3a2408')


def all_salon():
    gazette()
    map_france()
    wall_ochre('wall_salon.png', '#8f86b8', 9)
    sign('GODZY', 'sign_godzy.png', 1024, 260, '#6a1e2a', '#f2d68a')


def all_out():
    sign('MARMELADE', 'sign_marmelade.png', 1024, 260, '#5a3a20', '#f2e6c4', SERIF)
    sign('GODZY', 'crate_godzy.png', 1024, 340, '#b88a4a', '#3a2010')
    label('900 m', 'lbl_900.png', 512, 200, '#f2e6c4', '#3a2408')


if __name__ == '__main__':
    todo = sys.argv[1:] or ['throne', 'salon', 'out']
    for t in todo:
        {'throne': all_throne, 'salon': all_salon, 'out': all_out}[t]()
