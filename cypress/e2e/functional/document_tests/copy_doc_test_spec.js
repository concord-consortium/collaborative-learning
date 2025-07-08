import ClueCanvas from '../../../support/elements/common/cCanvas';
import Canvas from '../../../support/elements/common/Canvas';
import DataCardToolTile from '../../../support/elements/tile/DataCardToolTile';
import GeometryToolTile from '../../../support/elements/tile/GeometryToolTile';
import ImageToolTile from '../../../support/elements/tile/ImageToolTile';
import DrawToolTile from '../../../support/elements/tile/DrawToolTile';
import TextToolTile from '../../../support/elements/tile/TextToolTile';
import TableToolTile from '../../../support/elements/tile/TableToolTile';
import ExpressionToolTile from '../../../support/elements/tile/ExpressionToolTile';
import NumberlineToolTile from '../../../support/elements/tile/NumberlineToolTile';
import DiagramToolTile from '../../../support/elements/tile/DiagramToolTile';
import DataflowToolTile from '../../../support/elements/tile/DataflowToolTile';
import SimulatorTile from '../../../support/elements/tile/SimulatorTile';
import XYPlotToolTile from '../../../support/elements/tile/XYPlotToolTile';
import QuestionToolTile from '../../../support/elements/tile/QuestionToolTile';

let tableTile = new TableToolTile;
let textTile = new TextToolTile;
let drawTile = new DrawToolTile;
let imageTile = new ImageToolTile;
let geometryTile = new GeometryToolTile;
let expressionTile = new ExpressionToolTile;
let datacardTile = new DataCardToolTile;
let numberlineTile = new NumberlineToolTile;
let diagramTile = new DiagramToolTile;
let dataflowTile = new DataflowToolTile;
let simulatorTile = new SimulatorTile;
let xyTile = new XYPlotToolTile;
let questionTile = new QuestionToolTile;

let clueCanvas = new ClueCanvas;
let canvas = new Canvas;

function beforeTest() {
  const queryParams = `${Cypress.config("qaUnitStudent5")}`;
  cy.visit(queryParams);
  cy.waitForLoad();
}

