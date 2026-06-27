import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import {
  ArrowRight, Calculator, CreditCard, Truck, ShoppingBag,
  Smartphone, Package, Zap, Globe, Laptop, Shirt, Home as HomeIcon,
  Dumbbell, Sparkles, Car, Star, ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const features = [
  {
    icon: ShoppingBag,
    title: 'Commandez partout',
    description: 'Importez d\'Alibaba, Shein et Temu sans carte bancaire.',
    color: 'text-primary',
    bg: 'bg-primary/10',
  },
  {
    icon: Calculator,
    title: 'Devis transparent',
    description: 'Tous les frais détaillés avant paiement : produit, douane, livraison.',
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
  },
  {
    icon: Smartphone,
    title: 'Paiement local',
    description: 'Payez via MonCash ou NatCash, directement en Haïti.',
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
  },
  {
    icon: Truck,
    title: 'Suivi en temps réel',
    description: 'Suivez votre commande à chaque étape, de l\'achat à la livraison.',
    color: 'text-violet-500',
    bg: 'bg-violet-500/10',
  },
]

const stats = [
  { value: 4800, suffix: '+', label: 'Clients satisfaits' },
  { value: 12000, suffix: '+', label: 'Commandes livrées' },
  { value: 98, suffix: '%', label: 'Taux de satisfaction' },
  { value: 24, suffix: 'h', label: 'Délai de devis' },
]

const steps = [
  { step: 1, icon: Globe, title: 'Soumettez un lien', description: 'Collez l\'URL du produit depuis Alibaba, Shein ou Temu.' },
  { step: 2, icon: Calculator, title: 'Recevez un devis', description: 'Obtenez un devis complet avec tous les frais en 24h.' },
  { step: 3, icon: CreditCard, title: 'Payez en Haïti', description: 'Rechargez via MonCash/NatCash et validez votre commande.' },
  { step: 4, icon: Package, title: 'Recevez chez vous', description: 'Suivez en temps réel et recevez votre colis à domicile.' },
]

const testimonials = [
  {
    name: 'Marie C.',
    location: 'Port-au-Prince',
    text: 'J\'ai commandé du matériel électronique sur Alibaba sans problème. Le suivi était clair et la livraison rapide.',
    rating: 5,
    avatar: 'MC',
  },
  {
    name: 'Jean-Paul D.',
    location: 'Cap-Haïtien',
    text: 'Service excellent ! Les frais étaient transparents dès le départ, pas de mauvaise surprise.',
    rating: 5,
    avatar: 'JD',
  },
  {
    name: 'Sophie R.',
    location: 'Pétion-Ville',
    text: 'Payer avec MonCash c\'est tellement pratique. Plus besoin de carte de crédit étrangère.',
    rating: 5,
    avatar: 'SR',
  },
]

const faqs = [
  {
    question: 'Comment fonctionne le service ?',
    answer: 'Vous soumettez un lien produit, nous calculons un devis tout inclus, vous payez via MonCash/NatCash, et nous gérons l\'achat et l\'expédition jusqu\'à la livraison.',
  },
  {
    question: 'Quels types de produits puis-je importer ?',
    answer: 'Vous pouvez importer la plupart des produits disponibles sur Alibaba, Shein et Temu : électronique, vêtements, équipements, articles ménagers, etc.',
  },
  {
    question: 'Quels sont les délais de livraison ?',
    answer: 'Les délais varient de 3 à 6 semaines selon le produit et le fournisseur. Le délai estimé est indiqué dans votre devis.',
  },
  {
    question: 'Comment sont calculés les prix ?',
    answer: 'Le prix inclut le coût du produit, les frais de service, l\'expédition maritime, la douane estimée et la livraison locale en Haïti. Tout est détaillé ligne par ligne.',
  },
  {
    question: 'Puis-je suivre ma commande ?',
    answer: 'Oui, vous recevez des notifications à chaque étape : achat, entrepôt, expédition, arrivée en Haïti, dédouanement et livraison.',
  },
]

const categories = [
  { name: 'Électronique', icon: Laptop },
  { name: 'Mode', icon: Shirt },
  { name: 'Maison', icon: HomeIcon },
  { name: 'Sport', icon: Dumbbell },
  { name: 'Beauté', icon: Sparkles },
  { name: 'Auto', icon: Car },
]

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

function StatCounter({ value, suffix, label }: { value: number; suffix: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(false)
  const count = useCountUp(value, active)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setActive(true); observer.disconnect() } },
      { threshold: 0.5 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className="text-center">
      <p className="text-3xl lg:text-4xl font-bold text-white">
        {count.toLocaleString()}<span className="text-primary">{suffix}</span>
      </p>
      <p className="text-sm text-white/60 mt-1 font-medium">{label}</p>
    </div>
  )
}

function RevealSection({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { el.classList.add('is-visible'); observer.disconnect() } },
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return (
    <div ref={ref} className={cn('reveal', className)} style={style}>
      {children}
    </div>
  )
}

const HEADLINE_WORDS = ['Importez', 'depuis', 'le', 'monde', 'entier']

