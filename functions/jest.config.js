// cf. https://medium.com/@leejh3224/testing-firebase-cloud-functions-with-jest-4156e65c7d29
module.exports = {
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  testRegex: '(\\S+)\\.(test|spec)\\.([jt]sx?)$',
  testPathIgnorePatterns: ['lib/', 'node_modules/'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testEnvironment: 'node',
  rootDir: 'test'
}
