import { useEffect, useState } from 'react'
import { Link2, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { importProductFromLink, type ImportedProduct } from '@/lib/product-import-api'
import { tr } from '@/lib/i18n'

/** Paste an Amazon product link: the product sheet (and its package) is filled for you to check before saving. */
export function ProductLinkImport({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: (p: ImportedProduct) => void }) {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => { if (open) { setUrl(''); setError(''); setBusy(false); setStep(0) } }, [open])
  useEffect(() => {
    if (!busy) return
    const t = window.setInterval(() => setStep((s) => Math.min(s + 1, 2)), 12000)
    return () => window.clearInterval(t)
  }, [busy])

  async function run() {
    const link = url.trim()
    if (!/^https:\/\//i.test(link)) { setError(tr('Collez un lien complet qui commence par https://')); return }
    setBusy(true); setError(''); setStep(0)
    try {
      const data = await importProductFromLink(link)
      onImported(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('Erreur réseau'))
    } finally {
      setBusy(false)
    }
  }

  const steps = [tr('Lecture de la page Amazon…'), tr('Analyse du produit et traduction…'), tr('Copie des images…')]

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) onClose() }}>
      <DialogContent className="rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />{tr('Importer depuis un lien Amazon')}</DialogTitle>
          <DialogDescription>{tr('Collez le lien d\'un produit Amazon : la fiche (nom, description, images, prix, caractéristiques) et le colis (poids, dimensions) sont remplis. Vous vérifiez avant d\'enregistrer.')}</DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void run() }}>
          <div className="relative">
            <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.amazon.com/dp/B0…" disabled={busy} autoFocus className="rounded-xl pl-9" aria-label={tr('Lien du produit Amazon')} />
          </div>
          {error && <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{error}</p>}
          {busy && <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status"><Loader2 className="h-4 w-4 animate-spin" />{steps[step]}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy} className="rounded-xl">{tr('Annuler')}</Button>
            <Button type="submit" disabled={busy || !url.trim()} className="gap-1.5 rounded-xl">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{tr('Analyser')}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{tr('Compter jusqu\'à une minute. Les valeurs de colis marquées « estimées » sont à vérifier.')}</p>
        </form>
      </DialogContent>
    </Dialog>
  )
}
