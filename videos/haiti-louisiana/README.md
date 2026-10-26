# « Haiti helped the US double in size » — version anglaise pour le public américain

Première vidéo en **anglais** de la série, pensée pour les spectateurs des États-Unis (les vues des États-Unis sont éligibles au Programme de récompenses ; voir « TikTok : recommandation, recherche et monétisation » dans `../_engine/style-histoire/README.md`).

- Composition HyperFrames écrite à la main (`index.html`), 9:16, style « histoire express » v3 + typographie v5.
- Pastille « HIDDEN HISTORY · HAITI × USA ».
- Une histoire en trois temps :
  - **accroche** : « Haiti helped the US double in size », avec la carte d'époque dès la première image ;
  - **détails surprenants** : Napoléon et Saint-Domingue, l'armée détruite par les combattants et la fièvre jaune, la vente de la Louisiane, 15 millions de dollars, moins de 3 cents l'acre ;
  - **retournement** : les États-Unis refusent de reconnaître Haïti pendant 58 ans.
- Une frise de dates 1802 · 1803 · 1804 · ? en bas de l'écran ; le « ? » devient 1862 au retournement.
- Fin « partager un savoir » : « What else did your history class skip? »

Uniquement des images réelles : photos, tableaux et une vraie carte de 1919. Seuls sont en HTML :

- le texte, les pastilles et les tampons ;
- les zones colorées de la carte (calculées à partir des couleurs de la carte elle-même), la frise de dates et les compteurs ;
- la carte vide, la bulle, la flèche et le viseur.

| Partie | Image / objet | Transition vers la suivante |
|---|---|---|
| Accroche | viseur REC ; **dès la première image** la carte « Louisiana Purchase, 1803 » (1919), les États-Unis de 1803 en bleu ; un drapeau haïtien se pose dessus ; sur « double », l'achat de la Louisiane s'allume en vert, tampon « ×2 » ; tampon « NOT IN YOUR TEXTBOOK » | inondation bleu marine |
| 1802 | portrait de Napoléon (J.-L. David) ; champ de canne à sucre, « SAINT-DOMINGUE = HAITI », « SUGAR · COFFEE », tampon « RICHEST COLONY » | page poussée vers le haut |
| La révolution | portrait de Toussaint Louverture, « THE ENSLAVED RISE UP » ; Napoléon revient, compteur « 20,000+ SOLDIERS » | iris |
| Le désastre | tableau de bataille à Saint-Domingue (J. Suchodolski, 1845), tampon « DISASTER », moustique de la fièvre jaune détouré qui arrive en bourdonnant, « YELLOW FEVER », « GEN. LECLERC † 1802 » | page poussée à gauche |
| La vente | la carte : « LOUISIANA » qui clignote, tampons « FOR SALE » puis « SOLD » ; photo de dollars, compteur « $15,000,000 », « LESS THAN 3¢ AN ACRE » ; l'achat s'allume pour de bon, « ×2 », « 15 STATES » | inondation bleu Haïti |
| 1804 | portrait de Jean-Jacques Dessalines, drapeau haïtien, « JAN 1 · 1804 », « FIRST FREE BLACK REPUBLIC » | page poussée vers le haut |
| Le retournement | drapeau, tampon « NOT RECOGNIZED », compteur « 58 YEARS », photo d'Abraham Lincoln « 1862 · LINCOLN FINALLY SAYS YES » | **inondation noire tenue pendant le scratch** (« Bottom line: » en blanc) |
| Bottom line | la carte avec les deux zones, le drapeau, « THANK YOU, HAITI » | page poussée vers le haut |
| Question | les quatre dates en pastilles, carte blanche « My history class skipped: » avec curseur, « Answer here », flèche vers les commentaires | — |

## Contenu (faits vérifiés)

- **Saint-Domingue** (Haïti) était la colonie la plus riche du monde à la fin du XVIIIᵉ siècle, grâce au sucre et au café. Les esclaves se soulèvent en 1791, avec Toussaint Louverture à leur tête.
- **L'expédition Leclerc (1802)** :
  - Napoléon envoie plus de 20 000 soldats ; d'autres renforts suivent ensuite.
  - L'armée est décimée par les combats et par la fièvre jaune.
  - Le général Leclerc meurt de la fièvre jaune en novembre 1802.
