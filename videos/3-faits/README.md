# « 3 faits que ton cerveau va refuser »

Premier épisode du format **3 faits** : trois faits courts, le meilleur annoncé pour la fin. Composition HyperFrames écrite à la main (`index.html`), 9:16, **≈ 66,2 s**, style « histoire express » v3 (`../_engine/style-histoire/README.md`, section « Format 3 faits »). Pastille « 3 FAITS · LE 3ᵉ EST LE PLUS FOU ».

Les règles « chaque seconde compte » sont appliquées :

- accroche à trois cartes dès la première image : N° 1 la Lune, N° 2 Pluton, N° 3 cachée derrière un « ? » ;
- promesse ouverte « le troisième est le plus fou » ;
- suivi 1 · 2 · ? en bas de l'écran, où le N° 3 reste « ? » jusqu'à son tour ;
- chaque fait raconté en trois temps : accroche, détails chiffrés, retournement ;
- fin « partager un savoir ».

Uniquement des photos réelles et des détourages. Seuls sont en HTML :

- le texte, les pastilles et les tampons ;
- la règle de mesure, les cadres rouges, les barres de surface et la frise ;
- la carte vide, la bulle, la flèche et le viseur.

| Partie | Image / objet | Transition vers la suivante |
|---|---|---|
| Accroche | viseur REC ; trois cartes : Lune et Pluton (détourées) et une photo de requin floutée sous un « ? » ; la carte N° 3 passe devant, tampon « LE PLUS FOU » | inondation bleu ardoise (sortie de la carte Lune) |
| N° 1 · la Lune et l'Australie | carte en relief de l'Australie (NASA) ; la Lune monte sur la carte assombrie, son diamètre est tracé et compté (« 3 474 km ») ; la Lune se range dans un coin, une règle traverse le pays (« ≈ 4 000 km ») ; la Lune se pose **à la même échelle** sur la carte, les deux bords qui dépassent clignotent en rouge, tampon « ÇA DÉPASSE ! » | page poussée vers le haut |
| N° 2 · Pluton et la Russie | Pluton détouré (image New Horizons) qui tourne lentement, contre une photo de Saint-Basile (Moscou), « VS », « MONTAGNES DE GLACE », cercle rouge sur le cœur blanc ; deux barres de surface comptées (17,7 et 17,1 millions de km²), tampon « 97 % » | iris |
| N° 3 · requins et arbres | photo d'un requin, « REQUINS », tampon « PLUS VIEUX ! », petite photo de forêt « ARBRES » ; dent de requin fossile détourée, compteur « IL Y A 450 M D'ANNÉES » | page poussée à gauche |
| La frise | forêt de séquoias ; frise 450 M (requins) → 385 M (arbres) → aujourd'hui, crochet « 65 M D'ANNÉES D'ÉCART » ; un squelette de T. rex détouré entre dans la photo, repère « ≈ 230 M », « 200 M D'ANNÉES APRÈS » | **inondation noire tenue pendant le scratch** (« Bilan : » en blanc) |
| Bilan | la Terre vue de l'espace, « PLUS VIEILLE », « PLUS GRANDE » | page poussée vers le haut |
| Question | les trois faits en pastilles, carte blanche vide « Mon fait encore plus fou : » avec curseur, « Répondez ici », flèche vers les commentaires | — |

## Contenu

