# duc-marmelade - notes de fabrication

- La pose `pointup` met la main DANS la grosse tête (x 0,18 < rayon 0,24) : main au-dessus et à côté, hR=(-0,34, -0,14, ht x 2,05).
- `cam.shot(..., at=t)` lit l'orientation du personnage à `t` : lu au milieu d'un demi-tour, il cadre de profil -> `at` = la fin du tour.
- Un fichier d'essai sous `renders/` devient « le projet » pour le moteur (props/, tex/) : `cz.use_scene(<projet>/essai.py)` au début.
- `walk` ne contourne rien : un chemin qui frôle une colonne (r 0,36) ou un chandelier = des CZ CLIP ; garder 0,45 m.
- Le lambrequin du trône cachait la plaque « 1811 » : vérifier chaque pancarte contre ce qui pend devant elle.
- Un cercle sans faces + WIREFRAME ne rend rien : lunettes et monocle en vrais tores.
- Le soleil ne dessinait pas les fenêtres au sol : fill trop fort ; vue de dessus pour voir la lumière, puis fill 900 -> 220 W.
- Un vol de caméra long à travers une terrasse a traversé la tête d'un ouvrier : une coupe (fly=0) à la place.
- `konvwa son` : un mot à trait d'union (« vingt-deux ») était lu comme un décalage ; corrigé dans l'outil.
- Le `sound_design.py` du style ne place que les catégories qu'il connaît (26 effets sur 42 demandés) : rien à forcer.
- Étalonnage : celui du modèle (`--sat 1.15`) ; à sonder avec gradeprobe.py sur les vraies images du PC avant un 2e rendu.
