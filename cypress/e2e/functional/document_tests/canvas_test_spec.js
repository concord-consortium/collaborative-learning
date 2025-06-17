import ResourcesPanel from '../../../support/elements/common/ResourcesPanel';
import Canvas from '../../../support/elements/common/Canvas';
import ClueCanvas from '../../../support/elements/common/cCanvas';
import GeometryToolTile from '../../../support/elements/tile/GeometryToolTile';
import ImageToolTile from '../../../support/elements/tile/ImageToolTile';
import DrawToolTile from '../../../support/elements/tile/DrawToolTile';
import TextToolTile from '../../../support/elements/tile/TextToolTile';
import TableToolTile from '../../../support/elements/tile/TableToolTile';

let resourcesPanel = new ResourcesPanel;
let canvas = new Canvas;
let clueCanvas = new ClueCanvas;
let geometryToolTile = new GeometryToolTile;
let imageToolTile = new ImageToolTile;
let drawToolTile = new DrawToolTile;
let textToolTile = new TextToolTile;
let tableToolTile = new TableToolTile;

let studentWorkspace = 'My Student Test Workspace';
let copyTitle = 'Personal Workspace Copy';
let renameTitlePencil = "Renamed Title pencil";

const queryParams1 = `${Cypress.config("qaUnitStudent5")}`;
const queryParams2 = `${Cypress.config("qaNoGroupShareUnitStudent5")}`;
const queryParams3 = `${Cypress.config("qaConfigSubtabsUnitStudent5")}`;
const queryParams4 = "?appMode=demo&demoName=BrokenDocs&fakeClass=1&fakeUser=student:1&unit=sas&problem=0.1";

const title = "QA 1.1 Solving a Mystery with Proportional Reasoning";

function beforeTest(params) {
  cy.visit(params);
  cy.waitForLoad();
}

