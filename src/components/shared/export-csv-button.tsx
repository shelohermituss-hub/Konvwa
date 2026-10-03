import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { downloadCsv } from '@/lib/csv'
import { tr } from '@/lib/i18n'

export function ExportCsvButton({ filename, headers, rows, disabled }: {
  filename: string
  headers: string[]
  rows: () => unknown[][]
  disabled?: boolean
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={disabled}
      onClick={() => downloadCsv(`${filename}-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows())}
      className="gap-1.5 rounded-xl"
    >
      <Download className="h-3.5 w-3.5" />{tr('Exporter CSV')}
    </Button>
  )
}
