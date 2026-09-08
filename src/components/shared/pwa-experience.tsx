import { useState, useEffect } from 'react'
import { Bell, BellOff, ChevronDown, ChevronUp, X } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { usePushNotifications, type NotificationTypes } from '@/hooks/use-push-notifications'
import { toast } from 'sonner'

const TYPE_LABELS: { key: keyof NotificationTypes; label: string; desc: string }[] = [
  { key: 'orders',   label: 'Commandes',   desc: 'Statut de vos commandes et livraisons' },
  { key: 'payments', label: 'Paiements',   desc: 'Confirmations MonCash / NatCash' },
  { key: 'quotes',   label: 'Devis',       desc: 'Nouveau devis disponible' },
  { key: 'alerts',   label: 'Alertes',     desc: 'Informations et mises à jour importantes' },
]

interface Props {
  userId?: string
  className?: string
}

export function PwaExperience({ userId, className }: Props) {
  const { isSupported, permission, subscribed, loading, types, subscribe, updateTypes } =
    usePushNotifications(userId)

  const [dismissed, setDismissed]   = useState(() => {
    try { return localStorage.getItem('konvwa-push-dismissed') === '1' } catch { return false }
  })
  const [expanded, setExpanded]     = useState(false)
  const [localTypes, setLocalTypes] = useState<NotificationTypes>(types)

  // Silently re-subscribe when browser permission was already granted (can't call during render)
  useEffect(() => {
    if (isSupported && permission === 'granted' && !subscribed) {
      subscribe().catch(() => {})
    }
  }, [isSupported, permission, subscribed, subscribe])

  if (!isSupported || permission === 'denied' || dismissed || subscribed) return null
  if (permission === 'granted') return null

  function dismiss() {
    try { localStorage.setItem('konvwa-push-dismissed', '1') } catch { /* ignore */ }
    setDismissed(true)
  }

  async function handleSubscribe() {
    const ok = await subscribe(localTypes)
    if (ok) {
      toast.success('Notifications activées', {
        description: 'Vous recevrez les mises à jour directement sur cet appareil.',
      })
    } else {
      toast.error('Permission refusée', {
        description: 'Activez les notifications dans les paramètres du navigateur.',
      })
    }
  }

  function toggleType(key: keyof NotificationTypes, value: boolean) {
    const next = { ...localTypes, [key]: value }
    setLocalTypes(next)
    if (subscribed) updateTypes(next)
  }

  return (
    <div className={cn(
      'mx-4 mt-3 rounded-2xl border border-primary/20 bg-white shadow-sm overflow-hidden',
      className
    )}>
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Bell className="h-4.5 w-4.5 text-primary" strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground leading-tight">
            Activer les notifications
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
            Commandes, paiements et devis en temps réel
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-muted/60 transition-colors text-muted-foreground"
            aria-label="Voir les options"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <button
            onClick={dismiss}
            className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-muted/60 transition-colors text-muted-foreground"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Expandable type selection */}
      {expanded && (
        <div className="border-t border-border/40 px-4 py-3 bg-[#F8F9FB] space-y-2.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1">
            Types de notifications
          </p>
          {TYPE_LABELS.map(({ key, label, desc }) => (
            <div key={key} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground">{label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{desc}</p>
              </div>
              <Switch
                checked={localTypes[key]}
                onCheckedChange={(v) => toggleType(key, v)}
                className="shrink-0"
              />
            </div>
          ))}
        </div>
      )}

      {/* CTA bar */}
      <div className={cn('px-4 pb-3', expanded ? '' : 'pt-0')}>
        <button
          onClick={handleSubscribe}
          disabled={loading}
          className={cn(
            'w-full rounded-xl py-2.5 text-sm font-bold text-white transition-opacity',
            loading ? 'opacity-60 cursor-not-allowed' : 'active:scale-[0.98]'
          )}
          style={{ background: 'linear-gradient(135deg, #F05A28, #D44E21)' }}
        >
          {loading ? 'Activation…' : 'Activer les notifications'}
        </button>
      </div>
    </div>
  )
}

// ── Compact settings row (used on profile/notifications page) ──────────────

export function PushSettingsRow({ userId }: { userId?: string }) {
  const { isSupported, permission, subscribed, loading, types, subscribe, unsubscribe, updateTypes } =
    usePushNotifications(userId)

  const [localTypes, setLocalTypes] = useState<NotificationTypes>(types)

  if (!isSupported) {
    return (
      <div className="flex items-center gap-3 py-3">
        <BellOff className="h-4 w-4 text-muted-foreground/50 shrink-0" />
        <span className="text-sm text-muted-foreground">Non supporté sur cet appareil</span>
      </div>
    )
  }

  async function toggle() {
    if (subscribed) {
      await unsubscribe()
      toast.info('Notifications désactivées')
    } else {
      const ok = await subscribe(localTypes)
      if (ok) toast.success('Notifications activées')
      else toast.error('Permission refusée — vérifiez les paramètres du navigateur')
    }
  }

  function toggleType(key: keyof NotificationTypes, value: boolean) {
    const next = { ...localTypes, [key]: value }
    setLocalTypes(next)
    if (subscribed) updateTypes(next)
  }

  return (
    <div className="space-y-3">
      {/* Master toggle */}
      <div className="flex items-center justify-between py-1">
        <div className="flex items-center gap-3">
          <div className={cn(
            'flex h-8 w-8 items-center justify-center rounded-xl',
            subscribed ? 'bg-primary/10' : 'bg-muted'
          )}>
            <Bell className={cn('h-4 w-4', subscribed ? 'text-primary' : 'text-muted-foreground')} strokeWidth={1.8} />
          </div>
          <div>
            <p className="text-sm font-semibold">Notifications push</p>
            <p className="text-xs text-muted-foreground">
              {permission === 'denied'
                ? 'Bloquées — modifier dans les paramètres du navigateur'
                : subscribed
                ? 'Activées sur cet appareil'
                : 'Désactivées'}
            </p>
          </div>
        </div>
        <Switch
          checked={subscribed}
          onCheckedChange={toggle}
          disabled={loading || permission === 'denied'}
        />
      </div>

      {/* Per-type toggles — only shown when subscribed */}
      {subscribed && (
        <div className="ml-11 space-y-2 border-l-2 border-border/40 pl-4">
          {TYPE_LABELS.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground/80">{label}</span>
              <Switch
                checked={localTypes[key]}
                onCheckedChange={(v) => toggleType(key, v)}
                className="scale-90"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
