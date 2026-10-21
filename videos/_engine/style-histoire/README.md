# Style « histoire express » — le style validé par le client

**Règle : toute nouvelle vidéo de faits / histoire (Haïti, drapeaux, anecdotes…) reprend exactement ce style**, sauf demande contraire explicite. Modèle de référence à copier : `videos/drapeaux-jumeaux-tchad-roumanie/` (validé « C'est parfait »), dérivé de `videos/drapeau-haiti-liechtenstein/` (la vidéo virale). Grammaire d'origine : réf. K (`../references/ref-k-histoire`) en version rapide.

## Image

- 9:16 (1080×1920), **36 à 40 s**, un seul plan continu sur fond gris clair `#E7E7E7`, grille de points discrète au centre (masque radial), lente poussée de caméra (×1,04 sur toute la durée).
- **Sans marque KONVWA** : la couleur vient du sujet (couleurs officielles des drapeaux, etc.). Police Poppins.
- **Texte = voix mot par mot**, en blocs de lignes centrées en haut (`y` ≈ 200–300 px) : chaque mot arrive flou et gris clair (`#B9B9B9`, 0,16 s) puis se pose en noir ou dans sa couleur de mot-clé. Tailles mêlées : `s` 50 px, `m` 68 px, `b` 116 px, `bi`/`mi` italiques gras pour la chute, `x` 230 px pour une date géante.
- **10 à 12 parties de 2 à 3 s**, enchaînées par un flou plein cadre bref (26 px, 0,16 s à l'aller, 0,24 s au retour, voile gris 50 %), calé 0,1 s avant le premier mot de la partie.
- Une idée visuelle par partie, posée au centre de l'écran : drapeaux dessinés en HTML avec un pli qui ondule, photos réelles en carte arrondie (30 px) avec zoom lent et puce blanche, pastille noire de date, tampon rouge incliné + secousse sur la réplique forte, loupe, mâts, cartes en grille, lettre / document.
- Apparitions `pop` : 0,38 s `expo.out` depuis flou 14 px, échelle 0,84, +70 px. Les pops démarrent **avant** le flou suivant (sinon l'objet reste affiché).
- Série : pastille noire en capitales en haut (`top: 96px`) pendant toute la vidéo, ex. « DRAPEAUX JUMEAUX · ÉP. 2 ».
- **Images réelles uniquement** (Unsplash via MCP, Wikimedia Commons avec `wmsearch.sh` / `wmget.sh` — lents exprès, limite de débit —, Pixabay via `motion.mjs assets`). Jamais d'images générées par IA.

## Voix

- FLORA, modèle `t2a-gemini-3-1-flash-tts`, `voice_name: Charon`, `language_code: fr-FR`, 2 prises (≈ 0,013 $ chacune). Vouvoiement.
- Consigne : « Dis comme un conteur TikTok très dynamique : débit rapide et énergique, phrases enchaînées presque sans pause, ton captivant et amusé, une courte pause avant « <réplique forte> », et la question finale posée directement au spectateur. Lis les dates exactement comme elles sont écrites : <texte> ». **Dates écrites en lettres** (une prise avait dit « 1921 » au lieu de « 1936 »).
- Accroche ≤ 7 mots, dite dès 0,2 s.
- Traitement : silences de début/fin coupés, transcription `npx hyperframes transcribe -m medium -l fr --json`, puis `align_voice.py` (pauses raccourcies, silence ajouté avant la réplique forte, `atempo=1.1`) → `assets/vo/vo.wav` + temps de chaque mot (`T = 0,2 + RAW`).

## Son

- Musique : `musique-bed.mp3` (ElevenLabs Music via FLORA), bouclée pour couvrir la durée (`acrossfade d=2`), volume 0,18. Enveloppe mixée dans `assets/music/bed.mp3` : **scratch + coupure nette** juste avant la réplique forte, **retour fort** (×1,1) sur la chute, baissée sous la question finale, fondu de 1,6 s.
- Sons (repris de `videos/drapeaux-jumeaux-tchad-roumanie/assets/sfx`) : whoosh à chaque flou, pop à chaque apparition, basse sur l'accroche et la chute, scratch, déchirure, touches de clavier, scintillement. Volumes 0,2 à 0,45 : **rien ne couvre la voix** (pas de foule ni de trompettes).
- `build_exemple.py` montre tout le câblage (enveloppe, pistes de sons sans chevauchement, remplacement de `__END__`, `__VO__`, `RAW`, `WORDS`).

## Fin : faire commenter

- Question ouverte (« Et vous, quels … connaissez-vous ? Dites-le en commentaire. ») ou OUI / NON, bulle blanche « Répondez ici » + flèche rouge animée vers le bouton commentaires de TikTok (à droite, `left: 860px; top: 1180px`).
- Jamais de faux commentaires affichés.

## Contrôle et rendu

`npx --yes hyperframes@0.8.168 check`, captures `snapshot --at …` au milieu de chaque partie (les alertes de contraste sur les mots en cours d'apparition sont normales), puis `render --quality looks --output renders/<nom>.mp4`. README dans le dossier de la vidéo (déroulé, faits, sources des images, coût). MP4 jamais commité.
