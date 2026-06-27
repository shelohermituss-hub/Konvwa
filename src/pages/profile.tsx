import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  ChevronRight, Loader2, BadgeCheck, LayoutDashboard, Camera, Eye, EyeOff, Plus, Trash2, MapPin,
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

import IconPersonnel       from '@/assets/icons/profil-personnel.png'
import IconAdresse         from '@/assets/icons/profil-adresse.png'
import IconNotif           from '@/assets/icons/profil-notif.png'
import IconMdp             from '@/assets/icons/profil-mdp.png'
import IconConfidentialite from '@/assets/icons/profil-confidentialite.png'
import IconParametres      from '@/assets/icons/profil-parametres.png'
import IconSupport         from '@/assets/icons/profil-support.png'
import IconDeconnexion     from '@/assets/icons/profil-deconnexion.png'

/* ─── Types ─── */
type Modal = 'none' | 'personal' | 'address' | 'password' | 'privacy' | 'settings' | 'logout'

interface ProfileRow {
  imgSrc: string
  label: string
  onClick?: () => void
  href?: string
}

interface AddressEntry {
  id: string
  label: string
  address: string
  phone: string
  default: boolean
}

/* ─── Main component ─── */
export function ProfilePage() {
  const { profile, user, signOut, isAdmin, refreshProfile } = useAuth()
  const [modal, setModal] = useState<Modal>('none')
  const [avatarUploading, setAvatarUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U'

  const roleLabel =
    profile?.role === 'admin' ? 'Administrateur' :
    profile?.role === 'agent' ? 'Agent' :
    'Client vérifié'

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Image trop lourde (max 5 Mo).'); return }
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
      toast.success('Photo de profil mise à jour.')
    } catch { toast.error("Erreur lors de l'upload de la photo.") }
    finally { setAvatarUploading(false); if (fileInputRef.current) fileInputRef.current.value = '' }
  }

  const sections: { title: string; rows: ProfileRow[] }[] = [
    {
      title: 'Compte',
      rows: [
        { imgSrc: IconPersonnel, label: 'Détails personnels',    onClick: () => setModal('personal') },
        { imgSrc: IconAdresse,   label: 'Adresses de livraison', onClick: () => setModal('address') },
        { imgSrc: IconNotif,     label: 'Notifications',         href: '/notifications' },
      ],
    },
    {
      title: 'Sécurité',
      rows: [
        { imgSrc: IconMdp,             label: 'Mot de passe',    onClick: () => setModal('password') },
        { imgSrc: IconConfidentialite, label: 'Confidentialité', onClick: () => setModal('privacy') },
      ],
    },
    {
      title: 'Général',
      rows: [
        { imgSrc: IconParametres, label: 'Paramètres',    onClick: () => setModal('settings') },
        { imgSrc: IconSupport,    label: 'Support & Aide', href: '/support' },
      ],
    },
  ]

  return (
    <div className="min-h-full bg-[#F4F5F7]">

      {/* Profile header */}
      <div className="bg-white px-5 pt-8 pb-7 text-center shadow-sm">
        <div className="relative inline-block">
          <button
            className="relative block rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            onClick={() => fileInputRef.current?.click()}
            disabled={avatarUploading}
          >
            <Avatar className="h-24 w-24 ring-4 ring-white shadow-lg">
              <AvatarImage src={profile?.avatar_url || ''} />
              <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">{initials}</AvatarFallback>
            </Avatar>
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 hover:opacity-100 transition-opacity">
              {avatarUploading ? <Loader2 className="h-6 w-6 text-white animate-spin" /> : <Camera className="h-6 w-6 text-white" />}
            </div>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={avatarUploading}
            className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-primary border-2 border-white shadow-md hover:bg-primary/90 transition-colors"
          >
            {avatarUploading ? <Loader2 className="h-3.5 w-3.5 text-white animate-spin" /> : <Camera className="h-3.5 w-3.5 text-white" />}
          </button>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarChange} />
          <div className="absolute top-1 left-1 h-4 w-4 rounded-full bg-emerald-500 ring-2 ring-white" />
        </div>

        <h1 className="text-xl font-bold mt-4 text-foreground">{profile?.full_name || 'Utilisateur'}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{user?.email}</p>
        <div className="flex items-center justify-center mt-3">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-3.5 py-1.5">
            <BadgeCheck className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold text-primary">{roleLabel}</span>
          </div>
        </div>
      </div>

      {/* Admin shortcut */}
      {isAdmin && (
        <div className="px-4 pt-4">
          <Link to="/admin">
            <div className="flex items-center gap-3 rounded-2xl p-4 bg-primary text-white shadow-md hover:bg-primary/90 transition-colors pressable">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 shrink-0">
                <LayoutDashboard className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-sm">Dashboard Admin</p>
                <p className="text-xs text-white/70 mt-0.5">Gérer commandes, devis & utilisateurs</p>
              </div>
              <ChevronRight className="h-4 w-4 text-white/60 shrink-0" />
            </div>
          </Link>
        </div>
      )}

      {/* Settings sections */}
      <div className="px-4 py-5 space-y-4">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70 px-1 mb-2">{section.title}</p>
            <div className="rounded-2xl bg-white border border-border/60 shadow-sm overflow-hidden divide-y divide-border/60">
              {section.rows.map((row) => {
                const content = (
                  <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors cursor-pointer active:bg-muted/50">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0 bg-muted/30">
                      <img src={row.imgSrc} alt="" className="h-7 w-7 object-contain" />
                    </div>
                    <span className="flex-1 text-sm font-medium text-foreground">{row.label}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                  </div>
                )
                if (row.href) return <Link key={row.label} to={row.href}>{content}</Link>
                return <div key={row.label} onClick={row.onClick}>{content}</div>
              })}
            </div>
          </div>
        ))}

        {/* Logout */}
        <button
          onClick={() => setModal('logout')}
          className="w-full rounded-2xl bg-white border border-destructive/20 px-4 py-3.5 flex items-center gap-3 hover:bg-destructive/5 transition-colors pressable shadow-sm"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/30 shrink-0">
            <img src={IconDeconnexion} alt="" className="h-7 w-7 object-contain" />
          </div>
          <span className="text-sm font-bold text-destructive">Déconnexion</span>
        </button>
      </div>

      {/* ── Modals ── */}
      <PersonalModal open={modal === 'personal'} onClose={() => setModal('none')} />
      <AddressModal  open={modal === 'address'}  onClose={() => setModal('none')} />
      <PasswordModal open={modal === 'password'} onClose={() => setModal('none')} />
      <PrivacyModal  open={modal === 'privacy'}  onClose={() => setModal('none')} />
      <SettingsModal open={modal === 'settings'} onClose={() => setModal('none')} />

      {/* Logout confirm */}
      <Dialog open={modal === 'logout'} onOpenChange={(o) => !o && setModal('none')}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Déconnexion</DialogTitle>
            <DialogDescription>Êtes-vous sûr de vouloir vous déconnecter ?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal('none')} className="rounded-xl">Annuler</Button>
            <Button variant="destructive" onClick={signOut} className="rounded-xl">
              <LogOut className="mr-2 h-4 w-4" />Déconnexion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ─── Détails personnels ─── */
function PersonalModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile, user, refreshProfile } = useAuth()
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [phone, setPhone] = useState(profile?.phone || '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!user) return
    setSaving(true)
    const { error } = await supabase.from('profiles').update({ full_name: fullName, phone: phone || null, updated_at: new Date().toISOString() }).eq('user_id', user.id)
    if (error) toast.error('Erreur lors de la mise à jour.')
    else { await refreshProfile(); toast.success('Profil mis à jour.'); onClose() }
    setSaving(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>Détails personnels</DialogTitle>
          <DialogDescription>Modifiez vos informations de profil</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-sm font-bold">Nom complet</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-12 rounded-2xl bg-[#F0F1F5] border-0 focus-visible:ring-1 focus-visible:ring-primary/40" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-bold">Email</Label>
            <Input value={user?.email || ''} disabled className="h-12 rounded-2xl bg-[#F0F1F5] border-0 opacity-60" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-bold">Téléphone</Label>
            <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+509 XXXX-XXXX" className="h-12 rounded-2xl bg-[#F0F1F5] border-0 focus-visible:ring-1 focus-visible:ring-primary/40" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-xl">Annuler</Button>
          <Button onClick={handleSave} disabled={saving} className="rounded-xl">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ─── Adresses de livraison ─── */
function AddressModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth()
  const [addresses, setAddresses] = useState<AddressEntry[]>([])
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [label, setLabel] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')

  async function load() {
    if (!user) return
    const { data } = await supabase.from('delivery_addresses').select('*').eq('user_id', user.id).order('created_at')
    if (data) setAddresses(data as AddressEntry[])
  }

  function handleOpen(o: boolean) {
    if (o) load()
    else onClose()
  }

  async function handleAdd() {
    if (!user || !address.trim()) return
    setSaving(true)
    const { error } = await supabase.from('delivery_addresses').insert({ user_id: user.id, label: label || 'Domicile', address, phone: phone || null, default: addresses.length === 0 })
    if (error) toast.error("Erreur lors de l'ajout de l'adresse.")
    else { toast.success('Adresse ajoutée.'); setLabel(''); setAddress(''); setPhone(''); setAdding(false); load() }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    await supabase.from('delivery_addresses').delete().eq('id', id)
    setAddresses(prev => prev.filter(a => a.id !== id))
    toast.success('Adresse supprimée.')
  }

  async function handleSetDefault(id: string) {
    if (!user) return
    await supabase.from('delivery_addresses').update({ default: false }).eq('user_id', user.id)
    await supabase.from('delivery_addresses').update({ default: true }).eq('id', id)
    load()
    toast.success('Adresse principale mise à jour.')
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="rounded-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adresses de livraison</DialogTitle>
          <DialogDescription>Gérez vos adresses de livraison en Haïti</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {addresses.length === 0 && !adding && (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center">
              <MapPin className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground font-medium">Aucune adresse enregistrée</p>
            </div>
          )}

          {addresses.map((a) => (
            <div key={a.id} className={cn('rounded-2xl border p-3.5 flex gap-3', a.default ? 'border-primary/30 bg-primary/4' : 'border-border bg-muted/20')}>
              <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl shrink-0', a.default ? 'bg-primary/10' : 'bg-muted')}>
                <MapPin className={cn('h-4 w-4', a.default ? 'text-primary' : 'text-muted-foreground')} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm">{a.label}</p>
                  {a.default && <span className="rounded-full bg-primary/15 text-primary text-[9px] font-bold px-2 py-0.5">Principal</span>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{a.address}</p>
                {a.phone && <p className="text-xs text-muted-foreground/70 mt-0.5">{a.phone}</p>}
                {!a.default && (
                  <button onClick={() => handleSetDefault(a.id)} className="text-[11px] text-primary font-semibold mt-1.5">
                    Définir par défaut
                  </button>
                )}
              </div>
              <button onClick={() => handleDelete(a.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          {adding ? (
            <div className="rounded-2xl border border-border bg-white p-4 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Libellé</Label>
                <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Domicile, Bureau…" className="h-11 rounded-xl bg-[#F0F1F5] border-0 focus-visible:ring-1 focus-visible:ring-primary/40" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Adresse complète</Label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Rue, Ville, Département" className="h-11 rounded-xl bg-[#F0F1F5] border-0 focus-visible:ring-1 focus-visible:ring-primary/40" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Téléphone de contact</Label>
                <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+509 XXXX-XXXX" className="h-11 rounded-xl bg-[#F0F1F5] border-0 focus-visible:ring-1 focus-visible:ring-primary/40" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setAdding(false)} className="flex-1 rounded-xl">Annuler</Button>
                <Button onClick={handleAdd} disabled={saving || !address.trim()} className="flex-1 rounded-xl">
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Ajouter
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/30 py-3.5 text-sm font-semibold text-primary hover:border-primary/50 hover:bg-primary/4 transition-colors"
            >
              <Plus className="h-4 w-4" />Ajouter une adresse
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ─── Mot de passe ─── */
function PasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNext, setShowNext] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (next.length < 8) { toast.error('Le mot de passe doit contenir au moins 8 caractères.'); return }
    if (next !== confirm) { toast.error('Les mots de passe ne correspondent pas.'); return }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password: next })
    if (error) toast.error(error.message || 'Erreur lors du changement de mot de passe.')
    else { toast.success('Mot de passe mis à jour avec succès.'); setCurrent(''); setNext(''); setConfirm(''); onClose() }
    setSaving(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>Changer le mot de passe</DialogTitle>
          <DialogDescription>Créez un nouveau mot de passe sécurisé</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-sm font-bold">Mot de passe actuel</Label>
            <div className="relative">
              <Input type={showCurrent ? 'text' : 'password'} value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="••••••••" className="h-12 rounded-2xl bg-[#F0F1F5] border-0 pr-11 focus-visible:ring-1 focus-visible:ring-primary/40" />
              <button type="button" onClick={() => setShowCurrent(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-bold">Nouveau mot de passe</Label>
            <div className="relative">
              <Input type={showNext ? 'text' : 'password'} value={next} onChange={(e) => setNext(e.target.value)} placeholder="Min. 8 caractères" className="h-12 rounded-2xl bg-[#F0F1F5] border-0 pr-11 focus-visible:ring-1 focus-visible:ring-primary/40" />
              <button type="button" onClick={() => setShowNext(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                {showNext ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {next.length > 0 && (
              <div className="flex gap-1 mt-1">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className={cn('h-1 flex-1 rounded-full transition-colors', next.length >= (i + 1) * 2 ? i < 1 ? 'bg-destructive' : i < 2 ? 'bg-warning' : i < 3 ? 'bg-primary/70' : 'bg-emerald-500' : 'bg-muted')} />
                ))}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-bold">Confirmer le mot de passe</Label>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" className={cn('h-12 rounded-2xl bg-[#F0F1F5] border-0 focus-visible:ring-1', confirm && confirm !== next ? 'focus-visible:ring-destructive/40 ring-1 ring-destructive/30' : 'focus-visible:ring-primary/40')} />
            {confirm && confirm !== next && <p className="text-xs text-destructive">Les mots de passe ne correspondent pas</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-xl">Annuler</Button>
          <Button onClick={handleSave} disabled={saving || !next || next !== confirm} className="rounded-xl">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Changer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ─── Confidentialité ─── */
function PrivacyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [dataSharing, setDataSharing] = useState(false)
  const [analytics, setAnalytics] = useState(true)
  const [marketing, setMarketing] = useState(false)

  function handleSave() {
    toast.success('Préférences de confidentialité enregistrées.')
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>Confidentialité</DialogTitle>
          <DialogDescription>Contrôlez l'utilisation de vos données personnelles</DialogDescription>
        </DialogHeader>
        <div className="space-y-1 py-2">
          {[
            { id: 'analytics', label: 'Analytique', desc: "Aider à améliorer l'application avec des données anonymes", value: analytics, set: setAnalytics },
            { id: 'marketing', label: 'Communications marketing', desc: 'Recevoir des offres et promotions par email', value: marketing, set: setMarketing },
            { id: 'sharing', label: 'Partage de données', desc: 'Partager des données avec nos partenaires logistiques', value: dataSharing, set: setDataSharing },
          ].map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-4 rounded-2xl p-4 hover:bg-muted/30 transition-colors">
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.desc}</p>
              </div>
              <Switch checked={item.value} onCheckedChange={item.set} className="mt-0.5 shrink-0" />
            </div>
          ))}

          <div className="rounded-2xl bg-muted/30 p-4 mt-2">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Vos données personnelles sont traitées conformément à notre politique de confidentialité. Elles ne sont jamais vendues à des tiers.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-xl">Annuler</Button>
          <Button onClick={handleSave} className="rounded-xl">Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ─── Paramètres ─── */
function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [pushNotif, setPushNotif] = useState(true)
  const [emailNotif, setEmailNotif] = useState(true)
  const [smsNotif, setSmsNotif] = useState(false)
  const [biometric, setBiometric] = useState(false)

  function handleSave() {
    toast.success('Paramètres enregistrés.')
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>Paramètres</DialogTitle>
          <DialogDescription>Personnalisez votre expérience KONVWA</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Notifications */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70 px-1 mb-2">Notifications</p>
            <div className="rounded-2xl border border-border/60 bg-white overflow-hidden divide-y divide-border/60">
              {[
                { label: 'Notifications push', desc: "Alertes en temps réel sur l'app", value: pushNotif, set: setPushNotif },
                { label: 'Notifications email', desc: 'Mises à jour par email', value: emailNotif, set: setEmailNotif },
                { label: 'Notifications SMS', desc: 'Alertes par SMS (optionnel)', value: smsNotif, set: setSmsNotif },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3 px-4 py-3.5">
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                  </div>
                  <Switch checked={item.value} onCheckedChange={item.set} className="shrink-0" />
                </div>
              ))}
            </div>
          </div>

          {/* Sécurité */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70 px-1 mb-2">Sécurité</p>
            <div className="rounded-2xl border border-border/60 bg-white overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                <div>
                  <p className="text-sm font-medium text-foreground">Authentification biométrique</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Face ID / empreinte digitale</p>
                </div>
                <Switch checked={biometric} onCheckedChange={setBiometric} className="shrink-0" />
              </div>
            </div>
          </div>

          {/* Version */}
          <div className="text-center pt-1">
            <p className="text-xs text-muted-foreground/50">KONVWA v1.0.0 · Haïti</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-xl">Annuler</Button>
          <Button onClick={handleSave} className="rounded-xl">Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
