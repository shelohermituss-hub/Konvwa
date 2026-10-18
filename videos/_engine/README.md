# KONVWA motion engine

Un moteur pour fabriquer vite des vidéos de motion design verticales (9:16) **cohérentes, rythmées et accrocheuses** : on écrit un *brief* (une liste de scènes + ce qui est dit), le moteur calcule le montage, place les sons, génère un projet HyperFrames, le rend en MP4 et contrôle le résultat.

```
brief.json ──check──▶ calendrier calé sur la voix ──build──▶ projet HyperFrames ──render──▶ MP4 ──qa──▶ rapport
   (vous)        loi des 3 secondes            index.html + 1 composition par scène        contrôle du rendu
```

Tout ce qui est généré est déterministe (pas d'horloge, pas de `Math.random`) : le même brief donne la même vidéo, image pour image.

## En 5 minutes

```bash
E=videos/_engine/bin/motion.mjs
node $E types                      # scènes, transitions, sons, styles de voix, formats
node $E new promo-livraison        # crée videos/promo-livraison/brief.json (copie de l'exemple)
# … éditer le brief …
node $E check promo-livraison      # valide + calendrier + loi des 3 secondes
node $E vo promo-livraison         # liste les phrases à faire dire (prompts prêts à l'emploi)
#   → générer les voix (FLORA, Gemini TTS, voix Algieba par défaut), puis :
node $E vo-save promo-livraison s01=<url> s02=<url> …   # télécharge, coupe les silences, range en assets/vo/
node $E build promo-livraison      # image calée sur la durée RÉELLE de chaque voix, sons placés
node $E lint promo-livraison       # hyperframes check (mise en page, contraste, runtime)
node $E snap promo-livraison --at=0.15,0.6,1.2,2.0,2.7   # captures pour vérifier le hook à l'œil
node $E render promo-livraison     # renders/promo-livraison.mp4
node $E qa promo-livraison         # format, durée, niveau sonore, énergie du hook, images figées
```

Sans voix générées, `build` fonctionne quand même (durées estimées, brouillon muet) : on peut juger l'image avant de dépenser le moindre crédit de voix.

## Assets réels (photos, illustrations, objets détourés)

```bash
node $E assets search pixabay "delivery box" --type=vector          # photo | illustration | vector | video ; --orientation=portrait (défaut) | landscape | any
node $E assets get pixabay 7421938 --type=vector --to=library/illustrations/cartons   # → "lib:illustrations/cartons.png"
node $E assets cutout videos/_engine/library/products/cerave.jpg     # → cerave-cutout.png (fond retiré, local, sans crédit)
```

- Clé : `PIXABAY_API_KEY` dans l'environnement (jamais dans le code ni dans le chat ; elle est masquée dans les messages d'erreur).
- Les médias générés par IA ou marqués « basse qualité » sont écartés ; à orientation égale, les plus téléchargés d'abord.
- Les vecteurs Pixabay arrivent en PNG transparent (1280 px) : déjà détourés. Photos en JPG 1280 px, vidéos en 1080p (lourdes : ne pas les committer sans raison).
- Chaque `get` ajoute (ou remplace) sa ligne dans `library/CREDITS.md` : source, id, page, auteur.
- `cutout` utilise [rembg](https://github.com/danielgatis/rembg) : `pip install "rembg[cpu,cli]"`, ou `REMBG=/chemin/vers/rembg`. Le premier appel télécharge le modèle (~170 Mo).
- Unsplash passe par ses outils MCP (`search_photos`, `download_asset`) puis `cutout` ; Pexels attend une clé.

## Le brief

```jsonc
{
  "name": "promo-livraison",          // dossier videos/<name>
  "format": "9:16",                   // 9:16 (défaut) · 4:5 · 1:1 · 16:9
  "theme": "light",                   // light | dark (par défaut ; chaque scène peut avoir le sien)
  "brand": "konvwa",                  // brands/<brand>.json
  "seed": 7,                          // change les décors / transitions automatiques
  "voice": { "mode": "vo", "name": "Algieba", "style": "punchy" },   // mode "none" = vidéo musicale sans voix
  "sfx": { "level": 1 },              // 0 = sans effets sonores
  "music": { "file": "lib:music/bed.mp3", "volume": 0.14 },          // optionnel
  "scenes": [
    { "type": "hook.statement", "tone": "accent",
      "text": "Achetez *partout*.|Recevez en Haïti.",   // *accent*  _serif italique_  |=retour à la ligne
      "vo":   "Achetez partout. Recevez en Haïti." },    // ce qui est DIT (peut différer du texte affiché)
    { "type": "scene.chips", "text": "Collez *le lien*", "items": ["Alibaba", "Shein"], "vo": "…" },
    { "type": "scene.end", "vo": "KONVWA. Achetez, nous livrons." }
  ]
}
```

Champs communs à toutes les scènes : `type`, `vo`, `anim` (entrée du texte : `mask` · `letters` · `pop` · `type` · `rise` ; chaque type a déjà la sienne), `transition` (cut · whip · up · circle · scale · flash · fade), `theme`, `tone` (`"accent"` = scène plein orange), `tail` (secondes de respiration après la voix), `dur` (forcer la durée), `sfx` (`[{ "t": 0.4, "cue": "pop" }]` pour ajouter un son). Les champs propres à chaque type sont listés par `node $E types`. Les images : `"lib:products/cerave.jpg"` (bibliothèque partagée `library/`) ou un chemin dans le projet (`assets/…`).

**Thème clair = page blanche.** L'orange de la marque va dans le texte (mot-clé, chiffres, kicker) et dans ce qui agit (boutons, coches, traits d'impact), jamais en halos dans les coins.