- **La vente de la Louisiane (traité du 30 avril 1803)** :
  - Le prix est de 15 millions de dollars, pour environ 828 000 milles carrés, soit moins de 3 cents l'acre (hors intérêts).
  - La surface des États-Unis double.
  - 15 États actuels sont issus, en tout ou en partie, de ce territoire.
- **Le lien avec Haïti** :
  - Les historiens retiennent l'échec de l'expédition de Saint-Domingue comme une raison majeure de la vente.
  - Sans cette colonie, la Louisiane, qui devait la ravitailler, perdait son intérêt pour Napoléon.
  - La reprise de la guerre avec la Grande-Bretagne a aussi compté. D'où la formule « Haiti **helped** », et non « Haiti caused ».
- **Indépendance et reconnaissance** :
  - Dessalines proclame l'indépendance le 1ᵉʳ janvier 1804.
  - Les États-Unis ne reconnaissent Haïti qu'en 1862, sous Lincoln, soit 58 ans plus tard.

## Production

- **Voix** :
  - FLORA / Gemini TTS « Charon » (**en-US**), ton « conteur d'histoire américain », guide de prononciation pour « Saint-Domingue ». 2 prises (≈ 0,026 $), la 1ʳᵉ est gardée.
  - Pauses raccourcies, silence avant « Bottom line », tempo ×1,1.
  - Temps des mots : la voix est découpée à chaque pause et chaque morceau est transcrit seul (Whisper, anglais). Les mots sont ensuite répartis selon leur nombre de syllabes.
- **Nombres** : dits en toutes lettres par la voix, affichés en chiffres à l'écran (« 1802 », « 20,000 », « $15 million », « 3¢ », « 58 »).
- **Musique** : `../_engine/style-histoire/musique-bed.mp3`, bouclée ; coupure au scratch, retour sur « part of the American map », baissée sous la question.
- **Sons** : effets de la série, un carillon à chaque date de la frise ; toujours sous la voix.
- **Images** :
  - **Magnific** (catalogue Freepik, licence de l'abonnement du client, recherches sans images générées par IA ; 0 crédit dépensé) :
    - `drapeau.jpg` : « Closeup shot of the waving flag of Haiti » ;
    - `canne.jpg` : « Lush green sugarcane field » ;
    - `dollars.jpg` : « Closeup american dollar bills on a black background » ;
    - `moustique-cut.png` : « Adult female yellow fever mosquito », détouré.
  - **Domaine public** (aucune carte ni aucun portrait d'époque dans Magnific) :
    - `carte.jpg` : *Louisiana Purchase, 1803. Florida Purchase, 1819*, planche 21 de *McConnell's historical maps of the United States* (1919), Bibliothèque du Congrès (loc.gov/item/2009581130), recadrée. `carte-usa.png` et `carte-achat.png` sont des masques calculés à partir des couleurs de la carte (rose = États-Unis de 1803, vert = achat de la Louisiane), teintés en bleu et en vert.
    - `napoleon.jpg`, `toussaint.jpg`, `dessalines.jpg`, `bataille.jpg` : repris de `../haiti-1804/` (Wikimedia Commons, domaine public). La bataille est le tableau de J. Suchodolski (1845), d'où la légende générique « Battle in Saint-Domingue ».
    - `lincoln.jpg` : *Abraham Lincoln, O-77 matte collodion print* (1863, Wikimedia Commons, domaine public).
  - Polices embarquées (SIL OFL) : Poppins 500–900.
- **Rendu** :
  1. `npx --yes hyperframes@0.8.168 render --fps 120 --quality looks --output renders/raw120.mp4`
  2. `python3 -I ../_engine/style-histoire/finish.py renders/raw120.mp4 renders/haiti-louisiana.mp4`
  MP4 non commités.

## Publication (proposition)

- **Description** : « Haiti helped the United States double in size — and most history classes skip it. 1802, Napoleon, yellow fever, the Louisiana Purchase… #history #blackhistory #haiti #louisianapurchase #napoleon »
- Mots-clés dits et écrits à l'écran : Haiti, Napoleon, Louisiana, Louisiana Purchase, United States, 1803, Lincoln.
- **Heure** : soirée à New York (19 h–21 h), c'est-à-dire la même heure en Haïti.
- Juger après 3 à 5 vidéos en anglais, sur la part de « vues admissibles » et sur les pays des spectateurs.
