# « Les femmes n'ont jamais fait la guerre ? Faux. » — style ANIMÉ, en français

Vidéo en **style ANIMÉ** écrite sur le gabarit de `../_engine/style-anime/README.md`, **≈ 55,6 s**, voix **Gabriel Dubois**. Tout est dessiné en SVG et CSS dans `index.html` : un décor illustré par scène, les personnages en médaillons, et un bruitage sur chaque dessin. Cartes Natural Earth (domaine public).

| Étape du gabarit | Texte | Image et son |
|---|---|---|
| Accroche (mythe en deux affirmations) | « Les femmes n'ont jamais fait la guerre. La guerre, c'est une affaire d'hommes. » | colonne de soldats au coucher du soleil, tambour ; affiche « ON RECRUTE · HOMMES SEULEMENT », boom |
| Démenti et promesse | « Ça, c'est ce qu'on veut te faire croire… » | livre « HISTOIRE MILITAIRE » avec seulement des généraux, tampon « FAUX » |
| Question d'ouverture n° 1 | « Jamais fait la guerre ? » | carte de l'Afrique, le Bénin s'allume (ping), le roi du Dahomey en médaillon |
| Preuves | les Agojie, des milliers de soldates, les haies d'épines, 1890 | rangs de soldates (tambour), « AGOJIE », « DES MILLIERS » ; une Agojie franchit une haie d'épines ; en 1890, face à la ligne française et au drapeau, salve et fumée |
| Question d'ouverture n° 2 | « Une affaire d'hommes ? » | carte d'Hispaniola, Haïti s'allume, « MARS 1802 », le fort et le ping sur la Crête-à-Pierrot |
| Preuves | 1 200 défenseurs encerclés ; Marie-Jeanne Lamartinière | vue du ciel : le fort étoilé et ses 1 200 points dorés, encerclés de points bleus ; Marie-Jeanne sur le rempart, icônes fusil, poudre, tir, soins, boulets qui tombent |
| | la sortie de nuit | calendrier qui défile jusqu'à 20, puis de nuit, flèche dorée à travers le camp français, course |
| Preuves | Sanité Bélair | médaillon, épaulette, « LIEUTENANTE », Toussaint Louverture ; barreaux, « 1802 », « CONDAMNÉE », « COMME UN SOLDAT » ; le bandeau qui tombe ; le billet de 10 gourdes |
| Grand retournement | « Pourquoi tu n'as jamais appris leurs noms à l'école ? » | tableau noir : leurs noms écrits à la craie puis effacés ; le livre d'histoire n'a que des hommes |
| **Phrase miroir** | « Les femmes n'étaient pas absentes de la guerre. Elles ont été absentes des livres. » | trois cadres dorés, « PAS ABSENTES DE LA GUERRE », leurs noms s'écrivent dans le livre, « ABSENTES DES LIVRES » |

Pas de bilan ni de question finale : l'invitation à commenter est dans la description.

## Faits (vérifiés, formulés avec prudence)

- **Agojie (Dahomey, actuel Bénin)** :
  - régiments de femmes de l'armée du royaume ;
  - selon des visiteurs du XIXᵉ siècle, de 1 000 à 6 000 soldates (environ 6 000 au plus fort, dans les années 1840), d'où « jusqu'à plusieurs milliers » ;
  - les récits d'entraînement à travers des haies d'épines d'acacia viennent de témoins européens, d'où « on raconte » ;
  - elles combattent l'armée française pendant la guerre de 1890 (bataille de Cotonou).
  Sources : [Smithsonian](https://www.smithsonianmag.com/history/the-true-history-of-the-woman-king-dahomey-180980750/), [National Geographic](https://www.nationalgeographic.com/history/article/the-true-story-of-the-women-warriors-of-dahomey).
- **Crête-à-Pierrot (4–24 mars 1802)** :
  - environ 1 200 défenseurs ;
  - les chiffres du côté français varient selon les sources (de 2 000 pour l'avant-garde à 15 000), d'où « des milliers » ;
  - la garnison abandonne le fort et perce les lignes dans la nuit du 24 mars.
  Sources : [Battle of Crête-à-Pierrot](https://en.wikipedia.org/wiki/Battle_of_Cr%C3%AAte-%C3%A0-Pierrot), [iciHaïti](https://www.icihaiti.com/en/news-33362-icihaiti-history-the-20-days-of-the-siege-of-fort-de-la-crete-in-pierrot.html).
- **Marie-Jeanne Lamartinière** : combattante et infirmière à la Crête-à-Pierrot, aux côtés de son mari Louis Daure Lamartinière. [Wikipédia](https://en.wikipedia.org/wiki/Marie-Jeanne_Lamartini%C3%A8re)
- **Sanité Bélair** :
  - lieutenante dans l'armée de Toussaint Louverture ;
  - capturée en 1802, la commission militaire condamne son mari à être fusillé et elle à être décapitée ;
  - elle exige d'être fusillée comme un soldat et, selon les récits, refuse le bandeau ;
  - les sources ne s'accordent pas sur la façon dont elle a été exécutée (5 octobre 1802) : la vidéo ne le précise donc pas ;
  - son portrait figure sur le billet de 10 gourdes de la série commémorative du bicentenaire (2004).
  Sources : [Fondation pour la mémoire de l'esclavage](https://memoire-esclavage.org/tcpdf/747), [banknotes.com](https://www.banknotes.com/ht272.htm).

## Production

- **Voix** : Magnific / ElevenLabs « Gabriel Dubois » (`voiceId` 480, `eleven_v4`), consigne `[energetic, punchy, fast delivery]`, « FAUX » en majuscules, « Agojie » écrit « Agodji » pour la prononciation. 2 prises (286 crédits chacune) :
  - la 2ᵉ prise est gardée, plus expressive (stabilité 0,35) ;
  - le mot « Lieutenante » vient de la 1ʳᵉ prise, car la 2ᵉ disait « lieutenant ». Le raccord est vérifié avec Whisper ;
  - temps des mots : Whisper mot à mot ;
  - pauses réduites à 0,16 s, respirations avant les questions et avant la phrase miroir, tempo ×1,08 → 54,5 s, soit 232 mots/min.
- **Sons** : banque `../_engine/style-anime/sfx/`. Pour cette vidéo, 8 sons y ont été ajoutés : `tambour`, `mousquet`, `salve`, `boulet`, `epines`, `course-nuit`, `pages`, `craie`. Il y a des booms de cinéma sur l'accroche, « FAUX », les questions, « encerclés », « CONDAMNÉE », « refuse » et la phrase miroir.
- **Rendu** :
  1. `npx --yes hyperframes@0.8.168 render --fps 120 --quality looks --output renders/raw120.mp4`
  2. `python3 -I ../_engine/style-histoire/finish.py renders/raw120.mp4 renders/femmes-guerre.mp4`
  MP4 non commités.

## Publication (proposition)

- **Description** : « "Les femmes n'ont jamais fait la guerre" ? Les Agojie du Dahomey, Marie-Jeanne Lamartinière à la Crête-à-Pierrot, Sanité Bélair qui refuse le bandeau… Tu connaissais laquelle ? 👇 #histoire #haiti #femmes #agojie #lesaviezvous »
- **Heure** : soirée à Paris (19 h–21 h).
