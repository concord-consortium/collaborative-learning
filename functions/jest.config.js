// cf. https://medium.com/@leejh3224/testing-firebase-cloud-functions-with-jest-4156e65c7d29
module.exports = {
  "setupFilesAfterEnv": [
    "<rootDir>/../src/setupTests.ts"
  ],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  coveragePathIgnorePatterns: ['test/'],
  testRegex: '(\\S+)\\.(test|spec)\\.([jt]sx?)$',
  testPathIgnorePatterns: ['lib/', 'node_modules/'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testEnvironment: 'node'
}
