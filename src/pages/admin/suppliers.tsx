import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Search, Plus, MoreHorizontal, Eye, Edit, Star, ExternalLink, Globe, Store } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Supplier {
  id: string
  name: string
  source_platform: string
  supplier_url: string | null
  country: string | null
  trust_score: number
  moq: number | null
  average_delivery_days: number | null
  total_orders: number
  disputes: number
  verification_status: string
}

const VERIFICATION_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  verified:   { label: 'Vérifié',     bg: 'bg-primary/10',  text: 'text-primary' },
  premium:    { label: 'Premium',     bg: 'bg-amber-50',    text: 'text-amber-700' },
  basic:      { label: 'Basique',     bg: 'bg-muted',       text: 'text-muted-foreground' },
  unverified: { label: 'Non vérifié', bg: 'bg-muted',       text: 'text-muted-foreground' },
}

const PLATFORM_COLORS: Record<string, string> = {
  alibaba: 'text-orange-600',
  shein:   'text-pink-600',
  temu:    'text-orange-500',
  other:   'text-muted-foreground',
}

export function AdminSuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPlatform, setNewPlatform] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function loadSuppliers() {
    const { data } = await supabase
      .from('suppliers')
      .select('id, name, source_platform, supplier_url, country, trust_score, moq, average_delivery_days, total_orders, dispute_count, verification_status')
      .order('total_orders', { ascending: false })
    if (data) setSuppliers(data.map(s => ({ ...s, disputes: s.dispute_count })) as Supplier[])
    setLoading(false)
  }

  useEffect(() => { loadSuppliers() }, [])

  const filteredSuppliers = suppliers.filter(s => s.name.toLowerCase().includes(search.toLowerCase()))

  async function handleAdd() {
    if (!newName || !newPlatform) return
    setSaving(true)
    const { error } = await supabase.from('suppliers').insert({
      name: newName,
      source_platform: newPlatform,
      supplier_url: newUrl || null,
      notes: newNotes || null,
    })
    if (error) {
      toast.error("Erreur lors de l'ajout du fournisseur.")
    } else {
      toast.success('Fournisseur ajouté.')
      setAddDialogOpen(false)
      setNewName('')
      setNewPlatform('')
      setNewUrl('')
      setNewNotes('')
      await loadSuppliers()
    }
    setSaving(false)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fournisseurs</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {loading ? '…' : `${filteredSuppliers.length} fournisseur${filteredSuppliers.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Button onClick={() => setAddDialogOpen(true)} className="rounded-xl gap-2">
          <Plus className="h-4 w-4" />
          Ajouter
        </Button>
      </div>

      {/* Search + table */}
      <div className="rounded-2xl bg-white border border-border/60 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border/50">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un fournisseur..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 rounded-xl"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12 rounded-xl" />)}
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="p-12 text-center">
            <Store className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="font-semibold text-muted-foreground">Aucun fournisseur</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Ajoutez votre premier fournisseur au réseau.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Fournisseur</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Plateforme</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Score</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden md:table-cell">MOQ</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden md:table-cell">Délai</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden sm:table-cell text-right">Cmds</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Statut</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSuppliers.map(supplier => {
                const verification = VERIFICATION_CONFIG[supplier.verification_status] || VERIFICATION_CONFIG.unverified
                return (
                  <TableRow key={supplier.id} className="hover:bg-muted/20 transition-colors">
                    <TableCell>
                      <p className="font-medium text-sm">{supplier.name}</p>
                      {supplier.country && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Globe className="h-3 w-3" />{supplier.country}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className={cn('text-xs font-semibold capitalize', PLATFORM_COLORS[supplier.source_platform] || PLATFORM_COLORS.other)}>
                        {supplier.source_platform}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${supplier.trust_score}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold">{supplier.trust_score}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{supplier.moq ?? '—'}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {supplier.average_delivery_days ? `${supplier.average_delivery_days}j` : '—'}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-right">
                      <span className="text-sm font-semibold">{supplier.total_orders}</span>
                    </TableCell>
                    <TableCell>
                      <span className={cn('text-xs font-semibold rounded-full px-2.5 py-1', verification.bg, verification.text)}>
                        {verification.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl w-44">
                          <DropdownMenuItem className="rounded-lg cursor-pointer">
                            <Eye className="mr-2 h-4 w-4" />Voir profil
                          </DropdownMenuItem>
                          <DropdownMenuItem className="rounded-lg cursor-pointer">
                            <Edit className="mr-2 h-4 w-4" />Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem className="rounded-lg cursor-pointer">
                            <Star className="mr-2 h-4 w-4" />Mettre à jour score
                          </DropdownMenuItem>
                          {supplier.supplier_url && (
                            <DropdownMenuItem className="rounded-lg cursor-pointer" asChild>
                              <a href={supplier.supplier_url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="mr-2 h-4 w-4" />Voir sur plateforme
                              </a>
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Add supplier dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Ajouter un fournisseur</DialogTitle>
            <DialogDescription>Enregistrez un nouveau fournisseur dans votre réseau</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="font-semibold text-sm">Nom du fournisseur *</Label>
              <Input placeholder="Shenzhen Electronics Co." value={newName} onChange={e => setNewName(e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label className="font-semibold text-sm">Plateforme *</Label>
              <Select value={newPlatform} onValueChange={setNewPlatform}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alibaba">Alibaba</SelectItem>
                  <SelectItem value="shein">Shein</SelectItem>
                  <SelectItem value="temu">Temu</SelectItem>
                  <SelectItem value="other">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="font-semibold text-sm">URL du fournisseur</Label>
              <Input placeholder="https://www.alibaba.com/supplier/..." value={newUrl} onChange={e => setNewUrl(e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label className="font-semibold text-sm">Notes</Label>
              <Textarea placeholder="Informations sur le fournisseur..." rows={3} value={newNotes} onChange={e => setNewNotes(e.target.value)} className="rounded-xl resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)} className="rounded-xl">Annuler</Button>
            <Button onClick={handleAdd} disabled={!newName || !newPlatform || saving} className="rounded-xl">
              {saving ? 'Ajout...' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
