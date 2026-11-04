---
name: konvwa-blender
description: Fabrique une vidéo courte KONVWA en 3D cartoon avec le moteur Blender de Creatorize (videos/_creatorize/blender), piloté par l'outil konvwa (videos/_konvwa/konvwa.py) - personnages à grosse tête blanche au visage dessiné qui change sur les mots (49 expressions, synchro labiale automatique), décors denses (148 objets), vraie lumière EEVEE avec ombres et formes de lumière, contours encrés, caméra qui vole d'un cadrage à l'autre dans un décor continu, en français, 60-70 s, voix Gabriel Dubois, signature Godzy, couverture. À utiliser pour toute vidéo « 3D cartoon », « style Blender », « comme les références », ou quand le client veut un vrai décor 3D avec lumière et ombres.
---

# Vidéo 3D cartoon KONVWA sur le moteur Blender (konvwa-blender)

Les autres styles du pack (3D Informational réaliste sur le même moteur, et les 11 styles three.js) : `/konvwa-styles`
(`.claude/skills/konvwa-styles/SKILL.md`), qui donne aussi la correspondance des outils de l'application.

Le moteur vient du pack Creatorize du client (propriétaire de Creatorize ; usage privé dans ce dépôt, rien à publier
ailleurs). Il est rangé TEL QUEL dans `videos/_creatorize/` : **ne jamais modifier le moteur** ; tout ce qui est propre à
un film vit dans `videos/<projet>/`. L'outil `konvwa` remplace l'application Creatorize (aperçu, rendu, export).

## À lire avant le premier fichier de scène (dans cet ordre)

Le savoir-faire est celui du moteur, mesuré image par image ; on le suit à la lettre :
1. `videos/_creatorize/skill/blender-toon-shorts/SKILL.md` - le principe et les non-négociables.
2. `.../references/sop.md` - la procédure, porte par porte (G0 → G8).
3. `.../references/engine_api.md` - chaque appel (cz, char, cam, outils), avec des exemples réels.
4. `.../references/camera.md` - la grammaire de caméra (cadrages sur les mots, vols, dérive, poussées).
5. `.../references/sitting.md`, `catalog.md` (148 objets, 49 visages, poses), `qa.md` (la barre), `enrich.md`.
6. `.../PITFALLS.md` - les 141 échecs connus et leur règle.

## Ce qui change par rapport à l'application Creatorize (règles KONVWA, prioritaires)

| Creatorize | KONVWA |
|---|---|
| langue du projet | **français** (`project.json` : `"language": "fr"`) ; sous-titres en français, mot à mot (post.py) |
| durée libre | **60 à 70 s** (plus de 60, jamais plus de 70) |
| voix de l'app | voix **Gabriel Dubois** (Magnific, `voiceId` 480), vivante et énergique : stabilité 0,3, consignes de ton phrase par phrase, mots clés en capitales (modèle : `videos/rats-hanoi/`). Si > 70 s : raccourcir le texte, jamais accélérer la voix |
| `audio/timeline.json` fait par l'app | Whisper (`npx hyperframes@0.8.168 transcribe voice16.wav -m medium -l fr --json`), `videos/_remotion/scripts/mots.py`, `caler_texte.py` (texte exact du script), puis `konvwa nouveau` qui écrit `audio/timeline.json` + `audio/words.json` |
| 30 i/s | le moteur reste à **30 i/s** (toutes ses durées en images en dépendent) ; la sortie passe à **60 i/s** à la fin (`konvwa rendu`, réglage `project.json > konvwa > fps60` : `dup` par défaut, `interp` = images intermédiaires calculées) puis `finish.py` (−14 LUFS) |
| marque | **signature « Godzy »** 2 à 4 fois sur des objets du décor (affiche, enseigne, caisse, tee-shirt), le nom seul (`videos/_engine/signature/README.md`) |
| — | **couverture TikTok créée à part**, 3D studio (`videos/_engine/covers/README.md`) |
| musique : non par défaut | effets sur les événements de l'image (porte, chute, pop, choc…) et fond d'ambiance jamais muet ; musique seulement si demandée (`sons.json > musique`) ; la voix mène |
| interdits « no-slop » du moteur | gardés : pas de tampon « FERMÉ » plaqué, pas de mention de voix IA, pas de vraies marques ni de vraies personnes, chaque image lisible |

Le script suit la recette de `videos/_remotion/SCRIPT_modele_fr.md` (accroche absurde, décor, escalade, rupture,
« Heureusement… / Malheureusement… », une image du quotidien, la conséquence, le retour final), faits vérifiés et sourcés
dans `videos/<projet>/SCRIPT.md`.

## L'outil konvwa (videos/_konvwa/konvwa.py)

