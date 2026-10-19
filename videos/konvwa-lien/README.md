# « Écrivez LIEN » — montage façon référence J

Composition HyperFrames écrite à la main (`index.html`, hors moteur : le moteur ne gère pas encore les plans filmés ni une voix unique sous-titrée mot par mot). Grammaire de montage copiée de la référence J (`_engine/references/ref-j-montage`, `_engine/docs/REFERENCES.md`) ; contenu propre à KONVWA.

- **Voix** : texte KONVWA, FLORA / Gemini TTS « Puck » (fr-FR), silences coupés → `assets/vo/vo.wav` (12,5 s). Les temps des sous-titres (`CAPS` dans `index.html`) viennent de `npx hyperframes transcribe assets/vo/vo.wav -l fr` + 0,1 s.
- **Plans** : Pixabay vidéos 202987, 9490, 736, 142641, 3176, recadrés en 9:16 et étalonnés une fois pour toutes :
  `ffmpeg -ss <début> -t <durée> -i <src> -an -vf "scale=-2:1920,crop=1080:1920,eq=contrast=1.18:saturation=1.12:gamma=0.95,colorbalance=rs=-0.06:gs=-0.01:bs=0.10:rm=0.06:bm=-0.04:rh=0.10:gh=0.02:bh=-0.10,vignette=PI/4,noise=alls=7:allf=t+u,fps=30" -c:v libx264 -crf 20 -pix_fmt yuv420p assets/clips/<nom>.mp4`
- **Images** : `avant-papiers.jpg`, `demande-devis.png` (capture de l'app), `moncash.jpg`, logo KONVWA — copies de `_engine/library` et `_engine/brands`. Musique : `diaspora-argent/assets/music/bed.mp3`. Sons : `_engine/sfx`.
- **Rendu** : `npx --yes hyperframes@0.8.168 render --quality looks --output renders/konvwa-lien.mp4` (le MP4 n'est pas commité).
