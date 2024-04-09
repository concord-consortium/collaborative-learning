import SortedWork from "../../../support/elements/common/SortedWork";
import ClueCanvas from '../../../support/elements/common/cCanvas';
import DrawToolTile from '../../../support/elements/tile/DrawToolTile';
import TextToolTile from "../../../support/elements/tile/TextToolTile";

let sortWork = new SortedWork,
  clueCanvas = new ClueCanvas,
  drawToolTile = new DrawToolTile,
  textToolTile = new TextToolTile;

// This unit has `initiallyHideExemplars` set, and an exemplar defined in curriculum
const queryParams1 = `${Cypress.config("qaConfigSubtabsUnitStudent5")}`;
const exemplarName = "Ivan Idea: First Exemplar";

function beforeTest(params) {
  cy.clearQAData('all');
  cy.visit(params);
  cy.waitForLoad();
}

function drawSmallRectangle(x, y) {
  drawToolTile.getDrawToolRectangle().last().click();
  drawToolTile.getDrawTile().last()
  .trigger("mousedown", x, y)
  .trigger("mousemove", x+25, y+25)
  .trigger("mouseup", x+25, y+25);
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
  it('Unit with exemplars hidden initially, revealed 3 drawings and 3 text tiles', function () {
    beforeTest(queryParams1);
    cy.openTopTab('sort-work');
    sortWork.checkDocumentInGroup("No Group", exemplarName);
    sortWork.getSortWorkItemByTitle(exemplarName).parents('.list-item').should("have.class", "private");

    cy.log("Create 3 drawing tiles with 3 events");
    clueCanvas.addTile("drawing");
    drawSmallRectangle(100, 50);
    drawSmallRectangle(200, 50);
    drawSmallRectangle(300, 50);

    clueCanvas.addTile("drawing");
    drawSmallRectangle(100, 50);
    drawSmallRectangle(200, 50);
    drawSmallRectangle(300, 50);

    clueCanvas.addTile("drawing");
    drawSmallRectangle(100, 50);
    drawSmallRectangle(200, 50);
    drawSmallRectangle(300, 50);

    cy.log("Create 3 text tiles and put 10 words in them");
    clueCanvas.addTile("text");
    textToolTile.enterText("one two three four five six seven eight nine ten");

    clueCanvas.addTile("text");
    textToolTile.enterText("one two three four five six seven eight nine ten");

    clueCanvas.addTile("text");
    textToolTile.enterText("one two three four five six seven eight nine");
    drawToolTile.getDrawTile().eq(0).click(); // text is saved in onBlur
    // Still private?
    sortWork.getSortWorkItemByTitle(exemplarName).parents('.list-item').should("have.class", "private");
    textToolTile.enterText(" ten");
    drawToolTile.getDrawTile().eq(0).click();

    // Now the exemplar should be revealed
    sortWork.getSortWorkItemByTitle(exemplarName).parents('.list-item').should("not.have.class", "private");
  });

  it.only('Exemplar revealed by 3 drawings that include labels', function () {
    beforeTest(queryParams1);
    cy.openTopTab('sort-work');
    sortWork.checkDocumentInGroup("No Group", exemplarName);
    sortWork.getSortWorkItemByTitle(exemplarName).parents('.list-item').should("have.class", "private");

    cy.log("Create 3 drawing tiles with 3 events and a label");
    clueCanvas.addTile("drawing");
    drawSmallRectangle(100, 50);
    drawSmallRectangle(200, 50);
    addText(300, 50, "one two three four five six seven eight nine ten");

    clueCanvas.addTile("drawing");
    drawSmallRectangle(100, 50);
    drawSmallRectangle(200, 50);
    addText(300, 50, "one two three four five six seven eight nine ten");

    clueCanvas.addTile("drawing");
    drawSmallRectangle(100, 50);
    drawSmallRectangle(200, 50);

    // Still private?
    sortWork.getSortWorkItemByTitle(exemplarName).parents('.list-item').should("have.class", "private");
    addText(300, 50, "one two three four five six seven eight nine ten");
    // Now the exemplar should be revealed
    sortWork.getSortWorkItemByTitle(exemplarName).parents('.list-item').should("not.have.class", "private");
  });
});
