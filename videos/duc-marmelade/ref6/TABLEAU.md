# L0 : cibles mesurées sur les six références (porte du lot)

Méthode : `extraire.py` (toutes les images de chaque mp4, 360 de large) → `analyser.py` → `cibles.json` ; `notre.py` mesure notre
film (fichiers de plan pour la caméra, images de contrôle pour l'image). Tenue/vol : définition de `ref/measure.json`
(différence de gris lissée sur 5 images, seuil 8), vérifiée : elle redonne 4,6 cadrages/10 s sur nos six films (le json du moteur : 4,5).
Plage acceptée : P25-P75 des six films, ou ±15 % de la médiane.

| grandeur | nous | réf. médiane | P25-P75 | verdict |
|---|---|---|---|---|
| cadrages /10 s | 6,03 | 4,63 | 3,8-5,3 | **trop** |
| tenue médiane (images) | 33 | 33,5 | 30-37 | OK |
| vol médian (images) | 14 | 10 | 8-11,5 | un peu long |
| luminosité | 117 | 120 | 107-130 | OK |
| saturation | 127 | 115 | 113-130 | OK |
| contraste | 50 | 53 | 48-55 | OK |
| pixels très sombres (encre, nuits) | 0,11 | 0,11 | 0,10-0,18 | OK |
| images sombres (lum < 80) | 2,9 % | 12,8 % | 7,5-21 % | **écart** |
| écart de luminosité entre séquences (P90-P10) | 36 | 58 | 49-70 | **écart** |
| groupes de teinte / changement de teinte | 4 / 50 % | 3 / 47 % | | OK (la variété de TEINTE n'est pas l'écart) |
| netteté, surfaces plates, netteté centre/bords | 218 / 0,39 / 1,8 | 1539 / 0,31 / 4,6 | | **non comparable** : nos images de contrôle sont à 30 % (refaire à pleine taille) |
| plans larges / moyens / gros plans+objets | 31 / 62 / 7 % | ~36 / ~40 / ~24 % | | **écart** : trop de plans moyens, pas assez de gros plans |
| plans penchés (roulis > 3° sur un vol) | 0 % | ~34 % des vols | | **écart** |
| plongées/contre-plongées fortes (|pitch| > 8°) | 8 % | « beaucoup » (annotation) | | **écart** |
| coupes /10 s | 10 dissolves en 69,6 s (1,4) | 0,2 | | **écart** : les références volent sans couper |
| personnages par plan | 2-4 | ~2,1 | | pas d'écart sérieux : la foule est secondaire |

## Ajustements au plan (ce que les mesures changent)

1. **L1 s'inverse sur le rythme** : on a trop de cadrages, pas trop peu. Cible : 4 à 5 cadrages /10 s (≈ 30 à 35 pour 69,6 s au lieu de 42), vols de 10-12 images, tenues inchangées (≈ 33). On fusionne des cadrages au lieu d'en ajouter.
2. **L1 sur la composition** : passer de 7 % à ~24 % de gros plans/objets, de 62 % à ~40 % de plans moyens ; roulis sur environ un tiers des vols ; beaucoup plus de plongées/contre-plongées.
3. **Raccords** : les références ne coupent presque jamais (0,2 /10 s) et la caméra vole d'un lieu à l'autre. Nos 10 fondus entre séquences sont un écart de style (à discuter : garder les fondus aux vrais sauts de temps, remplacer les autres par des vols).
4. **Écart 9 reformulé** : on ne manque pas de teintes variées mais de contraste de luminosité entre ambiances : il faut de vraies séquences sombres (nuit bleue, ~13 % des images), pas seulement des teintes différentes.
5. **Écart 8 (foule) rétrogradé** : les références montrent ~2 personnages par plan ; la densité du décor compte beaucoup plus que le nombre de figurants.
6. **À refaire à pleine taille** : netteté, surfaces plates, netteté centre/bords (plan L1/L4, quelques images à l'échelle 1,0).
