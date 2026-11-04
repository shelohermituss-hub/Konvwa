---
name: konvwa-styles
description: Point d'entrée de TOUS les styles du pack Creatorize du client (videos/_creatorize) dans l'outil konvwa (videos/_konvwa/konvwa.py) - 13 styles de vidéo (3D cartoon Blender, 3D Informational réaliste, 3D cartoon three.js, low poly, reconstruction 3D, MS Paint stick figures, stick stories, flat explainer, Vox collage, Vox éditorial, pixel art, Roblox, starter 2D/3D) et les deux montages de vidéo filmée (talking-head, intro). Choisir le style, suivre son skill du pack à la lettre, appliquer les règles KONVWA (français, 60-70 s, 60 i/s, voix Gabriel Dubois, Godzy, couverture, -14 LUFS), et fabriquer avec konvwa nouveau / test / son / rendu. À utiliser pour toute vidéo dans un style du pack, quand le client nomme un de ces styles, ou quand il demande quel style choisir.
---

# Les styles du pack Creatorize dans KONVWA (konvwa-styles)

Le pack est au client (son logiciel Creatorize ; usage privé dans ce dépôt, ne rien publier ailleurs). Il est rangé TEL
QUEL dans `videos/_creatorize/` : **ne jamais modifier un moteur, un skill du pack ou un outil du pack**. Tout ce qui est
propre à un film vit dans `videos/<projet>/`. L'outil `konvwa` remplace l'application : il crée le film, sert le moteur
du style à un Chrome sans fenêtre (styles three.js, `videos/_konvwa/web.mjs`) ou lance Blender (styles Blender), fait le
son avec la chaîne du style et sort le MP4 final.

## 1. Choisir le style

| id konvwa | nom dans Creatorize | moteur | skill du pack (`videos/_creatorize/skill/…`) | formats | bon pour |
|---|---|---|---|---|---|
| `blender` | 3D cartoon shorts (Blender) | `blender` | `blender-toon-shorts` | 9:16, 16:9 | histoires cartoon, vraie lumière et ombres (les références du client) ; **skill KONVWA dédié : `/konvwa-blender`** |
| `mega` | 3D Informational | `blender` (`engine/mega.py`) | `mega-informational` | 9:16, 16:9 | « Et si on… ? » réaliste : un grand projet construit pas à pas, la pièce nommée en rayons X verts |
| `toon` | 3D cartoon shorts (Three.js) | `toon` | `toon-shorts` | 9:16, 16:9 | le même monde cartoon, rendu plus rapide (navigateur) |
| `lowpoly` | Low poly shorts | `lowpoly` | `lowpoly-shorts` | 9:16, 16:9 | style jeu vidéo low-poly, bibliothèque de gens en mocap, coupes rapides |
| `recon` | 3D reconstruction | `recon` | `recon-reconstruction` | 9:16, 16:9 | documentaire d'un fait réel : cartes, terrain, photos, mannequins ; look Studio ou Investigation |
| `stickman` | MS Paint stick figures | `stickman` | `stickman-explainer` | **16:9 seul** | histoire/science drôle, une image par proposition ; jamais de musique |
| `stickstory` | Stick stories | `stickstory` | `stickstory-videos` | 9:16, 16:9 | « Et si tu… » raconté à « tu », silhouettes noires dans des décors illustrés |
| `flat` | Flat explainer | `flat` | `flat-explainer-video` | 9:16, 16:9 | explication vectorielle avec un personnage principal, icônes, schémas |
| `vox` | Vox | `collage` | `vox-collage-video` | 9:16, 16:9 | collage de une de journal : découpes, papier déchiré, tampons, une case par chapitre |
| `vox-editorial` | Vox editorial (ancien) | `vox` | `vox-editorial-video` | 9:16, 16:9 | collage éditorial procédural (tableau quadrillé, autocollants, annotations) |
| `pixel` | Pixel art | `engine` | `pixel-explainer-video` | **16:9 seul** | explication rétro 3D en 16 couleurs, HUD, jeux et tech |
| `roblox` | (Roblox story shorts) | `roblox` | `roblox-story-shorts` | 9:16 | « Dans ce monde, chaque fois que tu… » : avatars R6, coupe toutes les 1-1,5 s, vine boom |
| `starter` | Studio starter | `starter` | `studio-starter` | 9:16, 16:9 | base neutre 2D (`--dim 2d`) ou 3D (`--dim 3d`) pour un style sur mesure |

