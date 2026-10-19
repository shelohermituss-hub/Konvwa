# Rush « studio » — montage façon référence J

Le rush du client (`A001_08201215_C003.mp4`, face caméra, créole, voix d'origine conservée) monté avec la grammaire de la référence J (`_engine/references/ref-j-montage`) dans `index.html`.

- **Étalonnage** (fait une fois, dans le fichier) : `ffmpeg -i rush.mp4 -vf "scale=1080:1920,eq=contrast=1.22:saturation=1.08:gamma=0.92,colorbalance=rs=-0.05:bs=0.09:rm=0.07:bm=-0.05:rh=0.10:gh=0.03:bh=-0.08,vignette=PI/4,noise=alls=6:allf=t+u,fps=30" -c:v libx264 -crf 19 -c:a aac assets/clips/rush.mp4`. Insert `neon.mp4` : même rush, `crop=736:414:1100:1000` (néon « WORK hard »).
- **Sous-titres** : tableau `CAPS` dans `index.html`, temps tirés de `npx hyperframes transcribe rush.mp4 -m large-v3 -l ht`. Le texte est un **brouillon** (la reconnaissance du créole est imparfaite) : remplacer les mots, garder les temps.
- **Titre / fin** : « YON STUDIO » (0–2,1 s) et « TOUT BÈL » (dès 10,2 s), dans le même script.
- **Rendu** : `npx --yes hyperframes@0.8.168 render --quality looks --output renders/rush-studio.mp4` (MP4 non commité).
