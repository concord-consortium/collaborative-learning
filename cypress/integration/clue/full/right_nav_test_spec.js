import RightNav from '../../../support/elements/common/RightNav'
import Canvas from '../../../support/elements/common/Canvas'
import ClueCanvas from '../../../support/elements/clue/cCanvas';

const rightNav = new RightNav;
const canvas = new Canvas;
const clueCanvas = new ClueCanvas;

describe('Test right nav tabs', function(){
    let title;
    let myDocumentTitle = 'my student document';
    let copyDocumentTitle = 'copy Investigation'
    
    before(function(){
        clueCanvas.getInvestigationCanvasTitle().text().as('title');
    })
    describe('My Work tab tests', function(){
        describe('Investigation section',function(){
            it('verify that opened content is listed in My Work/Investigations section', function(){ 
                cy.wait(1000);
                rightNav.openMyWorkTab();
                rightNav.openSection('my-work', 'investigatons');
                rightNav.getCanvasItemTitle('my-work','investigations').contains(this.title).should('exist');
            });
            it('verify make a copy of a canvas',function(){
                canvas.copyDocument();
                canvas.editTitle(copyDocumentTitle);
                canvas.getPersonalDocTitle().text().should('contain',copyDocumentTitle);
            });
            it('verify copied investigation does not appear in the investigation section',function(){
                rightNav.getCanvasItemTitle('my-work','investigations').contains(copyDocumentTitle).should('not.exist');
            })
            it('verify publish Investigation', function(){
                //TODO
            })
        })
        describe('Workspaces section', function(){
            it('verify investigation canvas is not listed in My Work', function(){ //still need to verify the titles match the titles from opened canvases
                rightNav.getCanvasItemTitle('my-work','workspaces').contains(this.title).should('not.exist');
            });
            it('verify copied canvas is in My Work section',function(){
                rightNav.getCanvasItemTitle('my-work','workspaces').contains(copyDocumentTitle).should('exist');
            })
            it('verify open the correct canvas selected from Investigations section', function(){
                // rightNav.openMyWorkTab();
                rightNav.openCanvasItem(this.title);
                clueCanvas.getInvestigationCanvasTitle().should('contain',this.title);
            });
            it('verify open the correct canvas selected from Investigations section', function(){
                // rightNav.openMyWorkTab();
                rightNav.openCanvasItem(this.title);
                clueCanvas.getInvestigationCanvasTitle().should('contain',this.title);
            });
            it('verify publish personal document', function(){

            })
        })
        describe('Learning Logs section', function(){
            it('verify investigation canvas is not listed in Learning Log ', function(){ //still need to verify the titles match the titles from opened canvases
                rightNav.getCanvasItemTitle('my-work','learning-log').contains(this.title).should('not.exist');
            });
            it('verify copied Investigation canvas is not in Learning Log section, and not in other sections',function(){
                rightNav.getCanvasItemTitle('my-work','learning-log').contains(copyDocumentTitle).should('not.exist');
            })
            it('verify Learning Log copy appears in Learning Log section', function(){
                //TODO
            })
            it('verify publish learning log', function(){

            })
        })
        after(function(){
            rightNav.closeMyWorkTab(); // clean up
        })
    });

    describe('Class Work tab tests', function(){ //uses publish documents from earlier tests
        describe('Open correct canvas from correct section',function(){
            it('verify open published canvas from Workspace list', function(){ //this assumes there are published work
                rightNav.openClassWorkTab();
                //rightNav.closeClassWorkTab(); //clean up
            });
            it('verify open published canvas from Investigations list', function(){ //this assumes there are published work
                rightNav.openClassWorkTab();
                //rightNav.closeClassWorkTab(); //clean up
            });
            it('verify open published canvas from Learning Log',function(){
                //TODO
            })
            it('verify open published canvas from Starred',function(){ 
                //TODO -- need to figure out how to get a document starred prior to this test
            })
        })
        it('will verify that published canvas does not have a tool palette', function(){
            // rightNav.openClassWorkTab();
            rightNav.getClassWorkAreaCanvasItem().first().click();
            canvas.getToolPalette().should('not.be.visible');
        })
    })
    describe('Learning Log Tab', function(){
        
    })
    describe('Supports Tab',function(){

    })
});
