import { useEffect, useRef, useState } from 'react'
import { Flag } from '@/components/shared/flag'
import { Link, useSearchParams } from 'react-router-dom'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Eye, EyeOff, Loader2, LayoutDashboard, ChevronRight,
  LogOut, Upload, User, Lock, Bell, Activity, CreditCard, Heart, Gift, Store, ArrowLeft, Palette, Check, FileText, HelpCircle,
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

import { tr } from '@/lib/i18n'
import { AddressSection } from '@/components/shared/address-section'
import { ThemeSwitch } from '@/components/shared/theme-switch'
import { PasskeysSection } from '@/components/shared/passkeys-section'
import { SecuritySection } from '@/components/shared/security-section'
import { KycSection } from '@/components/shared/kyc-section'
import { RewardsSection } from '@/components/shared/rewards-section'

type Section = 'personal' | 'appearance' | 'notifications' | 'security' | 'rewards'
const SECTION_KEYS: Section[] = ['personal', 'appearance', 'notifications', 'security', 'rewards']

export function ProfilePage() {
  const { user, profile, signOut, isAdmin, refreshProfile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const sectionParam = searchParams.get('section') as Section | null
  const active = sectionParam && SECTION_KEYS.includes(sectionParam) ? sectionParam : null
  const [verified, setVerified] = useState(false)
  useEffect(() => {
    if (!user) return
    void supabase.from('kyc_submissions').select('status').eq('user_id', user.id).maybeSingle().then(({ data }) => setVerified(data?.status === 'approved'))
  }, [user])
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    if (file.size > 5 * 1024 * 1024) { toast.error(tr('Image trop lourde (max 5 Mo).')); return }
    setAvatarUploading(true)
    try {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${user.id}/avatar.${ext}`
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type })
      if (uploadError) throw uploadError
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      const { error: updateError } = await supabase.from('profiles').update({ avatar_url: `${publicUrl}?t=${Date.now()}`, updated_at: new Date().toISOString() }).eq('user_id', user.id)
      if (updateError) throw updateError
      await refreshProfile()
      toast.success(tr('Photo de profil mise à jour.'))
    } catch { toast.error(tr('Erreur lors de l\'upload de la photo.')) }
    finally { setAvatarUploading(false); if (fileInputRef.current) fileInputRef.current.value = '' }
  }

  async function handleRemoveAvatar() {
    if (!user) return
    const { error } = await supabase.from('profiles').update({ avatar_url: null, updated_at: new Date().toISOString() }).eq('user_id', user.id)
    if (error) toast.error(tr('Erreur lors de la suppression.'))
    else { await refreshProfile(); toast.success(tr('Photo supprimée.')) }
  }

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U'

  const sections: Record<Section, { title: string; body: React.ReactNode }> = {
    personal: {
      title: tr('Informations personnelles'),
      body: (
        <>
          <Card>
            <PersonalInfoForm avatarUploading={avatarUploading} onAvatarUpload={() => fileInputRef.current?.click()} onAvatarRemove={handleRemoveAvatar} />
          </Card>
          <p className="px-1 pt-2 text-sm font-semibold">{tr('Adresses de livraison')}</p>
          <Card><AddressSection /></Card>
        </>
      ),
    },
    appearance: {
      title: tr('Apparence'),
      body: (
        <Card>
          <div className="space-y-3 p-5">
            <p className="text-sm text-muted-foreground">{tr('Choisissez l\'apparence de l\'application. « Système » suit le réglage de votre téléphone.')}</p>
            <ThemeSwitch />
          </div>
        </Card>
      ),
    },
    notifications: { title: tr('Notifications'), body: <Card><PreferencesSection /></Card> },
    security: {
      title: tr('Confidentialité & sécurité'),
      body: (
        <Card>
          <div className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">{tr('Mot de passe')}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{tr('Modifier votre mot de passe')}</p>
              </div>
              <button onClick={() => setShowPasswordModal(true)} className="text-xs font-bold text-primary hover:text-primary/80 transition-colors">{tr('Modifier')}</button>
            </div>
            <PasskeysSection />
            <SecuritySection />
            <KycSection />
          </div>
        </Card>
      ),
    },
    rewards: { title: tr('Parrainage & codes promo'), body: <Card><RewardsSection /></Card> },
  }

  const menu: Array<{ key: Section; label: string; Icon: typeof User }> = [
    { key: 'personal', label: tr('Informations personnelles'), Icon: User },
    { key: 'appearance', label: tr('Apparence'), Icon: Palette },
    { key: 'notifications', label: tr('Notifications'), Icon: Bell },
    { key: 'security', label: tr('Confidentialité & sécurité'), Icon: Lock },
    { key: 'rewards', label: tr('Parrainage & fidélité'), Icon: Gift },
  ]
  const links: Array<{ to: string; label: string; Icon: typeof User }> = [
    { to: '/reseller', label: tr('Espace revendeur'), Icon: Store },
    { to: '/wishlist', label: tr('Mes favoris'), Icon: Heart },
    { to: '/activity-log', label: tr('Journal d\'activité'), Icon: Activity },
    { to: '/billing', label: tr('Facturation'), Icon: CreditCard },
    { to: '/terms', label: tr('Conditions générales'), Icon: FileText },
    { to: '/support', label: tr('Support & Aide'), Icon: HelpCircle },
  ]

  return (
    <div className="min-h-full bg-[#F4F5F7]">
      {active ? (
        <div className="px-4 pb-6 pt-4 space-y-3">
          <div className="flex items-center gap-3">
            <button onClick={() => setSearchParams({}, { replace: false })} aria-label={tr('Retour')} className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h1 className="text-lg font-bold tracking-tight">{sections[active].title}</h1>
          </div>
          {sections[active].body}
        </div>
      ) : (
        <div className="px-4 pb-6 pt-5 space-y-4">
          {/* Identity */}
          <div className="flex flex-col items-center text-center">
            <button onClick={() => { setSearchParams({ section: 'personal' }) }} aria-label={tr('Informations personnelles')} className="relative">
              <Avatar className="shadow-md" style={{ height: '5.5rem', width: '5.5rem' }}>
                <AvatarImage src={profile?.avatar_url || ''} />
                <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">{initials}</AvatarFallback>
              </Avatar>
            </button>
            <h1 className="mt-3 text-lg font-bold tracking-tight">{profile?.full_name || user?.email}</h1>
            {verified && (
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-700">
                <Check className="h-3.5 w-3.5" aria-hidden="true" />{tr('Vérifié')}
              </span>
            )}
          </div>

          {isAdmin && (
            <Link to="/admin" className="flex items-center gap-3 rounded-2xl bg-primary p-4 text-white shadow-md hover:bg-primary/90 transition-colors">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15"><LayoutDashboard className="h-5 w-5" /></div>
              <div className="flex-1">
                <p className="text-sm font-bold">{tr('Tableau de bord')}</p>
                <p className="mt-0.5 text-xs text-white/70">{tr('Gérer les commandes, devis & clients')}</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-white/60" />
            </Link>
          )}

          <div className="overflow-hidden rounded-2xl bg-white border border-gray-100 shadow-sm divide-y divide-border/50">
            {menu.map(({ key, label, Icon }) => (
              <button key={key} onClick={() => setSearchParams({ section: key })} className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-muted/20 transition-colors">
                <IconBubble Icon={Icon} />
                <span className="flex-1 text-sm font-medium">{label}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>

          <div className="overflow-hidden rounded-2xl bg-white border border-gray-100 shadow-sm divide-y divide-border/50">
            {links.map(({ to, label, Icon }) => (
              <Link key={to} to={to} className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/20 transition-colors">
                <IconBubble Icon={Icon} />
                <span className="flex-1 text-sm font-medium">{label}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </div>

          <button onClick={() => signOut()} className="flex w-full items-center gap-3 rounded-2xl border border-destructive/20 bg-white px-5 py-3.5 shadow-sm transition-colors hover:bg-destructive/5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-destructive/10"><LogOut className="h-4 w-4 text-destructive" aria-hidden="true" /></span>
            <span className="text-sm font-bold text-destructive">{tr('Se déconnecter')}</span>
          </button>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarChange} />
      <PasswordModal open={showPasswordModal} onClose={() => setShowPasswordModal(false)} />
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">{children}</div>
}

function IconBubble({ Icon }: { Icon: typeof User }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
      <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
    </span>
  )
}

/* ─── Personal Info inline form ─── */
function PersonalInfoForm({
  avatarUploading,
  onAvatarUpload,
  onAvatarRemove,
}: {
  avatarUploading: boolean
  onAvatarUpload: () => void
  onAvatarRemove: () => void
}) {
  const { profile, user, refreshProfile } = useAuth()
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [phone, setPhone] = useState(profile?.phone?.replace(/^\+509\s?/, '') || '')
  const [saving, setSaving] = useState(false)

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U'

  const firstName = fullName.split(' ')[0] || ''
  const lastName = fullName.split(' ').slice(1).join(' ') || ''

  async function handleSave() {
    if (!user) return
    setSaving(true)
    const combinedName = [firstName, lastName].filter(Boolean).join(' ')
    const { error } = await supabase.from('profiles').update({
      full_name: combinedName || fullName,
      phone: phone ? `+509 ${phone}` : null,
      updated_at: new Date().toISOString(),
    }).eq('user_id', user.id)
    if (error) toast.error(tr('Erreur lors de la mise à jour.'))
    else { await refreshProfile(); toast.success(tr('Profil mis à jour.')) }
    setSaving(false)
  }

  return (
    <div className="p-5 space-y-5">
      {/* Avatar */}
      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          <Avatar className="h-18 w-18 ring-4 ring-white shadow-md" style={{ height: '4.5rem', width: '4.5rem' }}>
            <AvatarImage src={profile?.avatar_url || ''} />
            <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">{initials}</AvatarFallback>
          </Avatar>
          {avatarUploading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
              <Loader2 className="h-5 w-5 text-white animate-spin" />
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onAvatarUpload}
            disabled={avatarUploading}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #F05A28, #D44E21)' }}
          >
            <Upload className="h-3.5 w-3.5" />
            {tr('Changer la photo')}
          </button>
          <button
            onClick={onAvatarRemove}
            disabled={avatarUploading || !profile?.avatar_url}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted/30 transition-colors disabled:opacity-40"
          >
            {tr('Supprimer')}
          </button>
        </div>
      </div>

      {/* Name fields */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{tr('Prénom')}</Label>
          <Input
            value={firstName}
            onChange={(e) => setFullName(`${e.target.value} ${lastName}`.trim())}
            placeholder={tr('Jean')}
            className="h-11 rounded-xl bg-[#F0F1F5] border-0 font-medium focus-visible:ring-1 focus-visible:ring-primary/40"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{tr('Nom')}</Label>
          <Input
            value={lastName}
            onChange={(e) => setFullName(`${firstName} ${e.target.value}`.trim())}
            placeholder={tr('Pierre')}
            className="h-11 rounded-xl bg-[#F0F1F5] border-0 font-medium focus-visible:ring-1 focus-visible:ring-primary/40"
          />
        </div>
      </div>

      {/* Email */}
      <div className="space-y-1.5">
        <Label htmlFor="profile-email" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{tr('Adresse email')}</Label>
        <Input
          id="profile-email"
          value={user?.email || ''}
          disabled
          className="h-11 rounded-xl bg-[#F0F1F5] border-0 font-medium opacity-60"
        />
      </div>

      {/* Phone */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{tr('Téléphone')}</Label>
        <div className="flex gap-2">
          <div className="flex h-11 items-center px-3 rounded-xl bg-[#F0F1F5] text-sm font-semibold text-muted-foreground shrink-0 select-none">
            <Flag code="HT" className="mr-1.5" /> +509
          </div>
          <Input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="XXXX-XXXX"
            className="h-11 rounded-xl bg-[#F0F1F5] border-0 font-medium focus-visible:ring-1 focus-visible:ring-primary/40 flex-1"
          />
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end pt-1">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #F05A28, #D44E21)' }}
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {tr('Enregistrer')}
        </button>
      </div>
    </div>
  )
}

/* ─── Preferences (inline) ─── */
function PreferencesSection() {
  const [push, setPush] = useState(true)
  const [email, setEmail] = useState(true)
  const [sms, setSms] = useState(false)

  return (
    <div className="divide-y divide-border/50">
      {[
        { label: tr('Notifications push'), desc: tr('Alertes en temps réel sur l\'application'), value: push, set: setPush },
        { label: tr('Notifications email'), desc: tr('Mises à jour par email'), value: email, set: setEmail },
        { label: tr('Notifications SMS'), desc: tr('Alertes par SMS (optionnel)'), value: sms, set: setSms },
      ].map((item) => (
        <div key={item.label} className="flex items-center justify-between gap-3 px-5 py-3.5">
          <div>
            <p className="text-sm font-medium text-foreground">{item.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
          </div>
          <Switch checked={item.value} onCheckedChange={item.set} aria-label={item.label} className="shrink-0" />
        </div>
      ))}
    </div>
  )
}

/* ─── Password modal ─── */
function PasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNext, setShowNext] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (next.length < 8) { toast.error(tr('Le mot de passe doit avoir au moins 8 caractères.')); return }
    if (next !== confirm) { toast.error(tr('Les mots de passe ne correspondent pas.')); return }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password: next })
    if (error) toast.error(error.message || tr('Erreur lors du changement de mot de passe.'))
    else { toast.success(tr('Mot de passe mis à jour.')); setCurrent(''); setNext(''); setConfirm(''); onClose() }
    setSaving(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>{tr('Changer le mot de passe')}</DialogTitle>
          <DialogDescription>{tr('Créez un nouveau mot de passe sécurisé')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-sm font-bold">{tr('Mot de passe actuel')}</Label>
            <div className="relative">
              <Input type={showCurrent ? 'text' : 'password'} value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="••••••••" className="h-11 rounded-xl bg-[#F0F1F5] border-0 pr-11 focus-visible:ring-1 focus-visible:ring-primary/40" />
              <button type="button" onClick={() => setShowCurrent(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-bold">{tr('Nouveau mot de passe')}</Label>
            <div className="relative">
              <Input type={showNext ? 'text' : 'password'} value={next} onChange={(e) => setNext(e.target.value)} placeholder={tr('Min. 8 caractères')} className="h-11 rounded-xl bg-[#F0F1F5] border-0 pr-11 focus-visible:ring-1 focus-visible:ring-primary/40" />
              <button type="button" onClick={() => setShowNext(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showNext ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {next.length > 0 && (
              <div className="flex gap-1 mt-1">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className={cn('h-1 flex-1 rounded-full transition-colors', next.length >= (i + 1) * 2 ? i < 1 ? 'bg-destructive' : i < 2 ? 'bg-amber-400' : i < 3 ? 'bg-primary/70' : 'bg-emerald-500' : 'bg-muted')} />
                ))}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-bold">{tr('Confirmer le mot de passe')}</Label>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" className={cn('h-11 rounded-xl bg-[#F0F1F5] border-0 focus-visible:ring-1', confirm && confirm !== next ? 'ring-1 ring-destructive/30 focus-visible:ring-destructive/40' : 'focus-visible:ring-primary/40')} />
            {confirm && confirm !== next && <p className="text-xs text-destructive">{tr('Les mots de passe ne correspondent pas')}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-xl">{tr('Annuler')}</Button>
          <Button onClick={handleSave} disabled={saving || !next || next !== confirm} className="rounded-xl">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{tr('Mettre à jour')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
