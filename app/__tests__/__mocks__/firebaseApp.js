// Mock for firebase/app
const mockApp = { name: '[DEFAULT]' }
export const initializeApp = jest.fn(() => mockApp)
