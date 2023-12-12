import StarredTab from "../../../support/elements/common/StarredTab";
import TeacherDashboard from "../../../support/elements/common/TeacherDashboard";

let dashboard = new TeacherDashboard();
let starred = new StarredTab;

const queryParams = {
  teacherQueryParams: "/?appMode=demo&demoName=CLUE-Test&fakeClass=5&fakeOffering=5&problem=2.1&fakeUser=teacher:6"
};

function beforeTest(params) {
  cy.clearQAData('all');
  cy.visit(params);
  cy.waitForLoad();
  cy.wait(2000);
  dashboard.switchView("Workspace & Resources");
  cy.wait(5000);
}

context('Document Flipper', () => {
  describe('teacher document flipper', function () {

    it.skip('verify document flipper', function () {
      beforeTest(queryParams.teacherQueryParams);
      cy.log('verify document flipper under my work - starred tab');
      cy.openTopTab("my-work");
      cy.wait(1000);
      cy.openSection("my-work", "workspaces");
      cy.wait(20000);
      cy.log("-------0---------");

      starred.starMultipleCanvasItem("my-work", "workspaces");
      cy.openSection('my-work', 'starred');
      cy.wait(1000);
      starred.getFocusDocument("my-work").should("not.exist");
      cy.log("-------1---------");

      cy.log("verify single document flipper");
      starred.verifySingleDocumentFlipper("my-work");
      cy.log("-------2--------");

      cy.log("verify double document flipper");
      starred.verifyDoubleDocumentFlipper("my-work");
      cy.log("-------3--------");

      cy.log("verify thumbnail flipper");
      starred.verifyThumbnailFlipper("my-work");

      cy.log("verify scroller toggle");
      starred.verifyScrollerToggle("my-work");
      cy.log("-------4--------");

      cy.log('verify document flipper under class work - starred tab');
      cy.openTopTab("class-work");
      cy.log("-------5--------");
      cy.openSection("class-work", "workspaces");
      cy.wait(1000);
      starred.starMultipleCanvasItemClassWork("class-work", "workspaces");
      cy.openSection('class-work', 'starred');
      cy.log("-------5.3-------");

      starred.getFocusDocument("class-work").should("not.exist");
      cy.log("-------5.5-------");


      cy.log("verify single document flipper");
      starred.verifySingleDocumentFlipper("class-work");
      cy.log("-------6-------");


      cy.log("verify double document flipper");
      starred.verifyDoubleDocumentFlipper("class-work");

      cy.log("verify scroller toggle");
      starred.verifyScrollerToggle("class-work");
      cy.log("----end--------");
    });
  });
});
