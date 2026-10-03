import { useState } from 'react'
import { AlertCircle, Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { supabase } from '@/lib/supabase'
import { downloadCsv, parseCsv } from '@/lib/csv'
import { tr } from '@/lib/i18n'

const COLUMNS = ['name', 'price_htg', 'moq', 'unit', 'category', 'supplier_name', 'supplier_country', 'description', 'images', 'delivery_days_min', 'delivery_days_max', 'tags', 'stock_available']
const MAX_ROWS = 200
const MAX_BYTES = 1024 * 1024

interface ParsedRow {
  line: number
  payload: Record<string, unknown> | null
  errors: string[]
}

const yes = (v: string) => !['non', 'no', 'false', '0', 'n'].includes(v.trim().toLowerCase())
const list = (v: string) => v.split('|').map((s) => s.trim()).filter(Boolean)

function parseRows(text: string): { rows: ParsedRow[]; fatal: string | null } {
  const table = parseCsv(text)
  if (table.length < 2) return { rows: [], fatal: tr('Le fichier est vide.') }
  const header = table[0].map((h) => h.trim().toLowerCase())
  if (!header.includes('name') || !header.includes('price_htg')) return { rows: [], fatal: tr('Colonnes obligatoires manquantes : name, price_htg.') }
  if (table.length - 1 > MAX_ROWS) return { rows: [], fatal: tr('{0} lignes maximum par import.', MAX_ROWS) }

  const rows = table.slice(1).map((cells, i): ParsedRow => {
    const get = (col: string) => (cells[header.indexOf(col)] ?? '').trim()
    const errors: string[] = []
    const name = get('name')
    const price = Number(get('price_htg').replace(',', '.'))
    const moq = get('moq') ? Number(get('moq')) : 1
    if (name.length < 2) errors.push(tr('Nom manquant'))
    if (!Number.isFinite(price) || price <= 0) errors.push(tr('Prix invalide'))
    if (!Number.isInteger(moq) || moq < 1) errors.push(tr('MOQ invalide'))
    const images = list(get('images'))
    if (images.some((u) => !/^https:\/\//i.test(u))) errors.push(tr('Les images doivent être des liens https'))
    const dMin = get('delivery_days_min') ? Number(get('delivery_days_min')) : null
    const dMax = get('delivery_days_max') ? Number(get('delivery_days_max')) : null
    if ((dMin != null && !Number.isInteger(dMin)) || (dMax != null && !Number.isInteger(dMax))) errors.push(tr('Délais invalides'))
    if (errors.length) return { line: i + 2, payload: null, errors }
    return {
      line: i + 2,
      errors,
      payload: {
        name,
        description: get('description') || null,
        price_htg: price,
        moq,
        unit: get('unit') || tr('unité'),
        category: get('category') || null,
        supplier_name: get('supplier_name') || null,
        supplier_country: get('supplier_country').toUpperCase().slice(0, 2) || null,
        images,
        delivery_days_min: dMin,
        delivery_days_max: dMax,
        tags: list(get('tags')),
        stock_available: get('stock_available') ? yes(get('stock_available')) : true,
        specifications: {}, price_tiers: [], customization_options: [], certifications: [],
        active: true, featured: false, supplier_verified: false, sold_count: 0, review_count: 0,
      },
    }
  })
  return { rows, fatal: null }
}

export function ProductImportDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [fatal, setFatal] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const valid = rows.filter((r) => r.payload)
  const invalid = rows.filter((r) => !r.payload)

  async function onFile(file: File | undefined) {
    if (!file) return
    if (file.size > MAX_BYTES) { setRows([]); setFatal(tr('Fichier trop lourd (max 1 Mo).')); return }
    const res = parseRows(await file.text())
    setRows(res.rows)
    setFatal(res.fatal)
  }

  async function run() {
    setBusy(true)
    const { error } = await supabase.from('products').insert(valid.flatMap((r) => (r.payload ? [r.payload] : [])))
    setBusy(false)
    if (error) { toast.error(error.message); return }
    toast.success(tr('{0} produit(s) importé(s).', valid.length))
    setRows([])
    onDone()
    onClose()
  }

  function template() {
    downloadCsv('modele-import-produits.csv', COLUMNS, [
      ['Chaussettes de sport', 155, 100, 'paire', 'Mode', 'Yiwu Sports Co.', 'CN', 'Chaussettes en coton', 'https://exemple.com/photo1.jpg|https://exemple.com/photo2.jpg', 20, 35, 'Retour facile|Coton', 'oui'],
    ])
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setRows([]); setFatal(null); onClose() } }}>
      <DialogContent className="rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-primary" />{tr('Importer des produits (CSV)')}</DialogTitle>
          <DialogDescription>
            {tr('Colonnes : {0}. Séparez les images et les étiquettes par « | ». Les produits sont créés actifs.', COLUMNS.join(', '))}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={template} className="gap-1.5 rounded-xl"><Download className="h-3.5 w-3.5" />{tr('Télécharger le modèle')}</Button>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-input px-3 py-1.5 text-sm font-medium hover:bg-muted">
            <Upload className="h-3.5 w-3.5" />{tr('Choisir un fichier')}
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => void onFile(e.target.files?.[0])} />
          </label>
        </div>

        {fatal && <p className="flex items-center gap-1.5 text-sm text-destructive" role="alert"><AlertCircle className="h-4 w-4" />{fatal}</p>}

        {rows.length > 0 && (
          <div className="space-y-2 text-sm">
            <p className="font-semibold">{tr('{0} ligne(s) valide(s), {1} en erreur', valid.length, invalid.length)}</p>
            {invalid.length > 0 && (
              <ul className="max-h-32 space-y-1 overflow-y-auto rounded-xl bg-destructive/5 p-3 text-xs text-destructive">
                {invalid.slice(0, 20).map((r) => <li key={r.line}>{tr('Ligne {0}', r.line)} : {r.errors.join(', ')}</li>)}
              </ul>
            )}
            <ul className="max-h-32 space-y-1 overflow-y-auto rounded-xl bg-muted/40 p-3 text-xs">
              {valid.slice(0, 5).map((r) => <li key={r.line} className="truncate">{String(r.payload?.name)} · {String(r.payload?.price_htg)} HTG</li>)}
              {valid.length > 5 && <li className="text-muted-foreground">… {tr('et {0} autres', valid.length - 5)}</li>}
            </ul>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-xl">{tr('Annuler')}</Button>
          <Button onClick={() => void run()} disabled={busy || valid.length === 0 || invalid.length > 0} className="rounded-xl">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : tr('Importer')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
