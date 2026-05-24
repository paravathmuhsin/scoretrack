import { describe, expect, it } from 'vitest'
import { DEFAULT_PUBLIC_APP_URL, getPublicAppOrigin, publicAppUrl } from './publicAppUrl'

describe('publicAppUrl', () => {
  it('builds paths from default production origin when env unset in test', () => {
    expect(publicAppUrl('/live/abc')).toBe(`${DEFAULT_PUBLIC_APP_URL}/live/abc`)
  })

  it('getPublicAppOrigin returns default in node test env', () => {
    expect(getPublicAppOrigin()).toBe(DEFAULT_PUBLIC_APP_URL)
  })
})
