# « C'est quoi ton ti non ? » — les surnoms haïtiens

Composition HyperFrames écrite à la main (`index.html`), 9:16, 26,9 s, style « histoire express » v3 (`../_engine/style-histoire/README.md`), avec la fin « partager un savoir » (chacun écrit son ti non en commentaire). Pastille « CULTURE D'HAÏTI · TI NON ».

| Partie | Image / objet | Transition vers la suivante |
|---|---|---|
| Accroche | viseur REC, carte d'identité sur disque orange, compteur « UNE PERSONNE · 1 NOM » qui passe à « 2 NOMS » sur « deux », l'autocollant « Ti Jo » se colle sur le prénom au mot « ti non » | inondation orange depuis l'autocollant (sur « Bòbòt ») |
| Les surnoms | un autocollant par surnom : Ti Jo, Bòbòt, Black Indien, Fanfan, Choupèt | page poussée à gauche |
| L'enfance | photo d'enfants en Haïti, puis un homme âgé détouré avec l'autocollant « Ti Jo », tampon « À VIE » | page poussée vers le haut |
| L'origine | quatre cartes : prénom court (Jean-Joseph → Ti Jo), physique (Black Indien), manie, histoire | iris |
| Le quartier | photo d'un marché, un homme détouré, bulle « FANFAN ! » sur « qu'on crie » | **inondation noire depuis la bulle, tenue pendant le scratch** (« Bilan : » en blanc) |
| Bilan | visage sur disque orange, la carte d'identité qui grisonne (« vos papiers »), un cœur « ti non » qui bat | page poussée vers le haut |
| Question | autocollant vide « Mon ti non : » avec curseur, « Répondez ici », flèche vers les commentaires | — |

- **Contenu** : texte de culture générale fourni par le client (exemples Ti Jo, Bòbòt, Black Indien) ; « ti non » = « petit nom » en créole. Les personnes photographiées et les surnoms qui leur sont associés à l'écran sont **illustratifs**, pas leurs vrais surnoms ; la carte d'identité est dessinée, sans emblème, avec un nom fictif.
- **Voix** : FLORA / Gemini TTS « Charon » (fr-FR), surnoms écrits phonétiquement pour la voix (« Bobotte », « Blak Indien », « Choupette ») et en créole à l'écran ; 2ᵉ prise gardée (la 1ʳᵉ sautait la liste des surnoms). Temps des mots posés à la main sur les passages de parole mesurés (silences + comptage des syllabes), pauses raccourcies, silence allongé avant « Bilan » et avant « Écris-le », `atempo=1.1` → `assets/vo/vo.wav` (25,2 s). Coût ≈ 0,026 $ (2 prises).
- **Musique** : `../_engine/style-histoire/musique-bed.mp3`, bouclée ; coupure au scratch, retour sur « votre vrai prénom », baissée sous la question.
- **Sons** : 54 effets (clics d'autocollants, pops, whooshs, basses, carillon, scintillements, scratch avant « Bilan »), toujours sous la voix.
- **Images** :
  - `homme1-cut.png`, `homme2-cut.png`, `homme3-cut.png` : photos d'hommes haïtiens **fournies par le client**, détourées (`rembg -m birefnet-general`) ; droits et accord des personnes à vérifier par le client avant publication ;
  - `enfants.jpg` : enfants souriants, Haïti, TopSphere Media, Unsplash (photo `rWEUBzbp2rc`) ;
  - `marche.jpg` : femmes haïtiennes au marché, Heather Suggitt, Unsplash (photo `5pFiifvkpR4`) ;
  - carte d'identité, autocollants, cartes, bulle, cœur, viseur : dessinés en HTML/SVG ; écriture manuscrite `assets/fonts/caveat-700.woff2` (Caveat, SIL OFL).
- **Contrôle** : `hyperframes check` signale l'autocollant « Ti Jo » posé sur le prénom de la carte (chevauchement voulu).
- **Rendu** :
  1. `npx --yes hyperframes@0.8.168 render --fps 120 --quality looks --output renders/raw120.mp4`
  2. `python3 -I ../_engine/style-histoire/finish.py renders/raw120.mp4 renders/ti-non.mp4`
  MP4 non commités.
