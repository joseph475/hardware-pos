Scaffold a new server action or add a function to an existing server actions file in this project.

The argument describes what the action should do, e.g. `/new-action create and update tax rates`.

Follow this exact pattern:

```ts
'use server'

import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import type { Database } from '@/types/database'

function getAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const ORG_ID = '00000000-0000-0000-0000-000000000001'

export async function myAction(params: { ... }): Promise<void> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = getAdminClient()
  // ... logic ...
  revalidatePath('/relevant/path')
}
```

Rules:
- Always auth-check first
- Use service role client (bypasses RLS)
- Always revalidatePath at the end for mutations
- Use ORG_ID constant for any inserts that need org_id
- For actions that look up the current user's profile (branch_id, role), query `profiles` by `clerk_user_id = userId`
- For Supabase joins that return `never` type (due to empty Relationships[] in Database type), cast with `as any[]` and re-type manually
- If joining tables with multiple FKs to the same table, use explicit FK: `creator:profiles!created_by(full_name)`

Check if a relevant actions file already exists in `lib/actions/` before creating a new file.
