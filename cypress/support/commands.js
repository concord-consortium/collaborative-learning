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
import ClueHeader from './elements/clue/cHeader';
import 'cypress-file-upload';
import 'cypress-commands';

Cypress.Commands.add("setupGroup", (students, group) => {
    const baseUrl = `${Cypress.config("baseUrl")}`;

    let qaClass = 10,
        problem = 2.3;
    let teacher = 10;

    let clueHeader = new ClueHeader

    let i=0, j=0;

    for (i=0;i<students.length;i++) {
        cy.wait(2000)
        cy.visit(baseUrl+'?appMode=qa&qaGroup='+group+'&fakeClass='+qaClass+'&fakeUser=student:'+students[i]+'&problem='+problem);
        cy.wait(3000);
    }
    //verify Group num and there are 4 students in the group
    clueHeader.getGroupName().should('contain','Group '+group);
    for (j=0; j<students.length; j++) {
        clueHeader.getGroupMembers().find('div.member').should('contain','S'+students[j])
    }
});

Cypress.Commands.add("uploadFile",(selector, filename, type="")=>{
    // programmatically upload the logo
    cy.fixture(filename,'base64').then((fileContent)=>{
        cy.get('input[type=file]').last().upload({fileContent, fileName:filename, mimeType:type}),
        {subjectType:'input'}
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

