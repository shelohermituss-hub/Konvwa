import jsPDF from 'jspdf'

// Palette
const OG  = [240, 90, 40]   as const  // orange primaire
const INK = [10, 22, 40]    as const  // fond sombre
const MID = [100, 116, 139] as const  // gris moyen
const LIT = [241, 245, 249] as const  // gris très clair

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
const CW = W - M * 2  // content width = 182

function fmtHTG(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' HTG'
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}
function statusLabel(s: string) {
  const map: Record<string, string> = {
    submitted: 'Soumis', pending: 'En attente', quote_sent: 'Devis envoyé',
    awaiting_payment: 'En attente paiement', paid: 'Paye', processing: 'En traitement',
    shipped: 'Expedie', in_transit: 'En transit', delivered: 'Livre', cancelled: 'Annule',
  }
  return map[s] ?? s
}

export function downloadOrderPDF(order: OrderForPDF) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const req  = order.quotes?.product_requests
  const quot = order.quotes
  let y = 0

  // ── Helpers ──────────────────────────────────────────────────────────────

  function setColor(r: number, g: number, b: number) { doc.setTextColor(r, g, b) }
  function setBold(size: number)   { doc.setFont('helvetica', 'bold');   doc.setFontSize(size) }
  function setNormal(size: number) { doc.setFont('helvetica', 'normal'); doc.setFontSize(size) }

  function textLeft(t: string, yy: number)  { doc.text(t, M, yy) }
  function textRight(t: string, yy: number) { doc.text(t, W - M, yy, { align: 'right' }) }

  function divider(yy: number, light = false) {
    if (light) doc.setDrawColor(226, 232, 240)
    else       doc.setDrawColor(...OG)
    doc.setLineWidth(light ? 0.2 : 0.4)
    doc.line(M, yy, W - M, yy)
    return yy + 4
  }

  function labelValue(label: string, value: string, yy: number, valueColor?: readonly [number, number, number]) {
    setNormal(8)
    setColor(...MID)
    textLeft(label, yy)
    setBold(8.5)
    setColor(...(valueColor ?? INK))
    textRight(value, yy)
    return yy + 5.5
  }

  function sectionTitle(title: string, yy: number) {
    doc.setFillColor(...OG)
    doc.rect(M, yy, 2, 5, 'F')
    setBold(8)
    setColor(...OG)
    doc.text(title.toUpperCase(), M + 4.5, yy + 4)
    return yy + 9
  }

  // ── HEADER ───────────────────────────────────────────────────────────────
  doc.setFillColor(...OG)
  doc.rect(0, 0, W, 44, 'F')

  // Diagonal accent
  doc.setFillColor(220, 72, 24)
  doc.triangle(W - 50, 0, W, 0, W, 44, 'F')

  // Brand name
  setBold(26)
  setColor(255, 255, 255)
  textLeft('KONVWA', 19)

  setNormal(8)
  setColor(255, 220, 200)
  textLeft('Importation depuis la Chine & USA vers Haiti', 27)
  textLeft('Recu de commande', 34)

  // Tracking + date (right side)
  setBold(12)
  setColor(255, 255, 255)
  textRight(order.tracking_code, 19)
  setNormal(8)
  setColor(255, 220, 200)
  textRight(fmtDate(order.created_at), 27)

  // Status badge
  const isPaid   = order.payment_status === 'paid'
  const badgeClr = isPaid ? [16, 185, 129] : [245, 158, 11]
  doc.setFillColor(...(badgeClr as [number, number, number]))
  doc.roundedRect(W - M - 32, 30, 32, 8, 1.5, 1.5, 'F')
  setBold(7.5)
  setColor(255, 255, 255)
  doc.text(statusLabel(order.status).toUpperCase(), W - M - 16, 35.5, { align: 'center' })

  y = 54

  // ── INFOS COMMANDE (left) + ROUTE (right) ────────────────────────────────
  const midX = W / 2 + 3

  // Left block header
  sectionTitle('Commande', y)
  // Right block header
  doc.setFillColor(...OG)
  doc.rect(midX, y, 2, 5, 'F')
  setBold(8)
  setColor(...OG)
  doc.text('ROUTE D\'EXPEDITION', midX + 4.5, y + 4)

  y += 9

  // Left column rows
  function leftRow(lbl: string, val: string, yy: number) {
    setNormal(8); setColor(...MID); doc.text(lbl, M, yy)
    setBold(8.5); setColor(...INK); doc.text(val, midX - 4, yy, { align: 'right' })
    return yy + 5.5
  }
  // Right column rows
  function rightRow(lbl: string, val: string, yy: number) {
    setNormal(8); setColor(...MID); doc.text(lbl, midX + 4.5, yy)
    setBold(8.5); setColor(...INK); doc.text(val, W - M, yy, { align: 'right' })
    return yy + 5.5
  }

  let yL = y
  let yR = y

  yL = leftRow('Date',    fmtDate(order.created_at), yL)
  yL = leftRow('Produit', req?.product_name ?? '—', yL)
  yL = leftRow('Qté',     `${quot?.quantity ?? 1} unité(s)`, yL)
  yL = leftRow('Plat.',   (req?.source_platform ?? '—').toUpperCase(), yL)
  if (req?.product_types?.name) yL = leftRow('Type colis', req.product_types.name, yL)
  if (req?.invoice_value_usd)   yL = leftRow('Val. declaree', `$${req.invoice_value_usd.toFixed(2)}`, yL)

  if (req?.shipping_origins) yR = rightRow('Origine', req.shipping_origins.name, yR)
  yR = rightRow('Destination', 'Haiti', yR)
  if (req?.haiti_regions) yR = rightRow('Region', req.haiti_regions.name, yR)
  if (req?.haiti_cities)  yR = rightRow('Ville',  req.haiti_cities.name,  yR)
  if (quot?.estimated_delivery_days) {
    const d = new Date(order.created_at)
    d.setDate(d.getDate() + quot.estimated_delivery_days)
    yR = rightRow('Livraison est.', fmtDate(d.toISOString()), yR)
  }

  y = Math.max(yL, yR) + 4

  // ── COLIS ────────────────────────────────────────────────────────────────
  y = divider(y)
  y = sectionTitle('Colis expedies', y)

  const pkgs: PackageEntry[] = (req?.packages && req.packages.length > 0)
    ? req.packages
    : (req?.box_length_cm
        ? [{
            number: 1,
            length_cm: req.box_length_cm,
            width_cm:  req.box_width_cm,
            height_cm: req.box_height_cm,
            weight_kg: req.weight_kg,
            weight_lbs: req.weight_lbs,
            cbm: (req.box_length_cm && req.box_width_cm && req.box_height_cm)
              ? (req.box_length_cm * req.box_width_cm * req.box_height_cm) / 1_000_000
              : null,
          }]
        : [])

  if (pkgs.length === 0) {
    setNormal(8); setColor(...MID)
    textLeft('Aucune dimension renseignee', y)
    y += 7
  } else {
    // Table header
    doc.setFillColor(...LIT)
    doc.rect(M, y - 3, CW, 7, 'F')
    setBold(7.5); setColor(...MID)
    doc.text('COLIS', M + 2, y + 1)
    doc.text('DIMENSIONS (cm)', M + 20, y + 1)
    doc.text('CBM (m3)', M + 105, y + 1)
    doc.text('POIDS', W - M - 2, y + 1, { align: 'right' })
    y += 8

    let totalCBM    = 0
    let totalWeightKg = 0

    for (const p of pkgs) {
      setNormal(8); setColor(...INK)
      doc.text(`#${p.number}`, M + 2, y)

      const dim = (p.length_cm && p.width_cm && p.height_cm)
        ? `${p.length_cm} x ${p.width_cm} x ${p.height_cm}`
        : '—'
      doc.text(dim, M + 20, y)

      const cbm = p.cbm ?? (p.length_cm && p.width_cm && p.height_cm
        ? (p.length_cm * p.width_cm * p.height_cm) / 1_000_000
        : 0)
      totalCBM += cbm
      doc.text(cbm ? cbm.toFixed(4) : '—', M + 105, y)

      const wt = p.weight_kg
        ? `${p.weight_kg.toFixed(2)} kg`
        : p.weight_lbs ? `${p.weight_lbs.toFixed(2)} lbs` : '—'
      setBold(8); setColor(...INK)
      doc.text(wt, W - M - 2, y, { align: 'right' })

      if (p.weight_kg) totalWeightKg += p.weight_kg
      y += 5.5

      // light divider between packages
      if (p !== pkgs[pkgs.length - 1]) {
        doc.setDrawColor(...LIT)
        doc.setLineWidth(0.15)
        doc.line(M, y - 1.5, W - M, y - 1.5)
      }
    }

    // Totals row
    doc.setFillColor(254, 247, 242)
    doc.rect(M, y - 1, CW, 7, 'F')
    setBold(8); setColor(...OG)
    doc.text('TOTAL', M + 2, y + 3)
    setNormal(8); setColor(...INK)
    doc.text(`${totalCBM.toFixed(4)} m3`, M + 105, y + 3)
    if (totalWeightKg > 0) doc.text(`${totalWeightKg.toFixed(2)} kg`, W - M - 2, y + 3, { align: 'right' })
    y += 10
  }

  // ── DÉTAIL FINANCIER ─────────────────────────────────────────────────────
  if (quot) {
    y = divider(y)
    y = sectionTitle('Detail financier', y)

    y = labelValue('Prix du produit', fmtHTG(quot.product_price * quot.quantity), y)
    y = labelValue('Frais maritimes',  fmtHTG(quot.shipping_fee), y)
    if (quot.purchase_fee)      y = labelValue("Frais d'achat",    fmtHTG(quot.purchase_fee), y)
    if (quot.customs_fee)       y = labelValue('Droits de douane',  fmtHTG(quot.customs_fee), y)
    if (quot.service_fee)       y = labelValue('Frais de service',  fmtHTG(quot.service_fee), y)
    if (quot.local_delivery_fee) y = labelValue('Livraison locale', fmtHTG(quot.local_delivery_fee), y)

    y += 2

    // Total bar
    doc.setFillColor(...OG)
    doc.rect(M, y, CW, 13, 'F')
    setBold(9); setColor(255, 255, 255)
    doc.text('TOTAL', M + 4, y + 8)
    setBold(12)
    textRight(fmtHTG(quot.total), y + 8)

    y += 16

    // Already paid
    if (order.total_paid > 0) {
      y = labelValue('Montant regle', fmtHTG(order.total_paid), y, [16, 185, 129])
      const solde = quot.total - order.total_paid
      if (Math.abs(solde) > 1) {
        y = labelValue('Solde restant', fmtHTG(solde), y, solde > 0 ? [239, 68, 68] : [16, 185, 129])
      }
    }
  }

  // ── FOOTER ───────────────────────────────────────────────────────────────
  const footerY = 282
  doc.setFillColor(...LIT)
  doc.rect(0, footerY - 4, W, 19, 'F')
  setNormal(7.5); setColor(...MID)
  doc.text('Document genere automatiquement par KONVWA · Ce recu est valide comme preuve de commande.', W / 2, footerY + 1, { align: 'center' })
  doc.text('konvwa.com · support@konvwa.com', W / 2, footerY + 7, { align: 'center' })
  setBold(7.5); setColor(...OG)
  doc.text(order.tracking_code, W / 2, footerY + 13, { align: 'center' })

  doc.save(`KONVWA-${order.tracking_code}.pdf`)
}
