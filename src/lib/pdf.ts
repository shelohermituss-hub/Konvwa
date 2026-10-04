import jsPDF from 'jspdf'
import { cargoStatusLabel } from '@/lib/cargo-tracking'

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
  chosen_shipping_rate?: { name: string; transit_days_min: number; transit_days_max: number } | null
  quotes: {
    created_at?: string
    valid_until?: string | null
    notes?: string | null
    margin?: number | null
    contingency?: number | null
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

/**
 * jsPDF's built-in fonts only know Latin-1 (WinAnsi). Locale-formatted numbers use narrow no-break spaces, and names or texts can hold
 * arrows or emoji: all of those printed as garbage. Everything is normalised here before it reaches the page.
 */
export function pdfSafe(text: string): string {
  return String(text)
    .replace(/[\u202F\u2009\u00A0\u2007]/g, ' ')
    .replace(/\u2192/g, '>').replace(/\u2190/g, '<')
    .replace(/[\u2018\u2019]/g, '\'').replace(/[\u201C\u201D]/g, '"')
    .replace(/[^\u0020-\u007E\u00A1-\u00FF\u2013\u2014\u2022\u2026\u20AC\n]/g, '')
    .replace(/ {3,}/g, '  ')
}

function newDoc(): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const text = doc.text.bind(doc) as (t: string | string[], ...rest: unknown[]) => jsPDF
  const clean = (t: string | string[]) => (Array.isArray(t) ? t.map(pdfSafe) : pdfSafe(t))
  ;(doc as unknown as { text: typeof text }).text = (t, ...rest) => text(clean(t), ...rest)
  const split = doc.splitTextToSize.bind(doc)
  ;(doc as unknown as { splitTextToSize: typeof split }).splitTextToSize = (t, w, o) => split(pdfSafe(t), w, o)
  return doc
}

export interface PdfCustomer { name: string; phone?: string | null; email?: string | null }

/** Same footer on every page: designed by + page x / n. */
function drawFooters(doc: jsPDF, logo: string | null) {
  const n = doc.getNumberOfPages()
  for (let i = 1; i <= n; i++) {
    doc.setPage(i)
    const footerY = 285
    doc.setDrawColor(...RULE); doc.setLineWidth(0.3)
    doc.line(M, footerY, W - M, footerY)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...MID)
    doc.text(tr('CONÇU PAR'), M, footerY + 6)
    if (logo) doc.addImage(logo, 'PNG', M + 22, footerY + 1, 11, 7.2)
    doc.setFont('helvetica', 'bold'); doc.text('KONVWA', M + 34, footerY + 6)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7)
    doc.text(`${i} / ${n}`, W - M, footerY + 6, { align: 'right' })
  }
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

