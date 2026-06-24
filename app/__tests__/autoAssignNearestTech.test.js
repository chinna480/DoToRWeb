/**
 * Unit tests for autoAssignNearestTech — scoring logic, 5 km radius filter,
 * and excludePhones (rejection) support.
 *
 * Firebase Database is fully mocked. The real calcDistance from
 * ../utils/distance is used so the distance-based scoring is tested
 * against real Haversine calculations.
 */

import { __setMockTechs, __clearMockTechs, mockUpdate } from './__mocks__/firebaseDatabase'

// The module under test — must be imported AFTER clearing mocks
import { autoAssignNearestTech } from '../firebase/config'

// ── A real coordinate pair for the customer ─────────────────────────────
const CUST_LAT = 17.3850
const CUST_LNG = 78.4867
const CUST_PIN = '500081'

// ── Helper: create a tech profile ───────────────────────────────────────
function makeTech(phone, overrides = {}) {
  return {
    phone,
    name: `Tech ${phone}`,
    pincode: '500081',
    lat: 17.3850,
    lng: 78.4867,
    ...overrides,
  }
}

beforeEach(() => {
  __clearMockTechs()
  mockUpdate.mockClear()
})

// ===================== EDGE CASES =====================

test('returns null when orderId is falsy', async () => {
  const result = await autoAssignNearestTech(null, CUST_LAT, CUST_LNG, CUST_PIN)
  expect(result).toBeNull()
  expect(mockUpdate).not.toHaveBeenCalled()
})

test('returns null when no techs are registered', async () => {
  __setMockTechs({})
  const result = await autoAssignNearestTech('order1', CUST_LAT, CUST_LNG, CUST_PIN)
  expect(result).toBeNull()
  expect(mockUpdate).not.toHaveBeenCalled()
})

test('returns null when techs node exists but is empty', async () => {
  __setMockTechs({})
  const result = await autoAssignNearestTech('order1', CUST_LAT, CUST_LNG, CUST_PIN)
  expect(result).toBeNull()
})

// ===================== SINGLE TECH =====================

test('assigns the only available tech', async () => {
  __setMockTechs({
    '9876543210': { name: 'Ramesh', pincode: '500081', lat: 17.3860, lng: 78.4870 },
  })
  const result = await autoAssignNearestTech('order1', CUST_LAT, CUST_LNG, CUST_PIN)
  expect(result).toEqual({ techPhone: '9876543210', techName: 'Ramesh' })
  expect(mockUpdate).toHaveBeenCalledTimes(1)
  const updateArg = mockUpdate.mock.calls[0][1]
  expect(updateArg.techPhone).toBe('9876543210')
  expect(updateArg.techName).toBe('Ramesh')
  expect(updateArg.status).toBe('accepted')
  expect(updateArg.autoAssigned).toBe(true)
})

// ===================== 5KM RADIUS FILTER =====================

test('excludes techs beyond 5 km radius', async () => {
  // Tech at ~120 km away → should be excluded
  __setMockTechs({
    '1111111111': { name: 'FarAway', pincode: '500081', lat: 18.0000, lng: 79.0000 }, // ~120 km
  })
  const result = await autoAssignNearestTech('order5k', CUST_LAT, CUST_LNG, CUST_PIN)
  expect(result).toBeNull()
  expect(mockUpdate).not.toHaveBeenCalled()
})

test('includes techs within 5 km radius', async () => {
  // Tech at ~0.5 km → should be eligible
  __setMockTechs({
    '2222222222': { name: 'CloseBy', pincode: '500081', lat: 17.3900, lng: 78.4900 }, // ~0.5 km
  })
  const result = await autoAssignNearestTech('order5k2', CUST_LAT, CUST_LNG, CUST_PIN)
  expect(result).toEqual({ techPhone: '2222222222', techName: 'CloseBy' })
  expect(mockUpdate).toHaveBeenCalledTimes(1)
})

