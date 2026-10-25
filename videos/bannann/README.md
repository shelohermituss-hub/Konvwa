# « Ton camp ? » — bannann peze ou bannann bouyi

Premier épisode du format **Débats** (les gens défendent leur camp en commentaire). Composition HyperFrames écrite à la main (`index.html`), 9:16, **≈ 63,5 s**, style « histoire express » v3 (`../_engine/style-histoire/README.md`), avec les règles « chaque seconde compte » (accroche inattendue, promesse ouverte, tableau de score qui donne une raison de rester, humour, fin qui fait commenter **et** identifier quelqu'un). Pastille « DÉBAT · KWIZIN HAÏTI ». Uniquement des photos réelles et des détourages ; seuls le texte, les pastilles, tampons, croix rouges, le « VS », le tableau de score, les boutons, la bulle, la flèche et le viseur sont en HTML.

| Partie | Image / objet | Transition vers la suivante |
|---|---|---|
| Accroche | viseur REC ; **dès la première image**, une pile de bannann peze et un régime de plantain vert (détourés) se font face, deux gants de boxe se cognent, « VS » ; « les deux » est barré ; le tableau PEZE 0 – 0 BOUYI apparaît sur « ton camp » | inondation ambre (sortie de la pile) |
| Camp N° 1 · peze | trois plantains verts, photo de friture « 1<sup>re</sup> friture », planche de bannann peze écrasés qui s'écrase en tombant, « 2<sup>e</sup> friture », tampon « CRAC ! » ; puis griot, pikliz et la pile, tampon « ÇA PIQUE ! » | inondation verte (sortie du régime) |
| Camp N° 2 · bouyi | photo d'une marmite qui bout (« cuit dans l'eau »), « TOUT SIMPLE », « TOUT TENDRE » ; le matin : hareng fumé (aransò), avocat, œufs durs détourés, horloge 07:00 → 18:00 | iris (on entre dans le ring) |
| Rounds 1 et 2 | cloche de ring ; « ROUND 1 · le croquant » : assiette de bannann peze, « CRAC ! », +1 PEZE ; « ROUND 2 · la santé » : bouteille d'huile barrée, « 0 GOUTTE D'HUILE », +1 BOUYI | page poussée vers le haut |
| Rounds 3 et 4 | « ROUND 3 · la fête » : famille à table, pastilles BAPTÊME, MARIAGE, 1<sup>re</sup> COMMUNION, la pile de peze arrive sur la table, +1 PEZE ; « ROUND 4 · le portefeuille » : cuisinier avec sa marmite, « PRÊT ! », huile barrée, +1 BOUYI | page poussée à gauche |
| Les piques | « camp peze » (femme qui crie) : homme enrhumé, tampon « PLAT DE MALADE ?! » ; « camp bouyi » (femme outrée) : la bouteille d'huile se renverse sur la pile de peze | **inondation noire tenue pendant le scratch** (« Bilan : » en blanc) |
| Bilan | 2 – 2, les trois plantains verts (« c'est la même banane »), tampon « ÉGALITÉ » | page poussée vers le haut |
| Question | pile de peze et régime, boutons PEZE / VS / BOUYI qui battent, « @ IDENTIFIE LE CAMP D'EN FACE », « Répondez ici », flèche vers les commentaires | — |

## Contenu

- **Sujet donné par le client** : « Bannann peze ou bannann bouyi ? », question « Ton camp ? ».
- Faits : le bannann peze est du plantain vert coupé en rondelles, frit, écrasé puis refrit, servi avec griot et pikliz (plateaux de fête) ; le bannann bouyi est cuit à l'eau, sans huile, mangé le matin avec aransò (hareng fumé), avocat ou œuf. Les rounds et les piques (« plat de malade », « de l'huile avec un peu de banane ») sont des taquineries de débat, pas des statistiques ; le score finit à égalité pour laisser le spectateur départager.
- Créole à l'écran : BANNANN PEZE, BANNANN BOUYI, PIKLIZ, ARANSÒ, KWIZIN, mots fantômes PEZE, BOUYI, FÈT, DEBA.

