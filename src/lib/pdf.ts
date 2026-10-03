import jsPDF from 'jspdf'

import { tr, DATE_LOCALE, LOCALE_TAG } from '@/lib/i18n'
// ── Palette (minimal — mostly grayscale like Basinex) ─────────────────────────
const DARK  = [50,  50,  50]  as const  // "DEVIS" title, table header
const INK   = [30,  30,  30]  as const  // body text
const MID   = [120, 120, 120] as const  // labels / secondary
const RULE  = [200, 200, 200] as const  // dividers

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

const W = 210
const M = 14
const CW = W - M * 2   // 182 mm

function fmtHTG(n: number) {
  return n.toLocaleString(LOCALE_TAG, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(DATE_LOCALE, { day: '2-digit', month: 'short', year: 'numeric' })
}

// Load logo SVG → PNG data URL via canvas
async function loadLogo(): Promise<string | null> {
  try {
    const res = await fetch('/logo.svg')
    if (!res.ok) return null
    const svgText = await res.text()
    const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    return await new Promise<string | null>(resolve => {
      const img = new Image()
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width  = 440   // 4× for crisp print quality
          canvas.height = 288
          const ctx = canvas.getContext('2d')!
          ctx.drawImage(img, 0, 0, 440, 288)
          URL.revokeObjectURL(url)
          resolve(canvas.toDataURL('image/png'))
        } catch { resolve(null) }
      }
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null) }
      img.src = url
    })
  } catch { return null }
}

