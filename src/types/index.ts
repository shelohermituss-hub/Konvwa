export type UserRole = 'client' | 'agent' | 'manager' | 'admin'

export type OrderStatus =
  | 'draft'
  | 'quote_sent'
  | 'quote_accepted'
  | 'awaiting_payment'
  | 'paid'
  | 'purchasing'
  | 'in_china_warehouse'
  | 'shipped'
  | 'in_transit'
  | 'arrived_haiti'
  | 'customs_processing'
  | 'out_for_delivery'
  | 'delivered'
  | 'closed'
  | 'cancelled'

export type ShipmentStatus =
  | 'pending'
  | 'consolidating'
  | 'packed'
  | 'loaded'
  | 'sailing'
  | 'arrived'
  | 'cleared'
  | 'distributing'
  | 'completed'

export type QuoteStatus = 'pending' | 'accepted' | 'rejected' | 'expired'

export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'refunded'

export type TransactionType = 'deposit' | 'withdrawal' | 'payment' | 'refund' | 'block' | 'unblock'

export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'cancelled'

export type NotificationType = 'info' | 'success' | 'warning' | 'error'

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed'

export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent'

export type Platform = 'alibaba' | 'shein' | 'temu' | 'other'

export type VerificationStatus = 'unverified' | 'basic' | 'verified' | 'premium'

export type RiskLevel = 'low' | 'medium' | 'high'
