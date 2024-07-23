import TeacherDashboard from "../../../support/elements/common/TeacherDashboard";
import ClueCanvas from "../../../support/elements/common/cCanvas";

let dashboard = new TeacherDashboard();
let clueCanvas = new ClueCanvas();

const teacherQueryParams = `${Cypress.config("qaConfigSubtabsUnitTeacher1")}`;
const studentQueryParams = `${Cypress.config("qaConfigSubtabsUnitStudent5")}`;

function beforeTest(params) {
  cy.clearQAData('all');
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
  cy.get('.thumbnail-private').should('exist');
}

function verifyStudentSeesAsPublic() {
  cy.get('.tab-sort-work').click();
  cy.get('.section-header-arrow').click({multiple: true});
  cy.get('.thumbnail-public').should('not.exist');
}

context('Teacher Sharing', function() {
  describe('verify share functionality', function() {
    it('loads teacher document as private', function() {
      beforeTest(teacherQueryParams);
      verifySwitch('private');
    });

    it.only('does not allow student to access private teacher document', function() {
      cy.visit(studentQueryParams);
      cy.waitForLoad();
      verifyStudentSeesAsPrivate();
    });

    it('allows teacher to share a document', function() {
      cy.visit(teacherQueryParams);
      cy.waitForLoad();
      clueCanvas.shareCanvas();
      verifySwitch('public');
    });

    it('allows student to access public teacher document', function() {
      cy.visit(studentQueryParams);
      cy.waitForLoad();
      verifyStudentSeesAsPublic();
    });

    it('allows teacher to unshare a document', function() {
      cy.visit(teacherQueryParams);
      cy.waitForLoad();
      clueCanvas.unshareCanvas();
      verifySwitch('private');
    });
  });
});
