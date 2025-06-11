import Canvas from '../../support/elements/common/Canvas';
import ClueCanvas from '../../support/elements/common/cCanvas';
import GeometryToolTile from '../../support/elements/tile/GeometryToolTile';
import ImageToolTile from '../../support/elements/tile/ImageToolTile';
import DrawToolTile from '../../support/elements/tile/DrawToolTile';
import TextToolTile from '../../support/elements/tile/TextToolTile';
import TableToolTile from '../../support/elements/tile/TableToolTile';
import QuestionToolTile from '../../support/elements/tile/QuestionToolTile';
import Dialog from '../../support/elements/common/Dialog';
import ArrowAnnotation from '../../support/elements/tile/ArrowAnnotation';
import DataCardToolTile from '../../support/elements/tile/DataCardToolTile';
import DataflowToolTile from '../../support/elements/tile/DataflowToolTile';
import DiagramToolTile from '../../support/elements/tile/DiagramToolTile';
import SimulatorTile from '../../support/elements/tile/SimulatorTile';
import NumberlineToolTile from '../../support/elements/tile/NumberlineToolTile';
import ExpressionToolTile from '../../support/elements/tile/ExpressionToolTile';
import XYPlotToolTile from '../../support/elements/tile/XYPlotToolTile';
import BarGraphTile from '../../support/elements/tile/BarGraphTile';

let canvas = new Canvas;
let clueCanvas = new ClueCanvas;
let geometryToolTile = new GeometryToolTile;
let imageToolTile = new ImageToolTile;
let drawToolTile = new DrawToolTile;
let textToolTile = new TextToolTile;
let tableToolTile = new TableToolTile;
let questionToolTile = new QuestionToolTile;
const dialog = new Dialog();
const arrowAnnotation = new ArrowAnnotation();
const dataCardToolTile = new DataCardToolTile();
const dataflowToolTile = new DataflowToolTile();
const diagramToolTile = new DiagramToolTile();
const simulatorTile = new SimulatorTile();
const numberlineToolTile = new NumberlineToolTile();
const expressionToolTile = new ExpressionToolTile();
const xyPlotToolTile = new XYPlotToolTile();
const barGraphTile = new BarGraphTile();

const title = "QA 1.1 Solving a Mystery with Proportional Reasoning";

