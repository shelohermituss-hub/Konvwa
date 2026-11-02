# Objets 3D et ciels du style ANIMÉ

Tout ce dossier est sous licence **CC0** (usage libre, sans citer l'auteur), sauf `sketchfab/` en **CC BY** : usage libre, même monétisé, en citant les auteurs listés dans `sketchfab/CREDITS.md`.

| Dossier | Source | Comment il arrive |
|---|---|---|
| `polyhaven/hdri/` | Poly Haven (polyhaven.com), ciels HDRI 1k pour une lumière de cinéma | téléchargé par Claude (API Poly Haven) |
| `polyhaven/tex/` | Poly Haven, matières réalistes 1k (couleur `_diff`, relief `_nor` en OpenGL, rugosité `_rough`) : sols, plâtres, tuiles, bois, terre sèche | téléchargé par Claude (API Poly Haven) |
| `polyhaven/models/` | Poly Haven, objets réalistes (au cas par cas) | téléchargé par Claude |
| `sketchfab/` | Sketchfab, modèles en CC BY (auteurs dans `sketchfab/CREDITS.md`) | téléchargé par Claude (API Sketchfab ; la clé du client n'est jamais écrite dans le dépôt) |
| `kenney/` | Kenney (kenney.nl) | à télécharger par le client : le site ne laisse pas télécharger automatiquement |
| `quaternius/` | Quaternius (quaternius.com) | à télécharger par le client |
| `kaykit/` | KayKit (kaylousberg.itch.io) | à télécharger par le client |

Format attendu : **glTF / GLB** (c'est ce que lit three.js). Un sous-dossier par pack, en gardant son nom.
On ne garde dans le dépôt que les objets réellement utilisés, compressés ; aucun fichier au-dessus de 100 Mo (limite de GitHub).

Ciels déjà présents : `kloofendal_48d_partly_cloudy_puresky` (jour, nuages), `venice_sunset` (coucher de soleil), `kiara_1_dawn` (aube),
`moonless_golf` (nuit), `studio_small_08` (intérieur studio).
