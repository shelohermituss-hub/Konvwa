import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { User, Bell, Lock, Settings, LogOut, ChevronRight, ShieldCheck, MapPin, HelpCircle, Loader2, BadgeCheck, LayoutDashboard, Camera } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface SettingRow {
  icon: typeof User
  label: string
  iconBg: string
  iconColor: string
  action?: () => void
  href?: string
}

export function ProfilePage() {
  const { profile, user, signOut, isAdmin, refreshProfile } = useAuth()
  const [editOpen, setEditOpen] = useState(false)
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [phone, setPhone] = useState(profile?.phone || '')
  const [saving, setSaving] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U'

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image trop lourde (max 5 Mo).')
      return
    }

    setAvatarUploading(true)
    try {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${user.id}/avatar.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(path)

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: `${publicUrl}?t=${Date.now()}`, updated_at: new Date().toISOString() })
        .eq('user_id', user.id)

      if (updateError) throw updateError

      await refreshProfile()
      toast.success('Photo de profil mise à jour.')
    } catch {
      toast.error('Erreur lors de l\'upload de la photo.')
    } finally {
      setAvatarUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleSave() {
    if (!user) return
    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName, phone: phone || null, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
    if (error) toast.error('Erreur lors de la mise à jour.')
    else {
      await refreshProfile()
      toast.success('Profil mis à jour.')
    }
    setSaving(false)
    setEditOpen(false)
  }

  const roleLabel =
    profile?.role === 'admin' ? 'Administrateur' :
    profile?.role === 'agent' ? 'Agent' :
    'Client vérifié'

  const sections: { title: string; rows: SettingRow[] }[] = [
    {
      title: 'Compte',
      rows: [
        { icon: User,   label: 'Détails personnels',    iconBg: 'bg-[#FFF0EB]', iconColor: 'text-primary',    action: () => setEditOpen(true) },
        { icon: MapPin, label: 'Adresses de livraison', iconBg: 'bg-[#EBF3FF]', iconColor: 'text-[#2563EB]',  href: '/profile' },
        { icon: Bell,   label: 'Notifications',         iconBg: 'bg-[#FFFBEB]', iconColor: 'text-[#F59E0B]',  href: '/notifications' },
      ],
    },
    {
      title: 'Sécurité',
      rows: [
        { icon: Lock,        label: 'Mot de passe',    iconBg: 'bg-[#FFF1F2]', iconColor: 'text-[#E11D48]',  href: '/profile' },
        { icon: ShieldCheck, label: 'Confidentialité', iconBg: 'bg-[#F0FDF4]', iconColor: 'text-[#16A34A]',  href: '/profile' },
      ],
    },
    {
      title: 'Général',
      rows: [
        { icon: Settings,   label: 'Paramètres',   iconBg: 'bg-muted', iconColor: 'text-muted-foreground', href: '/profile' },
        { icon: HelpCircle, label: 'Support & Aide', iconBg: 'bg-muted', iconColor: 'text-muted-foreground', href: '/support' },
      ],
    },
  ]

  return (
    <div className="min-h-full bg-background">

      {/* Profile header */}
      <div className="bg-white border-b border-border/60 px-5 pt-8 pb-7 text-center shadow-sm stagger-item">
        {/* Avatar with upload */}
        <div className="relative inline-block">
          <button
            className="relative block rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            onClick={() => fileInputRef.current?.click()}
            disabled={avatarUploading}
            aria-label="Changer la photo de profil"
          >
            <Avatar className="h-24 w-24 ring-4 ring-white shadow-lg">
              <AvatarImage src={profile?.avatar_url || ''} />
              <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            {/* Hover overlay */}
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 hover:opacity-100 transition-opacity">
              {avatarUploading
                ? <Loader2 className="h-6 w-6 text-white animate-spin" />
                : <Camera className="h-6 w-6 text-white" />}
            </div>
          </button>
          {/* Camera badge */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={avatarUploading}
            className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-primary border-2 border-white shadow-md hover:bg-primary/90 transition-colors"
            aria-label="Modifier la photo"
          >
            {avatarUploading
              ? <Loader2 className="h-3.5 w-3.5 text-white animate-spin" />
              : <Camera className="h-3.5 w-3.5 text-white" />}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleAvatarChange}
          />
          {/* Online dot */}
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
        <div className="px-4 pt-4 stagger-item" style={{ animationDelay: '60ms' }}>
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
      <div className="px-4 py-5 space-y-4 stagger-item" style={{ animationDelay: '100ms' }}>
        {sections.map((section) => (
          <div key={section.title}>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70 px-1 mb-2">{section.title}</p>
            <div className="rounded-2xl bg-white border border-border/60 shadow-sm overflow-hidden divide-y divide-border/60">
              {section.rows.map((row) => {
                const Icon = row.icon
                const content = (
                  <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors cursor-pointer active:bg-muted/50">
                    <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl shrink-0', row.iconBg)}>
                      <Icon className={cn('h-4 w-4', row.iconColor)} />
                    </div>
                    <span className="flex-1 text-sm font-medium text-foreground">{row.label}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                  </div>
                )
                if (row.href) return <Link key={row.label} to={row.href}>{content}</Link>
                return <div key={row.label} onClick={row.action}>{content}</div>
              })}
            </div>
          </div>
        ))}

        {/* Logout */}
        <button
          onClick={() => setLogoutOpen(true)}
          className="w-full rounded-2xl bg-white border border-destructive/20 px-4 py-3.5 flex items-center gap-3 hover:bg-destructive/5 transition-colors pressable shadow-sm"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFF1F2] shrink-0">
            <LogOut className="h-4 w-4 text-destructive" />
          </div>
          <span className="text-sm font-bold text-destructive">Déconnexion</span>
        </button>
      </div>

      {/* Edit Profile Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Détails personnels</DialogTitle>
            <DialogDescription>Modifiez vos informations de profil</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nom complet</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user?.email || ''} disabled className="rounded-xl opacity-60" />
            </div>
            <div className="space-y-2">
              <Label>Téléphone</Label>
              <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+509 XXXX-XXXX" className="rounded-xl" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} className="rounded-xl">Annuler</Button>
            <Button onClick={handleSave} disabled={saving} className="rounded-xl">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Logout Confirm Dialog */}
      <Dialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Déconnexion</DialogTitle>
            <DialogDescription>Êtes-vous sûr de vouloir vous déconnecter ?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogoutOpen(false)} className="rounded-xl">Annuler</Button>
            <Button variant="destructive" onClick={signOut} className="rounded-xl">
              <LogOut className="mr-2 h-4 w-4" />
              Déconnexion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
