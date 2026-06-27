import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { User, Bell, Lock, Settings, LogOut, ChevronRight, ShieldCheck, MapPin, HelpCircle, Loader2, CheckCircle2, LayoutDashboard } from 'lucide-react'
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
  const { profile, user, signOut, isAdmin } = useAuth()
  const [editOpen, setEditOpen] = useState(false)
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [phone, setPhone] = useState(profile?.phone || '')
  const [saving, setSaving] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U'

  async function handleSave() {
    if (!user) return
    setSaving(true)
    const { error } = await supabase.from('profiles').update({ full_name: fullName, phone: phone || null, updated_at: new Date().toISOString() }).eq('user_id', user.id)
    if (error) toast.error('Erreur lors de la mise à jour.')
    else toast.success('Profil mis à jour.')
    setSaving(false)
    setEditOpen(false)
  }

  const sections: { title: string; rows: SettingRow[] }[] = [
    {
      title: 'Compte',
      rows: [
        { icon: User, label: 'Détails personnels', iconBg: 'bg-primary/10', iconColor: 'text-primary', action: () => setEditOpen(true) },
        { icon: MapPin, label: 'Adresses de livraison', iconBg: 'bg-accent/10', iconColor: 'text-accent', href: '/profile' },
        { icon: Bell, label: 'Notifications', iconBg: 'bg-warning/10', iconColor: 'text-warning', href: '/notifications' },
      ],
    },
    {
      title: 'Sécurité',
      rows: [
        { icon: Lock, label: 'Mot de passe', iconBg: 'bg-destructive/10', iconColor: 'text-destructive', href: '/profile' },
        { icon: ShieldCheck, label: 'Confidentialité', iconBg: 'bg-success/10', iconColor: 'text-success', href: '/profile' },
      ],
    },
    {
      title: 'Général',
      rows: [
        { icon: Settings, label: 'Paramètres', iconBg: 'bg-muted', iconColor: 'text-muted-foreground', href: '/profile' },
        { icon: HelpCircle, label: 'Support & Aide', iconBg: 'bg-muted', iconColor: 'text-muted-foreground', href: '/support' },
      ],
    },
  ]

  return (
    <div className="min-h-full bg-background">
      {/* Profile header */}
      <div className="bg-card border-b border-border px-5 pt-6 pb-6 text-center">
        <div className="relative inline-block">
          <Avatar className="h-20 w-20 ring-4 ring-border">
            <AvatarImage src={profile?.avatar_url || ''} />
            <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
        </div>
        <h1 className="text-xl font-bold mt-3">{profile?.full_name || 'Utilisateur'}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{user?.email}</p>
        <div className="flex items-center justify-center gap-2 mt-3">
          <Badge variant="secondary" className="rounded-full px-3 gap-1.5">
            <CheckCircle2 className="h-3 w-3 text-success" />
            <span className="text-xs">
              {profile?.role === 'admin' ? 'Administrateur' : profile?.role === 'agent' ? 'Agent' : 'Client vérifié'}
            </span>
          </Badge>
        </div>
      </div>

      {/* Admin dashboard shortcut */}
      {isAdmin && (
        <div className="px-4 pt-4">
          <Link to="/admin">
            <div className="flex items-center gap-3 rounded-2xl p-4 bg-primary text-primary-foreground shadow-md hover:bg-primary/90 transition-colors active:scale-[0.98]">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 shrink-0">
                <LayoutDashboard className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm">Dashboard Admin</p>
                <p className="text-xs text-primary-foreground/70 mt-0.5">Gérer commandes, devis & utilisateurs</p>
              </div>
              <ChevronRight className="h-4 w-4 text-primary-foreground/60 shrink-0" />
            </div>
          </Link>
        </div>
      )}

      {/* Settings sections */}
      <div className="px-4 py-5 space-y-4">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-2">{section.title}</p>
            <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden divide-y divide-border">
              {section.rows.map((row) => {
                const Icon = row.icon

                const content = (
                  <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors cursor-pointer">
                    <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl shrink-0', row.iconBg)}>
                      <Icon className={cn('h-4 w-4', row.iconColor)} />
                    </div>
                    <span className="flex-1 text-sm font-medium">{row.label}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                )

                if (row.href) {
                  return <Link key={row.label} to={row.href}>{content}</Link>
                }
                return (
                  <div key={row.label} onClick={row.action}>
                    {content}
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {/* Logout */}
        <button
          onClick={() => setLogoutOpen(true)}
          className="w-full rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3.5 flex items-center gap-3 hover:bg-destructive/10 transition-colors"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-destructive/10 shrink-0">
            <LogOut className="h-4 w-4 text-destructive" />
          </div>
          <span className="text-sm font-semibold text-destructive">Déconnexion</span>
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
