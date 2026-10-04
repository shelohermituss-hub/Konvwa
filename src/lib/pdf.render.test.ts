import { describe, expect, it, vi } from 'vitest'
import { writeFileSync } from 'node:fs'
import { downloadOrderPDF, downloadShippingPDF, type OrderForPDF, type ShippingRequestForPDF } from './pdf'

const OUT = process.env.PDF_OUT ?? ''
const saved: Array<{ name: string; data: ArrayBuffer }> = []

vi.mock('jspdf', async (importOriginal) => {
  const mod = await importOriginal<typeof import('jspdf')>()
  class Capturing extends mod.default {
    constructor(...args: ConstructorParameters<typeof mod.default>) {
      super(...args)
      ;(this as unknown as { save: (name?: string) => void }).save = (name?: string) => { saved.push({ name: name ?? 'x.pdf', data: this.output('arraybuffer') }) }
    }
  }
  return { ...mod, default: Capturing }
})

describe.skipIf(!OUT)('render sample PDFs (manual: PDF_OUT=<dir> npm test)', () => {
  it('renders', async () => {
    const order = {
      tracking_code: 'ORD-8C41741A', status: 'shipping_paid', payment_status: 'paid', created_at: '2026-10-03T10:00:00Z', total_paid: 29781,
      shipping_option: 'separate', shipping_amount_paid: 16590, shipping_paid_at: '2026-10-04T10:00:00Z',
      chosen_shipping_rate: { name: 'Océan Standard 15-22j', transit_days_min: 15, transit_days_max: 22 },
      quotes: { created_at: '2026-10-02T10:00:00Z', valid_until: '2026-10-09T10:00:00Z', notes: null, margin: 1000, contingency: 2000,
        total: 13191, product_price: 133, quantity: 12, service_fee: 558, purchase_fee: 3000, shipping_fee: 1848, customs_fee: 689, local_delivery_fee: 2500,
        estimated_delivery_days: 35,
        product_requests: { product_name: 'Chaussette de football antidérapante, très longue description de produit', source_platform: 'alibaba', invoice_value_usd: null, weight_kg: 4, weight_lbs: null,
          box_length_cm: 40, box_width_cm: 30, box_height_cm: 20, packages: null, shipping_origins: { name: 'Shenzhen, CN Warehouse', flag_emoji: '🇨🇳' },
          haiti_regions: { name: 'Ouest' }, haiti_cities: { name: 'Port-au-Prince' }, product_types: null } },
    } as unknown as OrderForPDF
    await downloadOrderPDF(order, { name: 'Shelo Hermitus', phone: '+509 3000 0000', email: 'shelo@example.com' })
    const ship = {
      id: 'abcdef12-0000', status: 'deposit_paid', created_at: '2026-10-02T10:00:00Z', quoted_at: '2026-10-02T11:00:00Z', invoiced_at: null,
      package_count: 2, estimated_cbm: 0.34, actual_cbm: 0.21, estimated_kg: 54, actual_kg: 54, quoted_amount_htg: 45722, actual_amount_htg: 45722,
      paid_amount_htg: 22861, late_fee_htg: 0, payment_plan: 'half', payment_due_at: null, tracking_status: 'arrived_haiti', shipment: { status: 'arrived_haiti' },
      notes: null, origin_country: 'CN', product_rate_category: { name: 'Marque / Branded' },
      warehouse: { name: 'Guangzhou', flag_emoji: '🇨🇳', country_code: 'CN', address_line1: '1 Rue Test', address_line2: null, address_line3: null, city: 'Guangzhou', state: 'GD', postal_code: '510000', contact_info: 'WeChat: konvwa' },
    } as unknown as ShippingRequestForPDF
    await downloadShippingPDF(ship, { name: 'Shelo Hermitus', phone: '+509 3000 0000', email: 'shelo@example.com' })
    saved.forEach((f) => writeFileSync(`${OUT}/${f.name}`, Buffer.from(f.data)))
    expect(saved.length).toBe(2)
  })
})
