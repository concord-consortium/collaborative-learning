import { defineConfig } from 'cypress'

export default defineConfig({
  video: false,
  viewportWidth: 1400,
  viewportHeight: 1000,
  projectId: '3pbqac',
  chromeWebSecurity: false,
  retries: {
    runMode: 2,
    openMode: 0,
  },
  env: {
    coverage: false,
  },
  queryParams:
    '?appMode=qa&fakeClass=5&fakeUser=student:5&demoOffering=5&problem=2.1&qaGroup=5',
  teacherQueryParams:
    '?appMode=qa&fakeClass=5&fakeUser=teacher:6&demoOffering=5&problem=2.1',
  e2e: {
    // We've imported your old cypress plugins here.
    // You may want to clean this up later by importing these.
    setupNodeEvents(on, config) {
      return require('./cypress/plugins/index.js')(on, config);
    },
    baseUrl: 'http://localhost:8080/',
    specPattern: 'cypress/e2e/**/*.{js,jsx,ts,tsx}',
  },
})