export async function downloadOrderPDF(order: OrderForPDF): Promise<void> {
  const [logo] = await Promise.all([loadLogo()])

  const doc  = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const req  = order.quotes?.product_requests
  const quot = order.quotes
  let y = M

  // ── Text helpers ────────────────────────────────────────────────────────────
  function clr(r: number, g: number, b: number) { doc.setTextColor(r, g, b) }
  function bold(size: number)   { doc.setFont('helvetica', 'bold');   doc.setFontSize(size) }
  function normal(size: number) { doc.setFont('helvetica', 'normal'); doc.setFontSize(size) }
  function L(text: string, yy: number, x = M)    { doc.text(text, x, yy) }
  function R(text: string, yy: number, x = W - M) { doc.text(text, x, yy, { align: 'right' }) }
  function rule(yy: number) {
    doc.setDrawColor(...RULE); doc.setLineWidth(0.2)
    doc.line(M, yy, W - M, yy)
    return yy + 6
  }

  // ── SECTION 1 — HEADER ───────────────────────────────────────────────────────
  // Logo (left)
  const LOGO_W = 22   // mm wide
  const LOGO_H = LOGO_W * (72 / 110)  // preserve 110:72 aspect → ~14.4mm
  if (logo) {
    doc.addImage(logo, 'PNG', M, y, LOGO_W, LOGO_H)
  }

  // Company info (left, below logo)
  const coY = y + LOGO_H + 3
  bold(10); clr(...INK)
  L('KONVWA', coY)
  normal(8); clr(...MID)
  L(tr('Importation Chine & USA → Haïti'), coY + 5)
  L('support@konvwa.com', coY + 9.5)
  L('konvwa.com', coY + 14)

  // "DEVIS" — top-right, very large, dark gray
  bold(52); clr(...DARK)
  R('DEVIS', y + 18)

  // Reference — right, smaller
  bold(11); clr(...INK)
  R(`# ${order.tracking_code}`, y + 27)

  y = Math.max(coY + 18, y + 34)

  // ── SEPARATOR ────────────────────────────────────────────────────────────────
  y = rule(y)

  // ── SECTION 2 — CLIENT (left) + META (right) ──────────────────────────────
  const metaLabelX = W - M - 52

  // Left: Facturer à
  normal(8); clr(...MID)
  L(tr('Facturer à'), y)
  bold(9); clr(...INK)
  L(tr('Client KONVWA'), y + 5.5)

  // Right: Date + Ref
  normal(8); clr(...MID)
  L(tr('Date du Devis :'), metaLabelX, y)
  normal(8); clr(...INK)
  R(fmtDate(order.created_at), y)

  normal(8); clr(...MID)
  L(tr('N° de référence :'), metaLabelX, y + 6)
  normal(8); clr(...INK)
  R(order.tracking_code, y + 6)

  if (req?.shipping_origins) {
    normal(8); clr(...MID)
    L(tr('Origine :'), metaLabelX, y + 12)
    normal(8); clr(...INK)
    R(req.shipping_origins.name, y + 12)
  }

  y += 22

  // ── Objet ────────────────────────────────────────────────────────────────────
  normal(8); clr(...MID)
  L(tr('Objet :'), y)
  y += 5.5
  bold(9); clr(...INK)
  L(tr('Transport'), y)
  y += 10

  // ── SECTION 3 — LINE ITEMS TABLE ────────────────────────────────────────────
  // Column X positions (absolute mm)
  const C_NUM  = M              // # column left edge
  const C_DESC = M + 10         // description left edge
  const C_QTY  = M + 115        // quantité (center)
  const C_RATE = M + 148        // taux (right edge)
  const C_AMT  = W - M          // montant (right edge)

  // Header row
  doc.setFillColor(50, 50, 50)
  doc.rect(M, y, CW, 9, 'F')
  bold(7.5); clr(255, 255, 255)
  L('#',             y + 6, C_NUM + 2)
  L(tr('Article & Description'), y + 6, C_DESC)
  doc.text(tr('Quantité'), C_QTY, y + 6, { align: 'center' })
  doc.text(tr('Taux'),     C_RATE, y + 6, { align: 'right' })
  doc.text(tr('Montant'),  C_AMT,  y + 6, { align: 'right' })
  y += 9

  // Build line items
  interface LineItem {
    desc: string
    sub?: string
    qty: string
    rate: number
    amt: number
  }
  const lines: LineItem[] = []

  if (quot && req) {
    // ── Product line ───────────────────────────────────────────────────────
    const pkgs = (req.packages && req.packages.length > 0)
      ? req.packages
      : (req.box_length_cm
          ? [{ number: 1, length_cm: req.box_length_cm, width_cm: req.box_width_cm, height_cm: req.box_height_cm, weight_kg: req.weight_kg, weight_lbs: req.weight_lbs, cbm: null }]
          : [])

    const p0 = pkgs[0]
    const dimStr = (p0 && p0.length_cm && p0.width_cm && p0.height_cm)
      ? tr('Dimensions: {0}×{1}×{2} cm', p0.length_cm, p0.width_cm, p0.height_cm)
      : ''
    const wtKg = req.weight_kg ?? (req.weight_lbs ? req.weight_lbs * 0.453592 : (p0?.weight_kg ?? null))
    const wtStr = wtKg ? tr('Poids: {0} kg', wtKg.toFixed(1)) : ''
    const sub = [dimStr, wtStr].filter(Boolean).join('  ·  ')
    const unitPrice = quot.product_price / Math.max(quot.quantity, 1)

    lines.push({
      desc: req.product_name,
      sub: sub || undefined,
      qty:  `${quot.quantity}.00`,
      rate: unitPrice,
      amt:  quot.product_price,
    })

    // ── CBM / Fret ─────────────────────────────────────────────────────────
    if (quot.shipping_fee > 0) {
      const totalCBM = pkgs.reduce((s, p) => s + (p.cbm ?? ((p.length_cm && p.width_cm && p.height_cm) ? (p.length_cm * p.width_cm * p.height_cm) / 1_000_000 : 0)), 0)
      if (totalCBM > 0) {
        const ratePerCBM = quot.shipping_fee / totalCBM
        lines.push({
          desc: 'CBM',
          qty:  `${totalCBM.toFixed(2)}`,
          rate: ratePerCBM,
          amt:  quot.shipping_fee,
        })
      } else {
        lines.push({ desc: tr('Frais d\'expédition'), qty: '1.00', rate: quot.shipping_fee, amt: quot.shipping_fee })
      }
    }

    // ── Frais de réception entrepôt Chine ──────────────────────────────────
    if (quot.purchase_fee > 0) {
      lines.push({ desc: tr('Frais de réception entrepôt Chine'), qty: '1.00', rate: quot.purchase_fee, amt: quot.purchase_fee })
    }

    // ── Droits de douane ───────────────────────────────────────────────────
    if (quot.customs_fee > 0) {
      lines.push({ desc: tr('Droits de douane'), qty: '1.00', rate: quot.customs_fee, amt: quot.customs_fee })
    }

    // ── Frais de service ───────────────────────────────────────────────────
    if (quot.service_fee > 0) {
      lines.push({ desc: tr('Frais de service KONVWA'), qty: '1.00', rate: quot.service_fee, amt: quot.service_fee })
    }

    // ── Livraison locale ───────────────────────────────────────────────────
    if (quot.local_delivery_fee > 0) {
      lines.push({ desc: tr('Livraison locale en Haïti'), qty: '1.00', rate: quot.local_delivery_fee, amt: quot.local_delivery_fee })
    }

    // ── Expédition séparée (payée) ─────────────────────────────────────────
    if (order.shipping_amount_paid && order.shipping_amount_paid > 0 && order.chosen_shipping_method) {
      lines.push({
        desc: tr('Expédition séparée — {0}', order.chosen_shipping_method.name),
        sub: tr('{0}–{1} jours', order.chosen_shipping_method.duration_days_min, order.chosen_shipping_method.duration_days_max),
        qty:  '1.00',
        rate: order.shipping_amount_paid,
        amt:  order.shipping_amount_paid,
      })
    }
  }

  // Render rows
  let grandTotal = 0
  for (let i = 0; i < lines.length; i++) {
    const item = lines[i]
    const rowH = item.sub ? 13 : 9

    // Alternating row bg — very subtle (like Basinex: plain white rows with dividers)
    doc.setFillColor(255, 255, 255)
    doc.rect(M, y, CW, rowH, 'F')

    // Row bottom border
    doc.setDrawColor(...RULE); doc.setLineWidth(0.2)
    doc.line(M, y + rowH, W - M, y + rowH)

    // #
    normal(8); clr(...MID)
    L(String(i + 1), y + 6, C_NUM + 2)

    // Description
    bold(8); clr(...INK)
    L(item.desc, y + 6, C_DESC)
    if (item.sub) {
      normal(7.5); clr(...MID)
      L(item.sub, y + 10.5, C_DESC)
    }

    // Quantité
    normal(8); clr(...INK)
    doc.text(item.qty, C_QTY, y + 6, { align: 'center' })

    // Taux
    normal(8); clr(...INK)
    doc.text(fmtHTG(item.rate), C_RATE, y + 6, { align: 'right' })

    // Montant
    normal(8); clr(...INK)
    doc.text(fmtHTG(item.amt), C_AMT, y + 6, { align: 'right' })

    grandTotal += item.amt
    y += rowH
  }

  y += 3

  // ── TOTALS block (right-aligned, matching Basinex) ───────────────────────
  const TOT_LX = W - M - 60
  const TOT_RX = W - M

  // Sous-total row
  doc.setDrawColor(...RULE); doc.setLineWidth(0.2)
  doc.line(TOT_LX, y, TOT_RX, y)
  y += 6
  normal(8); clr(...MID)
  doc.text(tr('Sous-total'), TOT_LX, y)
  normal(8); clr(...INK)
  doc.text(fmtHTG(grandTotal), TOT_RX, y, { align: 'right' })
  y += 2
  doc.setDrawColor(...RULE); doc.setLineWidth(0.2)
  doc.line(TOT_LX, y, TOT_RX, y)
  y += 4

  // Total row — dark bg
  doc.setFillColor(50, 50, 50)
  doc.rect(TOT_LX, y, 60, 9, 'F')
  bold(9); clr(255, 255, 255)
  doc.text(tr('Total'), TOT_LX + 3, y + 6)
  bold(9)
  doc.text(`${fmtHTG(quot?.total ?? grandTotal)} HTG`, TOT_RX, y + 6, { align: 'right' })
  y += 13

  // "Déjà payé" row (if applicable)
  if (order.total_paid > 0) {
    normal(8); clr(...MID)
    doc.text(tr('Déjà payé :'), TOT_LX, y)
    normal(8); clr(22, 163, 74)
    doc.text(fmtHTG(order.total_paid) + ' HTG', TOT_RX, y, { align: 'right' })
    y += 7
  }

  y += 8

  // ── REMARQUES ─────────────────────────────────────────────────────────────
  bold(9); clr(...INK)
  L(tr('Remarques'), y)
  y += 5
  normal(8); clr(...INK)
  L(tr('Au plaisir de faire affaire avec vous dans le futur.'), y)
  y += 12

  // ── CONDITIONS D'UTILISATION ─────────────────────────────────────────────
  bold(9); clr(...INK)
  L(tr('Conditions d\'utilisation'), y)
  y += 5
  normal(8); clr(...INK)
  const terms = [
    tr('NB : En cas de différence entre les informations fournies et celles de l\'entrepôt, le devis sera modifié.'),
    tr('À compter de l\'arrivée du colis en Haïti, un délai de 10 jours ouvrables est offert pour le retrait.'),
    tr('Passé ce délai, des frais d\'entreposage seront facturés jusqu\'au retrait complet du colis.'),
  ]
  for (const t of terms) {
    const lines2 = doc.splitTextToSize(t, CW)
    doc.text(lines2, M, y)
    y += lines2.length * 5 + 2
  }

  // ── FOOTER ────────────────────────────────────────────────────────────────
  const footerY = 285
  doc.setDrawColor(...RULE); doc.setLineWidth(0.3)
  doc.line(M, footerY, W - M, footerY)

  normal(7.5); clr(...MID)
  doc.text(tr('CONÇU PAR'), M, footerY + 6)
  if (logo) {
    doc.addImage(logo, 'PNG', M + 22, footerY + 1, 11, 7.2)
  }
  bold(7.5); clr(...MID)
  doc.text('KONVWA', M + 34, footerY + 6)

  normal(7); clr(...MID)
  doc.text(String(doc.getNumberOfPages()), W - M, footerY + 6, { align: 'right' })

  doc.save(tr('KONVWA-DEVIS-{0}.pdf', order.tracking_code))
}