- **Sujets donnés par le client** : « Les requins existaient avant les arbres », « L'Australie est plus large que la Lune », « La Russie a une superficie plus grande que celle de Pluton ». Ordre choisi pour finir sur le plus surprenant (requins).
- **Vérification des faits** :
  - **Australie et Lune** : l'Australie mesure environ 4 000 km d'est en ouest, la Lune 3 474 km de diamètre. **Vrai.**
  - **Requins et arbres** :
    - les premiers requins datent d'environ 450 millions d'années (écailles de l'Ordovicien) ;
    - les premiers arbres (*Wattieza*, *Archaeopteris*) datent d'environ 385 millions d'années ;
    - les premiers dinosaures datent d'environ 230 millions d'années.
    - **Vrai.**
  - **Russie et Pluton : formule dépassée.**
    - Depuis New Horizons (2015), le rayon de Pluton est estimé à 1 188 km, ce qui donne une surface d'environ 17,7 millions de km².
    - La Russie mesure environ 17,1 millions de km², donc un peu moins que Pluton.
    - La voix dit donc honnêtement « presque aussi grand que toute une planète » (97 %), et les barres le montrent.
- **Carte de la Lune sur l'Australie** :
  - La Lune est posée à l'échelle de la carte : son diamètre vaut 3 474 / 4 000 de la largeur de l'Australie mesurée sur l'image.
  - La carte n'est pas en projection exacte, donc l'échelle est approchée, mais l'ordre de grandeur est juste.
- **Nombres** : la voix les dit en toutes lettres et l'écran les affiche en chiffres. Les mots en trop d'un nombre sont vides dans `WORDS`, avec `.w:empty { display: none }`.
- **Créole à l'écran** : seulement dans les mots fantômes PYEBWA et LATÈ.

## Production

- **Voix** :
  - FLORA / Gemini TTS « Charon » (fr-FR), 2 prises (≈ 0,026 $). La 2ᵉ est gardée : elle est plus longue (71 s brutes), ce qui permet de viser 65 s.
  - Pauses raccourcies, respiration ajoutée avant chaque « Numéro », silence avant « Bilan », tempo ×1,05 → `assets/vo/vo.wav` (64,5 s).
  - Temps des mots : la voix est découpée à chaque pause et chaque morceau est transcrit seul (Whisper, nombres réécrits en lettres). Les mots sont ensuite répartis selon leur nombre de syllabes.
- **Musique** : `../_engine/style-histoire/musique-bed.mp3`, bouclée ; coupure au scratch, retour sur « la Terre », baissée sous la question.
- **Sons** : effets de la série (souffles, pops, tampons, montées sous les compteurs et les barres, roulement, scratch…) et un carillon chaque fois qu'un fait du suivi se remplit. Ils restent toujours sous la voix.
- **Images** : **Magnific** (catalogue Freepik, licence de l'abonnement du client, recherches sans images générées par IA ; 0 crédit dépensé) :
  - `lune-cut.png` : « Beautiful glowing gray full moon », disque découpé.
  - `pluton-cut.png` : « Planet Pluto in space — elements furnished by NASA », image New Horizons, disque découpé.
  - `russie.jpg` : « Saint Basil's Cathedral in Red Square in Moscow, Russia ».
  - `requin.jpg` : « Shark in the sea ».
  - `dent-cut.png` : « Fossil shark tooth from Eocene period, Khouribga, Morocco », détourée.
  - `foret.jpg` : « Giant Redwood trees in the Redwood National and State Parks ».
  - `trex-cut.png` : « Fossil skeleton of Dinosaur king Tyrannosaurus Rex », détouré.
  - `terre.jpg` : « Satellite image of Earth. Original from NASA ».
  - **`australie.jpg` vient de la NASA**, pas de Magnific. Magnific ne proposait que des rendus 3D de l'Australie vue de l'espace. L'image est « Australia, Shaded Relief and Colored Height », PIA06665, NASA/JPL/NGA (mission radar SRTM), domaine public, téléchargée sur images.nasa.gov. C'est une carte du relief mesuré, pas une illustration.
  - Détourages : `rembg -m birefnet-general`, une image à la fois. Les disques Lune et Pluton sont découpés en cercle.
  - Polices embarquées (SIL OFL) : Poppins 500–900.
- **Typographie** : Poppins de la série avec les effets de la vidéo de référence (mots en gris clair qui foncent à la voix, gros mots en dégradé avec reflet, cases de couleur). Une couleur par fait, prise dans sa photo : ardoise pour la Lune, ocre pour l'Australie, brun-rouge pour Pluton, rouge pour la Russie, bleu-vert pour le requin, vert pour les arbres, ambre pour les dinosaures.
- **Rendu** :
  1. `npx --yes hyperframes@0.8.168 render --fps 120 --quality looks --output renders/raw120.mp4`
  2. `python3 -I ../_engine/style-histoire/finish.py renders/raw120.mp4 renders/3-faits.mp4`
  MP4 non commités.
