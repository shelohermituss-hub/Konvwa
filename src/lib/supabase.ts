import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          user_id: string
          full_name: string
          phone: string | null
          role: 'client' | 'agent' | 'manager' | 'admin'
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          full_name: string
          phone?: string | null
          role?: 'client' | 'agent' | 'manager' | 'admin'
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          full_name?: string
          phone?: string | null
          role?: 'client' | 'agent' | 'manager' | 'admin'
          avatar_url?: string | null
          updated_at?: string
        }
      }
      wallets: {
        Row: {
          id: string
          user_id: string
          available_balance: number
          blocked_balance: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          available_balance?: number
          blocked_balance?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          available_balance?: number
          blocked_balance?: number
          updated_at?: string
        }
      }
      wallet_transactions: {
        Row: {
          id: string
          wallet_id: string
          type: 'deposit' | 'withdrawal' | 'payment' | 'refund' | 'block' | 'unblock'
          amount: number
          status: 'pending' | 'completed' | 'failed' | 'cancelled'
          reference: string | null
          payment_method: 'moncash' | 'natcash' | 'wallet' | null
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          wallet_id: string
          type: 'deposit' | 'withdrawal' | 'payment' | 'refund' | 'block' | 'unblock'
          amount: number
          status?: 'pending' | 'completed' | 'failed' | 'cancelled'
          reference?: string | null
          payment_method?: 'moncash' | 'natcash' | 'wallet' | null
          description?: string | null
          created_at?: string
        }
        Update: {
          status?: 'pending' | 'completed' | 'failed' | 'cancelled'
        }
      }
      addresses: {
        Row: {
          id: string
          user_id: string
          label: string
          address_line1: string
          address_line2: string | null
          city: string
          phone: string | null
          is_default: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          label: string
          address_line1: string
          address_line2?: string | null
          city: string
          phone?: string | null
          is_default?: boolean
          created_at?: string
        }
        Update: {
          label?: string
          address_line1?: string
          address_line2?: string | null
          city?: string
          phone?: string | null
          is_default?: boolean
        }
      }
      product_requests: {
        Row: {
          id: string
          user_id: string
          product_url: string
          product_name: string
          category: string | null
          quantity: number
          variant_info: Json | null
          budget_estimate: number | null
          urgency: 'normal' | 'urgent' | 'express' | null
          notes: string | null
          status: 'draft' | 'submitted' | 'reviewing' | 'quoted' | 'rejected'
          source_platform: 'alibaba' | 'shein' | 'temu' | 'other' | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          product_url: string
          product_name: string
          category?: string | null
          quantity?: number
          variant_info?: Json | null
          budget_estimate?: number | null
          urgency?: 'normal' | 'urgent' | 'express' | null
          notes?: string | null
          status?: 'draft' | 'submitted' | 'reviewing' | 'quoted' | 'rejected'
          source_platform?: 'alibaba' | 'shein' | 'temu' | 'other' | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          product_url?: string
          product_name?: string
          category?: string | null
          quantity?: number
          variant_info?: Json | null
          budget_estimate?: number | null
          urgency?: 'normal' | 'urgent' | 'express' | null
          notes?: string | null
          status?: 'draft' | 'submitted' | 'reviewing' | 'quoted' | 'rejected'
          source_platform?: 'alibaba' | 'shein' | 'temu' | 'other' | null
          updated_at?: string
        }
      }
      quotes: {
        Row: {
          id: string
          request_id: string
          product_price: number
          quantity: number
          service_fee: number
          purchase_fee: number
          shipping_fee: number
          customs_fee: number
          local_delivery_fee: number
          margin: number
          contingency: number
          total: number
          currency: string
          estimated_delivery_days: number | null
          supplier_risk_level: 'low' | 'medium' | 'high' | null
          status: 'pending' | 'accepted' | 'rejected' | 'expired'
          valid_until: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          request_id: string
          product_price: number
          quantity?: number
          service_fee?: number
          purchase_fee?: number
          shipping_fee?: number
          customs_fee?: number
          local_delivery_fee?: number
          margin?: number
          contingency?: number
          total: number
          currency?: string
          estimated_delivery_days?: number | null
          supplier_risk_level?: 'low' | 'medium' | 'high' | null
          status?: 'pending' | 'accepted' | 'rejected' | 'expired'
          valid_until?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          product_price?: number
          quantity?: number
          service_fee?: number
          purchase_fee?: number
          shipping_fee?: number
          customs_fee?: number
          local_delivery_fee?: number
          margin?: number
          contingency?: number
          total?: number
          currency?: string
          estimated_delivery_days?: number | null
          supplier_risk_level?: 'low' | 'medium' | 'high' | null
          status?: 'pending' | 'accepted' | 'rejected' | 'expired'
          valid_until?: string | null
          notes?: string | null
          updated_at?: string
        }
      }
      orders: {
        Row: {
          id: string
          user_id: string
          quote_id: string
          tracking_code: string
          status: 'draft' | 'quote_sent' | 'quote_accepted' | 'awaiting_payment' | 'paid' | 'purchasing' | 'in_china_warehouse' | 'shipped' | 'in_transit' | 'arrived_haiti' | 'customs_processing' | 'out_for_delivery' | 'delivered' | 'closed' | 'cancelled'
          total_paid: number
          payment_status: 'unpaid' | 'partial' | 'paid' | 'refunded'
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          quote_id: string
          tracking_code?: string
          status?: 'draft' | 'quote_sent' | 'quote_accepted' | 'awaiting_payment' | 'paid' | 'purchasing' | 'in_china_warehouse' | 'shipped' | 'in_transit' | 'arrived_haiti' | 'customs_processing' | 'out_for_delivery' | 'delivered' | 'closed' | 'cancelled'
          total_paid?: number
          payment_status?: 'unpaid' | 'partial' | 'paid' | 'refunded'
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          status?: 'draft' | 'quote_sent' | 'quote_accepted' | 'awaiting_payment' | 'paid' | 'purchasing' | 'in_china_warehouse' | 'shipped' | 'in_transit' | 'arrived_haiti' | 'customs_processing' | 'out_for_delivery' | 'delivered' | 'closed' | 'cancelled'
          total_paid?: number
          payment_status?: 'unpaid' | 'partial' | 'paid' | 'refunded'
          notes?: string | null
          updated_at?: string
        }
      }
      suppliers: {
        Row: {
          id: string
          name: string
          source_platform: 'alibaba' | 'shein' | 'temu' | 'other'
          supplier_url: string | null
          country: string | null
          categories: string[] | null
          moq: number | null
          average_production_days: number | null
          average_delivery_days: number | null
          trust_score: number
          verification_status: 'unverified' | 'basic' | 'verified' | 'premium'
          response_rate: number | null
          on_time_delivery_rate: number | null
          quality_rating: number | null
          dispute_count: number
          total_orders: number
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          source_platform: 'alibaba' | 'shein' | 'temu' | 'other'
          supplier_url?: string | null
          country?: string | null
          categories?: string[] | null
          moq?: number | null
          average_production_days?: number | null
          average_delivery_days?: number | null
          trust_score?: number
          verification_status?: 'unverified' | 'basic' | 'verified' | 'premium'
          response_rate?: number | null
          on_time_delivery_rate?: number | null
          quality_rating?: number | null
          dispute_count?: number
          total_orders?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          source_platform?: 'alibaba' | 'shein' | 'temu' | 'other'
          supplier_url?: string | null
          country?: string | null
          categories?: string[] | null
          moq?: number | null
          average_production_days?: number | null
          average_delivery_days?: number | null
          trust_score?: number
          verification_status?: 'unverified' | 'basic' | 'verified' | 'premium'
          response_rate?: number | null
          on_time_delivery_rate?: number | null
          quality_rating?: number | null
          dispute_count?: number
          total_orders?: number
          notes?: string | null
          updated_at?: string
        }
      }
      shipments: {
        Row: {
          id: string
          batch_code: string
          status: 'pending' | 'consolidating' | 'packed' | 'loaded' | 'sailing' | 'arrived' | 'cleared' | 'distributing' | 'completed'
          vessel_info: string | null
          departure_date: string | null
          estimated_arrival: string | null
          actual_arrival: string | null
          container_number: string | null
          weight_kg: number | null
          volume_m3: number | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          batch_code?: string
          status?: 'pending' | 'consolidating' | 'packed' | 'loaded' | 'sailing' | 'arrived' | 'cleared' | 'distributing' | 'completed'
          vessel_info?: string | null
          departure_date?: string | null
          estimated_arrival?: string | null
          actual_arrival?: string | null
          container_number?: string | null
          weight_kg?: number | null
          volume_m3?: number | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          status?: 'pending' | 'consolidating' | 'packed' | 'loaded' | 'sailing' | 'arrived' | 'cleared' | 'distributing' | 'completed'
          vessel_info?: string | null
          departure_date?: string | null
          estimated_arrival?: string | null
          actual_arrival?: string | null
          container_number?: string | null
          weight_kg?: number | null
          volume_m3?: number | null
          notes?: string | null
          updated_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          title: string
          message: string
          type: 'info' | 'success' | 'warning' | 'error' | null
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          message: string
          type?: 'info' | 'success' | 'warning' | 'error' | null
          read_at?: string | null
          created_at?: string
        }
        Update: {
          read_at?: string | null
        }
      }
      support_tickets: {
        Row: {
          id: string
          user_id: string
          order_id: string | null
          subject: string
          status: 'open' | 'in_progress' | 'resolved' | 'closed'
          priority: 'low' | 'normal' | 'high' | 'urgent'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          order_id?: string | null
          subject: string
          status?: 'open' | 'in_progress' | 'resolved' | 'closed'
          priority?: 'low' | 'normal' | 'high' | 'urgent'
          created_at?: string
          updated_at?: string
        }
        Update: {
          status?: 'open' | 'in_progress' | 'resolved' | 'closed'
          priority?: 'low' | 'normal' | 'high' | 'urgent'
          updated_at?: string
        }
      }
      support_messages: {
        Row: {
          id: string
          ticket_id: string
          sender_id: string
          message: string
          attachments: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          ticket_id: string
          sender_id: string
          message: string
          attachments?: Json | null
          created_at?: string
        }
      }
      order_status_history: {
        Row: {
          id: string
          order_id: string
          status: string
          notes: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          status: string
          notes?: string | null
          created_by?: string | null
          created_at?: string
        }
      }
    }
  }
}
