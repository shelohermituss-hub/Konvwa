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
