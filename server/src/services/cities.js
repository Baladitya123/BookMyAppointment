function canonicalCity(value) {
  const words = String(value || '').trim().replace(/\s+/g, ' ').split(' ').filter(Boolean)
  if (!words.length) return null
  return words.map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ')
}

function uniqueCities(hospitals = []) {
  const cities = new Map()
  for (const hospital of hospitals) {
    if (hospital.isSampleData === true) continue
    const city = canonicalCity(hospital.city)
    if (city && !cities.has(city.toLowerCase())) cities.set(city.toLowerCase(), city)
  }
  return [...cities.values()].sort((a, b) => a.localeCompare(b))
}

function matchCity(value, cities = []) {
  const normalized = canonicalCity(value)
  if (!normalized) return null
  return cities.find(city => city.toLowerCase() === normalized.toLowerCase()) || null
}

module.exports = { canonicalCity, uniqueCities, matchCity }
