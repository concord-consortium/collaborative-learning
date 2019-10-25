// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add("login", (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add("drag", { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add("dismiss", { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This is will overwrite an existing command --
// Cypress.Commands.overwrite("visit", (originalFn, url, options) => { ... })
import 'cypress-file-upload';
import 'cypress-commands';

Cypress.Commands.add("waitForSpinner", () => {
    cy.get('.progress', { timeout: 60000 }).should('not.exist')
})

Cypress.Commands.add("waitForGraphSpinner", () => {
    cy.get('.graph-loading', { timeout: 60000 }).should('not.exist')
})

Cypress.Commands.add("uploadFile",(selector, filename, type="")=>{
    // cy.fixture(filename).as("image");

    return cy.get(selector).then(subject => {
        return cy.fixture(filename,'base64')
            .then(Cypress.Blob.base64StringToBlob)
        // From Cypress document: https://docs.cypress.io/api/utilities/blob.html#Examples
        // return Cypress.Blob.base64StringToBlob(cy.fixture(filename), "image/png")
            .then((blob) => {
            const el = subject[0]
            const nameSegments = filename.split('/')
            const name = nameSegments[nameSegments.length - 1]
            const testFile = new File([blob], name, { type });
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(testFile);
            el.files = dataTransfer.files;
            return subject;
        })
    })
})
Cypress.Commands.add("clearQAData", (data)=>{ //clears data from Firebase (currently data='all' is the only one supported)
    const baseUrl = `${Cypress.config("baseUrl")}`;
    if (data=='all') {
        cy.visit(baseUrl + '?appMode=qa&qaClear=' + data + '&fakeClass=1&fakeUser=student:1');
        cy.wait(3000);
        cy.get('span').should('contain','QA Cleared: OK');
    }
})
