import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, ShoppingBag, Wallet, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { KonvwaLogo } from '@/components/shared/konvwa-logo'
import { cn } from '@/lib/utils'

const SLIDES = [
  {
    image: 'https://images.unsplash.com/photo-1605629921852-f9b3d997c14a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800',
    icon: ShoppingBag,
    tag: 'Commandez',
    title: 'Importez depuis les meilleurs sites',
    body: 'Alibaba, Shein, Temu — commandez vos produits directement depuis la Chine et recevez-les en Haïti.',
    accent: '#F05A28',
  },
  {
    image: 'https://images.unsplash.com/photo-1556742521-9713bf272865?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800',
    icon: Wallet,
    tag: 'Payez',
    title: 'Payez facilement en gourdes',
    body: 'MonCash, NatCash, virement bancaire — réglez vos commandes avec les méthodes de paiement locales haïtiennes.',
    accent: '#10B981',
  },
  {
    image: 'https://images.unsplash.com/photo-1566576721346-d4a3b4eaeb55?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800',
    icon: Package,
    tag: 'Recevez',
    title: 'Livré jusqu\'à votre porte',
    body: 'Suivez votre colis en temps réel et recevez vos articles directement chez vous, en Haïti.',
    accent: '#6366F1',
  },
] as const

export function OnboardingPage() {
  const navigate  = useNavigate()
  const [step, setStep] = useState(0)
  const touchStartX = useRef<number | null>(null)

  function finish() {
    try { localStorage.setItem('konvwa_onboarding_seen', '1') } catch { /* */ }
    navigate('/auth', { replace: true })
  }

  function next() {
    if (step < SLIDES.length - 1) setStep(step + 1)
    else finish()
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (dx < -50 && step < SLIDES.length - 1) setStep(step + 1)
    if (dx >  50 && step > 0)                  setStep(step - 1)
  }

  const slide = SLIDES[step]
  const Icon  = slide.icon

  return (
    <div
      className="relative h-dvh w-full overflow-hidden bg-[#0A1628] select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* ── Background image (cross-fade) ── */}
      {SLIDES.map((s, i) => (
        <div
          key={i}
          className={cn(
            'absolute inset-0 transition-opacity duration-700',
            i === step ? 'opacity-100' : 'opacity-0',
          )}
        >
          <img
            src={s.image}
            alt=""
            className="h-full w-full object-cover object-center"
            draggable={false}
          />
          {/* gradient overlay — darker at top & bottom */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#0A1628]/70 via-transparent to-[#0A1628]/95" />
        </div>
      ))}

      {/* ── Logo + Skip ── */}
      <div className="relative z-10 flex items-center justify-between px-6 pt-12">
        <KonvwaLogo className="h-8 w-auto brightness-0 invert" />
        <button
          onClick={finish}
          className="text-sm font-medium text-white/60 hover:text-white transition-colors"
        >
          Passer
        </button>
      </div>

      {/* ── Bottom card ── */}
      <div className="absolute bottom-0 left-0 right-0 z-10 px-5 pb-10">

        {/* Tag pill */}
        <div
          className="mb-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest"
          style={{ backgroundColor: slide.accent + '22', color: slide.accent }}
        >
          <Icon size={12} />
          {slide.tag}
        </div>

        {/* Title */}
        <h1
          key={step}
          className="mb-3 text-3xl font-extrabold leading-tight text-white"
          style={{ animation: 'slideUp 0.4s ease forwards' }}
        >
          {slide.title}
        </h1>

        {/* Body */}
        <p
          key={`b${step}`}
          className="mb-8 text-base leading-relaxed text-white/70"
          style={{ animation: 'slideUp 0.45s ease forwards' }}
        >
          {slide.body}
        </p>

        {/* Dots + CTA row */}
        <div className="flex items-center justify-between">
          {/* Dots */}
          <div className="flex gap-2">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={cn(
                  'h-2 rounded-full transition-all duration-300',
                  i === step
                    ? 'w-6 bg-[#F05A28]'
                    : 'w-2 bg-white/30',
                )}
              />
            ))}
          </div>

          {/* Next / Start */}
          <Button
            onClick={next}
            className="rounded-full px-6 py-5 text-sm font-semibold shadow-lg"
            style={{ backgroundColor: slide.accent, color: '#fff' }}
          >
            {step < SLIDES.length - 1 ? (
              <>Suivant <ChevronRight size={16} className="ml-1" /></>
            ) : (
              'Commencer'
            )}
          </Button>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
      `}</style>
    </div>
  )
}
