# Le duc de la Marmelade (Haïti, 1811) - 3D cartoon, moteur Blender (outil konvwa, style `blender`)

69,6 s, 9:16, **30 i/s** (choix du client pour ce film), voix Gabriel Dubois, sous-titres français mot à mot, son à −14 LUFS.

## Rendu sur le PC (PowerShell)
```
cd $HOME\Konvwa
git pull
.\konvwa.cmd verifier
.\konvwa.cmd rendu duc-marmelade
```
→ `videos\duc-marmelade\renders\duc-marmelade.mp4`. Le premier passage règle le rendu pour la machine (quelques minutes),
puis rend les 2 138 images (11 plans + les fondus) ; compter environ 1 h à 1 h 30. Un rendu interrompu reprend où il
s'est arrêté (seules les images manquantes sont refaites).

## Déroulé (PLAN.md pour le détail)
| plan | décor | ce qu'on voit |
|---|---|---|
| s01 | salle du trône | MARMELADE fier, LIMONADE et ses lunettes, la plaque 1811, HENRI entre, la couronne apparaît sur « roi » |
| s02 | salle du trône | le roi seul qui s'ennuie, l'idée, le mur des armoiries se remplit : 4 princes, 8 ducs, 22 comtes, 37 barons |
| s03 | salle du trône | l'écu aux trois oranges remis à MARMELADE, la devise « PAR LE ROI », la carte du Nord |
| s04 | salle du trône | les quatre nobles nommés un par un ; triomphe de MARMELADE |
| s05 | salon de Paris | les rieurs et la gazette « UN DUC DE LA MARMELADE ! », le duc de Bouillon et son bol, les rires s'arrêtent |
| s06 | salon de Paris | la carte de France : ORLÉANS |
| s07 | salle du trône | LIMONADE sur la carte, HENRI : « Ce qui change, c'est qui rit » |
| s08 | Sans-Souci | le chantier, la façade du palais |
| s09 | la Citadelle | au-dessus des nuages, la borne 900 m, les ouvriers, les canons, la vigie devant la mer vide |
| s10 | salle du trône (soir) | le trône vide et la couronne, la gazette froissée |
| s11 | la Citadelle (couchant) | la forteresse debout, le panneau MARMELADE |

Signature Godzy : l'enseigne en face du salon (s05), la caisse du chantier (s08), la plaque d'un canon (s09), l'étiquette
du pot sur la couverture.

## Fichiers
- `SCRIPT.md` (texte et faits sourcés), `PLAN.md`, `NOTES.md` (leçons), `voice/` (prise Magnific, Whisper, mots calés),
  `audio/` (voix aux pauses resserrées, mots, `final_mix.wav` fait par `konvwa son`).
- `cast.py` (les personnages), `sets.py` + `dress_trone.py` (les décors), `salon_cast.py` (mise en scène du salon),
  `s01.py` … `s11.py` (les plans), `assemble.json` (ordre et fondus), `sons.json` (effets et fonds), `props/throne.py`
  (le trône du moteur avec nos images), `tex/make_tex.py` (toutes les images du film, déjà générées dans `tex/`).
- Couverture : `cover.png` + `cover-grille.png` (source `cover/`, fond 3D studio généré avec Magnific).
- Têtes : brun pour les Haïtiens (`KV_SKIN`, #b98a66), clair pour les Européens ; `KV_SKIN=#ffffff` rend les têtes
  blanches du style du pack.
