import { defineConfig } from 'cypress';
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
  qaUnit: '/?appMode=qa&fakeClass=5&problem=1.1&unit=./demo/units/qa/content.json',
  qaUnitGroup: '/?appMode=qa&fakeClass=5&qaGroup=5&problem=1.1&unit=./demo/units/qa/content.json',
  qaUnitStudent5: '/?appMode=qa&fakeClass=5&fakeUser=student:5&qaGroup=5&problem=1.1&unit=./demo/units/qa/content.json',
  qaUnitStudent6: '/?appMode=qa&fakeClass=5&fakeUser=student:6&qaGroup=5&problem=1.1&unit=./demo/units/qa/content.json',
  qaUnitStudent7Investigation3: '/?appMode=qa&fakeClass=6&fakeUser=student:5&qaGroup=5&problem=3.1&unit=./demo/units/qa/content.json',
  qaUnitTeacher6: '/?appMode=qa&fakeClass=5&fakeUser=teacher:6&problem=1.1&unit=./demo/units/qa/content.json',
  qaUnitTeacher6Network: "/?appMode=qa&fakeClass=5&fakeUser=teacher:6&problem=1.1&unit=./demo/units/qa/content.json&network=foo",
  qaNoGroupShareUnitStudent5: "/?appMode=qa&fakeClass=5&fakeUser=student:5&qaGroup=5&problem=1.1&unit=./demo/units/qa-no-group-share/content.json",
  qaConfigSubtabsUnitStudent5: "/?appMode=qa&fakeClass=5&fakeUser=student:5&qaGroup=5&problem=1.1&unit=./demo/units/qa-config-subtabs/content.json",
  qaConfigSubtabsUnitTeacher1: "/?appMode=qa&fakeClass=5&fakeUser=teacher:1&qaGroup=5&problem=1.1&unit=./demo/units/qa-config-subtabs/content.json",
  qaNoNavPanelUnitStudent5: "/?appMode=qa&fakeClass=5&fakeUser=student:5&qaGroup=5&problem=1.1&unit=./demo/units/qa-no-nav-panel/content.json",
  qaVariablesUnitStudent5: "/?appMode=qa&fakeClass=5&fakeUser=student:5&qaGroup=5&problem=1.1&unit=./demo/units/qa-variables/content.json",
  qaShowNavPanelUnitStudent5: "/?appMode=qa&fakeClass=5&fakeUser=student:5&qaGroup=5&problem=1.1&unit=./demo/units/qa-show-nav-panel/content.json",
  qaMothPlotUnitStudent5: "/?appMode=qa&fakeClass=5&fakeUser=student:5&qaGroup=5&problem=1.1&unit=./demo/units/qa-moth-plot/content.json",
  qaNoSectionProblemTabUnitStudent5: "/?appMode=qa&fakeClass=5&fakeUser=student:5&qaGroup=5&problem=1.1&unit=./demo/units/qa-no-section-problem-tab/content.json",
  clueTestqaUnitStudent5: "/?appMode=demo&demoName=CLUE-Test&fakeClass=5&fakeUser=student:5&problem=1.1&unit=./demo/units/qa/content.json&noPersistentUI",
  clueTestqaUnitTeacher6: "/?appMode=demo&demoName=CLUE-Test&fakeClass=5&fakeUser=teacher:6&problem=1.1&unit=./demo/units/qa/content.json&noPersistentUI",
  clueTestqaConfigSubtabsUnitTeacher6: "/?appMode=demo&demoName=CLUE-Test&fakeClass=5&fakeUser=teacher:6&problem=1.1&unit=qa-config-subtabs&noPersistentUI",
  e2e: {
    // We've imported your old cypress plugins here.
    // You may want to clean this up later by importing these.

    numTestsKeptInMemory: 10,
    experimentalRunAllSpecs: true,
    experimentalMemoryManagement: true,
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
});
