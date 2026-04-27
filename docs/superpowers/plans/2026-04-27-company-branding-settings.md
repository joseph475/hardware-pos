# Company Branding Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove QR payment card from org settings, add owner-only Company Branding fields (name, address 1, address 2, logo via Cloudinary), and surface branding in all report headers and POS receipts.

**Architecture:** DB migration adds 4 nullable columns to `organizations`; server actions expose and mutate them; the settings UI removes the QR card and adds a Company Branding card with Cloudinary logo upload; report pages pass branding to client components; the POS receipt chain (page → POSClient → PaymentDialog → ReceiptDialog) passes company name + address 1.

**Tech Stack:** Next.js App Router, Supabase (service role), Cloudinary v2, React 19, shadcn/ui on Base UI, Tailwind CSS v4, TypeScript

---

## File Map

| File | Change |
|------|--------|
| `supabase/migrations/018_company_branding.sql` | CREATE — adds 4 columns to organizations |
| `types/database.ts` | MODIFY — add 4 fields to organizations Row/Insert/Update |
| `lib/actions/organization.ts` | MODIFY — update getOrgSettingsCached, getOrgSettings, add updateCompanyInfo |
| `lib/actions/upload.ts` | MODIFY — add uploadLogoImage (owner-only Cloudinary upload) |
| `app/(dashboard)/settings/organization/page.tsx` | MODIFY — remove QR props, add branding props |
| `app/(dashboard)/settings/organization/organization-client.tsx` | MODIFY — remove QR card, add Company Branding card |
| `app/(dashboard)/reports/z-report/page.tsx` | MODIFY — fetch+pass branding |
| `app/(dashboard)/reports/z-report/z-report-client.tsx` | MODIFY — branded PrintContent header |
| `app/(dashboard)/reports/transactions/page.tsx` | MODIFY — add branding fields to orgSettings |
| `app/(dashboard)/reports/transactions/transactions-client.tsx` | MODIFY — extend OrgSettingsForReceipt, use in buildReceiptData |
| `app/(dashboard)/reports/products/page.tsx` | MODIFY — fetch+pass branding |
| `app/(dashboard)/reports/products/product-report-client.tsx` | MODIFY — render branding in page header |
| `app/(dashboard)/reports/suppliers/page.tsx` | MODIFY — fetch+pass branding |
| `app/(dashboard)/reports/suppliers/suppliers-client.tsx` | MODIFY — render branding in page header |
| `app/(dashboard)/pos/page.tsx` | MODIFY — pass companyName, companyAddress1 |
| `components/pos/payment-dialog.tsx` | MODIFY — accept+forward companyName, companyAddress1 |
| `components/pos/receipt-dialog.tsx` | MODIFY — add fields to ReceiptData, render in receipt |

---

### Task 1: Database migration

**Files:**
- Create: `supabase/migrations/018_company_branding.sql`

- [ ] **Step 1: Create migration file**

```sql
-- supabase/migrations/018_company_branding.sql
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS company_name TEXT,
  ADD COLUMN IF NOT EXISTS address_1    TEXT,
  ADD COLUMN IF NOT EXISTS address_2    TEXT,
  ADD COLUMN IF NOT EXISTS logo_url     TEXT;
```

- [ ] **Step 2: Apply migration via Supabase MCP**

