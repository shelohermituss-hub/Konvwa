# « Comment un ascenseur ne tombe jamais » — style 3D, en français

Deuxième vidéo en **style 3D** (guide `../_engine/style-3d/README.md`). Elle dure **≈ 86,6 s**, avec la voix d'**Adrien Moreau**. Tout est en vraie 3D Three.js dans `index.html`, piloté par HyperFrames (événement `hf-seek`), en un seul plan. Le monde contient deux décors :
- une **gaine d'ascenseur en coupe** : rails, paliers, fosse, machinerie en haut ;
- la **scène de New York en 1854**, juste à côté de l'immeuble.

**Demande du client** : commencer par une scène où l'ascenseur tombe, puis expliquer pourquoi ça ne peut presque pas arriver. On retrouve cette chute à la fin, mais cette fois la cabine s'arrête.

| Étape | Texte | Image |
|---|---|---|
| Accroche : la chute | « Le câble casse. La cabine tombe de 20 étages. […] Pourquoi ? » | gros plan sur la cabine en haut, les câbles cassent (flash rouge), la cabine tombe dans la gaine, compteur « ÉTAGE 20 → 0 » ; puis retour en arrière, « POURQUOI ? », tout se défait |
| « Tu le construis toi-même » | une caisse, une corde, tu tires | une caisse, une poulie, une corde avec sa poignée, la caisse monte |
| Mais… / Alors… | c'est lourd → un poids de l'autre côté | « TROP LOURD », la caisse redescend ; le contrepoids apparaît → **CONTREPOIDS** |
| Moteur | un petit moteur fait tourner la poulie | le moteur à côté de la poulie, la caisse monte jusqu'au milieu de la gaine |
| Câbles d'acier | une corde, ça casse → plusieurs câbles, chacun pourrait tout porter | « ÇA S'USE… », la corde rougit ; 4 câbles d'acier → **CÂBLES D'ACIER** ; la caisse devient la cabine |
| Frein | courant coupé → le frein serre tout seul | voyant rouge, les mâchoires du frein se referment sur le tambour → **FREIN** |
| Le pire des cas | tous les câbles cassent | les câbles cassent, la cabine reste suspendue, on part dans le passé |
| Otis, 1854 | New York, la corde coupée à la hache, la plateforme tombe de quelques centimètres et s'arrête | poteaux crantés, plateforme, Otis en haut-de-forme, la foule ; la hache coupe la corde, le ressort se détend, les crochets se plantent dans les crans ; il lève son chapeau |
| Parachute | un 2ᵉ câble surveille la vitesse ; trop vite → des mâchoires agrippent les rails | le limiteur de vitesse et sa boucle de câble orange ; la cabine accélère, les mâchoires serrent, étincelles → **PARACHUTE** |
| Amortisseurs | au fond de la fosse | deux ressorts dans la fosse → **AMORTISSEURS** |
| Retour à la chute | « Alors, le câble casse ? La cabine glisse de quelques centimètres, et s'arrête. » | le câble casse (flash), étincelles, « ≈ 4 CM », la cabine s'arrête |
| Fin en boucle | « Regarde-toi : tu viens de construire un ascenseur. » | vue large de la gaine, la cabine remonte → **UN ASCENSEUR** |

## Faits (vérifiés, formulés avec prudence)

- **Otis** :
  - démonstration en mai 1854 au Crystal Palace de New York ;
  - la corde est coupée (à la hache selon l'entreprise Otis) ;
  - un ressort à lames libère des cliquets qui s'accrochent dans des crans le long des rails.

  La phrase « Tout va bien, messieurs » (« All safe, gentlemen ») est rapportée sans source de première main, d'où le « aurait-il dit ». [Britannica](https://www.britannica.com/topic/Elisha-Otis), [ASME](https://www.asme.org/topics-resources/content/Elisha-Graves-Otis)
- **Ascenseur moderne** (normes EN 81) :
  - **câbles** : au moins deux câbles indépendants, avec un coefficient de sécurité d'au moins 12 ; un seul câble suffirait à retenir la cabine pleine ;
  - **frein** : un frein électromécanique qui serre tout seul quand le courant est coupé ;
  - **parachute** : déclenché par un limiteur de vitesse qui a son propre câble ;
  - **fosse** : des amortisseurs au fond.

  [NF EN 81-1 (AFNOR)](https://www.boutique.afnor.org/en-gb/standard/nf-en-811/lifts-and-service-lifts-safety-rules-for-the-construction-and-installation-/fa000148/16108), [RGPT art. 270](https://employment.belgium.be/sites/default/files/content/documents/Bien-%C3%AAtre%20au%20travail/R%C3%A9glementation/art270_RGPT.pdf)
- **« Quelques centimètres »** : la distance d'arrêt réelle dépend de la vitesse et du type de parachute. Le « ≈ 4 CM » à l'écran est une illustration, et la voix dit « quelques centimètres ».
- **« Pratiquement jamais »** : les chutes libres dues à un câble rompu sont rarissimes. La plupart des accidents d'ascenseur viennent des portes ou de la maintenance.

## Production

- **Voix** : Magnific / ElevenLabs « Adrien Moreau » (`voiceId` 230, `eleven_v4`, stabilité 0,4, 332 crédits), consigne `[calm, clear, confident documentary narration]`.
  - Une seule prise.
  - Temps des mots avec Whisper ; pauses à 0,2 s ; tempo ×1,0 → 85,5 s, 270 mots, soit environ 190 mots/min.
- **Sons** :
  - banque `../_engine/style-3d/sfx/`, avec 6 sons ajoutés (55 crédits) : `cable-casse`, `chute`, `ding-ascenseur`, `moteur-elec`, `freinage`, `hache` ;
  - plus `whoosh`, `scintille`, `ding`, `riser`, `boom-cine`, `frottement`, `foule` du style ANIMÉ ;
  - 48 bruitages ;
  - musique `musique-tech` ;
  - mixage `mix_anime.py` (musique 16 dB sous la voix) : voix 19,5 dB au-dessus du fond pendant la parole (médiane).
- **Rendu** :
  1. `npx --yes hyperframes@0.8.168 render --fps 120 --quality looks --output renders/raw120.mp4`
  2. `python3 -I ../_engine/style-histoire/finish.py renders/raw120.mp4 renders/ascenseur.mp4`

  MP4 non commités.

## Publication (proposition)

- **Description** : « Le câble casse… et pourtant tu ne tomberais pas. Tu connaissais l'astuce d'Otis ? 👇 #science #ascenseur #commentcamarche #lesaviezvous »
