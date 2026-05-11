import { collection, doc, onSnapshot, query, where } from 'firebase/firestore'
import {
  ArrowLeft,
  CalendarDays,
  FileText,
  MapPin,
  Settings2,
  SlidersHorizontal,
  Timer,
  Users,
} from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { TournamentLeaderboardTab } from '../components/tournament/TournamentLeaderboardTab'
import { TournamentMvpTab } from '../components/tournament/TournamentMvpTab'
import {
  OverviewDetailRow,
  publicTournamentMatchHeadMeta,
  publicTournamentMatchKicker,
} from '../components/tournament/tournamentPublicDisplay'
import { PublicTournamentMatchScoreLines } from '../components/PublicTournamentMatchScoreLines'
import { TournamentPointsPanel } from '../components/TournamentPointsPanel'
import { getDb } from '../firebase/config'
import { useTournamentDetailsDocumentTitle } from '../hooks/useTournamentDetailsDocumentTitle'
import { cn } from '@/lib/utils'
import { compareMatchesOperationalOrder } from '../lib/matchListSort'
import {
  formatMatchDateTime,
  formatTournamentDate,
} from '../lib/tournamentFormUtils'
import type { MatchDoc, TournamentDoc, TournamentGroupDoc, TournamentLinkedTeamDoc } from '../types/models'

/**
 * Public tournament detail: readable when `tournament.isPublic` or when the signed-in user is the organiser.
 * Match list for anonymous / non-organiser viewers uses **`isPublic === true`** on each match only (not `createdBy`).
 */

const TAB_IDS = ['overview', 'matches', 'teams', 'groups', 'points', 'leaderboard', 'mvp'] as const
type TabId = (typeof TAB_IDS)[number]

function teamInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
  const s = parts[0] ?? '?'
  return s.slice(0, 2).toUpperCase()
}

function teamAvatarHue(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h + name.charCodeAt(i) * (i + 1)) % 360
  return h
}

function PublicTournamentBackLink() {
  return (
    <Link
      to="/tournaments"
      className={cn(
        'mb-0 inline-flex items-center gap-1.5 text-sm font-medium no-underline hover:underline',
        '!text-primary hover:!text-primary visited:!text-primary',
      )}
    >
      <ArrowLeft className="size-4 shrink-0" strokeWidth={2.5} aria-hidden />
      Tournaments
    </Link>
  )
}