export function HomePage() {
  const heroRef = useRef<HTMLDivElement>(null)
  const [scrollY, setScrollY] = useState(0)

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="flex flex-col">
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section ref={heroRef} className="relative min-h-[92vh] flex items-center overflow-hidden"
        style={{ background: 'linear-gradient(145deg, #0A1628 0%, #1a2d4e 50%, #2a1a0a 100%)' }}>

        {/* Dot grid */}
        <div className="absolute inset-0 dot-grid opacity-60 pointer-events-none" />

        {/* Mesh overlay */}
        <div className="absolute inset-0 mesh-overlay pointer-events-none" />

        {/* Parallax blobs */}
        <div
          className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full blur-3xl opacity-25 pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(240,90,40,0.6) 0%, transparent 70%)',
            transform: `translateY(${scrollY * 0.25}px)`,
          }}
        />
        <div
          className="absolute -bottom-40 -left-40 w-[420px] h-[420px] rounded-full blur-3xl opacity-20 pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(255,179,71,0.5) 0%, transparent 70%)',
            transform: `translateY(${-scrollY * 0.15}px)`,
          }}
        />

        <div className="relative z-10 container px-4 mx-auto lg:px-8 py-24">
          <div className="max-w-4xl mx-auto text-center">
            <Badge className="mb-8 bg-white/10 text-white/90 border-white/20 backdrop-blur-sm animate-fade-in-up" style={{ animationDelay: '0ms' }}>
              <Zap className="h-3 w-3 mr-1.5 text-primary" />
              Importation simplifiée pour Haïti
            </Badge>

            {/* Animated headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight text-white mb-3">
              {HEADLINE_WORDS.map((word, i) => (
                <span
                  key={word}
                  className="inline-block mr-[0.25em] animate-word"
                  style={{ animationDelay: `${100 + i * 80}ms` }}
                >
                  {word}
                </span>
              ))}
            </h1>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight text-gradient mb-6 animate-word" style={{ animationDelay: '560ms' }}>
              sans carte bancaire
            </h1>

            <p className="mt-4 text-lg text-white/65 max-w-2xl mx-auto leading-relaxed animate-fade-in-up" style={{ animationDelay: '640ms' }}>
              Commandez sur Alibaba, Shein et Temu. Payez via MonCash ou NatCash.
              Suivez en temps réel jusqu'à la livraison chez vous en Haïti.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up" style={{ animationDelay: '720ms' }}>
              <Button size="lg" className="btn-gradient rounded-full px-8 h-12 text-base glow-orange" asChild>
                <Link to="/auth">
                  Commencer gratuitement
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="rounded-full px-8 h-12 text-base bg-white/5 border-white/20 text-white hover:bg-white/10" asChild>
                <Link to="/how-it-works">
                  Comment ça marche
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>

            {/* Platform badges */}
            <div className="mt-12 flex items-center justify-center gap-3 flex-wrap animate-fade-in-up" style={{ animationDelay: '800ms' }}>
              <span className="text-xs text-white/40 uppercase tracking-widest mr-2">Disponible sur</span>
              {['Alibaba', 'Shein', 'Temu', 'Amazon'].map((p) => (
                <span key={p} className="px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-semibold text-white/70 backdrop-blur-sm">
                  {p}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
          style={{ background: 'linear-gradient(to bottom, transparent, var(--background))' }} />
      </section>

      {/* ── Stats bar ─────────────────────────────────────────────── */}
      <section className="py-12" style={{ background: 'linear-gradient(135deg, #0A1628 0%, #1a2d4e 100%)' }}>
        <div className="container px-4 mx-auto lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((s) => (
              <StatCounter key={s.label} value={s.value} suffix={s.suffix} label={s.label} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────── */}
      <section className="py-24 bg-muted/20">
        <div className="container px-4 mx-auto lg:px-8">
          <RevealSection className="text-center mb-14">
            <h2 className="text-3xl lg:text-4xl font-bold">Pourquoi choisir KONVWA ?</h2>
            <p className="mt-4 text-muted-foreground max-w-2xl mx-auto text-lg">
              Un service complet, transparent et accessible pour tous les Haïtiens.
            </p>
          </RevealSection>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, i) => (
              <RevealSection key={feature.title} style={{ animationDelay: `${i * 80}ms` } as React.CSSProperties}>
                <div className="card-elevated p-6 h-full group">
                  <div className={cn('flex h-12 w-12 items-center justify-center rounded-2xl mb-5', feature.bg)}>
                    <feature.icon className={cn('h-6 w-6', feature.color)} strokeWidth={1.8} />
                  </div>
                  <h3 className="font-bold text-lg mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                </div>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── Categories ────────────────────────────────────────────── */}
      <section className="py-24">
        <div className="container px-4 mx-auto lg:px-8">
          <RevealSection className="text-center mb-14">
            <h2 className="text-3xl lg:text-4xl font-bold">Catégories populaires</h2>
            <p className="mt-4 text-muted-foreground text-lg">Importez tout ce dont vous avez besoin</p>
          </RevealSection>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {categories.map((cat, i) => {
              const Icon = cat.icon
              return (
                <RevealSection key={cat.name} style={{ animationDelay: `${i * 60}ms` } as React.CSSProperties}>
                  <Link
                    to="/auth"
                    className="flex flex-col items-center justify-center p-6 rounded-2xl border border-border bg-card hover:border-primary hover:shadow-lg hover:shadow-primary/10 transition-all duration-200 group"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 mb-3 group-hover:bg-primary/20 transition-colors">
                      <Icon className="h-6 w-6 text-primary" strokeWidth={1.8} />
                    </div>
                    <span className="font-semibold text-sm">{cat.name}</span>
                  </Link>
                </RevealSection>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────── */}
      <section className="py-24 bg-muted/20">
        <div className="container px-4 mx-auto lg:px-8">
          <RevealSection className="text-center mb-14">
            <h2 className="text-3xl lg:text-4xl font-bold">Comment ça marche</h2>
            <p className="mt-4 text-muted-foreground max-w-2xl mx-auto text-lg">
              Un processus simple en 4 étapes, de la recherche à la livraison.
            </p>
          </RevealSection>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-5xl mx-auto">
            {steps.map((s, index) => {
              const Icon = s.icon
              return (
                <RevealSection key={s.step} style={{ animationDelay: `${index * 100}ms` } as React.CSSProperties}>
                  <div className="relative flex flex-col items-center text-center group">
                    <div className="relative mb-6">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30 group-hover:scale-105 transition-transform duration-200">
                        <Icon className="h-7 w-7" strokeWidth={1.8} />
                      </div>
                      <div className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background text-xs font-bold">
                        {s.step}
                      </div>
                    </div>
                    <h3 className="font-bold text-base mb-2">{s.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{s.description}</p>
                    {index < steps.length - 1 && (
                      <div className="hidden lg:block absolute top-8 left-[calc(50%+2rem)] w-[calc(100%-4rem)] h-px bg-border" />
                    )}
                  </div>
                </RevealSection>
              )
            })}
          </div>
          <RevealSection className="mt-14 text-center">
            <Button size="lg" className="btn-gradient rounded-full px-8 h-12 text-base" asChild>
              <Link to="/auth">
                Soumettre un lien produit
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </RevealSection>
        </div>
      </section>

      {/* ── Testimonials ──────────────────────────────────────────── */}
      <section className="py-24">
        <div className="container px-4 mx-auto lg:px-8">
          <RevealSection className="text-center mb-14">
            <h2 className="text-3xl lg:text-4xl font-bold">Ce que disent nos clients</h2>
          </RevealSection>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {testimonials.map((t, i) => (
              <RevealSection key={t.name} style={{ animationDelay: `${i * 80}ms` } as React.CSSProperties}>
                <div className="card-elevated p-6 h-full flex flex-col">
                  <div className="flex gap-0.5 mb-4">
                    {[...Array(t.rating)].map((_, j) => (
                      <Star key={j} className="h-4 w-4 fill-yellow-400 text-yellow-400" strokeWidth={0} />
                    ))}
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed flex-1 mb-5">"{t.text}"</p>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                      {t.avatar}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.location}</p>
                    </div>
                  </div>
                </div>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────── */}
      <section className="py-24 bg-muted/20">
        <div className="container px-4 mx-auto lg:px-8">
          <RevealSection className="text-center mb-14">
            <h2 className="text-3xl lg:text-4xl font-bold">Questions fréquentes</h2>
          </RevealSection>
          <RevealSection className="max-w-2xl mx-auto">
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, index) => (
                <AccordionItem key={index} value={`item-${index}`}>
                  <AccordionTrigger className="text-left font-semibold">{faq.question}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground leading-relaxed">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </RevealSection>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────── */}
      <section className="py-24 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0A1628 0%, #1a2d4e 50%, #2a1a0a 100%)' }}>
        <div className="absolute inset-0 dot-grid opacity-50 pointer-events-none" />
        <div
          className="absolute -top-24 -right-24 w-96 h-96 rounded-full blur-3xl opacity-30 pointer-events-none animate-pulse-slow"
          style={{ background: 'radial-gradient(circle, rgba(240,90,40,0.5) 0%, transparent 70%)' }}
        />
        <RevealSection className="relative z-10 container px-4 mx-auto lg:px-8 text-center">
          <Badge className="mb-8 bg-white/10 text-white/80 border-white/20">
            <Sparkles className="h-3 w-3 mr-1.5 text-primary" />
            Gratuit et sans engagement
          </Badge>
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
            Prêt à commencer ?
          </h2>
          <p className="mb-10 text-white/60 max-w-xl mx-auto text-lg leading-relaxed">
            Rejoignez des milliers de clients satisfaits qui importent avec KONVWA chaque semaine.
          </p>
          <Button size="lg" className="btn-gradient rounded-full px-10 h-14 text-base glow-orange" asChild>
            <Link to="/auth">
              Créer mon compte gratuit
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </RevealSection>
      </section>
    </div>
  )
}
