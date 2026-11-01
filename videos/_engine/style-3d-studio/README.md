# Style « STUDIO » — variante C retenue par le client

**Nom choisi par le client : « style STUDIO », mise en page C (sous-titres en haut).** Premier modèle : `../../eolienne/` (« Comment une éolienne fait de l'électricité »). Les règles de fabrication sont à la fin de ce fichier.

Trois vidéos de référence envoyées par le client. Elles appartiennent à **la même famille** : des explications d'objets du quotidien, en rendus 3D « produit » très propres et en plans macro. Chacune a pourtant **sa propre mise en page**.

| | A — empreinte Samsung (EN) | B — sèche-cheveux Dyson (EN) | C — imprimante et points jaunes (**FR**) |
|---|---|---|---|
| Durée | 89 s | 84,6 s | 93,9 s |
| Coupes | 5 (presque un plan continu) | 8 | 22 (un plan toutes les ~4 s) |
| Fond | noir bleuté, dégradé | pièce sombre vert-bleu, mur à carreaux | noir `#0f1011` avec grille très fine ; quelques plans studio blancs |
| Sous-titres | **bas (≈ 70 %)**, dans une pastille sombre arrondie ; mot prononcé **blanc souligné**, déjà dits gris clair, à venir plus sombres | **bas (≈ 70 %)**, gras blanc ; mots à venir gris (karaoké) | **haut (≈ 18 %)**, au-dessus de l'image ; mots déjà dits **fins et gris**, mot en cours **gras blanc**, mot-clé dans un **cadre de sélection bleu avec deux poignées rondes** (type Figma) ; le mot suivant arrive **flou** puis net |
| Étiquettes | puces mono sombres avec point turquoise (« • ultrasound pulse », « • ridge · touching ») et trait de rappel ; mention mono « illustrative render · magnified » | texte fin avec trait de rappel et petit cercle (« Heating element ») ; grands titres gras (« Air Multiplier ») ; **un point fixe au centre de l'écran** | chiffres et mots intégrés à la 3D (« 2004 », « JET D'ENCRE »), interface de téléphone à la fin |
| 3D | rendu réaliste (doigt, téléphone, coupe de la peau), anneaux d'ondes turquoise et violets | personnage « mannequin » en pâte, cheveux en mèches, flux d'air en particules bleues, chaleur en particules orange, vues en coupe | rendus studio (billes dorées, loupe, imprimantes, billet), personnage en pâte sans visage, mains, page qui sort |
| Voix | homme, 143 Hz, **178 mots/min**, posé | homme, 144 Hz, **165 mots/min**, posé | homme, 155 Hz, **195 mots/min**, ton de conversation, tutoiement |
| Musique | légère (fond à −25 LUFS, voix à −14) | présente (fond à −21 LUFS) | **aucune** (fond à −52 LUFS : la voix seule) |
| Bruitages | ~53 | ~127 (souffles des particules) | ~21, discrets |
| Accroche | fait surprenant + « So how… ? » | chiffre choc (110 000 tr/min) + « So why… ? » | fait + « Alors, pourquoi tu n'as jamais vu ces points ? » : le format **énigme** déjà adopté |
| Fin | question au spectateur | question au spectateur (« Genius engineering? ») | **« Abonne-toi et envoie ça à quelqu'un qui… »** avec une feuille de partage de téléphone |

## Ce qu'elles ont en commun

- **Vertical 9:16, 30 i/s.** Nous rendons en 1080×1920.
- **Des rendus « produit »** :
  - éclairage de studio doux, matériaux brillants ou mats réalistes, ombres douces, faible profondeur de champ ;
  - plans macro sur la pièce qui compte, vues en coupe, et particules pour montrer l'invisible (son, air, chaleur).
- **Un plan par idée**, avec de vraies coupes (contrairement au « style 3D », qui est un plan unique).
- **Sous-titres mot à mot**, très lisibles. Le mot en cours est mis en avant et le reste est atténué.
- **Récit** :
  - un fait surprenant, puis une question (« pourquoi / comment ? ») ;
  - « Imagine… », une scène du quotidien ;
  - le mécanisme, expliqué pas à pas ;
  - un chiffre ou une date ;
  - un retour à la question du début ;
  - une question finale ou un appel.

## Comment le recréer chez nous

- **Moteur** : Three.js piloté par HyperFrames, comme le style 3D, avec un rendu plus « studio » :
  - tone mapping ACES, environnement de reflets (`RoomEnvironment`), ombres douces, brouillard ;
  - flou de profondeur en post-traitement si le temps de rendu le permet.
