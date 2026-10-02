import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { cn } from '@/lib/utils'
import { ArrowRight } from 'lucide-react'

// ── Data ────────────────────────────────────────────────────────────────

const BRANDS = [
  { name: 'Alibaba', logo: '/brands/alibaba.png', bg: 'bg-orange-50' },
  { name: 'Shein', logo: '/brands/shein.png', bg: 'bg-gray-50' },
  { name: 'Temu', logo: '/brands/temu.jpg', bg: 'bg-orange-50' },
]

const FEATURES = [
  {
    icon: '/icons/glass/cart.svg',
    title: 'Commandez partout',
    description: "Soumettez un lien depuis Alibaba, Shein ou Temu — sans carte bancaire étrangère.",
  },
  {
    icon: '/icons/glass/document.svg',
    title: 'Devis transparent',
    description: "Recevez un devis complet avec tous les frais détaillés en moins de 24h.",
  },
  {
    icon: '/icons/glass/credit-card.svg',
    title: 'Paiement local',
    description: "Payez via MonCash ou NatCash, directement depuis Haïti.",
  },
  {
    icon: '/icons/glass/clipboard.svg',
    title: 'Suivi en temps réel',
    description: "Suivez votre commande à chaque étape, de l'achat jusqu'à votre porte.",
  },
  {
    icon: '/icons/glass/database.svg',
    title: 'Douane incluse',
    description: "Tous les frais douaniers sont calculés et inclus dans votre devis.",
  },
  {
    icon: '/icons/glass/chart.svg',
    title: 'Tableau de bord',
    description: "Gérez toutes vos commandes depuis un espace personnel sécurisé.",
  },
]

const STATS = [
  { value: 4800, suffix: '+', label: 'Clients satisfaits' },
  { value: 12000, suffix: '+', label: 'Commandes livrées' },
  { value: 98, suffix: '%', label: 'Taux de satisfaction' },
  { value: 24, suffix: 'h', label: 'Délai de devis' },
]

const STEPS = [
  {
    number: '1',
    icon: '/icons/glass/cart.svg',
    title: 'Soumettez un lien',
    description: "Collez l'URL du produit depuis Alibaba, Shein ou Temu dans votre espace client.",
  },
  {
    number: '2',
    icon: '/icons/glass/document.svg',
    title: 'Recevez un devis',
    description: "Obtenez un devis complet avec tous les frais détaillés en moins de 24h.",
  },
  {
    number: '3',
    icon: '/icons/glass/credit-card.svg',
    title: 'Payez en Haïti',
    description: "Rechargez votre portefeuille via MonCash ou NatCash et confirmez la commande.",
  },
  {
    number: '4',
    icon: '/icons/glass/clipboard.svg',
    title: 'Recevez chez vous',
    description: "Suivez votre colis en temps réel et recevez-le directement à domicile.",
  },
]

const PAYMENT_METHODS = [
  {
    icon: '/icons/glass/credit-card.svg',
    name: 'MonCash',
    description: "Paiement mobile Digicel — payez instantanément depuis votre téléphone.",
  },
  {
    icon: '/icons/glass/currency.svg',
    name: 'NatCash',
    description: "Paiement mobile Natcom — une autre façon rapide de régler vos commandes.",
  },
]

const IMAGES = {
  woman:    'https://images.unsplash.com/photo-1770013413878-2530e2c3d82b?w=1080&q=80&auto=format&fit=crop',
  shopping: 'https://images.unsplash.com/photo-1539278383962-a7774385fa02?w=1080&q=80&auto=format&fit=crop',
  delivery: 'https://images.unsplash.com/photo-1614018453562-77f6180ce036?w=1080&q=80&auto=format&fit=crop',
  phone:    'https://images.unsplash.com/photo-1521572089244-e5aaacacca6b?w=1080&q=80&auto=format&fit=crop',
}

