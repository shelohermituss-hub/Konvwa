# duc-marmelade - plan. Voix 68,46 s, film 69,60 s, images 1-2088 (30 i/s, sortie 30 i/s)

Méthode : `.claude/skills/konvwa-blender/SKILL.md` + la procédure du moteur
(`videos/_creatorize/skill/blender-toon-shorts/references/sop.md`). Faits et sources : `SCRIPT.md`.

## Distribution (cast.py) - têtes : teint brun pour les Haïtiens (`KV_SKIN`, #b98a66), clair pour les Européens
- HENRI (le roi Henri Ier) : manteau bleu roi #1d3f8f, revers rouges, épaulettes d'or à franges, écharpe rouge en
  diagonale, plaque d'ordre en étoile, boutons d'or, couronne d'or à calotte rouge (elle apparaît sur « roi »).
- MARMELADE (le duc) : habit orange marmelade #e2731c, gilet crème, chaîne d'or + médaille rouge, bicorne à cocarde
  orange, ventre rond. Le héros comique : fier, puis ravi, puis le salut final.
- LIMONADE (le comte, secrétaire d'État) : habit jaune citron #e8c92a, revers et écharpe verts, lunettes rondes.
- PLAISANCE (duc, vert prairie #3f9a4c) et LIMBÉ (prince, turquoise #1f9aa0) : la rangée des nobles.
- RIEUR (Paris) : redingote lilas #8a64b8, haut-de-forme, monocle, favoris. GAZETIER : redingote grise, casquette.
- BOUILLON (le duc français) : habit prune #6a1e5a, col d'hermine, perruque poudrée, gros ventre, un bol de bouillon fumant.
- OUVRIERS (Sans-Souci, Citadelle) : chemises rouge #c8442c / bleu #2c7fa8 / paille #e0b030, chapeaux de paille.

## Décors (sets.py, habillage dress_<décor>.py)
- TRÔNE (Sans-Souci, salle du trône) - `jour` : après-midi doré, le soleil entre par trois hautes fenêtres cintrées
  (vraies ouvertures) et pose des panneaux de lumière sur un sol de marbre en damier crème / rouge ; murs ocre jaune à
  pilastres blancs, rideaux de velours rouge, lustre, trône rouge et or sur estrade (copie du trône du moteur avec NOS
  images : le phénix couronné au lieu du dragon), plaque dorée « 1811 » au-dessus, le MUR DES ARMOIRIES (71 écus en
  quatre groupes : 4 / 8 / 22 / 37, chiffres d'or sous chaque groupe, qui apparaissent sur les mots), la TABLE DE LA
  CARTE (carte du Nord d'Haïti dessinée : Cap-Henry, Plaisance, Limbé, Limonade, Marmelade, Milot, Grande-Rivière).
  Fill turquoise des Caraïbes #7fc8d8, contres chauds, bougies. - `soir` : même salle à la tombée du jour, violet et
  braise, la couronne posée seule sur le coussin du trône vide, une gazette froissée au sol.
- SALON (Paris, 1811) - après-midi de pluie : papier peint à rayures lilas / bleu-gris, haute fenêtre (vraie ouverture)
  sur des toits gris (une enseigne GODZY en face), clé froide bleutée par la fenêtre, cheminée chaude en contre-feu,
  fauteuils, guéridon avec la soupière ; la CARTE DE FRANCE encadrée (Paris, Orléans, Bouillon, Bordeaux…), la gazette
  « UN DUC DE LA MARMELADE ! ». Script de couleurs : bleu-violet froid contre l'orange du feu.
- SANS-SOUCI (dehors, Milot) - plein soleil : la façade ocre à double escalier et colonnade, palmiers, montagnes vertes
  sur le tambour de ciel, un échafaudage, des pierres, des ouvriers, une caisse marquée GODZY.
- CITADELLE (le sommet, 900 m) - `jour` : la proue de pierre grise de la forteresse, le rempart, la rangée de canons
  (un canon marqué GODZY), pyramides de boulets, la rampe où des ouvriers hissent un canon à la corde, la borne « 900 m »,
  la mer vide à l'horizon, nuages au niveau du sol. - `couchant` : soleil rouge-or bas, longues ombres, le panneau de
  route « MARMELADE » au premier plan.

## Séquences (images globales ; un fichier chacune, build(ctx) -> (F0, F1))
| fichier | décor | images (s) | mots | cadrages |
|---|---|---|---|---|
| s01 | TRÔNE jour | 1-330 (0,00-10,97) | En Haïti … Henri Ier. | 0,00 MS MARMELADE fier, salut sur « vrai duc », grand sourire sur « Marmelade » -> 3,30 MS LIMONADE qui remonte ses lunettes -> 5,15 CU plaque d'or « 1811 » (contre-plongée) -> 5,62 WS la salle : HENRI entre et marche vers le trône -> 8,85 MS HENRI au trône, la couronne apparaît sur « roi » -> 10,12 CU contre-plongée HENRI assis « Henri Ier » |
| s02 | TRÔNE jour | 331-612 (10,97-20,37) | Mais un roi sans cour … trente-sept barons. | 10,97 XWS plongée : la salle vide, HENRI minuscule sur le trône, l'ennui -> 13,45 MCU HENRI bondit, l'idée -> 16,95 WS le mur des armoiries, les 4 princes apparaissent -> (vol lent le long du mur) 19,30 les 37 barons, le mur plein |
| s03 | TRÔNE jour | 613-805 (20,37-26,83) | Chacun reçoit … villes du Nord. | 20,35 MS deux : HENRI tend un écu à MARMELADE -> 22,38 CU l'écu à l'orange + la banderole de devise -> 23,55 MCU MARMELADE ravi, le titre -> 24,25 plongée sur la table de la carte, les noms des villes |
| s04 | TRÔNE jour | 806-1002 (26,83-33,40) | Le duc de Plaisance … la Marmelade. | 26,75 MS PLAISANCE salue -> 28,35 MS LIMBÉ salue -> 29,85 MS LIMONADE salue -> 31,40 la caméra file vers MARMELADE (suspense) -> 32,42 CU MARMELADE triomphe (prise) ; poussée dans la coupe |
| s05 | SALON | 1003-1275 (33,40-42,50) | En Europe … trouvait drôle. | 33,38 WS le salon, RIEUR et GAZETIER éclatent de rire sur la gazette -> 34,95 MCU la gazette « UN DUC DE LA MARMELADE ! » + RIEUR hilare -> 36,55 vol vers le fauteuil… -> 39,05 MCU BOUILLON, son bol fumant, l'air digne -> 39,75 MS les deux rieurs s'arrêtent net, visages fermés |
| s06 | SALON | 1276-1406 (42,50-46,83) | Parce qu'un titre … d'une ville. | 42,45 MS la carte de France au mur, BOUILLON devant -> 44,75 CU « ORLÉANS » |
| s07 | TRÔNE jour | 1407-1503 (46,83-50,10) | Le comte de Limonade aussi. Ce qui change, c'est qui rit. | fondu (saut de lieu) 46,80 CU « LIMONADE » sur la carte, LIMONADE derrière -> 48,15 MCU HENRI, regard entendu vers nous |
| s08 | SANS-SOUCI | 1504-1621 (50,10-54,03) | Et pendant qu'on riait … Sans-Souci. | fondu 50,08 MS les ouvriers taillent et hissent des pierres -> 52,65 WS la façade du palais, montée |
| s09 | CITADELLE jour | 1622-1851 (54,03-61,70) | Et là-haut … jamais venue. | fondu 54,00 XWS la forteresse sur son sommet, la borne 900 m -> 56,95 MS les ouvriers hissent un canon -> 57,95 WS la rangée de canons -> 58,65 MS la vigie à la longue-vue, la mer vide, haussement d'épaules sur « jamais » |
| s10 | TRÔNE soir | 1852-1945 (61,70-64,80) | Le royaume s'arrête … se sont tues. | fondu (saut de temps) 61,68 MS le trône vide, la couronne sur le coussin -> 63,25 CU la gazette froissée au sol |
| s11 | CITADELLE couchant | 1946-2088 (64,80-69,60) | La Citadelle … Et Marmelade aussi. | fondu 64,78 WS la Citadelle au couchant -> 67,20 le panneau « MARMELADE » au premier plan, la forteresse floue derrière |
39 cadrages / 69,6 s = 5,6 par 10 s.

## Script de couleurs
TRÔNE jour : or et ocre, rouge velours, turquoise en contre-jour. SALON : bleu-violet froid + orange du feu.
SANS-SOUCI : soleil blanc-jaune, ciel cobalt, verts saturés. CITADELLE jour : gris pierre chaud, ciel turquoise, nuages.
TRÔNE soir : violet et braise. CITADELLE couchant : rouge-or, ombres magenta.

## Signature Godzy (3 fois, le nom seul)
L'enseigne d'une boutique en face, par la fenêtre du salon (s05) ; une caisse au chantier de Sans-Souci (s08) ; la marque
de fonderie sur la culasse d'un canon (s09).

## Étalonnage (rempli à la fin : options de post.py, recopiées dans project.json > konvwa > post)
