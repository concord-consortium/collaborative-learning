import ClueCanvas from '../../../support/elements/common/cCanvas';
import TextToolTile from '../../../support/elements/tile/TextToolTile';
import TableToolTile from '../../../support/elements/tile/TableToolTile';
import GeometryToolTile from '../../../support/elements/tile/GeometryToolTile';
import DrawToolTile from '../../../support/elements/tile/DrawToolTile';
import ExpressionToolTile from '../../../support/elements/tile/ExpressionToolTile';
import NumberlineToolTile from '../../../support/elements/tile/NumberlineToolTile';
import DataCardToolTile from '../../../support/elements/tile/DataCardToolTile';
import DataflowToolTile from '../../../support/elements/tile/DataflowToolTile';
import SimulatorTile from '../../../support/elements/tile/SimulatorTile';

const clueCanvas = new ClueCanvas;
const textToolTile = new TextToolTile;
const tableToolTile = new TableToolTile;
const geometryToolTile = new GeometryToolTile;
const drawToolTile = new DrawToolTile;
const exp = new ExpressionToolTile;
const numberlineToolTile = new NumberlineToolTile;
const dc = new DataCardToolTile;
const dataflowToolTile = new DataflowToolTile;
const simulatorTile = new SimulatorTile;
let students = [15, 16];

const teacherUrl = `${Cypress.config("qaUnitTeacher6")}&mouseSensor`;

function testTilesNotReadOnly(tab, position) {
  cy.get('.'+tab).find(position + ' .text-tool').should('not.have.class', 'read-only');
  cy.get('.'+tab).find(position + ' .table-tool-tile').should('not.have.class', 'readonly');
  cy.get('.'+tab).find(position + ' .geometry-tool-tile').should('not.have.class', 'readonly');
  cy.get('.'+tab).find(position + ' .drawing-tool').not('[data-testid="tile-navigator"] .drawing-tool').should('not.have.class', 'read-only');
  cy.get('.'+tab).find(position + ' .image-tool').should('not.have.class', 'read-only');
  cy.get('.'+tab).find(position + ' .numberline-tool-tile').should('not.have.class', 'readonly');
  cy.get('.'+tab).find(position + ' .data-card-tool-tile').should('not.have.class', 'readonly');
  cy.get('.'+tab).find(position + ' .expression-tool-tile').should('not.have.class', 'readonly');
}

function testTilesNotReadOnlyBrain(tab, position) {
  cy.get('.'+tab).find(position + ' .dataflow-tool-tile').should('not.have.class', 'readonly');
  cy.get('.'+tab).find(position + ' .graph-tool-tile').should('not.have.class', 'readonly');
  cy.get('.'+tab).find(position + ' .simulator-tool-tile').should('not.have.class', 'readonly');
}

function testTilesReadOnly(tab, position) {
  cy.get('.'+tab).find(position + ' .text-tool').should('have.class', 'read-only');
  cy.get('.'+tab).find(position + ' .table-tool-tile').should('have.class', 'readonly');
  cy.get('.'+tab).find(position + ' .geometry-tool-tile').should('have.class', 'readonly');
  cy.get('.'+tab).find(position + ' .drawing-tool').not('[data-testid="tile-navigator"] .drawing-tool').should('have.class', 'read-only');
  cy.get('.'+tab).find(position + ' .image-tool').should('have.class', 'read-only');
  cy.get('.'+tab).find(position + ' .numberline-tool-tile').should('have.class', 'readonly');
  cy.get('.'+tab).find(position + ' .data-card-tool-tile').should('have.class', 'readonly');
  cy.get('.'+tab).find(position + ' .expression-tool-tile').should('have.class', 'readonly');
}

function testTilesReadOnlyBrain(tab, position) {
  cy.get('.'+tab).find(position + ' .dataflow-tool-tile').should('have.class', 'readonly');
  cy.get('.'+tab).find(position + ' .graph-tool-tile').should('have.class', 'readonly');
  cy.get('.'+tab).find(position + ' .simulator-tool-tile').should('have.class', 'readonly');
}

function getUrl(studentIndex) {
  return `${Cypress.config("qaUnitGroup")}&mouseSensor&fakeUser=student:${students[studentIndex]}`;
}

