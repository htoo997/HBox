export type AqiReading = {
  value: number
  label: string
  color: string
  place: string
  placeTitle: string
}

type Coords = {
  latitude: number
  longitude: number
}

type OpenMeteoAirQuality = {
  current?: {
    us_aqi?: number | null
  }
}

type ReverseGeocode = {
  city?: string
  locality?: string
  principalSubdivision?: string
}

const BANGKOK: Coords & { place: string; placeTitle: string } = {
  latitude: 13.7563,
  longitude: 100.5018,
  place: 'BKK',
  placeTitle: 'Bangkok',
}

export function aqiCategory(value: number): Pick<AqiReading, 'label' | 'color'> {
  if (value <= 50) return { label: 'Good', color: '#a6e3a1' }
  if (value <= 100) return { label: 'Moderate', color: '#f9e2af' }
  if (value <= 150) return { label: 'Sensitive', color: '#fab387' }
  if (value <= 200) return { label: 'Unhealthy', color: '#f38ba8' }
  if (value <= 300) return { label: 'Very unhealthy', color: '#cba6f7' }
  return { label: 'Hazardous', color: '#eba0ac' }
}

function compactPlace(name: string) {
  const trimmed = name.trim()
  if (!trimmed) return 'Local'
  return trimmed.length > 18 ? `${trimmed.slice(0, 17)}…` : trimmed
}

function pickPlaceName(data: ReverseGeocode) {
  const city = data.city?.trim() ?? ''
  const locality = data.locality?.trim() ?? ''
  const admin = data.principalSubdivision?.trim() ?? ''
  const looksAdmin = /amphoe|district|county|khet|tambon|prefecture|municipality/i

  if (city && !looksAdmin.test(city)) return city
  if (locality) return locality
  return city || admin
}

function getDeviceCoords(signal?: AbortSignal): Promise<Coords | null> {
  if (!navigator.geolocation) return Promise.resolve(null)

  return new Promise((resolve) => {
    const finish = (coords: Coords | null) => {
      signal?.removeEventListener('abort', onAbort)
      resolve(coords)
    }
    const onAbort = () => finish(null)

    if (signal?.aborted) {
      finish(null)
      return
    }
    signal?.addEventListener('abort', onAbort, { once: true })

    navigator.geolocation.getCurrentPosition(
      (position) => {
        finish({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
      },
      () => finish(null),
      { enableHighAccuracy: false, maximumAge: 10 * 60 * 1000, timeout: 8000 },
    )
  })
}

async function fetchUsAqi(coords: Coords, signal?: AbortSignal) {
  const url = new URL('https://air-quality-api.open-meteo.com/v1/air-quality')
  url.searchParams.set('latitude', String(coords.latitude))
  url.searchParams.set('longitude', String(coords.longitude))
  url.searchParams.set('current', 'us_aqi')
  url.searchParams.set('timezone', 'auto')

  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error('Could not load AQI')

  const data = (await response.json()) as OpenMeteoAirQuality
  const value = data.current?.us_aqi
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('AQI is unavailable')
  }

  const rounded = Math.round(value)
  return { value: rounded, ...aqiCategory(rounded) }
}

async function fetchPlaceName(coords: Coords, signal?: AbortSignal) {
  const url = new URL('https://api.bigdatacloud.net/data/reverse-geocode-client')
  url.searchParams.set('latitude', String(coords.latitude))
  url.searchParams.set('longitude', String(coords.longitude))
  url.searchParams.set('localityLanguage', 'en')

  const response = await fetch(url, { signal })
  if (!response.ok) return { place: 'Local', placeTitle: 'Current location' }

  const data = (await response.json()) as ReverseGeocode
  const name = pickPlaceName(data)
  if (!name) return { place: 'Local', placeTitle: 'Current location' }
  return { place: compactPlace(name), placeTitle: name }
}

export async function fetchLocalAqi(signal?: AbortSignal): Promise<AqiReading> {
  const device = await getDeviceCoords(signal)
  const coords = device ?? BANGKOK
  const fallbackPlace = device
    ? fetchPlaceName(coords, signal)
    : Promise.resolve({ place: BANGKOK.place, placeTitle: BANGKOK.placeTitle })

  const [reading, place] = await Promise.all([fetchUsAqi(coords, signal), fallbackPlace])
  return { ...reading, ...place }
}
