//save and restore
//toolbar is present
//verify delete of block
//verify reset of plot
//verify clear of canvas

import dfBlock from "../../../support/elements/dataflow/dfBlock";
import dfHeader from "../../../support/elements/dataflow/dfHeader";
import dfCanvas from "../../../support/elements/dataflow/dfCanvas";
import Canvas from "../../../support/elements/common/Canvas";
import RightNav from "../../../support/elements/common/RightNav";


const header = new dfHeader;
const dfcanvas = new dfCanvas;
const dfblock = new dfBlock;
const canvas = new Canvas;
const rightNav = new RightNav


before(()=>{
    const baseUrl = `${Cypress.config("baseUrl")}`;
    const queryParams = `${Cypress.config("queryParams")}`;
    cy.clearQAData('all');

    cy.visit(baseUrl+queryParams);
    cy.wait(2000)
})

context('canvas test',()=>{
    var buttons = ['Sensor','Number','Generator', 'Timer', 'Math','Logic','Transform','Relay', 'Data Storage'];
    const numButtons = buttons.length;

    describe('canvas ui',()=>{
        it('verifies delete button is disabled',()=>{
            canvas.getDeleteIcon().should('be.visible');
        })
        it('verify Dataflow tile opens with program toolbar',()=>{
            buttons.push('Clear','Reset')
            dfcanvas.getDataFlowToolTile().should('exist');
            dfcanvas.getProgramToolbar().should('exist');
            dfcanvas.getProgramToolbarButtons().should('have.length', (buttons.length))//qaMode adds Reset and Clear to the button list
            dfcanvas.getProgramToolbarButtons().each(($button,index,$buttonList)=>{
                expect($button.text()).to.include(buttons[index])
            })
            dfcanvas.getDurationDropdown().should('be.visible');
            dfcanvas.getRunButton().should('be.visible');
            dfcanvas.getStopButton().should('be.visible');
            dfcanvas.getZoomInButton().should('be.visible');
            dfcanvas.getZoomOutButton().should('be.visible');
        })
    })
    describe('verify adding blocks to canvas',()=>{
        it('verify blocks gets added when toolbar button is clicked',()=>{
            buttons.length = numButtons;
            for(var i=0;i<=buttons.length-1;i++) {
                dfcanvas.openBlock(buttons[i]);
                dfblock.getBlock(buttons[i].toLowerCase().replace(' ','-')).should('exist');
            }
        })
    })
    describe('verify run program toolbar functionality', ()=>{
        it('verify can select a duration',()=>{
            var duration = '5 mins';
            dfcanvas.selectDuration(duration);
            dfcanvas.getDurationDropdown().should('have.value', '300');
        })
        it('verify Stop button is disabled when Run button is enabled',()=>{
            dfcanvas.getRunButton().parent().should('not.have.attr','disabled');
            dfcanvas.getStopButton().parent().should('have.attr','disabled');
        })
        it('verify Duration is visible when program is running',()=>{
            dfcanvas.runProgram();
            cy.wait(1500);
            dfcanvas.getDurationContainer().should('be.visible');
            dfcanvas.getProgressTime().should('be.visible');
        })
        it('verify Run button is not visible',()=>{
            dfcanvas.getRunButton().should('not.exist');
        })
        it('verify Stop button is enabled when program is running',()=>{
            dfcanvas.getStopButton().parent().should('not.have.attr','disabled');
        })
        it('verify Program toolbar does not exist after running a program',()=>{
            dfcanvas.stopProgram();
            dfcanvas.getProgramToolbar().should('not.exist')
        })
    })
    describe('deletion',()=>{
        describe('delete a block',()=>{
            before(()=>{
                dfcanvas.createNewProgram('Delete Block Program'); //start with clean canvas
                dfcanvas.openBlock('Number');
                dfcanvas.openBlock('Relay')
                dfblock.moveBlock('relay',0,250,5)
                dfblock.connectBlocks('number',0,'relay',0)
            })
            it('verifies connection line is visible before deletion',()=>{
                dfcanvas.scrollToTopOfTile();
                dfblock.connectionLine().should('exist');
            })
            it('verifies a block can be deleted',()=>{ //easier to verify when there are only two blocks
                // dfblock.selectBlock('number')
                // dfblock.getBlock('number').should('have.class','selected')
                dfblock.deleteBlock('number')
                dfblock.getBlock('number').should('not.exist');
                dfblock.getBlock('relay').should('exist');
            })
            it('verifies connection between blocks is deleted when block is deleted',()=>{
                dfcanvas.scrollToTopOfTile();
                dfblock.connectionLine().should('not.exist')
            })
        })
    })
    describe('test save and restore',()=>{
        var num1=4, num2=5, operator='Multiply',storeName='multiplied',seqName='multiplication';
        var title='Save and Restore Program';

        before(()=>{//start clean
            dfcanvas.createNewProgram(title);
            dfcanvas.openBlock('Number');
            dfcanvas.openBlock('Number');
            dfcanvas.openBlock('Math');
            dfblock.moveBlock('math',0,250,5)
            dfcanvas.openBlock('Data Storage');
            dfblock.moveBlock('data-storage',0,250,250)
            dfblock.connectBlocks('number',0,'math',0);
            dfblock.connectBlocks('number',1,'math',1);
            dfblock.connectBlocks('math',0,'data-storage',0)
            //enter numbers into number blocks
            dfblock.getNumberInput(0).type('{backspace}'+num1);
            dfblock.getNumberInput(1).type('{backspace}'+num2);
            //select math operator
            dfblock.openMathOperatorDropdown();
            dfblock.selectMathOperator(operator)
            //enter new names in data storage block
            dfblock.getStorageNameTextField().type('{selectall}{backspace}'+storeName);
            dfblock.getStorageSequenceTextField().type('{selectall}{backspace}'+seqName);
            cy.wait(3000) //wait to finish typing into element before reloading page
        })
        it('verify program is restored when reopened',()=>{
            //get values before close
            const input1 = Cypress.$(dfblock.numberInputEl(0)).val()
            const input2 = Cypress.$(dfblock.numberInputEl(1)).val()
            const mathValue = Cypress.$(dfblock.mathValueTextFieldEl()).text()
            const storageName = Cypress.$(dfblock.storageNameTextFieldEl()).val()
            const sequenceName = Cypress.$(dfblock.storageSequenceTextFieldEl(1)).val()
            console.log('title: '+title);

            //reload page
            cy.url().then((url)=>{
                cy.visit(url);
            })
            cy.wait(5000)

            rightNav.openRightNavTab('my-work');
            rightNav.openSection('my-work','','Programs');
            rightNav.openCanvasItem('my-work','',title)
            cy.wait(5000)
            //compare before and after values
            dfblock.getNumberInput(0).invoke('attr','value').then((value)=>{
                expect(parseInt(value)).to.eq(parseInt(input1));
            });
            dfblock.getNumberInput(1).invoke('attr','value').then((value)=>{
                expect(parseInt(value)).to.eq(parseInt(input2));
            });
            dfblock.getMathValueTextField().text().should('eq',mathValue)
            dfblock.getStorageNameTextField().invoke('attr','value').then((value)=>{
                expect(value).to.eq(storageName)
            })
            dfblock.getStorageSequenceTextField(1).invoke('attr','value').then((value)=>{
                expect(value).to.eq(sequenceName)
            });
        })
    })
})
after(function(){
    cy.clearQAData('all');
  });