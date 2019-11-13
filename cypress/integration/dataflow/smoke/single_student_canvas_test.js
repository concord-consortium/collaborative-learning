import Canvas from '../../../support/elements/common/Canvas'
import RightNav from '../../../support/elements/common/RightNav';
import dfCanvas from '../../../support/elements/dataflow/dfCanvas';
import dfBlock from '../../../support/elements/dataflow/dfBlock';
import dfControlPanels from '../../../support/elements/dataflow/dfControlPanels';
import dfHeader from '../../../support/elements/dataflow/dfHeader';
import Header from '../../../support/elements/common/Header';

let canvas = new Canvas;
let rightNav = new RightNav;
let dfcanvas = new dfCanvas;
let dfblock = new dfBlock;
let controlPanel = new dfControlPanels;
let dfheader = new dfHeader;
let header = new Header;

const programTitle = 'Program-1';
const dataTitle = "My Test Data"

before(function(){
    const baseUrl = `${Cypress.config("baseUrl")}`;
    const queryParams = `${Cypress.config("queryParams")}`;

    cy.visit(baseUrl+queryParams);
    cy.wait(3000)
});

context('single student functional test',()=>{
    describe('test header elements', function(){
        it('verifies views button changes when clicked and shows the correct corresponding workspace view', function(){
            dfheader.switchWorkspace('Control Panels');
            controlPanel.getHubListTitle().should('contain', 'Registered IoT Hubs');
            dfheader.switchWorkspace('Workspace');
            canvas.getSingleCanvas().should('be.visible');
            rightNav.getRightNavTabs().should('exist');
        });
        it('verify header elements have correct text', function(){
            header.getClassName().should('exist');
            header.getProblemTitle().should('exist').and('contain','Dataflow'); //may have to move this when dropdown exists
            header.getUserName().should('exist');
            header.getVersionNumber().should('exist');
        });
    });
    context('test the tool palette', function(){//This should test the tools in the tool shelf

        it('adds generator block', function(){
            dfcanvas.openBlock('Generator');
            dfblock.getBlockTitle('generator').should('exist').and('contain','Generator');
            dfblock.selectGeneratorType('Square');
        });
        it('adds a data storage tool', function(){
            dfcanvas.openBlock('Data Storage')
            dfblock.getBlockTitle('data-storage').should('contain','Data Storage');
            dfblock.moveBlock('data-storage',0,250,5);
        });
        it('verify connect blocks', function(){
            dfblock.connectBlocks('generator',0,'data-storage',0);
        });
        it('verify run program', function(){
            dfcanvas.runProgram();
            cy.wait(10000);
            dfcanvas.getProgramRunningCover().should('be.visible')
        });
        it('verify data view is generated', function(){
            cy.waitForGraphSpinner();
            cy.wait(3000)
            dfcanvas.getProgramGraph().should('be.visible').and('not.have.class','full')
        });
        it('verify graph is visible after data collection',function(){
            cy.clock()
            cy.tick(40000);
            dfcanvas.stopProgram();
            dfcanvas.getProgramToolbar().should('not.exist')
            dfcanvas.getFullGraph().should('be.visible');
        })
        it('verify edit canvas title', function(){
            canvas.editTitle(dataTitle);
            canvas.getPersonalDocTitle().should('contain', dataTitle);
        })
    });
    context('save and restore of canvas', function(){
        describe('Program save and restore', function(){
            it('verify program is saved and restored', function() {
                rightNav.openRightNavTab('my-work');
                rightNav.openSection('my-work', '','Programs')
                rightNav.openCanvasItem('my-work', '', programTitle );
            });
            it('verify data collected is saved and restored', function() {
                rightNav.openRightNavTab('my-work');
                rightNav.openSection('my-work', '','Data')
                rightNav.openCanvasItem('my-work', '', dataTitle );
            });
        });
        // TODO: Class Work changed with new feature changes.
        describe('publish canvas', ()=>{
            it('verify publish canvas thumbnail appears in Class Work Published List',()=>{

            })
            it('verify student name appears under thumbnail',()=>{
 
            } )
            it('verify restore of published canvas', ()=>{

            })
        })
    });    
})
after(function(){
    cy.clearQAData('all');
  });