import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { getAllUsers, getAllBranches } from '@/lib/actions/users'
import { PendingUsersClient, UsersTableClient } from './assign-user-dialog'

export const dynamic = 'force-dynamic'

function getAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export default async function UsersPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = getAdminClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('clerk_user_id', userId)
    .single()

  if (profile?.role !== 'owner') {
    redirect('/dashboard')
  }

  const [users, branches] = await Promise.all([getAllUsers(), getAllBranches()])

  // owners don't need a branch — only show non-owner users without a branch as pending
  const pendingUsers = users.filter((u) => u.branch_id === null && u.role !== 'owner')
  const allUsers = users

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground">Users</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage team members, roles, and branch assignments.
        </p>
      </div>

      {/* Pending assignment section */}
      <PendingUsersClient users={pendingUsers} branches={branches} />

      {/* All users section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">All Users</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {allUsers.length} {allUsers.length === 1 ? 'member' : 'members'} total
            </p>
          </div>
        </div>

        <UsersTableClient users={allUsers} branches={branches} />
      </section>
    </div>
  )
}