`python videos/_konvwa/konvwa.py styles` donne la même liste. Les réglages de look de chaque style (couleurs, grain,
caméra, sous-titres) sont décrits dans `videos/_creatorize/support/kb/look-*.md` et vont dans `project.json > settings`.
Pour un style 16:9 seul, KONVWA publie quand même en 9:16 : `konvwa rendu` pose l'image entière sur une copie floutée
d'elle-même et grave dessous des sous-titres mot à mot (`--vertical flou`, par défaut ; `recadre` = le centre agrandi ;
`non` = garder le 16:9).

## 2. À lire avant le premier fichier de scène

1. Le `SKILL.md` du style dans le pack, puis **ses références dans l'ordre qu'il donne** (sop, style, script,
   storyboard, engine_api, catalog, motion, qa, sound_design, PITFALLS…). On le suit à la lettre : c'est le savoir-faire
   mesuré du style.
2. `videos/_creatorize/studio/NO_SLOP.md` (ce qui fait « IA bâclée » : interdit).
3. Pour un style three.js : `videos/_creatorize/stylekit/docs/ENGINES.md` (ce que chaque moteur sait faire) et, si besoin,
   `videos/_creatorize/studio/bases/<base>/{extend,dont}.md`.
4. Ce fichier, dont les règles KONVWA ci-dessous priment.

## 3. Règles KONVWA (prioritaires sur le skill du style)

| le skill du pack dit | KONVWA |
|---|---|
| langue du projet | **français** ; sous-titres français, mot à mot (le moteur les dessine depuis `audio/timeline.json`) |
| durée libre (8-12 min pour stickstory…) | **60 à 70 s** (plus de 60, jamais plus de 70) ; si > 70 s, raccourcir le texte, jamais accélérer la voix |
| voix de l'application, Kokoro (`tools/tts`) | voix **Gabriel Dubois** (Magnific, `voiceId` 480), vivante et énergique : stabilité 0,3, consignes de ton phrase par phrase, mots clés en capitales (modèle : `videos/rats-hanoi/`) |
| transcription de l'application (Parakeet, `tools/speech`) | Whisper (`npx hyperframes@0.8.168 transcribe voice16.wav -m medium -l fr --json`), `videos/_remotion/scripts/mots.py`, `caler_texte.py` (texte exact du script), puis `konvwa nouveau` (écrit `audio/timeline.json`, `words.json`, `script_timed.txt`, `clean.wav`) |
| 24 ou 30 i/s | sortie **60 i/s** (`konvwa rendu`), puis `finish.py` (−14 LUFS) |
| 16:9 | **9:16** par défaut ; un style 16:9 seul passe en 9:16 au rendu (flou + sous-titres) |
| marque de l'application | **signature « Godzy »** 2 à 4 fois sur des objets de la scène (affiche, enseigne, tee-shirt, caisse, plaque), le nom seul (`videos/_engine/signature/README.md`) |
| vignette de l'application | **couverture TikTok créée à part**, 3D studio, titre-choc de 3 à 7 mots (`videos/_engine/covers/README.md`) |
| musique | jamais par défaut ; seulement si le client la demande (`sons.json > musique`) ; **jamais** pour `stickman` et `roblox` |
| « pas de son » (stickman) | un fond d'ambiance très bas reste toujours (jamais de silence numérique) ; la voix mène |
| no-slop du pack | gardé en entier : pas de tampon ou verdict plaqué, pas de mention de voix IA, pas de vraies marques ni de vraies personnes inventées, pas de texte dans une image générée, chaque image lisible |

Le script suit `videos/_remotion/SCRIPT_modele_fr.md` (accroche, décor, escalade, rupture, « Heureusement… /
Malheureusement… », une image du quotidien, la conséquence, le retour final) sauf quand le skill du style a sa propre
forme de récit (`roblox` : « Dans ce monde… », `stickstory` : « Et si tu… », `mega` : la question « Et si… ? » résolue pas à
pas) : on prend alors la forme du style, en français. Faits vérifiés et sourcés dans `videos/<projet>/SCRIPT.md`.

