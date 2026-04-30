import { create } from "zustand";
import type { Product } from "@/types/database";
import type { POSBundle } from "@/lib/actions/inventory";

interface CartItem {
  product: Product;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  discount_pct: number;
  add_tax_pct: number;
  serials: string[];
}

export interface BundleCartItem {
  bundle_id: string;
  bundle_name: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  discount_pct: number;
  add_tax_pct: number;
  components: Array<{ product_id: string; product_name: string; quantity: number; serial_required: boolean }>;
  serials: Record<string, string[]>;
}

interface CartStore {
  items: CartItem[];
  bundleItems: BundleCartItem[];
  discount: number;
  taxRate: number;
  // Product item operations
  addItem: (product: Product) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  updateItemDiscount: (productId: string, pct: number) => void;
  updateItemAddTax: (productId: string, pct: number) => void;
  updateItemSerials: (productId: string, serials: string[]) => void;
  // Bundle item operations
  addBundle: (bundle: POSBundle) => void;
  removeBundle: (bundleId: string) => void;
  updateBundleQuantity: (bundleId: string, quantity: number) => void;
  updateBundleItemDiscount: (bundleId: string, pct: number) => void;
  updateBundleItemAddTax: (bundleId: string, pct: number) => void;
  updateBundleSerials: (bundleId: string, productId: string, serials: string[]) => void;
  // Cart-wide
  setDiscount: (discount: number) => void;
  setTaxRate: (rate: number) => void;
  clearCart: () => void;
  setBundleItemsDirect: (items: BundleCartItem[]) => void;
  loadHeldOrder: (
    heldItems: Array<{ product_id: string; product_name: string; quantity: number; unit_price: number; discount_amount: number }>,
    heldBundleItems?: Array<{ bundle_id: string; bundle_name: string; quantity: number; unit_price: number; discount_amount: number; components: Array<{ product_id: string; product_name: string; quantity: number; serial_required: boolean }> }>
  ) => void;
  loadQuotationOrder: (items: Array<{
    product: Product
    quantity: number
    unit_price: number
    discount_amount: number
    add_tax_pct: number
  }>) => void;
  // Computed
  subtotal: () => number;
  totalDiscount: () => number;
  totalAddTax: () => number;
  tax: () => number;
  total: () => number;
  isReadyToCharge: () => boolean;
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  bundleItems: [],
  discount: 0,
  taxRate: 0.12,

  addItem: (product) => {
    const items = get().items;
    const existing = items.find((i) => i.product.id === product.id);
    if (existing) {
      set({
        items: items.map((i) => {
          if (i.product.id !== product.id) return i;
          const quantity = i.quantity + 1;
          const discount_amount = i.unit_price * quantity * (i.discount_pct / 100);
          const serials = i.product.serial_required
            ? [...i.serials, ""]
            : i.serials;
          return { ...i, quantity, discount_amount, serials };
        }),
      });
    } else {
      set({
        items: [
          ...items,
          {
            product,
            quantity: 1,
            unit_price: product.selling_price,
            discount_amount: 0,
            discount_pct: 0,
            add_tax_pct: 0,
            serials: product.serial_required ? [""] : [],
          },
        ],
      });
    }
  },

  removeItem: (productId) =>
    set({ items: get().items.filter((i) => i.product.id !== productId) }),

  updateQuantity: (productId, quantity) => {
    if (quantity <= 0) {
      get().removeItem(productId);
      return;
    }
    set({
      items: get().items.map((i) => {
        if (i.product.id !== productId) return i;
        const discount_amount = i.unit_price * quantity * (i.discount_pct / 100);
        let serials = i.serials;
        if (i.product.serial_required) {
          if (quantity > i.quantity) {
            serials = [...i.serials, ...Array(quantity - i.quantity).fill("")];
          } else {
            serials = i.serials.slice(0, quantity);
          }
        }
        return { ...i, quantity, discount_amount, serials };
      }),
    });
  },

  updateItemDiscount: (productId, pct) =>
    set({
      items: get().items.map((i) => {
        if (i.product.id !== productId) return i;
        const discount_pct = pct;
        const discount_amount = i.unit_price * i.quantity * (pct / 100);
        return { ...i, discount_pct, discount_amount };
      }),
    }),

  updateItemAddTax: (productId, pct) =>
    set({
      items: get().items.map((i) =>
        i.product.id === productId ? { ...i, add_tax_pct: pct } : i
      ),
    }),

  updateItemSerials: (productId, serials) =>
    set({
      items: get().items.map((i) =>
        i.product.id === productId ? { ...i, serials } : i
      ),
    }),

  addBundle: (bundle) => {
    const bundleItems = get().bundleItems;
    const existing = bundleItems.find((b) => b.bundle_id === bundle.id);
    if (existing) {
      set({
        bundleItems: bundleItems.map((b) => {
          if (b.bundle_id !== bundle.id) return b;
          const quantity = b.quantity + 1;
          const discount_amount = b.unit_price * quantity * (b.discount_pct / 100);
          const serials = { ...b.serials };
          for (const comp of b.components) {
            if (comp.serial_required) {
              serials[comp.product_id] = [...(serials[comp.product_id] ?? []), ...Array(comp.quantity).fill("")]
            }
          }
          return { ...b, quantity, discount_amount, serials };
        }),
      });
    } else {
      const serials: Record<string, string[]> = {};
      for (const item of bundle.items) {
        if (item.serial_required) {
          serials[item.product_id] = Array(item.quantity).fill("");
        }
      }
      set({
        bundleItems: [
          ...bundleItems,
          {
            bundle_id: bundle.id,
            bundle_name: bundle.name,
            quantity: 1,
            unit_price: bundle.price,
            discount_amount: 0,
            discount_pct: 0,
            add_tax_pct: 0,
            components: bundle.items,
            serials,
          },
        ],
      });
    }
  },

