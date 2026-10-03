# E-mails d'authentification (Supabase)

Ces e-mails sont envoyés par Supabase Auth et se règlent dans le tableau de bord :
**Authentication → Email Templates** (puis **SMTP Settings** pour envoyer depuis votre domaine).

Les modèles `confirm-signup.html` et `reset-password.html` sont bilingues (français / English), car Supabase n'envoie qu'un seul modèle par type d'e-mail. Collez le contenu dans le champ « Message body » et mettez le sujet suggéré.

| Modèle | Sujet suggéré |
|---|---|
| Confirm signup | `Confirmez votre compte KONVWA / Confirm your KONVWA account` |
| Reset password | `Réinitialisez votre mot de passe KONVWA / Reset your KONVWA password` |

## E-mails transactionnels (reçus, colis arrivé…)

Ils demandent un fournisseur d'envoi (Resend, Postmark, Brevo…) et sa clé API : à créer côté fournisseur, puis à stocker comme secret d'une Edge Function (jamais dans `src/`). Les notifications dans l'app et les push couvrent déjà ces événements.