function beforeTest() {
  const queryParams = `${Cypress.config("qaUnitStudent5")}`;
  cy.visit(queryParams);
  cy.waitForLoad();
}
context('single student functional test', () => {
  it('Nav tabs open and close', () => {
    beforeTest();
    cy.log('will verify that clicking on any tab opens the nav area');
    // cy.get(".resources-expander.my-work").click();
    cy.openTopTab("my-work");
    cy.openSection('my-work', "workspaces");
    cy.get('[data-test=my-work-section-investigations-documents]').should('be.visible');

    cy.log('will verify clicking on subtab opens panel to subtab section');
    const section = "learning-log";
    cy.openSection('my-work', section);
    cy.get('[data-test=subtab-learning-log]').should('be.visible');
    cy.get('.documents-list.' + section + ' [data-test=' + section + '-list-items] .footer').should('contain', "My First Learning Log");

    cy.log('verify click on document thumbnail opens document in nav panel');
    cy.openDocumentWithTitle('my-work', 'learning-log', 'My First Learning Log');
    cy.get('.editable-document-content [data-test=canvas]').should('be.visible');
    cy.get('.document-header.learning-log').should('be.visible');

    cy.log('verify click on Edit button opens document in main workspace');
    cy.get('.toolbar .tool.edit').click();
    cy.get('.primary-workspace [data-test=learning-log-title]').should('contain', "Learning Log: My First Learning Log");

    cy.log('verify close of nav tabs');
    cy.collapseResourceTabs();
    cy.get('.nav-tab-panel').should('not.be.visible');

    cy.log('test header elements');
    cy.openResourceTabs();
    cy.openTopTab('my-work');
    cy.openDocumentWithTitle("my-work", "workspaces", title);

    cy.log('verifies views button changes when clicked and shows the correct corresponding workspace view');
    //1-up view has 4-up button visible and 1-up canvas
    clueCanvas.getFourUpViewToggle().should('be.visible');
    canvas.getSingleCanvas().should('be.visible');
    clueCanvas.getFourUpView().should('not.exist');
    clueCanvas.openFourUpView();
    //4-up view is visible and 1-up button is visible
    clueCanvas.getFourToOneUpViewToggle().should('be.visible');
    clueCanvas.getNorthEastCanvas().should('be.visible');
    clueCanvas.getNorthWestCanvas().should('be.visible');
    clueCanvas.getSouthEastCanvas().should('be.visible');
    clueCanvas.getSouthEastCanvas().should('be.visible');
    // canvas.getSingleCanvas().should('not.be.visible');

    //can get back to 1 up view from 4 up
    clueCanvas.openOneUpViewFromFourUp();
    canvas.getSingleCanvas().should('be.visible');
    clueCanvas.getFourUpViewToggle().should('be.visible');
    clueCanvas.getFourUpView().should('not.exist');

    cy.log('verify share button');
    clueCanvas.getShareButton().should('be.visible');
    clueCanvas.getShareButton().should('have.class', 'private');
    clueCanvas.shareCanvas();
    clueCanvas.getShareButton().should('be.visible');
    clueCanvas.getShareButton().should('have.class', 'public');
    clueCanvas.unshareCanvas();
    clueCanvas.getShareButton().should('be.visible');
    clueCanvas.getShareButton().should('have.class', 'private');

    cy.log('verify publish button');
    canvas.publishCanvas("investigation");
    canvas.getPublishItem().should('exist');

    cy.log('test the tool palette');
    // This should test the tools in the tool shelf
    // Tool palettes for Geometry, Image, Draw,and Table are tested in respective tool spec test
    // Selection tool is tested as a functionality of geometry tool tiles

    cy.log('adds a question tile');
    clueCanvas.addTile('question');
    questionToolTile.getQuestionTile().should('exist');
    // Test undo/redo for question tile
    clueCanvas.getUndoTool().click();
    questionToolTile.getQuestionTile().should('not.exist');
    clueCanvas.getRedoTool().click();
    questionToolTile.getQuestionTile().should('exist');

    cy.log('adds text tool');
    clueCanvas.addTile('text');
    textToolTile.getTextTile().should('exist');
    // Add some text to make it distinct from question tile
    textToolTile.enterText('This is a smoke test');
    textToolTile.getTextEditor().should('contain', 'This is a smoke test');

    cy.log('adds a geometry tool');
    clueCanvas.addTile('geometry');
    geometryToolTile.getGeometryTile().should('exist');
    geometryToolTile.clickGraphPosition(0, 0);
    // Test undo/redo for geometry tile
    clueCanvas.getUndoTool().click();
    geometryToolTile.getGeometryTile().should('not.exist');
    clueCanvas.getRedoTool().click();
    geometryToolTile.getGeometryTile().should('exist');

    cy.log('adds an image tool');
    clueCanvas.addTile('image');
    imageToolTile.getImageTile().should('exist');
    // Test undo/redo for image tile
    clueCanvas.getUndoTool().click();
    imageToolTile.getImageTile().should('not.exist');
    clueCanvas.getRedoTool().click();
    imageToolTile.getImageTile().should('exist');

    cy.log('adds a draw tool');
    clueCanvas.addTile('drawing');
    drawToolTile.getDrawTile().should('exist');
    // Test undo/redo for draw tile
    clueCanvas.getUndoTool().click();
    drawToolTile.getDrawTile().should('not.exist');
    clueCanvas.getRedoTool().click();
    drawToolTile.getDrawTile().should('exist');

    cy.log('adds a table tool');
    clueCanvas.addTile('table');
    tableToolTile.getTableTile().should('exist');
    // Test undo/redo for table tile
    clueCanvas.getUndoTool().click();
    tableToolTile.getTableTile().should('not.exist');
    clueCanvas.getRedoTool().click();
    tableToolTile.getTableTile().should('exist');

    cy.log('save and restore of canvas');
    // let canvas1='Document 1';
    let canvas2 = 'Document 2';

    // canvas.copyDocument(canvas1);
    canvas.createNewExtraDocumentFromFileMenu(canvas2, "my-work");
    canvas.getPersonalDocTitle().should('contain', canvas2);
    textToolTile.getTextTile().should('not.exist');

    cy.log('will restore from My Work tab');
    // //open the my work tab, click a different canvas, verify canvas is shown, open the my work tab, click the introduction canvas, verify intro canvas is showing
    cy.openTopTab('my-work');
    cy.openSection('my-work', 'workspaces');
    cy.openDocumentWithTitle('my-work', 'workspaces', title);
    textToolTile.getTextTile().should('exist');
    geometryToolTile.getGeometryTile().first().should('exist');
    drawToolTile.getDrawTile().should('exist');
    imageToolTile.getImageTile().should('exist');
    tableToolTile.getTableTile().should('exist');

    cy.log('verify published canvas thumbnail');
    cy.openTopTab('class-work');
    cy.openSection('class-work', 'workspaces');
    cy.getCanvasItemTitle('workspaces').should('have.length', 1);

    cy.log('verify publish canvas thumbnail appears in Class Work Published List');
    canvas.publishCanvas("investigation");
    cy.openTopTab('class-work');
    cy.openSection('class-work', 'workspaces');
    cy.getCanvasItemTitle('workspaces').should('have.length', 2);
    cy.getCanvasItemTitle('workspaces').first().should('contain', 'v2');

    cy.log('verify student name appears under thumbnail');
    cy.get('[data-test=user-title-prefix]').then(($el) => {
      const user = $el.text();
      cy.getCanvasItemTitle('workspaces').first().find('.info div').should('contain', user);
    });

    cy.log('verify restore of published canvas');
    cy.openTopTab("class-work");
    cy.openSection("class-work", "workspaces");
    cy.get('[data-test=user-title-prefix]').then(($el) => {
      const user = $el.text();
      cy.getCanvasItemTitle('workspaces', user).first().click();
    });
    cy.get(".document-tabs.class-work .documents-panel .canvas-area").find('.text-tool').should('exist').and('contain', 'This is a smoke test');
    cy.get(".document-tabs.class-work .documents-panel .canvas-area").find('.geometry-content').should('exist');
    cy.get(".document-tabs.class-work .documents-panel .canvas-area").find('.drawing-tool').should('exist');
    cy.get(".document-tabs.class-work .documents-panel .canvas-area").find('.image-tool').should('exist');
    cy.get(".document-tabs.class-work .documents-panel .canvas-area").find('.table-tool-tile').should('exist');
  });

  it('can copy all tiles into workspace and other documents using toolbar helpers', () => {
    beforeTest();

    const sourceDoc = "Source Document";
    const targetDoc = "Target Document";

    // Create the target document
    canvas.createNewExtraDocumentFromFileMenu(targetDoc, "my-work");

    // Create the source document and add a tile
    canvas.createNewExtraDocumentFromFileMenu(sourceDoc, "my-work");
    canvas.openDocumentWithTitle('workspaces', sourceDoc);

    // Select all tiles using the helper
    canvas.getSelectAllButton().click();
    canvas.verifyAllTilesSelected();

    // Use the Copy to Workspace button (helper)
    canvas.getCopyToWorkspaceButton().click();

    canvas.getSelectAllButton().click();
    canvas.getCopyToDocumentButton().click();

      // Using force: true because the select element may be temporarily covered by other UI elements
    // during the dialog animation, causing Cypress to fail to interact with it
    cy.get('.dialog-input select').select('Target Document', { force: true });
    dialog.getDialogOKButton().click();

    // Check for expected text in the copied tiles
    cy.get('.primary-workspace [data-testid="ccrte-editor"]')
    .should('contain.text', 'The Mystery Club at P.I. Middle School');


    // Open the target document using the helper
    canvas.openDocumentWithTitle('workspaces', targetDoc);

    // Check for expected text in the copied document
    cy.get('.primary-workspace [data-testid="ccrte-editor"]')
      .should('contain.text', 'The Mystery Club at P.I. Middle School');

    // Optionally, check the number of text tiles (adjust the expected count as needed)
    textToolTile.getTextTile().should('have.length.at.least', 1);
  });

  it('verifies old document compatibility by loading test document', () => {
    // Set up console error monitoring
    const consoleErrors = [];
    cy.on('log:added', (log) => {
      if (log.displayName === 'error' || log.displayName === 'console') {
        consoleErrors.push(log.message);
      }
    });

    cy.log('loads test document with all tile types and verifies components');
    cy.visit("/editor/?appMode=qa&unit=./demo/units/qa/content.json&document=./demo/docs/old-format-test-document.json");

    // Verify no critical errors in console
    cy.wrap(null).then(() => {
      const criticalErrors = consoleErrors.filter(error =>
        error.includes('mobx') ||
        error.includes('TypeError') ||
        error.includes('ReferenceError') ||
        error.includes('Uncaught')
      );
      expect(criticalErrors, 'No critical console errors should be present').to.be.empty;
    });

    // Verify all tile types are present using helper functions
    textToolTile.getTextTile().should('exist');
    tableToolTile.getTableTile().should('exist');
    drawToolTile.getDrawTile().should('exist');
    imageToolTile.getImageTile().should('exist');
    geometryToolTile.getGeometryTile().should('exist');
    questionToolTile.getQuestionTile().should('exist');
    dataCardToolTile.getTile().should('exist');
    dataflowToolTile.getDataflowTile().should('exist');
    diagramToolTile.getDiagramTile().should('exist');
    simulatorTile.getSimulatorTile().should('exist');
    numberlineToolTile.getNumberlineTile().should('exist');
    expressionToolTile.getExpressionTile().should('exist');
    xyPlotToolTile.getTile().should('exist');
    barGraphTile.getTile().should('exist');

    // Verify sparrows using ArrowAnnotation helper
    arrowAnnotation.getAnnotationSparrowGroups().should('exist');
  });
});
