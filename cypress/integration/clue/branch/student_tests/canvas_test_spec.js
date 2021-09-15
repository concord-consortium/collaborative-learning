import ResourcesPanel from '../../../../support/elements/clue/ResourcesPanel';
import Canvas from '../../../../support/elements/common/Canvas';
import ClueCanvas from '../../../../support/elements/clue/cCanvas';
import PrimaryWorkspace from '../../../../support/elements/common/PrimaryWorkspace';
import GraphToolTile from '../../../../support/elements/clue/GraphToolTile';
import ImageToolTile from '../../../../support/elements/clue/ImageToolTile';
import DrawToolTile from '../../../../support/elements/clue/DrawToolTile';
import TextToolTile from '../../../../support/elements/clue/TextToolTile';
import TableToolTile from '../../../../support/elements/clue/TableToolTile';

let resourcesPanel = new ResourcesPanel;
let canvas = new Canvas;
let clueCanvas = new ClueCanvas;
let primaryWorkspace = new PrimaryWorkspace;
let graphToolTile = new GraphToolTile;
let imageToolTile = new ImageToolTile;
let drawToolTile = new DrawToolTile;
let textToolTile = new TextToolTile;
let tableToolTile = new TableToolTile;

let studentWorkspace = 'My Student Test Workspace';
let copyTitle = 'Personal Workspace Copy';
// let newDocTitleToPublish = 'New User Doc To Publish';
// let renameTitle = "Renamed Title title";
let renameTitlePencil = "Renamed Title pencil";


