import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { Search, Plus, MoreHorizontal, Eye, Edit, Star, ExternalLink, Globe, Store } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

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

const verificationLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  verified: { label: 'Vérifié', variant: 'default' },
  premium: { label: 'Premium', variant: 'default' },
  basic: { label: 'Basique', variant: 'secondary' },
  unverified: { label: 'Non vérifié', variant: 'outline' },
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

  useEffect(() => {
    loadSuppliers()
  }, [])

  const filteredSuppliers = suppliers.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  )

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
      toast.error('Erreur lors de l\'ajout du fournisseur.')
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
    <div className="space-y-6">
      <PageHeader
        title="Fournisseurs"
        description="Gérez votre réseau de fournisseurs"
        action={
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Ajouter fournisseur
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Ajouter un fournisseur</DialogTitle>
                <DialogDescription>
                  Enregistrez un nouveau fournisseur dans votre réseau
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Nom du fournisseur *</Label>
                  <Input
                    placeholder="Shenzhen Electronics Co."
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Plateforme *</Label>
                  <Select value={newPlatform} onValueChange={setNewPlatform}>
                    <SelectTrigger>
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
                  <Label>URL du fournisseur</Label>
                  <Input
                    placeholder="https://www.alibaba.com/supplier/..."
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    placeholder="Informations sur le fournisseur..."
                    rows={3}
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                  Annuler
                </Button>
                <Button onClick={handleAdd} disabled={!newName || !newPlatform || saving}>
                  {saving ? 'Ajout...' : 'Ajouter'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Card>
        <CardHeader className="pb-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un fournisseur..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <EmptyState
              icon={Store}
              title="Aucun fournisseur"
              description="Ajoutez votre premier fournisseur au réseau."
            />
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fournisseur</TableHead>
                    <TableHead>Plateforme</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>MOQ</TableHead>
                    <TableHead>Délai moyen</TableHead>
                    <TableHead>Commandes</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSuppliers.map((supplier) => {
                    const verification = verificationLabels[supplier.verification_status] || verificationLabels.unverified
                    return (
                      <TableRow key={supplier.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{supplier.name}</p>
                            {supplier.country && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Globe className="h-3 w-3" />
                                {supplier.country}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{supplier.source_platform}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={supplier.trust_score} className="w-20 h-2" />
                            <span className="text-sm font-medium">{supplier.trust_score}%</span>
                          </div>
                        </TableCell>
                        <TableCell>{supplier.moq ?? '—'}</TableCell>
                        <TableCell>
                          {supplier.average_delivery_days ? `${supplier.average_delivery_days} jours` : '—'}
                        </TableCell>
                        <TableCell>{supplier.total_orders}</TableCell>
                        <TableCell>
                          <Badge variant={verification.variant}>{verification.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>
                                <Eye className="mr-2 h-4 w-4" />
                                Voir profil
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Edit className="mr-2 h-4 w-4" />
                                Modifier
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Star className="mr-2 h-4 w-4" />
                                Mettre à jour score
                              </DropdownMenuItem>
                              {supplier.supplier_url && (
                                <DropdownMenuItem asChild>
                                  <a href={supplier.supplier_url} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="mr-2 h-4 w-4" />
                                    Voir sur plateforme
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
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