```
python videos/_konvwa/konvwa.py verifier                         # Blender, Python (Pillow, numpy, OpenCV), ffmpeg
python videos/_konvwa/konvwa.py installer [--bpy]                # crée videos/_konvwa/.venv (--bpy : Blender en module)
python videos/_konvwa/konvwa.py nouveau <projet> --mots <words.json> --voix <voice.wav>
python videos/_konvwa/konvwa.py mots <projet> <words.json>       # refaire timeline.json après une nouvelle prise
python videos/_konvwa/konvwa.py test <projet> s03 --frames 880,915 [--scale 0.4 --samples 12]
python videos/_konvwa/konvwa.py planche <dossier>
python videos/_konvwa/konvwa.py son <projet>                     # effets + fond + musique -> audio/final_mix.wav (-14 LUFS)
python videos/_konvwa/konvwa.py rendu <projet> [--fps60 dup|interp|non] [--sans-reglage] [--jobs N]
```
- `nouveau` crée le film depuis `videos/_konvwa/modele/` : PLAN.md (avec la liste des phrases et leur image de début),
  CLAUDE.md, common.py (murs à vrais trous, visibilité, porter, allonger, badges), cast.py, sets.py, s01.py (un plan
  d'exemple qui marche), assemble.json, NOTES.md.
- `test` remplace `render_frames` de l'application : un nouveau dossier `renders/test/<seq>_rN/` à chaque tour, le
  journal filtré (Traceback, CZ CLIP, CZ SIT, CZ PROP FAILED…), une `planche.jpg`. Lire le journal, puis REGARDER chaque image.
- `son` = la chaîne son du pack : `sons.json` du film (effets au temps d'un mot : `{"t": "mot:jarre", "type": "pop"}`, fonds,
  `musique` = un fichier, baissé ~22 dB sous la voix) + un whoosh à chaque changement de plan -> `sound_design.py` (vraies
  prises CC0 de `videos/_creatorize/lowpoly/library/sfx`, 97 catégories ; ~20 effets par minute au plus, les plus
  importants) -> `mix.py` (voix intacte devant, fond baissé sous la voix, −14 LUFS, contrôle voix/fond ≥ 12 dB).
  `rendu` le refait tout seul quand le film a un `sons.json`.
- `rendu` = l'export : comme l'application, d'abord le réglage du rendu pour cette machine (`render_tune.py` : les
  réglages les plus rapides qui donnent la même image, un seul Blender sauf mesure contraire ; `render_plan.json` dans le
  film ; `--sans-reglage` pour s'en passer), puis `render_queue.py --anim` (ne rend que ce qui manque, `shots/<seq>/NNNN.png`), `assemble.py`
  (fondus, raccords → `frames_final/`), `post.py` (étalonnage de `project.json > konvwa > post`, sous-titres, voix),
  60 i/s, `finish.py` (−14 LUFS) → `renders/<projet>.mp4`.

## Où tourne quoi

- **PC Windows du client** (Blender 5.2 installé, carte NVIDIA) : rendu final. Commandes dans PowerShell depuis
  `$HOME\Konvwa` : `git pull`, puis `python videos\_konvwa\konvwa.py verifier` (la première fois : `installer`), puis
  `python videos\_konvwa\konvwa.py rendu <projet>`. Compter ~35-70 min pour 60 s.
- **Serveur cloud de Claude** (pas de carte graphique) : Blender 5.2 en module Python (`bpy`, PyPI) + Mesa (`libegl1`).
  `konvwa installer --bpy` (ou un venv avec `bpy==5.2.3 numpy pillow opencv-python-headless`), et si besoin
  `apt-get install -y libegl1 libegl-mesa0 libgl1-mesa-dri libgbm1`. Variable `KONVWA_BPY_PY=<python du venv>`.
  Rendu logiciel : ~20-60 s par image à l'échelle 0,3 : des tours de test de 2 à 6 images, jamais le film entier.

## Déroulé d'un film

1. Script (SCRIPT.md, faits sourcés) → voix (Magnific) → mots (Whisper + caler_texte) → `konvwa nouveau`.
2. G1 PLAN.md : séquences (un décor continu chacune, 6-11 fichiers pour 60 s), un cadrage par proposition (~4,5-5,5 par
   10 s, arrivant 0-3 images avant son mot), la distribution, les décors et leur lumière, le script de couleurs, où
   apparaît Godzy.
3. G2 cast.py, G3 sets.py + dress_<décor>.py (lumière AVANT l'habillage, test de la vue la plus large), G4 les séquences,
   G5 la densité de détails (au moins 6 tours par décor), G6 assemble.json, G7 lumière et étalonnage (gradeprobe), G8 NOTES.md.
4. Chaque porte se valide avec `konvwa test` et en regardant les images ; le rapport de contact doit être propre.
5. Couverture 3D studio, README.md du projet (déroulé, fichiers, commande de rendu PC), commit + push.
6. Donner au client la commande de rendu PowerShell.
