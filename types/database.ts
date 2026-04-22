export type Database = {
  // Required by @supabase/supabase-js v2.99+ for correct generic type inference
  __InternalSupabase: {
    PostgrestVersion: "12"
  }
  public: {
    Views: Record<string, never>
    Functions: Record<string, never>
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          currency_code: string;
          currency_locale: string;
          tax_rate: number;
          gcash_qr_url: string | null;
          maya_qr_url: string | null;
          receipt_header: string | null;
          receipt_footer: string | null;
          max_cashier_discount_pct: number;
          manager_override_pin: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          currency_code?: string;
          currency_locale?: string;
          tax_rate?: number;
          gcash_qr_url?: string | null;
          maya_qr_url?: string | null;
          receipt_header?: string | null;
          receipt_footer?: string | null;
          max_cashier_discount_pct?: number;
          manager_override_pin?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          currency_code?: string;
          currency_locale?: string;
          tax_rate?: number;
          gcash_qr_url?: string | null;
          maya_qr_url?: string | null;
          receipt_header?: string | null;
          receipt_footer?: string | null;
          max_cashier_discount_pct?: number;
          manager_override_pin?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      branches: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          address: string | null;
          phone: string | null;
          timezone: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          address?: string | null;
          phone?: string | null;
          timezone?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          name?: string;
          address?: string | null;
          phone?: string | null;
          timezone?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          clerk_user_id: string;
          org_id: string;
          branch_id: string | null;
          role: "owner" | "manager" | "cashier";
          full_name: string;
          email: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          clerk_user_id: string;
          org_id: string;
          branch_id?: string | null;
          role: "owner" | "manager" | "cashier";
          full_name: string;
          email: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          clerk_user_id?: string;
          org_id?: string;
          branch_id?: string | null;
          role?: "owner" | "manager" | "cashier";
          full_name?: string;
          email?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          org_id: string;
          sku: string;
          barcode: string | null;
          name: string;
          description: string | null;
          category_id: string | null;
          unit: string;
          cost_price: number;
          selling_price: number;
          image_url: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          sku: string;
          barcode?: string | null;
          name: string;
          description?: string | null;
          category_id?: string | null;
          unit?: string;
          cost_price: number;
          selling_price: number;
          image_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          sku?: string;
          barcode?: string | null;
          name?: string;
          description?: string | null;
          category_id?: string | null;
          unit?: string;
          cost_price?: number;
          selling_price?: number;
          image_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      inventory: {
        Row: {
          id: string;
          product_id: string;
          branch_id: string;
          quantity: number;
          low_stock_threshold: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          branch_id: string;
          quantity?: number;
          low_stock_threshold?: number;
          updated_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          branch_id?: string;
          quantity?: number;
          low_stock_threshold?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      inventory_movements: {
        Row: {
          id: string;
          product_id: string;
          branch_id: string;
          type:
            | "sale"
            | "purchase"
            | "adjustment"
            | "transfer_in"
            | "transfer_out"
            | "damage";
          quantity: number;
          reference_id: string | null;
          notes: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          branch_id: string;
          type:
            | "sale"
            | "purchase"
            | "adjustment"
            | "transfer_in"
            | "transfer_out"
            | "damage";
          quantity: number;
          reference_id?: string | null;
          notes?: string | null;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          branch_id?: string;
          type?:
            | "sale"
            | "purchase"
            | "adjustment"
            | "transfer_in"
            | "transfer_out"
            | "damage";
          quantity?: number;
          reference_id?: string | null;
          notes?: string | null;
          created_by?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      suppliers: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          contact_name: string | null;
          email: string | null;
          phone: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          contact_name?: string | null;
          email?: string | null;
          phone?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          name?: string;
          contact_name?: string | null;
          email?: string | null;
          phone?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      purchase_orders: {
        Row: {
          id: string;
          supplier_id: string;
          branch_id: string;
          status: "draft" | "ordered" | "partial" | "received" | "cancelled";
          total: number;
          notes: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          supplier_id: string;
          branch_id: string;
          status?: "draft" | "ordered" | "partial" | "received" | "cancelled";
          total?: number;
          notes?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          supplier_id?: string;
          branch_id?: string;
          status?: "draft" | "ordered" | "partial" | "received" | "cancelled";
          total?: number;
          notes?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      purchase_order_items: {
        Row: {
          id: string;
          po_id: string;
          product_id: string;
          quantity_ordered: number;
          quantity_received: number;
          unit_cost: number;
        };
        Insert: {
          id?: string;
          po_id: string;
          product_id: string;
          quantity_ordered: number;
          quantity_received?: number;
          unit_cost: number;
        };
        Update: {
          id?: string;
          po_id?: string;
          product_id?: string;
          quantity_ordered?: number;
          quantity_received?: number;
          unit_cost?: number;
        };
        Relationships: [];
      };
      transactions: {
        Row: {
          id: string;
          branch_id: string;
          cashier_id: string;
          subtotal: number;
          discount_amount: number;
          tax_amount: number;
          total: number;
          payment_method: "cash" | "card" | "split" | "gcash" | "maya";
          status: "completed" | "voided" | "held";
          notes: string | null;
          void_reason: string | null;
          voided_by: string | null;
          voided_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          branch_id: string;
          cashier_id: string;
          subtotal: number;
          discount_amount?: number;
          tax_amount?: number;
          total: number;
          payment_method: "cash" | "card" | "split" | "gcash" | "maya";
          status?: "completed" | "voided" | "held";
          notes?: string | null;
          void_reason?: string | null;
          voided_by?: string | null;
          voided_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          branch_id?: string;
          cashier_id?: string;
          subtotal?: number;
          discount_amount?: number;
          tax_amount?: number;
          total?: number;
          payment_method?: "cash" | "card" | "split" | "gcash" | "maya";
          status?: "completed" | "voided" | "held";
          notes?: string | null;
          void_reason?: string | null;
          voided_by?: string | null;
          voided_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      transaction_items: {
        Row: {
          id: string;
          transaction_id: string;
          product_id: string;
          product_name: string;
          quantity: number;
          unit_price: number;
          discount_amount: number;
          total: number;
        };
        Insert: {
          id?: string;
          transaction_id: string;
          product_id: string;
          product_name: string;
          quantity: number;
          unit_price: number;
          discount_amount?: number;
          total: number;
        };
        Update: {
          id?: string;
          transaction_id?: string;
          product_id?: string;
          product_name?: string;
          quantity?: number;
          unit_price?: number;
          discount_amount?: number;
          total?: number;
        };
        Relationships: [];
      };
      stock_transfers: {
        Row: {
          id: string;
          from_branch_id: string;
          to_branch_id: string;
          status:
            | "pending"
            | "approved"
            | "in_transit"
            | "completed"
            | "cancelled";
          notes: string | null;
          created_by: string;
          approved_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          from_branch_id: string;
          to_branch_id: string;
          status?:
            | "pending"
            | "approved"
            | "in_transit"
            | "completed"
            | "cancelled";
          notes?: string | null;
          created_by: string;
          approved_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          from_branch_id?: string;
          to_branch_id?: string;
          status?:
            | "pending"
            | "approved"
            | "in_transit"
            | "completed"
            | "cancelled";
          notes?: string | null;
          created_by?: string;
          approved_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      stock_transfer_items: {
        Row: {
          id: string;
          transfer_id: string;
          product_id: string;
          quantity: number;
        };
        Insert: {
          id?: string;
          transfer_id: string;
          product_id: string;
          quantity: number;
        };
        Update: {
          id?: string;
          transfer_id?: string;
          product_id?: string;
          quantity?: number;
        };
        Relationships: [];
      };
    };
  };
};

// Convenience row types
export type Organization = Database["public"]["Tables"]["organizations"]["Row"];
export type Branch = Database["public"]["Tables"]["branches"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Category = Database["public"]["Tables"]["categories"]["Row"];
export type Product = Database["public"]["Tables"]["products"]["Row"];
export type Inventory = Database["public"]["Tables"]["inventory"]["Row"];
export type InventoryMovement =
  Database["public"]["Tables"]["inventory_movements"]["Row"];
export type Supplier = Database["public"]["Tables"]["suppliers"]["Row"];
export type PurchaseOrder =
  Database["public"]["Tables"]["purchase_orders"]["Row"];
export type PurchaseOrderItem =
  Database["public"]["Tables"]["purchase_order_items"]["Row"];
export type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
export type TransactionItem =
  Database["public"]["Tables"]["transaction_items"]["Row"];
export type StockTransfer =
  Database["public"]["Tables"]["stock_transfers"]["Row"];
export type StockTransferItem =
  Database["public"]["Tables"]["stock_transfer_items"]["Row"];
