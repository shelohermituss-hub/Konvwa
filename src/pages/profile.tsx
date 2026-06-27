import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Eye, EyeOff, Loader2, BadgeCheck, LayoutDashboard, ChevronRight,
  Plus, Trash2, MapPin, LogOut, Upload, User, Lock, Bell, Activity, CreditCard,
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface AddressEntry {
  id: string
  label: string
  address: string
  phone: string
  default: boolean
}

export function ProfilePage() {
  const { user, signOut, isAdmin, refreshProfile } = useAuth()
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  async function handleRemoveAvatar() {
    if (!user) return
    const { error } = await supabase.from('profiles').update({ avatar_url: null, updated_at: new Date().toISOString() }).eq('user_id', user.id)
    if (error) toast.error('Erreur lors de la suppression.')
    else { await refreshProfile(); toast.success('Photo supprimée.') }
  }

  return (
    <div className="min-h-full bg-[#F4F5F7]">
      <div className="px-5 pt-5 pb-4">
        <h1 className="text-2xl font-bold tracking-tight">My Profile</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your personal information and settings</p>
      </div>

      <div className="px-4 pb-6 space-y-4">

        {/* Admin shortcut */}
        {isAdmin && (
          <Link to="/admin">
            <div className="flex items-center gap-3 rounded-2xl p-4 bg-primary text-white shadow-md hover:bg-primary/90 transition-colors">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 shrink-0">
                <LayoutDashboard className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-sm">Admin Dashboard</p>
                <p className="text-xs text-white/70 mt-0.5">Manage orders, quotes & users</p>
              </div>
              <ChevronRight className="h-4 w-4 text-white/60 shrink-0" />
            </div>
          </Link>
        )}

        {/* Personal information */}
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border/50 flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm">Personal information</p>
              <p className="text-xs text-muted-foreground">Update your personal details</p>
            </div>
          </div>

          <PersonalInfoForm
            avatarUploading={avatarUploading}
            onAvatarUpload={() => fileInputRef.current?.click()}
            onAvatarRemove={handleRemoveAvatar}
          />
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarChange} />
        </div>

        {/* Address information */}
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border/50 flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50">
              <MapPin className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <p className="font-semibold text-sm">Address information</p>
              <p className="text-xs text-muted-foreground">Manage your delivery addresses</p>
            </div>
          </div>
          <AddressSection />
        </div>

        {/* Security */}
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border/50 flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50">
              <Lock className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <p className="font-semibold text-sm">Security</p>
              <p className="text-xs text-muted-foreground">Password and account security</p>
            </div>
          </div>
          <div className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Password</p>
                <p className="text-xs text-muted-foreground mt-0.5">Update your account password</p>
              </div>
              <button
                onClick={() => setShowPasswordModal(true)}
                className="text-xs font-bold text-primary hover:text-primary/80 transition-colors"
              >
                Change
              </button>
            </div>
          </div>
        </div>

        {/* Preferences */}
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border/50 flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50">
              <Bell className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <p className="font-semibold text-sm">Notifications</p>
              <p className="text-xs text-muted-foreground">Manage your alert preferences</p>
            </div>
          </div>
          <PreferencesSection />
        </div>

        {/* Quick links */}
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden divide-y divide-border/50">
          <Link to="/activity-log" className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/20 transition-colors">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted shrink-0">
              <Activity className="h-4 w-4 text-muted-foreground" />
            </div>
            <span className="flex-1 text-sm font-medium">Activity Log</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
          </Link>
          <Link to="/billing" className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/20 transition-colors">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted shrink-0">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </div>
            <span className="flex-1 text-sm font-medium">Billing</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
          </Link>
          <Link to="/support" className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/20 transition-colors">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted shrink-0">
              <BadgeCheck className="h-4 w-4 text-muted-foreground" />
            </div>
            <span className="flex-1 text-sm font-medium">Support & Help</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
          </Link>
        </div>

        {/* Logout */}
        <button
          onClick={() => signOut()}
          className="w-full rounded-2xl bg-white border border-destructive/20 px-5 py-4 flex items-center gap-3 hover:bg-destructive/5 transition-colors shadow-sm"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-destructive/8 shrink-0">
            <LogOut className="h-4 w-4 text-destructive" />
          </div>
          <span className="text-sm font-bold text-destructive">Sign Out</span>
        </button>
      </div>

      {/* Password modal */}
      <PasswordModal open={showPasswordModal} onClose={() => setShowPasswordModal(false)} />
    </div>
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
    if (error) toast.error('Erreur lors de la mise à jour.')
    else { await refreshProfile(); toast.success('Profile updated.') }
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
            Upload Image
          </button>
          <button
            onClick={onAvatarRemove}
            disabled={avatarUploading || !profile?.avatar_url}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted/30 transition-colors disabled:opacity-40"
          >
            Remove
          </button>
        </div>
      </div>

      {/* Name fields */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">First Name</Label>
          <Input
            value={firstName}
            onChange={(e) => setFullName(`${e.target.value} ${lastName}`.trim())}
            placeholder="Jean"
            className="h-11 rounded-xl bg-[#F0F1F5] border-0 font-medium focus-visible:ring-1 focus-visible:ring-primary/40"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Last Name</Label>
          <Input
            value={lastName}
            onChange={(e) => setFullName(`${firstName} ${e.target.value}`.trim())}
            placeholder="Pierre"
            className="h-11 rounded-xl bg-[#F0F1F5] border-0 font-medium focus-visible:ring-1 focus-visible:ring-primary/40"
          />
        </div>
      </div>

      {/* Email */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email</Label>
        <Input
          value={user?.email || ''}
          disabled
          className="h-11 rounded-xl bg-[#F0F1F5] border-0 font-medium opacity-60"
        />
      </div>

      {/* Phone */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Phone</Label>
        <div className="flex gap-2">
          <div className="flex h-11 items-center px-3 rounded-xl bg-[#F0F1F5] text-sm font-semibold text-muted-foreground shrink-0 select-none">
            🇭🇹 +509
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
          Save Changes
        </button>
      </div>
    </div>
  )
}

/* ─── Address section (inline) ─── */
function AddressSection() {
  const { user } = useAuth()
  const [addresses, setAddresses] = useState<AddressEntry[]>([])
  const [loaded, setLoaded] = useState(false)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [label, setLabel] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')

  async function load() {
    if (!user || loaded) return
    const { data } = await supabase.from('delivery_addresses').select('*').eq('user_id', user.id).order('created_at')
    if (data) setAddresses(data as AddressEntry[])
    setLoaded(true)
  }

  if (!loaded) load()

  async function handleAdd() {
    if (!user || !address.trim()) return
    setSaving(true)
    const { error } = await supabase.from('delivery_addresses').insert({
      user_id: user.id, label: label || 'Domicile', address, phone: phone || null, default: addresses.length === 0,
    })
    if (error) toast.error("Erreur lors de l'ajout.")
    else { toast.success('Adresse ajoutée.'); setLabel(''); setAddress(''); setPhone(''); setAdding(false); setLoaded(false) }
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
    setLoaded(false)
    toast.success('Adresse principale mise à jour.')
  }

  return (
    <div className="p-5 space-y-3">
      {addresses.map((a) => (
        <div key={a.id} className={cn('rounded-xl border p-3.5 flex gap-3', a.default ? 'border-primary/30 bg-primary/4' : 'border-border bg-muted/20')}>
          <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl shrink-0', a.default ? 'bg-primary/10' : 'bg-muted')}>
            <MapPin className={cn('h-4 w-4', a.default ? 'text-primary' : 'text-muted-foreground')} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-sm">{a.label}</p>
              {a.default && <span className="rounded-full bg-primary/15 text-primary text-[9px] font-bold px-2 py-0.5">Primary</span>}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{a.address}</p>
            {a.phone && <p className="text-xs text-muted-foreground/70 mt-0.5">{a.phone}</p>}
            {!a.default && (
              <button onClick={() => handleSetDefault(a.id)} className="text-[11px] text-primary font-semibold mt-1.5">
                Set as default
              </button>
            )}
          </div>
          <button onClick={() => handleDelete(a.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      {adding ? (
        <div className="rounded-xl border border-border bg-[#F4F5F7] p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Label</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Home, Office…" className="h-10 rounded-xl bg-white border-0 focus-visible:ring-1 focus-visible:ring-primary/40" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Phone</Label>
              <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+509 XXXX" className="h-10 rounded-xl bg-white border-0 focus-visible:ring-1 focus-visible:ring-primary/40" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Full Address</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, City, Department" className="h-10 rounded-xl bg-white border-0 focus-visible:ring-1 focus-visible:ring-primary/40" />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setAdding(false)} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-muted/30 transition-colors">Cancel</button>
            <button
              onClick={handleAdd}
              disabled={saving || !address.trim()}
              className="rounded-xl px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #F05A28, #D44E21)' }}
            >
              {saving && <Loader2 className="inline h-3.5 w-3.5 animate-spin mr-1" />}Add Address
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/25 py-3 text-sm font-semibold text-primary hover:border-primary/40 hover:bg-primary/4 transition-colors"
        >
          <Plus className="h-4 w-4" />Add address
        </button>
      )}
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
        { label: 'Push notifications', desc: 'Real-time alerts on the app', value: push, set: setPush },
        { label: 'Email notifications', desc: 'Updates by email', value: email, set: setEmail },
        { label: 'SMS notifications', desc: 'Alerts by SMS (optional)', value: sms, set: setSms },
      ].map((item) => (
        <div key={item.label} className="flex items-center justify-between gap-3 px-5 py-3.5">
          <div>
            <p className="text-sm font-medium text-foreground">{item.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
          </div>
          <Switch checked={item.value} onCheckedChange={item.set} className="shrink-0" />
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
    if (next.length < 8) { toast.error('Password must be at least 8 characters.'); return }
    if (next !== confirm) { toast.error('Passwords do not match.'); return }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password: next })
    if (error) toast.error(error.message || 'Error changing password.')
    else { toast.success('Password updated successfully.'); setCurrent(''); setNext(''); setConfirm(''); onClose() }
    setSaving(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>Create a new secure password</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-sm font-bold">Current password</Label>
            <div className="relative">
              <Input type={showCurrent ? 'text' : 'password'} value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="••••••••" className="h-11 rounded-xl bg-[#F0F1F5] border-0 pr-11 focus-visible:ring-1 focus-visible:ring-primary/40" />
              <button type="button" onClick={() => setShowCurrent(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-bold">New password</Label>
            <div className="relative">
              <Input type={showNext ? 'text' : 'password'} value={next} onChange={(e) => setNext(e.target.value)} placeholder="Min. 8 characters" className="h-11 rounded-xl bg-[#F0F1F5] border-0 pr-11 focus-visible:ring-1 focus-visible:ring-primary/40" />
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
            <Label className="text-sm font-bold">Confirm password</Label>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" className={cn('h-11 rounded-xl bg-[#F0F1F5] border-0 focus-visible:ring-1', confirm && confirm !== next ? 'ring-1 ring-destructive/30 focus-visible:ring-destructive/40' : 'focus-visible:ring-primary/40')} />
            {confirm && confirm !== next && <p className="text-xs text-destructive">Passwords do not match</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !next || next !== confirm} className="rounded-xl">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Update
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
