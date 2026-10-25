# « Ta famille mangeait quoi ? » — le repas du dimanche en Haïti

Composition HyperFrames écrite à la main (`index.html`), 9:16, **≈ 65,2 s**, style « histoire express » v3 (`../_engine/style-histoire/README.md`), avec les règles « chaque seconde compte » (accroche concrète, promesse ouverte : « pour le dernier, les enfants vont se battre », menu de cinq assiettes qui se remplit et dont le N° 5 reste « ? » jusqu'au bout, humour, fin « partager un savoir »). Pastille « CULTURE D'HAÏTI · LE REPAS DU DIMANCHE ». Uniquement des photos réelles et des détourages ; seuls le texte, les pastilles, tampons, le menu numéroté, le cercle rouge, la carte vide, la bulle, la flèche et le viseur sont en HTML.

| Partie | Image / objet | Transition vers la suivante |
|---|---|---|
| Accroche | viseur REC ; **dès la première image**, une grand-mère qui sert à table ; horloge « DIMANCHE » 06:40 → 07:00 ; oignon, ail et piment détourés (l'épis) ; tampon « 5 PLATS » ; le menu 1 2 3 4 ? apparaît | inondation bleu marine |
| La messe | garçon en chemise blanche et cravate (détouré), « HABITS DU DIMANCHE », chaussures vernies qui brillent, tampon « INTERDIT DE SE SALIR » | page poussée vers le haut |
| Les marmites, N° 1 | photo d'un poulet qui mijote (gros plan), « LES MARMITES TRAVAILLENT », « ÇA SENT JUSQUE DANS LA RUE » ; riz aux pois rouges, tampon « LE FOND QUI CROUSTILLE » | iris |
| N° 2 | poulet en sauce, « MIJOTE DEPUIS 7 H » | page poussée à gauche |
| N° 3 | pile de banane pesée (détourage de `../bannann/`), tampon « BIEN SÛR ! » | page poussée vers le haut |
| N° 4 | salade de betterave rose, « TOUTE ROSE », tampon « LA NAPPE BLANCHE ! » | inondation dorée |
| N° 5 | macaroni au gratin, zoom sur le coin, cercle rouge, « LE COIN GRILLÉ », tampon créole « PA PATAJE ! » | page poussée vers le haut |
| Chez grand-mère | famille à table ; radio détourée qui vibre, « LES ONCLES PARLENT FORT », verre de jus de grenadia détouré, « LES GRANDS D'ABORD », tampon « LE COU DU POULET » ; l'image s'assombrit, tampon « SIESTE » | **inondation noire tenue pendant le scratch** (« Bilan : » en blanc) |
| Bilan | grand-mère et petit-fils à table, « 1 REPAS PAR SEMAINE », « TOUTE LA FAMILLE » | page poussée vers le haut |
| Question | les cinq plats en pastilles, carte blanche vide « Chez nous, le dimanche : » avec curseur, « Répondez ici », flèche vers les commentaires | — |

## Contenu

- **Sujet donné par le client** : le repas du dimanche ; question « Ta famille mangeait quoi ? ».
- Les plats cités (riz collé aux pois rouges et son gratin du fond de marmite, poulet en sauce, banane pesée, salade de betterave rose, macaroni au gratin, jus de grenadia) sont ceux qu'on retrouve couramment sur la table du dimanche en Haïti ; ils sont présentés comme des souvenirs de famille (« on mangeait »), pas comme une liste officielle. L'épis est la base d'assaisonnement haïtienne (ail, oignon, piment, herbes).
- Noms de plats écrits **en français** dans la voix et à l'écran (règle du guide : la voix fr-FR prononce mal le créole écrit). Créole dans les mots fantômes (DIMANCH, LAMÈS, DIRI, POUL, PEZE, SALAD, GRATEN, LAKAY, FANMI) et le tampon « PA PATAJE ! ».

## Production

- **Voix** : FLORA / Gemini TTS « Charon » (fr-FR), ton « souvenir de famille qu'on partage en souriant », guide de prononciation pour « épis » et « grenadia ». Une première version du texte donnait 53–56 s : texte allongé de quatre détails vécus (l'odeur dans la rue, « pas de dimanche sans elle », la nappe blanche, la sieste), puis 2 nouvelles prises ; la 2<sup>e</sup> gardée. Coût total ≈ 0,052 $. Pauses raccourcies, courte respiration avant chaque plat, silence avant « Bilan », tempo ×1,05 → `assets/vo/vo.wav` (63,5 s). Temps des mots : voix découpée à chaque pause, chaque morceau transcrit seul (Whisper), mots répartis au nombre de syllabes.
- **Musique** : `../_engine/style-histoire/musique-bed.mp3`, bouclée ; coupure au scratch, retour sur « un seul repas », baissée sous la question.
- **Sons** : effets de la série (souffles, pops, tampons, scratch…) et un carillon chaque fois qu'une assiette du menu se remplit ; toujours sous la voix.
- **Images** : **Magnific** (catalogue Freepik, licence de l'abonnement du client, recherches sans images générées par IA ; 0 crédit dépensé) :
  - `grandmere.jpg` « Happy African American grandmother serving food for grandson… dinner » ; `table.jpg` « Multigeneration family around table serving and eating meal at home together » ;
  - `riz.jpg` « Bowl of rice with beans » ; `poulet.jpg` « Rustic chicken and tomato casserole » ; `betterave.jpg` « Beet salad vinaigrette in a pink bowl » ; `macaroni.jpg` « Baked macaroni and cheese in baking dish » ; `peze-cut.png` repris de `../bannann/` (« Tostones traditional Caribbean dish twice fried plantains ») ;
  - détourés (`rembg -m birefnet-general`) : `epis-cut.png` « Blue onion garlic and hot red pepper isolated » ; `garcon-cut.png` « Neat dark skinned male elementary pupil… white shirt and black tie » ; `chaussures-cut.png` « Pair of little black girl's shoes » ; `radio-cut.png` « Beige retro radio receiver isolated » ; `jus-cut.png` « Fresh passion fruit juice glass isolated » ;
  - polices embarquées (SIL OFL) : Poppins 500–900.
- **Typographie** : Poppins de la série avec les effets de la vidéo de référence (mots en gris clair qui foncent à la voix, gros mots en dégradé avec reflet, cases de couleur) ; une couleur par plat, prise dans sa photo (brun riz, rouge sauce, ambre banane, magenta betterave, or gratin), vert pour la table, bleu Haïti au Bilan.
- **Rendu** :
  1. `npx --yes hyperframes@0.8.168 render --fps 120 --quality looks --output renders/raw120.mp4`
  2. `python3 -I ../_engine/style-histoire/finish.py renders/raw120.mp4 renders/repas-dimanche.mp4`
  MP4 non commités.
