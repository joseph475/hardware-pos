Create a new dashboard page for this inventory POS project.

The argument is the page route, e.g. `/new-page settings/tax-rates` or `/new-page inventory/locations`.

Follow this exact pattern used throughout the project:

**Server component** (`app/(dashboard)/<route>/page.tsx`):
- No `"use client"` — this is a server component
- Import and use `getAdminClient()` from the standard pattern (createClient with service role key)
- Fetch data from Supabase
- Pass data as props to the client component
- Add `export const dynamic = 'force-dynamic'` if data changes frequently

**Client component** (`app/(dashboard)/<route>/<name>-client.tsx`):
- `"use client"` at the top
- Accepts initial data as props
- Uses `useRouter` + `useTransition` for mutations
- Calls server actions then `router.refresh()` to re-sync data
- Uses shadcn/ui components (built on Base UI — see CLAUDE.md for gotchas)
- Follows existing page layouts: header with title + action button, filters Card, content Card with Table or empty state

**Server actions** (`lib/actions/<name>.ts`):
- `'use server'` at the top
- Always call `auth()` from Clerk and check for userId
- Use `getAdminClient()` (service role, bypasses RLS)
- Always `revalidatePath()` at the end
- Use ORG_ID = `'00000000-0000-0000-0000-000000000001'` for inserts

Generate all three files. Ask if the page needs a dialog/sheet for create/edit forms.