## 4. Les outils de l'application → ceux de KONVWA

Les skills du pack parlent des outils de l'application Creatorize. Ici :

| ils disent | ici |
|---|---|
| `check_preview` (scènes qui démarrent, `say miss`, `cue miss`) | `konvwa test <projet> --controle` (le balayage de la page : erreurs et mots introuvables) |
| `check_layout` | `konvwa test <projet> --controle` (la même commande imprime les problèmes de mise en page) |
| `render_frames`, `render_view`, `render_stills` | `konvwa test <projet> --temps 1,4.5,9 [--scale 1]` → `renders/test/web_rN/` + `planche.jpg` ; puis **regarder chaque image** (Read) ; la planche n'est qu'un aperçu, une image à l'échelle 1 est la preuve |
| `list_shots` | `node videos/_konvwa/web.mjs info <projet>` |
| l'aperçu de l'éditeur | `node videos/_konvwa/web.mjs serve <projet>` (adresse locale à ouvrir dans Chrome) |
| `make_image` (images du service du client) | une image générée avec Magnific (`images_generate`, sans texte dedans ; détourage `images_remove_background` pour une découpe), puis `konvwa image <projet> <nom> <png> --licence own` → `IMG[nom]` |
| `web_image` (Wikimedia Commons) | trouver la photo sur commons.wikimedia.org, lire sa licence (PD, CC0, CC-BY…), la télécharger, puis `konvwa image <projet> <nom> <fichier> --source <url> --licence CC-BY-4.0` (crédit dans `CREDITS.json`) |
| `make_sprites` (stickman) | dessiner chaque pose avec Magnific en style MS Paint (contour noir épais, aplats, fond uni), détourer, puis `konvwa sprite <projet> <perso> <pose-visage> <png> --desc "…"` → `assets/sprites/` ; sans sprite, le moteur dessine la figure lui-même (bien pour un brouillon) |
| `library_search` / `library_use` | la bibliothèque low-poly : `videos/_creatorize/lowpoly/library/index.json` (servie au moteur en `__lib`) ; les modules du Library : copier `videos/_creatorize/library/<kind>/<id>/v1/` dans `<projet>/library/<id>/` |
| `add_font` | une police sous licence libre dans `<projet>/fonts/` avec son fichier de licence |
| `tighten.py` (roblox) | `python videos/_creatorize/skill/roblox-story-shorts/scripts/tighten.py <projet>` (raccourcit les silences de la voix, refait les temps) |
| l'étape Son de l'application | `konvwa son <projet>` (ci-dessous) |
| Export | `konvwa rendu <projet>` (ci-dessous) |

## 5. Fabriquer un film

