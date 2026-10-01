import jsPDF from 'jspdf'

// Palette
const OG  = [240, 90, 40]   as const
const INK = [30, 30, 30]    as const
const MID = [110, 110, 110] as const
const LGT = [245, 245, 245] as const
const HDR = [50, 50, 50]    as const

interface PackageEntry {
  number: number
  length_cm: number | null
  width_cm:  number | null
  height_cm: number | null
  weight_kg: number | null
  weight_lbs: number | null
  cbm: number | null
}

export interface OrderForPDF {
  tracking_code: string
  status: string
  payment_status: string
  created_at: string
  total_paid: number
  shipping_option?: 'all_inclusive' | 'separate'
  shipping_amount_paid?: number | null
  shipping_paid_at?: string | null
  chosen_shipping_method?: { name: string; price_htg: number; duration_days_min: number; duration_days_max: number } | null
  quotes: {
    total: number
    product_price: number
    quantity: number
    service_fee: number
    purchase_fee: number
    shipping_fee: number
    customs_fee: number
    local_delivery_fee: number
    estimated_delivery_days: number | null
    product_requests: {
      product_name: string
      source_platform: string
      invoice_value_usd: number | null
      weight_kg: number | null
      weight_lbs: number | null
      box_length_cm: number | null
      box_width_cm:  number | null
      box_height_cm: number | null
      packages: PackageEntry[] | null
      shipping_origins: { name: string; flag_emoji: string | null } | null
      haiti_regions:    { name: string } | null
      haiti_cities:     { name: string } | null
      product_types:    { name: string } | null
    } | null
  } | null
}

const W  = 210
const M  = 14
const CW = W - M * 2

