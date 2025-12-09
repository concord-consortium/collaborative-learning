import { defineConfig } from 'cypress';
import fs from 'fs-extra';
import path from 'path';
import installLogsPrinter from 'cypress-terminal-report/src/installLogsPrinter';
import codeCoverageTask from '@cypress/code-coverage/task';

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
  defaultCommandTimeout: 30000,
  qaUnit: '/?appMode=qa&fakeClass=5&problem=1.1&unit=./demo/units/qa/content.json',
  qaUnitGroup: '/?appMode=qa&fakeClass=5&qaGroup=5&problem=1.1&unit=./demo/units/qa/content.json',
  qaUnitStudent5: '/?appMode=qa&fakeClass=5&fakeUser=student:5&qaGroup=5&problem=1.1&unit=./demo/units/qa/content.json',
  qaUnitStudent6: '/?appMode=qa&fakeClass=5&fakeUser=student:6&qaGroup=5&problem=1.1&unit=./demo/units/qa/content.json',
  qaUnitStudent7Investigation3: '/?appMode=qa&fakeClass=6&fakeUser=student:7&qaGroup=5&problem=3.1&unit=./demo/units/qa/content.json',
  qaUnitTeacher6: '/?appMode=qa&fakeClass=5&fakeUser=teacher:6&problem=1.1&unit=./demo/units/qa/content.json',
  qaUnitTeacher6Network: "/?appMode=qa&fakeClass=5&fakeUser=teacher:6&problem=1.1&unit=./demo/units/qa/content.json&network=foo",
  qaNoGroupShareUnitStudent5: "/?appMode=qa&fakeClass=5&fakeUser=student:5&qaGroup=5&problem=1.1&unit=./demo/units/qa-no-group-share/content.json",
  qaConfigSubtabsUnitStudent5: "/?appMode=qa&fakeClass=5&fakeUser=student:5&qaGroup=5&problem=1.1&unit=./demo/units/qa-config-subtabs/content.json",
  qaConfigSubtabsUnitTeacher1: "/?appMode=qa&fakeClass=5&fakeUser=teacher:1&problem=1.1&unit=./demo/units/qa-config-subtabs/content.json",
  qaNoNavPanelUnitStudent5: "/?appMode=qa&fakeClass=5&fakeUser=student:5&qaGroup=5&problem=1.1&unit=./demo/units/qa-no-nav-panel/content.json",
  qaVariablesUnitStudent5: "/?appMode=qa&fakeClass=5&fakeUser=student:5&qaGroup=5&problem=1.1&unit=./demo/units/qa-variables/content.json",
  qaShowNavPanelUnitStudent5: "/?appMode=qa&fakeClass=5&fakeUser=student:5&qaGroup=5&problem=1.1&unit=./demo/units/qa-show-nav-panel/content.json",
  qaMothPlotUnitStudent5: "/?appMode=qa&fakeClass=5&fakeUser=student:5&qaGroup=5&problem=1.1&unit=./demo/units/qa-moth-plot/content.json",
  qaNoSectionProblemTabUnitStudent5: "/?appMode=qa&fakeClass=5&fakeUser=student:5&qaGroup=5&problem=1.1&unit=./demo/units/qa-no-section-problem-tab/content.json",
  clueTestqaUnitStudent5: "/?appMode=demo&demoName=CLUE-Test&fakeClass=5&fakeUser=student:5&problem=1.1&unit=./demo/units/qa/content.json&noPersistentUI",
  clueTestNoUnitStudent5: "/?appMode=demo&demoName=CLUE-Test&fakeClass=5&fakeUser=student:5&problem=1.1&noPersistentUI",
  clueTestqaUnitTeacher6: "/?appMode=demo&demoName=CLUE-Test&fakeClass=5&fakeUser=teacher:6&problem=1.1&unit=./demo/units/qa/content.json&noPersistentUI",
  clueTestqaConfigSubtabsUnitTeacher6: "/?appMode=demo&demoName=CLUE-Test&fakeClass=5&fakeUser=teacher:6&problem=1.1&unit=qa-config-subtabs&noPersistentUI",
  e2e: {
    // We've imported your old cypress plugins here.
    // You may want to clean this up later by importing these.

    numTestsKeptInMemory: 10,
    experimentalRunAllSpecs: true,
    experimentalMemoryManagement: true,
    async setupNodeEvents(on, config) {
      console.log("Cypress config", {baseUrl: config.baseUrl, testEnv: config.env.testEnv});

      // Print out cypress log to the command line so it is recorded by the CI system
      installLogsPrinter(on);

      function getEnvConfig() {
        const testEnv = config.env.testEnv;
        if (testEnv) {
          const pathOfConfigurationFile = `config/cypress.${testEnv}.json`;
          return fs.readJson(path.join(__dirname, "./cypress/", pathOfConfigurationFile));
        } else {
          return {};
        }
      }
      const envConfig = await getEnvConfig();
      const combinedConfig = { ...config, ...envConfig };

      // Save the code coverage information after each test.
      // This also modifies the combinedConfig so the modified config needs to be returned
      codeCoverageTask(on, combinedConfig);

      return combinedConfig;
    },
    baseUrl: 'http://localhost:8080/',
    specPattern: 'cypress/e2e/**/*.{js,jsx,ts,tsx}',
  },
});
