# Company Branding Settings & QR Payment Removal

**Date:** 2026-04-27

## Summary

Two changes to Organization Settings:
1. Remove the QR Payment Settings card entirely from the UI (no data deleted — QR URLs remain in the DB and continue working in POS).
2. Add a Company Branding card (owner-only) with company name, two address lines, and a logo. These fields appear in all report print headers and partially in the POS receipt.

---

## Database

**Migration:** `018_company_branding.sql`

```sql
ALTER TABLE organizations
  ADD COLUMN company_name TEXT,
  ADD COLUMN address_1    TEXT,
  ADD COLUMN address_2    TEXT,
  ADD COLUMN logo_url     TEXT;
```

**Types:** `types/database.ts` — add `company_name`, `address_1`, `address_2`, `logo_url` (all `string | null`) to `organizations` Row / Insert / Update.

---

## Server Actions

### `lib/actions/organization.ts`

- `getOrgSettingsCached`: add `company_name, address_1, address_2, logo_url` to the SELECT and the fallback object.
- `getOrgSettings`: include the 4 new fields in the returned object.
- New `updateCompanyInfo(settings: { company_name, address_1, address_2, logo_url })`: owner-only, updates the 4 columns, revalidates `ORG_SETTINGS` tag and `/settings/organization`.

### `lib/actions/upload.ts`

- New `uploadLogoImage(formData: FormData): Promise<string>`: owner-only, uploads to Cloudinary folder `hardware-pos/logos/{ORG_ID}`, applies `width: 400, height: 400, crop: 'limit', quality: 'auto'` transformation. Returns `secure_url`. Does **not** auto-save to DB.

---

## Organization Settings UI (`organization-client.tsx`)

### Removals
- Delete the QR Payment Settings card.
- Delete the "Save QR Settings" button.
- Remove QR-related state (`gcashQrUrl`, `mayaQrUrl`, `gcashSaved`, `mayaSaved`, `gcashUploading`, `mayaUploading`, file refs, `isQrDirty`, `handleQrSave`, `handleQrUpload`, `sanitizeUrl`).
- Remove QR-related props from `OrganizationClientProps` (`initialGcashQrUrl`, `initialMayaQrUrl`).
- Remove unused imports (`QrCode`, `Upload`, `X`, `updateQRSettings`, `uploadQrImage`).

### Additions (inside `{isOwner && ...}` block)
New **Company Branding** card with:
- **Company Name** — `<Input>` text field
- **Address 1** — `<Input>` text field
- **Address 2** — `<Input>` text field
- **Logo** — upload button (calls `uploadLogoImage`), preview `<img>` thumbnail (100×100), clear button (sets `logoUrl` to `""`)

State: `companyName`, `address1`, `address2`, `logoUrl`, `logoSaved`, `logoUploading`, `logoFileRef`, `isCompanyDirty`.

Handler: `handleCompanySave` calls `updateCompanyInfo` then syncs `logoSaved`, shows toast, calls `router.refresh()`.

**Save button:** "Save Company Info", disabled when not dirty or pending.

Props added to `OrganizationClientProps`: `initialCompanyName`, `initialAddress1`, `initialAddress2`, `initialLogoUrl`.

---

## Reports (print headers)

All 4 report pages (`z-report`, `transactions`, `products`, `suppliers`) updated:

### Page (`page.tsx`)
Fetch `company_name`, `address_1`, `address_2`, `logo_url` from `getOrgSettings()` and pass as props to the client component.

### Client component (`*-client.tsx`)
New props: `companyName?: string | null`, `address1?: string | null`, `address2?: string | null`, `logoUrl?: string | null`.

In each report's print content / `PrintContent` component, add a branded header **above** the existing report title:

```
[logo img if set]
[company name if set, bold, centered]
[address 1 if set, centered]
[address 2 if set, centered]
[horizontal rule]
```

All fields are conditional — only rendered if non-empty.

---

## POS Receipt (`receipt-dialog.tsx` + payment dialog)

### `ReceiptData` interface
Add optional fields:
- `companyName?: string | null`
- `companyAddress1?: string | null`

### `ReceiptContent`
Render above the branch name block:
```
[company name, centered, if set]
[address 1, centered, if set]
```
No logo, no address 2.

### Payment dialog / receipt assembly
Fetch `company_name` and `address_1` from org settings when building `ReceiptData` and pass them through.

---

## Access Control

- Company Branding card: visible and editable only when `isOwner === true`
- `updateCompanyInfo` and `uploadLogoImage` server actions: throw `Forbidden` if role is not `owner`
- Reports: branding header shown for all roles (it's public-facing print output)
- Receipt: branding shown for all roles (cashiers print receipts)

---

## Scope Boundaries

- QR URLs are **not deleted** from the DB — existing QR payment flow in POS continues to work unchanged.
- No new settings routes or navigation entries.
- Logo not included in POS receipt (owner decision).
- Address 2 not included in POS receipt (owner decision).