// ── Shipping request PDF ──────────────────────────────────────────────────────

export interface ShippingRequestForPDF {
  id: string
  status: string
  created_at: string
  quoted_at: string | null
  invoiced_at: string | null
  package_count: number | null
  estimated_cbm: number | null
  actual_cbm: number | null
  estimated_kg: number | null
  actual_kg: number | null
  quoted_amount_htg: number | null
  actual_amount_htg: number | null
  notes: string | null
  origin_country: string | null
  warehouse: {
    name: string
    flag_emoji: string | null
    country_code: string
    address_line1: string | null
    address_line2: string | null
    address_line3: string | null
    city: string | null
    state: string | null
    postal_code: string | null
    contact_info: string | null
  } | null
  product_rate_category: { name: string } | null
}

export async function downloadShippingPDF(req: ShippingRequestForPDF): Promise<void> {
  const logo = await loadLogo()
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  let y = M

  function clr(r: number, g: number, b: number) { doc.setTextColor(r, g, b) }
  function bold(size: number)   { doc.setFont('helvetica', 'bold');   doc.setFontSize(size) }
  function normal(size: number) { doc.setFont('helvetica', 'normal'); doc.setFontSize(size) }
  function L(text: string, yy: number, x = M)     { doc.text(text, x, yy) }
  function R(text: string, yy: number, x = W - M) { doc.text(text, x, yy, { align: 'right' }) }
  function rule(yy: number) {
    doc.setDrawColor(...RULE); doc.setLineWidth(0.2)
    doc.line(M, yy, W - M, yy)
    return yy + 6
  }

  // HEADER
  const LOGO_W = 22
  const LOGO_H = LOGO_W * (72 / 110)
  if (logo) doc.addImage(logo, 'PNG', M, y, LOGO_W, LOGO_H)

  const coY = y + LOGO_H + 3
  bold(10); clr(...INK);  L('KONVWA', coY)
  normal(8); clr(...MID); L(tr('Importation Chine & USA → Haïti'), coY + 5)
  L('support@konvwa.com', coY + 9.5)
  L('konvwa.com', coY + 14)

  bold(38); clr(...DARK); R(tr('EXPÉDITION'), y + 18)
  bold(11); clr(...INK);  R(`# ${req.id.slice(0, 8).toUpperCase()}`, y + 27)

  y = Math.max(coY + 18, y + 34)
  y = rule(y)

  // STATUS + DATE
  const statusLabels: Record<string, string> = {
    submitted: tr('Soumis'), reviewing: tr('En examen'), received: tr('Colis reçus'),
    quoted: tr('Devis reçu'), invoiced: tr('Payé'),
  }
  normal(8); clr(...MID); L(tr('Statut :'), y)
  bold(8);   clr(...INK); L(statusLabels[req.status] ?? req.status, y, M + 22)
  normal(8); clr(...MID); L(tr('Date soumission :'), W - M - 70, y)
  normal(8); clr(...INK); R(fmtDate(req.created_at), y)
  y += 10

  // WAREHOUSE
  if (req.warehouse) {
    y = rule(y)
    bold(9);   clr(...INK); L(tr('Entrepôt de destination'), y); y += 6
    normal(8); clr(...INK)
    L(`${req.warehouse.flag_emoji ?? ''} ${req.warehouse.name}`, y); y += 5
    if (req.warehouse.address_line1) { L(req.warehouse.address_line1, y); y += 5 }
    if (req.warehouse.address_line2) { L(req.warehouse.address_line2, y); y += 5 }
    if (req.warehouse.address_line3) { L(req.warehouse.address_line3, y); y += 5 }
    const cityLine = [req.warehouse.city, req.warehouse.state, req.warehouse.postal_code].filter(Boolean).join(', ')
    if (cityLine) { L(cityLine, y); y += 5 }
    if (req.warehouse.contact_info) { normal(8); clr(...MID); L(req.warehouse.contact_info, y); y += 5 }
    y += 3
  }

  y = rule(y)

  // DETAILS TABLE
  const rows: [string, string][] = []
  if (req.product_rate_category) rows.push([tr('Type de produit'), req.product_rate_category.name])
  if (req.origin_country) {
    const cn2 = req.origin_country === 'CN' ? tr('Chine') : req.origin_country === 'US' ? tr('États-Unis') : req.origin_country
    rows.push([tr('Origine'), cn2])
  }
  if (req.package_count != null)  rows.push([tr('Nombre de colis'), String(req.package_count)])
  const cbm = req.actual_cbm ?? req.estimated_cbm
  if (cbm != null) rows.push([tr('Volume'), `${cbm.toFixed(4)} m³${!req.actual_cbm ? tr(' (estimé)') : ''}`])
  const kg = req.actual_kg ?? req.estimated_kg
  if (kg != null) rows.push([tr('Poids'), `${kg.toFixed(2)} kg${!req.actual_kg ? tr(' (estimé)') : ''}`])

  for (const [label, value] of rows) {
    normal(8); clr(...MID); L(label, y)
    bold(8);   clr(...INK); R(value, y)
    y += 7
    doc.setDrawColor(...RULE); doc.setLineWidth(0.15)
    doc.line(M, y - 0.5, W - M, y - 0.5)
  }
  y += 5

  // AMOUNT BLOCK
  const amount = req.actual_amount_htg ?? req.quoted_amount_htg
  if (amount != null) {
    doc.setFillColor(50, 50, 50)
    doc.rect(M, y, CW, 12, 'F')
    bold(9);  clr(255, 255, 255); L(tr('Montant'), y + 7.5, M + 3)
    bold(10); clr(255, 255, 255); R(`${fmtHTG(amount)} HTG`, y + 7.5)
    y += 16
  }

  // NOTES
  if (req.notes) {
    y += 4
    bold(9); clr(...INK); L(tr('Notes'), y); y += 5
    normal(8); clr(...INK)
    const lines2 = doc.splitTextToSize(req.notes, CW)
    doc.text(lines2, M, y)
    y += lines2.length * 5 + 4
  }

  // FOOTER
  const footerY = 285
  doc.setDrawColor(...RULE); doc.setLineWidth(0.3)
  doc.line(M, footerY, W - M, footerY)
  normal(7.5); clr(...MID); doc.text(tr('CONÇU PAR'), M, footerY + 6)
  if (logo) doc.addImage(logo, 'PNG', M + 22, footerY + 1, 11, 7.2)
  bold(7.5); clr(...MID); doc.text('KONVWA', M + 34, footerY + 6)
  normal(7); clr(...MID); doc.text(String(doc.getNumberOfPages()), W - M, footerY + 6, { align: 'right' })

  doc.save(tr('KONVWA-EXPEDITION-{0}.pdf', req.id.slice(0, 8).toUpperCase()))
}

