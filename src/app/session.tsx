import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { repo, type AuthUser } from '../data/repo'
import type { Group, Profile } from '../domain/types'

export interface Session {
  user: AuthUser
  profile: Profile
  groups: Group[]
  group: Group | null
  selectGroup(id: string): void
  refresh(): Promise<void>
}

type State = { status: 'loading' } | { status: 'signed-out' } | { status: 'ready'; session: Session }

const Ctx = createContext<State>({ status: 'loading' })
const GROUP_KEY = 'wfl:group'

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: 'loading' })

  const load = useCallback(async () => {
    const user = await repo.getUser()
    if (!user) return setState({ status: 'signed-out' })
    const [profile, groups] = await Promise.all([repo.getProfile(user.id), repo.listGroups()])
    if (!profile) return setState({ status: 'signed-out' })
    const saved = localStorage.getItem(GROUP_KEY)
    const group = groups.find((g) => g.id === saved) ?? groups[0] ?? null
    setState({
      status: 'ready',
      session: {
        user,
        profile,
        groups,
        group,
        selectGroup: (id) => {
          localStorage.setItem(GROUP_KEY, id)
          void load()
        },
        refresh: load,
      },
    })
  }, [])

  useEffect(() => {
    void load()
    return repo.onAuthChange(() => void load())
  }, [load])

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>
}

export const useSessionState = () => useContext(Ctx)

/** Only call inside the signed-in part of the app. */
export function useSession(): Session {
  const s = useContext(Ctx)
  if (s.status !== 'ready') throw new Error('useSession outside a signed-in tree')
  return s.session
}
