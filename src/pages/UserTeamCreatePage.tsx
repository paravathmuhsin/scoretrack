import { addDoc, collection } from 'firebase/firestore'
import { ArrowLeft, Users } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { UserTeamForm } from '../components/UserTeamForm'
import { getDb } from '../firebase/config'
import { cn } from '@/lib/utils'
import type { TeamDoc } from '../types/models'

export function UserTeamCreatePage() {
  const { user } = useAuth()
  const nav = useNavigate()

  if (!user) return null

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 pb-2">
      <Link
        to="/app/teams"
        className={cn(
          'inline-flex items-center gap-1.5 text-sm font-medium no-underline hover:underline',
          '!text-primary hover:!text-primary visited:!text-primary',
        )}
      >
        <ArrowLeft className="size-4 shrink-0" strokeWidth={2.5} aria-hidden />
        My Teams
      </Link>

      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1 leading-tight">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Create team</h1>
          <p className="mt-1 text-sm text-slate-500">Add your team details and players</p>
        </div>
        <div
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
          aria-hidden
        >
          <Users className="size-6" strokeWidth={2} />
        </div>
      </div>

      <UserTeamForm
        submitLabel="Create team"
        requireLocation
        onSubmit={async (p) => {
          await addDoc(collection(getDb(), 'users', user.uid, 'teams'), {
            name: p.name,
            shortName: p.shortName,
            players: p.players,
            location: p.location,
          } satisfies TeamDoc)
          nav('/app/teams')
        }}
      />
    </div>
  )
}
