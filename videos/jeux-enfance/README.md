# « Ton jeu préféré ? » — les jeux d'enfance en Haïti

Composition HyperFrames écrite à la main (`index.html`), 9:16, **≈ 64 s** (format « 1 minute ou plus »), style « histoire express » v3 (`../_engine/style-histoire/README.md`), avec la fin « partager un savoir » : chacun écrit en commentaire son jeu préféré. Pastille « CULTURE D'HAÏTI · JEUX D'ENFANCE ». Les jeux sont numérotés (N° 1 à N° 9) pour qu'on puisse répondre d'un numéro. Uniquement des images réelles (photos, tableau ancien, détourages) ; seuls le texte, les pastilles, tampons, croix rouges, la bulle, la flèche et le viseur sont en HTML.

| Partie | Image / objet | Transition vers la suivante |
|---|---|---|
| Accroche | viseur REC ; **dès la première image**, deux fillettes qui rient aux éclats (détourées) ; un vrai téléphone puis un vrai nounours, barrés ; horloge « IL EST » 15:00 → 19:00 (passe au rouge), tampon « JUSQU'À LA NUIT » | inondation brun bois |
| N° 1 oslè | tableau « Les osselets » de Vladimir Makovsky (1870) ; trois vrais os antiques et un galet détourés : un est lancé en l'air, les autres ramassés, il est rattrapé | page poussée vers le haut |
| Très vieux | photo d'os antiques (époque romaine, Silchester), compteur « IL Y A » 0 → 2 500 ANS, pastilles « GRÈCE ANTIQUE » et « OS DE MOUTON » | iris |
| N° 2 marèl | marelle tracée à la craie sur l'asphalte, un vrai galet y tombe, photo d'une enfant qui saute dans les cases, tampon créole « PA PILE LIY LAN ! » | inondation verte |
| N° 3 lago kache | photo d'un garçon qui se cache les yeux pour compter, chiffres 1 → 10 qui suivent la voix ; la cour se vide ; photo d'enfants cachés derrière un arbre, « SOUS UN LIT », photo de linge qui sèche | page poussée à gauche |
| N° 4 et 5 | photo d'enfants qui ramassent des billes (mab) par terre, photo d'enfants qui font voler un cerf-volant (kap) dans un village côtier tropical | page poussée vers le haut |
| N° 6 à 9 | enfants qui sautent à la corde, toupie en bois peinte avec sa ficelle, enfants en cercle mains levées (ronde), garçon qui fait rouler un vieux pneu | inondation bleue |
| Personne ne les a achetés | tampon « 0 HTG », photo d'une grande sœur et de son petit frère (« GRANDS → PETITS »), photo d'enfants qui jouent au ballon dans une cour en terre (« COUR → COUR », « QUARTIER → QUARTIER ») | **inondation noire tenue pendant le scratch** (« Bilan : » en blanc) |
| Bilan | photo d'enfants qui rient à une fenêtre en bois, « PRESQUE RIEN » / « MAIS TOUT » | page poussée vers le haut |
| Question | les neuf jeux en pastilles numérotées, vraie ardoise d'écolier vide (détourée) « Mon jeu préféré : » avec curseur, « Répondez ici », flèche vers les commentaires | — |

## Contenu

- **Sujet donné par le client** : oslè, marèl, lago kache ; question « Ton jeu préféré ? ». Les autres jeux cités (billes / mab, kap, corde à sauter, toupie, ronde, vieux pneu roulé avec un bâton) sont des jeux de cour très répandus en Haïti, présentés comme des souvenirs (« vous jouiez »), pas comme des statistiques.
- Le jeu d'osselets est attesté dans la Grèce antique (os d'astragale de mouton ou de chèvre) ; l'image montre des os **d'époque romaine** (Silchester, Angleterre), légendée comme telle.
- Créole à l'écran : OSLÈ, MARÈL, LAGO KACHE, MAB, KAP, « PA PILE LIY LAN ! » (« ne marche pas sur la ligne ! »), mots fantômes JWE, LONTAN, KACHE, TOUPI, LAKOU, RI.

