import TeacherDashboard from "../../../support/elements/common/TeacherDashboard";
import ClueCanvas from "../../../support/elements/common/cCanvas";

let dashboard = new TeacherDashboard();
let clueCanvas = new ClueCanvas();

const teacherQueryParams = `${Cypress.config("qaConfigSubtabsUnitTeacher1")}`;
const studentQueryParams = `${Cypress.config("qaConfigSubtabsUnitStudent5")}`;

function beforeTest(params) {
  cy.visit(params);
  cy.waitForLoad();
  dashboard.switchView("Workspace & Resources");
  cy.wait(2000);
}

function verifySwitch(publicOrPrivate) {
  clueCanvas.getShareButton().should('be.visible');
  clueCanvas.getShareButton().should('have.class', publicOrPrivate);
}

function verifyStudentSeesAsPrivate() {
  cy.get('.tab-sort-work').click();
  cy.get('.section-header-arrow').click({multiple: true});
  cy.contains('[data-test="sort-work-list-items"]','Teacher 1:')
    .should('have.descendants', '.thumbnail-private');
}

function verifyStudentSeesAsPublic() {
  cy.get('.tab-sort-work').click();
  cy.get('.section-header-arrow').click({multiple: true});
  cy.contains('[data-test="sort-work-list-items"]','Teacher 1:')
    .should('not.have.descendants', '.thumbnail-private');
}

context('Teacher Sharing', function() {
  it('verify share functionality', function() {
    cy.log('loads teacher document as private');
    beforeTest(teacherQueryParams);
    verifySwitch('private');

    cy.log('does not allow student to access private teacher document');
    cy.visit(studentQueryParams);
    cy.waitForLoad();
    verifyStudentSeesAsPrivate();

    cy.log('allows teacher to share a document');
    cy.visit(teacherQueryParams);
    cy.waitForLoad();
    clueCanvas.shareCanvas();
    verifySwitch('public');

    cy.log('allows student to access public teacher document');
    cy.visit(studentQueryParams);
    cy.waitForLoad();
    verifyStudentSeesAsPublic();

    cy.log('allows teacher to unshare a document');
    cy.visit(teacherQueryParams);
    cy.waitForLoad();
    clueCanvas.unshareCanvas();
    verifySwitch('private');
  });
});
