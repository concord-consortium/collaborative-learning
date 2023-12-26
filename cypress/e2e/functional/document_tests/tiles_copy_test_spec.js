import ClueCanvas from '../../../support/elements/common/cCanvas';
import TextToolTile from '../../../support/elements/tile/TextToolTile';
import Canvas from '../../../support/elements/common/Canvas';
import TableToolTile from '../../../support/elements/tile/TableToolTile';
import GeometryToolTile from '../../../support/elements/tile/GeometryToolTile';
import DrawToolTile from '../../../support/elements/tile/DrawToolTile';
import ExpressionToolTile from '../../../support/elements/tile/ExpressionToolTile';
import NumberlineToolTile from '../../../support/elements/tile/NumberlineToolTile';
import ImageToolTile from '../../../support/elements/tile/ImageToolTile';
import DataCardToolTile from '../../../support/elements/tile/DataCardToolTile';
import DataflowToolTile from '../../../support/elements/tile/DataflowToolTile';
import SimulatorTile from '../../../support/elements/tile/SimulatorTile';
import DiagramToolTile from '../../../support/elements/tile/DiagramToolTile';
import Dialog from "../../../support/elements/common/Dialog";

const student5 = `${Cypress.config("queryParams")}`;
const studentBrain5 = "?appMode=qa&fakeClass=5&fakeUser=student:5&qaGroup=5&mouseSensor&unit=brain";
const studentM2s5 = "?appMode=qa&fakeClass=5&fakeUser=student:5&qaGroup=5&unit=m2s";
const student6 = "?appMode=qa&fakeClass=5&fakeUser=student:6&demoOffering=5&problem=2.1&qaGroup=5";
const studentBrain6 = "?appMode=qa&fakeClass=5&fakeUser=student:6&qaGroup=5&mouseSensor&unit=brain";
const studentM2s6 = "?appMode=qa&fakeClass=5&fakeUser=student:6&qaGroup=5&unit=m2s";

let clueCanvas = new ClueCanvas,
    textToolTile = new TextToolTile,
    tableToolTile = new TableToolTile,
    geometryToolTile = new GeometryToolTile,
    drawToolTile = new DrawToolTile,
    exp = new ExpressionToolTile,
    numberlineToolTile = new NumberlineToolTile,
    imageToolTile = new ImageToolTile,
    dc = new DataCardToolTile,
    dataflowToolTile = new DataflowToolTile,
    simulatorTile = new SimulatorTile,
    diagramTile = new DiagramToolTile;
let canvas = new Canvas;
let dialog = new Dialog;

let studentWorkspace = 'SAS 2.1 Drawing Wumps';
let studentWorkspacesBrain = 'Lesson 1.1 - What is a bionic arm?';
let studentWorkspacesM2s = 'Getting Started in M2Studio';
let studentWorkspaceCopyTiles = 'Test Workspace Copy Tiles';
let studentClassWorkCopyTiles = 'Test Class Work Copy Tiles';

const tile = [{ "name": "table" },
              { "name": "geometry" },
              { "name": "drawing" },
              { "name": "expression" },
              { "name": "numberline" },
              { "name": "image" },
              { "name": "data-card" }];

const tile1 = [{ "name": "simulator" },
              { "name": "graph" }];

const tile2 = [{ "name": "text" },
              { "name": "dataflow" }];

function beforeTest(queryParams) {
  cy.clearQAData('all');
  cy.visit(queryParams);
  cy.waitForLoad();
}

function testPrimaryWorkspaceSas() {
  // Make sure the table tile were copied correctly
  cy.get('.primary-workspace .rdg-row .rdg-cell').eq(1).should('contain', '3');
  cy.get('.primary-workspace .rdg-row .rdg-cell').eq(2).should('contain', '2.5');
  // Make sure the geometry tile were copied correctly
  cy.get('.primary-workspace .geometry-content.editable ellipse[display="inline"]').should('have.length', 3);
  // Make sure the drawing tile were copied correctly
  drawToolTile.getRectangleDrawing().should("exist").and("have.length", 1);
  // Make sure the expression tile were copied correctly
  cy.get('.primary-workspace .expression-math-area math-field').should("have.value", "a=\\pi r^2");
  // Make sure the numberline tile were copied correctly
  cy.get('.primary-workspace .numberline-tool-container .point-inner-circle').not(".mouse-follow-point").should('have.length', 2);
  // Make sure the image tile were copied correctly
  cy.get('.primary-workspace .image-tool .editable-tile-title-text').should("contain", "Image Tile");
  // Make sure the datacard tile were copied correctly
  dc.getAttrName().contains("Attr1 Name");
  dc.getAttrValueInput().invoke('val').should('eq', "ocean");

  canvas.deleteDocument();
}

