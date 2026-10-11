export type Coordinates = {
  latitude: number
  longitude: number
}

const EARTH_RADIUS_M = 6_371_000
const GEOFENCE_METERS = 200

function toRad(degrees: number) {
  return (degrees * Math.PI) / 180
}

export function distanceMeters(a: Coordinates, b: Coordinates) {
  const dLat = toRad(b.latitude - a.latitude)
  const dLng = toRad(b.longitude - a.longitude)
  const lat1 = toRad(a.latitude)
  const lat2 = toRad(b.latitude)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function isOutsideGeofence(
  current: Coordinates,
  site: { latitude: number | null; longitude: number | null; geofence_radius?: number | null },
  maxMeters?: number,
) {
  if (site.latitude == null || site.longitude == null) {
    return { flagged: false, distance: null as number | null, limit: null as number | null }
  }
  const limit = maxMeters ?? site.geofence_radius ?? GEOFENCE_METERS
  const distance = distanceMeters(current, {
    latitude: site.latitude,
    longitude: site.longitude,
  })
  return { flagged: distance > limit, distance, limit }
}

export async function tryGetCurrentPosition() {
  try {
    return await getCurrentPosition()
  } catch {
    return null
  }
}

export function getCurrentPosition() {
  return new Promise<Coordinates>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported in this browser.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        })
      },
      (error) => {
        reject(new Error(error.message || 'Unable to read GPS location.'))
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 0 },
    )
  })
}
