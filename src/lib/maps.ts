export function mapsUrl(latitude: number, longitude: number) {
  return `https://www.google.com/maps?q=${latitude},${longitude}`
}

export function osmEmbedUrl(latitude: number, longitude: number) {
  const pad = 0.008
  const bbox = `${longitude - pad},${latitude - pad},${longitude + pad},${latitude + pad}`
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude},${longitude}`
}
