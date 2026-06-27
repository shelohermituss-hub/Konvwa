import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import useEmblaCarousel from 'embla-carousel-react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const ONBOARDING_KEY = 'konvwa_onboarding_done'

// ── Particles (generated once at module load) ───────────────────
const PARTICLES = Array.from({ length: 20 }, () => ({
  x: Math.random() * 100,
  y: Math.random() * 100,
  s: 1.5 + Math.random() * 2.5,
  d: 2.5 + Math.random() * 4,
  delay: Math.random() * 3,
  opacity: 0.05 + Math.random() * 0.10,
}))

function Particles() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {PARTICLES.map((p, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-white animate-float"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.s,
            height: p.s,
            opacity: p.opacity,
            animationDuration: `${p.d}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  )
}

// ── Slide 1: Brand hero ─────────────────────────────────────────
function BrandVisual({ active }: { active: boolean }) {
  return (
    <div
      className={cn(
        'relative flex items-center justify-center transition-all duration-700 ease-out',
        active ? 'opacity-100 scale-100' : 'opacity-0 scale-90',
      )}
      style={{ width: 240, height: 240 }}
    >
      {/* Ambient glow */}
      <div
        className="absolute inset-0 rounded-full animate-ob-glow pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(240,90,40,0.35) 0%, rgba(240,90,40,0.1) 50%, transparent 70%)' }}
      />

      {/* Outer ring — slow clockwise */}
      <div
        className="absolute rounded-full border border-white/8 animate-ob-ring-cw pointer-events-none"
        style={{ width: 226, height: 226 }}
      />

      {/* Mid ring — reverse */}
      <div
        className="absolute rounded-full border border-[#F05A28]/25 animate-ob-ring-ccw pointer-events-none"
        style={{ width: 178, height: 178 }}
      />

      {/* Inner static ring */}
      <div className="absolute rounded-full border border-white/6 pointer-events-none" style={{ width: 134, height: 134 }} />

      {/* 3 orbiting dots — evenly spaced with negative delay */}
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="absolute animate-ob-orbit1 pointer-events-none"
          style={{ top: '50%', left: '50%', marginTop: -5, marginLeft: -5, animationDelay: `${i * -1.2}s` }}
        >
          <div
            className="w-2.5 h-2.5 rounded-full shadow-md"
            style={{
              background: i === 0 ? '#F05A28' : i === 1 ? 'rgba(255,255,255,0.8)' : '#00C3DC',
              boxShadow: i === 0 ? '0 0 8px rgba(240,90,40,0.8)' : i === 2 ? '0 0 8px rgba(0,195,220,0.8)' : 'none',
            }}
          />
        </div>
      ))}

      {/* K Badge */}
      <div
        className="relative z-10 flex h-28 w-28 items-center justify-center rounded-[32px]"
        style={{
          background: 'linear-gradient(145deg, #F07040 0%, #F05A28 45%, #AF3E12 100%)',
          boxShadow:
            '0 0 0 1px rgba(255,255,255,0.12) inset, 0 20px 60px rgba(240,90,40,0.60), 0 0 100px rgba(240,90,40,0.22)',
        }}
      >
        <span
          className="text-6xl font-black text-white leading-none"
          style={{ textShadow: '0 2px 12px rgba(0,0,0,0.28)' }}
        >
          K
        </span>
      </div>
    </div>
  )
}

// ── Slide 2: Globe with orbiting platforms ──────────────────────
const PLATFORMS = [
  { label: 'Ali',  bg: '#FF6A00', color: 'white' },
  { label: 'Shein', bg: '#f0f0f0', color: '#111' },
  { label: 'Temu', bg: '#E03A2B', color: 'white' },
  { label: 'AMZ',  bg: '#FF9900', color: '#111' },
]

function GlobeVisual({ active }: { active: boolean }) {
  return (
    <div
      className={cn(
        'relative flex items-center justify-center transition-all duration-700 ease-out',
        active ? 'opacity-100 scale-100' : 'opacity-0 scale-90',
      )}
      style={{ width: 290, height: 290 }}
    >
      {/* Teal ambient glow */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(0,195,220,0.20) 0%, transparent 65%)' }}
      />

      {/* Globe SVG — slow z-axis rotation */}
      <svg
        width="200"
        height="200"
        viewBox="0 0 200 200"
        className="animate-ob-globe pointer-events-none"
        style={{ transformOrigin: 'center' }}
      >
        <circle cx="100" cy="100" r="88" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
        <ellipse cx="100" cy="100" rx="44" ry="88" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        <ellipse cx="100" cy="100" rx="88" ry="34" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        <ellipse cx="100" cy="100" rx="70" ry="18" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        <line x1="100" y1="12" x2="100" y2="188" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        <line x1="12" y1="100" x2="188" y2="100" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        {/* Abstract continents */}
        <path d="M72 74 Q86 60 100 70 Q114 74 110 90 Q100 102 84 98 Q68 92 72 74Z" fill="rgba(255,255,255,0.14)" />
        <path d="M112 80 Q128 70 138 80 Q144 90 136 98 Q124 106 112 96 Q106 88 112 80Z" fill="rgba(255,255,255,0.11)" />
        <path d="M68 108 Q82 96 96 102 Q108 112 104 124 Q94 134 78 128 Q64 120 68 108Z" fill="rgba(255,255,255,0.10)" />
        <path d="M120 104 Q130 96 140 104 Q148 114 142 122 Q132 130 122 122 Q114 114 120 104Z" fill="rgba(255,255,255,0.08)" />
      </svg>

      {/* 4 orbiting platform badges */}
      {PLATFORMS.map((p, i) => (
        <div
          key={p.label}
          className="absolute animate-ob-orbit2 pointer-events-none"
          style={{
            top: '50%',
            left: '50%',
            marginTop: -20,
            marginLeft: -20,
            animationDelay: `${i * -1.8}s`,
          }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-[10px] font-black shadow-xl"
            style={{
              background: p.bg,
              color: p.color,
              boxShadow: `0 4px 20px rgba(0,0,0,0.3)`,
            }}
          >
            {p.label}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Slide 3: Phone / Payment ────────────────────────────────────
function PayVisual({ active }: { active: boolean }) {
  return (
    <div
      className={cn(
        'relative flex items-center justify-center transition-all duration-700 ease-out',
        active ? 'opacity-100 scale-100' : 'opacity-0 scale-90',
      )}
      style={{ width: 240, height: 290 }}
    >
      {/* Floating badge — left */}
      <div className="absolute -left-1 top-20 animate-float z-20" style={{ animationDelay: '0.3s' }}>
        <div
          className="rounded-2xl px-3 py-2 text-xs font-bold text-white shadow-xl"
          style={{ background: 'rgba(240,90,40,0.95)', backdropFilter: 'blur(8px)' }}
        >
          HTG ✓
        </div>
      </div>

      {/* Floating badge — right */}
      <div className="absolute -right-1 bottom-28 animate-float z-20" style={{ animationDelay: '1.1s' }}>
        <div
          className="rounded-2xl px-3 py-2 text-xs font-bold shadow-xl"
          style={{ background: 'rgba(0,195,180,0.95)', color: '#0A1628', backdropFilter: 'blur(8px)' }}
        >
          Sécurisé
        </div>
      </div>

      {/* Phone frame */}
      <div
        className="relative z-10 w-40 h-72 rounded-[2.5rem] overflow-hidden"
        style={{
          background: 'linear-gradient(145deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.07) 100%)',
          border: '1.5px solid rgba(255,255,255,0.22)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.12)',
        }}
      >
        {/* Notch */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-14 h-1.5 rounded-full bg-white/20" />

        {/* Status bar */}
        <div className="absolute top-6 left-5 right-5 flex justify-between items-center">
          <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 8 }}>9:41</span>
          <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 8 }}>●●●</span>
        </div>

        {/* Screen content */}
        <div className="absolute inset-0 top-11 flex flex-col p-4">
          <p className="text-center font-semibold uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.5)', fontSize: 7 }}>
            Paiement
          </p>
          <p className="text-center text-white text-xl font-bold leading-tight">3 500</p>
          <p className="text-center font-medium mb-3" style={{ color: 'rgba(255,255,255,0.45)', fontSize: 9 }}>HTG</p>

          <div className="space-y-2">
            {/* MonCash */}
            <div
              className="flex items-center gap-2 rounded-xl px-2.5 py-2"
              style={{ background: 'rgba(240,90,40,0.22)' }}
            >
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: '#F05A28' }}
              >
                <span className="text-white font-black" style={{ fontSize: 8 }}>M</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold leading-none" style={{ fontSize: 9 }}>MonCash</p>
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 7 }}>+509 •• ••</p>
              </div>
              {/* Checkmark */}
              <div
                className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: '#22c55e' }}
              >
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                  <path d="M1.5 4L3 5.5L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>

            {/* NatCash */}
            <div
              className="flex items-center gap-2 rounded-xl px-2.5 py-2"
              style={{ background: 'rgba(255,255,255,0.09)' }}
            >
              <div className="w-6 h-6 rounded-lg bg-blue-500 flex items-center justify-center flex-shrink-0">
                <span className="text-white font-black" style={{ fontSize: 8 }}>N</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold leading-none" style={{ fontSize: 9 }}>NatCash</p>
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 7 }}>+509 •• ••</p>
              </div>
            </div>
          </div>

          {/* Pay button */}
          <div
            className="mt-3 rounded-xl py-2 text-center font-bold"
            style={{
              background: 'linear-gradient(135deg, #F05A28 0%, #AF3E12 100%)',
              color: 'white',
              fontSize: 9,
            }}
          >
            Payer maintenant
          </div>

          {/* Home indicator */}
          <div className="mt-auto flex justify-center pb-1">
            <div className="w-12 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.18)' }} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Slide 4: Package + tracking ─────────────────────────────────
const TRACK_DOTS = [
  { angle: -90, label: 'Chine', active: true },
  { angle: 30,  label: 'Mer',   active: true },
  { angle: 150, label: 'Haïti', active: true },
]

function PackageVisual({ active }: { active: boolean }) {
  return (
    <div
      className={cn(
        'relative flex items-center justify-center transition-all duration-700 ease-out',
        active ? 'opacity-100 scale-100' : 'opacity-0 scale-90',
      )}
      style={{ width: 250, height: 250 }}
    >
      {/* Ambient glow */}
      <div
        className="absolute inset-0 rounded-full animate-ob-glow pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(240,90,40,0.30) 0%, transparent 65%)' }}
      />

      {/* Outer pulse ring */}
      <div
        className="absolute rounded-full border border-[#F05A28]/20 animate-pulse-slow pointer-events-none"
        style={{ width: 230, height: 230 }}
      />
      <div
        className="absolute rounded-full border border-white/6 pointer-events-none"
        style={{ width: 175, height: 175 }}
      />

      {/* Tracking dots */}
      {TRACK_DOTS.map(({ angle, label }, idx) => {
        const rad = (angle * Math.PI) / 180
        const r = 102
        const x = Math.cos(rad) * r
        const y = Math.sin(rad) * r
        return (
          <div
            key={label}
            className="absolute flex flex-col items-center gap-1 pointer-events-none animate-float"
            style={{
              left: `calc(50% + ${x}px)`,
              top: `calc(50% + ${y}px)`,
              transform: 'translate(-50%, -50%)',
              animationDelay: `${idx * 0.4}s`,
            }}
          >
            <div
              className="w-3 h-3 rounded-full shadow-lg"
              style={{ background: '#F05A28', boxShadow: '0 0 8px rgba(240,90,40,0.7)' }}
            />
            <span className="font-semibold text-white/55 whitespace-nowrap" style={{ fontSize: 8 }}>{label}</span>
          </div>
        )
      })}

      {/* Package icon */}
      <div
        className="relative z-10 flex h-32 w-32 items-center justify-center rounded-3xl"
        style={{
          background: 'linear-gradient(145deg, #F07040 0%, #F05A28 40%, #AF3E12 100%)',
          boxShadow:
            '0 20px 60px rgba(240,90,40,0.52), 0 0 80px rgba(240,90,40,0.20), inset 0 1px 0 rgba(255,255,255,0.15)',
        }}
      >
        <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
          <path
            d="M10 18L30 10L50 18V42L30 50L10 42V18Z"
            fill="rgba(255,255,255,0.14)"
            stroke="rgba(255,255,255,0.90)"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M30 10V50" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />
          <path d="M10 18L50 18" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />
          <path d="M19 14L38 22" stroke="rgba(255,255,255,0.30)" strokeWidth="1.5" strokeLinecap="round" />
          {/* Checkmark */}
          <path d="M21 32L27 38L40 23" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  )
}

// ── Slide text — key-forced remount to retrigger CSS animations ─
interface TextProps {
  label: string
  title: string
  description: string
  isOrange?: boolean
}

function SlideText({ label, title, description, isOrange }: TextProps) {
  return (
    <div className="text-center px-8 max-w-xs">
      <p
        className="text-xs font-semibold uppercase tracking-[0.18em] mb-3 animate-ob-text1"
        style={{ color: isOrange ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.50)' }}
      >
        {label}
      </p>
      <h2
        className="text-[1.7rem] font-bold text-white leading-tight mb-3 animate-ob-text2"
        style={{ letterSpacing: '-0.01em' }}
      >
        {title}
      </h2>
      <p className="text-sm leading-relaxed animate-ob-text3" style={{ color: 'rgba(255,255,255,0.65)' }}>
        {description}
      </p>
    </div>
  )
}

// ── Slide definitions ───────────────────────────────────────────
interface SlideData {
  id: 'brand' | 'globe' | 'pay' | 'cta'
  bgFrom: string
  bgTo: string
  blobColor: string
  isOrange?: boolean
  label: string
  title: string
  description: string
}

const SLIDES: SlideData[] = [
  {
    id: 'brand',
    bgFrom: '#060E1E',
    bgTo: '#0f1c34',
    blobColor: 'rgba(240,90,40,0.22)',
    label: 'KONVWA',
    title: 'Votre passerelle vers le monde',
    description:
      'Importez depuis les plus grandes plateformes mondiales directement chez vous en Haïti.',
  },
  {
    id: 'globe',
    bgFrom: '#070F1F',
    bgTo: '#0b1832',
    blobColor: 'rgba(0,195,220,0.22)',
    label: 'Commerce mondial',
    title: 'Importez du monde entier',
    description:
      'Alibaba, Shein, Temu, Amazon — sans carte bancaire internationale, sans frontières.',
  },
  {
    id: 'pay',
    bgFrom: '#D94E20',
    bgTo: '#95330D',
    blobColor: 'rgba(255,255,255,0.18)',
    isOrange: true,
    label: 'Paiement local',
    title: 'Payez en Haïti',
    description:
      'Rechargez via MonCash ou NatCash. Payez en HTG sans frais cachés ni carte étrangère.',
  },
  {
    id: 'cta',
    bgFrom: '#060D1C',
    bgTo: '#0d1828',
    blobColor: 'rgba(240,90,40,0.25)',
    label: 'Suivi en direct',
    title: 'Prêt à commencer ?',
    description:
      "Rejoignez des milliers de clients satisfaits. Créez votre compte gratuitement.",
  },
]

// ── Main ────────────────────────────────────────────────────────
export function OnboardingPage() {
  const navigate = useNavigate()
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false, dragFree: false })
  const [current, setCurrent] = useState(0)
  const [textKeys, setTextKeys] = useState(SLIDES.map(() => 0))

  useEffect(() => {
    if (localStorage.getItem(ONBOARDING_KEY)) {
      navigate('/auth', { replace: true })
    }
  }, [navigate])

  useEffect(() => {
    if (!emblaApi) return
    const onSelect = () => {
      const idx = emblaApi.selectedScrollSnap()
      setCurrent(idx)
      setTextKeys((prev) => prev.map((k, i) => (i === idx ? k + 1 : k)))
    }
    emblaApi.on('select', onSelect)
    return () => { emblaApi.off('select', onSelect) }
  }, [emblaApi])

  const isLast = current === SLIDES.length - 1

  function complete() {
    localStorage.setItem(ONBOARDING_KEY, '1')
    navigate('/auth', { replace: true })
  }

  function handleNext() {
    if (isLast) complete()
    else emblaApi?.scrollNext()
  }

  return (
    <div className="h-[100dvh] w-screen overflow-hidden select-none">

      {/* ── Embla carousel ── */}
      <div ref={emblaRef} className="h-full overflow-hidden">
        <div className="flex h-full">
          {SLIDES.map((slide, index) => {
            const active = current === index
            return (
              <div
                key={index}
                className="min-w-full h-full relative flex flex-col items-center justify-center overflow-hidden"
                style={{ background: `linear-gradient(160deg, ${slide.bgFrom} 0%, ${slide.bgTo} 100%)` }}
              >
                {/* Dot grid texture */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    backgroundImage: 'radial-gradient(circle, rgba(255,255,255,1) 1px, transparent 1px)',
                    backgroundSize: '28px 28px',
                    opacity: 0.032,
                  }}
                />

                {/* Blob top-right */}
                <div
                  className="absolute -top-40 -right-40 w-[26rem] h-[26rem] rounded-full blur-3xl pointer-events-none"
                  style={{
                    background: `radial-gradient(circle, ${slide.blobColor} 0%, transparent 70%)`,
                    transform: active ? 'scale(1.25) translate(10px, -10px)' : 'scale(1)',
                    transition: 'transform 1s cubic-bezier(0.23, 1, 0.32, 1)',
                  }}
                />

                {/* Blob bottom-left */}
                <div
                  className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full blur-3xl pointer-events-none"
                  style={{
                    background: `radial-gradient(circle, ${slide.blobColor} 0%, transparent 70%)`,
                    opacity: 0.55,
                    transform: active ? 'scale(1.2) translate(-10px, 10px)' : 'scale(1)',
                    transition: 'transform 1s cubic-bezier(0.23, 1, 0.32, 1) 0.1s',
                  }}
                />

                {/* Floating particles */}
                <Particles />

                {/* ── Illustration ── */}
                <div className="flex-shrink-0 mb-10 mt-8">
                  {slide.id === 'brand'  && <BrandVisual   active={active} />}
                  {slide.id === 'globe'  && <GlobeVisual   active={active} />}
                  {slide.id === 'pay'    && <PayVisual     active={active} />}
                  {slide.id === 'cta'    && <PackageVisual active={active} />}
                </div>

                {/* ── Text — key forces remount on slide change ── */}
                <SlideText
                  key={textKeys[index]}
                  label={slide.label}
                  title={slide.title}
                  description={slide.description}
                  isOrange={slide.isOrange}
                />

                {/* ── CTA buttons (last slide only) ── */}
                {slide.id === 'cta' && (
                  <div className="mt-8 w-full px-8 max-w-[320px] space-y-3">
                    <Link
                      to="/auth"
                      onClick={() => localStorage.setItem(ONBOARDING_KEY, '1')}
                      className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl text-sm font-bold text-white animate-ob-text3"
                      style={{
                        background: 'linear-gradient(135deg, #F05A28 0%, #AF3E12 100%)',
                        boxShadow: '0 8px 32px rgba(240,90,40,0.45)',
                        animationDelay: '240ms',
                      }}
                    >
                      Créer mon compte
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                    <Link
                      to="/auth"
                      onClick={() => localStorage.setItem(ONBOARDING_KEY, '1')}
                      className="flex items-center justify-center w-full py-3.5 rounded-2xl text-sm font-semibold animate-ob-text3"
                      style={{
                        background: 'rgba(255,255,255,0.09)',
                        color: 'rgba(255,255,255,0.80)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        backdropFilter: 'blur(8px)',
                        animationDelay: '320ms',
                      }}
                    >
                      J'ai déjà un compte
                    </Link>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Fixed bottom controls ── */}
      <div
        className="absolute bottom-0 left-0 right-0 z-20 flex flex-col items-center gap-5 px-6 pb-10 pt-6 pointer-events-none"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.42) 0%, transparent 100%)' }}
      >
        {/* Progress dots */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => emblaApi?.scrollTo(i)}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                i === current ? 'w-8 bg-white shadow-sm' : 'w-1.5 bg-white/30 hover:bg-white/50',
              )}
            />
          ))}
        </div>

        {/* Skip / Next — hidden on last slide (CTA handles it) */}
        {!isLast && (
          <div className="w-full max-w-xs flex gap-3 pointer-events-auto">
            <button
              onClick={complete}
              className="flex-1 py-3.5 rounded-2xl text-sm font-semibold text-white/55 hover:text-white/80 transition-colors"
            >
              Passer
            </button>
            <button
              onClick={handleNext}
              className="flex-1 flex items-center justify-center gap-1.5 py-3.5 rounded-2xl text-sm font-semibold text-white transition-all hover:bg-white/25 active:scale-[0.97]"
              style={{ background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.18)' }}
            >
              Suivant
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
