# Adaptation KONVWA du skill « cartoon-3d-short »

Ce skill vient de [mromidev/claude-animated-shorts](https://github.com/mromidev/claude-animated-shorts) (MIT, commit `e3b817b`), copié tel quel.

**À la demande du client, c'est désormais le « style ANIMÉ »** : des personnages 2D (têtes en haricot, contour encre) dans un monde 3D coloré, rendus avec three.js dans Remotion. Il remplace l'ancien style ANIMÉ en SVG (`videos/_engine/style-anime/`), gardé pour les vidéos déjà faites.

## Les règles du client priment sur les « user rules » de SKILL.md

| SKILL.md (auteur) | KONVWA (client) |
|---|---|
| English only | **français** |
| 55-70 s | **60 à 70 s** (plus de 60 s, jamais plus de 70 s) |
| 30 i/s, export 2K `--scale 1.3333` | **60 i/s** (`--fps 60` ; composition à 60 i/s), 1080×1920 par défaut ; 2K seulement si le rendu se fait sur le PC du client |
| No captions | **pas de sous-titres** (confirmé par le client) |
| Voix « one steady tone » | voix **Gabriel Dubois** (Magnific / ElevenLabs, `voiceId` 480), **vivante et énergique** (demande du client, novembre 2026) : stabilité 0,3, consignes de ton phrase par phrase (`[energetic, enthusiastic storyteller, lively and punchy]`, `[amused]`, `[excited]`, `[playful, conspiratorial]`…), mots clés en capitales ; modèle : `videos/rats-hanoi/` (prise 2). Ne plus utiliser le ton posé `[calm, steady, dry storytelling]` |
| Musique de marche synthétisée | autorisée ; le mixage ne doit jamais avoir de trou (règle du son, voir `videos/_engine/style-anime/mix_anime.py`) |
| — | **signature « Godzy » dans le décor**, 2 à 4 fois : enseignes peintes, affiches, drapeaux, maillots (`videos/_engine/signature/README.md`) |
| — | **couverture TikTok créée à part**, en rendu 3D studio (`videos/_engine/covers/README.md`) |
| « Opus max verifies every check » | contrôle visuel des images clés avant le rendu final (snapshots, planches côte à côte) |

Le reste suit SKILL.md : la recette du script (accroche absurde, décor, escalade, rupture, « Heureusement… / Malheureusement… », une explication par une analogie du quotidien, la conséquence, le retour final), le plan des plans dans `story.ts`, la boucle look-match et les pièges.

## Où vivent les fichiers dans ce dépôt (installé et vérifié)

- **`videos/_remotion/`** : le projet Remotion.
  - Versions : Remotion 4.0.539, React 18, `@react-three/fiber` 8, `@react-three/postprocessing` 2, `postprocessing` 6, three 0.169.
  - Avec React 19, fiber 9 et postprocessing 3, la chaîne d'effets donnait une image vide en rendu logiciel. Le modèle a été adapté en une seule ligne : les passes coupées sont filtrées.
  - `src/videos/bridge/` : le modèle du skill (anglais, 30 i/s), vérifié avec tous ses effets (encre, flou de profondeur, lumière dorée).
  - `src/videos/test/` : un cube et un panneau Godzy, pour vérifier qu'une machine sait rendre la 3D.
  - `src/videos/_commun/godzy.ts` : `godzySign(largeurM)`, l'enseigne « GODZY » peinte (face non éclairée).
  - `scripts/stills.mjs <Composition> <préfixe> <images> [échelle]` : images fixes de contrôle (ANGLE sur Windows, SwiftShader sur le serveur). Le serveur met environ 50 s par image à 0,5.
  - `scripts/mots.py` : convertit la transcription Whisper de la voix en `words.json`.
  - `SCRIPT_modele_fr.md` : la recette du script en français, avec l'exemple du pont traduit.
- **Une vidéo** :
  - copie de `src/videos/bridge/` dans `src/videos/<nom>/`, avec `FPS = 60` dans `story.ts` (toutes les durées en images doublent par rapport au modèle) ;
  - la composition est déclarée dans `src/Root.tsx` ;
  - la voix, `words.json`, le son et le rendu vont dans `videos/<nom>/` : `voice/voice.wav`, `voice/words.json`, `audio/mix.wav`, `renders/`.
- **Les kits Kenney** (CC0, `.glb`, kenney.nl) vont dans `videos/_remotion/public/<nom>/kenney/`. S'ils manquent, `world.ts` continue sans eux.
- Les rendus `.mp4` ne sont pas commités.

## Chaîne en français, pas à pas

1. **Script** : `SCRIPT_modele_fr.md`, 180 à 210 mots, faits vérifiés et sourcés.
2. **Voix** : Gabriel Dubois, ton vivant et énergique (voir le tableau). Ne pas resserrer les pauses d'une prise énergique (ça casse l'élan) ; si la vidéo dépasse 70 s, raccourcir le texte. `ffmpeg` en 16 kHz mono, puis `npx hyperframes@0.8.168 transcribe voice.wav -m medium -l fr --json > voice.out`, puis `python3 videos/_remotion/scripts/mots.py voice.out videos/<nom>/voice/words.json`. Relire les nombres et les mots placés dans une pause. **Avec sous-titres** : `python3 -I videos/_remotion/scripts/caler_texte.py texte.txt words-whisper.json words.json` met le texte exact du script sur les temps de Whisper (modèle : `src/videos/rats/Rats.tsx`, composant `Captions`).
3. **Plans** (`story.ts`) : à 60 i/s, chaque réaction 0 à 6 images avant son mot.
4. **Son** : `templates/audio/` (bruitages et musique synthétisés, voix gain seul). Le mixage final ne doit avoir aucun trou.
5. **Contrôle** : images fixes, `node scripts/stills.mjs <Comp> out/<nom>/x_ 100,400 0.5`.
6. **Rendu** sur le PC Windows du client : `videos\_engine\rendre-anime.cmd <Composition> <nom>`. La commande fait le rendu Remotion avec ANGLE et la carte NVIDIA, ajoute `audio\mix.wav`, puis passe dans `finish.py` (−14 LUFS).
7. **Couverture** en 3D studio (`videos/_engine/covers/`), avec Godzy.

## Rendu

Remotion avec three.js est lourd sans carte graphique : le serveur cloud n'en a pas.
- **De préférence, rendu sur le PC Windows du client** (carte NVIDIA 4 Go) : `npx remotion render … --gl=angle` ; les scripts du skill sont déjà écrits pour Windows (`C:/Program Files/Google/Chrome/…`).
- Sinon, rendu dans le cloud : il faut l'annoncer avec sa durée, mesurée sur un court extrait avant le rendu complet.

## Références

`references/` contient des images d'une chaîne étudiée par l'auteur. Elles servent **uniquement à l'étude du style** : ne jamais les publier ni copier leurs histoires, leurs personnages ou leurs plans.