**Visuels à demander au client** : `"needs": [{ "file": "lib:people/cliente-colis.png", "what": "Cliente haïtienne qui ouvre un colis, souriante", "format": "PNG transparent ≥ 1500 px" }]` dans le brief ; `node $E assets need <projet>` affiche la liste cochée. La bibliothèque de base à constituer est décrite dans `docs/ASSETS.md`.

Un exemple complet est dans `examples/demo.brief.json` (6 scènes, 22 s) ; `videos/hook-test/brief.json` montre les vraies images en profondeur.

### Profondeur et vraies images

Deux champs valables dans **toutes** les scènes :

- `decor` : objets détourés qui flottent sur plusieurs plans (parallaxe). `["lib:flags/haiti.png", …]` (placés seuls sur les bords) ou `{ "src", "x", "y", "depth": 0–1, "size": fraction de la largeur, "rot" }`. `depth` < 0,5 = derrière le contenu, un peu flou ; ≥ 0,5 = devant, plus gros, bouge plus. Les drapeaux (`flags/`) prennent un style d'autocollant.
- `carry` : un objet (`"lib:illustrations/avion.png"`) qui traverse l'écran de cette scène **jusque dans la suivante**, pendant la transition : il vit sur la racine de la composition, pas sur la scène, donc la transition ne le déforme pas ; les deux scènes calculent le même vol (`M.carryAt`).

