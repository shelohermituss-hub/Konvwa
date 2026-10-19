---
name: konvwa-motion
description: Fabrique une vidéo de motion design KONVWA (verticale 9:16, voix off, effets sonores, hook de 3 secondes) avec le moteur `videos/_engine`. À utiliser pour toute demande de vidéo promo, explicative, produit, chiffre-clé ou annonce pour TikTok / Reels / Shorts, ou quand l'utilisateur donne des vidéos de référence à reproduire dans le style. Remplace le montage à la main : on écrit un brief JSON, le moteur cale l'image sur la voix et place les sons.
---

# /konvwa-motion — vidéos motion design avec le moteur

Le moteur est dans `videos/_engine/` (lire son `README.md`). Il remplace l'écriture de compositions HyperFrames à la main : pour une vidéo KONVWA classique **on n'écrit que le brief**. Pour un besoin hors catalogue (3D, vidéo filmée, carte animée…), passer par `/hyperframes` et ses workflows.

Commande : `node videos/_engine/bin/motion.mjs <commande> <projet>` (alias `E` ci-dessous).

## Déroulé

1. **Cadrer en une phrase** : audience (particulier, revendeur, entreprise), une seule promesse, durée (15–30 s par défaut), format (9:16 par défaut). **Références numérotées** : « utilise la référence n° X » → `E ref X` (la fiche), regarder `references/<NN-nom>/hook.png`, `all.png` et `timeline.jpg`, appliquer son ADN (mise en scène, typo, transitions, fond) avec les pièces du moteur indiquées, et mettre `"reference": X` dans le brief. Une nouvelle vidéo de référence jointe : `E ref add <video> --name=<nom-court>` (numéro suivant), remplir sa fiche dans `references/catalog.json` et donner son numéro au client. `E ref` liste les références. Choisir ensuite le hook le plus proche (`docs/HOOKS.md`).
1b. **Demander les visuels avant de monter** : dès que l'idée est cadrée, lister dans le brief (`"needs"`) les images propres à la vidéo (personnages, objets, captures de l'app, lieux) au format de `docs/ASSETS.md`, les présenter au client (`E assets need <nom>`) et attendre ses fichiers. Pixabay / Unsplash seulement en complément. Proposer aussi ce qui manque à la bibliothèque de base (`docs/ASSETS.md`).
2. **Écrire le hook d'abord** (3 s : ≤ 7 mots, mot-clé en `*couleur*`, phrase dite ≤ 2,5 s). Par défaut `hook.impact` (typo cinétique plein cadre, blocs séparés par `|`) ; sinon le hook qui colle au sujet (vrais objets → `hook.collage`, produit → `hook.product`, chiffre → `hook.number`, question → `hook.question`).
3. **Écrire le corps** : une scène = une phrase dite = une idée. Varier aussi l'entrée du texte (`anim` : `mask`, `letters`, `pop`, `type`). Varier les types (`E types`). Terminer par `scene.end`. Texte à l'écran ≠ phrase dite : l'écran est un titre court, la voix est une phrase naturelle (vouvoiement, concret, prix en HTG, sans jargon).
4. `E new <nom>` puis éditer `videos/<nom>/brief.json` ; `E check <nom>` jusqu'à zéro erreur (la loi des 3 secondes est une erreur, pas un conseil).
5. **Voix** (sauf si l'utilisateur veut une vidéo musicale : `"voice": {"mode": "none"}`) : `E vo <nom>` affiche un prompt par phrase. Générer avec FLORA — `flora_create_generations` (`type: "audio"`, `model: "t2a-gemini-3-1-flash-tts"`, `params: {"voice_name": "Algieba", "language_code": "fr-FR"}`, un élément par phrase, prompt = celui affiché par `E vo`), réutiliser le projet FLORA du dépôt si l'utilisateur en a un, sinon en créer un. Coût ≈ 0,013 $ par phrase : le dire. Attendre ≥ 15 s, relire avec `flora_list_generations`, puis `E vo-save <nom> s01=<url> s02=<url> …`.
   - La voix peut varier d'une vidéo à l'autre (autre `voice.name`, autre `voice.style` : `punchy`, `premium`, `urgent`, `friendly`, `story`), l'énergie non. Voix Gemini utiles : Algieba (défaut, lisse), Puck (enjouée), Charon (informative), Fenrir (très énergique), Kore (ferme), Leda (jeune), Orus (ferme, grave), Zephyr (claire). Toujours prévenir de la voix choisie.
   - Vérifier que la durée mesurée colle à l'estimation de `E vo` ; si le style a été prononcé à voix haute (durée +3 s), reformuler le prompt.
6. `E build <nom>` : l'image se cale sur la durée réelle des voix. Relire la table (début / durée / transition) et la checklist des 3 secondes.
7. `E lint <nom>` (0 erreur ; les avertissements de contraste pendant une animation en cours sont acceptables) puis `E snap <nom> --at=0.15,0.6,1.2,2.0,2.7,<milieu de chaque scène>` et **regarder les images** (lire `contact-sheet*.jpg`). Corriger le brief (texte plus court, autre type, `|` pour couper une ligne) plutôt que le moteur.
8. `E render <nom>` (en arrière-plan : 3–5 min), puis `E qa <nom>`. Livrer le MP4 avec `SendUserFile`. Ne jamais commiter les `.mp4`.
9. Si un cas revient (nouvelle mise en scène, nouveau son), l'ajouter au moteur (`README.md` § Ajouter…) avec un test dans `tests/engine.test.mjs`, pas dans le projet.

## Règles de marque

Français, vouvoiement (voix de synthèse en français uniquement : le créole par TTS a été testé et refusé, voir `videos/demo-creole/README.md`). **Fond blanc** en thème clair (ou marine `#0A1628`) ; l'orange `#F05A28` dans le texte et ce qui agit, pas en halos dans les coins, Poppins, prix en HTG, paiements MonCash / NatCash. Photos produit réelles (bibliothèque `library/products/` ou images du catalogue copiées dans `assets/`), jamais d'illustrations génériques. Ne pas inventer de prix, de délai ni de chiffre : s'ils ne viennent pas de l'utilisateur ou du catalogue, rester qualitatif.

## Pièges connus

- Jamais `Math.random`, horloge ou `<br>` dans le moteur (un test le vérifie).
- Les couleurs que GSAP interpole viennent de `env.pal`, pas de `var(--…)`.
- Le texte du hook dépasse 48 caractères ou la phrase dite 2,5 s → le brief est refusé : raccourcir.
- Images JPG à fond blanc : multiplier (thème clair) — pour un fond sombre ou un détourage net, fournir un PNG transparent.
- Le rendu nécessite le réseau (GSAP depuis jsDelivr, polices embarquées par HyperFrames).
