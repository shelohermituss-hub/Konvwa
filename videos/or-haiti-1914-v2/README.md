# « L'or d'Haïti » — version 2 (mouvement enrichi)

Même voix, mêmes images, même texte que `../or-haiti-1914` (v1, style « histoire express »). Seul le mouvement change, en reprenant les idées utiles des prompts « motion » fournis par le client :

| Avant (v1) | Maintenant (v2) |
|---|---|
| Flou plein cadre entre chaque partie | **Chaque scène naît de la précédente** : inondation de couleur qui sort d'un objet et se rétracte dans le suivant (bleu haïtien, noir, rouge), **iris d'appareil photo à 6 lames** sur les photos d'époque, **pages qui poussent** (haut, gauche) |
| Cartes photo fixes avec léger zoom | La photo remplit l'écran derrière l'iris puis **se replie en carte** ; **zooms de caméra** sur le détail (la banque, le badge « New York », « violation », « 19 ans ») |
| Apparitions floues | **Ressorts** depuis zéro avec dépassement ; **mots-clés qui montent d'une ligne de masque** ; sortie du texte par le haut dans sa ligne |
| Musique coupée au scratch | L'écran **reste noir** pendant le silence du scratch (« Bilan : » en blanc), puis le noir se rétracte sur « un braquage » |
| 30 i/s | **Rendu 120 i/s fusionné en 60 i/s** (2 sous-images par image → flou de mouvement naturel) |
| −16 LUFS | **−14 LUFS** (standard TikTok), puis recherche automatique des images isolées qui « sautent » |

- L'iris et les inondations sont des fonctions pures du temps (`ctl(t)` dans `index.html`), comme le reste de la timeline GSAP : aucune image ne dépend de la précédente.
- Le texte mot par mot (signature du style) est conservé pour les mots ordinaires.
- Sons : ceux de la v1, plus clics d'obturateur sur l'iris et souffles sur les inondations et les poussées.
- **Rendu** :
  1. `npx --yes hyperframes@0.8.168 render --fps 120 --quality looks --output renders/raw120.mp4`
  2. `python3 -I ../_engine/style-histoire/finish.py renders/raw120.mp4 renders/or-haiti-1914-v2.mp4` (60 i/s + flou de mouvement, −14 LUFS, détection des sauts).
  MP4 non commités.
- Sources des images et faits : voir `../or-haiti-1914/README.md`.
