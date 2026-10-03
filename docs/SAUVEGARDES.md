# Sauvegardes et reprise — KONVWA

La base Supabase contient l'argent des clients (soldes, transactions) : c'est la donnée à protéger en priorité.

## À activer (tableau de bord Supabase)

1. **Database → Backups** : vérifier que les sauvegardes quotidiennes sont actives.
2. **Point-in-Time Recovery (PITR)** : à activer (add-on payant, plan Pro). Il permet de revenir à la seconde près avant une erreur.
3. **Storage** : les buckets `payment-proofs` et `kyc-documents` ne sont pas inclus dans les sauvegardes de la base. Exporter régulièrement leur contenu (Storage → télécharger, ou script avec la clé service, hors dépôt).

## Exercice de restauration (à faire une fois, puis chaque trimestre)

1. Créer un projet Supabase de test (ou une branche).
2. Restaurer la dernière sauvegarde dans ce projet.
3. Vérifier : nombre de lignes de `wallets` et `wallet_transactions`, puis l'écran admin **Rapprochement** (les soldes doivent correspondre aux transactions).
4. Supprimer le projet de test.

## En cas d'incident

- Passer `staff_mfa_required`/paiements en maintenance : désactiver les Edge Functions `payment-*` depuis le tableau de bord.
- Ne jamais corriger un solde à la main sans passer par une transaction `refund`/`deposit` tracée.
- Vérifier le **Journal d'audit** pour retrouver l'auteur et l'heure de chaque changement.
