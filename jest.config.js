module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.js$': ['babel-jest', { configFile: './babel.config.js' }],
  },
  moduleNameMapper: {
    '^firebase/app$': '<rootDir>/app/__tests__/__mocks__/firebaseApp.js',
    '^firebase/database$': '<rootDir>/app/__tests__/__mocks__/firebaseDatabase.js',
  },
  testMatch: ['**/__tests__/**/*.test.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(firebase|@firebase)/)',
  ],
}