const FAQS = [
  {
    question: "Comment fonctionne le service ?",
    answer: "Vous soumettez un lien produit, nous calculons un devis tout inclus (produit, service, douane, livraison), vous payez via MonCash ou NatCash, et nous gérons l'achat et l'expédition jusqu'à la livraison.",
  },
  {
    question: "Quels produits puis-je importer ?",
    answer: "Vous pouvez importer la plupart des produits disponibles sur Alibaba, Shein et Temu : électronique, vêtements, équipements, articles ménagers, etc. Certains produits sont soumis à des restrictions douanières.",
  },
  {
    question: "Quels sont les délais de livraison ?",
    answer: "Les délais varient de 3 à 6 semaines selon le produit et le fournisseur. Le délai estimé est toujours indiqué dans votre devis avant paiement.",
  },
  {
    question: "Comment sont calculés les frais ?",
    answer: "Le prix inclut le coût du produit, nos frais de service, l'expédition maritime, la douane estimée et la livraison locale en Haïti. Tout est détaillé ligne par ligne dans votre devis.",
  },
  {
    question: "Puis-je suivre ma commande ?",
    answer: "Oui, vous recevez des notifications à chaque étape : achat confirmé, arrivée à l'entrepôt, expédition, arrivée en Haïti, dédouanement et livraison.",
  },
]

// ── Hooks ────────────────────────────────────────────────────────────────

function useCountUp(target: number, active: boolean, duration = 1600) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!active) return
    let start: number | null = null
    const step = (ts: number) => {
      if (!start) start = ts
      const progress = Math.min((ts - start) / duration, 1)
      const ease = 1 - Math.pow(1 - progress, 3)
      setCount(Math.floor(ease * target))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [active, target, duration])
  return count
}

// ── Components ───────────────────────────────────────────────────────────

