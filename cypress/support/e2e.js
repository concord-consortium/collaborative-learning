// ***********************************************************
// This example support/index.js is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

import "@cypress/code-coverage/support";

// add support for dispatching native events (https://github.com/dmtrKovalenko/cypress-real-events)
import "cypress-real-events";

// Import commands.js using ES2015 syntax:
import './commands';

// Alternatively you can use CommonJS syntax:
// require('./commands'

// From the install directions: https://github.com/archfz/cypress-terminal-report
// It recommends:
//   require('cypress-terminal-report/src/installLogsCollector')();
// This is switched to an import.
import installLogsCollector from "cypress-terminal-report/src/installLogsCollector";
installLogsCollector();

Cypress.on('uncaught:exception', (err, runnable) => {
    // returning false here prevents Cypress from
    // failing the test
    return false;
});

// Hide fetch/XHR requests from command log
if (Cypress.config('hideXHRInCommandLog')) {
  const app = window.top;

  if (
    app &&
    !app.document.head.querySelector('[data-hide-command-log-request]')
  ) {
    const style = app.document.createElement('style');
    style.innerHTML =
      '.command-name-request, .command-name-xhr { display: none }';
    style.setAttribute('data-hide-command-log-request', '');

    app.document.head.appendChild(style);
  }
}
