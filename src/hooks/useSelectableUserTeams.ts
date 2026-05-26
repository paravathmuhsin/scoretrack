import { collection, doc, getDoc, onSnapshot, orderBy, query } from 'firebase/firestore'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { getDb } from '../firebase/config'
import { filterMyTeamsDocPath } from '../lib/ownedByUser'
import type { AccessibleSquadDoc, TeamDoc } from '../types/models'

export type SelectableUserTeam = TeamDoc & {
  id: string
  ownerUid: string
  isCoOwned: boolean
}

function squadKey(ownerUid: string, teamId: string): string {
  return `${ownerUid}:${teamId}`
}

export function useSelectableUserTeams(): {
  teams: SelectableUserTeam[]
  loading: boolean
} {
  const { user } = useAuth()
  const [ownedTeams, setOwnedTeams] = useState<(TeamDoc & { id: string })[]>([])
  const [accessible, setAccessible] = useState<(AccessibleSquadDoc & { id: string })[]>([])
  const [coOwnedTeams, setCoOwnedTeams] = useState<SelectableUserTeam[]>([])
  const [coOwnedLoading, setCoOwnedLoading] = useState(false)

  useEffect(() => {
    if (!user) {
      setOwnedTeams([])
      return
    }
    const qy = query(collection(getDb(), 'users', user.uid, 'teams'), orderBy('name'))
    return onSnapshot(
      qy,
      (snap) => {
        const list: (TeamDoc & { id: string })[] = []
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as TeamDoc) }))
        setOwnedTeams(filterMyTeamsDocPath(list, user.uid))
      },
      () => setOwnedTeams([]),
    )
  }, [user])

  useEffect(() => {
    if (!user) {
      setAccessible([])
      return
    }
    const qy = query(collection(getDb(), 'users', user.uid, 'accessibleSquads'))
    return onSnapshot(qy, (snap) => {
      const list: (AccessibleSquadDoc & { id: string })[] = []
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() as AccessibleSquadDoc) }))
      setAccessible(list.filter((a) => a.role === 'co-owner'))
    })
  }, [user])

  const coOwnedEntries = useMemo(() => {
    if (!user) return []
    return accessible.filter((a) => a.ownerUid !== user.uid)
  }, [user, accessible])

  useEffect(() => {
    if (!user || coOwnedEntries.length === 0) {
      setCoOwnedTeams([])
      setCoOwnedLoading(false)
      return
    }
    let cancelled = false
    setCoOwnedLoading(true)
    void (async () => {
      const loaded: SelectableUserTeam[] = []
      await Promise.all(
        coOwnedEntries.map(async (a) => {
          try {
            const snap = await getDoc(doc(getDb(), 'users', a.ownerUid, 'teams', a.teamId))
            if (!snap.exists()) return
            const data = snap.data() as TeamDoc
            loaded.push({
              id: snap.id,
              ...data,
              ownerUid: a.ownerUid,
              isCoOwned: true,
            })
          } catch {
            /* ignore */
          }
        }),
      )
      if (!cancelled) {
        setCoOwnedTeams(loaded)
        setCoOwnedLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user, coOwnedEntries])

  const teams = useMemo((): SelectableUserTeam[] => {
    if (!user) return []
    const map = new Map<string, SelectableUserTeam>()
    for (const t of ownedTeams) {
      map.set(squadKey(user.uid, t.id), {
        ...t,
        ownerUid: user.uid,
        isCoOwned: false,
      })
    }
    for (const t of coOwnedTeams) {
      const k = squadKey(t.ownerUid, t.id)
      if (!map.has(k)) map.set(k, t)
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [user, ownedTeams, coOwnedTeams])

  return { teams, loading: coOwnedLoading && coOwnedEntries.length > 0 }
}
