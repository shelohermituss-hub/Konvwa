# Références de style — l'ADN des vidéos KONVWA

Les vidéos de motion design fournies par le client sont gardées dans un **catalogue numéroté**. Pour une nouvelle vidéo, il suffit de dire « utilise la référence n° 4 » (ou « réf. 2 et 4 ») : Claude lit la fiche, regarde les planches et applique l'ADN.

- Catalogue : `references/catalog.json` (titre, description, ADN, pièces du moteur, usages KONVWA). **Un numéro donné ne change jamais**, une nouvelle vidéo prend le numéro suivant.
- Planches : `references/<NN-nom>/` : `hook.png` (les 3 premières secondes, image par image), `all.png` (vue d'ensemble), `timeline.jpg` (une image toutes les 0,5 s, quand la vidéo source était disponible) et `analysis.json` (format, durée, coupes, son). Les vidéos sources ne sont pas versionnées (pas de `.mp4` dans le dépôt).
- Commandes : `node videos/_engine/bin/motion.mjs ref` (la liste), `ref 4` (la fiche), `ref add <video.mp4> --name=<nom-court>` (ajoute la vidéo au numéro suivant, puis compléter sa fiche dans `catalog.json`).
- Dans un brief : `"reference": 4` ou `"reference": [2, 4]` ; `check` refuse un numéro inconnu et rappelle la référence suivie.

| N° | Dossier | Format | Durée | Coupes | Ce que c'est | Pièces du moteur |
|---|---|---|---|---|---|---|
| 1 | `01-pulse-interface` | 1:1 | 16 s | 2 | Pulsation verte → widget sombre à halo ; liste de choix iOS avec icônes et curseur qui tape ; tracé sinueux suivi par un véhicule ; pilule « Help is on the way » | `hook.pulse`, `scene.ui` (et `tone: "danger"`), `scene.route` |
| 2 | `02-affiche-editoriale` | 9:16 | 19 s | 5 | Affiche éditoriale : photo détourée en noir et blanc, grand cercle rouge, micro-typo, QR, code-barres, mot géant en filigrane, gros mots blancs qui arrivent un par un | `hook.poster`, `hook.collage`, `scene.ghost`, `scene.photo` |
| 3 | `03-mot-cle-couleur` | 9:16 | 30 s | 1 | « Attention is expensive » : phrase noire, mot-clé en couleur avec glyphes ($) qui s'envolent ; aiguille d'horloge géante comme transition ; hexagones légendés, pilules d'avantages | `hook.statement`, `_serif italic_`, `scene.callouts`, `scene.chips` |
| 4 | `04-produit-en-vol` | 9:16 | 7 s | 0 | Canette en vol avec ombre, ruban bleu, « wacth how » serif italique au-dessus de RED BULL en capitales ; fond gris doux traversé d'**ombres de feuillage** (gobo) ; bols dans des **cercles pointillés** qui s'allument un par un | `hook.product`, `scene.trio`, `scene.guess`, fond `gobo` |
| 5 | `05-pixels-violet` | 9:16 | 10 s | 0 | Texte qui se forme à partir de carrés pixel, lueur violette ; cartes d'interface qui glissent ; bascule nuit → jour ; pilule « few spots left… » | `hook.pixel`, `scene.ui`, `scene.chips` |
| 6 | `06-logo-carte-monde` | 1:1 | 12 s | 5 | Logo qui claque sur la couleur de marque puis devient icône d'app ; mots tapés avec curseur ; carte du monde avec avatars et pointillés ; notifications sur iPhone | `hook.logo`, `hook.question`, `scene.route`, `scene.ui` |

Les anciennes lettres A à F correspondent aux numéros 1 à 6. G et H étaient des doublons de D et A (mêmes fichiers) : ils sont fusionnés dans les n° 4 et 1.

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
