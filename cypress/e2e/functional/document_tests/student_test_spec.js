import Header from '../../../support/elements/common/Header';
import ClueHeader from '../../../support/elements/common/cHeader';
import SortedWork from "../../../support/elements/common/SortedWork";


const header = new Header;
const clueHeader = new ClueHeader;
const sortWork = new SortedWork;

let student = '5',
  classroom = '5',
  group = '5';

function beforeTest(queryParams) {
  cy.clearQAData('all');
  cy.visit(queryParams);
  cy.waitForLoad();
}

context('Check header area for correctness', function () {
  it('verify header area', function () {
    beforeTest(`${Cypress.config("qaUnitStudent5")}`);

    cy.log('will verify if class name is correct');
    header.getClassName().should('contain', 'Class ' + classroom);

    cy.log('will verify if group name is present');
    clueHeader.getGroupName().should('contain', 'Group ' + group);

    cy.log('will verify group members is correct');
    clueHeader.getGroupMembers().should('contain', 'S' + student);

    cy.log('will verify student name is correct');
    header.getUserName().should('contain', 'Student ' + student);

    cy.log('will verify student network status');
    header.getNetworkStatus().should('contain', 'Online');

    cy.log('will verify teacher options are not displayed');
    header.getDashboardWorkspaceToggleButtons().should("not.exist");
    cy.get('.top-tab.tab-teacher-guide').should("not.exist");
    cy.get('.top-tab.tab-student-work').should("not.exist");
    cy.get('[data-test="solutions-button"]').should("not.exist");
  });
});

context("check public/private document access", function() {
  it("marks private documents as private and only shows public documents as accessible", function() {
    const queryParams = (`${Cypress.config("clueTestNoUnitStudent5")}`);
    beforeTest(queryParams);

    cy.openTopTab("sort-work");
    cy.get(".section-header-arrow").click({multiple: true}); // Open all sections
    cy.log("will verify if private documents are marked as private and are not accessible");
    sortWork.checkGroupDocumentVisibility("No Group", true, true);
    cy.log("will verify if user's own documents are not marked as private and are accessible");
    sortWork.checkGroupDocumentVisibility("Group 2", false, true);

    // Check the above for a view that contains compact document items
    sortWork.getShowForMenu().click();
    sortWork.getShowForInvestigationOption().click();
    cy.get(".section-header-arrow").click({multiple: true}); // Open all sections
    cy.log("will verify if private documents are marked as private and are not accessible in the compact view");
    sortWork.checkGroupDocumentVisibility("No Group", true);
    cy.log("will verify if user's own documents are not marked as private and are accessible in the compact view");
    sortWork.checkGroupDocumentVisibility("Group 2", false);
  });
});