## Production

- **Voix** : FLORA / Gemini TTS « Charon » (fr-FR). 4 prises : les deux premières disaient « osselet » ou étaient trop courtes ; la 3ᵉ, avec un guide de prononciation créole (« oss-lè » en deux syllabes), est gardée (elle dit aussi « oslè » au lieu de « osselets » dans la phrase sur la Grèce). Pauses raccourcies, silence avant « Bilan » et « Écris-le » → `assets/vo/vo.wav`. Temps des mots : la voix est découpée à chaque pause et chaque morceau transcrit seul (Whisper), puis les mots sont répartis dans leur morceau au nombre de syllabes. Coût ≈ 0,052 $.
- **Musique** : `../_engine/style-histoire/musique-bed.mp3`, bouclée ; coupure au scratch, retour sur « on n'avait », baissée sous la question.
- **Sons** : effets de la série (souffles, pops, claques, tampons, grains, roulement, scratch avant « Bilan »), toujours sous la voix.
- **Images** : **Magnific** (catalogue Freepik, licence Magnific/Freepik de l'abonnement du client, recherches toujours sans images générées par IA) :
  - accroche : `fillettes-cut.png` « Close-up smiley african girls portrait », détourée ; `telephone-cut.png` « New cell phone over white background », détouré ; `nounours-cut.png` « Cute brown teddy bear sitting on a white surface », détouré ;
  - `caillou-cut.png` « Pebble, smooth gray sea stone », détouré ;
  - `marel.jpg` « Hopscotch chalk drawing on asphalt pavement » ; `marel-pieds.jpg` « Girl jumping in chalk boxes drawn on asphalt » ;
  - `compte.jpg` « Dark-skinned little boy covering face with both hands… playing hide and seek » ; `cache-arbre.jpg` « Children friends and nature with hiding fun… tree trunk » ; `linge.jpg` « White laundry hanging on a string outdoors » ;
  - `billes.jpg` « Boys taking marbles on the ground for playing traditional games » ; `kap.jpg` « Black children flying colorful kite in tropical coastal village » ;
  - `corde.jpg` « Happy African American children jumping over the rope in the park » ; `toupie.jpg` « Colorful trompo on a brown surface » ; `ronde.jpg` « Happy fun group of African American children raised hands together in circle » ; `pneu.jpg` « Rear view of boy playing with tire on field » ;
  - `grands-petits.jpg` « Adorable african black kids » ; `lakou.jpg` « Full shot african kids playing with ball » ; `fenetre.jpg` « Medium shot african kids at window » ; `ardoise-cut.png` « Writing slate », détourée ;
  - **seule exception** (rien dans Magnific pour les osselets) — Wikimedia Commons : `makovsky-osselets.jpg` Vladimir Makovsky, *Les osselets* (1870), domaine public ; `os-antiques.jpg` et `os1/2/3-cut.png` « Roman knucklebones from Silchester », BabelStone, **CC BY-SA 3.0** (créditer en description de la publication) ;
  - polices embarquées (SIL OFL) : Poppins 500–900 (`poppins-*.woff2`) pour le message, Instrument Serif italique (`instrument-serif-400i.woff2`) pour les mots d'emphase, Caveat (`caveat-700.woff2`) pour l'écriture à la craie.
- **Typographie et couleurs** : « deux voix » (grotesque très serrée + serif italique, petits mots en gris doux) et une couleur d'accent par scène (bleu marine, brun bois, violet, bleu craie, vert, ambre, magenta, bleu Haïti) au lieu du rouge partout (demande du client).
- **Rendu** :
  1. `npx --yes hyperframes@0.8.168 render --fps 120 --quality looks --output renders/raw120.mp4`
  2. `python3 -I ../_engine/style-histoire/finish.py renders/raw120.mp4 renders/jeux-enfance.mp4`
  MP4 non commités.
