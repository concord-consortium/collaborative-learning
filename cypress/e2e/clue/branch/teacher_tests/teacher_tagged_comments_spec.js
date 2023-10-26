import ChatPanel from "../../../../support/elements/clue/ChatPanel";

let chatPanel = new ChatPanel;

const queryParams = {
  teacherQueryParams: "/?appMode=qa&fakeClass=5&fakeOffering=5&problem=2.1&fakeUser=teacher:7&unit=msa",
  teacher7NetworkQueryParams: "/?appMode=qa&fakeClass=5&fakeOffering=5&problem=2.1&fakeUser=teacher:7&unit=msa&network=foo",
  teacher8NetworkQueryParams: "/?appMode=qa&fakeClass=5&fakeOffering=5&problem=2.1&fakeUser=teacher:8&unit=msa&network=foo"
};

function beforeTest(params) {
  cy.clearQAData('all');
  cy.visit(params);
  cy.waitForLoad();
  cy.openTopTab("problems");
  chatPanel.getChatPanelToggle().should('exist');
}

context('Chat Panel', () => {
  it("Teachers can communicate back and forth in chat panel", () => {
    cy.log("verify teacher7 can post document and tile comments");
    beforeTest(queryParams.teacher7NetworkQueryParams);
    // Teacher 7 document comment
    cy.openTopTab("problems");
    cy.openProblemSection("Introduction");
    chatPanel.getChatPanelToggle().click();
    chatPanel.verifyProblemCommentClass();
    cy.wait(2000);
    chatPanel.addCommentAndVerify("This is a teacher7 document comment");
    // Teacher 7 tile comment
    cy.clickProblemResourceTile('introduction');
    cy.wait(2000);
    chatPanel.addCommentAndVerify("This is a teacher7 tile comment");

    cy.log("verify teacher8 can open clue chat in the same network");
    // Open clue chat for Teacher 8
    beforeTest(queryParams.teacher8NetworkQueryParams);
    chatPanel.getChatPanelToggle().click();

    cy.log("verify teacher8 can view teacher7's comments and add more comments");
    // Teacher 8 document comment
    chatPanel.verifyProblemCommentClass();
    chatPanel.verifyCommentThreadContains("This is a teacher7 document comment");
    chatPanel.addCommentAndVerify("This is a teacher8 document comment");
    // Teacher 8 tile comment
    cy.clickProblemResourceTile('introduction');
    cy.wait(2000);
    chatPanel.verifyCommentThreadContains("This is a teacher7 tile comment");
    chatPanel.addCommentAndVerify("This is a teacher8 tile comment");

    cy.log("verify reopening teacher7's clue chat in the same network");
    // Open clue chat for Teacher 7
    beforeTest(queryParams.teacher7NetworkQueryParams);
    chatPanel.getChatPanelToggle().click();

    cy.log("verify teacher7 can view teacher8's comments");
    // Teacher 7 document comment
    chatPanel.verifyProblemCommentClass();
    chatPanel.verifyCommentThreadContains("This is a teacher8 document comment");
    // Teacher 7 tile comment
    cy.clickProblemResourceTile('introduction');
    cy.wait(2000);
    chatPanel.verifyCommentThreadContains("This is a teacher8 tile comment");
  });
});

context('Chat Panel Comment Tags', () => {
  it('verify chat panel comment tags', () => {
    const tags = [
      "Select Student Strategy",
      "Part-to-Part",
      "Part-to-Whole",
      "Unit Rate",
      "Ratios of Same Variable",
      "Common Part or Whole",
      "Building Up",
      "Other - Proportional",
      "Other - Nonproportional"
    ];
    const tagComment = [
      "This is Part-to-Part tag comment" + Math.random(),
      "This is Part-to-Whole tag comment" + Math.random(),
      "This is Unit Rate tag comment" + Math.random(),
      "This is Ratios of Same Variable tag comment" + Math.random(),
      "This is Common Part or Whole tag comment" + Math.random(),
      "This is Building Up tag comment" + Math.random(),
      "This is Other - Proportional tag comment" + Math.random(),
      "This is Other - Nonproportional tag comment" + Math.random()
    ];
    cy.log('verify chat panel comment tags are accessible if teacher is in network (via url params)');
    beforeTest(queryParams.teacher7NetworkQueryParams);

    cy.log('verify comment tag dropdown');
    chatPanel.getChatPanelToggle().click();
    chatPanel.getChatPanel().should('exist');
    chatPanel.getCommentTextDropDown().should('exist');

    cy.log('verify comment tag dropdown options');
    chatPanel.getCommentTextDropDown()
      .should("contain", tags[0])
      .should("contain", tags[1])
      .should("contain", tags[2])
      .should("contain", tags[3])
      .should("contain", tags[4])
      .should("contain", tags[5])
      .should("contain", tags[6])
      .should("contain", tags[7])
      .should("contain", tags[8]);

    cy.log('verify user post only comment tags on document comment');
    cy.openTopTab("problems");
    chatPanel.verifyProblemCommentClass();
    chatPanel.addCommentTagAndVerify(tags[1]);
    chatPanel.deleteCommentTagThread(tags[1]);

    cy.log('verify user post only comment tags on tile comment');
    cy.clickProblemResourceTile('introduction');
    chatPanel.showAndVerifyTileCommentClass(0);
    chatPanel.addCommentTagAndVerify(tags[2]);
    chatPanel.deleteCommentTagThread(tags[2]);

    cy.log('verify user post both comment tags and plain text on document comment');
    cy.openTopTab("problems");
    cy.openProblemSection("Introduction");
    chatPanel.verifyProblemCommentClass();
    chatPanel.addCommentTagTextAndVerify(tags[3], tagComment[2]);
    chatPanel.deleteCommentTagThread(tags[3]);

    cy.log('verify user post both comment tags and plain text on tile comment');
    cy.openTopTab("problems");
    cy.clickProblemResourceTile('introduction');
    chatPanel.showAndVerifyTileCommentClass(0);
    chatPanel.addCommentTagTextAndVerify(tags[5], tagComment[4]);
    chatPanel.deleteCommentTagThread(tags[5]);

    cy.log('verify user post only plain text and comment tag not displayed on document comment');
    const docComment = "Only plain text and no comment tag document comment";
    cy.openTopTab("problems");
    cy.openProblemSection("Introduction");
    chatPanel.verifyProblemCommentClass();
    chatPanel.addCommentAndVerify(docComment);
    chatPanel.verifyCommentTagNotDisplayed(docComment);
    chatPanel.getDeleteMessageButton(docComment).click({ force: true });
    chatPanel.getDeleteConfirmModalButton().contains("Delete").click();
    cy.wait(2000);
    chatPanel.verifyCommentThreadDoesNotContain(docComment);

    cy.log('verify user post only plain text and comment tag not displayed on tile comment');
    const tileComment = "Only plain text and no comment tag tile comment";
    cy.openTopTab("problems");
    cy.clickProblemResourceTile('introduction');
    chatPanel.showAndVerifyTileCommentClass(0);
    chatPanel.addCommentAndVerify(tileComment);
    chatPanel.verifyCommentTagNotDisplayed(tileComment);
    chatPanel.getDeleteMessageButton(tileComment).click({ force: true });
    chatPanel.getDeleteConfirmModalButton().contains("Delete").click();
    cy.wait(2000);
    chatPanel.verifyCommentThreadDoesNotContain(tileComment);
  });
});
