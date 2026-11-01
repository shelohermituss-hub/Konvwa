# Couvertures TikTok

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
