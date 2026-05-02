# Split Payment — All Methods Design

**Date:** 2026-05-02

## Summary

Expand split payment so both legs can be any non-split payment method: cash, card, GCash, Maya, e_wallet, check, home_credit, or credit. Currently only cash, card, and e_wallet are available as split leg options.

## Scope

Changes are confined to three files:
- `components/pos/payment-dialog.tsx` — primary change
- `components/pos/receipt-dialog.tsx` — widen types + label function

No DB schema changes. No server action changes.

## Types

```typescript
type SplitLegMethod =
  | "cash" | "card" | "gcash" | "maya"
  | "e_wallet" | "check" | "home_credit" | "credit"

interface LegState {
  method: SplitLegMethod
  amount: string
  // gcash / maya
  qrConfirmed: boolean
  // e_wallet
  ewalletProvider: EwalletProvider        // default "GCash"
  ewalletReference: string
  // check
  checkBankName: string
  checkDate: string
  checkNumber: string
  checkName: string
  // home_credit
  installmentCompany: InstallmentCompany  // default "HomeCredit"
  hcDownpayment: string
  hcTerms: number | null
  hcAccountNumber: string
  // credit
  creditCustomerName: string
}
```

`EWALLET_PROVIDERS` and `INSTALLMENT_COMPANIES` constants are unchanged.

## State Changes in `payment-dialog.tsx`

**Remove** (split-specific):
- `splitMethod1`, `splitMethod2` — replaced by `leg1.method`, `leg2.method`
- `splitAmount1`, `splitAmount2` — replaced by `leg1.amount`, `leg2.amount`
- The shared `ewalletProvider` / `ewalletReference` are **kept** for standalone `e_wallet` payments; split legs use their own copies inside `LegState`

**Add:**
```typescript
const defaultLeg = (method: SplitLegMethod): LegState => ({
  method,
  amount: "",
  qrConfirmed: false,
  ewalletProvider: "GCash",
  ewalletReference: "",
  checkBankName: "",
  checkDate: "",
  checkNumber: "",
  checkName: "",
  installmentCompany: "HomeCredit",
  hcDownpayment: "",
  hcTerms: null,
  hcAccountNumber: "",
  creditCustomerName: "",
})

const [leg1, setLeg1] = React.useState<LegState>(defaultLeg("cash"))
const [leg2, setLeg2] = React.useState<LegState>(defaultLeg("card"))
```

Helper for partial updates:
```typescript
function updateLeg1(patch: Partial<LegState>) { setLeg1(prev => ({ ...prev, ...patch })) }
function updateLeg2(patch: Partial<LegState>) { setLeg2(prev => ({ ...prev, ...patch })) }
```

**Auto-switch logic:** when a leg's method changes to match the other leg's method, auto-change the other leg to the first available different method (same behaviour as today, extended to all 8 methods).

## UI

### Leg row
```
[ Method select (130px) ]  [ ₱ Amount input (flex-1) ]
```
Method select is filtered to exclude the other leg's current method.

### Conditional extra fields per leg (rendered below the row)

| Method | Extra fields |
|--------|-------------|
| `cash` / `card` | none |
| `gcash` | Checkbox: "Customer has paid via GCash" |
| `maya` | Checkbox: "Customer has paid via Maya" |
| `e_wallet` | Provider select + Reference # input |
| `check` | Bank name + Check date + Check # + Check name (2×2 grid) |
| `home_credit` | Company select + Downpayment + Terms pills + Account # |
| `credit` | Customer name input |

GCash/Maya in split show only a confirmation checkbox — no QR image. The split dialog is already multi-field; a QR display would be too disruptive.

### Balance indicator (unchanged)
Shows Remaining / Balanced / Over by, same colours as today.

## Validation

Per-leg validity:
- `cash` / `card`: always valid
- `gcash` / `maya`: `leg.qrConfirmed === true`
- `e_wallet`: `leg.ewalletReference.trim() !== ""`
- `check`: `bankName`, `checkDate`, `checkNumber`, `checkName` all non-empty
- `home_credit`: `leg.hcTerms !== null`
- `credit`: `leg.creditCustomerName.trim() !== ""`

Overall split valid when:
1. `|leg1.amount + leg2.amount − orderTotal| < 0.005`
2. `leg1.method !== leg2.method`
3. Both legs individually valid

`isSplitValid` replaces the current single expression.

## `createTransaction` Call

No changes to the action signature. Fields are mapped from whichever leg carries each method:

```typescript
const checkLeg  = [leg1, leg2].find(l => l.method === "check")
const walletLeg = [leg1, leg2].find(l => l.method === "e_wallet")
const hcLeg     = [leg1, leg2].find(l => l.method === "home_credit")
const creditLeg = [leg1, leg2].find(l => l.method === "credit")

{
  payment_method: "split",
  // split legs
  splitMethod1: leg1.method,
  splitAmount1: parseFloat(leg1.amount) || 0,
  splitMethod2: leg2.method,
  splitAmount2: parseFloat(leg2.amount) || 0,
  // check fields
  check_bank_name:  checkLeg?.checkBankName  ?? null,
  check_date:       checkLeg?.checkDate      ?? null,
  check_number:     checkLeg?.checkNumber    ?? null,
  check_name:       checkLeg?.checkName      ?? null,
  check_amount:     checkLeg ? (parseFloat(leg1.method === "check" ? leg1.amount : leg2.amount) || 0) : null,
  // ewallet fields
  ewallet_provider:  walletLeg?.ewalletProvider  ?? null,
  ewallet_reference: walletLeg?.ewalletReference ?? null,
  // hc fields
  hc_downpayment:     hcLeg ? (parseFloat(hcLeg.hcDownpayment) || 0)   : null,
  hc_terms:           hcLeg?.hcTerms     ?? null,
  hc_amount:          hcLeg ? Math.max(0, orderTotal - (parseFloat(hcLeg.hcDownpayment) || 0)) : null,
  hc_account_number:  hcLeg?.hcAccountNumber.trim() || null,
  installment_company: hcLeg?.installmentCompany ?? null,
  // credit fields
  credit_customer_name: creditLeg?.creditCustomerName.trim() ?? null,
}
```

## Receipt Dialog (`receipt-dialog.tsx`)

- Widen `splitMethod1` / `splitMethod2` types from `"cash" | "card" | "e_wallet"` to `SplitLegMethod`
- Update `splitMethodLabel` to handle all 8 methods:
  - `gcash` → "GCash", `maya` → "Maya", `e_wallet` → "E-Wallet"
  - `check` → "Check", `home_credit` → "Installment", `credit` → "Credit"
  - `cash` / `card` already handled

Receipt body for split remains: two rows showing `[method label]: [amount]`, plus any relevant reference/provider lines if ewallet was used.

## Reset on Close

Both `leg1` and `leg2` reset to `defaultLeg("cash")` / `defaultLeg("card")` when the dialog closes.

## Out of Scope

- No QR image display for gcash/maya split legs
- No change to transaction DB schema
- No change to server actions
- No change to non-split payment flows
