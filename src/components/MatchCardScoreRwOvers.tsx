/** Runs/wickets + optional overs parenthetical (styled separately via `.match-scorecard-overs`). */
export function MatchCardScoreRwOvers({
  rw,
  oversParen,
}: {
  rw: string
  oversParen: string | null
}) {
  return (
    <>
      <span className="match-scorecard-rw">{rw}</span>
      {oversParen ? <span className="match-scorecard-overs">{oversParen}</span> : null}
    </>
  )
}
