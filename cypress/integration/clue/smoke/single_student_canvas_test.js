import LeftNav from '../../../support/elements/clue/LeftNav'
import Canvas from '../../../support/elements/common/Canvas'
import ClueCanvas from '../../../support/elements/clue/cCanvas'
import RightNav from '../../../support/elements/common/RightNav'
import GraphToolTile from '../../../support/elements/clue/GraphToolTile'
import ImageToolTile from '../../../support/elements/clue/ImageToolTile'
import DrawToolTile from '../../../support/elements/clue/DrawToolTile'
import TextToolTile from '../../../support/elements/clue/TextToolTile'
import TableToolTile from '../../../support/elements/clue/TableToolTile'

let leftNav = new LeftNav;
let canvas = new Canvas;
let clueCanvas = new ClueCanvas;
let rightNav = new RightNav;
let graphToolTile = new GraphToolTile;
let imageToolTile = new ImageToolTile;
let drawToolTile = new DrawToolTile;
let textToolTile = new TextToolTile;
let tableToolTile = new TableToolTile;

context('single student functional test',()=>{
    before(function(){
            const baseUrl = `${Cypress.config("baseUrl")}`;
            const queryParams = `${Cypress.config("queryParams")}`;
            // cy.clearQAData('all');
            cy.visit(baseUrl+queryParams);
            cy.waitForSpinner();
            // cy.wait(4000);
        clueCanvas.getInvestigationCanvasTitle().text().as('title');
    })
    describe.skip('Left nav tabs open and close',()=>{
        it('verify left nav tabs open and switch contents', ()=>{
            leftNav.getLeftNavTabs().each(($tab, index, $tabList)=>{
                cy.get('#leftNavTab' + index).click({force:true});
                cy.get('#leftNavTab' + index).should('have.class', 'active')
                cy.log("i-after: "+index)
            })
            cy.get('.left-nav .tab').last().click({force:true});//close left nav tabs
        })
    })

    describe('test header elements', function(){
        it('verifies views button changes when clicked and shows the correct corresponding workspace view', function(){
            //1-up view has 4-up button visible and 1-up canvas
            clueCanvas.getFourUpViewToggle().should('be.visible');
            canvas.getSingleCanvas().should('be.visible');
            clueCanvas.getFourUpView().should('not.be.visible');
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
            clueCanvas.getFourUpView().should('not.be.visible');
        });

        it('verify share button', function(){
            clueCanvas.getShareButton().should('be.visible');
            clueCanvas.getShareButton().find('.button-icon').should('have.class','private')
            clueCanvas.shareCanvas();
            clueCanvas.getShareButton().should('be.visible');
            clueCanvas.getShareButton().find('.button-icon').should('have.class','public')
            clueCanvas.unshareCanvas();
            clueCanvas.getShareButton().should('be.visible');
            clueCanvas.getShareButton().find('.button-icon').should('have.class','private')
        });
        it('verify publish button', function(){
            canvas.publishCanvas();
            canvas.getPublishIcon().should('exist');
        });
    });
    context('test the tool palette', function(){//This should test the tools in the tool shelf
        // Tool palettes for Graph, Image, Draw,and Table are tested in respective tool spec test
        //Selection tool is tested as a functionality of graph tool tiles

        it('adds text tool', function(){
            clueCanvas.addTile('text');
            textToolTile.getTextTile().should('exist');
            textToolTile.enterText('This is a smoke test')
        });
        it('adds a graph tool', function(){
            clueCanvas.addTile('geometry');
            graphToolTile.getGraphTile().should('exist');
            graphToolTile.addPointToGraph(0,0)
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
    context.skip('save and restore of canvas', function(){
        let canvas1='Document 1';
        let canvas2='Document 2';
        before(function(){ //Open a different document to see if original document is restored
            canvas.copyDocument(canvas1);
            canvas.createNewExtraDocument(canvas2)
            textToolTile.getTextTile().should('not.exist')
        })
        describe('verify that canvas is saved from various locations', function(){
            it('will restore from My Work tab', function() {
                // //open the my work tab, click a different canvas, verify canvas is shown, open the my work tab, click the introduction canvas, verify intro canvas is showing

                rightNav.openRightNavTab('my-work');
                rightNav.openSection('my-work', 'investigations')
                rightNav.openCanvasItem('my-work', 'investigations', this.title );
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
                canvas.publishCanvas();
                rightNav.openRightNavTab('class-work')
                rightNav.openSection('class-work','published');
                rightNav.getAllSectionCanvasItems('class-work','published').should('have.length',1)
            })
            it('verify student name appears under thumbnail',()=>{
                cy.get('[data-test=user-name]').then(($el)=>{
                    var user = $el.text();
                    rightNav.getAllSectionCanvasItems('class-work','published').first().find('.info div').should('contain',user);
                })
            } )
            it('verify restore of published canvas', ()=>{
                cy.get('[data-test=user-name]').then(($el)=>{
                    var user = $el.text();
                    rightNav.openCanvasItem('class-work','published', user);
                })
                clueCanvas.getRightSideDocumentContent().find('.text-tool').should('exist').and('contain','This is a smoke test');
                clueCanvas.getRightSideDocumentContent().find('.geometry-content').should('exist');
                clueCanvas.getRightSideDocumentContent().find('.drawing-tool').should('exist');
                clueCanvas.getRightSideDocumentContent().find('.image-tool').should('exist');
                clueCanvas.getRightSideDocumentContent().find('.neo-codap-case-table').should('exist');
            })
        })
    });
})