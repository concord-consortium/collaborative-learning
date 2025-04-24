import SortedWork from "../../../support/elements/common/SortedWork";
import ClueCanvas from '../../../support/elements/common/cCanvas';
import Canvas from '../../../support/elements/common/Canvas';
import DrawToolTile from '../../../support/elements/tile/DrawToolTile';
import TextToolTile from "../../../support/elements/tile/TextToolTile";

let sortWork = new SortedWork,
  clueCanvas = new ClueCanvas,
  canvas = new Canvas,
  drawToolTile = new DrawToolTile,
  textToolTile = new TextToolTile;

// The qaConfigSubtabs unit referenced here has `initiallyHideExemplars` set, and an exemplar defined in curriculum
const queryParams1 = `${Cypress.config("qaConfigSubtabsUnitStudent5")}`;

// qaMothPlot unit has an exemplar, but it is not initially hidden.
const queryParams2 = `${Cypress.config("qaMothPlotUnitStudent5")}`;

const exemplarName = "First Exemplar";
const exemplarInfo = "Ivan Idea: First Exemplar";

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
    sortWork.getSortWorkItemByTitle(exemplarName).parents('.list-item').should("have.class", "private");
    clueCanvas.getStickyNotePopup().should("not.exist");

    cy.log("Create 3 drawing tiles with 1 events and a label");
    clueCanvas.addTile("drawing");
    drawToolTile.drawRectangle(100, 50);
    drawToolTile.addText(300, 50, "one two three four five six seven eight nine ten");

    clueCanvas.addTile("drawing");
    drawToolTile.drawRectangle(200, 50);
    drawToolTile.addText(300, 50, "one two three four five six seven eight nine ten");

    clueCanvas.addTile("drawing");
    drawToolTile.drawRectangle(200, 50);
    drawToolTile.addText(300, 50, "one two three four five six seven eight nine ten");

    // No change, no sticky note
    sortWork.getSortWorkItemByTitle(exemplarName).parents('.list-item').should("have.class", "private");
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

  it('Unit with exemplars hidden initially, revealed after 1 drawing with three shapes and 1 text tiles', function () {
    beforeTest(queryParams1);
    cy.openTopTab('sort-work');
    sortWork.openSortWorkSection("No Group");
    sortWork.checkDocumentInGroup("No Group", exemplarName);
    sortWork.getSortWorkItemByTitle(exemplarName).parents('.list-item').should("have.class", "private");
    clueCanvas.getStickyNotePopup().should("not.exist");

    cy.log("Create 1 drawing tiles with 3 events");
    clueCanvas.addTile("drawing");
    drawToolTile.drawRectangle(100, 50);
    drawToolTile.drawRectangle(200, 50);
    drawToolTile.drawRectangle(300, 50);

    cy.log("Create 1 text tiles and put 5 words in them");
    clueCanvas.addTile("text");
    textToolTile.enterText("one two three four");

    drawToolTile.getDrawTile().eq(0).click(); // text is saved in onBlur
    // Still private?
    sortWork.getSortWorkItemByTitle(exemplarName).parents('.list-item').should("have.class", "private");
    textToolTile.enterText(" five");
    drawToolTile.getDrawTile().eq(0).click();

    // Now the exemplar should be revealed
    sortWork.getSortWorkItemByTitle(exemplarName).parents('.list-item').should("not.have.class", "private");

    clueCanvas.getStickyNotePopup().should("exist").should("be.visible")
      .should("contain.text", "Nice work, you can now see a new example for this lesson")
      .should("contain.text", exemplarName);

    cy.log("Open exemplar");
    sortWork.getFocusDocument().should('not.exist');
    clueCanvas.getStickyNoteLink().should("be.visible").click();
    sortWork.getFocusDocument().should('be.visible');
    sortWork.getFocusDocumentTitle().should("contain.text", exemplarName);
  });

  it('Unit with exemplars hidden initially, allows user to click Ideas button to make random exemplar visible', function () {
    beforeTest(queryParams2);
    cy.openTopTab('sort-work');
    sortWork.openSortWorkSection("No Group");
    sortWork.checkDocumentInGroup("No Group", exemplarName);
    sortWork.getSortWorkItemByTitle(exemplarName).parents('.list-item').should("have.class", "private");
    clueCanvas.getStickyNotePopup().should("not.exist");

    canvas.getIdeasButton().should("be.visible").click();

    // Now the exemplar should be revealed
    sortWork.getSortWorkItemByTitle(exemplarName).parents('.list-item').should("not.have.class", "private");

    clueCanvas.getStickyNotePopup().should("exist").should("be.visible")
      .should("contain.text", "Nice work, you can now see a new example for this lesson")
      .should("contain.text", exemplarName);

    canvas.getIdeasButton().should("not.exist");
  });

  it('Exemplar revealed by 1 drawings that include labels', function () {
    beforeTest(queryParams1);
    cy.openTopTab('sort-work');
    sortWork.openSortWorkSection("No Group");
    sortWork.checkDocumentInGroup("No Group", exemplarName);
    sortWork.getSortWorkItemByTitle(exemplarName).parents('.list-item').should("have.class", "private");

    cy.log("Create 1 drawing tiles with 2 events and a label");
    clueCanvas.addTile("drawing");
    drawToolTile.drawRectangle(100, 50);
    drawToolTile.drawRectangle(200, 50);

    // Still private?
    sortWork.getSortWorkItemByTitle(exemplarName).parents('.list-item').should("have.class", "private");
    drawToolTile.addText(300, 50, "one two three four five");
    // Now the exemplar should be revealed
    sortWork.getSortWorkItemByTitle(exemplarInfo).parents('.list-item').should("not.have.class", "private");
    clueCanvas.getStickyNotePopup().should("exist").should("be.visible")
      .should("contain.text", "Nice work, you can now see a new example for this lesson")
      .should("contain.text", exemplarName);
  });

  it('Exemplar and sticky note work for personal docs', function () {
    beforeTest(queryParams1);
    cy.openTopTab('sort-work');
    sortWork.openSortWorkSection("No Group");
    sortWork.checkDocumentInGroup("No Group", exemplarName);
    sortWork.getSortWorkItemByTitle(exemplarName).parents('.list-item').should("have.class", "private");

    cy.log("Create a personal document");
    canvas.createNewExtraDocumentFromFileMenu("Personal Document", "my-work");

    cy.log("Create 2 drawing tiles with 2 events and a label");
    clueCanvas.addTile("drawing");
    drawToolTile.drawRectangle(100, 50);
    drawToolTile.drawRectangle(200, 50);
    drawToolTile.addText(300, 50, "one two three four five");

    clueCanvas.addTile("drawing");
    drawToolTile.drawRectangle(100, 50);
    drawToolTile.drawRectangle(200, 50);

    // Still private?
    sortWork.getSortWorkItemByTitle(exemplarName).parents('.list-item').should("have.class", "private");
    drawToolTile.addText(300, 50, "one two three four five");
    // Now the exemplar should be revealed
    sortWork.getSortWorkItemByTitle(exemplarInfo).parents('.list-item').should("not.have.class", "private");
    clueCanvas.getStickyNotePopup().should("exist").should("be.visible")
      .should("contain.text", "Nice work, you can now see a new example for this lesson")
      .should("contain.text", exemplarName);
  });
});