Use the `mcp__claude_ai_Supabase__apply_migration` tool with the SQL above against project `ulgfpurffyfrtdlahoal`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/018_company_branding.sql
git commit -m "feat: add company_name, address_1, address_2, logo_url columns to organizations"
```

---

### Task 2: TypeScript types

**Files:**
- Modify: `types/database.ts`

- [ ] **Step 1: Add fields to organizations Row**

In `types/database.ts`, find the `organizations` Row type (around line 11) and add after `manager_override_pin: string | null;`:

```typescript
company_name: string | null;
address_1: string | null;
address_2: string | null;
logo_url: string | null;
```

- [ ] **Step 2: Add fields to organizations Insert**

Find the Insert type for organizations and add after `manager_override_pin?: string | null;`:

```typescript
company_name?: string | null;
address_1?: string | null;
address_2?: string | null;
logo_url?: string | null;
```

- [ ] **Step 3: Add fields to organizations Update**

Find the Update type for organizations and add the same 4 optional fields as in Insert.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/joseph-macbookpro-m3/Documents/Apps/practice/hardware-pos && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors (or only pre-existing errors unrelated to this change).

- [ ] **Step 5: Commit**

```bash
git add types/database.ts
git commit -m "feat: add company branding fields to Database types"
```

---

### Task 3: Server actions — org settings + logo upload

**Files:**
- Modify: `lib/actions/organization.ts`
- Modify: `lib/actions/upload.ts`

- [ ] **Step 1: Update getOrgSettingsCached SELECT and fallback**

In `lib/actions/organization.ts`, find `getOrgSettingsCached` and update the `.select(...)` call from:
```typescript
.select('currency_code, currency_locale, tax_rate, gcash_qr_url, maya_qr_url, receipt_header, receipt_footer, max_cashier_discount_pct, manager_override_pin')
```
to:
```typescript
.select('currency_code, currency_locale, tax_rate, gcash_qr_url, maya_qr_url, receipt_header, receipt_footer, max_cashier_discount_pct, manager_override_pin, company_name, address_1, address_2, logo_url')
```

And add 4 fields to the fallback object:
```typescript
company_name: null,
address_1: null,
address_2: null,
logo_url: null,
```

- [ ] **Step 2: Add updateCompanyInfo action**

At the end of `lib/actions/organization.ts`, add:

```typescript
export async function updateCompanyInfo(settings: {
  company_name: string | null
  address_1: string | null
  address_2: string | null
  logo_url: string | null
}) {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = getAdminClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('clerk_user_id', userId)
    .single()

  if (profile?.role !== 'owner') throw new Error('Forbidden')

  const { error } = await supabase
    .from('organizations')
    .update(settings)
    .eq('id', ORG_ID)

  if (error) throw new Error(error.message)

  revalidateTag(CACHE_TAGS.ORG_SETTINGS, {})
  revalidatePath('/settings/organization')
}
```

- [ ] **Step 3: Add uploadLogoImage to upload.ts**

In `lib/actions/upload.ts`, add these imports at the top (after existing imports):

```typescript
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
```

Add a `getAdminClient` helper after the `cloudinary.config(...)` block:

```typescript
function getAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
```

Then add the new export at the end of the file:

```typescript
export async function uploadLogoImage(formData: FormData): Promise<string> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = getAdminClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('clerk_user_id', userId)
    .single()

  if (profile?.role !== 'owner') throw new Error('Forbidden')

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) throw new Error('No file provided')
  if (file.size > 5 * 1024 * 1024) throw new Error('File must be under 5 MB')

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `hardware-pos/logos/${ORG_ID}`,
        resource_type: 'image',
        transformation: [{ width: 400, height: 400, crop: 'limit', quality: 'auto' }],
      },
      (error, result) => {
        if (error || !result) return reject(error ?? new Error('Upload failed'))
        resolve(result.secure_url)
      }
    )
    uploadStream.end(buffer)
  })
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/joseph-macbookpro-m3/Documents/Apps/practice/hardware-pos && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 5: Commit**

```bash
git add lib/actions/organization.ts lib/actions/upload.ts
git commit -m "feat: add updateCompanyInfo action and uploadLogoImage"
```

---

### Task 4: Organization settings UI

**Files:**
- Modify: `app/(dashboard)/settings/organization/page.tsx`
- Modify: `app/(dashboard)/settings/organization/organization-client.tsx`

- [ ] **Step 1: Update page.tsx — remove QR props, add branding props**

Replace the `<OrganizationClient ...>` block in `page.tsx` with:

