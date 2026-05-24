/** Custom production domain (Firebase Hosting + app links). */
export const PUBLIC_APP_DOMAIN = 'scoretrackonline.com'

export const PUBLIC_APP_ORIGIN = `https://${PUBLIC_APP_DOMAIN}`

export const PUBLIC_APP_WWW_ORIGIN = `https://www.${PUBLIC_APP_DOMAIN}`

export const PUBLIC_APP_HOSTS = [PUBLIC_APP_DOMAIN, `www.${PUBLIC_APP_DOMAIN}`] as const
