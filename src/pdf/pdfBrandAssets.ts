/** Absolute URL for `public/` assets when generating PDFs in the browser. */
export function pdfPublicAssetUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  if (typeof window !== 'undefined' && window.location?.origin) {
    return new URL(p, window.location.origin).href
  }
  return p
}

export const PDF_BRAND_ICON_SRC = pdfPublicAssetUrl('/brand/scoretrack-icon.png')
export const PDF_BRAND_HEADER_CENTER_SRC = pdfPublicAssetUrl('/brand/scoretrack-header-center.png')
