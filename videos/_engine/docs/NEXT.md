# Suite du moteur — passer du « texte plat » au niveau des références

> À lire en premier dans une nouvelle session : tout le contexte de la conversation précédente est ici.

## Constat du client (à ne pas perdre de vue)

La démo `videos/motion-demo` (22 s) est jugée **plate** : presque que du texte et des formes, « sans vrai motion design ». Les six références (`references/ref-*/hook.png`, `all.png`) sont puissantes grâce à de **vraies images détourées empilées en profondeur** (photo N&B + grand cercle de couleur, canette en vol avec ombre, widgets d'interface, aiguille d'horloge géante comme transition…), des objets qui traversent l'écran d'une scène à l'autre et une typographie mêlée à l'image. Le client veut des vidéos « comme celles-là », avec de vraies illustrations et de vraies images.

Conclusion : il faut **(1) des assets réels** et **(2) de nouvelles mises en scène dans le moteur** qui les exploitent. Les assets seuls ne suffisent pas.

## Sources d'assets : état vérifié

| Source | Accès | Remarques |
|---|---|---|
| Unsplash (outils MCP `search_photos`, `search_illustrations`, `download_asset`) | ✓ testé, fichier réel téléchargé (2000×3000) | peu d'illustrations |
| Pixabay | ✓ **clé présente et testée** (photo, illustration, vecteur PNG transparent, vidéo) ; le CDN vidéo renvoie parfois 429 (géré par reprises) | variable d'environnement `PIXABAY_API_KEY` (la clé voyage dans l'URL `?key=`, donc **pas** un Network secret) ; photos, illustrations, vecteurs, vidéos ; licence gratuite, usage commercial |
| Pexels | ✓ hôtes joignables (`api.pexels.com`, `images.pexels.com`) ; **clé requise** (le client n'y a pas encore accès) | variable `PEXELS_API_KEY`, ou Network secret : en-tête `Authorization`, préfixe vidé, hôte `api.pexels.com` |
| Magnific / Freepik (outils MCP `stock_search`, `stock_download`, `images_remove_background`) | ✓ recherche testée (727 résultats « 3d delivery box ») | **40 crédits par téléchargement : demander l'accord du client avant** (proposé : jusqu'à 600 crédits) |
| Génération d'images (FLORA, Higgsfield, Magnific) | disponible | pour des illustrations dans un style cohérent (3D, plat, autocollants) |
| Catalogue KONVWA (Supabase) | disponible | vraies photos produit et prix ; JPG à fond blanc → détourer |
| Détourage local | ✓ `rembg[cpu,cli]` testé sur `products/cerave.jpg` (propre, ~90 s au premier appel le temps de charger le modèle) ; à installer par session | sans crédit |

Règles : ne jamais demander au client de coller une clé dans le chat ; ne jamais afficher une clé ; vérifier sa présence avec `[ -n "$PIXABAY_API_KEY" ]` et tester par une recherche (`https://pixabay.com/api/?key=$PIXABAY_API_KEY&q=…&image_type=illustration`).

Le client peut aussi déposer ses propres fichiers dans la conversation (PNG transparent de préférence) : contexte haïtien (Port-au-Prince, livreurs, clients), série d'illustrations 3D (colis, avion, bateau, camion, pin, téléphone MonCash, gourdes, drapeaux Haïti / Chine / États-Unis, globe), 8 à 10 produits détourés, logos (SVG, MonCash, NatCash), cadre de téléphone. À ranger dans `library/` (`products/`, `illustrations/`, `photos/`, `logos/`).

## À construire (dans cet ordre)

1. ✓ **Fait (Pixabay + rembg)** — voir README « Assets réels ». Reste : Pexels quand une clé existera. Spécification d'origine — **commande `assets`** dans `bin/motion.mjs` : `assets search <pexels|pixabay|unsplash> "<requête>" [--type photo|illustration|vector|video] [--orientation portrait]`, `assets get <source> <id> --to library/<dossier>/<nom>`, `assets cutout <fichier>` (rembg), avec fichier de crédits `library/CREDITS.md`. `lib:` résout déjà `library/…` dans les briefs.
2. ✓ **Fait** (`runtime/depth.js`, README « Profondeur et vraies images ») : `scene.photo`, `scene.collage`, `hook.collage`, champ `decor` partout, champ `carry` (objet qui passe d'une scène à l'autre), ombre sur calque séparé. Assets téléchargés : `illustrations/` (avion, bateau, colis, cartons, téléphone, carte d'Haïti, cliente détourée), `flags/` (Haïti, Chine, USA), `photos/rue-telephone.jpg`. Spécification d'origine :
   - `scene.photo` : photo plein cadre avec zoom lent + texte par-dessus ;
   - `scene.collage` : cutouts et illustrations en profondeur (parallaxe) autour d'un titre ;
   - champ `decor` valable dans **toutes** les scènes : éléments illustrés qui flottent à plusieurs profondeurs ;
   - objets qui **traversent l'écran** d'une scène à l'autre (transition portée par l'asset, pas seulement un balayage de fond) ;
   - ombre portée réelle sous les cutouts (ne pas tweener `filter` sur l'élément qui porte l'ombre : utiliser un calque d'ombre séparé).
3. ✓ **Fait** : `videos/hook-test` (hook.collage → scene.photo avec l'avion porté → scene.collage → fin), vérifié par `snap` image par image, `lint` sans erreur. Spécification d'origine — **nouveau hook de test de 3 s**, rendu et regardé image par image (`snap`) à côté des références, avant de refaire une vidéo entière. Critère : on y voit des images détourées, de la profondeur et au moins un objet qui bouge fort dès 0,15 s.
4. Refaire la démo (même script : importer de Chine et des États-Unis vers Haïti), `check` → `vo` → `build` → `lint` → `snap` → `render` → `qa`, la livrer avec `SendUserFile`.

Contraintes inchangées : 9:16 par défaut, orange `#F05A28` / marine `#0A1628`, Poppins, français (vouvoiement), prix en HTG, voix Algieba, loi des 3 secondes (voir `HOOKS.md`), pas de `.mp4` commité, branche `claude/hyperframes-repo-mmffwu`, pas de PR sans demande, `npm test` doit rester vert.
