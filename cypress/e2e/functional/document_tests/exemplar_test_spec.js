import SortedWork from "../../../support/elements/common/SortedWork";
import ClueCanvas from '../../../support/elements/common/cCanvas';
import DrawToolTile from '../../../support/elements/tile/DrawToolTile';
import TextToolTile from "../../../support/elements/tile/TextToolTile";

let sortWork = new SortedWork,
  clueCanvas = new ClueCanvas,
  drawToolTile = new DrawToolTile,
  textToolTile = new TextToolTile;

// The qaConfigSubtabs unit referenced here has `initiallyHideExemplars` set, and an exemplar defined in curriculum
const queryParams1 = `${Cypress.config("qaConfigSubtabsUnitStudent5")}`;

// qaMothPlot unit has an exemplar, but it is not initially hidden.
const queryParams2 = `${Cypress.config("qaMothPlotUnitStudent5")}`;

const exemplarName = "First Exemplar";
const exemplarInfo = "Ivan Idea: First Exemplar";

function beforeTest(params) {
  cy.clearQAData('all');
  cy.visit(params);
  cy.waitForLoad();
}

function addText(x, y, text) {
  drawToolTile.getDrawToolText().last().click();
  drawToolTile.getDrawTile().last()
    .trigger("mousedown", x, y)
    .trigger("mouseup", x, y);
  drawToolTile.getDrawTile().last()
    .trigger("mousedown", x, y)
    .trigger("mouseup", x, y);
  drawToolTile.getTextDrawing().get('textarea').type(text + "{enter}");
}

context('Exemplar Documents', function () {
  it('Unit with default config does not reveal exemplars or generate sticky notes', function () {
    beforeTest(queryParams2);
    cy.openTopTab('sort-work');
    sortWork.checkDocumentInGroup("No Group", exemplarName);
    sortWork.getSortWorkItemByTitle(exemplarName).parents('.list-item').should("not.have.class", "private");
    clueCanvas.getStickyNotePopup().should("not.exist");

    cy.log("Create 3 drawing tiles with 3 events and a label");
    clueCanvas.addTile("drawing");
    drawToolTile.drawRectangle(100, 50);
    drawToolTile.drawRectangle(200, 50);
    addText(300, 50, "one two three four five six seven eight nine ten");

    clueCanvas.addTile("drawing");
    drawToolTile.drawRectangle(100, 50);
    drawToolTile.drawRectangle(200, 50);
    addText(300, 50, "one two three four five six seven eight nine ten");

    clueCanvas.addTile("drawing");
    drawToolTile.drawRectangle(100, 50);
    drawToolTile.drawRectangle(200, 50);
    addText(300, 50, "one two three four five six seven eight nine ten");

    // No change, no sticky note
    sortWork.getSortWorkItemByTitle(exemplarName).parents('.list-item').should("not.have.class", "private");
    clueCanvas.getStickyNotePopup().should("not.exist");
  });

  it('Unit with exemplars hidden initially, revealed 3 drawings and 3 text tiles', function () {
    beforeTest(queryParams1);
    cy.openTopTab('sort-work');
    sortWork.checkDocumentInGroup("No Group", exemplarName);
    sortWork.getSortWorkItemByTitle(exemplarName).parents('.list-item').should("have.class", "private");
    clueCanvas.getStickyNotePopup().should("not.exist");

    cy.log("Create 2 drawing tiles with 3 events");
    clueCanvas.addTile("drawing");
    drawToolTile.drawRectangle(100, 50);
    drawToolTile.drawRectangle(200, 50);
    drawToolTile.drawRectangle(300, 50);

    clueCanvas.addTile("drawing");
    drawToolTile.drawRectangle(100, 50);
    drawToolTile.drawRectangle(200, 50);
    drawToolTile.drawRectangle(300, 50);

    cy.log("Create 2 text tiles and put 5 words in them");
    clueCanvas.addTile("text");
    textToolTile.enterText("one two three four five");

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

  it('Exemplar revealed by 2 drawings that include labels', function () {
    beforeTest(queryParams1);
    cy.openTopTab('sort-work');
    sortWork.checkDocumentInGroup("No Group", exemplarName);
    sortWork.getSortWorkItemByTitle(exemplarName).parents('.list-item').should("have.class", "private");

    cy.log("Create 2 drawing tiles with 2 events and a label");
    clueCanvas.addTile("drawing");
    drawToolTile.drawRectangle(100, 50);
    drawToolTile.drawRectangle(200, 50);
    addText(300, 50, "one two three four five");

    clueCanvas.addTile("drawing");
    drawToolTile.drawRectangle(100, 50);
    drawToolTile.drawRectangle(200, 50);

    // Still private?
    sortWork.getSortWorkItemByTitle(exemplarName).parents('.list-item').should("have.class", "private");
    addText(300, 50, "one two three four five");
    // Now the exemplar should be revealed
    sortWork.getSortWorkItemByTitle(exemplarInfo).parents('.list-item').should("not.have.class", "private");
    clueCanvas.getStickyNotePopup().should("exist").should("be.visible")
      .should("contain.text", "Nice work, you can now see a new example for this lesson")
      .should("contain.text", exemplarName);
  });
});
