import SortedWork from "../../../support/elements/common/SortedWork";
import ClueCanvas from '../../../support/elements/common/cCanvas';
import Canvas from '../../../support/elements/common/Canvas';
import DrawToolTile from '../../../support/elements/tile/DrawToolTile';
import TextToolTile from "../../../support/elements/tile/TextToolTile";
import ResourcesPanel from "../../../support/elements/common/ResourcesPanel";
import ChatPanel from "../../../support/elements/common/ChatPanel";

let sortWork = new SortedWork,
  clueCanvas = new ClueCanvas,
  canvas = new Canvas,
  drawToolTile = new DrawToolTile,
  textToolTile = new TextToolTile,
  resourcesPanel = new ResourcesPanel,
  chatPanel = new ChatPanel;

// The qaConfigSubtabs unit referenced here has `initiallyHideExemplars` set, and an exemplar defined in curriculum
const queryParams1 = `${Cypress.config("qaConfigSubtabsUnitStudent5")}&firebaseEnv=staging`;

// qaMothPlot unit has an exemplar, but it is not initially hidden.
const queryParams2 = `${Cypress.config("qaMothPlotUnitStudent5")}`;

const exemplarName = "First Exemplar";
const exemplarInfo = "Ivan Idea: First Exemplar";
const studentDocumentName = "1.1 Unit Toolbar Configuration";
const aiEvaluationMessage = "Ada is evaluating...";

function beforeTest(params) {
  cy.visit(params);
  cy.waitForLoad();
}

