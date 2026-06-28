import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import {
  Search, Plus, MoreHorizontal, Edit, Trash2,
  Star, MapPin, ExternalLink, Store, ShieldCheck, ShieldAlert, Shield,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Supplier {
  id: string
  name: string
  source_platform: 'alibaba' | 'shein' | 'temu' | 'other'
  supplier_url: string | null
  country: string | null
  trust_score: number
  quality_rating: number | null
  moq: number | null
  average_delivery_days: number | null
  total_orders: number
  dispute_count: number
  verification_status: 'unverified' | 'basic' | 'verified' | 'premium'
  categories: string[] | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

const AVATAR_COLORS = [
  '#E53D15', '#F05A28', '#8B2200', '#C23010',
  '#2563EB', '#7C3AED', '#059669', '#D97706',
]
function avatarColor(id: string) {
  const hash = [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) & 0xffffffff, 0)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

const PLATFORM_LABELS: Record<string, string> = {
  alibaba: 'Alibaba', shein: 'Shein', temu: 'Temu', other: 'Autre',
}
const PLATFORM_COLORS: Record<string, string> = {
  alibaba: 'bg-orange-50 text-orange-700',
  shein:   'bg-pink-50   text-pink-700',
  temu:    'bg-orange-50 text-orange-600',
  other:   'bg-muted     text-muted-foreground',
}

const VERIF_CONFIG: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  premium:    { label: 'Premium',     icon: <ShieldCheck className="h-3 w-3" />, className: 'bg-amber-50 text-amber-700' },
  verified:   { label: 'Vérifié',     icon: <ShieldCheck className="h-3 w-3" />, className: 'bg-emerald-50 text-emerald-700' },
  basic:      { label: 'Basique',     icon: <Shield      className="h-3 w-3" />, className: 'bg-blue-50 text-blue-700' },
  unverified: { label: 'Non vérifié', icon: <ShieldAlert className="h-3 w-3" />, className: 'bg-muted text-muted-foreground' },
}

function TrustBadge({ score }: { score: number }) {
  const color = score >= 80 ? 'text-emerald-700 bg-emerald-50'
    : score >= 60 ? 'text-amber-700 bg-amber-50'
    : 'text-red-700 bg-red-50'
  return (
    <span className={cn('inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full', color)}>
      <Star className="h-2.5 w-2.5 fill-current" />
      {score}
    </span>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function AdminSuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [platformFilter, setPlatformFilter] = useState<string>('all')

  // Add dialog state
  const [addOpen, setAddOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPlatform, setNewPlatform] = useState('')
  const [newCountry, setNewCountry] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false)
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null)
  const [editScore, setEditScore] = useState('')
  const [editVerif, setEditVerif] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  async function loadSuppliers() {
    const { data } = await supabase
      .from('suppliers')
      .select('id, name, source_platform, supplier_url, country, trust_score, quality_rating, moq, average_delivery_days, total_orders, dispute_count, verification_status, categories')
      .order('trust_score', { ascending: false })
    if (data) setSuppliers(data as Supplier[])
    setLoading(false)
  }

  useEffect(() => { loadSuppliers() }, [])

  const filtered = suppliers.filter((s) => {
    const matchSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.country ?? '').toLowerCase().includes(search.toLowerCase())
    const matchPlatform = platformFilter === 'all' || s.source_platform === platformFilter
    return matchSearch && matchPlatform
  })

  async function handleAdd() {
    if (!newName || !newPlatform) return
    setSaving(true)
    const { error } = await supabase.from('suppliers').insert({
      name: newName,
      source_platform: newPlatform,
      country: newCountry || null,
      supplier_url: newUrl || null,
      notes: newNotes || null,
    })
    if (error) {
      toast.error("Erreur lors de l'ajout.")
    } else {
      toast.success('Fournisseur ajouté.')
      setAddOpen(false)
      setNewName(''); setNewPlatform(''); setNewCountry(''); setNewUrl(''); setNewNotes('')
      await loadSuppliers()
    }
    setSaving(false)
  }

  function openEdit(s: Supplier) {
    setEditSupplier(s)
    setEditScore(String(s.trust_score))
    setEditVerif(s.verification_status)
    setEditOpen(true)
  }

  async function handleEdit() {
    if (!editSupplier) return
    setEditSaving(true)
    const { error } = await supabase.from('suppliers').update({
      trust_score: parseInt(editScore) || 0,
      verification_status: editVerif,
    }).eq('id', editSupplier.id)
    if (error) {
      toast.error('Erreur lors de la mise à jour.')
    } else {
      toast.success('Fournisseur mis à jour.')
      setEditOpen(false)
      await loadSuppliers()
    }
    setEditSaving(false)
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Supprimer "${name}" ?`)) return
    const { error } = await supabase.from('suppliers').delete().eq('id', id)
    if (error) toast.error('Erreur lors de la suppression.')
    else { toast.success('Fournisseur supprimé.'); await loadSuppliers() }
  }

  // Stats
  const total     = suppliers.length
  const verified  = suppliers.filter(s => s.verification_status === 'verified' || s.verification_status === 'premium').length
  const avgScore  = total ? Math.round(suppliers.reduce((s, f) => s + f.trust_score, 0) / total) : 0

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fournisseurs</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {loading ? '…' : `${total} fournisseur${total !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:opacity-90 transition-opacity"
          style={{ background: 'linear-gradient(135deg, #F05A28, #D44E21)' }}
        >
          <Plus className="h-4 w-4" />
          Ajouter
        </button>
      </div>

      {/* KPI mini-cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total',    value: total,   sub: 'fournisseurs',  color: 'text-foreground' },
          { label: 'Vérifiés', value: verified, sub: 'actifs',        color: 'text-emerald-600' },
          { label: 'Score moy.',value: avgScore,sub: '/ 100',        color: 'text-primary' },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4">
            <p className="text-xs text-muted-foreground font-medium">{kpi.label}</p>
            <p className={cn('text-xl font-bold mt-0.5', kpi.color)}>{kpi.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Search + platform filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher un fournisseur…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 h-11 rounded-xl bg-white border border-gray-200 text-sm font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <select
          value={platformFilter}
          onChange={(e) => setPlatformFilter(e.target.value)}
          className="h-11 rounded-xl bg-white border border-gray-200 px-3 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
        >
          <option value="all">Toutes</option>
          <option value="alibaba">Alibaba</option>
          <option value="shein">Shein</option>
          <option value="temu">Temu</option>
          <option value="other">Autre</option>
        </select>
      </div>

      {/* ECME-style list card */}
      <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
        {/* Column header */}
        <div className="grid grid-cols-[1fr_auto_auto_auto] items-center px-4 py-2.5 border-b border-gray-100 bg-gray-50/70">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Fournisseur</span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 w-20 text-center">Score</span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 w-24 text-center hidden sm:block">Statut</span>
          <span className="w-8" />
        </div>

        {loading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Store className="h-10 w-10 mx-auto text-muted-foreground/25 mb-3" />
            <p className="font-semibold text-sm text-muted-foreground">Aucun fournisseur</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Ajoutez votre premier fournisseur.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map((s) => {
              const verif = VERIF_CONFIG[s.verification_status] ?? VERIF_CONFIG.unverified
              const color = avatarColor(s.id)
              return (
                <div
                  key={s.id}
                  className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors"
                >
                  {/* Avatar + name + meta */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                      style={{ background: color }}
                    >
                      {initials(s.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{s.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-md', PLATFORM_COLORS[s.source_platform])}>
                          {PLATFORM_LABELS[s.source_platform]}
                        </span>
                        {s.country && (
                          <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                            <MapPin className="h-2.5 w-2.5 shrink-0" />
                            {s.country}
                          </span>
                        )}
                        {s.total_orders > 0 && (
                          <span className="text-[10px] text-muted-foreground/60">{s.total_orders} cmds</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Trust score */}
                  <div className="w-20 flex flex-col items-center gap-1">
                    <TrustBadge score={s.trust_score} />
                    <div className="w-12 h-1 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${s.trust_score}%`,
                          background: s.trust_score >= 80 ? '#059669' : s.trust_score >= 60 ? '#D97706' : '#DC2626',
                        }}
                      />
                    </div>
                  </div>

                  {/* Verification badge */}
                  <div className="w-24 hidden sm:flex justify-center">
                    <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full', verif.className)}>
                      {verif.icon}
                      {verif.label}
                    </span>
                  </div>

                  {/* Actions dropdown */}
                  <div className="w-8">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted transition-colors">
                          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl w-48">
                        <DropdownMenuItem className="rounded-lg cursor-pointer gap-2" onClick={() => openEdit(s)}>
                          <Edit className="h-4 w-4" />Modifier le score
                        </DropdownMenuItem>
                        {s.supplier_url && (
                          <DropdownMenuItem className="rounded-lg cursor-pointer gap-2" asChild>
                            <a href={s.supplier_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4" />Voir sur plateforme
                            </a>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="rounded-lg cursor-pointer gap-2 text-destructive focus:text-destructive"
                          onClick={() => handleDelete(s.id, s.name)}
                        >
                          <Trash2 className="h-4 w-4" />Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Add supplier dialog ── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Ajouter un fournisseur</DialogTitle>
            <DialogDescription>Enregistrez un nouveau fournisseur dans votre réseau</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Nom *</Label>
              <Input placeholder="Shenzhen Electronics Co." value={newName} onChange={e => setNewName(e.target.value)} className="rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Plateforme *</Label>
                <Select value={newPlatform} onValueChange={setNewPlatform}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Choisir" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alibaba">Alibaba</SelectItem>
                    <SelectItem value="shein">Shein</SelectItem>
                    <SelectItem value="temu">Temu</SelectItem>
                    <SelectItem value="other">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Pays</Label>
                <Input placeholder="Chine" value={newCountry} onChange={e => setNewCountry(e.target.value)} className="rounded-xl" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">URL du fournisseur</Label>
              <Input placeholder="https://www.alibaba.com/…" value={newUrl} onChange={e => setNewUrl(e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Notes</Label>
              <Textarea placeholder="Informations sur le fournisseur…" rows={3} value={newNotes} onChange={e => setNewNotes(e.target.value)} className="rounded-xl resize-none" />
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setAddOpen(false)} className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-gray-50 transition-colors">
              Annuler
            </button>
            <button
              onClick={handleAdd}
              disabled={!newName || !newPlatform || saving}
              className="rounded-xl px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
              style={{ background: 'linear-gradient(135deg, #F05A28, #D44E21)' }}
            >
              {saving ? 'Ajout…' : 'Ajouter'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit score / verification dialog ── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Modifier {editSupplier?.name}</DialogTitle>
            <DialogDescription>Mettre à jour le score de confiance et la vérification</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Score de confiance (0–100)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={editScore}
                onChange={e => setEditScore(e.target.value)}
                className="rounded-xl"
              />
              {editScore && (
                <div className="w-full h-2 rounded-full bg-muted overflow-hidden mt-1">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, Math.max(0, parseInt(editScore) || 0))}%`,
                      background: parseInt(editScore) >= 80 ? '#059669' : parseInt(editScore) >= 60 ? '#D97706' : '#DC2626',
                    }}
                  />
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Statut de vérification</Label>
              <Select value={editVerif} onValueChange={setEditVerif}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unverified">Non vérifié</SelectItem>
                  <SelectItem value="basic">Basique</SelectItem>
                  <SelectItem value="verified">Vérifié</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setEditOpen(false)} className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-gray-50 transition-colors">
              Annuler
            </button>
            <button
              onClick={handleEdit}
              disabled={editSaving}
              className="rounded-xl px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
              style={{ background: 'linear-gradient(135deg, #F05A28, #D44E21)' }}
            >
              {editSaving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
