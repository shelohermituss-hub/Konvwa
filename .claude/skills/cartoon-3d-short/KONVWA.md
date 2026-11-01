# Adaptation KONVWA du skill « cartoon-3d-short »

Ce skill vient de [mromidev/claude-animated-shorts](https://github.com/mromidev/claude-animated-shorts) (MIT, commit `e3b817b`), copié tel quel.

**À la demande du client, c'est désormais le « style ANIMÉ »** : des personnages 2D (têtes en haricot, contour encre) dans un monde 3D coloré, rendus avec three.js dans Remotion. Il remplace l'ancien style ANIMÉ en SVG (`videos/_engine/style-anime/`), gardé pour les vidéos déjà faites.

## Les règles du client priment sur les « user rules » de SKILL.md

| SKILL.md (auteur) | KONVWA (client) |
|---|---|
| English only | **français** |
| 55-70 s | **60 à 70 s** (plus de 60 s, jamais plus de 70 s) |
| 30 i/s, export 2K `--scale 1.3333` | **60 i/s** (`--fps 60` ; composition à 60 i/s), 1080×1920 par défaut ; 2K seulement si le rendu se fait sur le PC du client |
| No captions | pas de sous-titres, comme la référence, **à confirmer avec le client** au premier projet |
| Voix « one steady tone » | voix **Gabriel Dubois** (Magnific / ElevenLabs, `voiceId` 480), ton posé et régulier |
| Musique de marche synthétisée | autorisée ; le mixage ne doit jamais avoir de trou (règle du son, voir `videos/_engine/style-anime/mix_anime.py`) |
| — | **signature « Godzy » dans le décor**, 2 à 4 fois : enseignes peintes, affiches, drapeaux, maillots (`videos/_engine/signature/README.md`) |
| — | **couverture TikTok créée à part**, en rendu 3D studio (`videos/_engine/covers/README.md`) |
| « Opus max verifies every check » | contrôle visuel des images clés avant le rendu final (snapshots, planches côte à côte) |

Le reste suit SKILL.md : la recette du script (accroche absurde, décor, escalade, rupture, « Heureusement… / Malheureusement… », une explication par une analogie du quotidien, la conséquence, le retour final), le plan des plans dans `story.ts`, la boucle look-match et les pièges.

## Où vivent les fichiers dans ce dépôt

- Un projet Remotion séparé, dans `videos/_remotion/` : `npm init` et `remotion`, `@remotion/three`, `@react-three/fiber`, `@react-three/postprocessing`, `postprocessing`, `three`.
  - Il est créé au premier projet, hors de l'application Vite et hors de `src/`.
- Chaque vidéo a son dossier : `videos/_remotion/src/videos/<nom>/` (copie de `templates/bridge/`), avec le son et la voix dans `videos/<nom>/`.
- Les kits Kenney (CC0, `.glb`) vont dans `videos/_remotion/public/<nom>/kenney/`. S'ils manquent, `world.ts` continue sans eux.
- Les rendus `.mp4` ne sont pas commités.

## Rendu

Remotion avec three.js est lourd sans carte graphique : le serveur cloud n'en a pas.
- **De préférence, rendu sur le PC Windows du client** (carte NVIDIA 4 Go) : `npx remotion render … --gl=angle` ; les scripts du skill sont déjà écrits pour Windows (`C:/Program Files/Google/Chrome/…`).
- Sinon, rendu dans le cloud : il faut l'annoncer avec sa durée, mesurée sur un court extrait avant le rendu complet.

## Références

`references/` contient des images d'une chaîne étudiée par l'auteur. Elles servent **uniquement à l'étude du style** : ne jamais les publier ni copier leurs histoires, leurs personnages ou leurs plans.
