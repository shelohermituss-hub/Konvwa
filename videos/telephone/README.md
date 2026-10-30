# « Comment un téléphone passe un appel » — style 3D, en français

Première vidéo en **style 3D** (guide `../_engine/style-3d/README.md`), **≈ 81,6 s**, voix **Adrien Moreau**. Tout est en vraie 3D Three.js dans `index.html`, piloté par HyperFrames (événement `hf-seek`, aucune horloge). Il n'y a qu'un plan : la caméra tourne, plonge dans le téléphone et ressort. Le décor se construit pièce par pièce au moment où la voix la nomme. Par-dessus, l'habillage HTML (étiquettes mono projetées depuis la 3D, titres soulignés de cyan, compteurs, sous-titres avec le mot-clé en cyan) est animé en GSAP.

| Étape | Texte | Image |
|---|---|---|
| Accroche | « Si tu relies deux pots de yaourt avec un fil tendu, bravo : tu as construit un téléphone. » | deux pots, le fil tendu, l'hélipad cyan |
| « Mais… » | l'ami habite au Cap-Haïtien, à plus de 100 km | le pot s'éloigne au loin, « CAP-HAÏTIEN · 100 KM », le fil casse |
| Micro | la voix fait vibrer l'air, une membrane la change en courant | le téléphone apparaît, la coque devient transparente, ondes sonores, la membrane vibre, signal électrique → **MICRO** |
| Codec | le courant s'abîme ; une puce le mesure 8 000 fois par seconde, en nombres, puis les compresse | signal brouillé, la carte et la puce se posent, échantillons, compteur 0 → 8 000, cubes de données qui se tassent → **CODEC** |
| Antenne | ondes radio à la vitesse de la lumière | l'antenne cuivre s'allume, anneaux radio, « 300 000 KM PAR SECONDE » → **ANTENNE** |
| « Le vrai problème : » | l'antenne est petite et peu puissante | cercle rouge « PORTÉE LIMITÉE » |
| Antenne-relais | un pylône attrape les ondes | le pylône monte, ses panneaux s'allument → **ANTENNE-RELAIS** |
| Carte SIM | le téléphone de l'ami se signale à l'antenne la plus proche | vue large : cellules en nid d'abeilles, 2ᵉ pylône, pings dorés ; plongée dans le téléphone, la SIM se lève et brille → **CARTE SIM** |
| Fibre, central | fibre optique, flashs de lumière, sous la mer ; le central lit le numéro | câble lumineux qui passe sous la mer, bâtiment « CENTRAL », « N° APPELÉ ✓ », le téléphone sonne |
| À l'envers | ondes → nombres → courant → haut-parleur | signal dans le téléphone de l'ami, le haut-parleur vibre |
| Chiffre-choc | moins de 0,15 seconde | la lumière parcourt tout le trajet, compteur « 0,15 s » |
| Fin en boucle | « Regarde-toi : tu viens de construire un téléphone. Et tout un réseau. » | le réseau entier, « TOI » et « TON AMI » → **UN RÉSEAU** |

## Faits (vérifiés, formulés avec prudence)

- **Micro** : une membrane suit les vibrations de l'air et les convertit en signal électrique.
- **Échantillonnage** : la téléphonie « bande étroite » mesure la voix 8 000 fois par seconde (8 kHz, norme UIT-T G.711) ; les mobiles utilisent au moins cette fréquence. La vidéo dit « au moins 8 000 fois par seconde ».
- **Codec** : il code et compresse la voix (AMR, EVS…) pour qu'elle prenne moins de place.
- **Ondes radio** : ce sont des ondes électromagnétiques, qui voyagent à la vitesse de la lumière (≈ 300 000 km/s).
- **Antenne-relais** : un téléphone n'a qu'une faible puissance d'émission ; le réseau est découpé en cellules, chacune servie par une station de base. Le téléphone signale régulièrement sa position (mise à jour de localisation), ce qui permet au réseau de le trouver.
- **Carte SIM** : elle contient l'identité de l'abonné (IMSI) et ses clés d'authentification.
- **Fibre optique** : entre les antennes et les centraux, la voix voyage en impulsions de lumière, y compris dans des câbles sous-marins.
- **Délai** : la recommandation UIT-T G.114 conseille moins de 150 ms de délai de bout en bout, dans un sens, pour une conversation confortable.

## Production

- **Voix** : Magnific / ElevenLabs « Adrien Moreau » (`voiceId` 230, `eleven_v4`), consigne `[calm, clear, confident documentary narration]`. 2 prises ; la 2ᵉ (stabilité 0,4) est gardée. Temps des mots avec Whisper, pauses à 0,2 s, tempo ×1,0 → 80,5 s, 277 mots, soit ≈ 206 mots/min.
- **Sons** : la banque `../_engine/style-3d/sfx/` (`ui-blip`, `clip`, `onde-radio`, `donnees`, `sonnerie`, `fibre`, `bourdonnement`, boucle `musique-tech`), plus `whoosh`, `scintille`, `ding`, `riser`, `tampon`, `compteur` et `boom-cine` repris du style ANIMÉ. 68 bruitages. Mixage `../_engine/style-anime/mix_anime.py` (musique 16 dB sous la voix) : voix 19,7 dB au-dessus du fond pendant la parole (médiane).
- **3D** : Three.js 0.181.2 (géométries simples, `Line2` pour les traits épais, brouillard). Les vues larges suivent l'axe du trajet de l'appel, avec un champ plus large, pour que tout le réseau tienne dans le cadre vertical.
- **Rendu** :
  1. `npx --yes hyperframes@0.8.168 render --fps 120 --quality looks --output renders/raw120.mp4`
  2. `python3 -I ../_engine/style-histoire/finish.py renders/raw120.mp4 renders/telephone.mp4`

  Les MP4 ne sont pas commités.

## Publication (proposition)

- **Description** : « Tu appelles ton ami au Cap… et ta voix arrive en moins de 0,15 seconde. Voilà tout ce que tu viens de construire. Tu savais que ta voix passait sous la mer ? 👇 #science #téléphone #technologie #lesaviezvous »