context('Copy Document', () => {
  it('Verify various tiles are copied correctly', function () {
    beforeTest();

    cy.log('Add text tile');
    clueCanvas.addTile('text');
    textTile.verifyTextTileIsEditable();
    textTile.enterText('Hello World');

    cy.log('Add table tile');
    clueCanvas.addTile('table');
    cy.get(".primary-workspace").within((workspace) => {
      tableTile.typeInTableCell(1, '3');
      tableTile.getTableCell().eq(1).should('contain', '3');
    });

    cy.log('Add geometry tile');
    clueCanvas.addTile('geometry');
    geometryTile.getGeometryTile().last().click();
    clueCanvas.clickToolbarButton('geometry', 'point');
    geometryTile.clickGraphPosition(5, 5);
    geometryTile.clickGraphPosition(10, 5);
    geometryTile.clickGraphPosition(10, 10);
    geometryTile.getPhantomGraphPoint().should('exist');
    geometryTile.getGraphPoint().should('have.length', 3);

    cy.log('Add drawing tile');
    clueCanvas.addTile("drawing");
    drawTile.drawRectangle(250, 50, -150, 100);
    drawTile.getRectangleDrawing().should("exist").and("have.length", 1);

    cy.log("Add expression tile");
    clueCanvas.addTile("expression");
    expressionTile.getMathField().should("have.value", "a=\\pi r^2");

    cy.log("Add number line tile");
    clueCanvas.addTile("numberline");
    numberlineTile.setToolbarPoint(); //click Point in order to add points to numberline
    numberlineTile.addPointOnNumberlineTick(-4.0);
    numberlineTile.addPointOnNumberlineTick(2.0);
    numberlineTile.getPointsOnGraph().should('have.length', 2);

    cy.log("Add image tile");
    clueCanvas.addTile('image');
    const imageFilePath1 = 'image.png';
    imageTile.getImageToolTile().should("exist");
    cy.uploadFile(imageTile.imageChooseFileButton(), imageFilePath1, 'image/png');

    cy.log("Add data card tool tile");
    clueCanvas.addTile("datacard");
    datacardTile.getAttrName().dblclick().type("Attr1 Name{enter}");
    datacardTile.getAttrName().contains("Attr1 Name");
    datacardTile.getAttrValue().click().type("ocean{enter}");
    datacardTile.getTile().click();
    datacardTile.getAttrValueInput().invoke('val').should('eq', "ocean");

    cy.log("Add Diagram tool tile");
    const name = "name1";
    const dialogField = (field) => cy.get(`#evd-${field}`);
    const dialogOkButton = () => cy.get(".modal-button").last();
    clueCanvas.addTile("diagram");
    diagramTile.getDiagramTile().should("exist").click();
    clueCanvas.clickToolbarButton("diagram", "new-variable");
    diagramTile.getDiagramDialog().should("exist");
    dialogField("name").should("exist").type(name);
    dialogOkButton().click();
    diagramTile.getVariableCard().should("exist");
    diagramTile.getVariableCardField("name").should("have.value", name);

    cy.log("Add Dataflow tool tile");
    const generatorNode = "generator";
    clueCanvas.addTile("dataflow");
    dataflowTile.getDataflowTile().should("exist");
    dataflowTile.getCreateNodeButton(generatorNode).click();
    dataflowTile.getNode(generatorNode).should("exist");
    dataflowTile.getRecordButton().click();
    cy.wait(5000);
    dataflowTile.getStopButton().click();

    cy.log("Add Simulator tool tile");
    clueCanvas.addTile("simulator");
    simulatorTile.getSimulatorTile().should("exist");
    simulatorTile.getSimulatorTile().should("contain.text", "EMG Sensor");
    simulatorTile.getSimulatorTile().should("contain.text", "Surface Pressure Sensor");
    simulatorTile.getSimulatorTile().should("contain.text", "Temperature Sensor");
    simulatorTile.getSimulatorTile().should("contain.text", "Gripper Output");

    cy.log("Add Graph tool tile");
    clueCanvas.addTile("graph");
    xyTile.getTile().should('be.visible');
    xyTile.getTile().click();
    clueCanvas.clickToolbarButton('graph', 'link-tile-multiple');
    xyTile.linkProgram("Program 1");
    xyTile.getGraphDot().should('have.length.greaterThan', 3);

    cy.log("Add default question tile");
    clueCanvas.addTile("question");
    questionTile.getQuestionTile().should("exist");
    questionTile.getQuestionTileEmbeddedTiles().should("have.length", 2); // prompt and placeholder

    cy.log("Copy Document");
    const copyTitle = 'Personal Workspace Copy';
    canvas.copyDocument(copyTitle);
    canvas.getPersonalDocTitle().should('contain', copyTitle);

    cy.log("Check all tiles are restored in copied document");
    textTile.getTextTile().first().scrollIntoView().should('be.visible');
    textTile.getTextEditor().first().should('contain', 'Hello World');

    tableTile.getTableTile().scrollIntoView().should('be.visible');
    tableTile.getTableCell().eq(1).should('contain', '3');

    geometryTile.getGeometryTile().scrollIntoView().should('be.visible');
    geometryTile.getGraphPoint().should('have.length', 3);

    drawTile.getDrawTile().scrollIntoView().should('be.visible');
    drawTile.getRectangleDrawing().should("exist").and("have.length", 1);

    expressionTile.getExpressionTile().scrollIntoView().should('be.visible');
    expressionTile.getMathField().should("have.value", "a=\\pi r^2");

    numberlineTile.getNumberlineTile().scrollIntoView().should('be.visible');
    numberlineTile.getPointsOnGraph().should('have.length', 2);

    imageTile.getImageTile().scrollIntoView().should('be.visible');

    datacardTile.getTile().scrollIntoView().should('be.visible');
    datacardTile.getAttrName().eq(0).should('contain', "Attr1 Name");
    datacardTile.getAttrValueInput().invoke('val').should('eq', "ocean");

    diagramTile.getDiagramTile().scrollIntoView().should('be.visible');
    diagramTile.getVariableCard().should("exist");
    diagramTile.getVariableCardField("name").should("have.value", name);

    dataflowTile.getDataflowTile().scrollIntoView().should("exist");
    dataflowTile.getNode(generatorNode).should("exist");

    simulatorTile.getSimulatorTile().scrollIntoView().should("exist");
    simulatorTile.getSimulatorTile().should("contain.text", "EMG Sensor");
    simulatorTile.getSimulatorTile().should("contain.text", "Surface Pressure Sensor");
    simulatorTile.getSimulatorTile().should("contain.text", "Temperature Sensor");
    simulatorTile.getSimulatorTile().should("contain.text", "Gripper Output");

    xyTile.getTile().scrollIntoView().should('be.visible');
    xyTile.getGraphDot().should('have.length.greaterThan', 3);

    questionTile.getQuestionTile().scrollIntoView().should('be.visible');
    questionTile.getQuestionTileEmbeddedTiles().should("have.length", 2);
  });
});