**Comparatif « Avant / Après »** (`videos/avant-apres`) : `hook.split` (`left`, `right`, `sub?` : une ligne orange coupe l'écran, « avant » gris qui tremble, « après » net) puis `scene.split` (`left` / `right` = `{ text, image? | screen? | bubbles? | icon?, scroll?, tap? }` : `screen` = capture d'app dans un téléphone, `scroll` = défilement en % de la capture, `tap` = [x, y] dans le cadre du téléphone où le curseur touche ; à gauche l'image passe en gris et la légende est barrée). Captures de l'app dans `library/app/`.

**Série « Devinez le prix »** (15 s) : `node $E new devine-prix-02 --example=devine-prix`, puis changer l'image, le prix (catalogue : `price_htg`, prix du produit — la livraison est en plus et doit rester écrite), la date et le numéro d'épisode. Types : `scene.guess` (produit en grand, « ? » qui surgissent, autocollant `sticker`), `scene.countdown` (3-2-1 géant calé sur la voix « Trois. Deux. Un. », prix caché), `scene.reveal` (`price`, `currency`, `note`, `date`, `reactions` : 2 visages de `library/people/` en autocollant, confettis). Les visages de `library/people/` reçoivent un contour blanc automatique.

Pour une vidéo de prévention (piège → solution) : `scene.versus` (`bad: {text, icon?}` barré en rouge, puis `good: {text, sub?, images?}` qui arrive dessous avec coche orange et logos ; `kicker?` = « Arnaque n° 2 »), `scene.ui` avec `kicker` et des cartes `"tone": "danger"` (rouge, secousse, son glitch), et `scene.trio` (`kicker` serif italique, `text` en capitales, 2 à 4 `items` `{image|icon, label}` dans des cercles pointillés ; 4 = grille 2 × 2). Ces deux types prennent le fond `"bg": "gobo"` par défaut (ombres de feuillage, référence G). Exemple : `videos/arnaques-chine/brief.json`.

Types qui reposent sur de vraies images : `hook.collage` / `scene.collage` (`text` + `items` : objets détourés autour d'un grand disque orange, texte blanc, mot-clé marine ; tout saute au mot-clé) et `scene.photo` (`image` plein cadre en zoom lent, `text` blanc en bas, `kicker?`, `focus?` = `object-position`). Les objets ont un **calque d'ombre séparé** (jamais de `filter` animé sur l'élément qui porte l'ombre). Les JPG à fond blanc (photos produit) se fondent dans un fond clair.

### Pack « papier quadrillé » (référence I)

Pour copier le style « pub d'agence » : papier gris clair quadrillé, logo fixe en haut à gauche, texte = voix, lettre par lettre, **coupes franches** (`"transition": "cut"` sur chaque scène : le fond ne change jamais, la coupe ne se voit pas). Palette : nuances d'orange de la marque (`shades` dans `brands/konvwa.json` → `--deep`, `--darker`…) et encre noire, jamais de marine. Exemple complet : `videos/diaspora-argent/brief.json`.

- `lines` (toutes les scènes du pack) : lignes empilées de tailles mêlées. Une chaîne = petite ligne noire ; un objet `{ t, s: xs|s|m|l|xl|px, c: ink|accent|deep|light|white, i (gras italique), bar (barre orange qui naît d'un carré, "deep" = orange profond), circle (cercle tracé à la main autour du mot *accent*), arrow: down|up, outline (contour seul), align: right|center, dx }`. `at: { x, y, align: left|center }` place le bloc ; `span` (0–1) = part de la voix sur laquelle les lignes s'écrivent (défaut 0,8).
- `objects` : photos détourées lancées avec flou de mouvement et longue ombre douce : `{ src, x, y, w, rot, from: right|left|top|bottom|none|[x, y], at, dur, dof (flou de profondeur, px), back, duo: orange|deep|light (bichromie), flip, move: { at, x, y, s, rot, fade, dur } }`.
- `hook.paper` (lignes + objets, code-barres éditorial), `scene.paper` (lignes + objets), `scene.chart` (`chart`: carte orange, courbe qui descend), `scene.deck` (`deck.items` `{ label, icon }` : la pile ralentit puis s'ouvre — 2-3 cartes en éventail, 4 en grille — après le cercle), `scene.rise` (`image` en bichromie qui monte du bas, `rise: { w, x, duo, bottom }`, `icons` autour), `scene.frame` (`frame: { image, y, h, scale, focus, pill: { text, icon } }` : la personne sort d'une carte orange), `scene.button` (`button: { text, icon, sub, y }` : bouton qui naît d'un carré, texte tapé), `scene.contact` (fin : logo, `text` avec `|`, `cta`, `pills`, puis retour à la page vide pour boucler sur le hook).

## Comment le moteur décide

- **La voix mène l'image.** Durée d'une scène = début de voix + durée *mesurée* de la voix + respiration + chevauchement de la transition suivante. Les mots du texte apparaissent répartis sur la voix (`M.timesFor`). Changer une phrase change automatiquement le montage.
- **Les scènes se chevauchent** d'exactement la durée de la transition ; la scène qui arrive est au-dessus et porte le geste.
- **Les sons sont déduits** des gestes (chaque type de scène déclare ses `sfx()`), dédoublonnés et rangés sur des pistes audio qui ne se chevauchent pas. Banque : `sfx/` (licence Pixabay, voir `sfx/CREDITS.md`).
- **Le texte se met en page seul** : `M.layout` calcule la plus grande taille qui tient en ≤ N lignes et équilibre les lignes (jamais de mot orphelin, ponctuation haute collée au mot).
- **Rien n'est animé par `var(--…)`** : les couleurs que GSAP interpole viennent de `env.pal` (palette réelle du thème).

## Structure

```
videos/_engine/
  bin/motion.mjs      la commande
  lib/                brief (validation) · schedule (calendrier, sons, loi des 3 s) · emit (projet HyperFrames) · qa · ref · media · assets + pixabay (assets réels)
  runtime/            ce qui tourne dans le navigateur ET dans Node : core (règles, markup, mise en page) · dom · fx · mount (transitions) · hooks · scenes · depth (détourés, decor, carry, collage, photo) · paper (pack « papier quadrillé ») · motion.css
  brands/             konvwa.json (couleurs, thèmes, voix, slogan) + logo
  sfx/                15 sons + CREDITS.md
  library/            images partagées : products/ · illustrations/ (PNG détourés) · flags/ · photos/ — "lib:…" + CREDITS.md
  references/         planches et chiffres des vidéos de référence
  examples/           briefs d'exemple
  docs/               REFERENCES.md (ADN de style) · HOOKS.md (les 3 premières secondes)
  tests/              vitest (inclus dans `npm test`)
```

## Ajouter…

- **Une scène** : `M.register('scene.mon-type', { kind, label, min, max, words, needs, sfx(spec, env), build(ctx) })` dans `runtime/scenes.js` (ou `hooks.js`, ou `paper.js` pour le pack « papier quadrillé »). `build` ne touche qu'à `ctx.stage` et `ctx.tl` (un `<div>` et une timeline GSAP en pause) ; règle d'or : un élément = *un* `fromTo` d'entrée, tout le reste en `to`. Ajouter les classes dans `runtime/motion.css` (polices nommées explicitement). Un hook déclare aussi `legible(spec, env)`.
- **Une marque** : copier `brands/konvwa.json` et son logo SVG, `"brand": "<id>"` dans le brief.
- **Un son** : fichier dans `sfx/`, entrée dans `M.CUES` (`core.js`) avec `vol`, `dur`, `max`.
- **Une référence** : `node $E ref video.mp4 --name=ref-g-xxx`, puis la décrire dans `docs/REFERENCES.md`.

## Limites connues

- Les images produit des fiches catalogue sont des JPG à fond blanc : en thème clair elles sont fondues par `mix-blend-mode: multiply`, en thème sombre posées sur une carte blanche. Pour un détourage propre, fournir des PNG transparents.
- Les durées de voix doivent venir de fichiers réels pour que le calage soit exact ; sinon elles sont estimées (≈ 2,7 mots/s).
- Rendu : Chrome + FFmpeg (installés par `npx hyperframes`), ~3 à 5 min pour 25 s de 1080×1920 sur CPU.
