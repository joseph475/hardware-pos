"use client";

import * as React from "react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Globe, KeyRound, Percent, Receipt, ShieldCheck, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { handleError } from "@/lib/utils/error-handler";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateOrgSettings, updateOwnerSettings, updateCompanyInfo, setManagerOverridePin } from "@/lib/actions/organization";
import { uploadLogoImage } from "@/lib/actions/upload";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const CURRENCIES = [
  { code: "USD", locale: "en-US",  label: "USD — US Dollar ($)" },
  { code: "EUR", locale: "de-DE",  label: "EUR — Euro (€)" },
  { code: "GBP", locale: "en-GB",  label: "GBP — British Pound (£)" },
  { code: "PHP", locale: "en-PH",  label: "PHP — Philippine Peso (₱)" },
  { code: "JPY", locale: "ja-JP",  label: "JPY — Japanese Yen (¥)" },
  { code: "CAD", locale: "en-CA",  label: "CAD — Canadian Dollar (CA$)" },
  { code: "AUD", locale: "en-AU",  label: "AUD — Australian Dollar (A$)" },
  { code: "INR", locale: "en-IN",  label: "INR — Indian Rupee (₹)" },
  { code: "SGD", locale: "en-SG",  label: "SGD — Singapore Dollar (S$)" },
  { code: "MYR", locale: "ms-MY",  label: "MYR — Malaysian Ringgit (RM)" },
  { code: "THB", locale: "th-TH",  label: "THB — Thai Baht (฿)" },
  { code: "IDR", locale: "id-ID",  label: "IDR — Indonesian Rupiah (Rp)" },
  { code: "KRW", locale: "ko-KR",  label: "KRW — Korean Won (₩)" },
  { code: "CNY", locale: "zh-CN",  label: "CNY — Chinese Yuan (¥)" },
  { code: "BRL", locale: "pt-BR",  label: "BRL — Brazilian Real (R$)" },
  { code: "MXN", locale: "es-MX",  label: "MXN — Mexican Peso (MX$)" },
  { code: "AED", locale: "ar-AE",  label: "AED — UAE Dirham (د.إ)" },
  { code: "SAR", locale: "ar-SA",  label: "SAR — Saudi Riyal (﷼)" },
  { code: "ZAR", locale: "en-ZA",  label: "ZAR — South African Rand (R)" },
  { code: "VND", locale: "vi-VN",  label: "VND — Vietnamese Dong (₫)" },
] as const;

interface OrganizationClientProps {
  initialCurrencyCode: string;
  initialTaxRate: number;
  initialReceiptHeader: string | null;
  initialReceiptFooter: string | null;
  initialMaxCashierDiscountPct: number;
  initialHasManagerPin: boolean;
  initialCompanyName: string | null;
  initialAddress1: string | null;
  initialAddress2: string | null;
  initialLogoUrl: string | null;
  isOwner: boolean;
}

