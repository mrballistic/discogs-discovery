module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@lionralfs/discogs-client$': '<rootDir>/node_modules/@lionralfs/discogs-client/commonjs/index.js'
  },
  transform: {
    '^.+\\.(t|j)sx?$': 'babel-jest',
  },
};
