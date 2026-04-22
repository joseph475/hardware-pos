"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, MoreHorizontal, Pencil, Trash2, Building2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { upsertBranch } from "@/lib/actions/users";
import type { Branch } from "@/types/database";

interface BranchesClientProps {
  initialBranches: Branch[];
  canAddBranch: boolean;
  canEditBranch: boolean;
}

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "Europe/London",
  "Europe/Paris",
  "Asia/Tokyo",
];

const branchSchema = z.object({
  name: z.string().min(1, "Branch name is required"),
  address: z.string().optional(),
  phone: z.string().optional(),
  timezone: z.string().min(1, "Timezone is required"),
  is_active: z.boolean(),
});
type BranchFormValues = z.infer<typeof branchSchema>;

interface BranchDialogProps {
  branch?: Branch;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

function BranchDialog({ branch, open, onOpenChange, onSaved }: BranchDialogProps) {
  const isEdit = !!branch;
  const [saving, setSaving] = React.useState(false);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } =
    useForm<BranchFormValues>({
      resolver: zodResolver(branchSchema),
      defaultValues: {
        name: branch?.name ?? "",
        address: branch?.address ?? undefined,
        phone: branch?.phone ?? undefined,
        timezone: branch?.timezone ?? "America/New_York",
        is_active: branch?.is_active ?? true,
      },
    });

  const isActive = watch("is_active");

  React.useEffect(() => {
    if (open) {
      reset({
        name: branch?.name ?? "",
        address: branch?.address ?? undefined,
        phone: branch?.phone ?? undefined,
        timezone: branch?.timezone ?? "America/New_York",
        is_active: branch?.is_active ?? true,
      });
    }
  }, [open, branch, reset]);

  async function onSubmit(values: BranchFormValues) {
    setSaving(true);
    try {
      await upsertBranch({
        id: branch?.id,
        name: values.name,
        address: values.address ?? "",
        phone: values.phone ?? "",
        timezone: values.timezone,
        is_active: values.is_active,
      });
      onSaved();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Branch" : "Add Branch"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="b-name">
              Branch Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="b-name"
              placeholder="e.g. Main Branch"
              aria-invalid={!!errors.name}
              {...register("name")}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-address">Address</Label>
            <Input id="b-address" placeholder="Street, City" {...register("address")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="b-phone">Phone</Label>
              <Input id="b-phone" placeholder="+1 555-0000" {...register("phone")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-tz">Timezone</Label>
              <Select
                defaultValue={branch?.timezone ?? "America/New_York"}
                onValueChange={(v) => { if (v !== null) setValue("timezone", v); }}
              >
                <SelectTrigger className="w-full" id="b-tz">
                  <SelectValue placeholder="Timezone" />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-foreground">Active</p>
              <p className="text-xs text-muted-foreground">Branch accepts transactions</p>
            </div>
            <Switch
              checked={isActive}
              onCheckedChange={(checked) => setValue("is_active", checked)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Branch"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function BranchesClient({ initialBranches, canAddBranch, canEditBranch }: BranchesClientProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingBranch, setEditingBranch] = React.useState<Branch | undefined>();

  function openAdd() {
    setEditingBranch(undefined);
    setDialogOpen(true);
  }

  function openEdit(branch: Branch) {
    setEditingBranch(branch);
    setDialogOpen(true);
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Branches</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage your store locations
          </p>
        </div>
        {canAddBranch && (
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4" />
            Add Branch
          </Button>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {initialBranches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-foreground">No branches yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Add your first branch to get started.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border hover:bg-transparent">
                  <TableHead className="pl-4 w-8" />
                  <TableHead>Name</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Timezone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10 pr-4" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialBranches.map((branch) => (
                  <TableRow key={branch.id} className="border-b border-border/50">
                    <TableCell className="pl-4">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-foreground">{branch.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate">
                      {branch.address ?? "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {branch.phone ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{branch.timezone}</TableCell>
                    <TableCell>
                      <Badge
                        className={
                          branch.is_active
                            ? "bg-emerald-500/15 text-emerald-500 border-transparent"
                            : "bg-muted text-muted-foreground border-transparent"
                        }
                      >
                        {branch.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="pr-4">
                      {canEditBranch && (
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={<Button variant="ghost" size="icon-sm" aria-label="Actions" />}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(branch)}>
                              <Pencil className="h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            {canAddBranch && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem variant="destructive">
                                  <Trash2 className="h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <BranchDialog
        branch={editingBranch}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}
