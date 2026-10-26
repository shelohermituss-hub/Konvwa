# « Columbus discovered America? False. » — style ANIMÉ, en anglais

Deuxième vidéo en **style ANIMÉ**, la première écrite sur le **gabarit de script** de `../_engine/style-anime/README.md`. En anglais pour le public américain, **≈ 64,8 s**. Tout est dessiné en SVG et CSS dans `index.html` ; cartes Natural Earth (domaine public).

| Étape du gabarit | Texte | Image |
|---|---|---|
| Accroche (mythe en deux affirmations) | « Columbus discovered America, and he was a hero. » | statue de bronze sur socle, rayons dorés, plaque « HERO » |
| Démenti et promesse | « That's what they want you to believe. But it's false… » | manuel scolaire « 1492 Columbus discovers America », tampon « FALSE » |
| Question d'ouverture n° 1 | « Discovered America? » | les Amériques s'allument de points dorés, « MILLIONS », « 15,000+ YEARS » |
| Preuves | Vikings à Terre-Neuve, bois daté de 1021 | drakkar sur la houle, « NEWFOUNDLAND », compteur « 1021 », « ≈ 500 YEARS BEFORE » |
| Preuves | il se croyait en Asie, « Indians » ; jamais sur le continent américain actuel | Colomb perdu, bulle « ASIA? », plaque « INDIANS » ; carte des Caraïbes, croix rouge sur la Floride « NEVER HERE », les Bahamas puis Hispaniola s'allument |
| Lien avec Haïti | la Santa María s'échoue au large d'Haïti le 25 décembre 1492 | caravelle de nuit qui penche et coule, « DEC 25, 1492 », plaque « HAITI » |
| Qui a inventé le héros | Washington Irving, 1828, « Half history, half legend » | Irving, son livre, compteur « 1828 », tampon « HALF LEGEND » |
| Question d'ouverture n° 2 | « A hero, really? » | la statue se fissure, « HERO? » |
| Accusation retournée | l'or des Taïnos, 1495, cinquante ans | un Taïno, pluie de pépites, tampon « OR ELSE » ; caravelle et chaînes « SHIPPED AS SLAVES » ; une foule qui s'efface, « 50 YEARS » |
| L'accusateur puni | 1500 : arrêté et renvoyé enchaîné | Colomb en colère, rayons rouges, « 1500 », « ARRESTED », chaînes |
| **Phrase miroir** | « Columbus didn't discover America. America discovered Columbus, and the Taíno paid the price. » | la statue bascule et tombe ; le Taïno dans la lumière dorée, « AMERICA DISCOVERED COLUMBUS » |

Comme le veut le gabarit : **pas de « Bottom line », pas de question finale**, la vidéo se termine sur la phrase miroir. L'invitation à commenter est dans la description.

## Faits (vérifiés)

- **Peuplement des Amériques** : présence humaine depuis au moins 15 000 ans (consensus prudent ; certains sites suggèrent plus).
- **Vikings** : L'Anse aux Meadows (Terre-Neuve). Du bois coupé avec des outils de métal y est daté de 1021 (Nature, 2021), soit 471 ans avant 1492, d'où « almost five hundred years ».
- **Colomb** :
  - il pensait avoir atteint l'Asie, d'où « Indians » ;
  - il n'a jamais mis le pied sur le continent des États-Unis actuels : il a débarqué aux Bahamas, à Cuba, en Hispaniola, et plus tard à Porto Rico, d'où la formule « U.S. mainland ».
- **Santa María** : échouée le 25 décembre 1492 au large de la côte nord de l'actuelle Haïti.
- **Washington Irving** : *A History of the Life and Voyages of Christopher Columbus* (1828), biographie très lue et largement romancée (c'est aussi l'origine du mythe de la « Terre plate »).
- **Les Taïnos** :
  - Colomb impose un tribut en or, et ceux qui ne l'apportent pas sont punis (récits de Las Casas) ;
  - en 1495, il envoie environ 500 captifs en Espagne ;
  - avec la guerre, le travail forcé et les épidémies, la population taïno d'Hispaniola s'effondre en une cinquantaine d'années.
- **1500** : arrêté par Francisco de Bobadilla, il est renvoyé enchaîné en Espagne.

## Production

- **Voix** :
  - FLORA / Gemini TTS « Charon » (en-US), consigne « narrateur TikTok qui démonte un mythe ». 2 prises (≈ 0,026 $) : la 1ʳᵉ est gardée, car elle lit l'accroche comme une affirmation et la 2ᵉ comme une question.
  - Temps des mots : Whisper mot à mot.
  - Pauses réduites à 0,16 s, courte respiration avant « A hero, really? » et « So no », tempo ×1,15 → 63,8 s.
- **Nombres** : dits en lettres, affichés en chiffres.
- **Musique et sons** : musique en continu, effets calés sur les mots.
- **Rendu** :
  1. `npx --yes hyperframes@0.8.168 render --fps 120 --quality looks --output renders/raw120.mp4`
  2. `python3 -I ../_engine/style-histoire/finish.py renders/raw120.mp4 renders/columbus.mp4`
  MP4 non commités.
- **Contrôle** : `hyperframes check` signale le tampon « FALSE » posé sur le texte du manuel. C'est voulu, comme le « AUCUNE PREUVE » de la référence.

## Publication (proposition)

- **Description** : « Columbus discovered America? He never even set foot on the U.S. mainland — and his ship sank off Haiti. What else did school leave out? 👇 #history #columbus #haiti #taino #mythbusting »
- **Heure** : soirée à New York (19 h–21 h).
