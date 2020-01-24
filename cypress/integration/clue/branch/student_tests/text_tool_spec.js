import Canvas from '../../../../support/elements/common/Canvas'
import ClueCanvas from '../../../../support/elements/clue/cCanvas'
import TextToolTile from '../../../../support/elements/clue/TextToolTile'
import RightNav from '../../../../support/elements/common/RightNav';

const canvas = new Canvas;
const clueCanvas = new ClueCanvas;
const textToolTile = new TextToolTile;
const rightNav = new RightNav;


before(function(){
    const baseUrl = `${Cypress.config("baseUrl")}`;
    const queryParams = `${Cypress.config("queryParams")}`;

    cy.clearQAData('all');
    cy.visit(baseUrl+queryParams);
    cy.waitForSpinner();
});

context('Text tool tile functionalities', function(){
    let title;
    before(()=>{
        clueCanvas.getInvestigationCanvasTitle()
            .then(($canvasTitle)=>{
                title = $canvasTitle.text().trim();
                cy.log('title is: '+title)
            })
    })
    it('adds text tool and types Hello World', function(){
        clueCanvas.addTile('text');
        textToolTile.enterText('Hello World');
        textToolTile.getTextTile().last().should('contain', 'Hello World');
    });
    it('verifies restore of text field content',()=>{
        canvas.createNewExtraDocument('text tool test');
        textToolTile.getTextTile().should('not.exist');
        //re-open investigation
        rightNav.openRightNavTab('my-work');
        rightNav.openSection('my-work','investigations')
        rightNav.openCanvasItem('my-work','investigations',title)
        textToolTile.getTextTile().last().should('exist').and('contain', 'Hello World');
    })
    it('clicks the same text field and allows user to edit text', function(){
        textToolTile.getTextTile().last().focus().click();
        textToolTile.addText('Adding more text to see if it gets added.');
        textToolTile.addText('Adding more text to delete');
        textToolTile.deleteText('{backspace}{backspace}{backspace}{backspace}{backspace}{backspace}{backspace}');
    });
    it('delete text tile',()=>{
        clueCanvas.deleteTile('text');
        textToolTile.getTextTile().should('not.exist');
    })
})

after(function(){
  cy.clearQAData('all');
});