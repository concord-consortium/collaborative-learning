import { defineConfig } from 'cypress'
import fs from 'fs-extra';
import path from 'path';

export default defineConfig({
  video: false,
  viewportWidth: 1400,
  viewportHeight: 1000,
  projectId: '3pbqac', // OSS plan
  // projectId: '5vjgo9', // paid plan
  chromeWebSecurity: false,
  retries: {
    runMode: 2,
    openMode: 0,
  },
  env: {
    coverage: false,
  },
  defaultCommandTimeout: 60000,
  queryParams:
    '?appMode=qa&fakeClass=5&fakeUser=student:5&demoOffering=5&problem=2.1&qaGroup=5',
  teacherQueryParams:
    '?appMode=qa&fakeClass=5&fakeUser=teacher:6&demoOffering=5&problem=2.1',
  e2e: {
    // We've imported your old cypress plugins here.
    // You may want to clean this up later by importing these.

    numTestsKeptInMemory: 20,
    experimentalRunAllSpecs: true,
    setupNodeEvents(on, config) {
      const fetchConfigurationByFile = file => {
        const pathOfConfigurationFile = `config/cypress.${file}.json`;

        return (
          file && fs.readJson(path.join(__dirname, "./cypress/", pathOfConfigurationFile))
        );
      };

      require('cypress-terminal-report/src/installLogsPrinter')(on);

      const environment = config.env.testEnv || 'dev';
      // First, read environments.json.
      return fetchConfigurationByFile(environment)
          .then(envConfig => {
              return require('@cypress/code-coverage/task')(on, { ...config, ...envConfig });
          });
    },
    baseUrl: 'http://localhost:8080/',
    specPattern: 'cypress/e2e/**/*.{js,jsx,ts,tsx}',
  },
})