context('Test Canvas', function () {
  //TODO: Tests to add to canvas:
  // 1. reorder
  // 3. drag image from resourcesPanel to canvas
  // 5. drag a tool from tool bar to canvas
  before(function () {
    const baseUrl = `${Cypress.config("baseUrl")}`;
    const queryParams = `${Cypress.config("queryParams")}`;
    cy.clearQAData('all');

    cy.visit(baseUrl + queryParams);
    cy.waitForSpinner();
    clueCanvas.getInvestigationCanvasTitle().text().as('title');
  });

  context('test canvas tools', function () {
    describe('test header elements', function () {
      it('verify investigation header UI', () => { // element functionality are tested in common
        canvas.getEditTitleIcon().should('not.exist');
        canvas.getPublishIcon().should('be.visible');
        clueCanvas.getShareButton().should('be.visible');
        clueCanvas.getFourUpViewToggle().should('be.visible');
        clueCanvas.openFourUpView();
        clueCanvas.getShareButton().should('be.visible');//should have share in 4 up
        clueCanvas.openOneUpViewFromFourUp();
      });
      it('verify personal workspace header UI', () => { //other header elements are tested in common
        canvas.createNewExtraDocumentFromFileMenu(studentWorkspace, "my-work");
        canvas.getEditTitleIcon().should('be.visible');
        canvas.getPersonalPublishIcon().should('be.visible');
        clueCanvas.getShareButton().should('not.exist');
        clueCanvas.getFourUpViewToggle().should('not.exist');
      });
    });
    describe('Test personal workspace canvas', function () {
      it('verify personal workspace does not have section headers', function () {
        clueCanvas.getRowSectionHeader().should('not.exist');
      });
      it('verify tool tiles', function () { //to be used for save and restore test
        clueCanvas.addTile('geometry');
        clueCanvas.addTile('table');
        clueCanvas.addTile('text');
        textToolTile.enterText('this is ' + studentWorkspace);
        textToolTile.getTextTile().should('be.visible').and('contain', studentWorkspace);
      });
      it('verify copy of personal workspace', function () {
        canvas.copyDocument(copyTitle);
        canvas.getPersonalDocTitle().should('contain', copyTitle);
        graphToolTile.getGraphTile().should('be.visible');
        tableToolTile.getTableTile().should('be.visible');
        textToolTile.getTextTile().should('be.visible').and('contain', studentWorkspace);
      });
      it('verify rename of workspace title with edit icon', function () {
        canvas.editTitlewithPencil(renameTitlePencil);
        canvas.getPersonalDocTitle().should("contain", renameTitlePencil);
      });
      it('verify title change in document thumbnail in nav panel', function () {
        cy.get(".collapsed-resources-tab.my-work").click();
        resourcesPanel.getCanvasItemTitle('my-work', 'workspaces').should('contain', renameTitlePencil);
      });
      it('verify publish document', function () {
        canvas.publishCanvas("personal");
        resourcesPanel.openTopTab('class-work');
        cy.openSection('class-work', "extra-workspaces");
        resourcesPanel.getCanvasItemTitle('class-work', 'extra-workspaces').should('contain', renameTitlePencil);
      });
    });

    describe('Test section headers', function () {
      let headers = ['IN', 'IC', 'WI', 'NW'];
      let headerTitles = ["Introduction", "Initial Challenge", "What If...?", "Now What Do You Know?"];
      before(function () {
        resourcesPanel.openTopTab("my-work");
        cy.openDocumentWithTitle('my-work', 'workspaces', this.title);
      });
      it('verify initial canvas load has sections', function () {
        headers.forEach(function (header) {
          clueCanvas.getSectionHeader(header).should('exist');
        });
      });
      it('verifies section header has initials and titles', function () {
        let i = 0;
        for (i = 0; i < headers.length; i++) {
          clueCanvas.getSectionHeader(headers[i]).find('.initials').should('contain', headers[i]);
          clueCanvas.getSectionHeader(headers[i]).find('.title').should('contain', headerTitles[i]);
        }
      });
      it('verifies section headers are not deletable', function () {
        clueCanvas.getRowSectionHeader().each(function ($header) {
          cy.wrap($header).click({ force: true });
          clueCanvas.getDeleteTool().should('have.class', 'disabled').click();
          expect($header).to.exist;
        });
      });
      it('verifies a placeholder tile for every section header', function () {
        let numHeaders = 0;
        clueCanvas.getRowSectionHeader().each(function () {
          numHeaders++;
        }).then(() => {
          clueCanvas.getPlaceHolder().should('have.length', numHeaders);
        });
      });
      it('verifies work area placeholder is not deletable', function () {
        let numHolders = 0;
        clueCanvas.getPlaceHolder().each(function () {
          numHolders++;
        }).then(() => {
          clueCanvas.getPlaceHolder().first().should('exist');
          clueCanvas.getPlaceHolder().first().click({ force: true });
          clueCanvas.getDeleteTool().click();
          clueCanvas.getPlaceHolder().should('have.length', numHolders);
        });
      });
      it('verifies work area placeholder is not draggable', function () {
        //TODO: not sure how to test this yet
      });
      it('verifies publish of investigation', function () {
        canvas.publishCanvas("investigation");
        resourcesPanel.openTopTab('class-work');
        cy.openSection('class-work', "problem-workspaces");
        resourcesPanel.getCanvasItemTitle('class-work', 'problem-workspaces').should('contain', "Student 5: "+this.title);
      });
      it('verifies copy of investigation', function () {
        let investigationTitle = 'Investigation Copy';
        canvas.copyDocument(investigationTitle);
        canvas.getPersonalDocTitle().should('contain', investigationTitle);
        resourcesPanel.openTopTab("my-work");
        cy.openSection('my-work', "workspaces");
        resourcesPanel.getCanvasItemTitle('my-work', 'workspaces').should('contain', investigationTitle);
      });
    });
    describe('Test 4up view', function () {
      before(function () {
        cy.openDocumentWithTitle('my-work','workspaces', this.title);
      });
      it('verifies views button changes when clicked and shows the correct corresponding workspace view', function () {
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

        //can get back to 1 up view from 4 up
        clueCanvas.openOneUpViewFromFourUp();
        canvas.getSingleCanvas().should('be.visible');
        clueCanvas.getFourUpViewToggle().should('be.visible');
        clueCanvas.getFourUpView().should('not.exist');
      });

      it('verify share button', function () {
        clueCanvas.getShareButton().should('be.visible');
        clueCanvas.getShareButton().should('have.class', 'private');
        clueCanvas.shareCanvas();
        clueCanvas.getShareButton().should('be.visible');
        clueCanvas.getShareButton().should('have.class', 'public');
        clueCanvas.unshareCanvas();
        clueCanvas.getShareButton().should('be.visible');
        clueCanvas.getShareButton().should('have.class', 'private');
      });
    });

    describe('Test 4-up view', function () {
      it('will drag the center point and verify that canvases resize', function () {
        clueCanvas.openFourUpView();
        cy.get('.four-up .center')
          .trigger('dragstart')
          .trigger('mousemove', 100, 250, { force: true })
          .trigger('drop');
        clueCanvas.openOneUpViewFromFourUp(); //clean up
      });
    });

    describe('Test the tool palette', function () {//This should test the tools in the tool shelf
      // Tool palettes for Graph, Image, Draw,and Table are tested in respective tool spec test
      //Selection tool is tested as a functionality of graph tool tiles

      it('adds text tool', function () {
        clueCanvas.addTile('text');
        textToolTile.getTextTile().should('exist');
        textToolTile.enterText('This is the Investigation ' + this.title);
        clueCanvas.exportTileAndDocument('text-tool-tile');
      });
      it('adds a graph tool', function () {
        clueCanvas.addTile('geometry');
        graphToolTile.getGraphTile().should('exist');
        clueCanvas.exportTileAndDocument('geometry-tool-tile');
        // in case we created a point while exporting
        cy.get('.primary-workspace .geometry-toolbar .button.delete').click({ force: true});
      });
      it('adds an image tool', function () {
        clueCanvas.addTile('image');
        imageToolTile.getImageTile().should('exist');
        clueCanvas.exportTileAndDocument('image-tool-tile');
      });
      it('adds a draw tool', function () {
        clueCanvas.addTile('drawing');
        drawToolTile.getDrawTile().should('exist');
        clueCanvas.exportTileAndDocument('drawing-tool-tile');
      });
      it('adds a table tool', function () {
        clueCanvas.addTile('table');
        tableToolTile.getTableTile().should('exist');
        clueCanvas.exportTileAndDocument('table-tool-tile');
      });
      it('verifies scrolling', function () {
        graphToolTile.getGraphTile().scrollIntoView();
        textToolTile.getTextTile().first().scrollIntoView();
      });
      // TODO:4-up view canvas selector does not work in cypress even though it works in Chrome. it currently selects the entire canvas and not the scaled one
      // it('verifies scrolling in 4up view', function(){
      //      canvas.openFourUpView();
      //      canvas.scrollToBottom(canvas.getNorthWestCanvas());
      //     // cy.get('.single-workspace > .document> .canvas-area > .four-up > .canvas-container.north-west >.canvas-scaler >.canvas').scrollTo('bottom');
      //     canvas.getGraphTile().last().should('be.visible');
      //     canvas.getSouthWestCanvas().should('be.visible');
      //     canvas.openOneUpViewFromFourUp(); //clean up
      //
      // });
    });

    describe('save and restore of tool tiles', function () {
      describe('verify that tool tiles is saved from various locations', function () {
        it('will restore from My Work/Workspaces tab', function () {
          //Open personal workspace
          resourcesPanel.openTopTab("my-work");
          cy.openDocumentWithTitle('my-work','workspaces', studentWorkspace);
          canvas.getPersonalDocTitle().should('contain', studentWorkspace);
          graphToolTile.getGraphTile().should('be.visible');
          tableToolTile.getTableTile().should('be.visible');
          textToolTile.getTextTile().should('be.visible').and('contain', studentWorkspace);
        });
        it('will restore from My Work/Investigation tab', function () {
          //Open Investigation
          resourcesPanel.openTopTab("my-work");
          cy.openDocumentWithTitle('my-work','workspaces', this.title);
          clueCanvas.getInvestigationCanvasTitle().should('contain', this.title);
          textToolTile.getTextTile().should('be.visible').and('contain', this.title);
          graphToolTile.getGraphTile().should('exist');
          drawToolTile.getDrawTile().should('exist');
          imageToolTile.getImageTile().should('exist');
          tableToolTile.getTableTile().should('exist');
        });
      });

      describe('verify that if user leaves a canvas in four-up view, restore is also in four up view', function () {
        before(() => {
          clueCanvas.openFourUpView();//for later test on restore of 4up view
          clueCanvas.getNorthWestCanvas().should('be.visible');
        });
        it('verify restore in 4 up view from Extra Workspace', function () {
          //Open Personal Workspace
          resourcesPanel.openTopTab("my-work");
          cy.openDocumentWithTitle('my-work','workspaces', studentWorkspace);
          canvas.getPersonalDocTitle().should('contain', studentWorkspace);
        });
        it('verify restore in 4 up view from Investigation', function () {
          //Open Investigation should be in 4up view
          resourcesPanel.openTopTab("my-work");
          cy.openDocumentWithTitle('my-work','workspaces', this.title);
          clueCanvas.getInvestigationCanvasTitle().should('contain', this.title);
          clueCanvas.getNorthWestCanvas().should('be.visible');
        });
        after(() => { //restore to 1up view
          // primaryWorkspace.closePrimaryWorkspaceTab('my-work');
          clueCanvas.openOneUpViewFromFourUp();
        });
      });
    });
  });

  context('Drag and drop clue canvas tiles', () => {
    it('Drags and drops a tile', () => {
      // TO DO
      //clueCanvas.moveTile(movingTile, targetTile, direction)
    });
  });

  context.skip('Dragging elements from different locations to canvas', function () {
    describe('Drag element from left nav', function () {
      const dataTransfer = new DataTransfer;
      // TODO: Unable to get elements
      it('will drag an image from left nav to canvas', () => {
        resourcesPanel.openResourcesPanel('Introduction');
        resourcesPanel.getResourcesPanelExpandedSpace().find('.image-tool').first()
          .trigger('dragstart', { dataTransfer });
        cy.get('.single-workspace .canvas .document-content').first()
          .trigger('drop', { force: true, dataTransfer });
        resourcesPanel.getResourcesPanelExpandedSpace().find('.image-tool').first()
          .trigger('dragend');
        resourcesPanel.closeResourcesPanel('Introduction');
        imageToolTile.getImageTile().first().should('exist');
      });
    });
    //TODO add a test for dragging rightside canvas to the left side workspace

  });

  context('delete elements from canvas', function () {
    before(() => {
      //star a document to verify delete
      cy.openSection("my-work", "workspaces");
      cy.get('.list.workspaces [data-test=workspaces-list-items] .footer').contains(renameTitlePencil).parents().siblings('.icon-holder').find('.icon-star').click();
      cy.openDocumentWithTitle('my-work', 'workspaces', 'SAS 2.1 Drawing Wumps');
    });
    it('will delete elements from canvas', function () {
      // //Delete elements in the canvas
      clueCanvas.deleteTile('graph');
      clueCanvas.deleteTile('image');
      clueCanvas.deleteTile('draw');
      clueCanvas.deleteTile('table');
      clueCanvas.deleteTile('text');
      clueCanvas.deleteTile('text');
      textToolTile.getTextTile().should('not.exist');
      graphToolTile.getGraphTile().should('not.exist');
      drawToolTile.getDrawTile().should('not.exist');
      imageToolTile.getImageTile().should('not.exist');
      tableToolTile.getTableTile().should('not.exist');
    });
  });

  context('delete workspaces', function () {
    it('verify delete of copy of investigation', function () {
      resourcesPanel.openTopTab("my-work");
      cy.openDocumentWithTitle('my-work','workspaces', 'Investigation Copy');
      canvas.deleteDocument();
      resourcesPanel.openTopTab("my-work");
      cy.openSection("my-work", "workspaces");
      resourcesPanel.getCanvasItemTitle("my-work","workspaces").contains('Investigation Copy').should('not.exist');
    });
    it('verify original investigation canvas still exist after copy delete', function () {
      resourcesPanel.getCanvasItemTitle("my-work","workspaces").contains('Drawing Wumps').should('be.visible');
    });
    it('verify that original personal workspace is not deleted when copy is deleted', function () {
      resourcesPanel.openTopTab("my-work");
      cy.openDocumentWithTitle('my-work', 'workspaces', renameTitlePencil);
      canvas.deleteDocument();
      resourcesPanel.openTopTab("my-work");
      cy.openSection("my-work", "workspaces");
      resourcesPanel.getCanvasItemTitle("my-work","workspaces").contains(renameTitlePencil).should('not.exist');

    });
    it('verify delete of personal workspace', function () {
      resourcesPanel.openTopTab("my-work");
      cy.openDocumentWithTitle('my-work', 'workspaces', studentWorkspace);
      canvas.deleteDocument();
      resourcesPanel.openTopTab("my-work");
      cy.openSection("my-work", "workspaces");
      resourcesPanel.getCanvasItemTitle("my-work","workspaces").contains(studentWorkspace).should('not.exist');
    });
    it('verify starred document is no longer in the Starred section after delete', function () {
      cy.openSection('my-work', 'starred');
      cy.getCanvasItemTitle('my-work', 'starred').should('not.exist');
    });
  });
});

after(function () {
  cy.clearQAData('all');
});
