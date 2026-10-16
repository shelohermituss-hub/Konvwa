import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, ExternalLink, Flame, Loader2, Search, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Progress } from '@/components/ui/progress'
import { supabase } from '@/lib/supabase'
import { discoverAmazonProducts, type DiscoveredProduct } from '@/lib/product-import-api'
import { importAndSave, loadImportRates, runPool } from '@/lib/bulk-import'
import { tr } from '@/lib/i18n'

const SOURCES: Array<[string, string]> = [['movers', 'Tendances du moment'], ['bestsellers', 'Meilleures ventes'], ['new', 'Nouveautés populaires']]
const DEPARTMENTS: Array<[string, string]> = [
  ['', 'Tous les rayons'], ['electronics', 'Électronique'], ['beauty', 'Beauté'], ['hpc', 'Santé et soins personnels'], ['home-garden', 'Maison et jardin'],
  ['kitchen', 'Cuisine'], ['sporting-goods', 'Sports et plein air'], ['toys-and-games', 'Jouets et jeux'], ['fashion', 'Mode'], ['automotive', 'Auto et moto'],
  ['pet-supplies', 'Animaux'], ['baby-products', 'Bébé'], ['office-products', 'Bureau'], ['hi', 'Bricolage et outils'], ['videogames', 'Jeux vidéo'],
  ['arts-crafts', 'Loisirs créatifs'], ['musical-instruments', 'Instruments de musique'],
]
/** Products read at the same time: each one takes about half a minute (page, translation, pictures). */
const PARALLEL = 3

type Status = { state: 'wait' } | { state: 'run' } | { state: 'ok'; id: string; name: string } | { state: 'fail'; error: string }

/**
 * Admin: finds 20 trending / well-rated Amazon products by itself (Amazon's public rankings), then imports them all at once as hidden drafts
 * (same reading, translation and pricing as the single-link import). Nothing is shown to customers until the team publishes them.
 */
