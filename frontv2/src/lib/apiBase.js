const DEFAULT_API = 'http://localhost:5000/api'

/**
 * API base URL — LAN dev-д автоматаар host солино.
 * Жишээ: http://192.168.1.3:3000-оор нээгдвэл API → http://192.168.1.3:5000/api
 * (NEXT_PUBLIC_API_URL дээр localhost байхад л; production URL өөрчлөгдөхгүй)
 */
export function getApiBaseUrl() {
  const env = process.env.NEXT_PUBLIC_API_URL || DEFAULT_API
  if (typeof window === 'undefined') return env

  const pageHost = window.location.hostname
  if (pageHost === 'localhost' || pageHost === '127.0.0.1') return env

  try {
    const u = new URL(env)
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
      u.hostname = pageHost
      return u.toString().replace(/\/$/, '')
    }
  } catch {
    return env
      .replace('//localhost', `//${pageHost}`)
      .replace('//127.0.0.1', `//${pageHost}`)
  }
  return env
}

/** Static asset / хуучин uploads path — /api-гүй origin */
export function getApiOrigin() {
  return getApiBaseUrl().replace(/\/api\/?$/, '')
}
