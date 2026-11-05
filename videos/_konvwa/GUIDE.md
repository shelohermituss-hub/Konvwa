# Faire des vidéos avec l'outil konvwa, sans Claude

L'outil `videos/_konvwa/konvwa.py` fait tout, du projet au MP4, avec le pack Creatorize (`videos/_creatorize/`). Il tourne sur
ton PC Windows (Blender 5.2, Chrome ou Edge, Python 3.11+, ffmpeg) comme sur un serveur. **Ce que Claude écrit à ta place** : le script,
les scènes (`scenes/s01.js` pour les styles three.js, `sNN.py` pour Blender) et les réglages. **Ce que tu peux faire seul** :
tout le reste (voix, minutage, test, son, rendu, couverture), et **modifier un film existant**.

## 1. Mise en place (une fois)
```
git clone https://github.com/shelohermituss-hub/Konvwa.git   (puis : git checkout ccr-84eb92fb-rldiwe)
cd Konvwa
python videos/_konvwa/konvwa.py verifier      # dit ce qui manque (Blender, ffmpeg, Node, navigateur)
python videos/_konvwa/konvwa.py installer     # crée l'environnement Python (Pillow, numpy, OpenCV, scipy)
python videos/_konvwa/konvwa.py styles        # les 13 styles du pack
```

## 2. Faire un film (les étapes)
1. **Script** : 160 à 190 mots pour 60-65 s (Gabriel Dubois lit environ 2,5 mots par seconde avec les consignes de ton).
2. **Voix** : Magnific (ElevenLabs) voix Gabriel Dubois (`voiceId` 480, modèle `eleven_v3`, stabilité 0,3, une consigne
   de ton par phrase entre crochets, mots clés en MAJUSCULES). Garde le MP3 et récupère le minutage de chaque mot
   (`audio_timing_get`). Mets-les en `words.json` : `{"words":[{"word":"Mille","start":0.14,"end":0.16}, ...]}`.
3. **Projet** : `python videos/_konvwa/konvwa.py nouveau mon-film --style toon --mots words.json --voix voix.wav`
   (styles : `toon`, `blender`, `lowpoly`, `recon`, `stickstory`, `flat`, `vox`, `roblox`, `pixel`, etc.).
4. **Scènes** : copie celles d'un film fini comme modèle (`videos/empereur-norton/scenes/s01.js` pour toon,
   `videos/duc-marmelade/s01.py` pour Blender) et change les lieux, personnages, phrases (`say:`) et mots repères (`S.at('mot')`).
   Le catalogue des lieux, personnages, effets et poses : `videos/_creatorize/skill/toon-shorts/references/catalog.md`.
5. **Tester** : `python videos/_konvwa/konvwa.py test mon-film --temps 1,5,10 --scale 0.5` (three.js) ou
   `... test mon-film s01 --frames 10,100 --scale 0.3` (Blender). Les images sont dans `renders/test/`.
6. **Son** : écris `sons.json` (effets sur des mots : `{"t":"mot:arrête","type":"impact","gain":0}`), puis
   `python videos/_konvwa/konvwa.py son mon-film`. Le mix garde la voix au moins 12 dB au-dessus des effets, à −14 LUFS.
7. **Rendu** : `python videos/_konvwa/konvwa.py rendu mon-film` → `renders/mon-film.mp4`.
   Sur une machine sans carte graphique, le rendu three.js est lent (environ 0,5 image/s) : prends un PC avec carte NVIDIA
   ou RunPod (`videos/_konvwa/RENDU_RUNPOD.md`, pour les films Blender).
8. **Couverture** : image 3D studio faite à part (Magnific `images_generate` 9:16), puis
   `node videos/_engine/covers/render_cover.mjs videos/mon-film/cover` (voir `videos/_engine/covers/README.md`).

## 3. Chercher dans le pack avant d'écrire
`python videos/_konvwa/konvwa.py pack <mots en anglais>` (ex. `light`, `crowd`, `sparkle`) : liste les fichiers du pack à lire.

## 4. Ce qui change sans Claude
- Tu peux **refaire un rendu** ou **modifier un film existant** (couleurs, textes `say:`, lieux, sons) en éditant les fichiers.
- Écrire des scènes neuves de zéro demande de lire `videos/_creatorize/skill/<style>/SKILL.md` et ses `references/`.
- Les règles du client (60-65 s, voix Gabriel Dubois, signature Godzy 2 à 4 fois, couverture, −14 LUFS) sont dans `CLAUDE.md`.