export function ProductDiscoverDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [source, setSource] = useState('movers')
  const [department, setDepartment] = useState('')
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const [found, setFound] = useState<DiscoveredProduct[] | null>(null)
  const [skipped, setSkipped] = useState(0)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)
  const [status, setStatus] = useState<Record<string, Status>>({})
  const [publishing, setPublishing] = useState(false)
  const stop = useRef(false)

  useEffect(() => {
    if (!open) return
    setFound(null); setError(''); setStatus({}); setImporting(false); setSearching(false); setPicked(new Set()); stop.current = false
  }, [open])

  const chosen = (found ?? []).filter((c) => picked.has(c.asin))
  const results = Object.entries(status)
  const done = results.filter(([, s]) => s.state === 'ok' || s.state === 'fail').length
  const saved = results.flatMap(([, s]) => (s.state === 'ok' ? [s.id] : []))
  const started = results.length > 0

  async function search() {
    setSearching(true); setError(''); setFound(null); setStatus({})
    try {
      const r = await discoverAmazonProducts({ source, department, count: 20 })
      setFound(r.candidates); setSkipped(r.skipped_existing)
      setPicked(new Set(r.candidates.map((c) => c.asin)))
      if (r.candidates.length === 0) setError(tr('Tous les produits trouvés sont déjà dans la boutique. Essayez un autre rayon.'))
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('Erreur réseau'))
    } finally {
      setSearching(false)
    }
  }

  async function importAll() {
    if (chosen.length === 0) return
    stop.current = false
    setImporting(true)
    setStatus(Object.fromEntries(chosen.map((c) => [c.asin, { state: 'wait' } as Status])))
    const set = (asin: string, s: Status) => setStatus((cur) => ({ ...cur, [asin]: s }))
    try {
      const rates = await loadImportRates()
      await runPool(chosen, PARALLEL, async (c) => {
        set(c.asin, { state: 'run' })
        try {
          const r = await importAndSave(c.url, rates)
          set(c.asin, { state: 'ok', ...r })
        } catch (e) {
          set(c.asin, { state: 'fail', error: e instanceof Error ? e.message : tr('Erreur inconnue') })
        }
      }, () => stop.current)
    } finally {
      setImporting(false)
      onDone()
    }
  }

  async function publish() {
    if (saved.length === 0) return
    setPublishing(true)
    const { error: err } = await supabase.from('products').update({ active: true }).in('id', saved)
    setPublishing(false)
    if (err) { toast.error(err.message); return }
    toast.success(tr('{0} produits publiés.', saved.length))
    onDone(); onClose()
  }

  const busy = searching || importing
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !importing) onClose() }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Flame className="h-5 w-5 text-primary" />{tr('Produits tendance Amazon')}</DialogTitle>
          <DialogDescription>{tr('Trouve jusqu\'à 20 produits populaires et bien notés sur Amazon.com, sans que vous fournissiez de lien, puis les importe d\'un coup (fiche, photos, variantes, avis, colis) en brouillons masqués. Vous relisez puis publiez.')}</DialogDescription>
        </DialogHeader>

        {!started && (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void search() }}>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm font-semibold">
                {tr('Type de classement')}
                <NativeSelect value={source} onChange={(e) => setSource(e.target.value)} disabled={busy} className="w-full">
                  {SOURCES.map(([v, l]) => <NativeSelectOption key={v} value={v}>{tr(l)}</NativeSelectOption>)}
                </NativeSelect>
              </label>
              <label className="space-y-1 text-sm font-semibold">
                {tr('Rayon')}
                <NativeSelect value={department} onChange={(e) => setDepartment(e.target.value)} disabled={busy} className="w-full">
                  {DEPARTMENTS.map(([v, l]) => <NativeSelectOption key={v || 'all'} value={v}>{tr(l)}</NativeSelectOption>)}
                </NativeSelect>
              </label>
            </div>
            <Button type="submit" disabled={busy} className="gap-1.5 rounded-xl">
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}{tr('Chercher 20 produits')}
            </Button>
            {searching && <p className="text-sm text-muted-foreground" role="status">{tr('Lecture du classement Amazon (jusqu\'à une minute)…')}</p>}
          </form>
        )}

        {error && <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{error}</p>}

        {found && found.length > 0 && !started && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {tr('{0} produits trouvés', found.length)}{skipped > 0 && ` · ${tr('{0} déjà dans la boutique (ignorés)', skipped)}`}. {tr('Décochez ceux dont vous ne voulez pas.')}
            </p>
            <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100">
              {found.map((c) => (
                <li key={c.asin} className="flex items-start gap-3 p-2.5">
                  <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 rounded" checked={picked.has(c.asin)} aria-label={c.title ?? c.asin}
                    onChange={(e) => setPicked((cur) => { const n = new Set(cur); if (e.target.checked) n.add(c.asin); else n.delete(c.asin); return n })} />
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="line-clamp-2 font-medium">{c.title ?? c.asin}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      #{c.rank}{c.rating != null && ` · ${String(c.rating).replace('.', ',')} ★`}{c.reviews != null && ` (${c.reviews.toLocaleString('fr-FR')})`}{c.price_usd != null && ` · $${c.price_usd.toFixed(2)}`}
                    </p>
                  </div>
                  <a href={c.url} target="_blank" rel="noopener noreferrer" className="shrink-0 p-1 text-muted-foreground hover:text-foreground" aria-label={tr('Voir sur Amazon')}><ExternalLink className="h-4 w-4" /></a>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button type="button" variant="outline" onClick={() => void search()} disabled={busy} className="rounded-xl">{tr('Nouvelle recherche')}</Button>
              <Button type="button" onClick={() => void importAll()} disabled={busy || chosen.length === 0} className="rounded-xl">{tr('Importer {0} produits', chosen.length)}</Button>
            </div>
          </div>
        )}

        {started && (
          <div className="space-y-3">
            <Progress value={(done / Math.max(1, results.length)) * 100} />
            <p className="text-sm text-muted-foreground" role="status">
              {importing ? tr('Import en cours : {0} sur {1}. Gardez cette fenêtre ouverte (environ une demi-minute par produit, 3 à la fois).', done, results.length) : tr('Import terminé : {0} réussis sur {1}.', saved.length, results.length)}
            </p>
            <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100 text-sm">
              {(found ?? []).filter((c) => status[c.asin]).map((c) => {
                const s = status[c.asin]
                return (
                  <li key={c.asin} className="flex items-start gap-2 p-2.5">
                    {s.state === 'ok' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : s.state === 'fail' ? <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                      : s.state === 'run' ? <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" /> : <span className="mt-1 h-3 w-3 shrink-0 rounded-full bg-gray-200" />}
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1">{s.state === 'ok' ? s.name : c.title ?? c.asin}</p>
                      {s.state === 'fail' && <p className="text-xs text-destructive">{s.error}</p>}
                    </div>
                  </li>
                )
              })}
            </ul>
            <div className="flex flex-wrap items-center justify-between gap-2">
              {importing
                ? <Button type="button" variant="outline" onClick={() => { stop.current = true }} className="rounded-xl">{tr('Arrêter après les produits en cours')}</Button>
                : <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">{tr('Garder en brouillons')}</Button>}
              {!importing && saved.length > 0 && (
                <Button type="button" onClick={() => void publish()} disabled={publishing} className="gap-1.5 rounded-xl">
                  {publishing && <Loader2 className="h-4 w-4 animate-spin" />}{tr('Publier les {0} produits', saved.length)}
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
