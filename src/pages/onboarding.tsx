import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useEmblaCarousel from 'embla-carousel-react'
import { Globe, ShoppingBag, FileText, MapPin, Smartphone, Rocket, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const ONBOARDING_KEY = 'konvwa_onboarding_done'

interface SlideData {
  icon: React.ElementType
  title: string
  subtitle: string
  description: string
  // Background via inline style for OKLCH colors
  bgFrom: string
  bgTo: string
  iconBg: string
  textLight: boolean
}

const SLIDES: SlideData[] = [
  {
    icon: Globe,
    title: 'Bienvenue sur KONVWA',
    subtitle: 'Votre passerelle vers le commerce mondial',
    description: "Importez tout ce que vous voulez depuis les plus grandes plateformes mondiales, directement chez vous en Haïti.",
    bgFrom: '#0A1628',
    bgTo: '#0f2040',
    iconBg: 'rgba(240,90,40,0.2)',
    textLight: true,
  },
  {
    icon: ShoppingBag,
    title: 'Achetez partout',
    subtitle: 'Alibaba · Shein · Temu · Amazon',
    description: "Partagez simplement le lien de n'importe quel produit et nous gérons l'achat, le transport et la livraison.",
    bgFrom: '#F05A28',
    bgTo: '#d44a1e',
    iconBg: 'rgba(255,255,255,0.15)',
    textLight: true,
  },
  {
    icon: FileText,
    title: 'Devis en 24h',
    subtitle: 'Prix transparent, sans surprises',
    description: "Recevez un devis complet incluant transport aérien, droits de douane et livraison locale, libellé en HTG.",
    bgFrom: '#0A1628',
    bgTo: '#122035',
    iconBg: 'rgba(255,179,71,0.2)',
    textLight: true,
  },
  {
    icon: MapPin,
    title: 'Suivi en temps réel',
    subtitle: 'De la commande à votre porte',
    description: "Notifications push à chaque étape : achat confirmé, expédition, arrivée en Haïti, livraison finale.",
    bgFrom: '#F05A28',
    bgTo: '#c04018',
    iconBg: 'rgba(10,22,40,0.25)',
    textLight: true,
  },
  {
    icon: Smartphone,
    title: 'Payez en HTG',
    subtitle: 'MonCash · NatCash · Virement',
    description: "Règlement simple en gourdes haïtiennes via vos méthodes de paiement locales, sans frais cachés.",
    bgFrom: '#0A1628',
    bgTo: '#0d1e32',
    iconBg: 'rgba(240,90,40,0.2)',
    textLight: true,
  },
  {
    icon: Rocket,
    title: 'Prêt à commencer ?',
    subtitle: 'Gratuit et sans engagement',
    description: "Rejoignez des milliers de clients satisfaits qui importent avec KONVWA chaque semaine.",
    bgFrom: '#F05A28',
    bgTo: '#AF3E12',
    iconBg: 'rgba(255,255,255,0.15)',
    textLight: true,
  },
]

// Animated content that re-triggers entrance when slide becomes active
function SlideContent({ slide, animKey }: { slide: SlideData; animKey: number }) {
  const Icon = slide.icon
  return (
    <div key={animKey} className="flex flex-col items-center text-center px-8 pt-20 pb-32">
      {/* Icon container */}
      <div
        className="flex h-28 w-28 items-center justify-center rounded-[2rem] mb-10 shadow-2xl animate-in zoom-in-75 fade-in duration-500"
        style={{ background: slide.iconBg, backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        <Icon className="h-14 w-14 text-white" strokeWidth={1.5} />
      </div>

      {/* Subtitle */}
      <p
        className="text-sm font-medium mb-3 animate-in fade-in slide-in-from-bottom-3 duration-500 fill-mode-both"
        style={{ color: 'rgba(255,255,255,0.65)', animationDelay: '80ms' }}
      >
        {slide.subtitle}
      </p>

      {/* Title */}
      <h1
        className="text-3xl font-bold leading-tight mb-4 text-white animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both"
        style={{ animationDelay: '140ms' }}
      >
        {slide.title}
      </h1>

      {/* Description */}
      <p
        className="text-base leading-relaxed max-w-xs animate-in fade-in slide-in-from-bottom-4 duration-600 fill-mode-both"
        style={{ color: 'rgba(255,255,255,0.70)', animationDelay: '200ms' }}
      >
        {slide.description}
      </p>
    </div>
  )
}

export function OnboardingPage() {
  const navigate = useNavigate()
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false, dragFree: false })
  const [current, setCurrent] = useState(0)
  const [animKeys, setAnimKeys] = useState<number[]>(SLIDES.map(() => 0))
  const scrollProgressRef = useRef(0)
  const blobRefs = useRef<(HTMLDivElement | null)[]>([])

  // Redirect if already done
  useEffect(() => {
    if (localStorage.getItem(ONBOARDING_KEY)) {
      navigate('/auth', { replace: true })
    }
  }, [navigate])

  // Track slide changes and re-trigger entrance animations
  useEffect(() => {
    if (!emblaApi) return
    const onSelect = () => {
      const idx = emblaApi.selectedScrollSnap()
      setCurrent(idx)
      setAnimKeys((prev) => prev.map((k, i) => (i === idx ? k + 1 : k)))
    }
    emblaApi.on('select', onSelect)
    return () => { emblaApi.off('select', onSelect) }
  }, [emblaApi])

  // Parallax on background blobs via scroll event
  useEffect(() => {
    if (!emblaApi) return
    const onScroll = () => {
      scrollProgressRef.current = emblaApi.scrollProgress()
    }
    emblaApi.on('scroll', onScroll)
    return () => { emblaApi.off('scroll', onScroll) }
  }, [emblaApi])

  const isLast = current === SLIDES.length - 1

  function complete() {
    localStorage.setItem(ONBOARDING_KEY, '1')
    navigate('/auth', { replace: true })
  }

  function handleNext() {
    if (isLast) {
      complete()
    } else {
      emblaApi?.scrollNext()
    }
  }

  return (
    <div className="h-[100dvh] w-screen overflow-hidden select-none">
      {/* Embla */}
      <div ref={emblaRef} className="h-full overflow-hidden">
        <div className="flex h-full">
          {SLIDES.map((slide, index) => (
            <div
              key={index}
              className="min-w-full h-full relative overflow-hidden"
              style={{
                background: `linear-gradient(145deg, ${slide.bgFrom} 0%, ${slide.bgTo} 100%)`,
              }}
            >
              {/* Decorative blobs */}
              <div
                ref={(el) => { blobRefs.current[index * 2] = el }}
                className="absolute -top-24 -right-24 w-80 h-80 rounded-full opacity-50 blur-3xl pointer-events-none"
                style={{
                  background: index % 2 === 0
                    ? 'radial-gradient(circle, rgba(240,90,40,0.35) 0%, transparent 70%)'
                    : 'radial-gradient(circle, rgba(10,22,40,0.5) 0%, transparent 70%)',
                  transform: current === index ? 'scale(1.15) translate(8px, -8px)' : 'scale(1)',
                  transition: 'transform 0.8s ease',
                }}
              />
              <div
                ref={(el) => { blobRefs.current[index * 2 + 1] = el }}
                className="absolute -bottom-16 -left-16 w-72 h-72 rounded-full opacity-40 blur-3xl pointer-events-none"
                style={{
                  background: index % 2 === 0
                    ? 'radial-gradient(circle, rgba(255,179,71,0.25) 0%, transparent 70%)'
                    : 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)',
                  transform: current === index ? 'scale(1.1) translate(-8px, 8px)' : 'scale(1)',
                  transition: 'transform 0.8s ease 0.1s',
                }}
              />

              {/* Grid pattern overlay for texture */}
              <div
                className="absolute inset-0 pointer-events-none opacity-[0.04]"
                style={{
                  backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
                  backgroundSize: '32px 32px',
                }}
              />

              {/* Slide content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <SlideContent slide={slide} animKey={animKeys[index]} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fixed bottom overlay — controls */}
      <div className="absolute bottom-0 left-0 right-0 z-20 flex flex-col items-center gap-5 px-6 pb-10 pt-8"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.35) 0%, transparent 100%)' }}>
        {/* Progress dots */}
        <div className="flex items-center gap-2">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => emblaApi?.scrollTo(i)}
              className={cn(
                'h-2 rounded-full transition-all duration-400',
                i === current ? 'w-8 bg-white shadow-md' : 'w-2 bg-white/40'
              )}
            />
          ))}
        </div>

        {/* Buttons */}
        <div className="w-full max-w-sm flex gap-3">
          {!isLast && (
            <button
              onClick={complete}
              className="flex-1 py-3.5 rounded-full text-sm font-semibold text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              Passer
            </button>
          )}
          <button
            onClick={handleNext}
            className={cn(
              'flex items-center justify-center gap-2 py-3.5 rounded-full text-sm font-semibold transition-all shadow-lg',
              isLast
                ? 'flex-1 bg-white text-primary hover:bg-white/95 text-base py-4 font-bold'
                : 'flex-1 bg-white/15 text-white hover:bg-white/25 border border-white/20 backdrop-blur-sm'
            )}
          >
            {isLast ? 'Créer mon compte' : 'Suivant'}
            <ChevronRight className={cn('h-4 w-4', isLast && 'h-5 w-5')} />
          </button>
        </div>
      </div>
    </div>
  )
}
