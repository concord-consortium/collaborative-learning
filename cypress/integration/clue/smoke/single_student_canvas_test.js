import LeftNav from '../../../support/elements/LeftNav'
import Canvas from '../../../support/elements/Canvas'
import RightNav from '../../../support/elements/RightNav'
import LearningLog from '../../../support/elements/LearningLog';
import GraphToolTile from '../../../support/elements/GraphToolTile'
import ImageToolTile from '../../../support/elements/ImageToolTile'
import DrawToolTile from '../../../support/elements/DrawToolTile'
import TextToolTile from '../../../support/elements/TextToolTile'
import TableToolTile from '../../../support/elements/TableToolTile'

let leftNav = new LeftNav;
let canvas = new Canvas;
let rightNav = new RightNav;
let learningLog = new LearningLog;
let graphToolTile = new GraphToolTile;
let imageToolTile = new ImageToolTile;
let drawToolTile = new DrawToolTile;
let textToolTile = new TextToolTile;
let tableToolTile = new TableToolTile;

context('single student functional test',()=>{
    describe('Left nav tabs open and close',()=>{
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
            canvas.getFourUpViewToggle().should('be.visible');
            canvas.getSingleCanvas().should('be.visible');
            canvas.getFourUpView().should('not.be.visible');
            canvas.openFourUpView();
            //4-up view is visible and 1-up button is visible
            canvas.getFourToOneUpViewToggle().should('be.visible');
            canvas.getNorthEastCanvas().should('be.visible');
            canvas.getNorthWestCanvas().should('be.visible');
            canvas.getSouthEastCanvas().should('be.visible');
            canvas.getSouthEastCanvas().should('be.visible');
            // canvas.getSingleCanvas().should('not.be.visible');

            //can get back to 1 up view from 4 up
            canvas.openOneUpViewFromFourUp();
            canvas.getSingleCanvas().should('be.visible');
            canvas.getFourUpViewToggle().should('be.visible');
            canvas.getFourUpView().should('not.be.visible');
        });

        it('verify share button', function(){
            canvas.getShareButton().should('be.visible');
            canvas.getUnshareButton().should('not.be.visible');
            canvas.shareCanvas();
            canvas.getShareButton().should('not.be.visible');
            canvas.getUnshareButton().should('be.visible');
            canvas.unshareCanvas();
            canvas.getShareButton().should('be.visible');
            canvas.getUnshareButton().should('not.be.visible');
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
            canvas.addTextTile();
            textToolTile.getTextTile().should('exist');
        });
        it('adds a graph tool', function(){
            canvas.addGraphTile();
            graphToolTile.getGraphTile().should('exist');
        });
        it('adds an image tool', function(){
            canvas.addImageTile();
            imageToolTile.getImageTile().should('exist');
        });
        it('adds a draw tool', function(){
            canvas.addDrawTile();
            drawToolTile.getDrawTile().should('exist');
        });
        it('adds a table tool', function(){
            canvas.addTableTile();
            tableToolTile.getTableTile().should('exist');
        });
        it('verifies scrolling', function(){
            tableToolTile.getTableTile().scrollIntoView().click();
            textToolTile.getTextTile().first().scrollIntoView();
        });
    });
    context('save and restore of canvas', function(){
        let canvas1='Document 1';
        let canvas2='Document 2';
        describe('verify that canvas is saved from various locations', function(){
            it('will restore from My Work tab', function() {
                // //open the my work tab, click a different canvas, verify canvas is shown, open the my work tab, click the introduction canvas, verify intro canvas is showing

                rightNav.openMyWorkTab();
                rightNav.openMyWorkAreaCanvasItem();//canvas1);
                //Keeping these lines for when students have more than one document
                // canvas.getCanvasTitle().should('contain', canvas1);
                // rightNav.closeMyWorkTab();
                // rightNav.openMyWorkTab();
                // rightNav.openMyWorkAreaCanvasItem(canvas2);
                // canvas.getCanvasTitle().should('contain', canvas2);

                textToolTile.getTextTile().should('exist');
                graphToolTile.getGraphTile().first().should('exist');
                drawToolTile.getDrawTile().should('exist');
                imageToolTile.getImageTile().should('exist');
                tableToolTile.getTableTile().should('exist');
            });
        });
        describe('publish canvas', ()=>{
            it('verify publish canvas thumbnail appears in Class Work Published List',()=>{
                canvas.publishCanvas();
                rightNav.openClassWorkTab()
                rightNav.openClassWorkSections();
                rightNav.getAllClassWorkAreaCanvasItems().should('have.length',1)
            })
            it('verify student name appears under thumbnail',()=>{
                cy.get('[data-test=user-name]').then(($el)=>{
                    var user = $el.text();
                    rightNav.getAllClassWorkAreaCanvasItems().first().find('.info div').should('contain',user);
                })
            } )
            it('verify restore of published canvas', ()=>{
                cy.get('[data-test=user-name]').then(($el)=>{
                    var user = $el.text();
                    rightNav.openClassWorkAreaCanvasItem(user);
                })
                // canvas.getRightSideDocumentContent().find('.text-tool').should('exist');
                // canvas.getRightSideDocumentContent().find('.geometry-content').should('exist');
                // canvas.getRightSideDocumentContent().find('.drawing-tool').should('exist');
                // canvas.getRightSideDocumentContent().find('.image-tool').should('exist');
                // canvas.getRightSideDocumentContent().find('.neo-codap-case-table').should('exist');

            })
        })
    });

    context('learning log', ()=>{
        var text='Hello into the Learning Log World';
        var title='pool';

        it('create a new learning log', function(){
             learningLog.createLearningLog(title);
             learningLog.addLLTextTile(text);
        });
        it('verify restore of a created learning log', function(){
            let title = 'pool';
            learningLog.openLearningLogCanvasItem(title);
            learningLog.getLLTextTile().should('contain',text)
        });
        it('verify publish of learning log',()=>{
            learningLog.publishLearningLog();
            learningLog.closeLearningLogTab();
            leftNav.openToWorkspace('Now What');
            rightNav.openClassLogTab();
            rightNav.openClassLogAreaCanvasItem(title);
            rightNav.closeClassLogTab();
            cy.wait(1000);
            canvas.getRightSideLLTitle() //This assumes that Class Log always opens in 2-up right workspace
                    .then(($canvasTitle)=>{
                        let canvasTitle=$canvasTitle.text();
                        expect($canvasTitle.text()).to.contain(title[0]);
                    });
            canvas.getRightSideDocumentContent().find('.text-tool span').should('contain',text);        
        })
    })    
})