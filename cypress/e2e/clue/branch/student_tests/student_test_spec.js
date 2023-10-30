import Header from '../../../../support/elements/common/Header';
import ClueHeader from '../../../../support/elements/clue/cHeader';


const header = new Header;
const clueHeader = new ClueHeader;

let student = '5',
  classroom = '5',
  group = '5';

function beforeTest() {
  const queryParams = `${Cypress.config("queryParams")}`;
  cy.clearQAData('all');
  cy.visit(queryParams);
  cy.waitForLoad();
}

context('Check header area for correctness', function () {
  it('verify header area', function () {
    beforeTest();

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