test('includes tech at exactly 5 km (boundary)', async () => {
  // ~5 km → 1 degree of latitude ≈ 111 km, so dLat ≈ 5/111 ≈ 0.045
  __setMockTechs({
    '3333333333': { name: 'Boundary', pincode: '500081', lat: 17.4300, lng: 78.4867 }, // ~5 km north
  })
  const result = await autoAssignNearestTech('order5k3', CUST_LAT, CUST_LNG, CUST_PIN)
  expect(result).not.toBeNull()
})

test('excludes techs beyond 5 km but includes closer one', async () => {
  __setMockTechs({
    '4444444444': { name: 'FarAway',  pincode: '500081', lat: 18.0000, lng: 79.0000 }, // ~120 km → excluded
    '5555555555': { name: 'CloseBy',  pincode: '500081', lat: 17.3900, lng: 78.4900 }, // ~0.5 km → eligible
  })
  const result = await autoAssignNearestTech('order5k4', CUST_LAT, CUST_LNG, CUST_PIN)
  expect(result).toEqual({ techPhone: '5555555555', techName: 'CloseBy' })
})

test('includes tech with no GPS coords even if far (fallback)', async () => {
  // Tech has no lat/lng, so we can't determine distance — include them
  __setMockTechs({
    '6666666666': { name: 'NoGps', pincode: '500081' },
  })
  const result = await autoAssignNearestTech('order5k5', CUST_LAT, CUST_LNG, CUST_PIN)
  expect(result).toEqual({ techPhone: '6666666666', techName: 'NoGps' })
})

// ===================== EXCLUDE PHONES (Rejection) =====================

test('excludes phones passed in excludePhones array', async () => {
  __setMockTechs({
    '9999999991': { name: 'Excluded', pincode: '500081', lat: 17.3860, lng: 78.4870 },
    '9999999992': { name: 'Avail',    pincode: '500081', lat: 17.3870, lng: 78.4880 },
  })
  const result = await autoAssignNearestTech('orderEx1', CUST_LAT, CUST_LNG, CUST_PIN, ['9999999991'])
  expect(result).toEqual({ techPhone: '9999999992', techName: 'Avail' })
})

test('returns null when all techs are excluded', async () => {
  __setMockTechs({
    '7777777777': { name: 'OnlyOne', pincode: '500081', lat: 17.3860, lng: 78.4870 },
  })
  const result = await autoAssignNearestTech('orderEx2', CUST_LAT, CUST_LNG, CUST_PIN, ['7777777777'])
  expect(result).toBeNull()
  expect(mockUpdate).not.toHaveBeenCalled()
})

test('excludePhones combined with 5km filter', async () => {
  __setMockTechs({
    'A1': { name: 'FarExcluded', pincode: '500081', lat: 18.0000, lng: 79.0000 }, // ~120 km, excluded by distance
    'B1': { name: 'CloseButExcluded', pincode: '500081', lat: 17.3900, lng: 78.4900 }, // ~0.5 km, excluded by phone
    'C1': { name: 'Available',   pincode: '500081', lat: 17.3880, lng: 78.4890 }, // ~0.4 km, eligible
  })
  const result = await autoAssignNearestTech('orderEx3', CUST_LAT, CUST_LNG, CUST_PIN, ['B1'])
  expect(result).toEqual({ techPhone: 'C1', techName: 'Available' })
})

// ===================== SCORING =====================

test('prefers same-pincode tech over a closer one with different pincode', async () => {
  __setMockTechs({
    '1111111111': { name: 'SamePin',   pincode: '500081', lat: 18.0000, lng: 79.0000 }, // ~120 km → excluded by 5km
    '2222222222': { name: 'CloseDiff', pincode: '500032', lat: 17.3900, lng: 78.4900 }, // ~0.5 km → eligible
  })
  const result = await autoAssignNearestTech('order2', CUST_LAT, CUST_LNG, CUST_PIN)
  // CloseDiff is within 5km, SamePin is out of range
  expect(result).toEqual({ techPhone: '2222222222', techName: 'CloseDiff' })
})

test('prefers closer tech when both share the same pincode', async () => {
  __setMockTechs({
    '9999999991': { name: 'Far',   pincode: '500081', lat: 17.4300, lng: 78.5000 }, // ~5 km, still eligible
    '9999999992': { name: 'Near',  pincode: '500081', lat: 17.3870, lng: 78.4880 }, // ~0.3 km
  })
  const result = await autoAssignNearestTech('order3', CUST_LAT, CUST_LNG, CUST_PIN)
  expect(result).toEqual({ techPhone: '9999999992', techName: 'Near' })
})

