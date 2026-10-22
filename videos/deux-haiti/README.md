# « Haïti a été coupée en deux pendant 13 ans » — Royaume du Nord et République du Sud, 1807-1820

Composition HyperFrames écrite à la main (`index.html`), 9:16, 32,2 s, style « histoire express » v3 (`../_engine/style-histoire/README.md`). Pastille « HISTOIRE D'HAÏTI · 1807 ».

| Partie | Image / objet | Transition vers la suivante |
|---|---|---|
| Accroche | viseur REC, carte d'Haïti détourée sur disque orange, compteur 1807 → 1820 qui passe au rouge, **la carte se déchire en deux sur la frontière** au mot « deux » | inondation orange depuis la déchirure |
| 1806 | Dessalines détouré sur disque orange, « Empereur Jacques Iᵉʳ », il passe en gris sur « assassiné », « † 17 OCT. 1806 » | inondation noire depuis la date |
| Les généraux | cartes Christophe VS Pétion, puis la carte teintée (Nord rouge sombre, Sud bleu), frontière en pointillés qui se trace, les deux moitiés s'écartent | page poussée à gauche |
| Le Nord | Henri Christophe détouré, couronne qui tombe sur « roi », « ROI · 1811 », puce drapeau noir et rouge « État du Nord » | iris |
| Capitale : le Cap | gros plan de la carte sur Cap-Haïtien, épingle, gravure du palais Sans-Souci (1873) | page poussée vers le haut |
| Le Sud | Pétion détouré, « PRÉSIDENT · 1807 », puce drapeau bleu et rouge « République du Sud » | iris |
| Capitale : Port-au-Prince | gros plan de la carte sur Port-au-Prince, épingle, photo de Port-au-Prince vers 1890 | page poussée à gauche |
| La guerre | les deux drapeaux face à face, sabres croisés, frise 1807 → 1820 | page poussée vers le haut |
| 1820 | médaillon de Christophe (sa couronne tombe, il passe en gris), Boyer détouré sur disque orange, les deux moitiés de la carte se recollent sur « réunifie » | **inondation noire tenue pendant le scratch** (« Bilan : » en blanc) |
| Bilan | deux colonnes séparées par la frontière : Royaume / République, Cap-Henri / Port-au-Prince, drapeau noir et rouge / drapeau bleu et rouge | page poussée vers le haut |
| Question | OUI / NON, « Répondez ici », flèche vers les commentaires | — |

- **Faits** : Dessalines, empereur sous le nom de Jacques Iᵉʳ, est assassiné le 17 octobre 1806 au Pont-Rouge, à l'entrée de Port-au-Prince. Ses généraux se disputent le pouvoir : le 17 février 1807, Henri Christophe proclame l'État d'Haïti dans le Nord (royaume à partir du 28 mars 1811, Christophe devient le roi Henri Iᵉʳ ; capitale Cap-Henri, l'actuel Cap-Haïtien). Dans le Sud, Alexandre Pétion est élu président de la République d'Haïti le 9 mars 1807 (capitale Port-au-Prince) ; il meurt en 1818, Jean-Pierre Boyer lui succède. La guerre entre les deux États ne donne de victoire décisive à aucun des deux. Christophe se suicide le 8 octobre 1820 ; Boyer réunifie le pays en octobre 1820. Drapeaux : noir et rouge (bandes verticales) au Nord, repris de Dessalines ; bleu et rouge (bandes horizontales) au Sud. Sources : Wikipédia (State of Haiti, Kingdom of Haiti, Royaume d'Haïti, Alexandre Pétion, Flag of Haiti).
- **Frontière** : tracé approximatif (de la côte entre Saint-Marc et l'Arcahaie jusqu'à la frontière espagnole, au nord de Mirebalais), indiqué « FRONTIÈRE APPROXIMATIVE » à l'écran. Les drapeaux sont dessinés sans armoiries.
- **Voix** : FLORA / Gemini TTS « Charon » (fr-FR), dates et nombres écrits en lettres ; 2ᵉ prise gardée. Temps des mots de la fin recalés sur les silences, pauses raccourcies, silence allongé avant « Bilan » et avant « Répondez », `atempo=1.1` → `assets/vo/vo.wav` (30,5 s). Coût ≈ 0,026 $ (2 prises).
- **Musique** : `../_engine/style-histoire/musique-bed.mp3`, bouclée ; coupure au scratch, retour sur « deux Haïti », baissée sous la question.
- **Sons** : 86 effets (déchirure de la carte, pops, whooshs, basses, touches, clics, montées, scintillements, carillon, scratch avant « Bilan »), toujours sous la voix.
- **Images** (détourages : `rembg -m birefnet-general` ou `isnet-general-use`) :
  - `carte-originale.png` : carte physique d'Haïti **fournie par le client** (c'est vraisemblablement la carte de Wikimedia Commons par Sémhur, sous licence CC BY-SA : à vérifier et à créditer dans la description). Dérivés : `carte-nord.png` / `carte-sud.png` (terres détourées, coupées sur la frontière, bord droit fondu), `carte-nord-teinte.png` / `carte-sud-teinte.png`, `carte-cap.jpg` / `carte-pap.jpg` (gros plans) ;
  - `dessalines-cut.png` : portrait de Dessalines, Wikimedia Commons, domaine public (déjà utilisé dans `videos/haiti-1804`) ;
  - `henri.jpg`, `henri-cut.png`, `henri-visage.jpg` : portrait d'Henri Christophe (Richard Evans), Wikimedia Commons, domaine public ;
  - `petion.jpg`, `petion-cut.png` : « Pétion, président d'Haïti (1807-1818) », gravure du *Dictionnaire géographique et administratif universel d'Haïti*, tome 2, p. 97, Bibliothèque Schœlcher via la bibliothèque numérique Manioc, domaine public ;
  - `boyer-cut.png` : « Boyer », estampe de 1820, Library of Congress (item 2021630035), sans restriction connue ;
  - `sans-souci.jpg` : « Palace of Sans Souci at Cape Haytien », gravure de 1873, Library of Congress (item 90708731), domaine public ;
  - `port-au-prince.jpg` : « Market Day, Port-au-Prince », Detroit Publishing Co., Library of Congress (item 2016794479), sans restriction connue ;
  - couronnes, drapeaux, sabres, épingles, viseur : dessinés en HTML/SVG.
  - Les licences CC BY-SA demandent de créditer l'auteur : mettre les crédits dans la description de la publication.
- **Rendu** :
  1. `npx --yes hyperframes@0.8.168 render --fps 120 --quality looks --output renders/raw120.mp4`
  2. `python3 -I ../_engine/style-histoire/finish.py renders/raw120.mp4 renders/deux-haiti.mp4`
  MP4 non commités.
