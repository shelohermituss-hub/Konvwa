# Planche contact : toutes les images PNG d'un dossier en une grille (pour regarder un tour de test d'un coup d'œil).
#   python planche.py <dossier> <sortie.jpg> [colonnes]
import os
import sys

from PIL import Image, ImageDraw

d, out = sys.argv[1], sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 6
fs = sorted(f for f in os.listdir(d) if f.lower().endswith('.png'))
if not fs:
    sys.exit('aucune image')
ims = [Image.open(os.path.join(d, f)).convert('RGB') for f in fs]
w = 360
h = round(ims[0].height * w / ims[0].width)
cols = min(cols, len(ims))
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (cols * w, rows * (h + 28)), (20, 20, 24))
dr = ImageDraw.Draw(sheet)
for i, (f, im) in enumerate(zip(fs, ims)):
    x, y = (i % cols) * w, (i // cols) * (h + 28)
    sheet.paste(im.resize((w, h)), (x, y + 28))
    dr.text((x + 8, y + 6), f, fill=(255, 210, 63))
sheet.save(out, quality=88)
print(out)
