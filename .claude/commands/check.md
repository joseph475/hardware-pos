Run a health check on the current state of the inventory POS project.

Do the following in order:

1. **TypeScript** — run `npx tsc --noEmit` and report any errors. Ignore errors in `node_modules`.

2. **Common issues to look for**:
   - Server actions missing `revalidatePath`
   - Client components calling server actions without `useTransition`
   - Base UI `Select` components where `SelectValue` is missing its children label (would show UUID instead of name)
   - Base UI `DropdownMenuItem` using `onSelect` instead of `onClick`
   - Supabase join queries that might return `never` type (look for `.select()` with nested tables and no `as any[]` cast)
   - `router.refresh()` called in `onOpenChange` instead of inside the success callback

3. **Missing wiring** — check that every form/dialog has its `onSave` prop wired up in the parent component (a common source of "submit does nothing" bugs)

4. **Report** — summarise what's healthy, what's broken, and what looks suspicious. Be specific with file:line references.