export async function downloadOrderPDF(order: OrderForPDF, customer?: PdfCustomer): Promise<void> {
  const logo = await loadLogo()

  const doc  = newDoc()
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
  function ensure(h: number) { if (y + h > 275) { doc.addPage(); y = M } }

  const paid = order.payment_status === 'paid'
  const PAYMENT_LABEL: Record<string, string> = {
    paid: tr('Payé'), partial: tr('Paiement échelonné'), unpaid: tr('Non payé'), refunded: tr('Remboursé'),
  }

  // ── SECTION 1 — HEADER ───────────────────────────────────────────────────────
  const LOGO_W = 22
  const LOGO_H = LOGO_W * (72 / 110)
  if (logo) doc.addImage(logo, 'PNG', M, y, LOGO_W, LOGO_H)

  const coY = y + LOGO_H + 3
  bold(10); clr(...INK)
  L('KONVWA', coY)
  normal(8); clr(...MID)
  L(tr('Importation Chine & USA → Haïti'), coY + 5)
  L('support@konvwa.com', coY + 9.5)
  L('konvwa.shop', coY + 14)

  // A paid order is an invoice; before payment it is a quote
  bold(40); clr(...DARK)
  R(paid ? tr('FACTURE') : tr('DEVIS'), y + 18)
  bold(11); clr(...INK)
  R(`# ${order.tracking_code}`, y + 27)

  y = Math.max(coY + 18, y + 34)
  y = rule(y)

  // ── SECTION 2 — CLIENT (left) + META (right) ──────────────────────────────
  const metaLabelX = W - M - 62
  const quoteDate = quot?.created_at ?? order.created_at

  normal(8); clr(...MID)
  L(tr('Facturer à'), y)
  bold(9); clr(...INK)
  L(customer?.name?.trim() || tr('Client KONVWA'), y + 5.5)
  normal(8); clr(...MID)
  let cy = y + 10.5
  if (customer?.phone) { L(customer.phone, cy); cy += 4.5 }
  if (customer?.email) { L(customer.email, cy); cy += 4.5 }
  const dest = [req?.haiti_cities?.name, req?.haiti_regions?.name].filter(Boolean).join(', ')
  if (dest) { L(`${tr('Livraison :')} ${dest}`, cy); cy += 4.5 }

  const meta: Array<[string, string]> = [
    [paid ? tr('Date de la commande :') : tr('Date du devis :'), fmtDate(paid ? order.created_at : quoteDate)],
    [tr('N° de référence :'), order.tracking_code],
    [tr('Statut du paiement :'), PAYMENT_LABEL[order.payment_status] ?? order.payment_status],
  ]
  if (req?.shipping_origins) meta.push([tr('Origine :'), req.shipping_origins.name])
  if (!paid && quot?.valid_until) meta.push([tr('Valable jusqu\'au :'), fmtDate(quot.valid_until)])
  if (quot?.estimated_delivery_days) meta.push([tr('Livraison estimée :'), tr('{0} jours', quot.estimated_delivery_days)])
  meta.forEach(([k, v], i) => {
    normal(8); clr(...MID); L(k, y + i * 5.5, metaLabelX)
    normal(8); clr(...INK); R(v, y + i * 5.5)
  })

  y += Math.max(meta.length * 5.5, cy - y) + 6

  // ── Objet ────────────────────────────────────────────────────────────────────
  normal(8); clr(...MID)
  L(tr('Objet :'), y)
  y += 5.5
  bold(9); clr(...INK)
  const objet = order.shipping_option === 'separate'
    ? tr('Achat et importation (expédition séparée)')
    : tr('Achat et importation (tout inclus)')
  L(req?.product_name ? `${objet} - ${req.product_name}` : objet, y)
  y += 10

  // ── SECTION 3 — LINE ITEMS TABLE ────────────────────────────────────────────
  const C_NUM  = M
  const C_DESC = M + 10
  const C_QTY  = M + 112
  const C_RATE = M + 148
  const C_AMT  = W - M
  const DESC_W = C_QTY - C_DESC - 14

  doc.setFillColor(50, 50, 50)
  doc.rect(M, y, CW, 9, 'F')
  bold(7.5); clr(255, 255, 255)
  L('#',             y + 6, C_NUM + 2)
  L(tr('Article & Description'), y + 6, C_DESC)
  doc.text(tr('Quantité'), C_QTY, y + 6, { align: 'center' })
  doc.text(tr('Taux (HTG)'),    C_RATE, y + 6, { align: 'right' })
  doc.text(tr('Montant (HTG)'), C_AMT,  y + 6, { align: 'right' })
  y += 9

  interface LineItem { desc: string; sub?: string; qty: string; rate: number; amt: number }
  const lines: LineItem[] = []
  let quoteTotalFromLines = 0

  if (quot) {
    const pkgs = (req?.packages && req.packages.length > 0)
      ? req.packages
      : (req?.box_length_cm
          ? [{ number: 1, length_cm: req.box_length_cm, width_cm: req.box_width_cm, height_cm: req.box_height_cm, weight_kg: req.weight_kg, weight_lbs: req.weight_lbs, cbm: null }]
          : [])
    const p0 = pkgs[0]
    const dimStr = (p0 && p0.length_cm && p0.width_cm && p0.height_cm)
      ? tr('Dimensions: {0}×{1}×{2} cm', p0.length_cm, p0.width_cm, p0.height_cm)
      : ''
    const wtKg = req?.weight_kg ?? (req?.weight_lbs ? req.weight_lbs * 0.453592 : (p0?.weight_kg ?? null))
    const wtStr = wtKg ? tr('Poids: {0} kg', wtKg.toFixed(1)) : ''
    const platform = req?.source_platform ? req.source_platform.toUpperCase() : ''
    const sub = [platform, dimStr, wtStr].filter(Boolean).join('  ·  ')

    // product_price is the UNIT price: amount = unit price × quantity
    const qty = Math.max(quot.quantity, 1)
    lines.push({
      desc: req?.product_name ?? tr('Produit'),
      sub: sub || undefined,
      qty: String(qty),
      rate: quot.product_price,
      amt: quot.product_price * qty,
    })

    if (quot.shipping_fee > 0) {
      const totalCBM = pkgs.reduce((sum, p) => sum + (p.cbm ?? ((p.length_cm && p.width_cm && p.height_cm) ? (p.length_cm * p.width_cm * p.height_cm) / 1_000_000 : 0)), 0)
      if (totalCBM > 0) {
        lines.push({ desc: tr('Fret (volume)'), qty: totalCBM.toFixed(2) + ' CBM', rate: quot.shipping_fee / totalCBM, amt: quot.shipping_fee })
      } else {
        lines.push({ desc: tr('Frais d\'expédition'), qty: '1', rate: quot.shipping_fee, amt: quot.shipping_fee })
      }
    }
    if (quot.purchase_fee > 0)       lines.push({ desc: tr('Frais d\'achat'),               qty: '1', rate: quot.purchase_fee,       amt: quot.purchase_fee })
    if (quot.customs_fee > 0)        lines.push({ desc: tr('Droits de douane'),             qty: '1', rate: quot.customs_fee,        amt: quot.customs_fee })
    if (quot.service_fee > 0)        lines.push({ desc: tr('Frais de service KONVWA'),      qty: '1', rate: quot.service_fee,        amt: quot.service_fee })
    if (quot.local_delivery_fee > 0) lines.push({ desc: tr('Livraison locale en Haïti'),    qty: '1', rate: quot.local_delivery_fee, amt: quot.local_delivery_fee })
    const other = (quot.margin ?? 0) + (quot.contingency ?? 0)
    if (other > 0)                   lines.push({ desc: tr('Frais de gestion et imprévus'), qty: '1', rate: other,                   amt: other })

    // whatever else is in the quote total (never leave the printed total different from the amount the customer sees in the app)
    quoteTotalFromLines = lines.reduce((sum, l) => sum + l.amt, 0)
    const gap = quot.total - quoteTotalFromLines
    if (Math.abs(gap) >= 0.5) lines.push({ desc: tr('Ajustement'), qty: '1', rate: gap, amt: gap })
  }

  // Expédition séparée (payée par le client au moment de l'arrivée en entrepôt)
  if (order.shipping_amount_paid && order.shipping_amount_paid > 0) {
    const rate = order.chosen_shipping_rate
    const method = order.chosen_shipping_method
    const name = rate?.name ?? method?.name
    const dMin = rate?.transit_days_min ?? method?.duration_days_min
    const dMax = rate?.transit_days_max ?? method?.duration_days_max
    lines.push({
      desc: name ? tr('Expédition séparée — {0}', name) : tr('Expédition séparée'),
      sub: dMin != null && dMax != null ? tr('{0}–{1} jours', dMin, dMax) : undefined,
      qty: '1',
      rate: order.shipping_amount_paid,
      amt: order.shipping_amount_paid,
    })
  }

  let grandTotal = 0
  for (let i = 0; i < lines.length; i++) {
    const item = lines[i]
    const descLines = doc.splitTextToSize(item.desc, DESC_W) as string[]
    const rowH = 7 + descLines.length * 4.2 + (item.sub ? 4.5 : 0)
    ensure(rowH)

    doc.setDrawColor(...RULE); doc.setLineWidth(0.2)
    doc.line(M, y + rowH, W - M, y + rowH)

    normal(8); clr(...MID)
    L(String(i + 1), y + 6, C_NUM + 2)

    bold(8); clr(...INK)
    doc.text(descLines, C_DESC, y + 6)
    if (item.sub) {
      normal(7.5); clr(...MID)
      L(item.sub, y + 6 + descLines.length * 4.2, C_DESC)
    }

    normal(8); clr(...INK)
    doc.text(item.qty, C_QTY, y + 6, { align: 'center' })
    doc.text(fmtHTG(item.rate), C_RATE, y + 6, { align: 'right' })
    doc.text(fmtHTG(item.amt), C_AMT, y + 6, { align: 'right' })

    grandTotal += item.amt
    y += rowH
  }

  y += 3
  ensure(50)

  // ── TOTALS ──────────────────────────────────────────────────────────────────
  const TOT_LX = W - M - 70
  const TOT_RX = W - M

  doc.setDrawColor(...RULE); doc.setLineWidth(0.2)
  doc.line(TOT_LX, y, TOT_RX, y)
  y += 6
  normal(8); clr(...MID)
  doc.text(tr('Sous-total'), TOT_LX, y)
  normal(8); clr(...INK)
  doc.text(fmtHTG(grandTotal), TOT_RX, y, { align: 'right' })
  y += 2
  doc.line(TOT_LX, y, TOT_RX, y)
  y += 4

  doc.setFillColor(50, 50, 50)
  doc.rect(TOT_LX, y, 70, 9, 'F')
  bold(9); clr(255, 255, 255)
  doc.text(tr('Total'), TOT_LX + 3, y + 6)
  doc.text(`${fmtHTG(grandTotal)} HTG`, TOT_RX - 3, y + 6, { align: 'right' })
  y += 13

  if (order.total_paid > 0) {
    normal(8); clr(...MID)
    doc.text(tr('Déjà payé :'), TOT_LX, y)
    normal(8); clr(22, 163, 74)
    doc.text(fmtHTG(order.total_paid) + ' HTG', TOT_RX, y, { align: 'right' })
    y += 6
  }
  const remaining = Math.max(grandTotal - (order.total_paid ?? 0), 0)
  if (order.payment_status !== 'refunded' && remaining >= 0.5) {
    bold(8.5); clr(...INK)
    doc.text(tr('Reste à payer :'), TOT_LX, y)
    doc.text(fmtHTG(remaining) + ' HTG', TOT_RX, y, { align: 'right' })
    y += 6
  }
  y += 8

  // ── REMARQUES ─────────────────────────────────────────────────────────────
  ensure(60)
  bold(9); clr(...INK)
  L(tr('Remarques'), y)
  y += 5
  normal(8); clr(...INK)
  if (quot?.notes) {
    const noteLines = doc.splitTextToSize(quot.notes, CW) as string[]
    doc.text(noteLines, M, y)
    y += noteLines.length * 4.6 + 2
  }
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
    const termLines = doc.splitTextToSize(t, CW) as string[]
    doc.text(termLines, M, y)
    y += termLines.length * 5 + 2
  }

  drawFooters(doc, logo)
  doc.save(tr(paid ? 'KONVWA-FACTURE-{0}.pdf' : 'KONVWA-DEVIS-{0}.pdf', order.tracking_code))
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
  paid_amount_htg?: number | null
  late_fee_htg?: number | null
  payment_plan?: string | null
  payment_due_at?: string | null
  tracking_status?: string | null
  shipment?: { status: string } | null
  insured?: boolean
  insurance_fee_htg?: number | null
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

