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

// Import commands.js using ES2015 syntax:
import './commands'
require('cypress-commands');

// Alternatively you can use CommonJS syntax:
// require('./commands')

const baseUrl = `${Cypress.config("baseUrl")}`;
const queryParams = `${Cypress.config("queryParams")}`;

before(function(){
    cy.clearQAData('all');
    cy.visit(baseUrl+queryParams);
    cy.wait(2000);
});

Cypress.on('uncaught:exception', (err, runnable) => {
    // returning false here prevents Cypress from
    // failing the test
    return false
});

after(function(){
  cy.clearQAData('all');
});
