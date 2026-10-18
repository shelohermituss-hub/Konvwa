# « Où va l'argent de la diaspora ? » — storyboard (à valider)

- **Format** : 9:16, 1080 × 1920, ≈ 18–20 s, voix off française dès 0,2 s (≈ 3 mots/s, comme la référence), musique continue.
- **Style** : copie de la référence I (`videos/_engine/references/ref-i-diaspora/`, description dans `docs/REFERENCES.md`). Planche plan par plan : `references/ref-i-diaspora/storyboard.png`.
- **Constantes** : papier quadrillé gris très clair + vignette ; logo KONVWA fixe en haut à gauche ; orange `#F05A28` pour les mots-clés et les barres ; le **bleu roi de la référence devient le marine `#0A1628`** ; Poppins demi-gras ; texte = voix, lettre par lettre (flou → net) ; ombre longue et douce sous chaque objet ; flou de mouvement à chaque entrée ; coupes franches sur fond identique (pas de transition visible).

| # | Voix (≈ durée) | Texte à l'écran | Mise en scène (plan de la référence copié) |
|---|---|---|---|
| 1 | « La diaspora envoie des milliards chaque année. » (2,3 s) | `La diaspora envoie` · barre orange **des MILLIARDS** · `chaque année` | Réf. 0–1,6 s : la barre orange naît d'un petit carré et s'étire, « MILLIARDS » blanc se révèle dedans ; téléphone en main entre à droite, des liasses de billets jaillissent de l'écran avec flou de mouvement, une liasse floue au premier plan en bas. Micro-détail éditorial en haut à gauche (code-barres → micro-texte « TRANSFERTS · 2024 »). |
| 2 | « Mais où va vraiment cet argent ? » (2 s) | `Mais où va` · **cet argent ?** entouré à la main | Réf. 3,4–5,3 s : feuilles tropicales floues dans deux coins ; ellipse tracée autour d'« argent » ; les billets se rangent en **pile de 4 cartes** qui ralentit… puis s'évente d'un coup : *Frais · Famille · Commerce · Épargne* (étiquettes au pinceau marine) ; « ? » géant en contour seul en bas. |
| 3 | « D'abord, une partie part dans les frais. » (2,3 s) | `Frais` + compteur `0 % → X %` + flèche rouge ↓ | Réf. 2–3,4 s : carte orange où une courbe blanche descend en se dessinant jusqu'à une flèche ; la liasse en bas perd des billets aspirés dans la carte. Micro-texte de source sous le chiffre. |
| 4 | « La plus grosse part aide les familles. » (2,3 s) | `La plus grosse part` · **aide les _familles_** (gras italique) | Réf. 9–10,8 s : famille haïtienne détourée en **bichromie orange** qui monte du bas ; 4 pictos marine surgissent autour (panier, cahier, médicament, clé). |
| 5 | « Une autre partie fait vivre le commerce local. » (2,6 s) | `Une autre partie fait vivre` · **le commerce local** (marine) | Réf. 10,8–12,1 s : commerçante qui **déborde par le haut d'un carré marine** ; pilule « Paiement reçu » qui tombe sur la carte. |
| 6 | « Et parfois, elle devient épargne… ou business. » (2,6 s) | **Et parfois,** · `elle devient` · barre orange **épargne ou business** | Réf. 12,1–14,2 s : personne de dos en **bichromie bordeaux** face à une tirelire / un petit commerce qui grandit. |
| 7 | « La vraie question : comment en garder plus ? Suivez-nous pour la suite. » (3,8 s) | bouton marine **Comment en garder plus ?** · sous-titre `Suivez-nous pour la suite` | Réf. 14,2–19,4 s : le bouton naît d'un carré, s'allonge, icône portefeuille, texte tapé ; sous-titre lettre par lettre. |
| fin | (sans voix, 1,5 s) | logo KONVWA · MonCash / NatCash | Réf. 19,4–24,5 s : carte de fin (logo, carte marine, carte orange à pilules) ; au lieu du fondu au noir, tout se replie dans le téléphone du plan 1 → **boucle**. |

## Visuels à fournir

Photos détourées réalistes (PNG transparent ≥ 1500 px, sinon JPG sur fond blanc uni : on détoure). Les bichromies et les ombres sont faites par le moteur.

| ★ | Fichier | Quoi |
|---|---|---|
| ★ | `assets/telephone-main.png` | Main qui tient un smartphone récent, vue de trois-quarts, écran vide ou écran d'envoi d'argent |
| ★ | `assets/liasse-usd.png` (+ `liasse-htg.png` si possible) | Liasse de billets en photo, vue de trois-quarts (2 angles idéalement) |
| ★ | `assets/famille.png` | Famille haïtienne (un parent + 1 ou 2 enfants), plan taille, souriante |
| ★ | `assets/commercante.png` | Commerçante ou boutiquier haïtien, debout, plan américain, regard caméra |
|   | `assets/de-dos.png` | Personne de dos qui regarde devant elle (projet, avenir) |
|   | `assets/tirelire.png` | Tirelire ou coffre, photo ou 3D réaliste |
|   | `assets/feuilles-1.png`, `feuilles-2.png` | Feuilles de bananier ou de palmier (repli : Pixabay) |
|   | `music/…mp3` | Musique de fond libre de droits, 30 s, rythmée sans être agressive |

## Moteur : ce qu'il faut ajouter (après validation)

Fond `grid` + logo en filigrane ; entrée de texte `blur` (lettre par lettre) avec lignes de tailles mixtes ; barre de surlignage qui naît d'un carré ; carte-graphique + compteur ; ellipse dessinée + texte en contour ; pile de cartes qui s'évente ; détouré en bichromie ; personnage qui déborde d'une carte ; bouton qui naît d'un carré ; carte de fin « contacts » + boucle. Chaque ajout avec son test dans `tests/engine.test.mjs`.
