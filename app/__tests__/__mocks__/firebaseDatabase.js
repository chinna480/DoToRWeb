// Mock for firebase/database
// We use a shared mutable state so tests can inject mock tech data.

let mockTechData = null // { [phone]: { name, pincode, lat, lng, ... } }
let mockUpdateFn = null // will be set by test for assertion

export function __setMockTechs(techs) {
  mockTechData = techs
}

export function __clearMockTechs() {
  mockTechData = null
}

export const mockUpdate = jest.fn(() => Promise.resolve())

const refMap = new Map()
let refCounter = 0

export function getDatabase() {
  return { name: 'mockDb' }
}

export function ref(_db, path) {
  const id = ++refCounter
  refMap.set(id, path)
  return { key: id, path }
}

export function get(refObj) {
  if (mockTechData === null || Object.keys(mockTechData).length === 0) {
    return Promise.resolve({
      exists: () => false,
      forEach: () => {},
      val: () => null,
    })
  }
  const snapshot = {
    exists: () => true,
    val: () => ({ ...mockTechData }),
    forEach: (callback) => {
      Object.entries(mockTechData).forEach(([phone, data]) => {
        callback({
          key: phone,
          val: () => ({ ...data }),
        })
      })
    },
  }
  return Promise.resolve(snapshot)
}

export function update(...args) {
  // Forward to the global mock so it can be asserted on
  return mockUpdate(...args)
}
