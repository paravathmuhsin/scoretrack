import { doc, getDoc, getDocs, query, updateDoc, collection, where } from 'firebase/firestore'
import type { MatchDoc, MatchTeamSnapshot, Side } from '../types/models'
import { getDb } from '../firebase/config'

function winnerSnapshot(m: MatchDoc, winnerSide: Side): MatchTeamSnapshot {
  return winnerSide === 'home' ? m.home : m.away
}

/**
 * After a tournament match is completed, fill any TBD slots in later knockout matches.
 */
export async function advanceKnockoutFixture(completedMatchId: string): Promise<void> {
  const db = getDb()
  const ref = doc(db, 'matches', completedMatchId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return
  const m = snap.data() as MatchDoc
  if (m.status !== 'completed' || !m.tournamentId || !m.resultSummary) return

  const winnerSide = m.resultSummary.winnerSide
  if (winnerSide !== 'home' && winnerSide !== 'away') return

  const win = winnerSnapshot(m, winnerSide)

  const qy = query(collection(db, 'matches'), where('tournamentId', '==', m.tournamentId))
  const all = await getDocs(qy)

  for (const d of all.docs) {
    if (d.id === completedMatchId) continue
    const target = d.data() as MatchDoc
    const fs = target.fixtureSources
    if (!fs) continue

    const patch: Partial<MatchDoc> = {}
    if (fs.homeFromMatchId === completedMatchId) {
      patch.home = win
    }
    if (fs.awayFromMatchId === completedMatchId) {
      patch.away = win
    }
    if (Object.keys(patch).length === 0) continue

    await updateDoc(doc(db, 'matches', d.id), patch)
  }
}