```tsx
return (
  <OrganizationClient
    initialCurrencyCode={settings.currency_code}
    initialTaxRate={settings.tax_rate}
    initialReceiptHeader={settings.receipt_header ?? null}
    initialReceiptFooter={settings.receipt_footer ?? null}
    initialMaxCashierDiscountPct={settings.max_cashier_discount_pct}
    initialHasManagerPin={settings.has_manager_pin}
    initialCompanyName={settings.company_name ?? null}
    initialAddress1={settings.address_1 ?? null}
    initialAddress2={settings.address_2 ?? null}
    initialLogoUrl={settings.logo_url ?? null}
    isOwner={profile?.role === "owner"}
  />
);
```

- [ ] **Step 2: Update organization-client.tsx imports**

Replace the lucide-react import line:
```typescript
// OLD
import { Globe, KeyRound, Percent, QrCode, Receipt, ShieldCheck, Upload, X } from "lucide-react";
// NEW
import { Building2, Globe, KeyRound, Percent, Receipt, ShieldCheck, Upload, X } from "lucide-react";
```

Replace the organization actions import line:
```typescript
// OLD
import { updateOrgSettings, updateQRSettings, updateOwnerSettings, uploadQrImage, setManagerOverridePin } from "@/lib/actions/organization";
// NEW
import { updateOrgSettings, updateOwnerSettings, updateCompanyInfo, setManagerOverridePin } from "@/lib/actions/organization";
import { uploadLogoImage } from "@/lib/actions/upload";
```

- [ ] **Step 3: Update OrganizationClientProps interface**

Replace the QR props with branding props:
```typescript
// REMOVE these two lines:
//   initialGcashQrUrl: string | null;
//   initialMayaQrUrl: string | null;
// ADD these four lines:
  initialCompanyName: string | null;
  initialAddress1: string | null;
  initialAddress2: string | null;
  initialLogoUrl: string | null;
```

- [ ] **Step 4: Update destructuring in function signature**

Replace in the function parameter destructuring:
```typescript
// REMOVE:
//   initialGcashQrUrl,
//   initialMayaQrUrl,
// ADD:
  initialCompanyName,
  initialAddress1,
  initialAddress2,
  initialLogoUrl,
```

- [ ] **Step 5: Replace QR transitions/state with company branding state**

Replace:
```typescript
const [isQrPending, startQrTransition] = useTransition();
```
with:
```typescript
const [isCompanyPending, startCompanyTransition] = useTransition();
```

Remove these state declarations entirely:
```typescript
const [gcashQrUrl, setGcashQrUrl] = React.useState(initialGcashQrUrl ?? "");
const [mayaQrUrl, setMayaQrUrl] = React.useState(initialMayaQrUrl ?? "");
const [gcashSaved, setGcashSaved] = React.useState(initialGcashQrUrl ?? "");
const [mayaSaved, setMayaSaved] = React.useState(initialMayaQrUrl ?? "");
const [gcashUploading, setGcashUploading] = React.useState(false);
const [mayaUploading, setMayaUploading] = React.useState(false);
const gcashFileRef = React.useRef<HTMLInputElement>(null);
const mayaFileRef = React.useRef<HTMLInputElement>(null);
```

Add these state declarations in their place:
```typescript
const [companyName, setCompanyName] = React.useState(initialCompanyName ?? "");
const [address1, setAddress1] = React.useState(initialAddress1 ?? "");
const [address2, setAddress2] = React.useState(initialAddress2 ?? "");
const [logoUrl, setLogoUrl] = React.useState(initialLogoUrl ?? "");
const [logoSaved, setLogoSaved] = React.useState(initialLogoUrl ?? "");
const [logoUploading, setLogoUploading] = React.useState(false);
const logoFileRef = React.useRef<HTMLInputElement>(null);
```

- [ ] **Step 6: Replace QR dirty check + handlers with company branding equivalents**

Remove:
```typescript
const isQrDirty =
  gcashQrUrl !== gcashSaved ||
  mayaQrUrl !== mayaSaved;
```

