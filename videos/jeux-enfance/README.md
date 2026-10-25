# « Ton jeu préféré ? » — les jeux d'enfance en Haïti

Composition HyperFrames écrite à la main (`index.html`), 9:16, **≈ 64 s** (format « 1 minute ou plus »), style « histoire express » v3 (`../_engine/style-histoire/README.md`), avec la fin « partager un savoir » : chacun écrit en commentaire son jeu préféré. Pastille « CULTURE D'HAÏTI · JEUX D'ENFANCE ». Les jeux sont numérotés (N° 1 à N° 9) pour qu'on puisse répondre d'un numéro. Uniquement des images réelles (photos, tableau ancien, détourages) ; seuls le texte, les pastilles, tampons, croix rouges, la bulle, la flèche et le viseur sont en HTML.

| Partie | Image / objet | Transition vers la suivante |
|---|---|---|
| Accroche | viseur REC ; **dès la première image**, une fillette haïtienne qui rit, bras levés (détourée) ; un vrai téléphone puis un vrai nounours, barrés ; horloge « IL EST » 15:00 → 19:00 (passe au rouge), tampon « JUSQU'À LA NUIT » | inondation brun bois |
| N° 1 oslè | tableau « Les osselets » de Vladimir Makovsky (1870) ; trois vrais os et un caillou détourés : un est lancé en l'air, les autres ramassés, il est rattrapé | page poussée vers le haut |
| Très vieux | photo d'os antiques (époque romaine, Silchester), compteur « IL Y A » 0 → 2 500 ANS, pastilles « GRÈCE ANTIQUE » et « OS DE MOUTON » | iris |
| N° 2 marèl | marelle tracée à la craie (photo), un vrai caillou y tombe, photo d'un pied qui saute, tampon créole « PA PILE LIY LAN ! » | inondation verte |
| N° 3 lago kache | photo d'un garçon qui compte contre un mur, chiffres 1 → 10 qui suivent la voix ; la cour se vide ; photo d'un enfant caché derrière un arbre, « SOUS UN LIT », photo de linge qui sèche | page poussée à gauche |
| N° 4 et 5 | photo de billes (mab), photo d'un cerf-volant (kap) au coucher du soleil | page poussée vers le haut |
| N° 6 à 9 | cordes à sauter, vraie toupie détourée qui tourne, enfants en cercle (ronde), enfants qui font rouler de vieux pneus | inondation bleue |
| Personne ne les a achetés | garçon haïtien détouré, tampon « 0 HTG », « GRANDS → PETITS », « COUR → COUR », « QUARTIER → QUARTIER » | **inondation noire tenue pendant le scratch** (« Bilan : » en blanc) |
| Bilan | photo d'enfants haïtiens qui rient, « PRESQUE RIEN » / « MAIS TOUT » | page poussée vers le haut |
| Question | les neuf jeux en pastilles numérotées, vraie ardoise d'écolier vide « Mon jeu préféré : » avec curseur, « Répondez ici », flèche vers les commentaires | — |

## Contenu

- **Sujet donné par le client** : oslè, marèl, lago kache ; question « Ton jeu préféré ? ». Les autres jeux cités (billes / mab, kap, corde à sauter, toupie, ronde, vieux pneu roulé avec un bâton) sont des jeux de cour très répandus en Haïti, présentés comme des souvenirs (« vous jouiez »), pas comme des statistiques.
- Le jeu d'osselets est attesté dans la Grèce antique (os d'astragale de mouton ou de chèvre) ; l'image montre des os **d'époque romaine** (Silchester, Angleterre), légendée comme telle.
- Créole à l'écran : OSLÈ, MARÈL, LAGO KACHE, MAB, KAP, « PA PILE LIY LAN ! » (« ne marche pas sur la ligne ! »), mots fantômes JWE, LONTAN, KACHE, TOUPI, LAKOU, RI.

## Production

- **Voix** : FLORA / Gemini TTS « Charon » (fr-FR). 4 prises : les deux premières disaient « osselet » ou étaient trop courtes ; la 3ᵉ, avec un guide de prononciation créole (« oss-lè » en deux syllabes), est gardée (elle dit aussi « oslè » au lieu de « osselets » dans la phrase sur la Grèce). Pauses raccourcies, silence avant « Bilan » et « Écris-le » → `assets/vo/vo.wav`. Temps des mots : la voix est découpée à chaque pause et chaque morceau transcrit seul (Whisper), puis les mots sont répartis dans leur morceau au nombre de syllabes. Coût ≈ 0,052 $.
- **Musique** : `../_engine/style-histoire/musique-bed.mp3`, bouclée ; coupure au scratch, retour sur « on n'avait », baissée sous la question.
- **Sons** : effets de la série (souffles, pops, claques, tampons, grains, roulement, scratch avant « Bilan »), toujours sous la voix.
- **Images** :
  - Unsplash (licence Unsplash) : `fillette-cut.png` et `enfants-rires.jpg` enfants haïtiens, TopSphere Media (`rWEUBzbp2rc`), détourée pour l'accroche ; `garcon-cut.png` garçon en Haïti, Tim Trad (`sS28i1H39AY`), détouré ; `marel.jpg` marelle à la craie, Laura Rivera (`MRlFZs_WZdI`) ; `cache-arbre.jpg` enfant caché derrière un arbre, Annie Spratt (`lKZ3U43w2bs`) ; `toupie-cut.png` toupie en bois, Markus Spiske (`hGb5WqRrWIg`), détourée ; `ronde.jpg` enfants en cercle, Akshat Jhingran (`dX_ti12nQw0`) ;
  - Pixabay (licence Pixabay) : `compte-mur.jpg` Cle31 (3134482) ; `kap.jpg` cocoparisienne (2887483) ; `cordes.jpg` Hans (609720) ; `pneus.jpg` trilemedia (5833685) ; `billes.jpg` Couleur (1659398) ; `marel-pieds.jpg` 422737 (919676) ; `linge.jpg` wilhei (963150) ; `ardoise-droite.jpg` ha11ok (1223872), redressée et recadrée ; `telephone-cut.png` Fermabloxxx (1682317) ; `nounours-cut.png` Pezibear (1085162) ; `caillou-cut.png` Alexas_Fotos (2764291), un seul galet détouré ;
  - Wikimedia Commons : `makovsky-osselets.jpg` Vladimir Makovsky, *Les osselets* (1870), domaine public ; `os-antiques.jpg` et `os1/2/3-cut.png` « Roman knucklebones from Silchester », BabelStone, **CC BY-SA 3.0** ;
  - écriture manuscrite `assets/fonts/caveat-700.woff2` (Caveat, SIL OFL).
- **Rendu** :
  1. `npx --yes hyperframes@0.8.168 render --fps 120 --quality looks --output renders/raw120.mp4`
  2. `python3 -I ../_engine/style-histoire/finish.py renders/raw120.mp4 renders/jeux-enfance.mp4`
  MP4 non commités.
