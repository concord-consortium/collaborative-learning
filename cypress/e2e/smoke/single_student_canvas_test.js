import Canvas from '../../support/elements/common/Canvas';
import ClueCanvas from '../../support/elements/common/cCanvas';
import GraphToolTile from '../../support/elements/tile/GraphToolTile';
import ImageToolTile from '../../support/elements/tile/ImageToolTile';
import DrawToolTile from '../../support/elements/tile/DrawToolTile';
import TextToolTile from '../../support/elements/tile/TextToolTile';
import TableToolTile from '../../support/elements/tile/TableToolTile';

let canvas = new Canvas;
let clueCanvas = new ClueCanvas;
let graphToolTile = new GraphToolTile;
let imageToolTile = new ImageToolTile;
let drawToolTile = new DrawToolTile;
let textToolTile = new TextToolTile;
let tableToolTile = new TableToolTile;

const title = "SAS 2.1 Drawing Wumps";

function beforeTest() {
  const queryParams = `${Cypress.config("queryParams")}`;
  cy.clearQAData('all');
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
    cy.get('.list.' + section + ' [data-test=' + section + '-list-items] .footer').should('contain', "My First Learning Log");

    cy.log('verify click on document thumbnail opens document in nav panel');
    cy.openDocumentWithTitle('my-work', 'learning-log', 'My First Learning Log');
    cy.get('.editable-document-content [data-test=canvas]').should('be.visible');
    cy.get('.edit-button.learning-log').should('be.visible');

    cy.log('verify click on Edit button opens document in main workspace');
    cy.get('.edit-button.learning-log').click();
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
    canvas.getPublishIcon().should('exist');
  
    cy.log('test the tool palette');
    //This should test the tools in the tool shelf
    // Tool palettes for Graph, Image, Draw,and Table are tested in respective tool spec test
    //Selection tool is tested as a functionality of graph tool tiles

    cy.log('adds text tool');
    clueCanvas.addTile('text');
    textToolTile.getTextTile().should('exist');
    textToolTile.enterText('This is a smoke test');

    cy.log('adds a graph tool');
    clueCanvas.addTile('geometry');
    graphToolTile.getGraphTile().should('exist');
    graphToolTile.addPointToGraph(0, 0);

    cy.log('adds an image tool');
    clueCanvas.addTile('image');
    imageToolTile.getImageTile().should('exist');

    cy.log('adds a draw tool');
    clueCanvas.addTile('drawing');
    drawToolTile.getDrawTile().should('exist');

    cy.log('adds a table tool');
    clueCanvas.addTile('table');
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
    graphToolTile.getGraphTile().first().should('exist');
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
    cy.get('[data-test=user-name]').then(($el) => {
      const user = $el.text();
      cy.getCanvasItemTitle('workspaces').first().find('.info div').should('contain', user);
    });

    cy.log('verify restore of published canvas');
    cy.openTopTab("class-work");
    cy.openSection("class-work", "workspaces");
    cy.get('[data-test=user-name]').then(($el) => {
      const user = $el.text();
      cy.getCanvasItemTitle('workspaces', user).first().click();
    });
    cy.get(".document-tabs.class-work .documents-panel .canvas-area").find('.text-tool').should('exist').and('contain', 'This is a smoke test');
    cy.get(".document-tabs.class-work .documents-panel .canvas-area").find('.geometry-content').should('exist');
    cy.get(".document-tabs.class-work .documents-panel .canvas-area").find('.drawing-tool').should('exist');
    cy.get(".document-tabs.class-work .documents-panel .canvas-area").find('.image-tool').should('exist');
    cy.get(".document-tabs.class-work .documents-panel .canvas-area").find('.table-tool-tile').should('exist');
  });
});