function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('is-visible')
          observer.disconnect()
        }
      },
      { threshold: 0.1 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return (
    <div
      ref={ref}
      className={cn('reveal', className)}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

function StatCounter({
  value,
  suffix,
  label,
}: {
  value: number
  suffix: string
  label: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(false)
  const count = useCountUp(value, active)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setActive(true)
          observer.disconnect()
        }
      },
      { threshold: 0.5 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className="flex flex-col gap-1">
      <span className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
        {count.toLocaleString('fr-HT')}
        <span className="text-primary">{suffix}</span>
      </span>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────

export function HomePage() {
  return (
    <div className="flex flex-col">
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-16 sm:px-6 md:grid-cols-2 md:items-center md:py-28">
        <div className="flex flex-col gap-6">
          <span className="inline-flex w-fit items-center rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            🇭🇹 Service d'importation haïtien
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Importez depuis{' '}
            <span className="text-primary">Alibaba, Shein</span>
            {' '}et Temu en Haïti
          </h1>
          <p className="max-w-md text-lg text-muted-foreground">
            Commandez depuis n'importe quelle boutique internationale et payez
            via MonCash ou NatCash. Sans carte bancaire étrangère.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              asChild
              size="lg"
              className="btn-gradient min-h-12 rounded-full px-8 text-base"
            >
              <Link to="/auth">
                Commencer gratuitement
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="min-h-12 rounded-full px-8 text-base"
            >
              <Link to="/auth">Se connecter</Link>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Pas besoin de carte bancaire. Créez votre compte en moins de 2 minutes.
          </p>
        </div>

        {/* Right: hero lifestyle image */}
        <div className="relative mx-auto w-full max-w-sm">
          <div
            className="absolute inset-0 -z-10 rounded-[2rem] blur-3xl opacity-25 pointer-events-none"
            aria-hidden
            style={{ background: 'linear-gradient(135deg, #F05A28, #D44E21)' }}
          />

          <div className="relative overflow-hidden rounded-3xl shadow-2xl ring-1 ring-white/10">
            <img
              src={IMAGES.woman}
              alt="Colis importé livré en Haïti"
              className="aspect-[3/4] w-full object-cover"
            />

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />

            {/* Payment badge — top right */}
            <div className="absolute top-4 right-4 flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 shadow-lg backdrop-blur-sm">
              <span className="text-[11px] font-bold text-gray-800">MonCash · NatCash</span>
            </div>

            {/* Brand logos — bottom overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-5">
              <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-white/60">
                Commandez depuis
              </p>
              <div className="flex flex-wrap gap-2">
                {BRANDS.map((brand) => (
                  <div
                    key={brand.name}
                    className="flex items-center gap-1.5 rounded-full px-2.5 py-1 ring-1 ring-white/20"
                    style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(12px)' }}
                  >
                    <img
                      src={brand.logo}
                      alt={brand.name}
                      className="h-3.5 w-auto max-w-[26px] object-contain"
                    />
                    <span className="text-[11px] font-semibold text-white">{brand.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust bar — brand logos ───────────────────────────────────── */}
      <section className="border-y border-border bg-muted/30 px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <p className="mb-6 text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Commandez depuis vos boutiques préférées
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-16">
            {BRANDS.map((brand) => (
              <img
                key={brand.name}
                src={brand.logo}
                alt={brand.name}
                className="h-8 w-auto max-w-[100px] object-contain opacity-70 grayscale transition-all hover:opacity-100 hover:grayscale-0"
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ─────────────────────────────────────────────────────── */}
      <section className="border-b border-border bg-muted/40 px-4 py-12 sm:px-6">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 sm:grid-cols-4">
          {STATS.map((stat, i) => (
            <Reveal key={stat.label} delay={i * 80}>
              <StatCounter value={stat.value} suffix={stat.suffix} label={stat.label} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Visual showcase ───────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 md:py-24">
        <div className="grid gap-10 md:grid-cols-2 md:items-center md:gap-16">
          <Reveal className="order-2 md:order-1">
            <div className="overflow-hidden rounded-3xl shadow-2xl ring-1 ring-border">
              <img
                src={IMAGES.woman}
                alt="Colis reçu à domicile"
                className="aspect-[4/3] w-full object-cover"
              />
            </div>
          </Reveal>
          <Reveal delay={120} className="order-1 md:order-2 flex flex-col gap-5">
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              La boutique internationale, livrée jusqu'à votre porte
            </h2>
            <p className="text-lg text-muted-foreground">
              Plus besoin de connaître quelqu'un à l'étranger.
              KONVWA achète pour vous, dédouane et livre directement en Haïti.
            </p>
            <ul className="space-y-3">
              {[
                'Achat sécurisé auprès des fournisseurs internationaux',
                'Dédouanement entièrement pris en charge',
                'Livraison directe en Haïti — sans intermédiaire',
              ].map((point) => (
                <li key={point} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <span
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ background: 'linear-gradient(135deg, #F05A28, #D44E21)' }}
                  >
                    ✓
                  </span>
                  {point}
                </li>
              ))}
            </ul>
            <div className="pt-2">
              <Button
                asChild
                size="lg"
                className="btn-gradient rounded-full px-8"
              >
                <Link to="/auth">
                  Créer mon compte gratuitement
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────────── */}
      <section
        id="features"
        className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 md:py-24"
      >
        <Reveal className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Tout ce dont vous avez besoin
          </h2>
          <p className="mt-3 text-lg text-muted-foreground">
            Un service complet de l'achat à la livraison — sans complexité.
          </p>
        </Reveal>

        {/* Shopping lifestyle banner */}
        <Reveal className="mb-8 overflow-hidden rounded-3xl shadow-lg ring-1 ring-border">
          <div className="relative">
            <img
              src={IMAGES.shopping}
              alt="Shopping en ligne depuis Haïti"
              className="h-52 w-full object-cover sm:h-64"
            />
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(to right, rgba(10,22,40,0.80) 0%, rgba(10,22,40,0.20) 60%, transparent 100%)' }}
            />
            <div className="absolute inset-0 flex flex-col justify-center px-8">
              <p className="text-sm font-semibold uppercase tracking-widest text-white/70">
                100% en ligne
              </p>
              <p className="mt-1 max-w-xs text-xl font-extrabold text-white sm:text-2xl">
                Commandez depuis Alibaba, Shein ou Temu sans carte étrangère
              </p>
            </div>
          </div>
        </Reveal>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, i) => (
            <Reveal
              key={feature.title}
              delay={i * 70}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <img src={feature.icon} alt="" aria-hidden className="h-9 w-9" />
              <h3 className="text-lg font-semibold text-foreground">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────── */}
      <section
        id="how-it-works"
        className="border-y border-border bg-muted/30 px-4 py-16 sm:px-6 md:py-24"
      >
        <div className="mx-auto max-w-6xl">
          <Reveal className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Comment ça marche
            </h2>
            <p className="mt-3 text-lg text-muted-foreground">
              Quatre étapes simples pour recevoir vos produits en Haïti.
            </p>
          </Reveal>

          <div className="grid gap-8 md:grid-cols-4">
            {STEPS.map((step, i) => (
              <Reveal
                key={step.number}
                delay={i * 100}
                className="flex flex-col items-center gap-3 text-center"
              >
                <div className="relative">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card shadow-sm">
                    <img src={step.icon} alt="" aria-hidden className="h-8 w-8" />
                  </div>
                  <span
                    className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ background: 'linear-gradient(135deg, #F05A28, #D44E21)' }}
                  >
                    {step.number}
                  </span>
                </div>
                <h3 className="text-base font-semibold text-foreground">{step.title}</h3>
                <p className="max-w-[180px] text-sm text-muted-foreground">
                  {step.description}
                </p>
                {i === 0 && (
                  <div className="flex items-center gap-2 mt-1">
                    {BRANDS.map((b) => (
                      <img key={b.name} src={b.logo} alt={b.name}
                        className="h-4 w-auto max-w-[36px] object-contain opacity-60" />
                    ))}
                  </div>
                )}
              </Reveal>
            ))}
          </div>

          {/* Delivery lifestyle image */}
          <Reveal className="mt-14 overflow-hidden rounded-3xl shadow-xl ring-1 ring-border">
            <div className="relative">
              <img
                src={IMAGES.delivery}
                alt="Colis livré à la porte"
                className="h-64 w-full object-cover sm:h-80"
              />
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-3"
                style={{ background: 'linear-gradient(to top, rgba(10,22,40,0.75) 0%, transparent 50%)' }}
              >
                <p className="mt-auto pb-8 text-center text-xl font-bold text-white drop-shadow-md sm:text-2xl">
                  Votre colis, livré directement chez vous en Haïti
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Payment Methods ───────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 md:py-24">
        <div className="grid gap-12 md:grid-cols-2 md:items-center md:gap-16">
          <Reveal className="flex flex-col gap-8">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                Payez comme vous êtes habitués
              </h2>
              <p className="mt-3 text-lg text-muted-foreground">
                Rechargez votre portefeuille avec les moyens de paiement les plus utilisés en Haïti.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {PAYMENT_METHODS.map((method, i) => (
                <Reveal
                  key={method.name}
                  delay={i * 100}
                  className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
                >
                  <img src={method.icon} alt="" aria-hidden className="h-9 w-9" />
                  <h3 className="text-lg font-semibold text-foreground">{method.name}</h3>
                  <p className="text-sm text-muted-foreground">{method.description}</p>
                </Reveal>
              ))}
            </div>
          </Reveal>

          <Reveal delay={150}>
            <div className="overflow-hidden rounded-3xl shadow-2xl ring-1 ring-border">
              <img
                src={IMAGES.phone}
                alt="Paiement mobile MonCash NatCash"
                className="aspect-[4/5] w-full object-cover"
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────── */}
      <section
        id="faq"
        className="border-t border-border bg-muted/20 px-4 py-16 sm:px-6 md:py-24"
      >
        <div className="mx-auto max-w-3xl">
          <Reveal className="mx-auto mb-10 max-w-2xl text-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Questions fréquentes
            </h2>
          </Reveal>

          <Accordion type="single" collapsible className="w-full">
            {FAQS.map((faq) => (
              <AccordionItem key={faq.question} value={faq.question}>
                <AccordionTrigger className="py-4 text-left text-base">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ── CTA Banner ────────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 md:py-24">
        <Reveal>
          <div
            className="relative overflow-hidden rounded-3xl px-8 py-12 sm:px-14 sm:py-16"
            style={{
              background: 'linear-gradient(135deg, #F05A28 0%, #c44b20 50%, #F05A28 100%)',
            }}
          >
            <div
              className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 pointer-events-none"
              aria-hidden
            />
            <div
              className="absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-white/5 pointer-events-none"
              aria-hidden
            />

            <div className="relative flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-md">
                <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                  Prêt à importer en Haïti ?
                </h2>
                <p className="mt-3 text-white/80">
                  Créez votre compte gratuitement et soumettez votre première
                  commande aujourd'hui — sans engagement, sans carte bancaire
                  étrangère.
                </p>
              </div>
              <Button
                asChild
                size="lg"
                className="min-h-12 shrink-0 rounded-full bg-white px-8 text-base text-foreground hover:bg-white/90"
              >
                <Link to="/auth">
                  Commencer gratuitement
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  )
}