context('Exemplar Documents', function () {
  it('Unit with default config does not reveal exemplars or generate sticky notes', function () {
    beforeTest(queryParams2);
    cy.openTopTab('sort-work');
    sortWork.openSortWorkSection("No Group");
    sortWork.checkDocumentInGroup("No Group", exemplarName);
    sortWork.getSortWorkItemByTitle(exemplarName).parents('.list-item').should("not.have.class", "private");
    clueCanvas.getStickyNotePopup().should("not.exist");

    cy.log("Create 3 drawing tiles with 1 event and a label");
    clueCanvas.addTile("drawing");
    drawToolTile.drawRectangle(100, 50);
    drawToolTile.addText(300, 50, "one two three four five six seven eight nine ten");

    clueCanvas.addTile("drawing");
    drawToolTile.drawRectangle(200, 50);
    drawToolTile.addText(300, 50, "one two three four five six seven eight nine ten");

    clueCanvas.addTile("drawing");
    drawToolTile.drawRectangle(200, 50);
    drawToolTile.addText(300, 50, "one two three four five six seven eight nine ten");

    // No change, no comments, no sticky note
    chatPanel.getChatPanel().should("not.exist");
    sortWork.getSortWorkItemByTitle(exemplarName).parents('.list-item').should("not.have.class", "private");
    clueCanvas.getStickyNotePopup().should("not.exist");
  });

  it('Exemplars show up in the correct place in the sort work view', function () {
    beforeTest(queryParams2);
    cy.openTopTab('sort-work');

    // With no secondary sort, the full exemplar tile should show up in the right sections.
    sortWork.openSortWorkSection("No Group");
    sortWork.checkDocumentInGroup("No Group", exemplarName);

    sortWork.getPrimarySortByMenu().click();
    sortWork.getPrimarySortByNameOption().click();
    sortWork.openSortWorkSection("Idea, Ivan");
    sortWork.checkDocumentInGroup("Idea, Ivan", exemplarName);

    sortWork.getPrimarySortByMenu().click();
    sortWork.getPrimarySortByTagOption().click();
    sortWork.openSortWorkSection("Varies Material/Surface");
    sortWork.checkDocumentInGroup("Varies Material/Surface", exemplarName);

    sortWork.getPrimarySortByMenu().click();
    sortWork.getPrimarySortByBookmarkedOption().click();
    sortWork.openSortWorkSection("Not Bookmarked");
    sortWork.checkDocumentInGroup("Not Bookmarked", exemplarName);

    sortWork.getPrimarySortByMenu().click();
    sortWork.getPrimarySortByToolsOption().click();
    sortWork.openSortWorkSection("Text");
    sortWork.checkDocumentInGroup("Text", exemplarName);

    // With a secondary sort, "simple documents" (little boxes) should show up for exemplars.

    sortWork.getSecondarySortByMenu().click();
    sortWork.getSecondarySortByNameOption().click();
    sortWork.checkSimpleDocumentInSubgroup("Text", "Idea, Ivan", exemplarInfo);
  });

  it('Unit with exemplars hidden initially, revealed after 1 drawing with three shapes and 1 text tile', function () {
    beforeTest(queryParams1);
    cy.openTopTab('sort-work');
    sortWork.openSortWorkSection("No Group");
    sortWork.checkDocumentInGroup("No Group", exemplarName);
    sortWork.getSortWorkItemByTitle(exemplarName).parents('.list-item').should("have.class", "private");
    clueCanvas.getStickyNotePopup().should("not.exist");

    cy.log("Create 1 drawing tile with 3 events");
    clueCanvas.addTile("drawing");
    drawToolTile.drawRectangle(100, 50);
    drawToolTile.drawRectangle(200, 50);
    drawToolTile.drawRectangle(300, 50);

    cy.log("Create 1 text tile and put 5 words in it");
    clueCanvas.addTile("text");
    textToolTile.enterText("one two three four");
    textToolTile.getTextTile().eq(0).blur(); // text is saved in onBlur

    // Still private?
    sortWork.getSortWorkItemByTitle(exemplarName).parents('.list-item').should("have.class", "private");
    textToolTile.enterText(" five");
    textToolTile.getTextTile().eq(0).blur();

    // Now the exemplar should be revealed
    sortWork.getSortWorkItemByTitle(exemplarName).parents('.list-item').should("not.have.class", "private");
    resourcesPanel.getPrimaryWorkspaceTab("my-work").should("be.visible").and("have.attr", "aria-selected", "true");
    // resourcesPanel.getSecondaryWorkspaceTab("workspaces").should("be.visible").and("have.attr", "aria-selected", "true");
    resourcesPanel.getPrimaryFocusDocumentTitle().should("contain.text", "1.1 Unit Toolbar Configuration");

    // Wait for the code to open the chat and select the whole document comments section
    chatPanel.getChatPanel().should('be.visible').should('contain.text', 'Comments');
    chatPanel.getChatThread().eq(0).should("have.class", "chat-thread-focused");
    chatPanel.getUsernameFromCommentHeader().should("be.visible").and("contain.text", "Ivan Idea");
    chatPanel.getCommentCardContent().should("be.visible")
      .and("contain.text", "See if this example gives you any new ideas:")
      .and("contain.text", exemplarName);

    cy.log("Open exemplar");
    sortWork.getFocusDocument().should('not.exist');
    chatPanel.getCommentCardLink().should("be.visible").click();
    sortWork.getFocusDocument().should('be.visible');
    sortWork.getFocusDocumentTitle().should("contain.text", exemplarName);
  });

  it('Unit with exemplars hidden initially, allows user to click Ideas button to make random exemplar visible', function () {
    beforeTest(queryParams1);
    cy.openTopTab('sort-work');
    sortWork.openSortWorkSection("No Group");
    sortWork.checkDocumentInGroup("No Group", exemplarName);
    sortWork.getSortWorkItemByTitle(exemplarName).parents('.list-item').should("have.class", "private");
    clueCanvas.getStickyNotePopup().should("not.exist");

    canvas.getIdeasButton().should("be.visible").click();

    // Now the exemplar should no longer be private
    sortWork.getSortWorkItemByTitle(exemplarName).parents('.list-item').should("not.have.class", "private");
    // But the left side should be changed to show the user's document and the comments pane
    sortWork.getSortWorkItemByTitle(exemplarName).parents('.list-item').should("not.be.visible");
    resourcesPanel.getPrimaryWorkspaceTab("my-work").should("have.class", "selected");
    resourcesPanel.getFocusDocument().should("be.visible");
    resourcesPanel.getFocusDocumentTitle().should("contain.text", studentDocumentName);

    // Wait for the code to open the chat and select the whole document comments section
    chatPanel.getChatPanel().should('be.visible').should('contain.text', 'Comments');
    chatPanel.getChatThread().eq(0).should("have.class", "chat-thread-focused");
    chatPanel.getUsernameFromCommentHeader().should("be.visible").and("contain.text", "Ivan Idea");
    chatPanel.getCommentCardContent().should("be.visible")
      .and("contain.text", "See if this example gives you any new ideas:")
      .and("contain.text", exemplarName);

    // No AI evaluation in this unit
    chatPanel.getChatPanel().should('not.contain.text', aiEvaluationMessage);

    // There's only 1 exemplar, so the ideas button should be gone
    canvas.getIdeasButton().should("not.exist");
  });

  it('Exemplar revealed by 1 drawing that includes a label', function () {
    beforeTest(queryParams1);
    cy.openTopTab('sort-work');
    sortWork.openSortWorkSection("No Group");
    sortWork.checkDocumentInGroup("No Group", exemplarName);
    sortWork.getSortWorkItemByTitle(exemplarName).parents('.list-item').should("have.class", "private");

    cy.log("Create 1 drawing tile with 3 events and a label");
    clueCanvas.addTile("drawing");
    drawToolTile.drawRectangle(100, 50);
    drawToolTile.drawRectangle(200, 50);
    drawToolTile.drawRectangle(300, 50);

    // Still private?
    sortWork.getSortWorkItemByTitle(exemplarName).parents('.list-item').should("have.class", "private");
    drawToolTile.addText(300, 50, "one two three four five");
    // Now the exemplar should be revealed
    sortWork.getSortWorkItemByTitle(exemplarInfo).parents('.list-item').should("not.have.class", "private");

    chatPanel.getChatPanel().should('be.visible').should('contain.text', 'Comments');
    chatPanel.getChatThread().eq(0).should("have.class", "chat-thread-focused");
    chatPanel.getUsernameFromCommentHeader().should("be.visible").and("contain.text", "Ivan Idea");
    chatPanel.getCommentCardContent().should("be.visible")
      .and("contain.text", "See if this example gives you any new ideas:")
      .and("contain.text", exemplarName);
  });

  it('Exemplar and sticky note work for personal docs', function () {
    beforeTest(queryParams1);
    cy.openTopTab('sort-work');
    sortWork.openSortWorkSection("No Group");
    sortWork.checkDocumentInGroup("No Group", exemplarName);
    sortWork.getSortWorkItemByTitle(exemplarName).parents('.list-item').should("have.class", "private");

    cy.log("Create a personal document");
    canvas.createNewExtraDocumentFromFileMenu("Personal Document", "my-work");

    cy.log("Create 1 drawing tile with 2 events and no label");
    clueCanvas.addTile("drawing");
    drawToolTile.drawRectangle(100, 50);
    drawToolTile.drawRectangle(200, 50);

    // Still private?
    sortWork.getSortWorkItemByTitle(exemplarName).parents('.list-item').should("have.class", "private");
    cy.log("Add a label");
    drawToolTile.addText(300, 50, "one two three four five");
    // Now the exemplar should be revealed
    sortWork.getSortWorkItemByTitle(exemplarInfo).parents('.list-item').should("not.have.class", "private");

    chatPanel.getChatPanel().should('be.visible').should('contain.text', 'Comments');
    chatPanel.getChatThread().eq(0).should("have.class", "chat-thread-focused");
    chatPanel.getUsernameFromCommentHeader().should("be.visible").and("contain.text", "Ivan Idea");
    chatPanel.getCommentCardContent().should("be.visible")
      .and("contain.text", "See if this example gives you any new ideas:")
      .and("contain.text", exemplarName);

  });
});
