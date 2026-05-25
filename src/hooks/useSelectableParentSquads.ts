import { collection, doc, getDoc, onSnapshot, query } from 'firebase/firestore'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { getDb } from '../firebase/config'
import { filterMyTeamsDocPath } from '../lib/ownedByUser'
import type { AccessibleSquadDoc, RosterPlayer, TeamDoc } from '../types/models'

export type SelectableParentSquad = {
  ownerUid: string
  teamId: string
  teamName: string
  teamShortName?: string
  isOwner: boolean
  players: RosterPlayer[]
  loading: boolean
}

function squadKey(ownerUid: string, teamId: string): string {
  return `${ownerUid}:${teamId}`
}

export function useSelectableParentSquads(): {
  squads: SelectableParentSquad[]
  loading: boolean
} {
  const { user } = useAuth()
  const [ownedTeams, setOwnedTeams] = useState<(TeamDoc & { id: string })[]>([])
  const [accessible, setAccessible] = useState<(AccessibleSquadDoc & { id: string })[]>([])
  const [rosters, setRosters] = useState<Record<string, RosterPlayer[]>>({})
  const [rosterLoading, setRosterLoading] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!user) {
      setOwnedTeams([])
      return
    }
    const qy = query(collection(getDb(), 'users', user.uid, 'teams'))
    return onSnapshot(qy, (snap) => {
      const list: (TeamDoc & { id: string })[] = []
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() as TeamDoc) }))
      setOwnedTeams(filterMyTeamsDocPath(list, user.uid))
    })
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
      setAccessible(list)
    })
  }, [user])

  const entries = useMemo(() => {
    if (!user) return []
    const map = new Map<string, { ownerUid: string; teamId: string; teamName: string; teamShortName?: string; isOwner: boolean }>()
    for (const t of ownedTeams) {
      const sn = t.shortName?.trim()
      map.set(squadKey(user.uid, t.id), {
        ownerUid: user.uid,
        teamId: t.id,
        teamName: t.name,
        ...(sn ? { teamShortName: sn } : {}),
        isOwner: true,
      })
    }
    for (const a of accessible) {
      const k = squadKey(a.ownerUid, a.teamId)
      if (map.has(k)) continue
      const sn = a.teamShortName?.trim()
      map.set(k, {
        ownerUid: a.ownerUid,
        teamId: a.teamId,
        teamName: a.teamName,
        ...(sn ? { teamShortName: sn } : {}),
        isOwner: false,
      })
    }
    return [...map.values()]
  }, [user, ownedTeams, accessible])

  useEffect(() => {
    if (!user || entries.length === 0) {
      setRosters({})
      setRosterLoading({})
      return
    }
    let cancelled = false
    const loading: Record<string, boolean> = {}
    for (const e of entries) loading[squadKey(e.ownerUid, e.teamId)] = true
    setRosterLoading(loading)

    void (async () => {
      const next: Record<string, RosterPlayer[]> = {}
      await Promise.all(
        entries.map(async (e) => {
          const k = squadKey(e.ownerUid, e.teamId)
          try {
            const snap = await getDoc(doc(getDb(), 'users', e.ownerUid, 'teams', e.teamId))
            if (cancelled) return
            if (snap.exists()) {
              const data = snap.data() as TeamDoc
              next[k] = data.players ?? []
            } else {
              next[k] = []
            }
          } catch {
            if (!cancelled) next[k] = []
          }
        }),
      )
      if (cancelled) return
      setRosters(next)
      setRosterLoading({})
    })()

    return () => {
      cancelled = true
    }
  }, [user, entries])

  const squads = useMemo((): SelectableParentSquad[] => {
    return entries
      .map((e) => {
        const k = squadKey(e.ownerUid, e.teamId)
        return {
          ...e,
          players: rosters[k] ?? (e.isOwner ? ownedTeams.find((t) => t.id === e.teamId)?.players ?? [] : []),
          loading: Boolean(rosterLoading[k]),
        }
      })
      .sort((a, b) => a.teamName.localeCompare(b.teamName))
  }, [entries, rosters, rosterLoading, ownedTeams])

  const loading = squads.some((s) => s.loading) && squads.length > 0

  return { squads, loading }
}