```
python videos/_konvwa/konvwa.py nouveau <projet> --style <id> --mots <words.json> --voix <voix.wav> [--format landscape] [--dim 2d]
```
- Styles three.js : le film a `project.json` (`scenes` dans l'ordre du récit, `end`, `settings`, `konvwa.style/moteur`),
  `scenes/s01.js` (un exemple du pack qui marche : le lire, puis le remplacer), `models.js` (les aides du film), `audio/`,
  `PLAN.md`, `CLAUDE.md`, `NOTES.md`, `sons.json`. **Le moteur n'est pas recopié** : `web.mjs` sert ses fichiers depuis
  `videos/_creatorize/<moteur>/` (un fichier du même nom dans le film passe devant, ex. `models.js`).
- Styles Blender (`blender`, `mega`) : le modèle `videos/_konvwa/modele/` (cast.py, sets.py, common.py, s01.py,
  assemble.json) ; pour `mega`, `s01.py` est le plan 1 de la démo du moteur et les sous-titres prennent le look « mega ».
  Méthode détaillée : `/konvwa-blender`.

Puis, porte par porte selon la procédure du style :
```
python videos/_konvwa/konvwa.py test <projet> --controle                 # three.js : erreurs, mots manqués, mise en page
python videos/_konvwa/konvwa.py test <projet> --temps 2,6.5,11 --scale 1 # three.js : images à regarder
python videos/_konvwa/konvwa.py test <projet> s03 --frames 880,915       # Blender : un plan, quelques images
python videos/_konvwa/konvwa.py son <projet>                             # le son (voir dessous)
python videos/_konvwa/konvwa.py rendu <projet>                           # le MP4 final : renders/<projet>.mp4
```
- **Son** (`konvwa son`) : les sons que posent les scènes elles-mêmes (`S.sfx`, `sfx(...)`, entrées des éléments : relevés
  dans la page par `web.mjs events`) + ceux de `sons.json` (au temps d'un mot : `"mot:jarre#2+0.1"`), les fonds
  (`beds`), puis le `scripts/sound_design.py` **du skill du style** (bibliothèque CC0 du pack) et le mix (voix devant,
  fond ≥ 12 dB sous la voix, −14 LUFS ; Roblox a son propre mix). Styles Blender : `sons.json` + un whoosh par plan.
- **Rendu** (`konvwa rendu`) : three.js = le son, puis toutes les images à 60 i/s (Chrome / Edge du PC : l'encodeur H.264 du
  navigateur, comme l'application ; serveur : image par image), le passage en 9:16 si besoin, `finish.py`. Blender = le
  réglage du rendu pour la machine (`render_tune.py`, comme l'export de l'application ; `--sans-reglage` pour s'en
  passer), les plans, le montage, `post.py` (étalonnage, sous-titres), 60 i/s, `finish.py`.

Ensuite : la couverture (3D studio, `cover.png` + `cover-grille.png`), `README.md` du film (déroulé, fichiers,
commande de rendu PC), commit + push, et donner au client la commande PowerShell :
```
cd $HOME\Konvwa ; git pull ; .\konvwa.cmd rendu <projet>
```

## 6. Où tourne quoi

- **PC Windows du client** : Blender 5.2 (styles Blender), Chrome ou Edge (styles three.js : encodeur H.264 matériel,
  rapide), Node, ffmpeg. `.\konvwa.cmd verifier` dit ce qui manque.
- **Serveur cloud de Claude** : Blender en module `bpy` (`KONVWA_BPY_PY=/root/bpyenv/bin/python`) et le Chromium de
  Playwright (`CZ_BROWSER=/opt/pw-browsers/chromium-*/chrome-linux/chrome`, sans encodeur H.264 : image par image, lent).
  Pour les images de contrôle et les essais courts ; le film entier se rend sur le PC.

## 7. Les montages de vidéo filmée (pas de moteur 3D)

- `talking-head-edit` : un enregistrement d'écran + une ou plusieurs facecams → deux fichiers coupés et synchronisés
  (reprises, blancs et ratés enlevés, fondus de 20 ms). Scripts : `videos/_creatorize/skill/talking-head-edit/scripts/`.
- `intro-edit` : l'intro lue face caméra → une ouverture animée (texte et graphismes calés sur la parole, HyperFrames)
  + une passe de bruitages. Scripts : `videos/_creatorize/skill/intro-edit/scripts/`.
Suivre leur `SKILL.md` tel quel (ils lancent leurs propres scripts) ; les règles KONVWA de son (−14 LUFS, `finish.py`) et
de 60 i/s s'appliquent au fichier livré.

## 8. Le reste du pack (à connaître, à lire au besoin)

- `videos/_creatorize/studio/` : la méthode pour créer un style sur mesure (AUTHORING.md, stages/, templates/,
  `bases/<base>/{extend,dont}.md`) et les échantillons de chaque base (`samples/<base>/`, `hero.js`, `kit.js`, et les
  scènes `mustfail_*` qui prouvent que chaque contrôle échoue quand il doit).
- `videos/_creatorize/stylekit/` : le Style Kit (guide, docs/METHOD.md, docs/CHECKS.md, NO_SLOP.md, CONVERT.md).
- `videos/_creatorize/library/` : modules, recettes, poses, looks et leçons (`pitfall.*`, `solution.*`) réutilisables.
- `videos/_creatorize/lowpoly/library/` : 728 entrées (97 catégories de bruitages, animaux, objets, décors).
- `videos/_creatorize/support/kb/` : la documentation de l'application (styles, looks, son, export, sous-titres).
- `videos/_creatorize/personal/backgrounds/` : fonds pour les vidéos filmées.
