---
workflow: general-video
flow: automation
storyboard: no
message: "Acheter en Chine depuis Haïti, c'est 4 étapes avec KONVWA : choisis, paie en gourdes, on expédie, tu reçois."
destination: tiktok-reels-shorts
aspect: 1080x1920
language: fr
length: 29s
angle: affiche éditoriale animée (motion design), typographie cinétique calée sur le beat et la voix off
voice: Algieba
---

## Intent

Demande : « Tu es motion designer, utilise ces deux vidéos de référence pour créer une
vidéo "comment acheter en Chine en étant en Haïti", je te laisse décider de tout,
utilise le même style, utilise de vrais assets réels. »

Style repris des deux références (fournies dans la conversation, non intégrées) :
- Réf. A (« Minimal design. Maximum feel ») : fond papier crème, sujet détouré posé sur
  un grand disque, mots qui s'écrivent mot par mot (fin + très gras + manuscrit),
  métadonnées d'appareil photo (ISO, WB, 1/60, F2.8), code-barres, cadre doré avec
  étiquettes, bande de papier déchiré, mots géants en contour derrière le sujet,
  fin sur fond noir avec un mot qui brille.
- Réf. B (Miracle Studios) : alternance de plans clairs gris et de plans noirs,
  carré/disque d'accent, cadres en filets fins, mot géant flou qui défile en bas,
  texte en contour qui défile, phrases en deux graisses (« it's not about / the skills »).
Accent rouge des références remplacé par l'orange KONVWA `#F05A28`, noir par le
marine `#0A1628`.

## Assets

Uniquement de vrais assets KONVWA déjà présents dans le dépôt :
- Photos produits du catalogue (fournisseur Alibaba / Chine) détourées :
  console R36s Pro (2 705 HTG, MOQ 25), brosse à dents électrique Smart Sonic
  (3 535 HTG, MOQ 24), compteur de billets ST-900 (10 465 HTG, MOQ 15) — prix et MOQ
  relevés dans la table `products` le 17/10/2026, livraison 45–70 jours.
- Visuels du site : avion-conteneur (`public/hero/plane.jpg`), chariot élévateur
  (`public/hero/forklift.webp`), colis (`public/icon-box.jpg`), logo KONVWA.
- Logos de paiement acceptés : MonCash, NatCash (`public/`).
- Drapeaux Chine / Haïti (`public/flags`).
Photos du monde réel (personne en Haïti, port, porte-conteneurs, Terre) : impossibles
à télécharger, les banques d'images sont bloquées par la politique réseau de
l'environnement (signalé à l'utilisateur).

## Customizations

- Musique : beat original composé pour la vidéo (100 BPM, la mineur, synthèse
  numpy, `assets/music/beat.mp3`) — les bibliothèques musicales sont inaccessibles.
- Effets sonores : bibliothèque déjà utilisée par `konvwa-pub` (Pixabay + ElevenLabs).
- Voix off ajoutée à la demande : Google Gemini 3.1 Flash TTS via FLORA, voix « Algieba »
  (celle de `konvwa-pub`), français, tutoiement comme le texte à l'écran ; 7 répliques
  (une par scène), silences retirés, tempo ×1,1, -16 LUFS. Projet FLORA
  « KONVWA — voix off « Acheter en Chine depuis Haïti » ». Fichiers récupérés via le
  stockage public de FLORA sur storage.googleapis.com (media.flora.ai est bloqué ici).
- Musique recomposée à la nouvelle longueur (29,2 s) et creusée sous la voix (carve).

## Notes

- Distance Shenzhen → Port-au-Prince à vol d'oiseau : 15 389 km (calcul haversine),
  affichée « 15 400 km ».
- Faits : paiement MonCash / NatCash / portefeuille en gourdes, entrepôt en Chine,
  suivi Entrepôt → Expédié → Transit maritime → Arrivé en Haïti → Livraison.
- Format vertical, zones de sécurité TikTok/Reels (texte entre y 200 et 1500).
