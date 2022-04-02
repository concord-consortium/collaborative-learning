import Canvas from '../../../support/elements/common/Canvas';
import ClueCanvas from '../../../support/elements/clue/cCanvas';
import GraphToolTile from '../../../support/elements/clue/GraphToolTile';
import ImageToolTile from '../../../support/elements/clue/ImageToolTile';
import DrawToolTile from '../../../support/elements/clue/DrawToolTile';
import TextToolTile from '../../../support/elements/clue/TextToolTile';
import TableToolTile from '../../../support/elements/clue/TableToolTile';

let canvas = new Canvas;
let clueCanvas = new ClueCanvas;
let graphToolTile = new GraphToolTile;
let imageToolTile = new ImageToolTile;
let drawToolTile = new DrawToolTile;
let textToolTile = new TextToolTile;
let tableToolTile = new TableToolTile;

context('single student functional test',()=>{
    before(function(){
            const queryParams = `${Cypress.config("queryParams")}`;
            cy.clearQAData('all');
            cy.visit(queryParams);
            cy.waitForLoad();
            // cy.wait(4000);
        clueCanvas.getInvestigationCanvasTitle().text().as('title');
    });
    describe('Nav tabs open and close',()=>{
      it('will verify that clicking on any tab opens the nav area', function () {
        cy.get(".collapsed-resources-tab.my-work").click();
        cy.get('[data-test=my-work-section-investigations-documents]').should('be.visible');
      });
      it('will verify clicking on subtab opens panel to subtab section', function () {
        const section = "learning-log";
        cy.openSection('my-work', section);
        cy.get('[data-test=subtab-learning-log]').should('be.visible');
        cy.get('.list.'+section+' [data-test='+section+'-list-items] .footer').should('contain', "My First Learning Log");
      });
      it('verify click on document thumbnail opens document in nav panel', function () {
        cy.openDocumentWithTitle('my-work', 'learning-log','My First Learning Log');
        cy.get('.editable-document-content [data-test=canvas]').should('be.visible');
        cy.get('.edit-button.learning-log').should('be.visible');
      });
      it('verify click on Edit button opens document in main workspace', function () {
        cy.get('.edit-button.learning-log').click();
        cy.get('.primary-workspace [data-test=learning-log-title]').should('contain', "Learning Log: My First Learning Log");
      });
      it('verify close of nav tabs', function () {
        cy.closeTabs();
        cy.get('.nav-tab-panel').should('not.be.visible');
      });
    });

    describe('test header elements', function(){
      before(function(){
        cy.openResourceTabs();
        cy.openTopTab('my-work');
        cy.openDocumentWithTitle("my-work", "workspaces", this.title);
      });
        it('verifies views button changes when clicked and shows the correct corresponding workspace view', function(){
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
        });

        it('verify share button', function(){
            clueCanvas.getShareButton().should('be.visible');
            clueCanvas.getShareButton().should('have.class','private');
            clueCanvas.shareCanvas();
            clueCanvas.getShareButton().should('be.visible');
            clueCanvas.getShareButton().should('have.class','public');
            clueCanvas.unshareCanvas();
            clueCanvas.getShareButton().should('be.visible');
            clueCanvas.getShareButton().should('have.class','private');
        });
        it('verify publish button', function(){
            canvas.publishCanvas("investigation");
            canvas.getPublishIcon().should('exist');
        });
    });
    context('test the tool palette', function(){//This should test the tools in the tool shelf
        // Tool palettes for Graph, Image, Draw,and Table are tested in respective tool spec test
        //Selection tool is tested as a functionality of graph tool tiles

        it('adds text tool', function(){
            clueCanvas.addTile('text');
            textToolTile.getTextTile().should('exist');
            textToolTile.enterText('This is a smoke test');
        });
        it('adds a graph tool', function(){
            clueCanvas.addTile('geometry');
            graphToolTile.getGraphTile().should('exist');
            graphToolTile.addPointToGraph(0,0);
        });
        it('adds an image tool', function(){
            clueCanvas.addTile('image');
            imageToolTile.getImageTile().should('exist');
        });
        it('adds a draw tool', function(){
            clueCanvas.addTile('drawing');
            drawToolTile.getDrawTile().should('exist');
        });
        it('adds a table tool', function(){
            clueCanvas.addTile('table');
            tableToolTile.getTableTile().should('exist');
        });
    });
    context('save and restore of canvas', function(){
        // let canvas1='Document 1';
        let canvas2='Document 2';
        before(function(){ //Open a different document to see if original document is restored
            // canvas.copyDocument(canvas1);
            canvas.createNewExtraDocumentFromFileMenu(canvas2, "my-work");
            canvas.getPersonalDocTitle().should('contain', canvas2);
            textToolTile.getTextTile().should('not.exist');
        });
        describe('verify that canvas is saved from various locations', function(){
            it('will restore from My Work tab', function() {
                // //open the my work tab, click a different canvas, verify canvas is shown, open the my work tab, click the introduction canvas, verify intro canvas is showing

                cy.openTopTab('my-work');
                cy.openSection('my-work', 'workspaces');
                cy.openDocumentWithTitle('my-work', 'workspaces', this.title );
                textToolTile.getTextTile().should('exist');
                graphToolTile.getGraphTile().first().should('exist');
                drawToolTile.getDrawTile().should('exist');
                imageToolTile.getImageTile().should('exist');
                tableToolTile.getTableTile().should('exist');
            });
        });
        // TODO: Class Work changed with new feature changes.
        describe('publish canvas', ()=>{
            it('verify publish canvas thumbnail appears in Class Work Published List',()=>{
                canvas.publishCanvas("investigation");
                cy.openTopTab('class-work');
                cy.openSection('class-work','workspaces');
                cy.getCanvasItemTitle('workspaces').should('have.length',1);
            });
            it('verify student name appears under thumbnail',()=>{
                cy.get('[data-test=user-name]').then(($el)=>{
                    const user = $el.text();
                    cy.getCanvasItemTitle('workspaces').first().find('.info div').should('contain',user);
                });
            } );
            it('verify restore of published canvas', ()=>{
              cy.openTopTab("class-work");
              cy.openSection("class-work", "workspaces");
                cy.get('[data-test=user-name]').then(($el)=>{
                    const user = $el.text();
                    cy.getCanvasItemTitle('workspaces', user).click();
                });
                cy.get(".document-tabs.class-work .documents-panel .canvas-area").find('.text-tool').should('exist').and('contain','This is a smoke test');
                cy.get(".document-tabs.class-work .documents-panel .canvas-area").find('.geometry-content').should('exist');
                cy.get(".document-tabs.class-work .documents-panel .canvas-area").find('.drawing-tool').should('exist');
                cy.get(".document-tabs.class-work .documents-panel .canvas-area").find('.image-tool').should('exist');
                cy.get(".document-tabs.class-work .documents-panel .canvas-area").find('.table-tool-tile').should('exist');
            });
        });
    });
});
