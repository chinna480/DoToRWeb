export function calcDistance(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2
  // Clamp a to [0, 1] to prevent NaN from floating point errors (e.g. a=1.0000000000001)
  const clamped = Math.min(1, Math.max(0, a))
  return (R * 2 * Math.atan2(Math.sqrt(clamped), Math.sqrt(1 - clamped))).toFixed(1)
}