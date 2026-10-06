# KONVWA — Project Instructions

## Project

KONVWA est une application d'importation haïtienne (React + TypeScript + Vite + shadcn/ui + Tailwind CSS v4 + Supabase). Elle permet aux utilisateurs d'importer des produits depuis Alibaba, Shein et Temu, et de payer via MonCash/NatCash.

## Règle absolue — Skills obligatoires

**Pour TOUTE requête**, consulte et applique les skills installés ci-dessous avant de générer du code ou de prendre une décision. Ce ne sont pas des options : ce sont les standards de qualité du projet.

### Mapping des skills par contexte

| Contexte | Skill à utiliser |
|---|---|
| Composants shadcn/ui, registry, CLI, composition | `/shadcn` |
| Décisions UI/UX, layouts, couleurs, typographie, styles | `/ui-ux-pro-max` |
| Animations, transitions, micro-interactions, polish | `/emil-design-eng` |
| Theming Tailwind, variables CSS, dark mode, accessibilité | `/ui-styling` |
| Design général, logos, identité visuelle, mockups | `/design` |
| Design tokens, composants systématisés, architecture | `/design-system` |
| Revue ou écriture de code d'animation | `/review-animations` |
| Contenu de marque, ton, messaging | `/brand` |
| Présentations, slides HTML | `/slides` |
| Bannières publicitaires ou héros visuels | `/banner-design` |

### Comportement attendu

- **Avant d'écrire du code UI** → applique `/ui-ux-pro-max` + `/shadcn`
- **Avant d'écrire une animation** → applique `/emil-design-eng`, puis `/review-animations` sur le résultat
- **Avant de choisir des couleurs ou polices** → applique `/ui-ux-pro-max` + `/ui-styling`
- **Pour tout nouveau composant** → applique `/shadcn` + `/design-system`
- **Pour tout travail de polish final** → applique `/emil-design-eng`

## Skills de workflow (ponytail, graphify, agent-skills)

Installés au niveau projet dans `.claude/skills/` (versionnés, donc disponibles dans chaque session). Les checklists partagées sont dans `.claude/references/`, les personas (code-reviewer, security-auditor, test-engineer, web-performance-auditor) dans `.claude/agents/`.

### graphify — carte du code (à consulter AVANT de grepper)

