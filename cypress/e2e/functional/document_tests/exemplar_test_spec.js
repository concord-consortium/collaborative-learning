import SortedWork from "../../../support/elements/common/SortedWork";
import ClueCanvas from '../../../support/elements/common/cCanvas';
import DrawToolTile from '../../../support/elements/tile/DrawToolTile';

let sortWork = new SortedWork,
  clueCanvas = new ClueCanvas,
  drawToolTile = new DrawToolTile;

// This unit has `initiallyHideExemplars` set, and an exemplar defined in curriculum
const queryParams1 = `${Cypress.config("qaConfigSubtabsUnitStudent5")}`;
const exemplarName = "Ivan Idea: First Exemplar";

function beforeTest(params) {
  cy.clearQAData('all');
  cy.visit(params);
  cy.waitForLoad();
}

function drawSmallRectangle(x, y) {
  drawToolTile.getDrawToolRectangle().click();
  drawToolTile.getDrawTile()
  .trigger("mousedown", x, y)
  .trigger("mousemove", x+25, y+25)
  .trigger("mouseup", x+25, y+25);
}

context('Exemplar Documents', function () {
  it('Unit with exemplars hidden initially, revealed by drawing actions', function () {
    beforeTest(queryParams1);
    cy.openTopTab('sort-work');
    sortWork.checkDocumentInGroup("No Group", exemplarName);
    sortWork.getSortWorkItemByTitle(exemplarName).parents('.list-item').should("have.class", "private");

    cy.log("Create drawing tile and perform 3 events to reveal exemplar");
    clueCanvas.addTile("drawing");
    drawSmallRectangle(100, 50);
    drawSmallRectangle(200, 50);
    drawSmallRectangle(300, 50);

    sortWork.getSortWorkItemByTitle(exemplarName).parents('.list-item').should("not.have.class", "private");
  });
});
