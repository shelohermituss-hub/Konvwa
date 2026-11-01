# « Comment une clé ouvre une serrure » — style STUDIO (variante C), en français

Deuxième vidéo en **style STUDIO** (guide `../_engine/style-3d-studio/README.md`, modèle `../eolienne/`).

- **Durée** : ≈ 62,3 s (règle du client : entre 60 et 70 s), voix d'**Adrien Moreau**.
- **Image** : 17 plans en coupes franches, rendus 3D « produit » en Three.js (`index.html`). Les unités sont des millimètres.
- **Sous-titres** : en haut. Le mot arrive flou puis devient net, et les mots-clés sont dans un cadre de sélection bleu.
- **Son** : pas de musique. Une ambiance de pièce très basse et des bruitages discrets.
- **Signature « Godzy » dans le décor**, à 3 endroits (`../_engine/signature/README.md`) :
  - la **plaque de la porte** ;
  - la **tête des clés**, où le nom est gravé ;
  - la **façade en laiton de la serrure**.

| Plan | Texte | Image |
|---|---|---|
| Accroche | « Ta clé et celle de ton voisin se ressemblent presque. Pourtant, la tienne ouvre ta porte, et pas la sienne. Alors, comment une serrure reconnaît sa clé ? » | les deux clés posées côte à côte (« TA CLÉ », « CELLE DU VOISIN ») ; la porte avec sa plaque GODZY, la clé qui tourne, ✓ / ✕ ; la clé qui approche du barillet |
| Imagine | on coupe la serrure en deux ; le cylindre qui doit tourner | la serrure s'ouvre en coupe ; le cylindre encadré en bleu |
| Les goupilles | colonnes coupées en deux : en bas, en haut, un ressort | les 5 colonnes s'allument ; gros plan d'une colonne, le ressort qui pousse |
| Sans clé | les goupilles du haut traversent la frontière → impossible de tourner | la ligne de séparation en pointillés cyan, le cylindre force puis bute : « BLOQUÉ » |
| La bonne clé | les dents soulèvent chaque goupille pile à la bonne hauteur | la clé entre, les goupilles montent et descendent sur les dents, toutes les coupures s'alignent : « ALIGNÉES », en vert |
| Ça tourne | le cylindre tourne et tire le pêne | la serrure entière tourne avec la clé, le pêne recule ; sur la porte, le pêne rentre |
| La clé du voisin | une goupille trop haute ou trop basse, de quelques dixièmes de millimètre | la clé dorée entre, deux goupilles en rouge ; gros plan « 0,3 MM », « BLOQUÉ » |
| L'Égypte | il y a ≈ 4 000 ans, des goupilles en bois | une serrure en bois ouverte : la clé à chevilles soulève les goupilles et le verrou glisse |
| Retour | « ta clé n'ouvre pas la serrure : elle aligne des goupilles » | les goupilles alignées en vert, « ELLE ALIGNE » |
| Fin | « Abonne-toi, et envoie ça à quelqu'un qui perd toujours ses clés ! » | feuille de partage du téléphone, la porte dans l'écran |

## Faits (vérifiés, formulés avec prudence)

- **Serrure à goupilles** (cylindre à goupilles) :
  - un cylindre (rotor) tourne dans un boîtier ;
  - chaque colonne contient une goupille du bas (de longueur variable), une goupille du haut et un ressort ;
  - sans la bonne clé, des goupilles chevauchent la ligne de séparation entre le cylindre et le boîtier et l'empêchent de tourner ;
  - la bonne clé met chaque séparation exactement sur cette ligne.
- **« Quelques dixièmes de millimètre »** : d'une profondeur de taille à la suivante, l'écart vaut typiquement 0,3 à 0,6 mm selon les fabricants. Le « 0,3 MM » à l'écran est un ordre de grandeur.
- **Égypte** : des serrures en bois à goupilles qui tombent dans le verrou sont attestées dans l'Antiquité, en Égypte et en Mésopotamie. On les date souvent d'environ 4 000 ans, d'où « environ » dans le texte. Le cylindre à goupilles moderne vient de Linus Yale Jr., dans les années 1860.

## Production

- **Voix** : Magnific / ElevenLabs « Adrien Moreau » (`voiceId` 230, `eleven_v4`, stabilité 0,4, 252 crédits), consigne `[conversational, clear, confident, lively explainer]`.
  - Une prise de 61,0 s, alignée avec des pauses de 0,24 s : 59,7 s.
  - Mots recalés à la main après Whisper (pauses en double).
- **Sons** :
  - 6 bruitages ajoutés à `../_engine/style-3d/sfx/` : `cle-entre`, `cle-tourne`, `cle-bloquee`, `porte-grince`, `ressort`, `ambiance-piece` (145 crédits) ;
  - 30 bruitages au total ;
  - mixage `mix_anime.py` sans musique : ambiance coupée sous 200 Hz, 20 dB sous la voix ; voix 21 dB au-dessus du fond (médiane) ; **0 trou**.
- **Sources** dans `src/` : `serr-module.js` (la 3D), `serr-shell.html` (sous-titres, téléphone), `build_serr.py` (mixage et assemblage), `script.txt`, `disp.json`, `timing.json`.
- **Rendu** : directement en 60 i/s.
  1. `npx --yes hyperframes@0.8.168 render --fps 60 --quality looks --output renders/raw60.mp4`
  2. `python3 -I ../_engine/style-histoire/finish.py renders/raw60.mp4 renders/serrure.mp4`

  MP4 non commités.

## Couverture (créée à part, 3D studio)

`cover.png` et `cover-grille.png`. La source est `cover/cover.html` + `fond.jpg` (image générée avec Magnific : une serrure en laiton en coupe, avec la clé).

- **Titre** : « TA CLÉ N'OUVRE PAS LA SERRURE… », avec la pastille « COMMENT ÇA MARCHE ? ».
- **Annotations** : un cadre jaune « 5 GOUPILLES », la ligne cyan « LA FRONTIÈRE », l'étiquette « TA CLÉ », et **GODZY gravé sur le laiton**.
- **Rendu** : `node videos/_engine/covers/render_cover.mjs videos/serrure/cover`.

## Publication (proposition)

- **Description** : « Ta clé et celle de ton voisin se ressemblent presque… alors comment ta serrure fait la différence ? 🔑 #science #commentcamarche #serrure #lesaviezvous »