- `graphify-out/GRAPH_REPORT.md` (versionné) résume les modules, « god nodes » et communautés du code : le lire pour se repérer dans une zone inconnue avant de lancer des recherches en vrac.
- Questions de structure : `graphify query "<question>"`, `graphify path "A" "B"`, `graphify explain "<symbole>"` (si le CLI est installé).
- Après un gros changement de structure (nouveaux modules, refactor) : `graphify update .` (AST uniquement, sans LLM, sans coût) puis committer `GRAPH_REPORT.md`. `cache/`, `graph.json`, `graph.html` sont ignorés par git et se régénèrent.
- Installation du CLI (poste local) : `uv tool install "graphifyy[sql]"` ou `pip install "graphifyy[sql]"` (l'extra `sql` indexe aussi les migrations). Skill : `/graphify`.

### ponytail — anti sur-ingénierie (logique, backend, scripts)

- Principe : la solution la plus simple qui marche (YAGNI, stdlib/plateforme avant dépendance, une ligne avant cinquante). Skill `/ponytail` (niveaux lite / full / ultra).
- Avant de livrer un diff non trivial (hors UI) : `/ponytail-review` ; de temps en temps sur un dossier : `/ponytail-audit` ; dette : `/ponytail-debt` ; aide : `/ponytail-help`.
- **Limites** : ponytail ne prime jamais sur la sécurité (RLS, RPC `SECURITY DEFINER`, contraintes SQL, validation serveur), ni sur les règles UI/UX ci-dessus (états de chargement, accessibilité, polish demandé). Il s'applique à la logique, pas à l'obligation de simplifier une interface voulue riche.

### agent-skills (addyosmani) — cycle d'ingénierie

Pour une tâche non triviale, suivre le cycle et charger le skill de la phase :

| Phase | Skill |
|---|---|
| Idée floue / besoin à cadrer | `/idea-refine`, `/interview-me`, `/spec-driven-development` |
| Découpage | `/planning-and-task-breakdown` |
| Implémentation | `/incremental-implementation`, `/test-driven-development`, `/api-and-interface-design`, `/frontend-ui-engineering` (en complément de `/shadcn` + `/ui-ux-pro-max`) |
| Bug | `/debugging-and-error-recovery` |
| Qualité | `/code-review-and-quality`, `/code-simplification`, `/performance-optimization`, `/browser-testing-with-devtools` |
| Sécurité | `/security-and-hardening` (toute migration, RPC, Edge Function, paiement ou nouvelle entrée utilisateur) |
| Livraison | `/git-workflow-and-versioning`, `/ci-cd-and-automation`, `/shipping-and-launch`, `/documentation-and-adrs` |
| Évolution | `/deprecation-and-migration`, `/observability-and-instrumentation` |

Méta : `/using-agent-skills` explique comment choisir ; `/context-engineering`, `/source-driven-development`, `/constraint-driven-development`, `/doubt-driven-development` pour les sessions longues ou les décisions risquées.

### Précédence en cas de conflit

1. Règles « Sécurité et données » et conventions du projet (ce fichier) — toujours prioritaires.
2. Skills UI/UX du tableau ci-dessus pour tout ce qui se voit.
3. agent-skills pour le processus, puis ponytail pour la sobriété du code.

Pas de hooks automatiques installés (ponytail/graphify/agent-skills proposent des hooks Node/PreToolUse) : on les ajoutera seulement sur demande explicite.

## Stack technique

- **Framework** : React 19 + TypeScript + Vite
- **UI** : shadcn/ui (new-york style) + Radix UI + Tailwind CSS v4
- **Backend** : Supabase (auth, DB, realtime)
- **Router** : React Router v7
- **Forms** : React Hook Form + Zod v4
- **Charts** : Recharts
- **Animations** : CSS custom + tw-animate-css
- **Toast** : Sonner
- **Icons** : Lucide React

## Conventions du projet

- Langue de l'interface : **français** (Haïti)
- Monnaie : **HTG** (gourde haïtienne)
- Paiements locaux : MonCash, NatCash
- Palette primaire : orange (`#F05A28`) sur fond sombre (`#0A1628`)
- Police : Poppins (définie dans `src/index.css`)
- Border radius : `rounded-2xl` préféré pour les cartes
- Alias d'import : `@/` → `src/`

## Structure

```
src/
  components/
    ui/          ← composants shadcn/ui
    layouts/     ← PublicLayout, ClientLayout, AdminLayout
    shared/      ← composants partagés (StatusBadge, EmptyState…)
  pages/
    admin/       ← tableau de bord admin
    *.tsx        ← pages client (dashboard, orders, wallet…)
  lib/
    auth-context.tsx
    supabase.ts
    utils.ts
  hooks/
```

## Sécurité et données — règles du projet

Adaptées du guide d'architecture PatwonPro (Next.js + Supabase) à cette stack (Vite SPA + Supabase).

1. **La RLS Postgres est la seule vraie barrière.** Cacher un bouton ou griser un champ n'est qu'un confort : n'importe qui peut appeler l'API Supabase directement. Toute nouvelle table : RLS activée + policies par rôle, testées.
2. **Le navigateur ne décide jamais d'un montant, d'un prix, d'un statut ou d'un solde.** Tout ce qui touche l'argent ou un statut sensible passe par une fonction SQL `SECURITY DEFINER` (RPC) qui relit `auth.uid()`, vérifie le rôle et le propriétaire, verrouille la ligne (`FOR UPDATE`) et reste idempotente. Exemples : `create_product_order`, `pay_order`, `admin_review_deposit`, `pay_shipping_quote`.
3. **Pas d'écriture directe du client sur** `wallets`, `wallet_transactions` (hors dépôt « pending »), `orders`, `product_orders`, `product_requests` (hors demande initiale), `profiles.role`. Les policies INSERT/UPDATE de ces tables sont fermées ou limitées ; les effets de bord se font en base (RPC, triggers `SECURITY DEFINER`).
4. **Toute fonction `SECURITY DEFINER` fixe `SET search_path = public`**, retire `EXECUTE` à `PUBLIC` et `anon`, et ne l'accorde qu'à `authenticated` si le client doit l'appeler. Les fonctions de trigger ne sont jamais appelables via l'API.
5. **Les policies utilisent des helpers `SECURITY DEFINER`** (`is_admin()`, `is_super_admin()`), jamais une sous-requête inline sur `profiles` (risque de récursion RLS). Chaque policy `INSERT`/`UPDATE` a un `WITH CHECK` réfléchi. Utiliser `(select auth.uid())`.
6. **Rôles** : `admin` (tout, seul à changer les rôles) > `manager` > `agent` > `client`. Un trigger empêche toute élévation de rôle côté client.
7. **Journal d'audit append-only** (`audit_logs`) : alimenté par des triggers sur les changements de rôle, solde, statut. Aucune policy update/delete. Lecture réservée aux admins.
8. **Contraintes SQL en filet final** (`CHECK` sur statuts, montants positifs, soldes non négatifs) : ce que Zod ou l'UI valident doit aussi être refusé par la base.
9. **Service role** : uniquement dans les Edge Functions pour des contextes sans session (webhook, cron, paiement serveur-à-serveur) ; jamais dans le code `src/`. Les secrets ne sont jamais dans `VITE_*` (public, injecté au build) ni commités : `.env` est ignoré, `.env.example` documente les variables. Après changement d'une variable Vercel : redéployer.
10. **Pas de `any`** (règle ESLint en erreur). Dates en UTC (`timestamptz`).
11. **Avant de terminer une tâche** : `npm run check` (lint + typecheck + build) ; après toute migration touchant une policy ou une fonction, test d'impersonation en transaction annulée (`SET LOCAL ROLE authenticated` + `request.jwt.claims`) pour chaque rôle concerné ; relire `get_advisors` (sécurité) — aucune nouvelle alerte tolérée ; revue visuelle de toute UI.
12. Après toute migration touchant une policy, une fonction ou un droit : relancer `supabase/tests/security.sql` (tout est annulé à la fin, une assertion échouée arrête le script). `npm run check` inclut lint, i18n, tests unitaires (`npm test`), typecheck et build.
13. Les migrations sont versionnées dans `supabase/migrations/` et décrivent exactement ce qui a été appliqué.
