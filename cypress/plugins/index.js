const fs = require("fs-extra");
const path = require("path");

const fetchConfigurationByFile = file => {
  const pathOfConfigurationFile = `config/cypress.${file}.json`;

  return (
    file && fs.readJson(path.join(__dirname, "../", pathOfConfigurationFile))
  );
};

module.exports = (on, config) => {
    require('cypress-terminal-report/src/installLogsPrinter')(on);

    const environment = config.env.testEnv || "dev";
    const configurationForEnvironment = fetchConfigurationByFile(environment);

    return configurationForEnvironment || config
        .then(envConfig => {
            return require('@cypress/code-coverage/task')(on, { ...config, ...envConfig });
        });
}
