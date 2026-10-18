# Références de style — l'ADN des vidéos KONVWA

Six vidéos de motion design fournies par le client ont servi de base. Les planches (`hook.png` = les 3 premières secondes image par image, `all.png` = vue d'ensemble) et les chiffres (`analysis.json`) sont dans `references/ref-*/`. Pour en ajouter une : `node videos/_engine/bin/motion.mjs ref <video.mp4> --name=ref-g-nom` puis décrire ce qu'on y voit ci-dessous.

| Réf. | Format | Durée | Coupes sèches | Ce que c'est | Hook du moteur qui s'en inspire |
|---|---|---|---|---|---|
| A `ref-a-tiktok-1` | 1:1 | 16 s | 2 | Pulsation verte qui se contracte en point, puis se déploie en widget d'interface (« ISS flyover ») avec halo bleu | `hook.pulse` |
| B `ref-b-tiktok-2` | 9:16 | 19 s | 5 | Affiche éditoriale : photo détourée en noir et blanc, grand cercle rouge, micro-typo, QR, code-barres, mot géant en filigrane, gros mots blancs qui arrivent un par un | `hook.poster`, `scene.ghost` |
| C `ref-c-tiktok-3` | 9:16 | 30 s | 1 | « Attention is expensive » : phrase noire, mot-clé en couleur avec glyphes ($) qui s'envolent ; aiguille d'horloge géante comme transition | `hook.statement`, `_serif italic_` |
| D `ref-d-after-effects` | 9:16 | 7 s | 0 | Canette en vol avec ombre portée, ruban bleu qui balaie, titre en capitales + petit texte serif italique, cercle pointillé autour du produit suivant | `hook.product` |
| E `ref-e-motion-anim` | 9:16 | 10 s | 0 | Texte qui se forme à partir de carrés pixel, lueur violette ; cartes d'interface qui glissent | `hook.pixel`, `scene.ui` |
| F `ref-f-paypal` | 1:1 | 12 s | 5 | Logo qui claque sur la couleur de marque puis bascule (blanc → couleur) en icône d'app ; mots qui s'enchaînent | `hook.logo`, `hook.question` |
| G `ref-g-recreate-ae` | 9:16 | 7 s | 0 | Canette en vol avec ombre, ruban bleu, « wacth how » serif italique au-dessus de RED BULL en capitales ; fond gris doux traversé d'**ombres de feuillage** (gobo) ; rangée de bols dans des **cercles pointillés** qui s'allument un par un, légendes serif italique | `scene.trio`, fond `gobo`, `hook.product` |
| H `ref-h-vid-1017` | 1:1 | 16 s | 2 | Pulsation verte → widget sombre à halo ; liste de choix iOS avec icônes et curseur qui tape ; tracé sinueux suivi par un véhicule ; pilule « Help is on the way » | `hook.pulse`, `scene.ui` (et `tone: "danger"`), `scene.route` |

## Ce qu'elles ont toutes en commun

1. **Le tout premier instant n'est jamais vide.** Une forme, un mot flou, un produit en vol : quelque chose bouge dès la 1re image (< 0,15 s). C'est la loi n° 1 du moteur.
2. **Une seule idée par plan, énorme.** Peu de mots, très gros ; le mot-clé reçoit la couleur (ou une italique serif) et un coup de son. Pas de paragraphes.
3. **Le mouvement est continu.** Peu de coupes sèches (0 à 4 par 10 s, plan moyen 2 à 15 s) : on passe d'une scène à l'autre par un geste (balayage, cercle qui s'ouvre, zoom, flash), jamais par un fondu mou. D'où les transitions du moteur (`whip`, `up`, `circle`, `scale`, `flash`), où la scène qui arrive porte le geste.
4. **Entrées nettes, flou de mouvement.** Les éléments arrivent avec un flou qui se résout (`blur → net`) et un ralentissement fort en fin de course (`expo.out`) ; les petits éléments d'interface rebondissent légèrement. Rien n'apparaît par simple fondu d'opacité.
5. **Une palette courte.** Un fond neutre, une couleur d'accent unique, du noir. Le rouge, le vert, le bleu changent d'une vidéo à l'autre ; ici ce sera l'orange KONVWA `#F05A28` et le marine `#0A1628`.
6. **Typographie à deux voix.** Grotesque lourde pour le message, serif italique pour l'emphase (`_mot_`), capitales très serrées pour les titres de produit, micro-texte en capitales espacées pour le détail « éditorial ».
7. **Le son porte le rythme.** Chaque geste visuel a son son (whoosh, impact, pop, tick) ; niveau moyen mesuré entre −18 et −12 dB, crêtes proches de 0 dB.
8. **Les textes arrivent mot à mot, au rythme de la voix.** Jamais un bloc entier d'un coup.

## Traduction en règles du moteur

| Constat | Règle appliquée |
|---|---|
| Rien de vide à l'ouverture | `M.HOOK.firstEventMax = 0.15 s` ; chaque hook place un élément ou un son à t < 0,15 s ; le contrôle qualité mesure le mouvement entre 0,05 et 0,5 s |
| Idée courte et énorme | hook ≤ 7 mots, ≤ 48 caractères ; `M.layout` choisit la plus grande taille qui tient et équilibre les lignes |
| Mouvement continu | scènes qui se chevauchent d'exactement la durée de la transition (0,36 à 0,55 s) ; la scène qui arrive est au-dessus |
| Mots au rythme de la voix | `M.timesFor` répartit les mots sur la durée réelle de la voix (mesurée avec ffprobe) |
| Son qui porte les gestes | `sfx()` de chaque scène renvoie des indices (`impact`, `pop`…), placés automatiquement sur des pistes sans chevauchement |
| Le hook accroche plus que la suite | `qa` compare l'énergie visuelle des 3 premières secondes à celle du reste |