// ── Wallet receipt PDF ────────────────────────────────────────────────────────

export interface ReceiptForPDF {
  id: string
  type: string
  amount: number
  status: string
  payment_method: string | null
  description: string | null
  reference: string | null
  created_at: string
}

export function receiptNumber(tx: Pick<ReceiptForPDF, 'id' | 'created_at'>): string {
  const d = new Date(tx.created_at)
  const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`
  return `KW-R-${ymd}-${tx.id.slice(0, 6).toUpperCase()}`
}

export async function downloadReceiptPDF(
  tx: ReceiptForPDF,
  customer: { name: string; email?: string | null },
  labels: { type: string; method: string | null; status: string },
): Promise<void> {
  const logo = await loadLogo()
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  let y = M

  function clr(r: number, g: number, b: number) { doc.setTextColor(r, g, b) }
  function bold(size: number)   { doc.setFont('helvetica', 'bold');   doc.setFontSize(size) }
  function normal(size: number) { doc.setFont('helvetica', 'normal'); doc.setFontSize(size) }
  function L(text: string, yy: number, x = M)     { doc.text(text, x, yy) }
  function R(text: string, yy: number, x = W - M) { doc.text(text, x, yy, { align: 'right' }) }
  function rule(yy: number) {
    doc.setDrawColor(...RULE); doc.setLineWidth(0.2)
    doc.line(M, yy, W - M, yy)
    return yy + 6
  }

  const LOGO_W = 22
  const LOGO_H = LOGO_W * (72 / 110)
  if (logo) doc.addImage(logo, 'PNG', M, y, LOGO_W, LOGO_H)

  const coY = y + LOGO_H + 3
  bold(10); clr(...INK);  L('KONVWA', coY)
  normal(8); clr(...MID); L(tr('Importation Chine & USA → Haïti'), coY + 5)
  L('support@konvwa.com', coY + 9.5)
  L('konvwa.com', coY + 14)

  bold(40); clr(...DARK); R(tr('REÇU'), y + 18)
  bold(11); clr(...INK);  R(`# ${receiptNumber(tx)}`, y + 27)

  y = rule(Math.max(coY + 18, y + 34))

  normal(8); clr(...MID); L(tr('Client'), y)
  bold(10); clr(...INK);  L(customer.name || tr('Client KONVWA'), y + 5.5)
  if (customer.email) { normal(8); clr(...MID); L(customer.email, y + 10.5) }
  normal(8); clr(...MID); L(tr('Date :'), W - M - 52, y)
  normal(8); clr(...INK); R(new Date(tx.created_at).toLocaleString(DATE_LOCALE, { dateStyle: 'medium', timeStyle: 'short' }), y)
  y += 22
  y = rule(y)

  const rows: Array<[string, string]> = [
    [tr('Type'), labels.type],
    ...(labels.method ? [[tr('Méthode'), labels.method] as [string, string]] : []),
    ...(tx.description ? [[tr('Description'), tx.description] as [string, string]] : []),
    ...(tx.reference ? [[tr('Référence'), tx.reference] as [string, string]] : []),
    [tr('ID transaction'), tx.id],
    [tr('Statut'), labels.status],
  ]
  for (const [k, v] of rows) {
    normal(8.5); clr(...MID); L(k, y)
    normal(9); clr(...INK)
    const lines = doc.splitTextToSize(v, CW - 45) as string[]
    doc.text(lines, M + 45, y)
    y += Math.max(6, lines.length * 4.6)
  }
  y = rule(y + 2)

  bold(11); clr(...INK); L(tr('Montant'), y + 6)
  bold(20); clr(...DARK); R(`${fmtHTG(tx.amount)} HTG`, y + 7)
  y += 20

  normal(7.5); clr(...MID)
  const note = doc.splitTextToSize(tr('Ce reçu atteste d\'une opération enregistrée sur votre portefeuille KONVWA. Conservez-le pour vos archives.'), CW) as string[]
  doc.text(note, M, y)

  doc.save(tr('KONVWA-RECU-{0}.pdf', receiptNumber(tx)))
}
