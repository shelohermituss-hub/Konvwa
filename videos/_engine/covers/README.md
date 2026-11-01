# Couvertures TikTok

**Règle du client (depuis l'éolienne)** : chaque nouvelle vidéo est livrée avec **une couverture créée à part**, très accrocheuse, et non une image tirée du rendu.
- Le visuel est fort : une photo-illustration générée (Magnific `images_generate`, 9:16), ou un rendu 3D dédié.
- Le titre-choc fait 3 à 7 mots (Anton), avec une petite pastille (« COMMENT ÇA MARCHE ? »).
- Des annotations donnent l'échelle ou désignent un détail : cercle « TOI », pointillés de longueur, contour, étiquettes.
- Le texte reste dans le recadrage 3:4 (y 240 → 1680).
- Modèle : `../../eolienne/cover/` (`cover.html` + `render-cover.mjs` → `cover.png`, `cover-grille.png`).

Le générateur ci-dessous (image du rendu + titre) reste utile pour rattraper les anciennes vidéos.

Une couverture = une image tirée du rendu + un gros titre-question. Sortie `videos/<projet>/cover.png` (1080×1920) et `cover-grille.png` (aperçu 3:4 tel qu'il apparaît sur la grille du profil).

```
node videos/_engine/covers/make_covers.mjs            # toutes
node videos/_engine/covers/make_covers.mjs ascenseur   # une seule
```

Il faut le rendu `renders/<projet>.mp4` en local (ou `"render"` dans `covers.json`).

## Ajouter une vidéo

Dans `covers.json` :
- `at` : la seconde de l'image ; choisir un plan riche dont le sujet est dans le haut (le bas devient noir).
- `style` : `anime` (Anton, jaune) ou `3d` (Poppins 800, cyan, fond éclairci).
- `kicker` : la petite étiquette (lieu, date, chiffre).
- `title` : 2 ou 3 lignes, 3 à 6 mots en tout ; `*mot*` = mot en couleur.

## Règles

- **Titre = la promesse ou la question, pas le sujet** (« IL N'A PAS INVENTÉ LA GUILLOTINE », pas « LA GUILLOTINE »).
- Tout le texte reste dans le **recadrage 3:4 central** (y 240 → 1680) : c'est ce que montre la grille du profil.
- Le bas est noir opaque pour cacher les sous-titres incrustés du rendu (ANIMÉ vers y≈1420–1540, 3D vers y≈1180–1300).
- Dans TikTok : *Modifier la couverture → Importer* et choisir `cover.png`.
