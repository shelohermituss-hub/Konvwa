# Assets à fournir — la bibliothèque KONVWA

Les vidéos sont aussi bonnes que leurs images. Le moteur sait animer en profondeur des **objets détourés** (PNG transparent), des **photos réelles** et des **logos** ; ce qui manque, c'est la matière propre à KONVWA. Ce fichier dit quoi fournir, sous quelle forme et où le ranger.

## Comment ça se passe pour chaque vidéo

1. Vous donnez l'idée (sujet, cible, ton).
2. Claude écrit le script et le brief, puis **la liste des visuels à fournir** dans le brief (`"needs"`), visible avec :
   `node videos/_engine/bin/motion.mjs assets need <projet>` (✓ reçu / ✗ manquant).
3. Vous déposez les fichiers dans la conversation ; Claude les range (`library/…`), les détoure si besoin (`assets cutout`) et coche la liste.
4. Montage, voix, rendu.

Tant qu'un visuel manque, `check` l'affiche en avertissement : on peut monter un brouillon, mais la vidéo finale attend vos fichiers.

## Formats

| Type | Format | Taille | Remarque |
|---|---|---|---|
| Objet, produit, personnage, illustration | **PNG transparent** | ≥ 1500 px sur le grand côté | sinon JPG sur fond blanc uni (Claude détoure) |
| Photo plein cadre | JPG | **portrait**, ≥ 1080 × 1920 | pas de texte incrusté |
| Logo | **SVG** (sinon PNG transparent ≥ 1000 px) | — | version couleur + version blanche |
| Capture d'écran de l'app | PNG | résolution native du téléphone | sans barre de notifications si possible |
| Vidéo (plans réels) | MP4 | 1080 × 1920, 3 à 8 s | stable, sans musique |
| Police | OTF / TTF | — | seulement si autre que Poppins |
| Musique | MP3 / WAV | 30 à 60 s | libre de droits (ou licence fournie) |

Nom de fichier : minuscules, tirets, sans accent (`livreur-scooter.png`, `client-colis-ouvert.png`).

## La bibliothèque de base (à fournir une fois, sert à toutes les vidéos)

Par ordre de priorité. ★ = change le plus le rendu.

### 1. Identité (`library/brand/`)
- ★ Logo KONVWA en SVG : version couleur, version blanche, symbole seul.
- Logos MonCash et NatCash en SVG (versions officielles).
- Icône de l'app (le « K ») en haute définition.
- Mockup d'un téléphone vide (cadre seul, PNG transparent), vu de face et de trois-quarts.

### 2. L'app en vrai (`library/app/`)
- ★ Captures d'écran : accueil / catalogue, fiche produit, champ « coller le lien », devis détaillé (avec ses lignes), portefeuille + recharge MonCash, suivi de commande (les étapes), réclamation Support, notification « colis arrivé ».
- (Bonus) une courte capture vidéo d'écran du parcours complet.

### 3. Personnages haïtiens (`library/people/`) — PNG détourés
- ★ Une cliente et un client qui reçoivent un colis (sourire, carton ouvert).
- ★ Quelqu'un qui regarde son téléphone (surpris / content / inquiet : 3 expressions si possible).
- Un livreur KONVWA (tenue ou t-shirt à la marque) avec un colis, à scooter si possible.
- Un revendeur ou une revendeuse avec des cartons (boutique, marché).
- Une personne de l'équipe en entrepôt (scanner, étiquette).

### 4. Objets logistiques à la marque (`library/illustrations/`) — 3D ou illustration, même style
- ★ Carton KONVWA (avec scotch et logo), fermé et ouvert.
- ★ Avion cargo, bateau porte-conteneurs, conteneur, camion, scooter de livraison.
- Étiquette d'expédition KONVWA, sac de livraison, entrepôt.
- Pin de localisation, globe, drapeaux Haïti / Chine / États-Unis en style autocollant arrondi.
- Billets de gourdes (HTG) et pièces, téléphone avec l'écran MonCash.

### 5. Signalétique et pictos (`library/icons/`) — même style que les objets
- Bouclier « protégé », coche validée, badge « vérifié », cadenas, alerte / panneau attention, croix « arnaque », loupe, horloge, reçu / devis.

### 6. Lieux (`library/photos/`) — photos réelles en portrait
- Port-au-Prince (rue animée, marché), Cap-Haïtien, un point de retrait / bureau KONVWA, l'entrepôt (Chine ou Miami) si vous en avez.

### 7. Son (`library/music/`)
- Deux ou trois musiques de fond qui vous ressemblent (énergique, posée, kompa moderne) dont vous avez les droits.
- (Optionnel) un « son de marque » de 1 à 2 s pour le logo de fin.

## Ce qui rend les illustrations cohérentes

Choisir **un seul style** pour toute la série (par exemple « 3D douce, lumière du haut, couleurs KONVWA ») et s'y tenir : un set de 15 à 20 objets dans le même style vaut mieux que 50 images disparates. Si vous passez par un illustrateur ou un générateur d'images, donner ce fichier et la palette : orange `#F05A28`, marine `#0A1628`, blanc.
