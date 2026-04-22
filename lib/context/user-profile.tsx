'use client'

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useUser } from '@clerk/nextjs'
import { getMyProfile } from '@/lib/actions/users'
import { useCartStore } from '@/lib/store/cart'
import type { Profile, Branch } from '@/types/database'

interface UserProfileContextValue {
  profile: Profile | null
  branch: Branch | null
  loading: boolean
  refetch: () => void
}

interface UserProfileProviderProps {
  children: ReactNode
  initialProfile?: Profile | null
  initialBranch?: Branch | null
}

const UserProfileContext = createContext<UserProfileContextValue>({
  profile: null,
  branch: null,
  loading: true,
  refetch: () => {},
})

export function UserProfileProvider({
  children,
  initialProfile = null,
  initialBranch = null,
}: UserProfileProviderProps) {
  const { isLoaded, user } = useUser()
  const [profile, setProfile] = useState<Profile | null>(initialProfile)
  const [branch, setBranch] = useState<Branch | null>(initialBranch)
  const [loading, setLoading] = useState(initialProfile === null)
  const clearCart = useCartStore((s) => s.clearCart)
  const prevUserIdRef = useRef<string | null | undefined>(user?.id)

  async function fetchProfile() {
    setLoading(true)
    const { profile: p, branch: b } = await getMyProfile()
    setProfile(p)
    setBranch(b)
    setLoading(false)
  }

  useEffect(() => {
    // Clear cart whenever the logged-in user changes
    if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== user?.id) {
      clearCart()
    }
    prevUserIdRef.current = user?.id

    if (initialProfile !== null) return // Skip fetch — seeded from server
    if (isLoaded && user) {
      fetchProfile()
    } else if (isLoaded && !user) {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, user?.id])

  return (
    <UserProfileContext.Provider value={{ profile, branch, loading, refetch: fetchProfile }}>
      {children}
    </UserProfileContext.Provider>
  )
}

export function useUserProfile() {
  return useContext(UserProfileContext)
}
