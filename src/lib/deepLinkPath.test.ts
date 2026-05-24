import { describe, expect, it } from 'vitest'
import { pathFromDeepLinkUrl } from './deepLinkPath'

describe('pathFromDeepLinkUrl', () => {
  it('maps live match links to router paths', () => {
    expect(pathFromDeepLinkUrl('https://scoretrackonline.com/live/abc-123')).toBe('/live/abc-123')
    expect(pathFromDeepLinkUrl('https://www.scoretrackonline.com/live/abc-123?x=1')).toBe(
      '/live/abc-123?x=1',
    )
  })

  it('ignores unknown hosts', () => {
    expect(pathFromDeepLinkUrl('https://evil.example/live/abc')).toBeNull()
  })
})