function fmtHTG(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' HTG'
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

export function downloadOrderPDF(order: OrderForPDF) {
  const doc  = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const req  = order.quotes?.product_requests
  const quot = order.quotes
  let y = M

  // helpers
  function setColor(r: number, g: number, b: number) { doc.setTextColor(r, g, b) }
  function bold(size: number)   { doc.setFont('helvetica', 'bold');   doc.setFontSize(size) }
  function normal(size: number) { doc.setFont('helvetica', 'normal'); doc.setFontSize(size) }

  // ── TOP ORANGE RULE ────────────────────────────────────────────────────────
  doc.setFillColor(...OG)
  doc.rect(0, 0, W, 3, 'F')
  y = 10

  // ── HEADER: company left / "DEVIS" right ───────────────────────────────────
  bold(18)
  setColor(...OG)
  doc.text('KONVWA', M, y + 7)

  normal(8)
  setColor(...MID)
  doc.text('Importation Chine & USA → Haïti', M, y + 13)
  doc.text('support@konvwa.com  ·  konvwa.com', M, y + 18)

  // DEVIS title — right
  bold(36)
  setColor(...HDR)
  doc.text('DEVIS', W - M, y + 10, { align: 'right' })

  bold(10)
  setColor(...OG)
  doc.text(`# ${order.tracking_code}`, W - M, y + 18, { align: 'right' })

  y += 26

  // ── LIGHT DIVIDER ──────────────────────────────────────────────────────────
  doc.setDrawColor(210, 210, 210)
  doc.setLineWidth(0.3)
  doc.line(M, y, W - M, y)
  y += 7

  // ── CLIENT (left) + META (right) ──────────────────────────────────────────
  normal(8)
  setColor(...MID)
  doc.text('Facturer à', M, y)
  bold(9)
  setColor(...INK)
  doc.text('Client KONVWA', M, y + 5)
  normal(8)
  setColor(...MID)
  doc.text('Haïti', M, y + 10)

  // right meta
  const metaX = W - M
  const metaLX = metaX - 55

  normal(8); setColor(...MID)
  doc.text('Date du Devis :', metaLX, y)
  bold(8); setColor(...INK)
  doc.text(fmtDate(order.created_at), metaX, y, { align: 'right' })

  normal(8); setColor(...MID)
  doc.text('N° de référence :', metaLX, y + 6)
  bold(8); setColor(...INK)
  doc.text(order.tracking_code, metaX, y + 6, { align: 'right' })

  if (req?.shipping_origins) {
    normal(8); setColor(...MID)
    doc.text('Origine :', metaLX, y + 12)
    bold(8); setColor(...INK)
    doc.text(req.shipping_origins.name, metaX, y + 12, { align: 'right' })
  }

  y += 20

  // Objet
  normal(8); setColor(...MID)
  doc.text('Objet :', M, y)
  bold(9); setColor(...INK)
  doc.text('Transport & Importation', M, y + 5)
  y += 13

  // ── LINE ITEMS TABLE ───────────────────────────────────────────────────────
  // Column x positions
  const COL = {
    num:  M,
    desc: M + 10,
    qty:  M + 118,
    rate: M + 140,
    amt:  W - M,
  }

  // Table header row
  doc.setFillColor(...HDR)
  doc.rect(M, y, CW, 8, 'F')
  bold(7.5); setColor(255, 255, 255)
  doc.text('#',           COL.num  + 1,  y + 5)
  doc.text('Article & Description', COL.desc, y + 5)
  doc.text('Quantité',   COL.qty,        y + 5, { align: 'center' })
  doc.text('Taux',       COL.rate + 10,  y + 5, { align: 'right' })
  doc.text('Montant',    COL.amt,        y + 5, { align: 'right' })
  y += 10

  // Build line items
  interface LineItem { num: number; desc: string; sub?: string; qty: string; rate: string; amt: string; amt_raw: number }
  const lines: LineItem[] = []
  let lineNum = 1

  // ── Product ──────────────────────────────────────────────────────────────
  if (quot && req) {
    const pkgs = (req.packages && req.packages.length > 0)
      ? req.packages
      : (req.box_length_cm
          ? [{ number: 1, length_cm: req.box_length_cm, width_cm: req.box_width_cm, height_cm: req.box_height_cm, weight_kg: req.weight_kg, weight_lbs: req.weight_lbs, cbm: null }]
          : [])

    const dimStr = pkgs[0] && pkgs[0].length_cm && pkgs[0].width_cm && pkgs[0].height_cm
      ? `Dimensions: ${pkgs[0].length_cm}×${pkgs[0].width_cm}×${pkgs[0].height_cm} cm`
      : ''
    const wtKg = req.weight_kg ?? (req.weight_lbs ? req.weight_lbs * 0.453592 : null)
    const wtStr = wtKg ? `Poids: ${wtKg.toFixed(1)} kg` : ''
    const sub = [dimStr, wtStr].filter(Boolean).join('  ·  ')
    const unitPrice = quot.product_price / Math.max(quot.quantity, 1)

    lines.push({
      num: lineNum++,
      desc: req.product_name,
      sub: sub || undefined,
      qty:  `${quot.quantity}.00`,
      rate: unitPrice.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      amt:  quot.product_price.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      amt_raw: quot.product_price,
    })

    // ── CBM / Fret ────────────────────────────────────────────────────────
    if (pkgs.length > 0) {
      const totalCBM = pkgs.reduce((s, p) => {
        return s + (p.cbm ?? (p.length_cm && p.width_cm && p.height_cm ? (p.length_cm * p.width_cm * p.height_cm) / 1_000_000 : 0))
      }, 0)
      if (totalCBM > 0 && quot.shipping_fee > 0) {
        const ratePerCBM = quot.shipping_fee / totalCBM
        lines.push({
          num: lineNum++,
          desc: 'Fret maritime / aérien (CBM)',
          qty:  `${totalCBM.toFixed(4)} m³`,
          rate: ratePerCBM.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          amt:  quot.shipping_fee.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          amt_raw: quot.shipping_fee,
        })
      } else if (quot.shipping_fee > 0) {
        lines.push({
          num: lineNum++,
          desc: 'Frais d\'expédition',
          qty:  '1.00',
          rate: quot.shipping_fee.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          amt:  quot.shipping_fee.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          amt_raw: quot.shipping_fee,
        })
      }
    } else if (quot.shipping_fee > 0) {
      lines.push({
        num: lineNum++,
        desc: 'Frais d\'expédition',
        qty:  '1.00',
        rate: quot.shipping_fee.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        amt:  quot.shipping_fee.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        amt_raw: quot.shipping_fee,
      })
    }

    // ── Frais de réception entrepôt Chine ─────────────────────────────────
    if (quot.purchase_fee > 0) {
      lines.push({
        num: lineNum++,
        desc: 'Frais de réception entrepôt Chine',
        qty:  '1.00',
        rate: quot.purchase_fee.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        amt:  quot.purchase_fee.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        amt_raw: quot.purchase_fee,
      })
    }

    // ── Droits de douane ──────────────────────────────────────────────────
    if (quot.customs_fee > 0) {
      lines.push({
        num: lineNum++,
        desc: 'Droits de douane',
        qty:  '1.00',
        rate: quot.customs_fee.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        amt:  quot.customs_fee.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        amt_raw: quot.customs_fee,
      })
    }

    // ── Frais de service ──────────────────────────────────────────────────
    if (quot.service_fee > 0) {
      lines.push({
        num: lineNum++,
        desc: 'Frais de service KONVWA',
        qty:  '1.00',
        rate: quot.service_fee.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        amt:  quot.service_fee.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        amt_raw: quot.service_fee,
      })
    }

    // ── Livraison locale ──────────────────────────────────────────────────
    if (quot.local_delivery_fee > 0) {
      lines.push({
        num: lineNum++,
        desc: 'Livraison locale en Haïti',
        qty:  '1.00',
        rate: quot.local_delivery_fee.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        amt:  quot.local_delivery_fee.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        amt_raw: quot.local_delivery_fee,
      })
    }

    // ── Expédition séparée ────────────────────────────────────────────────
    if (order.shipping_amount_paid && order.shipping_amount_paid > 0 && order.chosen_shipping_method) {
      lines.push({
        num: lineNum++,
        desc: `Expédition séparée — ${order.chosen_shipping_method.name}`,
        sub: `${order.chosen_shipping_method.duration_days_min}–${order.chosen_shipping_method.duration_days_max} jours`,
        qty:  '1.00',
        rate: order.shipping_amount_paid.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        amt:  order.shipping_amount_paid.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        amt_raw: order.shipping_amount_paid,
      })
    }
  }

  // Render line items
  let totalAmt = 0
  for (let i = 0; i < lines.length; i++) {
    const item = lines[i]
    const rowH = item.sub ? 12 : 9
    const bg = i % 2 === 0 ? [255, 255, 255] : [250, 250, 250]
    doc.setFillColor(...(bg as [number, number, number]))
    doc.rect(M, y, CW, rowH, 'F')

    // num
    normal(8); setColor(...MID)
    doc.text(String(item.num), COL.num + 1, y + 5.5)

    // desc + optional sub-line
    bold(8); setColor(...INK)
    doc.text(item.desc, COL.desc, y + 5.5)
    if (item.sub) {
      normal(7); setColor(...MID)
      doc.text(item.sub, COL.desc, y + 10)
    }

    // qty
    normal(8); setColor(...INK)
    doc.text(item.qty, COL.qty, y + 5.5, { align: 'center' })

    // rate
    normal(8); setColor(...MID)
    doc.text(item.rate, COL.rate + 10, y + 5.5, { align: 'right' })

    // amount
    bold(8); setColor(...INK)
    doc.text(item.amt, COL.amt, y + 5.5, { align: 'right' })

    // row divider
    doc.setDrawColor(230, 230, 230)
    doc.setLineWidth(0.15)
    doc.line(M, y + rowH, W - M, y + rowH)

    totalAmt += item.amt_raw
    y += rowH
  }

  y += 4

  // ── TOTALS ─────────────────────────────────────────────────────────────────
  const totalsX = W - M - 60
  const totalsW = 60

  // Sous-total
  doc.setFillColor(...LGT)
  doc.rect(totalsX, y, totalsW, 8, 'F')
  normal(8); setColor(...MID)
  doc.text('Sous-total', totalsX + 4, y + 5.5)
  bold(8); setColor(...INK)
  doc.text(fmtHTG(totalAmt), W - M, y + 5.5, { align: 'right' })
  y += 8

  // Total — dark band
  doc.setFillColor(...HDR)
  doc.rect(totalsX, y, totalsW, 10, 'F')
  bold(9); setColor(255, 255, 255)
  doc.text('Total', totalsX + 4, y + 6.5)
  bold(10); setColor(255, 255, 255)
  doc.text(fmtHTG(quot?.total ?? totalAmt), W - M, y + 6.5, { align: 'right' })
  y += 14

  // Already paid
  if (order.total_paid > 0) {
    const isPaid = order.payment_status === 'paid'
    doc.setFillColor(isPaid ? 236 : 254, isPaid ? 253 : 243, isPaid ? 243 : 199)
    doc.rect(totalsX, y, totalsW, 8, 'F')
    normal(8); setColor(isPaid ? 22 : 146, isPaid ? 163 : 64, isPaid ? 74 : 14)
    doc.text('Déjà payé', totalsX + 4, y + 5.5)
    bold(8)
    doc.text(fmtHTG(order.total_paid), W - M, y + 5.5, { align: 'right' })
    y += 10
  }

  y += 8

  // ── REMARQUES ─────────────────────────────────────────────────────────────
  bold(8); setColor(...HDR)
  doc.text('Remarques', M, y)
  y += 5
  normal(8); setColor(...MID)
  doc.text('Au plaisir de faire affaire avec vous. Pour toute question, contactez support@konvwa.com.', M, y, { maxWidth: CW })
  y += 9

  // ── CONDITIONS ────────────────────────────────────────────────────────────
  bold(8); setColor(...HDR)
  doc.text("Conditions d'utilisation", M, y)
  y += 5
  normal(7.5); setColor(...MID)
  const terms = [
    "NB : En cas de différence entre les informations fournies et celles de l'entrepôt, le devis sera modifié.",
    "À compter de l'arrivée du colis en Haïti, un délai de 10 jours ouvrables est offert pour le retrait.",
    "Passé ce délai, des frais d'entreposage seront facturés jusqu'au retrait complet du colis.",
  ]
  for (const t of terms) {
    doc.text('• ' + t, M, y, { maxWidth: CW })
    y += 6
  }

  // ── FOOTER ────────────────────────────────────────────────────────────────
  const footerY = 285
  doc.setFillColor(245, 245, 245)
  doc.rect(0, footerY - 2, W, 14, 'F')
  doc.setFillColor(...OG)
  doc.rect(0, footerY - 2, 3, 14, 'F')
  normal(7); setColor(...MID)
  doc.text('Document généré automatiquement par KONVWA · Ce devis est valide comme preuve de commande.', W / 2, footerY + 3, { align: 'center' })
  bold(7); setColor(...OG)
  doc.text(order.tracking_code, W / 2, footerY + 9, { align: 'center' })

  doc.save(`KONVWA-DEVIS-${order.tracking_code}.pdf`)
}
