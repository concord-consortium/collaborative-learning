import StarredTab from "../../../support/elements/common/StarredTab";

let starred = new StarredTab;

const queryParams = {
  teacherQueryParams: "/?appMode=demo&demoName=CLUE-Test&fakeClass=5&fakeOffering=5&problem=2.1&fakeUser=teacher:6"
};

function beforeTest(params) {
  cy.clearQAData('all');
  cy.visit(params);
  cy.waitForLoad();
}

context('Document Flipper', () => {
  describe('teacher document flipper', function () {
   
    it('verify document flipper', function () {
      beforeTest(queryParams.teacherQueryParams);
      cy.log('verify document flipper under my work - starred tab');
      cy.openTopTab("my-work"); 
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