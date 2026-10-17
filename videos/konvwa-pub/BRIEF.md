---
workflow: general-video
flow: automation
storyboard: no
message: "KONVWA fait venir vos achats de Chine et des États-Unis jusqu'en Haïti — Achetez, nous livrons."
destination: tiktok-reels-shorts
aspect: 1080x1920
language: fr
length: 15-30s
angle: publicité explicative (démo de l'app), arc « Demo Loop »
voice: Algieba
---

## Intent

Publicité en motion design qui explique ce qu'est KONVWA, comment l'app
fonctionne, à quoi elle sert et à qui elle s'adresse (particuliers,
revendeurs, entrepreneurs). On voit ce qui se passe dans l'app : acheter à
l'unité (boutique USA), acheter en gros (sourcing Chine, ex. cosmétiques),
demander une expédition depuis son propre fournisseur (adresse des
entrepôts), payer (MonCash, NatCash, portefeuille) et suivre chaque étape
jusqu'en Haïti. Les captures App Store fournies servent de référence
visuelle (UI claire, cartes blanches, orange KONVWA, Poppins), pas de modèle
à recopier. Thème clair sur toute la vidéo (fond crème `#F7F1EB`, texte marine
`#0A1628`, accents orange), à la demande du client.

## Assets

- Captures App Store (référence UI uniquement, non intégrées à la vidéo).
- `assets/products/` : vraies photos de produits du catalogue KONVWA (table
  `products`, bucket public `product-images`, relevé du 17/10/2026), recadrées en
  carré 600 px. Prix affichés = `price_htg` du catalogue à cette date (palier
  100 u. pour la brosse à dents).

## Customizations

- Voix off française Gemini 3.1 Flash TTS via FLORA, voix « Algieba » (demande explicite, voix par défaut).
- Effets sonores : bibliothèque HyperFrames (Pixabay) + sons sur mesure ElevenLabs via FLORA (pièces, corne de bateau, avion, scooter, carton).

## Notes

- Faits tirés du code de l'app : boutique USA par unité, sourcing gros Chine avec MOQ, espace revendeur, adresses d'entrepôts (Shenzhen/Foshan, Orlando), devis d'expédition sous 24 h sans paiement préalable, paiement portefeuille/MonCash/NatCash, suivi Payé → Entrepôt → Expédié → Transit maritime → Arrivé en Haïti → Livraison.
- Interface recréée en HTML (pas de captures d'écran) ; produits = photos réelles du catalogue (les marques visibles sur les produits sont celles vendues sur la plateforme) ; prénom fictif.
- Format vertical, zones de sécurité TikTok/Reels respectées.
