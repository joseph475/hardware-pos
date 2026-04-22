'use client'

import * as React from 'react'
import { useTransition } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { assignUserBranch } from '@/lib/actions/users'
import type { Profile, Branch } from '@/types/database'

interface AssignUserDialogProps {
  user: Pick<Profile, 'id' | 'full_name' | 'email' | 'role' | 'branch_id'> | null
  branches: Branch[]
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'assign' | 'edit'
}

export function AssignUserDialog({
  user,
  branches,
  open,
  onOpenChange,
  mode,
}: AssignUserDialogProps) {
  const [isPending, startTransition] = useTransition()
  const [role, setRole] = React.useState<Profile['role']>('cashier')
  const [branchId, setBranchId] = React.useState<string>('')
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState(false)

  // Sync state when dialog opens or user changes
  React.useEffect(() => {
    if (open && user) {
      setRole(user.role)
      setBranchId(user.branch_id ?? '')
      setError(null)
      setSuccess(false)
    }
  }, [open, user])

  function handleSave() {
    if (!user) return
    if (role !== 'owner' && !branchId) {
      setError('Please select a branch.')
      return
    }

    setError(null)
    startTransition(async () => {
      try {
        await assignUserBranch({ profileId: user.id, branchId: branchId || null, role })
        setSuccess(true)
        setTimeout(() => {
          onOpenChange(false)
          setSuccess(false)
        }, 800)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      }
    })
  }

  const title = mode === 'assign' ? 'Assign User' : 'Edit Role & Branch'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {user && (
          <div className="space-y-4 pt-1">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-foreground">{user.full_name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>

            {/* Role select */}
            <div className="space-y-1.5">
              <Label htmlFor="role-select">Role</Label>
              <Select
                value={role}
                onValueChange={(v) => setRole(v as Profile['role'])}
              >
                <SelectTrigger className="w-full" id="role-select">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="cashier">Cashier</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Branch select — hidden for owner */}
            {role !== 'owner' && (
              <div className="space-y-1.5">
                <Label htmlFor="branch-select">Branch</Label>
                <Select value={branchId} onValueChange={(v) => { if (v) setBranchId(v) }}>
                  <SelectTrigger className="w-full" id="branch-select">
                    <SelectValue placeholder="Select branch">
                      {branches.find((b) => b.id === branchId)?.name ?? 'Select branch'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {role === 'owner' && (
              <p className="text-xs text-muted-foreground rounded-lg border border-border bg-muted/40 px-3 py-2.5">
                Owners have access to all branches and do not require a branch assignment.
              </p>
            )}

            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}

            {success && (
              <p className="text-xs text-emerald-500">Saved successfully.</p>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isPending}>
                {isPending ? 'Saving…' : 'Save'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// UsersTableClient — owns the dialog state, rendered inside the server page
// ---------------------------------------------------------------------------

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import { Card, CardContent } from '@/components/ui/card'
import { MoreHorizontal, Pencil, UserCheck, UserMinus } from 'lucide-react'
import type { UserWithBranch } from '@/lib/actions/users'

const ROLE_CONFIG: Record<string, { label: string; className: string }> = {
  owner: {
    label: 'Owner',
    className: 'bg-amber-500/15 text-amber-500 border-transparent',
  },
  super_admin: {
    label: 'Owner',
    className: 'bg-amber-500/15 text-amber-500 border-transparent',
  },
  manager: {
    label: 'Manager',
    className: 'bg-blue-500/15 text-blue-500 border-transparent',
  },
  cashier: {
    label: 'Cashier',
    className: 'bg-emerald-500/15 text-emerald-500 border-transparent',
  },
}

function getInitials(name: string | null): string {
  if (!name) return '?'
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

interface UsersTableClientProps {
  users: UserWithBranch[]
  branches: Branch[]
}

export function UsersTableClient({ users, branches }: UsersTableClientProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [dialogMode, setDialogMode] = React.useState<'assign' | 'edit'>('edit')
  const [selectedUser, setSelectedUser] = React.useState<UserWithBranch | null>(null)

  function openEdit(user: UserWithBranch) {
    setSelectedUser(user)
    setDialogMode('edit')
    setDialogOpen(true)
  }

  if (users.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-sm text-muted-foreground">No users found.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border hover:bg-transparent">
                <TableHead className="pl-4 w-10" />
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-10 pr-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const { label, className } = ROLE_CONFIG[user.role]
                return (
                  <TableRow key={user.id} className="border-b border-border/50">
                    <TableCell className="pl-4">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-xs font-medium shrink-0">
                        {getInitials(user.full_name)}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      {user.full_name}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {user.email}
                    </TableCell>
                    <TableCell>
                      <Badge className={className}>{label}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {user.branches?.name ?? (
                        <span className="italic text-amber-500">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {user.created_at.slice(0, 10)}
                    </TableCell>
                    <TableCell className="pr-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="User actions"
                            />
                          }
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(user)}>
                            <Pencil className="h-4 w-4" />
                            Edit Role / Branch
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive">
                            <UserMinus className="h-4 w-4" />
                            Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AssignUserDialog
        user={selectedUser}
        branches={branches}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// PendingUsersClient — the "Pending Assignment" cards section
// ---------------------------------------------------------------------------

interface PendingUsersClientProps {
  users: UserWithBranch[]
  branches: Branch[]
}

export function PendingUsersClient({ users, branches }: PendingUsersClientProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [selectedUser, setSelectedUser] = React.useState<UserWithBranch | null>(null)

  function openAssign(user: UserWithBranch) {
    setSelectedUser(user)
    setDialogOpen(true)
  }

  if (users.length === 0) return null

  return (
    <>
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Pending Assignment
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            These users have signed up but have not been assigned to a branch yet.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {users.map((user) => (
            <div
              key={user.id}
              className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 flex items-start justify-between gap-3"
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="h-9 w-9 rounded-full bg-amber-500/15 flex items-center justify-center text-amber-600 dark:text-amber-400 text-xs font-semibold shrink-0">
                  {getInitials(user.full_name)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {user.full_name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {user.email}
                  </p>
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5 font-mono">
                    Joined {user.created_at.slice(0, 10)}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 border-amber-500/40 hover:border-amber-500/70"
                onClick={() => openAssign(user)}
              >
                <UserCheck className="h-3.5 w-3.5" />
                Assign
              </Button>
            </div>
          ))}
        </div>
      </section>

      <AssignUserDialog
        user={selectedUser}
        branches={branches}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode="assign"
      />
    </>
  )
}