context('Test Canvas', function () {
  //TODO: Tests to add to canvas:
  // 1. reorder
  // 3. drag image from resourcesPanel to canvas
  // 5. drag a tool from tool bar to canvas

  it('test canvas tools', function () {
    beforeTest(queryParams1);
    cy.log('verify investigation header UI');
    canvas.getEditTitleIcon().should('not.exist');
    canvas.getPublishItem().should('be.visible');
    clueCanvas.getShareButton().should('be.visible');
    clueCanvas.getFourUpViewToggle().should('be.visible');
    clueCanvas.openFourUpView();
    clueCanvas.getShareButton().should('be.visible');//should have share in 4 up
    clueCanvas.openOneUpViewFromFourUp();

    cy.log('verify personal workspace header UI');
    canvas.createNewExtraDocumentFromFileMenu(studentWorkspace, "my-work");
    canvas.getEditTitleIcon().should('be.visible');
    canvas.getPublishItem().should('be.visible');
    clueCanvas.getShareButton().should('not.exist');
    clueCanvas.getFourUpViewToggle().should('not.exist');

    cy.log('Test personal workspace canvas');
    cy.log('verify personal workspace does not have section headers');
    clueCanvas.getRowSectionHeader().should('not.exist');

    cy.log('verify tool tiles');
    clueCanvas.addTile('geometry');
    clueCanvas.addTile('table');
    clueCanvas.addTile('text');
    textToolTile.enterText('this is ' + studentWorkspace);
    textToolTile.getTextTile().should('be.visible').and('contain', studentWorkspace);

    cy.log('verify tiles can be selected');
    geometryToolTile.getGeometryTile().should('not.have.class', 'selected');
    geometryToolTile.getGeometryTile().click();
    geometryToolTile.getGeometryTile().should('have.class', 'selected');

    // Selecting a different tile should deselect the previous tile
    tableToolTile.getTableTile().should('not.have.class', 'selected');
    tableToolTile.getTableTile().click();
    tableToolTile.getTableTile().should('have.class', 'selected');
    geometryToolTile.getGeometryTile().should('not.have.class', 'selected');

    // Shift-click allows selection of both tiles
    geometryToolTile.getGeometryTile().click({ shiftKey: true });
    geometryToolTile.getGeometryTile().should('have.class', 'selected');
    tableToolTile.getTableTile().should('have.class', 'selected');

    // Shift-click can also be used to toggle selection off
    geometryToolTile.getGeometryTile().click({ shiftKey: true });
    geometryToolTile.getGeometryTile().should('not.have.class', 'selected');
    tableToolTile.getTableTile().should('have.class', 'selected');

    // Click to select should also work if you click on the drag handle (which is shown on hover)
    geometryToolTile.getGeometryTile().parents('[data-testid="tool-tile"]').trigger('mouseenter');
    geometryToolTile.getGeometryTile().parents('[data-testid="tool-tile"]').trigger('mouseover');
    geometryToolTile.getGeometryTile().parents('[data-testid="tool-tile"]').find('.tool-tile-drag-handle').click();
    geometryToolTile.getGeometryTile().should('have.class', 'selected');
    tableToolTile.getTableTile().should('not.have.class', 'selected');

    cy.log('verify copy of personal workspace');
    canvas.copyDocument(copyTitle);
    canvas.getPersonalDocTitle().should('contain', copyTitle);
    geometryToolTile.getGeometryTile().should('be.visible');
    tableToolTile.getTableTile().should('be.visible');
    textToolTile.getTextTile().should('be.visible').and('contain', studentWorkspace);

    cy.log('verify rename of workspace title with edit icon');
    canvas.editTitlewithPencil(renameTitlePencil);
    canvas.getPersonalDocTitle().should("contain", renameTitlePencil);

    cy.log('verify title change in document thumbnail in nav panel');
    // cy.get(".resources-expander.my-work").click();
    cy.openTopTab("my-work");
    cy.openSection("my-work", "workspaces");
    resourcesPanel.getCanvasItemTitle('my-work', 'workspaces').should('contain', renameTitlePencil);

    cy.log('verify publish document');
    canvas.publishCanvas("personal");
    resourcesPanel.openTopTab('class-work');
    cy.openSection('class-work', "workspaces");
    resourcesPanel.getCanvasItemTitle('class-work', 'workspaces').should('contain', renameTitlePencil);

    let headers = ['IN', 'IC', 'WI', 'NW'];
    let headerTitles = ["Introduction", "Initial Challenge", "What If...?", "Now What Do You Know?"];

    cy.log("Test section headers");
    resourcesPanel.openTopTab("my-work");
    cy.openDocumentWithTitle('my-work', 'workspaces', title);

    cy.log('verify initial canvas load has sections');
    headers.forEach(function (header) {
      clueCanvas.getSectionHeader(header).should('exist');
    });

    cy.log('verifies section header has initials and titles');
    let i = 0;
    for (i = 0; i < headers.length; i++) {
      clueCanvas.getSectionHeader(headers[i]).find('.initials').should('contain', headers[i]);
      clueCanvas.getSectionHeader(headers[i]).find('.title').should('contain', headerTitles[i]);
    }

    cy.log('verifies section headers are not deletable');
    clueCanvas.getRowSectionHeader().each(function ($header) {
      cy.wrap($header).click({ force: true });
      clueCanvas.getDeleteTool().should('have.class', 'disabled').click();
      expect($header).to.exist;
    });

    cy.log('verifies a placeholder tile for every section header');
    let numHeaders = 0;
    clueCanvas.getRowSectionHeader().each(function () {
      numHeaders++;
    }).then(() => {
      clueCanvas.getPlaceHolder().should('have.length', numHeaders);
    });

    cy.log('verifies work area placeholder is not deletable');
    let numHolders = 0;
    clueCanvas.getPlaceHolder().each(function () {
      numHolders++;
    }).then(() => {
      clueCanvas.getPlaceHolder().first().should('exist');
      clueCanvas.getPlaceHolder().first().click({ force: true });
      clueCanvas.getDeleteTool().click();
      clueCanvas.getPlaceHolder().should('have.length', numHolders);
    });

    cy.log('verifies publish of investigation');
    canvas.publishCanvas("investigation");
    resourcesPanel.openTopTab('class-work');
    cy.openSection('class-work', "workspaces");
    resourcesPanel.getCanvasItemTitle('class-work', 'workspaces').should('contain', "Student 5: " + title);

    cy.log('verifies copy of investigation');
    let investigationTitle = 'Investigation Copy';
    canvas.copyDocument(investigationTitle);
    canvas.getPersonalDocTitle().should('contain', investigationTitle);
    resourcesPanel.openTopTab("my-work");
    cy.openSection('my-work', "workspaces");
    resourcesPanel.getCanvasItemTitle('my-work', 'workspaces').should('contain', investigationTitle);

    cy.log('test 4up view');
    cy.openDocumentWithTitle('my-work', 'workspaces', title);

    cy.log('verifies views button changes when clicked and shows the correct corresponding workspace view');
    //1-up view has 4-up button visible and 1-up canvas
    clueCanvas.getFourUpViewToggle().should('be.visible');
    canvas.getSingleCanvas().should('be.visible');
    clueCanvas.getFourUpView().should('not.exist');
    clueCanvas.openFourUpView();
    // toolbar is visible and 4up button is visible
    cy.get('[data-testid="toolbar"]').should('be.visible');
    clueCanvas.getFourUpToolbarButton().should('be.visible');
    //4-up view is visible and 1-up button is visible
    clueCanvas.getFourToOneUpViewToggle().should('be.visible');
    clueCanvas.getNorthEastCanvas().should('be.visible');
    clueCanvas.getNorthWestCanvas().should('be.visible');
    clueCanvas.getSouthEastCanvas().should('be.visible');
    clueCanvas.getSouthEastCanvas().should('be.visible');

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

    cy.log('will drag the center point and verify that canvases resize');
    clueCanvas.openFourUpView();
    cy.get('.four-up .center')
      .trigger('dragstart')
      .trigger('mousemove', 100, 250, { force: true })
      .trigger('drop');
    clueCanvas.openOneUpViewFromFourUp(); //clean up

    cy.log('test the tool palette');
    // This should test the tools in the tool shelf
    // Tool palettes for Geometry, Image, Draw,and Table are tested in respective tool spec test
    // Selection tool is tested as a functionality of geometry tool tiles

    cy.log('adds text tool');
    clueCanvas.addTile('text');
    textToolTile.getTextTile().should('exist');
    textToolTile.enterText('This is the Investigation ' + title);
    clueCanvas.exportTileAndDocument('text-tool-tile');

    cy.log('adds a geometry tool');
    clueCanvas.addTile('geometry');
    geometryToolTile.getGeometryTile().should('exist');
    // clueCanvas.exportTileAndDocument('geometry-tool-tile');
    // in case we created a point while exporting
    // cy.get('.primary-workspace .geometry-toolbar .button.delete').click({ force: true });

    cy.log('Tile can be resized');
    geometryToolTile.getGeometryTile().then(tile => {
      const rect = tile[0].getBoundingClientRect();
      const dragToY = rect.top + rect.height + 100;
      const transfer = new DataTransfer;
      geometryToolTile.getGeometryTile().parent('.tool-tile').find('.tool-tile-resize-handle')
        .trigger('dragstart', { dataTransfer: transfer, force: true }); // The navigator covers a small corner of the resize handle, need to force for Cypress
      geometryToolTile.getGeometryTile().parent('.tool-tile')
        .trigger('dragover', { clientX: rect.left, clientY: dragToY, force: true, dataTransfer: transfer });
      geometryToolTile.getGeometryTile().parent('.tool-tile')
        .trigger('drop', { clientX: rect.left, clientY: dragToY, force: true, dataTransfer: transfer });
      geometryToolTile.getGeometryTile().parent('.tool-tile').find('.tool-tile-resize-handle')
        .trigger('dragend', { clientX: rect.left, clientY: dragToY, force: true, dataTransfer: transfer });
      geometryToolTile.getGeometryTile().invoke('height').should('be.approximately', rect.height + 100, 30);
    });

    cy.log('adds an image tool');
    clueCanvas.addTile('image');
    imageToolTile.getImageTile().should('exist');
    // clueCanvas.exportTileAndDocument('image-tool-tile');

    cy.log('adds a draw tool');
    clueCanvas.addTile('drawing');
    drawToolTile.getDrawTile().should('exist');
    // clueCanvas.exportTileAndDocument('drawing-tool-tile');

    cy.log('adds a table tool');
    clueCanvas.addTile('table');
    tableToolTile.getTableTile().should('exist');
    // clueCanvas.exportTileAndDocument('table-tool-tile');

    cy.log('verifies scrolling');
    geometryToolTile.getGeometryTile().scrollIntoView();
    textToolTile.getTextTile().first().scrollIntoView();

    // TODO:4-up view canvas selector does not work in cypress even though it works in Chrome. it currently selects the entire canvas and not the scaled one
    // cy.log('verifies scrolling in 4up view');
    // canvas.openFourUpView();
    // canvas.scrollToBottom(canvas.getNorthWestCanvas());
    // cy.get('.single-workspace > .document> .canvas-area > .four-up > .canvas-container.north-west >.canvas-scaler >.canvas').scrollTo('bottom');
    // canvas.getGeometryTile().last().should('be.visible');
    // canvas.getSouthWestCanvas().should('be.visible');
    // canvas.openOneUpViewFromFourUp(); //clean up

    cy.log('save and restore of tool tiles');

    cy.log('will restore from My Work/Workspaces tab');
    //Open personal workspace
    resourcesPanel.openTopTab("my-work");
    cy.openDocumentWithTitle('my-work', 'workspaces', studentWorkspace);
    canvas.getPersonalDocTitle().should('contain', studentWorkspace);
    geometryToolTile.getGeometryTile().should('be.visible');
    tableToolTile.getTableTile().should('be.visible');
    textToolTile.getTextTile().should('be.visible').and('contain', studentWorkspace);

    cy.log('will restore from My Work/Investigation tab');
    //Open Investigation
    resourcesPanel.openTopTab("my-work");
    cy.openDocumentWithTitle('my-work', 'workspaces', title);
    clueCanvas.getInvestigationCanvasTitle().should('contain', title);
    textToolTile.getTextTile().should('be.visible').and('contain', title);
    geometryToolTile.getGeometryTile().should('exist');
    drawToolTile.getDrawTile().should('exist');
    imageToolTile.getImageTile().should('exist');
    tableToolTile.getTableTile().should('exist');

    cy.log('verify that if user leaves a canvas in four-up view, restore is also in four up view');
    clueCanvas.openFourUpView();//for later test on restore of 4up view
    clueCanvas.getNorthWestCanvas().should('be.visible');

    cy.log('verify restore in 4 up view from Extra Workspace');
    //Open Personal Workspace
    resourcesPanel.openTopTab("my-work");
    cy.openDocumentWithTitle('my-work', 'workspaces', studentWorkspace);
    canvas.getPersonalDocTitle().should('contain', studentWorkspace);

    cy.log('verify restore in 4 up view from Investigation');
    //Open Investigation should be in 4up view
    resourcesPanel.openTopTab("my-work");
    cy.openDocumentWithTitle('my-work', 'workspaces', title);
    clueCanvas.getInvestigationCanvasTitle().should('contain', title);
    clueCanvas.getNorthWestCanvas().should('be.visible');

    clueCanvas.openOneUpViewFromFourUp();

    cy.log('delete elements from canvas');
    //star a document to verify delete
    cy.openSection("my-work", "workspaces");
    cy.get('.documents-list.workspaces [data-test=workspaces-list-items] .footer').contains(renameTitlePencil).parents().siblings('.icon-holder').find('.icon-star').click();
    cy.openDocumentWithTitle('my-work', 'workspaces', 'QA 1.1 Solving a Mystery with Proportional Reasoning');

    cy.log('will delete elements from canvas');
    // Delete elements in the canvas
    clueCanvas.deleteTile('geometry');
    clueCanvas.deleteTile('image');
    clueCanvas.deleteTile('draw');
    clueCanvas.deleteTile('table');
    clueCanvas.deleteTile('text');
    textToolTile.getTextTile().should('not.exist');
    geometryToolTile.getGeometryTile().should('not.exist');
    drawToolTile.getDrawTile().should('not.exist');
    imageToolTile.getImageTile().should('not.exist');
    tableToolTile.getTableTile().should('not.exist');

    cy.log('Dragging elements from different locations to canvas');
    cy.log('Drag element from left nav');
    const dataTransfer = new DataTransfer;
    cy.log('will drag image from resource panel to canvas');
    resourcesPanel.openTopTab('problems');
    resourcesPanel.openBottomTab("Now What Do You Know?");
    resourcesPanel.getResourcesPanelExpandedSpace().find('.image-tool-tile').first().click();
    resourcesPanel.getResourcesPanelExpandedSpace().find('.image-tool-tile').first().find('.tool-tile-drag-handle')
      .trigger('dragstart', { dataTransfer });
    cy.get('.single-workspace .canvas .document-content').first()
      .trigger('drop', { force: true, dataTransfer });
    resourcesPanel.getResourcesPanelExpandedSpace().find('.image-tool-tile').first().find('.tool-tile-drag-handle')
      .trigger('dragend');
    imageToolTile.getImageTile().should('exist');
    imageToolTile.getImageTile().find('.editable-tile-title-text').contains('Did You Know?: Measurement in police work');
    clueCanvas.deleteTile('image');

    cy.log('will maintain positioning when copying multiple tiles');
    resourcesPanel.openBottomTab("Initial Challenge");
    const leftTile = type => cy.get(`.nav-tab-panel .problem-panel .${type}-tool-tile`);

    // Select three table tiles on the left
    leftTile('table').first().click({ shiftKey: true });
    leftTile('table').eq(1).click({ shiftKey: true });
    leftTile('table').eq(2).click({ shiftKey: true });

    // Drag the selected copies to the workspace on the right
    leftTile('table').eq(2).find('.tool-tile-drag-handle').trigger('dragstart', { dataTransfer });
    cy.get('.single-workspace .canvas .document-content').first()
      .trigger('drop', { force: true, dataTransfer });

    // Make sure the tiles were copied in the correct order
    tableToolTile.getTableTile().first().find('.editable-header-cell').contains('QA Table2');
    tableToolTile.getTableTile().eq(1).find('.editable-header-cell').contains('QA Table1');
    tableToolTile.getTableTile().eq(2).find('.editable-header-cell').contains('QA Table3');

    // Clean up
    clueCanvas.deleteTile('table');
    clueCanvas.deleteTile('table');
    clueCanvas.deleteTile('table');

    cy.log('will copy a single table tile from resources to canvas');
    resourcesPanel.openBottomTab("Initial Challenge");
    // const leftTile = type => cy.get(`.nav-tab-panel .problem-panel .${type}-tool-tile`);

    // Select one table tile on the left
    leftTile('table').first().click();

    // Drag the selected copies to the workspace on the right
    leftTile('table').first().find('.tool-tile-drag-handle').trigger('dragstart', { dataTransfer });
    cy.get('.single-workspace .canvas .document-content').first()
      .trigger('drop', { force: true, dataTransfer });

    // Make sure the tiles were copied in the correct order
    tableToolTile.getTableTile().first().find('.editable-header-cell').contains('QA Table2');

    // Clean up
    clueCanvas.deleteTile('table');

    cy.log('delete workspaces');

    cy.log('verify delete of copy of investigation');
    resourcesPanel.openTopTab("my-work");
    cy.openDocumentWithTitle('my-work', 'workspaces', 'Investigation Copy');
    canvas.deleteDocument();
    resourcesPanel.openTopTab("my-work");
    cy.openSection("my-work", "workspaces");
    resourcesPanel.getCanvasItemTitle("my-work", "workspaces").contains('Investigation Copy').should('not.exist');

    cy.log('verify original investigation canvas still exist after copy delete');
    resourcesPanel.getCanvasItemTitle("my-work", "workspaces").contains('Proportional Reasoning').should('be.visible');

    cy.log('verify that original personal workspace is not deleted when copy is deleted');
    resourcesPanel.openTopTab("my-work");
    cy.openDocumentWithTitle('my-work', 'workspaces', renameTitlePencil);
    canvas.deleteDocument();
    resourcesPanel.openTopTab("my-work");
    cy.openSection("my-work", "workspaces");
    resourcesPanel.getCanvasItemTitle("my-work", "workspaces").contains(renameTitlePencil).should('not.exist');

    cy.log('verify delete of personal workspace');
    resourcesPanel.openTopTab("my-work");
    cy.openDocumentWithTitle('my-work', 'workspaces', studentWorkspace);
    canvas.deleteDocument();
    resourcesPanel.openTopTab("my-work");
    cy.openSection("my-work", "workspaces");
    resourcesPanel.getCanvasItemTitle("my-work", "workspaces").contains(studentWorkspace).should('not.exist');

    cy.log('verify starred document is no longer in the Starred section after delete');
    cy.openSection('my-work', 'bookmarks');
    cy.getCanvasItemTitle('my-work', 'bookmarks').should('not.exist');

    cy.log("Canvas unit config test");
    beforeTest(queryParams2);

    cy.log("verify group section in header is not visible when unit is configured to auto assign students to groups");
    cy.get(".app-header .right .group").should("not.exist");

    cy.log("verify publish button is not visible when publish is disabled");
    cy.get(".icon-button.icon-publish").should("not.exist");

    cy.log("Share button visible on personal docs, only when sort-work tab is visible");
    beforeTest(queryParams3);
    canvas.createNewExtraDocumentFromFileMenu(studentWorkspace, "my-work");
    canvas.getEditTitleIcon().should('be.visible');
    clueCanvas.getShareButton().should('be.visible');

    // This is using an intentionally broken document.
    // Info about this document can be found here: src/test-fixtures/broken-doc-content.md
    cy.log("Canvas document error test");
    beforeTest(queryParams4);

    cy.log("verify an error message is shown");
    cy.get('[data-test="document-title"]').should("contain", "0.1 Intro to CLUE");
    cy.get(".document-error").should("exist");
  });
});
