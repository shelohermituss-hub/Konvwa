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

Champs communs à toutes les scènes : `type`, `vo`, `transition` (cut · whip · up · circle · scale · flash · fade), `theme`, `tone` (`"accent"` = scène plein orange), `tail` (secondes de respiration après la voix), `dur` (forcer la durée), `sfx` (`[{ "t": 0.4, "cue": "pop" }]` pour ajouter un son). Les champs propres à chaque type sont listés par `node $E types`. Les images : `"lib:products/cerave.jpg"` (bibliothèque partagée `library/`) ou un chemin dans le projet (`assets/…`).

Un exemple complet est dans `examples/demo.brief.json` (6 scènes, 22 s).

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
  runtime/            ce qui tourne dans le navigateur ET dans Node : core (règles, markup, mise en page) · dom · fx · mount (transitions) · hooks · scenes · motion.css
  brands/             konvwa.json (couleurs, thèmes, voix, slogan) + logo
  sfx/                15 sons + CREDITS.md
  library/            images partagées (produits, illustrations…) : "lib:products/…" + CREDITS.md
  references/         planches et chiffres des vidéos de référence
  examples/           briefs d'exemple
  docs/               REFERENCES.md (ADN de style) · HOOKS.md (les 3 premières secondes)
  tests/              vitest (inclus dans `npm test`)
```

## Ajouter…

- **Une scène** : `M.register('scene.mon-type', { kind, label, min, max, words, needs, sfx(spec, env), build(ctx) })` dans `runtime/scenes.js` (ou `hooks.js`). `build` ne touche qu'à `ctx.stage` et `ctx.tl` (un `<div>` et une timeline GSAP en pause) ; règle d'or : un élément = *un* `fromTo` d'entrée, tout le reste en `to`. Ajouter les classes dans `runtime/motion.css` (polices nommées explicitement). Un hook déclare aussi `legible(spec, env)`.
- **Une marque** : copier `brands/konvwa.json` et son logo SVG, `"brand": "<id>"` dans le brief.
- **Un son** : fichier dans `sfx/`, entrée dans `M.CUES` (`core.js`) avec `vol`, `dur`, `max`.
- **Une référence** : `node $E ref video.mp4 --name=ref-g-xxx`, puis la décrire dans `docs/REFERENCES.md`.

## Limites connues

- Les images produit des fiches catalogue sont des JPG à fond blanc : en thème clair elles sont fondues par `mix-blend-mode: multiply`, en thème sombre posées sur une carte blanche. Pour un détourage propre, fournir des PNG transparents.
- Les durées de voix doivent venir de fichiers réels pour que le calage soit exact ; sinon elles sont estimées (≈ 2,7 mots/s).
- Rendu : Chrome + FFmpeg (installés par `npx hyperframes`), ~3 à 5 min pour 25 s de 1080×1920 sur CPU.
