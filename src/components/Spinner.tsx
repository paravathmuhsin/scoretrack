import type { ReactNode } from 'react'

type SpinnerSize = 'sm' | 'md'

const sizePx: Record<SpinnerSize, number> = { sm: 16, md: 28 }

type SpinnerProps = {
  size?: SpinnerSize
  /** When set, spinner is exposed to assistive tech as status text. */
  label?: string
  className?: string
}

export function Spinner({ size = 'md', label, className = '' }: SpinnerProps) {
  const px = sizePx[size]
  const cls = `spinner spinner--${size}${className ? ` ${className}` : ''}`
  if (label) {
    return (
      <span className={cls} style={{ width: px, height: px }} role="status" aria-label={label} />
    )
  }
  return <span className={cls} style={{ width: px, height: px }} aria-hidden />
}

type BtnPendingLabelProps = {
  pending: boolean
  idle: ReactNode
  busyText?: string
}

export function BtnPendingLabel({ pending, idle, busyText = 'Saving…' }: BtnPendingLabelProps) {
  if (!pending) return <>{idle}</>
  return (
    <span className="btn-pending-label">
      <Spinner size="sm" />
      <span>{busyText}</span>
    </span>
  )
}
