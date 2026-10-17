---
format: 1920x1080
duration: 46s
message: "Père Noël SA : la logistique la plus fiable du monde — livré avant le réveil"
arc: Accroche → Production → Itinéraire → Flotte → Dernier kilomètre → Preuve → Marque
audience: entreprises qui cherchent un studio de motion design (pièce de portfolio)
mode: autonomous
style: 3D isométrique dessiné en SVG (projection 30°), nuit d'hiver, accent rouge Père Noël
fonts: Archivo Black (affirmations) · IBM Plex Mono (données, suivi de colis)
palette: fond #0B1630 · texte #FFF6EC · accent #E23D3D · lumière #FFC857 · neige #F4F7FB
---

## Frame 1 — La demande

- scene: Un bloc-calendrier isométrique « 24 DÉC » se construit, la caméra recule et révèle un champ de milliers de cadeaux ; compteur 2 000 000 000 ; « EN UNE SEULE NUIT. »
- duration: 6.6s
- transition_in: cut
- status: outline
- voiceover: "Le 24 décembre, plus de deux milliards de cadeaux doivent être livrés. En une seule nuit."
- src: compositions/s1-demande.html
- blueprint: zoom-out-workspace-reveal
- rules: spring-pop-entrance, viewport-change, counting-dynamic-scale, kinetic-beat-slam

## Frame 2 — Production au Pôle Nord

- scene: Île isométrique flottante : usine rouge, tapis roulant, lutins ; trois postes FABRICATION / EMBALLAGE / CONTRÔLE QUALITÉ s'allument au rythme de la voix ; caméra qui suit un cadeau puis plan large
- duration: 7.3s
- transition_in: diamond-wipe
- status: outline
- voiceover: "Au Pôle Nord, nos ateliers tournent à plein régime : fabrication, emballage, contrôle qualité."
- src: compositions/s2-production.html
- blueprint: spatial-pan-stations
- rules: multi-phase-camera, svg-icon-enrichment, spring-pop-entrance, sine-wave-loop

## Frame 3 — Itinéraire

- scene: Carte du monde posée en isométrique, bandes de fuseaux horaires, terminateur jour/nuit qui balaie, itinéraire qui se trace de ville en ville, panneau de données
- duration: 5.5s
- transition_in: diamond-wipe
- status: outline
- voiceover: "Notre algorithme calcule l'itinéraire parfait, à travers tous les fuseaux horaires."
- src: compositions/s3-itineraire.html
- blueprint: dataviz-countup
- rules: svg-path-draw, spring-pop-entrance, counting-dynamic-scale

## Frame 4 — La flotte

- scene: Le traîneau et ses rennes survolent une ville isométrique enneigée, caméra en suivi, traînée dorée, cadeaux largués dans les cheminées ; « ZÉRO ÉMISSION » / « PROPULSION 100 % RENNE »
- duration: 6.8s
- transition_in: diamond-wipe
- status: outline
- voiceover: "Puis la flotte décolle. Zéro émission : propulsion cent pour cent renne."
- src: compositions/s4-flotte.html
- blueprint: camera-journey
- rules: viewport-change, motion-blur-streak, kinetic-beat-slam, particle-burst

## Frame 5 — Dernier kilomètre

- scene: Maison en coupe isométrique ; le cadeau tombe dans la cheminée, descend le conduit, sort du foyer et atterrit sous le sapin ; étapes 01/02/03 et notification « Colis livré »
- duration: 10s
- transition_in: diamond-wipe
- status: outline
- voiceover: "Pour le dernier kilomètre, notre exclusivité : la livraison par cheminée. Discrète, rapide, directement sous le sapin."
- src: compositions/s5-cheminee.html
- blueprint: camera-journey
- rules: coordinate-target-zoom, multi-phase-camera, svg-path-draw, particle-burst, spring-pop-entrance

## Frame 6 — Performance

- scene: Socle isométrique, barres 3D qui montent, jauge circulaire 99,9 %, chiffres secondaires 0 g CO₂ / 1 nuit
- duration: 5s
- transition_in: diamond-wipe
- status: outline
- voiceover: "Quatre-vingt-dix-neuf virgule neuf pour cent des colis livrés à l'heure."
- src: compositions/s6-chiffres.html
- blueprint: dataviz-countup
- rules: counting-dynamic-scale, stat-bars-and-fills, spring-pop-entrance

## Frame 7 — Marque

- scene: Le paquet isométrique s'ouvre, l'emblème s'assemble, « PÈRE NOËL SA » et « Livré avant le réveil. » ; l'aube commence à poindre
- duration: 4.8s
- transition_in: diamond-wipe
- status: outline
- voiceover: "Père Noël SA. Livré avant le réveil."
- src: compositions/s7-marque.html
- blueprint: logo-assemble-lockup
- rules: spring-pop-entrance, waterfall-entry, ambient-glow-bloom
