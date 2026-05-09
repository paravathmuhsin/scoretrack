import type { SVGProps } from 'react'
import cricketBatSvg from '@/assets/cricket-bat.svg?raw'
import cricketByesSvg from '@/assets/cricket-byes.svg?raw'
import cricketLegByesSvg from '@/assets/cricket-leg-byes.svg?raw'
import keeperGlovesSvg from '@/assets/keeper-gloves.svg?raw'
import { cn } from '@/lib/utils'

/** Inner markup only — asset uses viewBox 0 0 1171 1343, fills mapped to currentColor. */
const cricketBatInnerHtml = cricketBatSvg
  .replace(/^[\s\S]*?<svg[^>]*>/i, '')
  .replace(/<\/svg>\s*$/i, '')
  .trim()

/** Inner markup — viewBox 0 0 562 392. */
const keeperGlovesInnerHtml = keeperGlovesSvg
  .replace(/^[\s\S]*?<svg[^>]*>/i, '')
  .replace(/<\/svg>\s*$/i, '')
  .trim()

/** Stumps-style artwork for byes (Record ball); tints via currentColor. */
const cricketByesInnerHtml = cricketByesSvg
  .replace(/^[\s\S]*?<svg[^>]*>/i, '')
  .replace(/<\/svg>\s*$/i, '')
  .trim()

const cricketLegByesInnerHtml = cricketLegByesSvg
  .replace(/^[\s\S]*?<svg[^>]*>/i, '')
  .replace(/<\/svg>\s*$/i, '')
  .trim()

/** Cricket bat from bundled SVG asset (tints with text color via currentColor). */
export function CricketBatIcon({
  className,
  strokeWidth: _strokeWidth,
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1171 1343"
      fill="none"
      aria-hidden
      {...props}
      className={cn(className)}
      // Local SVG asset; markup is static from src/assets/cricket-bat.svg
      dangerouslySetInnerHTML={{ __html: cricketBatInnerHtml }}
    />
  )
}

/** Wicket-keeper gloves from bundled SVG (Field option; tints via currentColor). */
export function KeeperGlovesIcon({
  className,
  strokeWidth: _strokeWidth,
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 562 392"
      fill="none"
      aria-hidden
      {...props}
      className={cn(className)}
      dangerouslySetInnerHTML={{ __html: keeperGlovesInnerHtml }}
    />
  )
}

/** Byes modifier icon for Record ball (bundled SVG). */
export function ByesIcon({ className, strokeWidth: _strokeWidth, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 478 542"
      aria-hidden
      {...props}
      className={cn('inline-block shrink-0 align-middle', className)}
      dangerouslySetInnerHTML={{ __html: cricketByesInnerHtml }}
    />
  )
}

/** Leg byes modifier icon for Record ball (bundled SVG). */
export function LegByesIcon({ className, strokeWidth: _strokeWidth, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 260 412"
      aria-hidden
      {...props}
      className={cn('inline-block shrink-0 align-middle', className)}
      dangerouslySetInnerHTML={{ __html: cricketLegByesInnerHtml }}
    />
  )
}
