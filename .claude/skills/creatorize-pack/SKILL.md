---
name: creatorize-pack
description: Le pack Creatorize du client (videos/_creatorize) est LE moteur de toute vidéo KONVWA dans ses 13 styles (3D cartoon Blender, 3D Informational, toon, low poly, reconstruction, stick figures, stick stories, flat, Vox, Vox éditorial, pixel art, Roblox, starter) et des deux montages (talking-head, intro). À utiliser pour TOUTE création, correction ou amélioration d'un film dans un de ces styles : impose de CHERCHER dans le pack (konvwa pack), de LIRE son skill, ses références, ses PITFALLS et sa bibliothèque, de suivre sa procédure porte par porte, puis de fabriquer avec l'outil konvwa. Le pack prime sur la mémoire de Claude, sur les moteurs maison (HyperFrames, Remotion, _engine) et sur les raccourcis.
---

# Le pack Creatorize = le moteur (creatorize-pack)

Le pack est au client (son logiciel Creatorize, usage privé). Il est rangé tel quel dans `videos/_creatorize/` :
**jamais modifié, jamais publié ailleurs**. Tout ce qui est propre à un film vit dans `videos/<projet>/`.
Toute vidéo dans un style du pack se fait **avec** le pack. Pas de moteur maison, pas de technique de mémoire quand le
pack en a une : le pack a été mesuré sur les références du client, la mémoire de Claude non.

## La boucle obligatoire (à chaque étape, pas une fois au début)

1. **Chercher** : `python videos/_konvwa/konvwa.py pack <mots en anglais>` (ex. `light pool`, `window decal`, `crowd`,
   `hair`, `face`, `camera roll`, `grade`). Il fouille les skills et références des styles, les PITFALLS, la bibliothèque
   (solutions, pièges, recettes, poses, modules), la base de connaissances, le Style Studio, le style kit et le moteur
   Blender. `--zone skill|bibliothèque|support|studio|stylekit|blender` pour restreindre.
2. **Lire** (Read) les fichiers cités, en entier pour un `entry.json` de la bibliothèque, un `PITFALLS.md` ou une référence ;
   appliquer ce qu'ils disent. Une règle du pack contredite par une idée de Claude : le pack gagne.
3. **Faire** avec l'outil `konvwa` (`nouveau`, `test`, `son`, `rendu`, `planche`, `image`, `sprite`) et les outils du pack
   (Blender : `tools/signoff.py`, `render_queue.py`, `assemble.py`, `post.py`, `gradeprobe.py`, `camjerk.py`, `measure_dir.py`).
4. **Vérifier** avec la barre du pack (`qa.md`, `signoff.py`, rapport `CZ CLIPCHECK`, mesures de la référence) et regarder les images.
5. **Apprendre** : chaque échec -> cause -> règle en une ligne dans `videos/<projet>/NOTES.md` (porte G8 du pack).

## La carte du pack (ce qu'il contient et quand l'ouvrir)

| Dossier | Contenu | Quand |
|---|---|---|
| `skill/<style>/SKILL.md` + `references/` + `PITFALLS.md` + `scripts/` | la méthode complète de chaque style (15 skills) | toujours, pour le style du film : le lire **en entier** avant de commencer |
| `skill/blender-toon-shorts/references/` | `sop.md` (portes G0-G8), `engine_api.md`, `camera.md`, `catalog.md` (148 objets, 49 visages, poses), `enrich.md`, `qa.md`, `sitting.md` | films 3D cartoon Blender |
| `blender/` | moteur (`engine/cz.py`, `char.py`, `cam.py`, `run.py`, `mega.py`), `assets/` (props, visages, textures), `tools/`, `ref/` (mesures des références), `film/`, `demo/` | films Blender |
| `library/` | savoir-faire scellé : `solution.*` (méthodes, ex. `light-pools-not-flat-fill`, `critic-protocol`, `order-of-work`), `pitfall.*`, `recipe.*`, `pose.*`, `module.*`, `look.*` | avant tout problème de lumière, pose, échelle, contact, ordre de travail |
| `support/kb/` | la base de connaissances de l'application (sous-titres, voix, export, erreurs, styles, personnages) | règles de l'application, erreurs, formats |
| `studio/` | Style Studio : `AUTHORING.md`, `NO_SLOP.md`, `style.schema.json`, `bases/`, `templates/`, `samples/` | créer ou étendre un style, éviter le « slop » |
| `stylekit/` | guide du style kit (`CLAUDE.md`, `README.md`, `TERMS.md`, `docs/`, PDF) | styles sur mesure |
| `tools/` | `parakeet_timeline.py` (transcription), `speech/`, `tts/` | voix, mots, minutage |
| `host/`, `engine/`, `toon/`, `lowpoly/`, `recon/`, `stickman/`, `stickstory/`, `flat/`, `collage/`, `vox/`, `roblox/`, `starter/` | les moteurs three.js, servis tels quels par `videos/_konvwa/web.mjs` | films three.js |
| `library/` `personal/` `modelconv/` | assets personnels, convertisseurs de modèles | assets |

## Règles KONVWA par-dessus le pack (elles priment sur la forme, pas sur la méthode)

Français, 60 à 70 s, 9:16, voix Gabriel Dubois (Magnific `voiceId` 480, jamais accélérée), signature « Godzy » 2 à 4 fois
(le nom seul), couverture 3D studio faite à part, −14 LUFS, `.mp4` non commités, 30 i/s pour le moteur Blender tant que le
client n'a pas demandé 60. Détails : `/konvwa-styles` et `/konvwa-blender`, `CLAUDE.md`.

## Règles machine du pack (porte sur ce serveur aussi)

- Blender uniquement sans fenêtre ; **une seule file de rendu**, jamais plus de 4 Blenders en même temps ; essais l'un après l'autre
  dans un NOUVEAU dossier `renders/test/<seq>_rN/` ; rendus finaux seulement par `render_queue.py` (via `konvwa rendu`).
- `python -m py_compile` sur chaque `.py` modifié avant un essai ; les fichiers générés (`faces/`, `shots/`, `renders/`, `frames_*/`) restent hors de l'historique.
- Problème dans le moteur : le contourner dans le fichier du film et le signaler ; ne jamais éditer le moteur.

## Ce que ce skill interdit

- Lancer un moteur maison (`videos/_engine`, HyperFrames, Remotion) pour un style du pack.
- Décider d'une technique (lumière, caméra, pose, échelle, foule, voix, grade) sans avoir lancé `konvwa pack` dessus.
- Dire « le pack ne sait pas faire » avant d'avoir cherché en anglais et lu `library/`, `support/kb/` et le skill du style.