Add:
```typescript
const isCompanyDirty =
  companyName !== (initialCompanyName ?? "") ||
  address1 !== (initialAddress1 ?? "") ||
  address2 !== (initialAddress2 ?? "") ||
  logoUrl !== logoSaved;
```

Remove `handleQrUpload`, `sanitizeUrl`, and `handleQrSave` functions entirely.

Add these handlers (before `handleOwnerSave`):
```typescript
async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0]
  if (!file) return
  setLogoUploading(true)
  try {
    const formData = new FormData()
    formData.append('file', file)
    const url = await uploadLogoImage(formData)
    setLogoUrl(url)
    toast.success('Logo uploaded')
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Upload failed')
  } finally {
    setLogoUploading(false)
    e.target.value = ''
  }
}

function handleCompanySave() {
  startCompanyTransition(async () => {
    try {
      await updateCompanyInfo({
        company_name: companyName.trim() || null,
        address_1: address1.trim() || null,
        address_2: address2.trim() || null,
        logo_url: logoUrl.trim() || null,
      })
      setLogoSaved(logoUrl)
      toast.success('Company info saved')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save company info')
    }
  })
}
```

- [ ] **Step 7: Replace QR Payment card + Save QR button with Company Branding card**

In the JSX, inside the first `{isOwner && <>` block, replace the entire QR Payment Settings card AND the "Save QR Settings" `<div className="flex justify-end">` button block with:

```tsx
{/* Company Branding */}
<Card>
  <CardHeader className="border-b border-border pb-4">
    <div className="flex items-center gap-2">
      <Building2 className="h-4 w-4 text-muted-foreground" />
      <CardTitle className="text-sm font-medium">Company Branding</CardTitle>
    </div>
    <CardDescription className="text-xs mt-1">
      Shown in report headers and on receipts.
    </CardDescription>
  </CardHeader>
  <CardContent className="pt-5 space-y-4">
    <div className="space-y-2">
      <Label htmlFor="company-name">Company Name</Label>
      <Input
        id="company-name"
        placeholder="e.g. ABC Hardware Store"
        value={companyName}
        onChange={(e) => setCompanyName(e.target.value)}
      />
    </div>
    <div className="space-y-2">
      <Label htmlFor="address-1">Address 1</Label>
      <Input
        id="address-1"
        placeholder="e.g. 123 Main St"
        value={address1}
        onChange={(e) => setAddress1(e.target.value)}
      />
    </div>
    <div className="space-y-2">
      <Label htmlFor="address-2">Address 2</Label>
      <Input
        id="address-2"
        placeholder="e.g. Makati City, Metro Manila"
        value={address2}
        onChange={(e) => setAddress2(e.target.value)}
      />
    </div>
    <div className="space-y-2">
      <Label>Company Logo</Label>
      <div className="flex gap-2 items-center">
        <input
          ref={logoFileRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          className="hidden"
          onChange={handleLogoUpload}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={logoUploading}
          onClick={() => logoFileRef.current?.click()}
        >
          <Upload className="h-4 w-4 mr-1.5" />
          {logoUploading ? "Uploading…" : "Upload Logo"}
        </Button>
        {logoUrl.trim() && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => setLogoUrl("")}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      {logoUrl.trim() && (
        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Preview</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl.trim()}
            alt="Company Logo"
            className="h-24 w-24 rounded object-contain"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none" }}
          />
        </div>
      )}
    </div>
  </CardContent>
</Card>

<div className="flex justify-end">
  <Button onClick={handleCompanySave} disabled={!isCompanyDirty || isCompanyPending}>
    {isCompanyPending ? "Saving…" : "Save Company Info"}
  </Button>
</div>
```

- [ ] **Step 8: Verify TypeScript compiles**