export function OrganizationClient({
  initialCurrencyCode,
  initialTaxRate,
  initialReceiptHeader,
  initialReceiptFooter,
  initialMaxCashierDiscountPct,
  initialHasManagerPin,
  initialCompanyName,
  initialAddress1,
  initialAddress2,
  initialLogoUrl,
  isOwner,
}: OrganizationClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isCompanyPending, startCompanyTransition] = useTransition();
  const [isOwnerPending, startOwnerTransition] = useTransition();
  const [isPinPending, startPinTransition] = useTransition();

  const [selectedCode, setSelectedCode] = React.useState(initialCurrencyCode);
  const [taxInput, setTaxInput] = React.useState(
    String(Math.round(initialTaxRate * 10000) / 100)
  );
  const [receiptHeader, setReceiptHeader] = React.useState(initialReceiptHeader ?? "");
  const [receiptFooter, setReceiptFooter] = React.useState(initialReceiptFooter ?? "");
  const [maxDiscountInput, setMaxDiscountInput] = React.useState(
    String(initialMaxCashierDiscountPct)
  );

  // Company branding state
  const [companyName, setCompanyName] = React.useState(initialCompanyName ?? "");
  const [address1, setAddress1] = React.useState(initialAddress1 ?? "");
  const [address2, setAddress2] = React.useState(initialAddress2 ?? "");
  const [logoUrl, setLogoUrl] = React.useState(initialLogoUrl ?? "");
  const [logoSaved, setLogoSaved] = React.useState(initialLogoUrl ?? "");
  const [logoUploading, setLogoUploading] = React.useState(false);
  const logoFileRef = React.useRef<HTMLInputElement>(null);

  // Manager override PIN state
  const [hasPin, setHasPin] = React.useState(initialHasManagerPin);
  const [pinDialogOpen, setPinDialogOpen] = React.useState(false);
  const [newPin, setNewPin] = React.useState("");
  const [confirmPin, setConfirmPin] = React.useState("");
  const [pinError, setPinError] = React.useState<string | null>(null);

  const selectedCurrency = CURRENCIES.find((c) => c.code === selectedCode) ?? CURRENCIES[0];

  const taxRateNum = parseFloat(taxInput);
  const taxRateValid = !isNaN(taxRateNum) && taxRateNum >= 0 && taxRateNum <= 100;

  const maxDiscountNum = parseFloat(maxDiscountInput);
  const maxDiscountValid = !isNaN(maxDiscountNum) && maxDiscountNum >= 0 && maxDiscountNum <= 100;

  const isDirty =
    selectedCode !== initialCurrencyCode ||
    taxRateNum !== Math.round(initialTaxRate * 10000) / 100;

  const isOwnerDirty =
    receiptHeader !== (initialReceiptHeader ?? "") ||
    receiptFooter !== (initialReceiptFooter ?? "") ||
    maxDiscountNum !== initialMaxCashierDiscountPct;

  const isCompanyDirty =
    companyName !== (initialCompanyName ?? "") ||
    address1 !== (initialAddress1 ?? "") ||
    address2 !== (initialAddress2 ?? "") ||
    logoUrl !== logoSaved;

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const url = await uploadLogoImage(formData);
      setLogoUrl(url);
      toast.success("Logo uploaded");
    } catch (err) {
      handleError(err, 'upload logo');
    } finally {
      setLogoUploading(false);
      e.target.value = "";
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
        });
        setLogoSaved(logoUrl);
        toast.success("Company info saved");
        router.refresh();
      } catch (err) {
        handleError(err, 'save company info');
      }
    });
  }

  function handleSave() {
    if (!taxRateValid) {
      toast.error("Tax rate must be between 0 and 100");
      return;
    }
    startTransition(async () => {
      try {
        await updateOrgSettings({
          currency_code: selectedCurrency.code,
          currency_locale: selectedCurrency.locale,
          tax_rate: taxRateNum / 100,
        });
        toast.success("Organization settings saved");
        router.refresh();
      } catch (err) {
        handleError(err, 'save org settings');
      }
    });
  }

  function handleOwnerSave() {
    if (!maxDiscountValid) {
      toast.error("Max cashier discount must be between 0 and 100");
      return;
    }
    startOwnerTransition(async () => {
      try {
        await updateOwnerSettings({
          receipt_header: receiptHeader.trim() || null,
          receipt_footer: receiptFooter.trim() || null,
          max_cashier_discount_pct: maxDiscountNum,
        });
        toast.success("Receipt & discount settings saved");
        router.refresh();
      } catch (err) {
        handleError(err, 'save owner settings');
      }
    });
  }

  function handlePinDialogClose() {
    setPinDialogOpen(false);
    setNewPin("");
    setConfirmPin("");
    setPinError(null);
  }

  function handleSetPin() {
    if (!/^\d{4,6}$/.test(newPin)) {
      setPinError("PIN must be 4–6 digits");
      return;
    }
    if (newPin !== confirmPin) {
      setPinError("PINs do not match");
      return;
    }
    setPinError(null);
    startPinTransition(async () => {
      try {
        await setManagerOverridePin(newPin);
        setHasPin(true);
        handlePinDialogClose();
        toast.success("Manager PIN saved");
      } catch (err) {
        setPinError(err instanceof Error ? err.message : "Failed to save PIN");
      }
    });
  }

  function handleClearPin() {
    startPinTransition(async () => {
      try {
        await setManagerOverridePin("");
        setHasPin(false);
        toast.success("Manager PIN removed");
      } catch (err) {
        handleError(err, 'remove manager PIN');
      }
    });
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Organization Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Configure global settings that apply across all branches.
        </p>
      </div>

      {isOwner && <>
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

      {/* Receipt & Discount Settings */}
      <Card>
        <CardHeader className="border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Receipt & Discount Settings</CardTitle>
          </div>
          <CardDescription className="text-xs mt-1">
            Customize receipts and set discount limits for cashiers.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-5 space-y-5">
          {/* Max cashier discount */}
          <div className="space-y-2">
            <Label htmlFor="max-discount">Max Cashier Discount (%)</Label>
            <div className="flex items-center gap-2">
              <div className="relative w-36">
                <Input
                  id="max-discount"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={maxDiscountInput}
                  onChange={(e) => setMaxDiscountInput(e.target.value)}
                  className="pr-8"
                />
                <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-sm text-muted-foreground">
                  %
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" />
                Cashiers cannot exceed this discount limit
              </div>
            </div>
            {!maxDiscountValid && maxDiscountInput !== "" && (
              <p className="text-xs text-destructive">Enter a value between 0 and 100</p>
            )}
          </div>

          {/* Receipt header */}
          <div className="space-y-2">
            <Label htmlFor="receipt-header">Receipt Header Message</Label>
            <Textarea
              id="receipt-header"
              placeholder="e.g. Welcome to Our Store!"
              value={receiptHeader}
              onChange={(e) => setReceiptHeader(e.target.value)}
              rows={2}
              maxLength={42}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">{receiptHeader.length}/42 characters — shown above the store name on receipts</p>
          </div>

          {/* Receipt footer */}
          <div className="space-y-2">
            <Label htmlFor="receipt-footer">Receipt Footer Message</Label>
            <Textarea
              id="receipt-footer"
              placeholder="e.g. No exchange, no refund."
              value={receiptFooter}
              onChange={(e) => setReceiptFooter(e.target.value)}
              rows={2}
              maxLength={42}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">{receiptFooter.length}/42 characters — shown at the bottom of receipts</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleOwnerSave} disabled={!isOwnerDirty || !maxDiscountValid || isOwnerPending}>
          {isOwnerPending ? "Saving…" : "Save Receipt & Discount Settings"}
        </Button>
      </div>
      </>}

      {/* Manager Override PIN */}
      <Card>
        <CardHeader className="border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Manager Override PIN</CardTitle>
          </div>
          <CardDescription className="text-xs mt-1">
            Cashiers enter this PIN to void transactions at the POS without needing a manager account.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              {hasPin ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-transparent bg-green-500/15 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
                  ●●●● Configured
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  Not configured
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {hasPin && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive text-xs"
                  onClick={handleClearPin}
                  disabled={isPinPending}
                >
                  {isPinPending ? "Removing…" : "Remove PIN"}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPinDialogOpen(true)}
                disabled={isPinPending}
              >
                {hasPin ? "Change PIN" : "Set PIN"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PIN Dialog */}
      <Dialog open={pinDialogOpen} onOpenChange={(o) => { if (!o) handlePinDialogClose(); else setPinDialogOpen(true); }}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-base">{hasPin ? "Change Manager PIN" : "Set Manager PIN"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="new-pin" className="text-sm font-medium">New PIN (4–6 digits)</label>
              <Input
                id="new-pin"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="e.g. 1234"
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="confirm-pin" className="text-sm font-medium">Confirm PIN</label>
              <Input
                id="confirm-pin"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="Repeat PIN"
              />
            </div>
            {pinError && <p className="text-xs text-destructive">{pinError}</p>}
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" size="sm" onClick={handlePinDialogClose} disabled={isPinPending}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSetPin}
              disabled={newPin.length < 4 || confirmPin.length < 4 || isPinPending}
            >
              {isPinPending ? "Saving…" : "Save PIN"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isOwner && <>
      {/* Currency */}
      <Card>
        <CardHeader className="border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Currency</CardTitle>
          </div>
          <CardDescription className="text-xs mt-1">
            All prices and amounts will be displayed in this currency.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-5 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="currency-select">Display Currency</Label>
            <Select value={selectedCode} onValueChange={(v) => { if (v) setSelectedCode(v) }}>
              <SelectTrigger id="currency-select" className="w-72">
                <SelectValue placeholder="Select currency">
                  {selectedCurrency.label}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Preview</p>
            <p className="text-sm text-foreground tabular-nums">
              {new Intl.NumberFormat(selectedCurrency.locale, {
                style: "currency",
                currency: selectedCurrency.code,
              }).format(1234.56)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Tax Rate */}
      <Card>
        <CardHeader className="border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <Percent className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Tax Rate</CardTitle>
          </div>
          <CardDescription className="text-xs mt-1">
            Applied to all POS transactions. Set to 0 to disable tax.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-5 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="tax-rate">Tax Rate (%)</Label>
            <div className="flex items-center gap-2">
              <div className="relative w-36">
                <Input
                  id="tax-rate"
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={taxInput}
                  onChange={(e) => setTaxInput(e.target.value)}
                  className="pr-8"
                />
                <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-sm text-muted-foreground">
                  %
                </span>
              </div>
              {taxRateValid && (
                <span className="text-xs text-muted-foreground">
                  e.g. {new Intl.NumberFormat(selectedCurrency.locale, {
                    style: "currency",
                    currency: selectedCurrency.code,
                  }).format(100)} + {taxInput}% tax ={" "}
                  {new Intl.NumberFormat(selectedCurrency.locale, {
                    style: "currency",
                    currency: selectedCurrency.code,
                  }).format(100 * (1 + taxRateNum / 100))}
                </span>
              )}
            </div>
            {!taxRateValid && taxInput !== "" && (
              <p className="text-xs text-destructive">Enter a value between 0 and 100</p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={!isDirty || !taxRateValid || isPending}>
          {isPending ? "Saving…" : "Save Changes"}
        </Button>
      </div>
      </>}
    </div>
  );
}