export function PublicTournamentDetailPage() {
  const { id } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()

  const [t, setT] = useState<(TournamentDoc & { id: string }) | null>(null)
  const [tournamentMissing, setTournamentMissing] = useState(false)
  const [linkedTeams, setLinkedTeams] = useState<(TournamentLinkedTeamDoc & { id: string })[]>([])
  const [tournamentGroups, setTournamentGroups] = useState<(TournamentGroupDoc & { id: string })[]>([])
  const [tournamentMatches, setTournamentMatches] = useState<(MatchDoc & { id: string })[]>([])
  const [matchesError, setMatchesError] = useState<string | null>(null)

  const canView =
    t != null && (t.isPublic === true || (user != null && user.uid === t.createdBy))

  useEffect(() => {
    if (!id) return
    const ref = doc(getDb(), 'tournaments', id)
    return onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setT(null)
        setTournamentMissing(true)
        return
      }
      setTournamentMissing(false)
      setT({ id: snap.id, ...(snap.data() as TournamentDoc) })
    })
  }, [id])

  useTournamentDetailsDocumentTitle(t)

  useEffect(() => {
    if (!id || !canView || !t) return
    setMatchesError(null)
    const isOrganiserViewer = Boolean(user && t.createdBy && user.uid === t.createdBy)
    const coll = collection(getDb(), 'matches')
    const qy = isOrganiserViewer
      ? query(coll, where('tournamentId', '==', id))
      : query(coll, where('tournamentId', '==', id), where('isPublic', '==', true))
    return onSnapshot(
      qy,
      (snap) => {
        const list: (MatchDoc & { id: string })[] = []
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as MatchDoc) }))
        setTournamentMatches(list)
        setMatchesError(null)
      },
      (err) => {
        console.error('[PublicTournamentDetailPage] matches', err)
        setTournamentMatches([])
        setMatchesError(err.message ?? 'Could not load tournament matches.')
      },
    )
  }, [id, canView, t, user?.uid])

  useEffect(() => {
    if (!id || !canView) return
    const qy = query(collection(getDb(), 'tournaments', id, 'linkedTeams'))
    return onSnapshot(qy, (snap) => {
      const list: (TournamentLinkedTeamDoc & { id: string })[] = []
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() as TournamentLinkedTeamDoc) }))
      list.sort((a, b) => {
        const na = (a.teamName ?? '').toLowerCase()
        const nb = (b.teamName ?? '').toLowerCase()
        if (na !== nb) return na.localeCompare(nb)
        return a.userTeamId.localeCompare(b.userTeamId)
      })
      setLinkedTeams(list)
    })
  }, [id, canView])

  useEffect(() => {
    if (!id || !canView) return
    const col = collection(getDb(), 'tournaments', id, 'groups')
    return onSnapshot(col, (snap) => {
      const list: (TournamentGroupDoc & { id: string })[] = []
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() as TournamentGroupDoc) }))
      list.sort((a, b) => a.name.localeCompare(b.name))
      setTournamentGroups(list)
    })
  }, [id, canView])

  const tournamentMatchesSorted = useMemo(() => {
    const c = [...tournamentMatches]
    c.sort(compareMatchesOperationalOrder)
    return c
  }, [tournamentMatches])

  function linkedTeamDisplayName(linkDocId: string): string {
    const row = linkedTeams.find((l) => l.id === linkDocId)
    return row?.teamName ?? row?.userTeamId ?? linkDocId
  }

  const rawTab = searchParams.get('tab')
  const activeTab: TabId =
    rawTab && TAB_IDS.includes(rawTab as TabId) ? (rawTab as TabId) : 'overview'

  function setTab(next: TabId) {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        if (next === 'overview') p.delete('tab')
        else p.set('tab', next)
        return p
      },
      { replace: true },
    )
  }

  const tabsNavRef = useRef<HTMLDivElement>(null)
  const [tabScroll, setTabScroll] = useState({ hintLeft: false, hintRight: false, overflow: false })

  const updateTabScrollHints = useCallback(() => {
    const el = tabsNavRef.current
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    const overflow = scrollWidth > clientWidth + 1
    const maxScroll = Math.max(0, scrollWidth - clientWidth)
    const hintLeft = overflow && scrollLeft > 4
    const hintRight = overflow && scrollLeft < maxScroll - 4
    setTabScroll({ hintLeft, hintRight, overflow })
  }, [])

  useLayoutEffect(() => {
    const el = tabsNavRef.current
    if (!el) return
    const activeBtn = el.querySelector<HTMLElement>(`#tab-${activeTab}`)
    activeBtn?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    updateTabScrollHints()
  }, [activeTab, updateTabScrollHints])

  useLayoutEffect(() => {
    const el = tabsNavRef.current
    if (!el) return
    const ro = new ResizeObserver(() => updateTabScrollHints())
    ro.observe(el)
    window.addEventListener('resize', updateTabScrollHints)
    updateTabScrollHints()
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', updateTabScrollHints)
    }
  }, [updateTabScrollHints, t?.id])

  const shellClass = 'public-tournament-detail mx-auto w-full max-w-3xl space-y-4'

  if (!id) {
    return (
      <div className={shellClass}>
        <p className="text-sm text-muted-foreground">Missing tournament.</p>
      </div>
    )
  }

  if (t === null && !tournamentMissing) {
    return (
      <div className={shellClass}>
        <div className="space-y-2">
          <PublicTournamentBackLink />
          <p className="mb-0 text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    )
  }

  if (tournamentMissing) {
    return (
      <div className={shellClass}>
        <div className="space-y-2">
          <PublicTournamentBackLink />
          <p className="mb-0 text-sm text-muted-foreground">Tournament not found.</p>
        </div>
      </div>
    )
  }

  if (t && !canView) {
    return (
      <div className={shellClass}>
        <div className="space-y-1">
          <PublicTournamentBackLink />
          <header className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Private tournament</h1>
            <p className="text-sm text-muted-foreground">This tournament is not shared publicly.</p>
          </header>
        </div>
      </div>
    )
  }

  if (!t || !canView) {
    return (
      <div className={shellClass}>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  return (
    <div className={shellClass}>
      <div className="space-y-1">
        <PublicTournamentBackLink />
        <header className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t.name}</h1>
          <p className="text-sm text-muted-foreground">Public standings and fixtures.</p>
        </header>
      </div>

      {tabScroll.overflow ? (
        <p id="tournament-tabs-scroll-hint" className="sr-only">
          This row scrolls horizontally; swipe or drag to see all sections.
        </p>
      ) : null}
      <div
        className={cn(
          'public-tournament-tabs-scroll-wrap',
          tabScroll.overflow && 'public-tournament-tabs-scroll-wrap--scrollable',
          tabScroll.overflow && tabScroll.hintLeft && 'public-tournament-tabs-scroll-wrap--hint-left',
          tabScroll.overflow && tabScroll.hintRight && 'public-tournament-tabs-scroll-wrap--hint-right',
        )}
      >
        <div
          ref={tabsNavRef}
          className="tabs-nav public-tournament-tabs-scroll-inner"
          role="tablist"
          aria-label="Tournament sections"
          aria-describedby={tabScroll.overflow ? 'tournament-tabs-scroll-hint' : undefined}
          onScroll={updateTabScrollHints}
        >
          {(
            [
              ['overview', 'Overview'],
              ['matches', 'Matches'],
              ['teams', 'Teams'],
              ['groups', 'Groups'],
              ['points', 'Point table'],
              ['leaderboard', 'Leaderboard'],
              ['mvp', 'MVP'],
            ] as const
          ).map(([tid, label]) => (
            <button
              key={tid}
              type="button"
              role="tab"
              aria-selected={activeTab === tid}
              id={`tab-${tid}`}
              className={`tabs-nav-item ${activeTab === tid ? 'tabs-nav-item--active' : ''}`}
              onClick={() => setTab(tid)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-3" role="tabpanel" aria-labelledby="tab-overview">
          {(t.teamCount != null ||
            t.location ||
            t.startDate ||
            t.endDate ||
            t.description?.trim()) && (
            <section
              className="public-tournament-surface public-tournament-overview-card"
              aria-labelledby={
                t.teamCount != null || t.location || t.startDate || t.endDate
                  ? 'overview-details-heading'
                  : 'overview-about-heading'
              }
            >
              {t.teamCount != null || t.location || t.startDate || t.endDate ? (
                <>
                  <h3 id="overview-details-heading" className="public-tournament-overview-section-title">
                    Tournament details
                  </h3>
                  <div className="public-tournament-overview-rows">
                    {t.teamCount != null ? (
                      <OverviewDetailRow icon={Users} label="Teams">
                        {t.teamCount}
                      </OverviewDetailRow>
                    ) : null}
                    {t.location ? (
                      <OverviewDetailRow icon={MapPin} label="Location">
                        {t.location}
                      </OverviewDetailRow>
                    ) : null}
                    {(t.startDate || t.endDate) && (
                      <OverviewDetailRow icon={CalendarDays} label="Dates">
                        {t.startDate && t.endDate
                          ? `${formatTournamentDate(t.startDate)} — ${formatTournamentDate(t.endDate)}`
                          : t.startDate
                            ? `Starts ${formatTournamentDate(t.startDate)}`
                            : `Ends ${formatTournamentDate(t.endDate)}`}
                      </OverviewDetailRow>
                    )}
                  </div>
                </>
              ) : null}
              {t.description?.trim() ? (
                <div
                  className={cn(
                    'public-tournament-overview-about',
                    !(t.teamCount != null || t.location || t.startDate || t.endDate) &&
                      'public-tournament-overview-about--solo',
                  )}
                >
                  <h4
                    id="overview-about-heading"
                    className="public-tournament-overview-about-heading"
                  >
                    <FileText className="public-tournament-overview-about-heading-icon" strokeWidth={2} aria-hidden />
                    About
                  </h4>
                  <div className="public-tournament-overview-about-body">{t.description}</div>
                </div>
              ) : null}
            </section>
          )}
          <section
            className="public-tournament-surface public-tournament-overview-card public-tournament-overview-defaults"
            aria-labelledby="overview-defaults-heading"
          >
            <h3 id="overview-defaults-heading" className="public-tournament-overview-defaults-title">
              <Settings2 className="public-tournament-overview-defaults-title-icon" strokeWidth={2} aria-hidden />
              Default match settings
            </h3>
            <div className="public-tournament-overview-rows">
              <OverviewDetailRow icon={Users} label="Squad size">
                {t.defaultSquadSize ?? 11} players per team
              </OverviewDetailRow>
              <OverviewDetailRow icon={Timer} label="Innings overs">
                {t.defaultOversLimit ?? 20} overs
              </OverviewDetailRow>
              <OverviewDetailRow icon={SlidersHorizontal} label="Bowling limit">
                {t.defaultOversPerBowler ?? 4} overs per bowler
              </OverviewDetailRow>
            </div>
          </section>
        </div>
      )}

      {activeTab === 'matches' && (
        <div role="tabpanel" aria-labelledby="tab-matches">
          {matchesError && (
            <p className="text-sm text-destructive" role="alert">
              {matchesError}
            </p>
          )}
          {!matchesError && tournamentMatchesSorted.length === 0 && (
            <p className="text-sm text-muted-foreground">No matches in this tournament yet.</p>
          )}
          {!matchesError && tournamentMatchesSorted.length > 0 && (
            <ul className="public-tournament-match-list">
              {tournamentMatchesSorted.map((m) => {
                const headMeta = publicTournamentMatchHeadMeta(m, t.location)
                return (
                  <li key={m.id} className="public-tournament-match-item">
                  <article className="match-scorecard match-scorecard--listing public-tournament-match-scorecard">
                    <div className="match-scorecard-head">
                      <span className="match-scorecard-kicker-group">
                        {m.status === 'live' ? (
                          <span className="match-scorecard-live-dot" aria-hidden />
                        ) : null}
                        <span
                          className={cn(
                            'match-scorecard-kicker',
                            m.status === 'live'
                              ? 'match-scorecard-kicker--live'
                              : 'match-scorecard-kicker--result',
                          )}
                        >
                          {publicTournamentMatchKicker(m.status)}
                        </span>
                      </span>
                      {headMeta ? (
                        <span className="match-scorecard-meta match-scorecard-meta--listing">
                          {headMeta}
                        </span>
                      ) : null}
                    </div>

                    <div className="public-tournament-match-body">
                      <p className="public-tournament-match-teams-line">
                        <span className="match-scorecard-teamname">{m.home.name}</span>
                        <span className="public-tournament-match-vs" aria-hidden>
                          vs
                        </span>
                        <span className="match-scorecard-teamname">{m.away.name}</span>
                      </p>
                      <PublicTournamentMatchScoreLines match={m} />
                    </div>

                    <div className="match-scorecard-upcoming-footer public-tournament-match-card-footer">
                      <div className="public-tournament-match-footer-inner">
                        {m.status === 'scheduled' && (
                          <p className="public-tournament-match-foot-note">
                            Scheduled {formatMatchDateTime(m.scheduledAt)}
                          </p>
                        )}
                        {m.status === 'live' && m.startedAt && (
                          <p className="public-tournament-match-foot-note">
                            Started {formatMatchDateTime(m.startedAt)}
                          </p>
                        )}
                        {m.isPublic ? (
                          m.status !== 'scheduled' && (
                            <Link
                              className="public-tournament-match-foot-link"
                              to={`/live/${m.publicId}`}
                            >
                              View scorecard
                            </Link>
                          )
                        ) : (
                          <p className="public-tournament-match-foot-note public-tournament-match-foot-note--muted">
                            Scorecard is private
                          </p>
                        )}
                      </div>
                    </div>
                  </article>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {activeTab === 'teams' && (
        <div role="tabpanel" aria-labelledby="tab-teams">
          {linkedTeams.length === 0 ? (
            <p className="muted">No squads linked yet.</p>
          ) : (
            <div className="tourn-team-grid">
              {linkedTeams.map((l) => {
                const label = l.teamName ?? l.userTeamId
                const hue = teamAvatarHue(label)
                return (
                  <article key={l.id} className="tourn-team-card">
                    <div
                      className="tourn-team-card-visual"
                      style={{ background: `hsl(${hue} 32% 38%)` }}
                      aria-hidden="true"
                    >
                      <span className="tourn-team-card-initials">{teamInitials(label)}</span>
                    </div>
                    <div className="tourn-team-card-footer">
                      <strong className="tourn-team-card-title">{label}</strong>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'groups' && (
        <div role="tabpanel" aria-labelledby="tab-groups">
          {tournamentGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No groups yet — organiser has not created league pools.</p>
          ) : (
            <ul className="m-0 list-none space-y-3 p-0" role="list">
              {tournamentGroups.map((g) => {
                const members = (g.linkedTeamIds ?? [])
                  .map((lid) => linkedTeamDisplayName(lid))
                  .filter(Boolean)
                  .join(' · ')
                return (
                  <li
                    key={g.id}
                    className="rounded-xl border border-slate-100 bg-white px-4 py-3.5 shadow-[0_1px_3px_rgba(15,23,42,0.06)]"
                    role="listitem"
                  >
                    <p className="text-base font-bold leading-snug text-slate-900">{g.name}</p>
                    <p className="mt-1.5 text-sm leading-snug text-slate-600 line-clamp-4">
                      {members || 'No squads in this group yet.'}
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {activeTab === 'points' && (
        <div role="tabpanel" aria-labelledby="tab-points">
          <TournamentPointsPanel tournamentId={id} variant="public" />
        </div>
      )}

      {activeTab === 'leaderboard' && (
        <div role="tabpanel" aria-labelledby="tab-leaderboard">
          <TournamentLeaderboardTab
            tournamentId={id!}
            tournament={t}
            teamLabel={linkedTeamDisplayName}
            publicListing
          />
        </div>
      )}

      {activeTab === 'mvp' && (
        <div role="tabpanel" aria-labelledby="tab-mvp">
          <TournamentMvpTab
            tournamentId={id!}
            tournament={t}
            teamLabel={linkedTeamDisplayName}
            publicListing
          />
        </div>
      )}
    </div>
  )
}