```bash
cd /Users/joseph-macbookpro-m3/Documents/Apps/practice/hardware-pos && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 9: Commit**

```bash
git add app/\(dashboard\)/settings/organization/page.tsx app/\(dashboard\)/settings/organization/organization-client.tsx
git commit -m "feat: remove QR payment card, add Company Branding settings"
```

---

### Task 5: Z-report and Transactions report print headers

**Files:**
- Modify: `app/(dashboard)/reports/z-report/page.tsx`
- Modify: `app/(dashboard)/reports/z-report/z-report-client.tsx`
- Modify: `app/(dashboard)/reports/transactions/page.tsx`
- Modify: `app/(dashboard)/reports/transactions/transactions-client.tsx`

- [ ] **Step 1: Update z-report/page.tsx — fetch and pass branding**

Add `getOrgSettings` to the import:
```typescript
import { getSalesReading } from "@/lib/actions/reports"
import { getOrgSettings } from "@/lib/actions/organization"
```

Fetch branding in parallel with the sales reading:
```typescript
const [initialData, orgSettings] = await Promise.all([
  getSalesReading({ mode: "all-time", branch_id: branchId }),
  getOrgSettings(),
])
```

Pass to `ZReportClient`:
```tsx
return (
  <ZReportClient
    initialData={initialData}
    initialDate={today}
    userBranchId={branchId}
    companyName={orgSettings.company_name ?? null}
    address1={orgSettings.address_1 ?? null}
    address2={orgSettings.address_2 ?? null}
    logoUrl={orgSettings.logo_url ?? null}
  />
)
```

- [ ] **Step 2: Update ZReportClient props and PrintContent in z-report-client.tsx**

Add the 4 branding props to the `ZReportClient` props type and destructuring:
```typescript
export function ZReportClient({
  initialData,
  initialDate,
  userBranchId,
  companyName,
  address1,
  address2,
  logoUrl,
}: {
  initialData: SalesReadingData
  initialDate: string
  userBranchId?: string | null
  companyName?: string | null
  address1?: string | null
  address2?: string | null
  logoUrl?: string | null
})
```

Add the 4 props to the `PrintContent` component signature:
```typescript
function PrintContent({
  mode,
  data,
  dateFrom,
  dateTo,
  formatCurrency,
  companyName,
  address1,
  address2,
  logoUrl,
}: {
  mode: Mode
  data: SalesReadingData
  dateFrom: string
  dateTo: string
  formatCurrency: (v: number) => string
  companyName?: string | null
  address1?: string | null
  address2?: string | null
  logoUrl?: string | null
})
```

Inside `PrintContent`, add a branded header **before** the existing `<div style={{ textAlign: "center", marginBottom: 16 }}>` block:

```tsx
{companyName && (
  <div style={{ textAlign: "center", marginBottom: 12 }}>
    {logoUrl && (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt="logo"
        style={{ height: 56, objectFit: "contain", marginBottom: 6, display: "block", margin: "0 auto 6px" }}
      />
    )}
    <div style={{ fontWeight: "bold", fontSize: 15 }}>{companyName}</div>
    {address1 && <div style={{ fontSize: 11, marginTop: 2 }}>{address1}</div>}
    {address2 && <div style={{ fontSize: 11 }}>{address2}</div>}
  </div>
)}
```

Pass the 4 props through from `ZReportClient` to `PrintContent` in the `createPortal` call:
```tsx
createPortal(
  <PrintContent
    mode={mode}
    data={data}
    dateFrom={dateFrom}
    dateTo={dateTo}
    formatCurrency={formatCurrency}
    companyName={companyName}
    address1={address1}
    address2={address2}
    logoUrl={logoUrl}
  />,
  document.body
)
```

- [ ] **Step 3: Update transactions/page.tsx — add branding fields to orgSettings**

The transactions page already calls `getOrgSettings()`. Expand the `orgSettings` spread in the `<TransactionsClient>` props:
```tsx
orgSettings={{
  tax_rate: orgSettings.tax_rate,
  receipt_header: orgSettings.receipt_header ?? null,
  receipt_footer: orgSettings.receipt_footer ?? null,
  currency_code: orgSettings.currency_code,
  currency_locale: orgSettings.currency_locale,
  company_name: orgSettings.company_name ?? null,
  address_1: orgSettings.address_1 ?? null,
}}
```

- [ ] **Step 4: Update OrgSettingsForReceipt type and buildReceiptData in transactions-client.tsx**

Extend the `OrgSettingsForReceipt` type:
```typescript
type OrgSettingsForReceipt = {
  tax_rate: number
  receipt_header: string | null
  receipt_footer: string | null
  currency_code: string
  currency_locale: string
  company_name: string | null
  address_1: string | null
}
```

In `buildReceiptData`, add `companyName` and `companyAddress1` to the returned object:
```typescript
function buildReceiptData(tx: TransactionSummary): ReceiptData {
  return {
    transactionId: tx.id,
    timestamp: new Date(tx.created_at),
    branchName: tx.branch_name,
    branchAddress: tx.branch_address,
    branchPhone: tx.branch_phone,
    cashierName: tx.cashier_name,
    items: tx.items.map((item) => ({
      name: item.product_name,
      qty: item.quantity,
      unitPrice: item.unit_price,
      discountAmount: item.discount_amount,
      lineTotal: item.total,
    })),
    subtotal: tx.total - (tx.total * orgSettings.tax_rate / (1 + orgSettings.tax_rate)),
    discountAmount: tx.discount_amount,
    taxAmount: tx.total * orgSettings.tax_rate / (1 + orgSettings.tax_rate),
    taxRate: orgSettings.tax_rate,
    total: tx.total,
    paymentMethod: tx.payment_method as ReceiptData["paymentMethod"],
    receiptHeader: orgSettings.receipt_header ?? undefined,
    receiptFooter: orgSettings.receipt_footer ?? undefined,
    companyName: orgSettings.company_name ?? undefined,
    companyAddress1: orgSettings.address_1 ?? undefined,
    formatCurrency,
  }
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/joseph-macbookpro-m3/Documents/Apps/practice/hardware-pos && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 6: Commit**

```bash
git add app/\(dashboard\)/reports/z-report/page.tsx app/\(dashboard\)/reports/z-report/z-report-client.tsx app/\(dashboard\)/reports/transactions/page.tsx app/\(dashboard\)/reports/transactions/transactions-client.tsx
git commit -m "feat: add company branding to Z-report print header and transaction receipt reprints"
```

---

### Task 6: Products and Suppliers report page headers

**Files:**
- Modify: `app/(dashboard)/reports/products/page.tsx`
- Modify: `app/(dashboard)/reports/products/product-report-client.tsx`
- Modify: `app/(dashboard)/reports/suppliers/page.tsx`
- Modify: `app/(dashboard)/reports/suppliers/suppliers-client.tsx`

- [ ] **Step 1: Update products/page.tsx — fetch and pass branding**

Add `getOrgSettings` import:
```typescript
import { getOrgSettings } from "@/lib/actions/organization"
```

Fetch branding in parallel:
```typescript
const [initialData, orgSettings] = await Promise.all([
  getProductReport("month", branchId),
  getOrgSettings(),
])
```

Pass to `ProductReportClient`:
```tsx
return (
  <ProductReportClient
    initialData={initialData}
    userBranchId={branchId}
    companyName={orgSettings.company_name ?? null}
    address1={orgSettings.address_1 ?? null}
    address2={orgSettings.address_2 ?? null}
    logoUrl={orgSettings.logo_url ?? null}
  />
)
```

- [ ] **Step 2: Update ProductReportClient to render branding in page header**

Add 4 branding props to the component:
```typescript
export function ProductReportClient({
  initialData,
  userBranchId,
  companyName,
  address1,
  address2,
  logoUrl,
}: {
  initialData: ProductReportData
  userBranchId?: string | null
  companyName?: string | null
  address1?: string | null
  address2?: string | null
  logoUrl?: string | null
})
```

In the JSX, inside the page header `<div>` that contains `<h1>Product Performance</h1>`, insert a branding block **above** the `<h1>`:

```tsx
{/* Header */}
<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
  <div>
    {companyName && (
      <div className="flex items-center gap-2 mb-2">
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="logo" className="h-8 w-auto object-contain" />
        )}
        <div>
          <p className="text-sm font-semibold text-foreground">{companyName}</p>
          {address1 && <p className="text-xs text-muted-foreground">{address1}</p>}
          {address2 && <p className="text-xs text-muted-foreground">{address2}</p>}
        </div>
      </div>
    )}
    <h1 className="text-xl font-semibold text-foreground">Product Performance</h1>
    <p className="text-sm text-muted-foreground mt-0.5">
      Top-selling products and category breakdown
    </p>
  </div>
  ...rest of header (tabs, loading indicator)
```

- [ ] **Step 3: Update suppliers/page.tsx — fetch and pass branding**

Add `getOrgSettings` import:
```typescript
import { getOrgSettings } from "@/lib/actions/organization"
```

Fetch branding in parallel:
```typescript
const [rows, suppliers, orgSettings] = await Promise.all([
  getSupplierFastMovingReport(),
  getSuppliers(),
  getOrgSettings(),
])
```

Pass to `SuppliersReportClient`:
```tsx
return (
  <SuppliersReportClient
    rows={rows}
    suppliers={suppliers}
    companyName={orgSettings.company_name ?? null}
    address1={orgSettings.address_1 ?? null}
    address2={orgSettings.address_2 ?? null}
    logoUrl={orgSettings.logo_url ?? null}
  />
)
```

- [ ] **Step 4: Update SuppliersReportClient to render branding in page header**

Update the `Props` interface:
```typescript
interface Props {
  rows: SupplierProductRow[]
  suppliers: Array<{ id: string; name: string }>
  companyName?: string | null
  address1?: string | null
  address2?: string | null
  logoUrl?: string | null
}
```

Add to the destructuring:
```typescript
export function SuppliersReportClient({ rows, suppliers, companyName, address1, address2, logoUrl }: Props)
```

Find the existing page header `<div>` section in `SuppliersReportClient` (it has a heading like "Supplier Product Report" or similar). Add the branding block above the heading, following the same pattern as ProductReportClient:

```tsx
{companyName && (
  <div className="flex items-center gap-2 mb-2">
    {logoUrl && (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logoUrl} alt="logo" className="h-8 w-auto object-contain" />
    )}
    <div>
      <p className="text-sm font-semibold text-foreground">{companyName}</p>
      {address1 && <p className="text-xs text-muted-foreground">{address1}</p>}
      {address2 && <p className="text-xs text-muted-foreground">{address2}</p>}
    </div>
  </div>
)}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/joseph-macbookpro-m3/Documents/Apps/practice/hardware-pos && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 6: Commit**

```bash
git add app/\(dashboard\)/reports/products/page.tsx app/\(dashboard\)/reports/products/product-report-client.tsx app/\(dashboard\)/reports/suppliers/page.tsx app/\(dashboard\)/reports/suppliers/suppliers-client.tsx
git commit -m "feat: add company branding to product and supplier report headers"
```

---

### Task 7: POS receipt — company name + address 1

**Files:**
- Modify: `components/pos/receipt-dialog.tsx`
- Modify: `components/pos/payment-dialog.tsx`
- Modify: `app/(dashboard)/pos/page.tsx`

- [ ] **Step 1: Add companyName and companyAddress1 to ReceiptData**

In `components/pos/receipt-dialog.tsx`, add to the `ReceiptData` interface after `receiptFooter`:
```typescript
companyName?: string | null
companyAddress1?: string | null
```

- [ ] **Step 2: Render company name + address 1 in ReceiptContent**

In the `ReceiptContent` function, find the section marked `{/* Header */}` that renders `<Divider />` then `branchName`. Insert the company block **before** the first `<Divider />`:

```tsx
{/* Company header */}
{data.companyName && (
  <>
    <ReceiptLine>
      {"".padStart(Math.floor((42 - Math.min(data.companyName.length, 42)) / 2))}
      {data.companyName.slice(0, 42)}
    </ReceiptLine>
    {data.companyAddress1 && (
      <ReceiptLine>
        {"".padStart(Math.floor((42 - Math.min(data.companyAddress1.length, 42)) / 2))}
        {data.companyAddress1.slice(0, 42)}
      </ReceiptLine>
    )}
    <Divider char="-" />
  </>
)}
{/* Header */}
<Divider />
<ReceiptLine>...</ReceiptLine>
```

- [ ] **Step 3: Add props to PaymentDialog**

In `components/pos/payment-dialog.tsx`, add to the props interface (after `receiptFooter`):
```typescript
companyName?: string | null
companyAddress1?: string | null
```

Add to the destructuring in `PaymentDialog`:
```typescript
export function PaymentDialog({
  ...
  receiptHeader,
  receiptFooter,
  companyName,
  companyAddress1,
  quotationId,
}: PaymentDialogProps)
```

In the `setReceiptData({...})` call (around line 225–268), add:
```typescript
companyName: companyName ?? undefined,
companyAddress1: companyAddress1 ?? undefined,
```

- [ ] **Step 4: Pass props through pos/page.tsx and pos-client.tsx**

In `app/(dashboard)/pos/page.tsx`, add to the `<POSClient>` props:
```tsx
companyName={orgSettings.company_name ?? null}
companyAddress1={orgSettings.address_1 ?? null}
```

In `app/(dashboard)/pos/pos-client.tsx`, add to the `POSClient` props interface:
```typescript
companyName?: string | null
companyAddress1?: string | null
```

Add to the destructuring:
```typescript
export function POSClient({
  ...
  receiptHeader,
  receiptFooter,
  companyName,
  companyAddress1,
  hasPinConfigured,
  initialQuotation,
}: {...})
```

Pass to `<PaymentDialog>`:
```tsx
<PaymentDialog
  ...
  receiptHeader={receiptHeader}
  receiptFooter={receiptFooter}
  companyName={companyName}
  companyAddress1={companyAddress1}
  quotationId={initialQuotation?.id ?? null}
/>
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/joseph-macbookpro-m3/Documents/Apps/practice/hardware-pos && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 6: Commit**

```bash
git add components/pos/receipt-dialog.tsx components/pos/payment-dialog.tsx app/\(dashboard\)/pos/page.tsx app/\(dashboard\)/pos/pos-client.tsx
git commit -m "feat: show company name and address 1 on POS receipts"
```

---

## Self-Review

**Spec coverage:**
- ✅ Remove QR payment card — Task 4
- ✅ DB migration + types — Tasks 1–2
- ✅ `updateCompanyInfo` action — Task 3
- ✅ `uploadLogoImage` (Cloudinary, owner-only) — Task 3
- ✅ Company Branding card in org settings (owner-only) — Task 4
- ✅ Z-report print header with logo, name, addr1, addr2 — Task 5
- ✅ Transactions receipt reprint includes company name + addr1 — Task 5
- ✅ Products report page header with branding — Task 6
- ✅ Suppliers report page header with branding — Task 6
- ✅ POS receipt shows company name + addr1 (no logo, no addr2) — Task 7

**Type consistency:**
- `updateCompanyInfo` takes `{ company_name, address_1, address_2, logo_url }` — matches DB column names throughout
- `companyName` / `companyAddress1` used as camelCase prop names on React components — consistent across PaymentDialog → ReceiptData → ReceiptContent
- `orgSettings.company_name` / `orgSettings.address_1` used when reading from server action return — consistent with how other fields are accessed (e.g. `orgSettings.receipt_header`)

**Logo upload:** `uploadLogoImage` does NOT auto-save to DB (upload returns URL, user must click "Save Company Info"). `logoSaved` state tracks the last persisted value so dirty detection works correctly.
