# Style « histoire express » v3 — le style validé par le client

**Règle : toute nouvelle vidéo de faits / histoire (Haïti, drapeaux, anecdotes…) reprend exactement ce style v3**, sauf demande contraire explicite. Le client a validé la v2 (« Garde le style v2 pour toutes les prochaines vidéos »), puis les ajouts « affiche » de la vidéo de la reine à Pise (« C'est parfait, mets à jour le style pour garder les modifications actuelles »).

- **Modèle à copier** : `videos/reine-pise/` (v3 complète : viseur, disques orange, mots fantômes, micro-typo). Pour la mécanique de base, `videos/santa-maria-2014/` et `videos/or-haiti-1914-v2/`. On copie l'`index.html` (CSS, `ctl(t)`, helpers) et on ne réécrit que les scènes, les blocs de texte et les transitions.
- Historique : v1 = `videos/drapeaux-jumeaux-tchad-roumanie/` et `videos/or-haiti-1914/` (flou plein cadre entre les parties). v2 = même chose avec le mouvement enrichi (inondation, iris, page qui pousse). v3 = v2 + accroche « viseur » et scènes « affiche » (section ci-dessous).

## Image

- 9:16 (1080×1920), **30 à 40 s**, fond gris clair `#E7E7E7`, grille de points discrète au centre. Police Poppins.
- **Sans marque KONVWA** (ni logo ni nom) : la couleur vient du sujet (drapeaux, bleu nuit, rouge haïtien `#D21034` pour les mots-clés et la flèche, cuivre…), sauf les **disques derrière les détourages, toujours en orange `#F05A28`** (demande du client : pas de rouge rosé derrière les images).
- Pastille noire en capitales en haut (`top: 96px`) tout du long : série (« DRAPEAUX JUMEAUX · ÉP. 2 ») ou thème (« HISTOIRE D'HAÏTI · 1492 »).
- **Texte = voix mot par mot**, en blocs de lignes centrées en haut (`y` ≈ 200–260 px), chaque ligne est un masque (`overflow: hidden`) :
  - mots ordinaires : arrivent flous et gris clair (`#B9B9B9`, 0,16 s) puis se posent en noir ;
  - **mots-clés** (styles `b`, `bi`, `mi`, `x`) : **montent de leur ligne avec un rebond** (`back.out(1.7)`, 0,42 s), directement dans leur couleur ;
  - sortie : tous les mots repartent vers le haut dans leur ligne (0,18 s).
  - Largeur : une ligne `m` (68 px) tient ≈ 26 caractères, `b`/`bi` (116/108 px) ≈ 14, `s` (50 px) ≈ 36 : couper les lignes plus longues.
- **Chaque scène naît de la précédente** (plus de flou plein cadre). Une vidéo alterne les trois transitions :
  - **inondation de couleur** : un disque sort d'un objet de la scène (badge, cercle, tampon), couvre l'écran en 0,3 s, puis se rétracte en 0,32 s dans l'objet de la scène suivante ;
  - **iris d'appareil photo à 6 lames** qui se ferme puis s'ouvre **sur une photo d'époque plein écran**, qui se replie ensuite en carte (`unfold`, échelle 3,4 → 1) ;
  - **page qui pousse** (vers le haut ou la gauche, 0,4 s), lancée juste après la sortie du texte pour ne pas le traverser.
  - Inondations et iris sont calculés à partir du temps dans `ctl(t)` (aucun état entre deux images).
- **Zooms de caméra** (`cam`) sur le détail qui compte (une date, un badge, une croix sur une carte), lents zooms sur les photos (`kb`). Vérifier que le zoom ne pousse pas une puce hors de l'écran (échelle ≤ 1,2 près des bords).
- **Apparitions en ressort** depuis zéro (`spring`, `back.out(1.8)`, 0,5 s), tampons rouges inclinés avec secousse sur la réplique forte, ondes de sonar, frises qui se remplissent, compteurs.
- **« Bilan »** : l'inondation noire part de l'objet de la scène précédente au moment du scratch, **reste noire pendant le silence** (« Bilan : » écrit en blanc), puis se rétracte sur le mot suivant, quand la musique revient.
- **Images réelles uniquement** : tableaux, cartes et photos d'époque (Wikimedia Commons avec `wmsearch.sh` / `wmget.sh`, lents exprès), Unsplash via MCP, Pixabay via `motion.mjs assets`. Jamais d'images générées par IA. Le reste (fort, caisses, clou, lettre, unes de journaux génériques) est dessiné en HTML/SVG. Une image ne sert qu'une fois par composition (sinon en faire une variante recadrée ou en noir et blanc).

## Accroche et scènes « affiche » (v3)

Tirées des deux références du client (compte à rebours « frames to impact » dans un viseur ; affiches à disques et détourages) :

- **Accroche (≤ 3 s) = image forte + phrase forte** : le sujet détouré monte sur un disque orange **dès la première image**, dans un **viseur de caméra** (`.hud` : 4 coins, point REC rouge + timecode calculé à chaque image, légende Courier à droite, ex. « PISE · 1851 »). Un objet tombe ou frappe (couronne en `bounce.out`) et un **compteur** (`.counter2`, chiffres tabulaires) monte vers le chiffre choc, passe au rouge puis pulse. Le suspense vient du compteur, pas d'un texte en plus.
- **Au moins une image ou un objet par scène**, jamais du texte seul. Recettes :
  - **détourage sur disque** : personnage ou monument détouré (`.cut`) posé sur un disque orange (`.sun`, 500 à 700 px), entouré d'un anneau fin (`.ring3`) à l'accroche ; variante grise (`grayscale`) pour la mort, sépia pour la vieillesse (le disque peut alors passer au gris foncé) ;
  - **mot fantôme** géant derrière (`.ghost`, gris à 7 %, 230 à 520 px) qui dérive lentement de gauche à droite (sens alterné) : le mot ou la date de la scène (REINE, 1820, PISE, TOSCANE) ;
  - **micro-typographie** Courier en capitales (`.micro`) : coordonnées, dates, lieux, « PATRIMOINE MONDIAL »… dans un coin libre ;
  - **cartes photo** inclinées en ressort avec puce de légende, cartes « mémo » blanches (`.memo`), route en pointillés avec drapeaux miniatures et bateau qui la suit, frise qui se remplit, objets dessinés en SVG (couronne, alliances, bougie qui vacille).
  - Un objet qui « revient » de scène en scène (ici la couronne : sur la reine, tombant sur le roi, posée sur la tour au Bilan) relie le récit.
- **Détourages** : `rembg i -m isnet-general-use in.jpg out.png` (marche sur les tableaux et les monuments ; le modèle humain de `hyperframes remove-background` rate les objets), puis effacer les restes à la main avec PIL (rectangles ou polygones sur l'alpha) et vérifier en gros plan.
- Placement : laisser la zone du texte (haut, jusqu'à ≈ 450 px) et la zone basse TikTok libres ; vérifier sur les captures qu'aucune carte n'en cache une autre ni une puce.

## Voix

- FLORA, modèle `t2a-gemini-3-1-flash-tts`, `voice_name: Charon`, `language_code: fr-FR`, 2 prises (≈ 0,013 $ chacune). Vouvoiement.
- Consigne : « Dis comme un conteur TikTok très dynamique : débit rapide et énergique, phrases enchaînées presque sans pause, ton captivant et <ton du sujet>, une courte pause avant « Bilan », et la question finale posée directement au spectateur. Lis les dates et les nombres exactement comme ils sont écrits : <texte> ». **Dates et nombres écrits en lettres**.
- Écouter / transcrire les deux prises : une prise peut sauter la moitié du texte.
- Traitement : silences de début et de fin coupés, `npx hyperframes transcribe -m medium -l fr --json`, **recaler sur les silences (`silencedetect`) les temps de la fin de la prise** (la transcription dérive souvent après 20 s), puis `align_voice.py` (pauses raccourcies, silence ajouté avant « Bilan » et avant « Répondez », `atempo=1.1`) → `assets/vo/vo.wav` + temps de chaque mot (`T = 0,2 + RAW`).

## Son

- Musique : `musique-bed.mp3` (ElevenLabs Music via FLORA), bouclée (`acrossfade d=2`), volume 0,18. Enveloppe mixée dans `assets/music/bed.mp3` : **scratch + coupure** juste avant « Bilan », **retour fort** sur le mot qui suit, baissée sous la question finale, fondu de 1,6 s.
- Sons (repris de `videos/santa-maria-2014/assets/sfx`) : souffle + souffle court sur chaque inondation, souffle court + clic d'obturateur sur chaque iris, souffle sur chaque poussée, pop sur chaque ressort, basse sur l'accroche et le tampon, touches de clavier, montée, scintillement. Volumes 0,15 à 0,45 : **rien ne couvre la voix**.
- `build_exemple.py` (version Santa María) montre tout le câblage : enveloppe, sons des transitions, pistes sans chevauchement, remplacement de `__END__`, `__VO__`, `__SCRATCH__`, `RAW`, `WORDS`.

## Fin : faire commenter

- Question ouverte ou OUI / NON, boutons OUI / NON en ressort, bulle blanche « Répondez ici » + flèche rouge animée vers le bouton commentaires de TikTok (`left: 860px; top: 1180px`).
- Jamais de faux commentaires affichés.

## Contrôle et rendu

1. `npx --yes hyperframes@0.8.168 check` (les alertes de contraste sur les mots en cours d'apparition ou sous une inondation sont normales).
2. Captures `snapshot --at …` au milieu de chaque scène **et pendant chaque transition**.
3. `npx --yes hyperframes@0.8.168 render --fps 120 --quality looks --output renders/raw120.mp4` (≈ 7 min pour 35 s).
4. `python3 -I videos/_engine/style-histoire/finish.py renders/raw120.mp4 renders/<nom>.mp4` : 2 sous-images fusionnées → **60 i/s avec flou de mouvement**, son à **−14 LUFS** (deux passes) avec un limiteur à −2 dB (crêtes ≈ −1 dBFS après encodage), recherche des images isolées qui « sautent » (doit afficher `pops none`).
5. Vérifier le MP4 final : `ebur128` (≈ −14 LUFS, crête < −1 dBFS) et quelques images extraites avec `ffmpeg -ss`.
6. README dans le dossier de la vidéo (déroulé, transitions, faits, sources des images, coût). MP4 jamais commité.