function testPrimaryWorkspaceBrain() {
  // Make sure the text tile were copied correctly
  textToolTile.getTextTile().last().should('contain', 'Hello World');
  // Make sure the dataflow tile were copied correctly
  dataflowToolTile.getNodeTitle().should("contain", "Number");

  canvas.deleteDocument();
}

function testPrimaryWorkspaceBrain1() {
  // Make sure the simulator tile were copied correctly
  simulatorTile.getTileTitle().should("contain", "Test Simulation");
  // Make sure the XY plot tile were copied correctly
  cy.get('.primary-workspace .graph-wrapper .editable-tile-title-text').should("contain", "XY Plot test");

  canvas.deleteDocument();
}

function createNewWorkspace(doc) {
  cy.log('verify personal workspace header UI');
  canvas.openFileMenu();
  cy.get('[data-test=list-item-icon-open-workspace]').click();
  cy.get('[data-test=my-work-section-workspaces-documents] [data-test=my-work-new-document]').eq(1).click();
  dialog.getDialogTitle().should('exist');
  dialog.getDialogTextInput().click().clear().type(doc);
  dialog.getDialogOKButton().click();
  cy.wait(5000);
}

context('Test copy tiles from one document to other document', function () {
  it('Verify table, geometry, drawing, expression, numberline, image, datacard tiles are copied correctly', function () {
    beforeTest(student5);
    cy.log('Add table tile');
    clueCanvas.addTile('table');
    cy.get(".primary-workspace").within((workspace) => {
      tableToolTile.typeInTableCell(1, '3');
      tableToolTile.getTableCell().eq(1).should('contain', '3');
      tableToolTile.typeInTableCell(2, '2.5');
      tableToolTile.getTableCell().eq(2).should('contain', '2.5');
    });

    cy.log('Add graph tile');
    clueCanvas.addTile('geometry');
    cy.get('.spacer').click();
    textToolTile.deleteTextTile();
    geometryToolTile.getGeometryTile().last().click();
    geometryToolTile.addPointToGraph(5, 5);
    geometryToolTile.addPointToGraph(10, 5);
    geometryToolTile.addPointToGraph(10, 10);
    geometryToolTile.getGraphPoint().should('have.length', 3);

    cy.log('Add drawing tile');
    clueCanvas.addTile("drawing");
    drawToolTile.getDrawToolRectangle().click();
    drawToolTile.getDrawTile()
      .trigger("mousedown", 250, 50)
      .trigger("mousemove", 100, 150)
      .trigger("mouseup", 100, 50);
    drawToolTile.getRectangleDrawing().should("exist").and("have.length", 1);

    cy.log("Add expression tile");
    clueCanvas.addTile("expression");
    exp.getMathField().should("have.value", "a=\\pi r^2");

    cy.log("Add number line tile");
    clueCanvas.addTile("numberline");
    numberlineToolTile.addPointOnNumberlineTick(-4.0);
    numberlineToolTile.addPointOnNumberlineTick(2.0);
    numberlineToolTile.getPointsOnGraph().should('have.length', 2);

    cy.log("Add image tile");
    const newName = "Image Tile";
    clueCanvas.addTile('image');
    cy.get('.primary-workspace .image-tool .editable-tile-title-text').first().should("contain", "Image 1");
    cy.get('.primary-workspace .image-tool .editable-tile-title-text').first().click();
    cy.get('.primary-workspace .image-tool .editable-tile-title').first().type(newName + '{enter}');
    cy.get('.primary-workspace .image-tool .editable-tile-title-text').should("contain", newName);

    cy.log("Add data card tool tile");
    clueCanvas.addTile("datacard");
    dc.getAttrName().dblclick().type("Attr1 Name{enter}");
    dc.getAttrName().contains("Attr1 Name");
    dc.getAttrValue().click().type("ocean{enter}");
    dc.getTile().click();
    dc.getAttrValueInput().invoke('val').should('eq', "ocean");

    //Publish the document
    canvas.publishCanvas("investigation");

    // Unpublished document tiles copy
    cy.log('My Work tab');
    cy.openTopTab('my-work');
    cy.openSection("my-work", "workspaces");
    cy.openDocumentThumbnail('my-work', 'workspaces', studentWorkspace);

    //Create new document
    canvas.createNewExtraDocumentFromFileMenu(studentWorkspaceCopyTiles, "my-work");
    cy.wait(5000);

    const dataTransfer = new DataTransfer;
    const leftTile = type => cy.get(`.nav-tab-panel .my-work .${type}-tool-tile`);

    tile.forEach(tool => {
      leftTile(tool.name).first().click();
      leftTile(tool.name).first().trigger('dragstart', { dataTransfer });
      cy.get('.single-workspace .canvas .document-content').first()
       .trigger('drop', { force: true, dataTransfer });
      cy.wait(2000);
    });
    
    //Verify my work document tiles are copied correctly
    testPrimaryWorkspaceSas();

    //Load student 6
    cy.visit(student6);
    cy.waitForLoad();

    // Published document tiles copy
    cy.log('Class work tab');
    cy.openTopTab('class-work');
    cy.openSection("class-work", "workspaces");
    cy.openDocumentThumbnail('class-work', 'workspaces', studentWorkspace);

    //Create new document
    canvas.createNewExtraDocumentFromFileMenu(studentClassWorkCopyTiles, "my-work");
    cy.wait(5000);

    const dataTransfer1 = new DataTransfer;
    const leftTile1 = type => cy.get(`.nav-tab-panel .class-work .${type}-tool-tile`);

    tile.forEach(tool => {
      leftTile1(tool.name).first().click();
      leftTile1(tool.name).first().trigger('dragstart', { dataTransfer });
      cy.get('.single-workspace .canvas .document-content').first()
       .trigger('drop', { force: true, dataTransfer });
      cy.wait(2000);
    });
     
    //Verify class work document tiles are copied correctly
    testPrimaryWorkspaceSas();

  });
  it('Verify text, dataflow tiles are copied correctly', function () {
    beforeTest(studentBrain5);

    cy.log('Add text tile');
    clueCanvas.addTile('text');
    textToolTile.enterText('Hello World');
    textToolTile.getTextTile().last().should('contain', 'Hello World');
    
    cy.log('Add dataflow tile');
    clueCanvas.addTile("dataflow");
    const numberNode = "number";
    dataflowToolTile.getCreateNodeButton(numberNode).click();
    dataflowToolTile.getNode(numberNode).should("exist");
    dataflowToolTile.getNodeTitle().should("contain", "Number");

    //Publish the document
    canvas.publishCanvas("investigation");

    // Unpublished document tiles copy
    cy.log('My Work tab');
    cy.openTopTab('my-work');
    cy.openSection("my-work", "workspaces");
    cy.openDocumentThumbnail('my-work', 'workspaces', studentWorkspacesBrain);

    //Create new document
    canvas.createNewExtraDocumentFromFileMenu(studentWorkspaceCopyTiles, "my-work");
    cy.wait(5000);

    const dataTransfer = new DataTransfer;
    const leftTile = type => cy.get(`.nav-tab-panel .my-work .${type}-tool-tile`);

    tile2.forEach(tool => {
      leftTile(tool.name).first().click();
      leftTile(tool.name).first().find('.tool-tile-drag-handle').trigger('dragstart', { dataTransfer });
      cy.get('.single-workspace .canvas .document-content').first()
        .trigger('drop', { force: true, dataTransfer });
      cy.wait(2000);
    });

    //Verify my work document tiles are copied correctly
    testPrimaryWorkspaceBrain();

    //Load student 6
    cy.visit(studentBrain6);
    cy.waitForLoad();

    // Published document tiles copy
    cy.log('Class work tab');
    cy.openTopTab('class-work');
    cy.openSection("class-work", "class-models");
    cy.get('.document-tabs.class-work .list.class-models [data-test="class-models and data-list-items"] .footer').contains(studentWorkspacesBrain).parent().parent().siblings('.scaled-list-item-container').click({force:true});
    
    //Create new document
    canvas.createNewExtraDocumentFromFileMenu(studentClassWorkCopyTiles, "my-work");
    cy.wait(5000);

    const leftTile1 = type => cy.get(`.nav-tab-panel .class-work .${type}-tool-tile`);

    tile2.forEach(tool => {
      leftTile1(tool.name).first().click();
      leftTile1(tool.name).first().find('.tool-tile-drag-handle').trigger('dragstart', { dataTransfer });
      cy.get('.single-workspace .canvas .document-content').first()
        .trigger('drop', { force: true, dataTransfer });
      cy.wait(2000);
    });

    //Verify class work document tiles are copied correctly
    testPrimaryWorkspaceBrain();

  });
  it('Verify simulator, XY plot tiles are copied correctly', function () {
    beforeTest(studentBrain6);

    cy.log('Add simulator tile');
    clueCanvas.addTile("simulator");
    const newName = "Test Simulation";
    simulatorTile.getTileTitle().should("contain", "Simulation 1");
    simulatorTile.getSimulatorTileTitle().click();
    simulatorTile.getSimulatorTileTitle().type(newName + '{enter}');
    simulatorTile.getTileTitle().should("contain", newName);

    cy.log("Add XY plot tile");
    clueCanvas.addTile("graph");
    const title = "XY Plot test";
    cy.get('.primary-workspace .graph-wrapper .editable-tile-title-text').first().should("contain", "Graph 1");
    cy.get('.primary-workspace .graph-wrapper .editable-tile-title-text').first().click();
    cy.get('.primary-workspace .graph-wrapper .editable-tile-title').first().type(title + '{enter}');
    cy.get('.primary-workspace .graph-wrapper .editable-tile-title-text').should("contain", title);

    //Publish the document
    canvas.publishCanvas("investigation");

    // Unpublished document tiles copy
    cy.log('My Work tab');
    cy.openTopTab('my-work');
    cy.openSection("my-work", "workspaces");
    cy.openDocumentThumbnail('my-work', 'workspaces', studentWorkspacesBrain);

    //Create new document
    canvas.createNewExtraDocumentFromFileMenu(studentWorkspaceCopyTiles, "my-work");
    cy.wait(5000);

    const dataTransfer = new DataTransfer;
    const leftTile = type => cy.get(`.nav-tab-panel .my-work .${type}-tool-tile`);

    tile1.forEach(tool => {
      leftTile(tool.name).first().click();
      leftTile(tool.name).first().trigger('dragstart', { dataTransfer });
      cy.get('.single-workspace .canvas .document-content').first()
        .trigger('drop', { force: true, dataTransfer });
      cy.wait(2000);
    });

    //Verify my work document tiles are copied correctly
    testPrimaryWorkspaceBrain1();

    //Load student 6
    cy.visit(studentBrain6);
    cy.waitForLoad();

    // Published document tiles copy
    cy.log('Class work tab');
    cy.openTopTab('class-work');
    cy.openSection("class-work", "class-models");
    cy.get('.document-tabs.class-work .list.class-models [data-test="class-models and data-list-items"] .footer').contains(studentWorkspacesBrain).parent().parent().siblings('.scaled-list-item-container').click({force:true});
    
    //Create new document
    canvas.createNewExtraDocumentFromFileMenu(studentClassWorkCopyTiles, "my-work");
    cy.wait(5000);

    const leftTile1 = type => cy.get(`.nav-tab-panel .class-work .${type}-tool-tile`);

    tile1.forEach(tool => {
      leftTile1(tool.name).first().click();
      leftTile1(tool.name).first().trigger('dragstart', { dataTransfer });
      cy.get('.single-workspace .canvas .document-content').first()
        .trigger('drop', { force: true, dataTransfer });
      cy.wait(2000);
    });

    //Verify class work document tiles are copied correctly
    testPrimaryWorkspaceBrain1();

  });
  it('Verify diagram tile is copied correctly', function () {
    beforeTest(studentM2s5);
    
    cy.log('Add drawing tile');
    clueCanvas.addTile("diagram");
    const newName = "Test Diagram";
    diagramTile.getTileTitleText().should("contain", "Diagram 1");
    diagramTile.getTileTitleContainer().click();
    diagramTile.getTileTitleContainer().type(newName + '{enter}');
    diagramTile.getTileTitleText().should("contain", newName);

    //Publish the document
    canvas.publishCanvas("investigation");

    // Unpublished document tiles copy
    cy.log('My Work tab');
    cy.openTopTab('my-work');
    cy.get('.document-tabs.my-work [data-test="documents-list-items"] .footer').contains(studentWorkspacesM2s).parent().parent().siblings('.scaled-list-item-container').click({force:true});

    //Create new document
    createNewWorkspace(studentWorkspaceCopyTiles);

    const dataTransfer = new DataTransfer;
    const leftTile = type => cy.get(`.nav-tab-panel .my-work .${type}-tool-tile`);

    leftTile("diagram").first().click();
    leftTile("diagram").first().find('.tool-tile-drag-handle').trigger('dragstart', { dataTransfer });
    cy.get('.single-workspace .canvas .document-content').first()
      .trigger('drop', { force: true, dataTransfer });
    cy.wait(2000);

    //Verify my work document tiles are copied correctly
    diagramTile.getTileTitleText().should("contain", newName);

    canvas.deleteDocument();

    //Load student 6
    cy.visit(studentM2s6);
    cy.waitForLoad();

    // Published document tiles copy
    cy.log('Class work tab');
    cy.openTopTab('class-work');
    cy.get('.document-tabs.class-work [data-test="class-work-section-published-documents"] .footer').contains(studentWorkspacesM2s).parent().parent().siblings('.scaled-list-item-container').click({force:true});
    
    //Create new document
    createNewWorkspace(studentClassWorkCopyTiles);

    const leftTile1 = type => cy.get(`.nav-tab-panel .class-work .${type}-tool-tile`);

    leftTile1("diagram").first().click();
    leftTile1("diagram").first().find('.tool-tile-drag-handle').trigger('dragstart', { dataTransfer });
    cy.get('.single-workspace .canvas .document-content').first()
      .trigger('drop', { force: true, dataTransfer });
    cy.wait(2000);

    //Verify class work document tiles are copied correctly
    diagramTile.getTileTitleText().should("contain", newName);

  });
});
