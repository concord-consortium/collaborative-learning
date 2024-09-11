import StarredTab from "../../../support/elements/common/StarredTab";
import TeacherDashboard from "../../../support/elements/common/TeacherDashboard";

let dashboard = new TeacherDashboard();
let starred = new StarredTab;

function beforeTest() {
  const queryParams = `${Cypress.config("clueTestqaUnitTeacher6")}`;
  cy.visit(queryParams);
  cy.waitForLoad();
  dashboard.switchView("Workspace & Resources");
}

context('Document Flipper', () => {
  describe('teacher document flipper', function () {

    it.skip('verify document flipper', function () {
      beforeTest();
      cy.log('verify document flipper under my work - starred tab');
      cy.openTopTab("my-work");
      cy.wait(1000);
      cy.openSection("my-work", "workspaces");
      cy.wait(20000);

      starred.starMultipleCanvasItem("my-work", "workspaces");
      cy.openSection('my-work', 'starred');
      starred.getFocusDocument("my-work").should("not.exist");

      cy.log("verify single document flipper");
      starred.verifySingleDocumentFlipper("my-work");

      cy.log("verify double document flipper");
      starred.verifyDoubleDocumentFlipper("my-work");

      cy.log("verify thumbnail flipper");
      starred.verifyThumbnailFlipper("my-work");

      cy.log("verify scroller toggle");
      starred.verifyScrollerToggle("my-work");

      cy.log('verify document flipper under class work - starred tab');
      cy.openTopTab("class-work");
      cy.openSection("class-work", "workspaces");
      starred.starMultipleCanvasItemClassWork("class-work", "workspaces");
      cy.openSection('class-work', 'starred');

      starred.getFocusDocument("class-work").should("not.exist");

      cy.log("verify single document flipper");
      starred.verifySingleDocumentFlipper("class-work");

      cy.log("verify double document flipper");
      starred.verifyDoubleDocumentFlipper("class-work");

      cy.log("verify scroller toggle");
      starred.verifyScrollerToggle("class-work");
    });
  });
});