function setupTest(studentIndex) {
  const url = getUrl(studentIndex);
  cy.visit(url);
  cy.waitForLoad();
  clueCanvas.shareCanvas();//all students will share their canvas
  cy.wait(5000);
  clueCanvas.addTile('text');
  textToolTile.verifyTextTileIsEditable();
  textToolTile.enterText('This is to test the 4-up view of S' + students[studentIndex]);
  textToolTile.getTextTile().last().should('contain', '4-up').and('contain', 'S' + students[studentIndex]);
  clueCanvas.addTile('table');
  cy.get(".primary-workspace").within((workspace) => {
    tableToolTile.typeInTableCell(1, '3');
    tableToolTile.getTableCell().eq(1).should('contain', '3');
    tableToolTile.typeInTableCell(2, '2.5');
    tableToolTile.getTableCell().eq(2).should('contain', '2.5');
  });
  clueCanvas.addTile('geometry');
  cy.get('.spacer').click();
  geometryToolTile.getGeometryTile().last().click();
  clueCanvas.clickToolbarButton('geometry', 'point');
  geometryToolTile.clickGraphPosition(5, 5);
  geometryToolTile.clickGraphPosition(10, 5);
  geometryToolTile.clickGraphPosition(10, 10);
  geometryToolTile.getGraphPoint().should('have.length', 3);
  geometryToolTile.getPhantomGraphPoint().should('exist');
  clueCanvas.addTile("drawing");
  drawToolTile.drawRectangle(100, 100);
  drawToolTile.getRectangleDrawing().should("exist").and("have.length", 1);
  clueCanvas.addTile("expression");
  exp.getMathField().should("have.value", "a=\\pi r^2");

  clueCanvas.addTile("numberline");
  numberlineToolTile.setToolbarPoint(); //click Point in order to add points to numberline
  numberlineToolTile.addPointOnNumberlineTick(-4.0);
  numberlineToolTile.addPointOnNumberlineTick(2.0);
  numberlineToolTile.getPointsOnGraph().should('have.length', 2);

  const newName = "Image Tile";
  clueCanvas.addTile('image');
  cy.get('.primary-workspace .image-tool .editable-tile-title-text').first().should("contain", "Image 1");
  cy.get('.primary-workspace .image-tool .editable-tile-title-text').first().click();
  cy.get('.primary-workspace .image-tool .editable-tile-title').first().type(newName + '{enter}');
  cy.get('.primary-workspace .image-tool .editable-tile-title-text').should("contain", newName);
  clueCanvas.addTile("datacard");
  dc.getAttrName().dblclick().type("Attr1 Name{enter}");
  dc.getAttrName().contains("Attr1 Name");
  dc.getAttrValue().click().type("ocean{enter}");
  dc.getTile().click();
  dc.getAttrValueInput().invoke('val').should('eq', "ocean");
}

function setupTestBrain(studentIndex) {
  const url = getUrl(studentIndex);
  cy.visit(url);
  cy.waitForLoad();
  clueCanvas.shareCanvas();//all students will share their canvas
  cy.wait(5000);
  clueCanvas.addTile("dataflow");
  const numberNode = "number";
  dataflowToolTile.getCreateNodeButton(numberNode).click();
  dataflowToolTile.getNode(numberNode).should("exist");
  dataflowToolTile.getNodeTitle().invoke("val").should("include", "Number");

  clueCanvas.addTile("simulator");
  const newName = "Test Simulation";
  simulatorTile.getTileTitle().should("contain", "Simulation 1");
  simulatorTile.getSimulatorTileTitle().click();
  simulatorTile.getSimulatorTileTitle().type(newName + '{enter}');
  cy.wait(1000);
  simulatorTile.getTileTitle().should("contain", newName);

  clueCanvas.addTile("graph");
  const title = "XY Plot test";
  cy.get('.primary-workspace .graph-wrapper .editable-tile-title-text').first().should("contain", "Graph 1");
  cy.get('.primary-workspace .graph-wrapper .editable-tile-title-text').first().click();
  cy.get('.primary-workspace .graph-wrapper .editable-tile-title').first().type(title + '{enter}');
  cy.get('.primary-workspace .graph-wrapper .editable-tile-title-text').should("contain", title);
}

context('Test 4-up and 1-up views tiles read only functionalities', function () {
  it('4-up and 1-up views read-only text, table, geometry, drawing, expression, numberline, image, datacard tiles', function () {

    setupTest(0);
    setupTest(1);

    clueCanvas.openFourUpView();
    clueCanvas.getSingleWorkspace().find('.member').eq(0).click();
    testTilesNotReadOnly("primary-workspace", "");
    clueCanvas.toggleFourUpViewToolbarButton();
    clueCanvas.getSingleWorkspace().find('.member').eq(1).click();
    testTilesReadOnly("primary-workspace", "");
    clueCanvas.toggleFourUpViewToolbarButton();
    testTilesNotReadOnly("primary-workspace", ".north-west");
    testTilesReadOnly("primary-workspace", ".north-east");

    cy.visit(teacherUrl);
    cy.waitForLoad();
    cy.openTopTab("student-work");

    cy.get('.four-up .north-west .member').should('contain', "S15").click();
    testTilesReadOnly("student-group-view", "");
    clueCanvas.toggleFourUpViewToolbarButton();
    testTilesReadOnly("student-group-view", "");
    cy.get('.four-up .north-east .member').should('contain', "S16").click();
    clueCanvas.toggleFourUpViewToolbarButton();
    testTilesReadOnly("student-group-view", ".north-west");
    testTilesReadOnly("student-group-view", ".north-east");
  });
  it('4-up and 1-up views read-only dataflow, expression, xy plot tiles', function () {

    setupTestBrain(0);
    setupTestBrain(1);

    clueCanvas.openFourUpView();
    clueCanvas.getSingleWorkspace().find('.member').eq(0).click();
    testTilesNotReadOnlyBrain("primary-workspace", "");
    clueCanvas.toggleFourUpViewToolbarButton();
    clueCanvas.getSingleWorkspace().find('.member').eq(1).click();
    testTilesReadOnlyBrain("primary-workspace", "");
    clueCanvas.toggleFourUpViewToolbarButton();
    testTilesNotReadOnlyBrain("primary-workspace", ".north-west");
    testTilesReadOnlyBrain("primary-workspace", ".north-east");

    cy.visit(teacherUrl);
    cy.waitForLoad();
    cy.openTopTab("student-work");

    cy.get('.four-up .north-west .member').should('contain', "S15").click();
    testTilesReadOnlyBrain("student-group-view", "");
    clueCanvas.toggleFourUpViewToolbarButton();
    testTilesReadOnlyBrain("student-group-view", "");
    cy.get('.four-up .north-east .member').should('contain', "S16").click();
    clueCanvas.toggleFourUpViewToolbarButton();
    testTilesReadOnlyBrain("student-group-view", ".north-west");
    testTilesReadOnlyBrain("student-group-view", ".north-east");
  });
});
