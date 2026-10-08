import { useEffect, useState } from 'react'
import { Loader2, MessageCircle, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { channelUrl } from '@/lib/whatsapp-channel-url'
import { tr } from '@/lib/i18n'

/** Admin card: the link of the WhatsApp channel shown on the "follow the channel" buttons (empty = the buttons are hidden). */
export function WhatsAppChannelSetting() {
  const [saved, setSaved] = useState('')
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', 'whatsapp_channel_url').maybeSingle()
      .then(({ data }) => { setSaved(data?.value ?? ''); setValue(data?.value ?? ''); setLoading(false) }, () => setLoading(false))
  }, [])

  const trimmed = value.trim()
  const valid = trimmed === '' || channelUrl(trimmed) !== null

  async function save() {
    if (!valid) { toast.error(tr('Le lien doit ressembler à https://whatsapp.com/channel/…')); return }
    setSaving(true)
    const { error } = await supabase.from('app_settings').upsert({
      key: 'whatsapp_channel_url', value: trimmed, label: 'Lien de la chaîne WhatsApp',
      description: 'Adresse de la chaîne WhatsApp de KONVWA (https://whatsapp.com/channel/…). Vide : les boutons « Suivre la chaîne » sont cachés.',
      sensitive: false, updated_at: new Date().toISOString(),
    }, { onConflict: 'key' })
    if (error) toast.error(tr('Erreur lors de la sauvegarde.'))
    else { setSaved(trimmed); toast.success(trimmed ? tr('Lien de la chaîne enregistré : les boutons sont visibles.') : tr('Lien retiré : les boutons sont cachés.')) }
    setSaving(false)
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#25D366]/15"><MessageCircle className="h-4 w-4 text-[#128C4A]" /></div>
        <div>
          <p className="text-sm font-semibold">{tr('Chaîne WhatsApp')}</p>
          <p className="text-xs text-muted-foreground">{tr('Le lien d\'invitation de votre chaîne : il alimente les boutons « Suivre la chaîne » du site.')}</p>
        </div>
      </div>
      <div className="space-y-3 p-5">
        {loading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : (
          <>
            <Input
              value={value} onChange={(e) => setValue(e.target.value)} inputMode="url" autoComplete="off"
              placeholder="https://whatsapp.com/channel/0029Va…" aria-invalid={!valid}
              className="rounded-xl font-mono text-sm"
            />
            {!valid && <p className="text-xs text-destructive">{tr('Le lien doit ressembler à https://whatsapp.com/channel/…')}</p>}
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">{saved ? tr('Boutons visibles sur le site.') : tr('Aucun lien : les boutons sont cachés.')}</p>
              <Button onClick={() => void save()} disabled={saving || !valid || trimmed === saved} className="gap-2 rounded-xl">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{tr('Enregistrer')}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
