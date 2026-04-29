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
          company_name: string | null;
          address_1: string | null;
          address_2: string | null;
          logo_url: string | null;
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
          company_name?: string | null;
          address_1?: string | null;
          address_2?: string | null;
          logo_url?: string | null;
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
          company_name?: string | null;
          address_1?: string | null;
          address_2?: string | null;
          logo_url?: string | null;
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
          is_main: boolean;
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
          is_main?: boolean;
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
          is_main?: boolean;
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
      installment_plans: {
        Row: {
          id: string;
          org_id: string;
          transaction_id: string;
          downpayment: number;
          hc_amount: number;
          terms: number;
          status: "pending" | "received";
          received_at: string | null;
          received_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          transaction_id: string;
          downpayment?: number;
          hc_amount: number;
          terms: number;
          status?: "pending" | "received";
          received_at?: string | null;
          received_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          transaction_id?: string;
          downpayment?: number;
          hc_amount?: number;
          terms?: number;
          status?: "pending" | "received";
          received_at?: string | null;
          received_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      customers: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          email: string | null;
          phone: string | null;
          address: string | null;
          company_name: string | null;
          tax_id: string | null;
          notes: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          company_name?: string | null;
          tax_id?: string | null;
          notes?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          name?: string;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          company_name?: string | null;
          tax_id?: string | null;
          notes?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
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
          supplier_id: string | null;
          unit: string;
          cost_price: number;
          selling_price: number;
          image_url: string | null;
          is_active: boolean;
          serial_required: boolean;
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
          supplier_id?: string | null;
          unit?: string;
          cost_price: number;
          selling_price: number;
          image_url?: string | null;
          is_active?: boolean;
          serial_required?: boolean;
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
          supplier_id?: string | null;
          unit?: string;
          cost_price?: number;
          selling_price?: number;
          image_url?: string | null;
          is_active?: boolean;
          serial_required?: boolean;
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
      quotation_items: {
        Row: {
          id: string;
          quotation_id: string;
          product_id: string | null;
          bundle_id: string | null;
          product_name: string;
          quantity: number;
          unit_price: number;
          discount_amount: number;
          add_tax_pct: number;
          total: number;
        };
        Insert: {
          id?: string;
          quotation_id: string;
          product_id?: string | null;
          bundle_id?: string | null;
          product_name: string;
          quantity: number;
          unit_price: number;
          discount_amount?: number;
          add_tax_pct?: number;
          total: number;
        };
        Update: {
          id?: string;
          quotation_id?: string;
          product_id?: string | null;
          bundle_id?: string | null;
          product_name?: string;
          quantity?: number;
          unit_price?: number;
          discount_amount?: number;
          add_tax_pct?: number;
          total?: number;
        };
        Relationships: [];
      };
      quotations: {
        Row: {
          id: string;
          org_id: string;
          customer_id: string;
          branch_id: string;
          created_by: string;
          status: "draft" | "sent" | "accepted" | "rejected" | "expired" | "converted";
          valid_until: string | null;
          subtotal: number;
          discount_amount: number;
          tax_amount: number;
          add_tax_amount: number;
          tax_rate: number;
          total: number;
          notes: string | null;
          transaction_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          customer_id: string;
          branch_id: string;
          created_by: string;
          status?: "draft" | "sent" | "accepted" | "rejected" | "expired" | "converted";
          valid_until?: string | null;
          subtotal?: number;
          discount_amount?: number;
          tax_amount?: number;
          add_tax_amount?: number;
          tax_rate?: number;
          total?: number;
          notes?: string | null;
          transaction_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          customer_id?: string;
          branch_id?: string;
          created_by?: string;
          status?: "draft" | "sent" | "accepted" | "rejected" | "expired" | "converted";
          valid_until?: string | null;
          subtotal?: number;
          discount_amount?: number;
          tax_amount?: number;
          add_tax_amount?: number;
          tax_rate?: number;
          total?: number;
          notes?: string | null;
          transaction_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      transactions: {
        Row: {
          id: string;
          branch_id: string;
          cashier_id: string;
          customer_id: string | null;
          subtotal: number;
          discount_amount: number;
          tax_amount: number;
          total: number;
          payment_method: "cash" | "card" | "split" | "gcash" | "maya" | "check" | "e_wallet" | "home_credit";
          status: "completed" | "voided" | "held";
          notes: string | null;
          void_reason: string | null;
          voided_by: string | null;
          voided_at: string | null;
          check_bank_name: string | null;
          check_date: string | null;
          check_number: string | null;
          check_name: string | null;
          check_amount: number | null;
          ewallet_provider: string | null;
          ewallet_reference: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          branch_id: string;
          cashier_id: string;
          customer_id?: string | null;
          subtotal: number;
          discount_amount?: number;
          tax_amount?: number;
          total: number;
          payment_method: "cash" | "card" | "split" | "gcash" | "maya" | "check" | "e_wallet" | "home_credit";
          status?: "completed" | "voided" | "held";
          notes?: string | null;
          void_reason?: string | null;
          voided_by?: string | null;
          voided_at?: string | null;
          check_bank_name?: string | null;
          check_date?: string | null;
          check_number?: string | null;
          check_name?: string | null;
          check_amount?: number | null;
          ewallet_provider?: string | null;
          ewallet_reference?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          branch_id?: string;
          cashier_id?: string;
          customer_id?: string | null;
          subtotal?: number;
          discount_amount?: number;
          tax_amount?: number;
          total?: number;
          payment_method?: "cash" | "card" | "split" | "gcash" | "maya" | "check" | "e_wallet";
          status?: "completed" | "voided" | "held";
          notes?: string | null;
          void_reason?: string | null;
          voided_by?: string | null;
          voided_at?: string | null;
          check_bank_name?: string | null;
          check_date?: string | null;
          check_number?: string | null;
          check_name?: string | null;
          check_amount?: number | null;
          ewallet_provider?: string | null;
          ewallet_reference?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      transaction_items: {
        Row: {
          id: string;
          transaction_id: string;
          product_id: string | null;
          bundle_id: string | null;
          product_name: string;
          quantity: number;
          unit_price: number;
          discount_amount: number;
          total: number;
          serials: string[];
          component_serials: Record<string, string[]> | null;
        };
        Insert: {
          id?: string;
          transaction_id: string;
          product_id?: string | null;
          bundle_id?: string | null;
          product_name: string;
          quantity: number;
          unit_price: number;
          discount_amount?: number;
          total: number;
          serials?: string[];
          component_serials?: Record<string, string[]> | null;
        };
        Update: {
          id?: string;
          transaction_id?: string;
          product_id?: string | null;
          bundle_id?: string | null;
          product_name?: string;
          quantity?: number;
          unit_price?: number;
          discount_amount?: number;
          total?: number;
          serials?: string[];
          component_serials?: Record<string, string[]> | null;
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
      branch_stock_requests: {
        Row: {
          id: string;
          requesting_branch_id: string;
          status: "pending" | "in_progress" | "fulfilled" | "cancelled";
          notes: string | null;
          created_by: string;
          fulfillment_transfer_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          requesting_branch_id: string;
          status?: "pending" | "in_progress" | "fulfilled" | "cancelled";
          notes?: string | null;
          created_by: string;
          fulfillment_transfer_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          requesting_branch_id?: string;
          status?: "pending" | "in_progress" | "fulfilled" | "cancelled";
          notes?: string | null;
          created_by?: string;
          fulfillment_transfer_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      branch_stock_request_items: {
        Row: {
          id: string;
          request_id: string;
          product_id: string;
          quantity: number;
        };
        Insert: {
          id?: string;
          request_id: string;
          product_id: string;
          quantity: number;
        };
        Update: {
          id?: string;
          request_id?: string;
          product_id?: string;
          quantity?: number;
        };
        Relationships: [];
      };
      product_suppliers: {
        Row: {
          id: string;
          product_id: string;
          supplier_id: string;
          cost_price: number;
          is_default: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          supplier_id: string;
          cost_price: number;
          is_default?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          supplier_id?: string;
          cost_price?: number;
          is_default?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      product_supplier_stock: {
        Row: {
          id: string;
          product_id: string;
          supplier_id: string;
          branch_id: string;
          quantity: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          supplier_id: string;
          branch_id: string;
          quantity?: number;
          updated_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          supplier_id?: string;
          branch_id?: string;
          quantity?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      transaction_item_supplier_costs: {
        Row: {
          id: string;
          transaction_item_id: string;
          supplier_id: string | null;
          quantity: number;
          unit_cost: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          transaction_item_id: string;
          supplier_id?: string | null;
          quantity: number;
          unit_cost: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          transaction_item_id?: string;
          supplier_id?: string | null;
          quantity?: number;
          unit_cost?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      bundles: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          description: string | null;
          price: number;
          image_url: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          description?: string | null;
          price: number;
          image_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          name?: string;
          description?: string | null;
          price?: number;
          image_url?: string | null;
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      bundle_items: {
        Row: {
          id: string;
          bundle_id: string;
          product_id: string;
          quantity: number;
        };
        Insert: {
          id?: string;
          bundle_id: string;
          product_id: string;
          quantity: number;
        };
        Update: {
          id?: string;
          bundle_id?: string;
          product_id?: string;
          quantity?: number;
        };
        Relationships: [];
      };
      expenses: {
        Row: {
          id: string;
          org_id: string;
          category: string;
          date: string;
          amount: number;
          note: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          category: string;
          date: string;
          amount: number;
          note?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          category?: string;
          date?: string;
          amount?: number;
          note?: string | null;
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
export type Customer = Database["public"]["Tables"]["customers"]["Row"];
export type Quotation = Database["public"]["Tables"]["quotations"]["Row"];
export type QuotationItem =
  Database["public"]["Tables"]["quotation_items"]["Row"];
export type QuotationStatus = Quotation["status"];
export type BranchStockRequest =
  Database["public"]["Tables"]["branch_stock_requests"]["Row"];
export type BranchStockRequestItem =
  Database["public"]["Tables"]["branch_stock_request_items"]["Row"];
export type BranchRequestStatus = BranchStockRequest["status"];

export type ProductSupplier = Database["public"]["Tables"]["product_suppliers"]["Row"];
export type ProductSupplierStock = Database["public"]["Tables"]["product_supplier_stock"]["Row"];
export type TransactionItemSupplierCost = Database["public"]["Tables"]["transaction_item_supplier_costs"]["Row"];
export type Bundle = Database["public"]["Tables"]["bundles"]["Row"];
export type BundleItem = Database["public"]["Tables"]["bundle_items"]["Row"];
export type Expense = Database["public"]["Tables"]["expenses"]["Row"];

export type BranchStockRequestWithRelations = BranchStockRequest & {
  requesting_branch: { name: string } | null;
  creator: { full_name: string } | null;
  branch_stock_request_items: Array<
    BranchStockRequestItem & {
      product: { name: string; sku: string } | null;
    }
  >;
};