test('closer tech wins on distance scoring when pincodes match', async () => {
  __setMockTechs({
    '1111111111': { name: 'Within5', pincode: '500081', lat: 17.4300, lng: 78.5000 }, // ~5 km → score ~45
    '2222222222': { name: 'VeryClose', pincode: '500081', lat: 17.3880, lng: 78.4890 }, // ~0.4 km → score ~49.6
  })
  const result = await autoAssignNearestTech('order4', CUST_LAT, CUST_LNG, CUST_PIN)
  expect(result).toEqual({ techPhone: '2222222222', techName: 'VeryClose' })
})

test('sorts three techs correctly by score then distance within 5km', async () => {
  __setMockTechs({
    'A1': { name: 'Best',      pincode: '500081', lat: 17.3860, lng: 78.4870 }, // ~0.15 km → best
    'B1': { name: 'Mid',       pincode: '500081', lat: 18.2000, lng: 79.1000 }, // ~120 km → out of range
    'C1': { name: 'Worst',     pincode: '500032', lat: 17.3900, lng: 78.4900 }, // ~0.5 km, diff pincode → available
  })
  const result = await autoAssignNearestTech('order8', CUST_LAT, CUST_LNG, CUST_PIN)
  // A1 (same pincode + close) wins, B1 (out of range) excluded, C1 available but lower score
  expect(result).toEqual({ techPhone: 'A1', techName: 'Best' })
})

// ===================== GPS MISSING =====================

test('tech with no GPS coords can still win on pincode alone within 5km fallback', async () => {
  __setMockTechs({
    '3333333333': { name: 'NoGpsSamePin',   pincode: '500081' },
    '4444444444': { name: 'GpsDiffPin',     pincode: '500032', lat: 17.3900, lng: 78.4900 },
  })
  const result = await autoAssignNearestTech('order5', CUST_LAT, CUST_LNG, CUST_PIN)
  // Both are eligible: NoGpsSamePin has no GPS (included by fallback), GpsDiffPin within 5km
  // NoGpsSamePin wins on pincode bonus alone
  expect(result).toEqual({ techPhone: '3333333333', techName: 'NoGpsSamePin' })
})

test('falls back to pincode-only scoring when customer GPS is missing', async () => {
  __setMockTechs({
    '5555555555': { name: 'MatchedPin', pincode: '500081', lat: 17.3900, lng: 78.4900 },
    '6666666666': { name: 'DiffPin',    pincode: '500032', lat: 17.3900, lng: 78.4900 },
  })
  const result = await autoAssignNearestTech('order6', null, null, '500081')
  expect(result).toEqual({ techPhone: '5555555555', techName: 'MatchedPin' })
})

test('falls back to first tech when GPS and pincode are both missing', async () => {
  __setMockTechs({
    '7777777777': { name: 'FirstTech', pincode: '500081', lat: 17.3900, lng: 78.4900 },
    '8888888888': { name: 'SecondTech', pincode: '500032', lat: 17.3800, lng: 78.4800 },
  })
  const result = await autoAssignNearestTech('order7', null, null, '')
  expect(result).not.toBeNull()
  expect(mockUpdate).toHaveBeenCalledTimes(1)
})

test('tech at customer exact location gets max distance score', async () => {
  __setMockTechs({
    '0000000000': { name: 'SameSpot', pincode: '500081', lat: CUST_LAT, lng: CUST_LNG },
    '0000000001': { name: 'OtherPin', pincode: '500032', lat: 17.4000, lng: 78.5000 },
  })
  const result = await autoAssignNearestTech('order9', CUST_LAT, CUST_LNG, CUST_PIN)
  // SameSpot: same pincode (+100) + zero distance (+50) = 150
  // OtherPin: different pincode (0) + some distance (~2 km → ~48) = 48
  expect(result).toEqual({ techPhone: '0000000000', techName: 'SameSpot' })
})