  removeBundle: (bundleId) =>
    set({ bundleItems: get().bundleItems.filter((b) => b.bundle_id !== bundleId) }),

  updateBundleQuantity: (bundleId, quantity) => {
    if (quantity <= 0) {
      get().removeBundle(bundleId);
      return;
    }
    set({
      bundleItems: get().bundleItems.map((b) => {
        if (b.bundle_id !== bundleId) return b;
        const discount_amount = b.unit_price * quantity * (b.discount_pct / 100);
        const serials = { ...b.serials };
        for (const comp of b.components) {
          if (comp.serial_required) {
            const needed = comp.quantity * quantity;
            const current = serials[comp.product_id] ?? [];
            serials[comp.product_id] = needed > current.length
              ? [...current, ...Array(needed - current.length).fill("")]
              : current.slice(0, needed);
          }
        }
        return { ...b, quantity, discount_amount, serials };
      }),
    });
  },

  updateBundleItemDiscount: (bundleId, pct) =>
    set({
      bundleItems: get().bundleItems.map((b) => {
        if (b.bundle_id !== bundleId) return b;
        const discount_amount = b.unit_price * b.quantity * (pct / 100);
        return { ...b, discount_pct: pct, discount_amount };
      }),
    }),

  updateBundleItemAddTax: (bundleId, pct) =>
    set({
      bundleItems: get().bundleItems.map((b) =>
        b.bundle_id === bundleId ? { ...b, add_tax_pct: pct } : b
      ),
    }),

  updateBundleSerials: (bundleId, productId, serials) =>
    set({
      bundleItems: get().bundleItems.map((b) =>
        b.bundle_id === bundleId
          ? { ...b, serials: { ...b.serials, [productId]: serials } }
          : b
      ),
    }),

  setDiscount: (discount) => set({ discount }),

  setTaxRate: (rate) => set({ taxRate: rate }),

  clearCart: () => set({ items: [], bundleItems: [], discount: 0 }),

  setBundleItemsDirect: (items) => set({ bundleItems: items }),

  loadHeldOrder: (heldItems, heldBundleItems) =>
    set({
      discount: 0,
      items: heldItems.map((item) => ({
        product: { id: item.product_id, name: item.product_name, serial_required: false } as Product,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_amount: item.discount_amount,
        discount_pct: 0,
        add_tax_pct: 0,
        serials: [],
      })),
      bundleItems: (heldBundleItems ?? []).map((b) => {
        const baseTotal = b.unit_price * b.quantity
        const discount_pct = baseTotal > 0 ? (b.discount_amount / baseTotal) * 100 : 0
        const serials: Record<string, string[]> = {}
        for (const comp of b.components) {
          if (comp.serial_required) {
            serials[comp.product_id] = Array(comp.quantity * b.quantity).fill('')
          }
        }
        return {
          bundle_id: b.bundle_id,
          bundle_name: b.bundle_name,
          quantity: b.quantity,
          unit_price: b.unit_price,
          discount_amount: b.discount_amount,
          discount_pct,
          add_tax_pct: 0,
          components: b.components,
          serials,
        }
      }),
    }),

  loadQuotationOrder: (items) =>
    set({
      discount: 0,
      bundleItems: [],
      items: items.map((item) => {
        const baseTotal = item.unit_price * item.quantity
        const discount_pct = baseTotal > 0
          ? (item.discount_amount / baseTotal) * 100
          : 0
        return {
          product: item.product,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_amount: item.discount_amount,
          discount_pct,
          add_tax_pct: item.add_tax_pct,
          serials: item.product.serial_required
            ? Array(item.quantity).fill('')
            : [],
        }
      }),
    }),

  subtotal: () => {
    const productSubtotal = get().items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
    const bundleSubtotal = get().bundleItems.reduce((sum, b) => sum + b.unit_price * b.quantity, 0);
    return productSubtotal + bundleSubtotal;
  },

  totalDiscount: () => {
    const itemDiscounts = get().items.reduce((sum, i) => sum + i.discount_amount, 0);
    const bundleDiscounts = get().bundleItems.reduce((sum, b) => sum + b.discount_amount, 0);
    const overallDiscount = get().subtotal() * (get().discount / 100);
    return itemDiscounts + bundleDiscounts + overallDiscount;
  },

  totalAddTax: () => {
    const itemAddTax = get().items.reduce(
      (sum, i) => sum + i.unit_price * i.quantity * (i.add_tax_pct / 100),
      0
    );
    const bundleAddTax = get().bundleItems.reduce(
      (sum, b) => sum + b.unit_price * b.quantity * (b.add_tax_pct / 100),
      0
    );
    return itemAddTax + bundleAddTax;
  },

  tax: () => (get().subtotal() - get().totalDiscount()) * get().taxRate,

  total: () =>
    get().subtotal() - get().totalDiscount() + get().totalAddTax() + get().tax(),

  isReadyToCharge: () => {
    const itemsReady = get().items.every(
      (i) =>
        !i.product.serial_required ||
        (i.serials.length >= i.quantity && i.serials.every((s) => s !== ""))
    );
    const bundlesReady = get().bundleItems.every((b) =>
      b.components.every((comp) => {
        if (!comp.serial_required) return true;
        const serials = b.serials[comp.product_id] ?? [];
        const needed = comp.quantity * b.quantity;
        return serials.length >= needed && serials.every((s) => s !== "");
      })
    );
    return itemsReady && bundlesReady;
  },
}));
