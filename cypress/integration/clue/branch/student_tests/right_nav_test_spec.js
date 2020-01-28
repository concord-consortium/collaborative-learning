import RightNav from '../../../../support/elements/common/RightNav'
import Canvas from '../../../../support/elements/common/Canvas'
import ClueCanvas from '../../../../support/elements/clue/cCanvas';

const rightNav = new RightNav;
const canvas = new Canvas;
const clueCanvas = new ClueCanvas;

describe('Test right nav tabs', function(){
    let title;
    let myDocumentTitle = 'my student document';
    let copyDocumentTitle = 'copy Investigation'
    
    before(function(){
            const baseUrl = `${Cypress.config("baseUrl")}`;
            const queryParams = `${Cypress.config("queryParams")}`;
            cy.clearQAData('all');

            cy.visit(baseUrl+queryParams);
            cy.waitForSpinner();
        clueCanvas.getInvestigationCanvasTitle().text().as('title');
    })
    describe('My Work tab tests', function(){
        describe('Investigation section',function(){
            it('verify that opened content is listed in My Work/Investigations section', function(){ 
                // cy.wait(1000);
                rightNav.openRightNavTab('my-work');
                rightNav.openSection('my-work', 'investigations');
                rightNav.getCanvasItemTitle('my-work','investigations').contains(this.title).should('exist');
                rightNav.closeRightNavTab('my-work')
            });
            it('verify publish Investigation', function(){
                canvas.publishCanvas();
                rightNav.openRightNavTab('class-work');
                rightNav.openSection('class-work','published')
                rightNav.getCanvasItemTitle('class-work','published').should('contain', this.title)
            })
            it('verify make a copy of a canvas',function(){
                canvas.copyDocument(copyDocumentTitle);
                canvas.getPersonalDocTitle().find('span').text().should('contain',copyDocumentTitle);
            });
            it('verify copied investigation does not appear in the investigation section',function(){
                rightNav.getCanvasItemTitle('my-work','investigations').contains(copyDocumentTitle).should('not.exist');
            })
            it('verify publish of personal workspace', function(){
                canvas.publishPersonalCanvas();
                rightNav.openRightNavTab('class-work');
                rightNav.openSection('class-work','personal')
                rightNav.getCanvasItemTitle('class-work','personal').should('contain', copyDocumentTitle)
            })
        })
        describe('Workspaces section', function(){
            it('verify investigation canvas is not listed in My Work', function(){ //still need to verify the titles match the titles from opened canvases
                rightNav.openRightNavTab('my-work');
                rightNav.openSection('my-work','workspaces');
                rightNav.getCanvasItemTitle('my-work','workspaces').contains(this.title).should('not.exist');
            });
            it('verify copied canvas is in My Work section',function(){
                rightNav.getCanvasItemTitle('my-work','workspaces').contains(copyDocumentTitle).should('exist');
            })
            it('verify open the correct canvas selected from Investigations section', function(){
                rightNav.openCanvasItem('my-work','investigations',this.title);
                clueCanvas.getInvestigationCanvasTitle().should('contain',this.title);
            });
            it('verify open the correct canvas selected from Extra Workspace section', function(){
                rightNav.openRightNavTab('my-work');
                rightNav.openCanvasItem('my-work','workspaces',copyDocumentTitle);
                canvas.getPersonalDocTitle().should('contain',copyDocumentTitle);
            });
        })
        describe('Starred section', function(){
            before(()=>{
                rightNav.openRightNavTab('my-work');
                rightNav.starCanvasItem('my-work','workspaces',copyDocumentTitle);
            })
            it('verify starred document star is highlighted',function(){
                rightNav.getCanvasStarIcon('my-work','workspaces',copyDocumentTitle).should('have.class','starred')
            })
            it('verify starred document appears in the Starred section',function(){
                rightNav.openSection('my-work','starred');
                rightNav.getCanvasItemTitle('my-work','starred').contains(copyDocumentTitle).should('exist');
            })
        })
        after(function(){
            rightNav.closeRightNavTab('my-work'); // clean up
        })
    });

    describe('Class Work tab tests', function(){ //uses publish documents from earlier tests
        before(()=>{
            rightNav.openRightNavTab('class-work');
        })
        describe('Open correct canvas from correct section',function(){
            it('verify open published canvas from Workspace list', function(){ //this assumes there are published work
                rightNav.openCanvasItem('class-work', 'personal', copyDocumentTitle);
                //rightNav.closeClassWorkTab(); //clean up
            });
            it('verify open published canvas from Investigations list', function(){ //this assumes there are published work
                // rightNav.openRightNavTab('class-work');
                // rightNav.openSection('class-work','published')
                rightNav.openCanvasItem('class-work','published',this.title)
                //rightNav.closeClassWorkTab(); //clean up
            });
            it('verify open published canvas from Learning Log',function(){
                //TODO
            })
            it('verify open published canvas from Starred',function(){ 
                //TODO -- need to figure out how to get a document starred prior to this test
            })
        })
        it('will verify that published canvas opens in rightside workspace', function(){
            // rightNav.openRightNavTab('class-work');
            rightNav.openCanvasItem('class-work', 'personal', copyDocumentTitle);
            clueCanvas.getRightSideWorkspaceTitle().should('contain',copyDocumentTitle);
        })
    })
    describe('Learning Log Tab', function(){
        it('verify investigation canvas is not listed in Learning Log ', function(){ //still need to verify the titles match the titles from opened canvases
            rightNav.openRightNavTab('learning-log');
            rightNav.openSection('learning-log','')
            rightNav.getCanvasItemTitle('learning-log','').contains(this.title).should('not.exist');
        });
        it('verify copied Investigation canvas is not in Learning Log section, and not in other sections',function(){
            rightNav.openRightNavTab('class-work');
            rightNav.openSection('class-work','learning-log');
            rightNav.getCanvasItemTitle('class-work','learning-log').should('not.exist');
        })
        it('verify Learning Log copy appears in Learning Log section', function(){
            //TODO
        })
        it('verify publish learning log', function(){
            //TODO
        })
        it.skip('verify learning log canvas side by side in right side 2 up view', function() {
            learningLog.createLearningLog('pool'); //setup
            //open 2up view
            learningLog.openTwoUpView();
            learningLog.getRightSideWorkspace().should('be.visible');
            //verify that canvas is in the left side workspace
            learningLog.getLeftSideWorkspaceTitle().should('contain','pool');
            //verify that tool palette is present in left side workspace
            learningLog.getLeftSideToolPalette().should('be.visible');
            //add a canvas to the right side workspace from My Work
            rightNav.openMyWorkTab();
            rightNav.openMyWorkAreaCanvasItem('Initial Challenge');
            // learningLog.getRightSideWorkspaceTitle().should('contain','Initial');
            //verify tool palette is not present in the right side workspace
            learningLog.getRightSideToolPalette().should('not.exist');
            //add a canvas to the right side workspace from Class Work
            rightNav.openClassWorkTab();
            rightNav.openClassWorkSections();
            rightNav.getAllClassWorkAreaCanvasItems().first().then(($el)=>{
                let title = $el.text().split('Student')[0];
                cy.wrap($el).click();
                learningLog.getRightSideWorkspaceTitle().should('contain',title);
            });
            learningLog.closeLearningLogTab();//close learning log tab because createLearningLog opens it again
            //create second learning log to put up in 2 up view
            learningLog.createLearningLog('slide');
            learningLog.publishLearningLog(); //to use for next test
            //add a canvas to the right side workspace from Learning log
            learningLog.openLearningLogCanvasItem('slide');
            learningLog.getRightSideWorkspaceTitle().should('contain','slide');
        });
    })
    describe('Supports Tab',function(){
        describe('Test supports area', function(){
            it.skip('verify supports comes up correctly', function(){
                canvas.getSupportList().each(($support, index, $list)=>{
                    let label=$support.text();
                    cy.wrap($support).click();
                    canvas.getSupportTitle().should('contain', label);
                });
            });
        });
    })
});

after(function(){
  cy.clearQAData('all');
});