## Production

- **Voix** : FLORA / Gemini TTS « Charon » (fr-FR), ton « présentateur de match de boxe », guide de prononciation créole dans la consigne. 2 prises (≈ 0,026 $), la 2<sup>e</sup> gardée. Pauses raccourcies, **pause ajoutée avant chaque round pour la cloche**, silence avant « Bilan », tempo ×1,05 (au lieu de ×1,1) pour rester au-dessus d'une minute → `assets/vo/vo.wav` (61,8 s). Temps des mots : voix découpée à chaque pause, chaque morceau transcrit seul (Whisper), mots répartis au nombre de syllabes.
- **Musique** : `../_engine/style-histoire/musique-bed.mp3`, bouclée ; coupure au scratch, retour sur « deux partout », baissée sous la question.
- **Sons** : effets de la série (souffles, pops, claques, tampons, grains, roulement, scratch) + `cloche.mp3`, cloche de ring **synthétisée** (sinusoïdes amorties, pas d'IA) ; toujours sous la voix.
- **Images** : **Magnific** (catalogue Freepik, licence de l'abonnement du client, recherches sans images générées par IA ; 0 crédit dépensé) :
  - `peze-assiette.jpg` « Tostones traditional Caribbean dish twice fried plantains » (et `peze-cut.png`, la pile détourée) ; `peze-planche.jpg` « Fried tostones, green bananas plantains… top view » ; `friture.jpg` « Deep fried plantain ready to serve » ;
  - `plantains-cut.png` « Three raw green plantains… isolated », `regime-cut.png` « Plantain or green banana isolated » ;
  - `griot-cut.png` « Crispy fried pork belly chunks » ; `pikliz-cut.png` « Cabbage salad with carrot pepper » ;
  - `marmite.jpg` « Close up boiling… soup or boiled water in hot pot » ; `aranso-cut.png` « Hot smoked fish, kippered herring » ; `avocat-cut.png` « Fresh avocado isolated » ; `oeuf-cut.png` « Hard boiled eggs whole and halved » ;
  - `gants-g.png` / `gants-d.png` « Red boxing gloves facing each other » ; `huile-cut.png` « Pouring cooking oil from plastic bottle » ; `fete.jpg` « Happy African American family having fun… lunch at dining table » ; `cuisinier-cut.png` « Young confident afro-american cook… holds saucepan » ; `dispute-g.png` / `dispute-d.png` « Angry displeased two ethnic sisters… scream » ; `malade-cut.png` « Ill African young man covered with blanket… » ;
  - **aucune vraie photo de bannann bouyi dans Magnific** : des photos réelles existent sur Wikimedia Commons (plantain bouilli / ampesi du Ghana), mais le site a refusé tous les téléchargements (erreur 429) pendant la fabrication ; la scène bouyi montre donc une vraie marmite qui bout, légendée « CUIT DANS L'EAU · À LA MARMITE ». À remplacer si une photo réelle de bannann bouyi est disponible.
  - Détourages : `rembg -m birefnet-general`, une image à la fois (en parallèle, la mémoire ne suffit pas).
  - Polices embarquées (SIL OFL) : Poppins 500–900.
- **Typographie** : Poppins de la série avec les effets de la vidéo de référence du client (aperçu typo de « Jeux d'enfance ») : mots en gris très clair qui foncent à la voix, gros mots en dégradé avec reflet, cases de couleur sur les mots clés ; ambre pour le camp peze, vert plantain pour le camp bouyi, magenta pour les piques, bleu Haïti au Bilan.
- **Rendu** :
  1. `npx --yes hyperframes@0.8.168 render --fps 120 --quality looks --output renders/raw120.mp4`
  2. `python3 -I ../_engine/style-histoire/finish.py renders/raw120.mp4 renders/bannann.mp4`
  MP4 non commités.
