# « Une reine d'Haïti est enterrée en Italie » — Marie-Louise Christophe, Pise

Composition HyperFrames écrite à la main (`index.html`), 9:16, ≈ 34 s, style « histoire express » v2 (`../_engine/style-histoire/README.md`). Pastille « HISTOIRE D'HAÏTI · 1851 ».

Structure v2 inchangée, avec en plus des éléments « affiche » tirés des deux références du client : viseur de caméra au hook (coins, REC, timecode), disques rouges derrière des détourages, mots fantômes géants en fond, micro-typographie Courier, au moins une image ou un objet par scène.

| Partie | Image / objet | Transition vers la suivante |
|---|---|---|
| Accroche | viseur REC, portrait détouré de la reine sur disque rouge, mot fantôme REINE, couronne qui tombe, compteur 0 → 7 924 km qui passe au rouge | inondation rouge depuis le disque |
| Marie-Louise | carte de la reine + carte d'Henri Christophe, alliances, « ROYAUME D'HAÏTI 1811 — 1820 » | iris |
| La Citadelle | photo de la Citadelle Laferrière, coordonnées, « PATRIMOINE MONDIAL » | page poussée à gauche |
| Octobre 1820 | Henri Christophe détouré en gris sur disque rouge, couronne qui tombe, badge « 8 OCT. 1820 », mot fantôme 1820 | inondation noire |
| L'exil | « Les enfants du roi », route Haïti · 1820 → Londres · 1821 (photo de la maison) → Pise · 1824, bateau | iris |
| Pise | photo de Pise, cartes « Princesse † 1831 / † 1839 », mot fantôme PISE | page poussée vers le haut |
| 30 ans | reine détourée sépia sur disque rouge, frise 1824 → 1851, « 27 ans » | page poussée à gauche |
| San Donnino | photo de la plaque, bougie, « Église San Donnino · Pise » | **inondation noire tenue pendant le scratch** (« Bilan : » en blanc) |
| Bilan | tour de Pise détourée sur disque rouge, couronne posée au sommet, mot fantôme TOSCANE, Haïti / Italie | page poussée vers le haut |
| Question | OUI / NON, « Répondez ici », flèche vers les commentaires | — |

- **Faits** : Marie-Louise Coidavid (1778–1851), épouse d'Henri Christophe, reine d'Haïti de 1811 à 1820. Le roi se suicide le 8 octobre 1820 au palais Sans-Souci ; la reine et ses filles Améthyste et Athénaïs partent pour l'Angleterre en 1821, puis s'installent à Pise en 1824. Les deux princesses y meurent avant leur mère (1831 et 1839 ; les sources ne s'accordent pas sur quel prénom va avec quelle date, d'où « Princesse † 1831 / † 1839 » sans prénom). La reine meurt à Pise le 11 mars 1851 et repose avec ses filles dans l'église San Donnino (capucins) ; des plaques ont été inaugurées le 23 avril 2023. Distance Cap-Haïtien → Pise à vol d'oiseau ≈ 7 900 km (la voix dit « près de 8 000 »).
- **Correction** : une prise disait « couvent de San Donnino » ; la voix finale dit « dans l'église San Donnino ».
- **Voix** : FLORA / Gemini TTS « Charon » (fr-FR), dates et nombres écrits en lettres. Temps des mots de la fin recalés sur les silences, pauses raccourcies, silence allongé avant « Bilan » et avant « Répondez », `atempo=1.1` → `assets/vo/vo.wav`. Coût ≈ 0,052 $ (4 prises).
- **Sons** : 70 effets (pops, whooshs, basses, touches, clics, montées, scintillements, carillon, scratch avant « Bilan »), toujours sous la voix.
- **Musique** : `../_engine/style-histoire/musique-bed.mp3`, bouclée ; coupure au scratch, retour sur « la Toscane », baissée sous la question.
- **Images** (détourages faits avec `rembg -m isnet-general-use`, restes effacés à la main) :
  - `reine.jpg`, `reine-cut.png`, `reine-cut2.png` : portrait fourni par le client ; identité du modèle et droits à vérifier par le client avant publication ;
  - `henri.jpg`, `henri-cut.png` : portrait d'Henri Christophe, Wikimedia Commons, domaine public ;
  - `princesses.jpg` : portrait des enfants du roi, Wikimedia Commons, domaine public ;
  - `citadelle.jpg` : Citadelle Laferrière, Alex Proimos, Wikimedia Commons, CC BY 2.0 ;
  - `londres.jpg` : maison de Londres, Maraelizabeth, Wikimedia Commons, CC BY-SA 4.0 ;
  - `plaque.jpg` : plaque de l'église San Donnino, Erpecdemagenta, Wikimedia Commons, CC BY-SA 4.0 ;
  - `pise.jpg`, `pise-cut.png` : tour de Pise, Darryl Brooks, Unsplash (photo `1CI5kTS5d6A`), licence Unsplash ;
  - couronnes, alliances, bougie, bateau, route, viseur : dessinés en HTML/SVG.
  - Les licences CC BY et CC BY-SA demandent de créditer l'auteur : mettre les crédits dans la description de la publication.
- **Rendu** :
  1. `npx --yes hyperframes@0.8.168 render --fps 120 --quality looks --output renders/raw120.mp4`
  2. `python3 -I ../_engine/style-histoire/finish.py renders/raw120.mp4 renders/reine-pise.mp4`
  MP4 non commités.
