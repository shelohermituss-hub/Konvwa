# « La Joconde, le plus beau tableau du monde ? Faux. » — style ANIMÉ, en français

Vidéo en **style ANIMÉ** écrite sur le gabarit de `../_engine/style-anime/README.md`, **≈ 73,7 s**, voix **Gabriel Dubois**. Tout est dessiné en SVG et CSS dans `index.html`, y compris la Joconde stylisée. Il y a un décor illustré par scène, les personnages en médaillons et un bruitage sur chaque dessin. Le son est mixé sous la voix par `../_engine/style-anime/mix_anime.py`.

| Étape du gabarit | Texte | Image et son |
|---|---|---|
| Accroche (mythe en deux affirmations) | « La Joconde, c'est le plus beau tableau du monde. C'est pour ça que tout le monde la connaît. » | galerie du Louvre, la Joconde sous un projecteur ; une foule de téléphones levés, écrans qui flashent |
| Démenti et promesse | « Ça, c'est ce qu'on veut te faire croire… » | « GUIDE DU MUSÉE · LE PLUS BEAU TABLEAU DU MONDE », tampon « FAUX » |
| Question d'ouverture n° 1 | « Tout le monde la connaît ? » | galerie de 1911 couverte de grands tableaux, la petite Joconde au milieu, mètre « 77 CM », deux spécialistes en médaillons ; des visiteurs en chapeau passent sans s'arrêter |
| Question d'ouverture n° 2 | « Le plus beau tableau du monde ? » | une main d'ombre s'approche, tampon « C'EST UN VOL » |
| Le vol | lundi 21 août 1911, Vincenzo Peruggia | calendrier, façade du Louvre, la grille descend, « FERMÉ » ; Peruggia en médaillon, l'homme en blouse blanche décroche le tableau, le cache et sort par la porte ; le lendemain, les quatre crochets |
| Preuves en rafale | l'explosion | rotative, journaux du monde entier (« LA JOCONDE VOLÉE ! », « MONA LISA STOLEN »…), « LOUVRE FERMÉ 1 SEMAINE » ; la queue devant le mur vide ; « POLICE », Apollinaire « ARRÊTÉ », Picasso « INTERROGÉ », « HORS DE CAUSE » ; pluie de cartes postales, notes de musique, « PARTOUT », « SAUF AU LOUVRE » |
| Et pendant ce temps-là… | la malle à double fond | mansarde à Paris (tour Eiffel à la fenêtre), la malle s'ouvre, le double fond glisse, le tableau brille |
| Le dénouement | Florence, décembre 1913 | « DÉC. 1913 », Florence, le train ; le marchand, le directeur des Offices, le téléphone sonne, « POLICE ! » |
| Grand retournement | elle revient en star ; des millions de visiteurs | tapis rouge, cordons, flashes, « UNE STAR » ; aujourd'hui la vitrine et une mer de téléphones, « DES MILLIONS PAR AN » |
| **Phrase miroir** | « Elle n'est pas célèbre parce qu'elle est belle. Elle est célèbre parce qu'on l'a volée. » | la Joconde dans la lumière dorée, puis elle disparaît et il ne reste que les crochets |

Pas de bilan ni de question finale : l'invitation à commenter est dans la description.

## Faits (vérifiés, formulés avec prudence)

- **Le vol** :
  - lundi 21 août 1911, jour de fermeture du Louvre ;
  - Vincenzo Peruggia, vitrier italien qui avait travaillé au musée, porte une blouse blanche d'employé et sort le tableau ;
  - les sources ne s'accordent pas sur le fait qu'il se soit caché la veille : la vidéo ne le dit donc pas.
  [Wikipédia](https://en.wikipedia.org/wiki/Vincenzo_Peruggia), [History.com](https://www.history.com/articles/the-heist-that-made-the-mona-lisa-famous)
- **Après le vol** :
  - le Louvre ferme une semaine ;
  - à la réouverture, des visiteurs font la queue pour regarder l'emplacement vide.
  [History Hit](https://www.historyhit.com/culture/theft-mona-lisa/)
- **Apollinaire** : arrêté le 7 septembre 1911 à cause des statuettes volées au Louvre par Géry Pieret. **Picasso** est interrogé. Tous deux sont mis hors de cause. [TheCollector](https://www.thecollector.com/did-guillaume-apollinaire-steal-the-mona-lisa/)
- **La cachette** : Peruggia garde le tableau environ deux ans dans une malle en bois à double fond, chez lui à Paris.
- **Florence, décembre 1913** : il propose le tableau au marchand Alfredo Geri, qui prévient Giovanni Poggi, directeur des Offices, et la police. [Wikipédia](https://en.wikipedia.org/wiki/Vincenzo_Peruggia)
- **Avant 1911** : pour de nombreux historiens, la Joconde était admirée des connaisseurs, mais ce sont le vol et sa médiatisation (journaux, cartes postales, chansons) qui en ont fait l'icône mondiale. Le tableau mesure 77 × 53 cm.

## Production

- **Voix** : Magnific / ElevenLabs « Gabriel Dubois » (`voiceId` 480, `eleven_v4`), consigne `[energetic, punchy, fast delivery]`, « Vincenzo Peruggia » écrit « Vinntchènnzo Pérroudja » pour la prononciation. 2 prises (356 crédits chacune) :
  - la 2ᵉ (stabilité 0,4) est gardée ;
  - temps des mots : Whisper mot à mot ;
  - pauses à 0,16 s, respirations avant les questions, « Et là, c'est l'explosion », « Et pendant ce temps-là » et la phrase miroir, tempo ×1,08 → 72,6 s, soit 240 mots/min.
- **Sons** : banque `../_engine/style-anime/sfx/`. 8 sons y ont été ajoutés : `foule`, `rotative`, `sifflet`, `porte`, `pas-musee`, `flash`, `train`, `malle`. Mixage `mix_anime.py` : voix 18,4 dB au-dessus du fond pendant la parole (médiane) ; les gros sons tombent dans les silences.
- **Rendu** :
  1. `npx --yes hyperframes@0.8.168 render --fps 120 --quality looks --output renders/raw120.mp4`
  2. `python3 -I ../_engine/style-histoire/finish.py renders/raw120.mp4 renders/joconde.mp4`
  MP4 non commités.

## Publication (proposition)

- **Description** : « La Joconde, le plus beau tableau du monde ? En 1911, presque personne ne s'arrêtait devant elle… jusqu'à ce qu'un vitrier la vole. Tu connaissais cette histoire ? 👇 #histoire #joconde #louvre #art #lesaviezvous »
- **Heure** : soirée à Paris (19 h–21 h).
