
import dfRightNav from "../../../support/elements/dataflow/dfRightNav";
import dfCanvas from "../../../support/elements/dataflow/dfCanvas";
import dfBlock from "../../../support/elements/dataflow/dfBlock";
import Canvas from "../../../support/elements/common/Canvas";
import RightNav from "../../../support/elements/common/RightNav";
import dfHeader from "../../../support/elements/dataflow/dfHeader";

const dfheader = new dfHeader;
const dfcanvas = new dfCanvas;
const dfblock = new dfBlock;
const canvas = new Canvas;
const rightNav = new RightNav;
const dfrightnav = new dfRightNav

const program1 = 'Program-1'
const program2 = 'Program-2'
const dataset1 = 'stopped dataset'
const dataset2 = '1 minute dataset'
const dataset3 = '10 minute dataset'

//Add countdown timer tests
//Add test for when a program is run from a copy of a dataset or a shared dataset/programs
//Add test for going from dataset to program and rerun the program - verify that a new dataset is created and not added on to a previous test
//verify that if data storage or relay are not connected or not present, then run button should be disabled

before(()=>{
    const baseUrl = `${Cypress.config("baseUrl")}`;
    const queryParams = `${Cypress.config("queryParams")}`;

    cy.clearQAData('all');

    cy.visit(baseUrl+queryParams);
    cy.wait(2000)

    dfcanvas.openBlock('Number')
    dfcanvas.openBlock('Data Storage')
    dfblock.getNumberInput().type('9');
    dfblock.connectBlocks('number',0,'data-storage',0)
    canvas.editTitle(program1)
})

context('Program Canvas tests',function(){
    it('verify data collection stops when Stop button is clicked',()=>{
        dfcanvas.selectDuration('300')
        dfcanvas.runProgram(dataset1);
        cy.wait(15000); //on first run sometimes it takes 10 seconds for graph to start
        dfcanvas.getProgramGraph().should('be.visible');
        dfrightnav.getRunningBadge().should('exist');
        dfcanvas.stopProgram();
        dfcanvas.getFullGraph().should('be.visible');
        dfcanvas.getDataFlowProgramEditorTopControl().should('not.exist')
        canvas.getPersonalDocTitle().should('contain',dataset1)
        dfrightnav.getRunningBadge().should('not.exist');
    })

    it('restore program',()=>{
        rightNav.openRightNavTab('my-work');
        rightNav.openSection('my-work','','Programs')
        rightNav.openCanvasItem('my-work','',program1)
        dfcanvas.getDurationDropdown().should('contain', '5 mins')
    })
    it('verify data collection runs to the end of the duration',()=>{
        dfcanvas.createNewProgram(program2);
        dfcanvas.openBlock('Number')
        dfcanvas.openBlock('Data Storage')
        dfblock.getNumberInput().type('5');
        dfblock.connectBlocks('number',0,'data-storage',0)
        dfcanvas.selectDuration('60')
        dfcanvas.runProgram(dataset2);
        dfcanvas.getDurationContainer().find('.total').should('contain', '1 min')
        cy.wait(10000);
        rightNav.openSection('my-work','','Data')
        dfrightnav.getRunningBadge().should('exist');
        cy.wait(50000);
        dfcanvas.getFullGraph().should('be.visible');
        dfcanvas.getDataFlowProgramEditorTopControl().should('not.exist')
        canvas.getPersonalDocTitle().should('contain',dataset2)
        dfrightnav.getRunningBadge().should('not.exist');
    })
    it('verify data collected from a run program appears in My Work>Data section',()=>{
        rightNav.getCanvasItemTitle('my-work','','Data').contains(program1).should('not.be.visible')
    })
    it('verify data collected from a run program does not appear in My Work>Programs section',()=>{
        rightNav.openSection('my-work','','Programs')
        rightNav.getCanvasItemTitle('my-work','','Programs').contains(dataset1).should('not.be.visible')
    })
    it('verify re-running a previously ran program creates a new dataset',()=>{

    })
})
context('Data Canvas tests',()=>{   
    it('verify restore of data canvas',()=>{
        rightNav.openSection('my-work','','Data')
        rightNav.openCanvasItem('my-work','',dataset2)
        dfcanvas.getFullGraph().should('be.visible');
        dfcanvas.getFullGraph().find('.chartjs-render-monitor').should('be.visible')
        dfcanvas.getGraphButton('program').should('be.visible')
        dfcanvas.getGraphButton('export').should('be.visible')
        dfcanvas.getGraphButton('data').should('be.visible')
        dfcanvas.getGraphButton('layout').should('be.visible')
        dfcanvas.getGraphButton('type').should('be.visible')

    })
    it('verify program toolbar is not present',()=>{
        dfcanvas.getProgramToolbar().should('not.be.visible')
    })
    it('verify new program can be created from a dataset',()=>{

    })
    it('verify copy of a dataset creates a copy of a dateset',()=>{

    })
})
after(function(){
    cy.clearQAData('all');
  });