export async function downloadShippingPDF(req: ShippingRequestForPDF, customer?: PdfCustomer): Promise<void> {
  const logo = await loadLogo()
  const doc = newDoc()
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
  L('konvwa.shop', coY + 14)

  bold(38); clr(...DARK); R(tr('EXPÉDITION'), y + 18)
  bold(11); clr(...INK);  R(`# ${req.id.slice(0, 8).toUpperCase()}`, y + 27)

  y = Math.max(coY + 18, y + 34)
  y = rule(y)

  // CLIENT + STATUS + DATE
  const statusText = cargoStatusLabel({ status: req.status, payment_plan: req.payment_plan, tracking_status: req.tracking_status, shipment: req.shipment ?? null })
  normal(8); clr(...MID); L(tr('Client'), y)
  bold(9); clr(...INK); L(customer?.name?.trim() || tr('Client KONVWA'), y + 5.5)
  normal(8); clr(...MID)
  let cy = y + 10.5
  if (customer?.phone) { L(customer.phone, cy); cy += 4.5 }
  if (customer?.email) { L(customer.email, cy); cy += 4.5 }
  const metaX = W - M - 70
  const meta: Array<[string, string]> = [
    [tr('Statut :'), statusText],
    [tr('Date soumission :'), fmtDate(req.created_at)],
  ]
  if (req.quoted_at) meta.push([tr('Date du devis :'), fmtDate(req.quoted_at)])
  if (req.invoiced_at) meta.push([tr('Date de paiement :'), fmtDate(req.invoiced_at)])
  meta.forEach(([k, v], i) => {
    normal(8); clr(...MID); L(k, y + i * 5.5, metaX)
    bold(8); clr(...INK); R(v, y + i * 5.5)
  })
  y += Math.max(meta.length * 5.5, cy - y) + 6

  // WAREHOUSE
  if (req.warehouse) {
    y = rule(y)
    bold(9);   clr(...INK); L(tr('Entrepôt de destination'), y); y += 6
    normal(8); clr(...INK)
    L(req.warehouse.name, y); y += 5
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
    doc.setDrawColor(...RULE); doc.setLineWidth(0.15)
    doc.line(M, y + 2.4, W - M, y + 2.4)
    y += 7
  }
  y += 5

  // AMOUNT BLOCK
  const amount = req.actual_amount_htg ?? req.quoted_amount_htg
  if (amount != null) {
    const paidFull = req.status === 'invoiced'
    const amountLabel = paidFull ? tr('Montant payé') : req.status === 'quoted' ? tr('Devis à payer') : tr('Montant total')
    doc.setFillColor(50, 50, 50)
    doc.rect(M, y, CW, 12, 'F')
    bold(9);  clr(255, 255, 255); L(amountLabel, y + 7.5, M + 3)
    bold(10); clr(255, 255, 255); R(`${fmtHTG(amount)} HTG`, y + 7.5, W - M - 3)
    y += 18

    const pay: Array<[string, string]> = []
    if (req.status === 'deposit_paid') {
      const paidAmt = req.paid_amount_htg ?? 0
      pay.push([tr('Acompte payé'), `${fmtHTG(paidAmt)} HTG`])
      pay.push([tr('Solde à régler à la livraison'), `${fmtHTG(Math.max((req.quoted_amount_htg ?? amount) - paidAmt, 0))} HTG`])
    }
    if ((req.late_fee_htg ?? 0) > 0) pay.push([tr('Frais de retard'), `${fmtHTG(req.late_fee_htg ?? 0)} HTG`])
    if (req.insured && (req.insurance_fee_htg ?? 0) > 0) pay.push([tr('Assurance'), `${fmtHTG(req.insurance_fee_htg ?? 0)} HTG`])
    if (req.status === 'quoted' && req.payment_due_at) pay.push([tr('À régler avant le'), fmtDate(req.payment_due_at)])
    for (const [label, value] of pay) {
      normal(8); clr(...MID); L(label, y)
      bold(8);   clr(...INK); R(value, y)
      y += 6
    }
    if (pay.length) y += 3
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

  drawFooters(doc, logo)
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
  const doc = newDoc()
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
  L('konvwa.shop', coY + 14)

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

  drawFooters(doc, logo)
  doc.save(tr('KONVWA-RECU-{0}.pdf', receiptNumber(tx)))
}