- **Objets** : géométrie construite à la main pour les formes simples. Pour les objets complexes (mains, téléphones, imprimantes, personnages en pâte), des **modèles 3D générés par Magnific** (`models3d_generate`, GLB), chargés avec `GLTFLoader` depuis les fichiers du projet.
- **Sous-titres** : un composant par variante (A : pastille soulignée en bas ; B : karaoké gras en bas ; C : haut, mot gras et cadre de sélection bleu).
- **Voix** : **Adrien Moreau** (`voiceId` 230) est la plus proche de la voix française de la vidéo C au comparatif de timbre (MFCC 19,0, devant Thibault Vasseur 22,6 et Cédric Bouchard 27,6). Hauteur 147 Hz contre 155 Hz. Il faut l'accélérer légèrement pour arriver vers 195 mots/min.
- **Son** :
  - variante C : sans musique, la voix seule et quelques bruitages discrets ;
  - variantes A et B : musique légère sous la voix avec `../style-anime/mix_anime.py` (réglages corrigés contre les coupures).
- **Limite à connaître** : le réalisme des mains, des peaux et des cheveux de ces références vient d'un vrai logiciel 3D (de type Blender). En Three.js, on s'en approche avec des modèles générés et un éclairage soigné, mais les personnages resteront dans le style « pâte » de B et C plutôt que photoréalistes.

## Fabrication (variante C, modèle `../../eolienne/`)

- **Rendu** : directement en 60 i/s (`npx --yes hyperframes@0.8.168 render --fps 60 --quality looks --output renders/raw60.mp4`, puis `python3 -I ../_engine/style-histoire/finish.py renders/raw60.mp4 renders/<projet>.mp4`). Compter environ 1 h 30 pour 90 s sur la machine du cloud, environ 1 h pour 65 s.

- **Script** : **60 à 70 s** (règle du client), soit environ 210 à 230 mots à 200 mots/min, avec tutoiement et ton de conversation. L'éolienne (90 s) a été faite avant cette règle.
  - Déroulé : un fait surprenant, puis « Alors, comment… ? », puis « Imagine… », le mécanisme pas à pas, le retour à la question (« Alors, ce truc… ? »), et enfin « Abonne-toi, et envoie ça à quelqu'un qui… ! ».
  - Les nombres sont écrits en lettres pour la voix et en chiffres à l'écran (`disp.json`).
- **Voix** : Adrien Moreau (`voiceId` 230, `eleven_v4`, stabilité 0,4), consigne `[conversational, clear, confident, lively explainer]`.
  - Il parle naturellement à environ 200 mots/min : tempo ×1,0.
  - Pauses alignées à 0,18 s (`../style-histoire/align_voice.py`).
  - Après l'alignement, vérifier les mots que Whisper place dans la pause suivante : nombres écrits en lettres, « Alors, ». Les recaler à la main.
- **Plans** :
  - Une liste `SH` de plans `{ k: <indice du mot>, g: [ensembles 3D], cam: (u, t) => …, st: { … } }`. Chaque plan commence 0,06 s avant son mot, avec une coupe franche.
  - Chaque objet est un `THREE.Group` : on ne montre que ceux du plan en cours.
  - Rendu studio : `ACESFilmicToneMapping`, `RoomEnvironment`, ombres douces, sol à grille fine.
  - `fy` abaisse le sol pour les gros plans, sinon il coupe les objets.
  - Les plans clairs (`light: true`) sont à réserver aux objets colorés : blanc sur blanc, on ne voit rien.
- **Sous-titres** : groupes de 4 mots ou 19 caractères au plus, centrés vers y = 290-470.
  - Le mot entre flou (`blur(14px)` → 0, 0,17 s), en gras blanc tant qu'il est dit, puis il passe en fin et gris.
  - Les mots-clés (`KEYW`) restent en gras dans un cadre bleu `#3d7bff` à deux poignées.
  - La bande du haut est un dégradé `#0f1011` avec une grille fine, en version claire sur les plans clairs.
- **Étiquettes** : en mono, majuscules, sans fond, projetées depuis la 3D. Les gros chiffres sont en Inter 800 (« 300 KM/H », « 1831 »).
  - Le cadre de sélection 3D (`selAround`) entoure une pièce, comme dans Figma.
- **Fin** : la feuille de partage d'un téléphone en HTML/CSS. Le haut de l'écran est un trou qui laisse voir la 3D. On choisit un contact puis on tape « Envoyer » → « ✓ Envoyé ».
- **Son** :
  - pas de musique ;
  - une ambiance très basse (`../style-3d/sfx/ambiance-vent.mp3`, coupée sous 280 Hz, 20 dB sous la voix au-dessus de 300 Hz), pour que les pauses ne tombent jamais dans le silence numérique ;
  - environ 40 bruitages discrets.
  - Le mixage avec `../style-anime/mix_anime.py` doit annoncer **0 trou**.
- **Pièges rencontrés** :
  - `groupe.add(mesh(...)).rotation.x = …` tourne le **groupe**, pas la pièce : utiliser `rx(mesh(...))`.
  - Projeter les étiquettes après `camera.updateMatrixWorld()` et `TB.updateMatrixWorld(true)`.
  - Les pales passent devant la caméra : les figer (`rotFix`) ou les cacher (`noRot`) dans les gros plans de la nacelle.
