Create a new form dialog or sheet for this inventory POS project.

The argument describes what it's for, e.g. `/new-dialog edit supplier` or `/new-dialog create tax rate`.

Choose the right component:
- **Sheet** (side panel) — for forms with many fields, or forms that are triggered from a table row action. Use `SheetContent side="right" className="w-full sm:max-w-lg"`.
- **Dialog** (modal) — for simple forms with 1–3 fields (like categories, quick edits).

Follow these patterns exactly:

**Controlled open state** (always):
```tsx
const [open, setOpen] = React.useState(false)
// Close after save: setOpen(false) inside onSubmit
// Reset form on open: useEffect(() => { if (open) reset({...}) }, [open])
```

**Base UI SheetTrigger** (if using Sheet):
```tsx
<SheetTrigger render={<Button />} nativeButton={true}>
  Trigger Label
</SheetTrigger>
```

**Base UI Select** (always needs explicit children for display):
```tsx
<Select value={watch('field_id')} onValueChange={(val) => { if (val !== null) setValue('field_id', val) }}>
  <SelectTrigger>
    <SelectValue placeholder="Select...">
      {items.find(i => i.id === watch('field_id'))?.name ?? 'Select...'}
    </SelectValue>
  </SelectTrigger>
  <SelectContent>
    {items.map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
  </SelectContent>
</Select>
```

**Form validation**: React Hook Form + Zod (`import { z } from 'zod/v4'`)

**Schema export**: Export a `*SaveValues` interface with parsed types (e.g. prices as `number`, not `string`)

The dialog/sheet should accept:
- `trigger: React.ReactNode` — the element that opens it
- `onSave: (values: SaveValues) => void` — called on submit (parent handles the server action)
- Optional `item?: ItemType` — if editing an existing item

Do NOT call server actions from inside the dialog. The parent handles that.
