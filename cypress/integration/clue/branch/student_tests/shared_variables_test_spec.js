import Canvas from '../../../../support/elements/common/Canvas';
import ClueCanvas from '../../../../support/elements/clue/cCanvas';
import TextToolTile from '../../../../support/elements/clue/TextToolTile';

const canvas = new Canvas;
const clueCanvas = new ClueCanvas;
const textToolTile = new TextToolTile;

context('Shared Variables', function () {
  const queryParam = "?appMode=qa&fakeClass=5&fakeUser=student:5&demoOffering=5&problem=1.1&qaGroup=5&unit=m2s";
  // What is the difference between fakeOffering and demoOffering

  let title;
  before(()=>{
    cy.clearQAData('all');
    cy.visit(queryParam);
    cy.waitForLoad();
    cy.get('.primary-workspace [data-test=personal-doc-title]')
    .then(($canvasTitle)=>{
        title = $canvasTitle.text().trim();
        cy.log('title is: '+title);
    });
  });

  it('can add a variable chip to the text tool', function() {
    clueCanvas.addTile('text');
    clueCanvas.addTile('diagram');

    textToolTile.enterText('Hello World');
    textToolTile.getTextTile().last().should('contain', 'Hello World');
    textToolTile.clickToolbarTool("Variables");
    cy.get(".ReactModalPortal").within(() => {
      cy.findByLabelText(/Name/).type("Var A");
      cy.findByRole("button", {name: "OK"}).click();
    });
    // Make sure the text tile now has a chip with Var A.
    textToolTile.getTextTile().last().should('contain', 'Var A');
    // Make sure the diagram tile now has a card with Var A.
    cy.get('.primary-workspace .canvas-area .diagram-tool [data-testid="quantity-node"]')
      .findByDisplayValue('Var A')
      .should('exist');
  });

  it('can add a duplicate variable chip to the text tool', function() {
    // Note that when the chip is focused you can't type so we have to use 
    // rightArrow to move off of the chip
    textToolTile.enterText('{rightArrow}Second Chip:');
    textToolTile.getTextTile().last().should('contain', 'Second Chip');
    textToolTile.clickToolbarTool("Variables");
    cy.get(".ReactModalPortal").within(() => {
      cy.findByRole("combobox").type("Var{enter}");
      cy.findByRole("button", {name: "OK"}).click();
    });
    // Make sure the text tile now has 2 chips with Var A.
    textToolTile.getTextTile().last().find('.ccrte-variable:contains("Var A")').should('have.length', 2);
  });

  it('can pre populate the name field based on the selected text', function() {
    // Note that when the chip is focused you can't type so we have to use 
    // rightArrow to move off of the chip
    textToolTile.enterText('{rightArrow} VarC{shift}{leftArrow}{leftArrow}{leftArrow}{leftArrow}');

    textToolTile.clickToolbarTool("Variables");
    cy.get(".ReactModalPortal").within(() => {
      cy.findByDisplayValue('VarC').should('exist');
      cy.findByRole("button", {name: "OK"}).click();
    });
    // Make sure the text tile now has a chips with VarC
    textToolTile.getTextTile().last().find('.ccrte-variable:contains("VarC")').should('exist');
    textToolTile.enterText('{rightArrow} After chip');
  });

  it('can edit a variable by double clicking', function() {
    textToolTile.getTextTile().last().find('.ccrte-variable').first().dblclick();
    cy.get(".ReactModalPortal").within(() => {
      cy.findByLabelText(/Name/).clear().type("Var B");
      cy.findByRole("button", {name: "OK"}).click();
    });
    // Make sure the text tile now has 2 chips with Var B.
    textToolTile.getTextTile().last().find('.ccrte-variable:contains("Var B")').should('have.length',  2);
    // Make sure the diagram tile now has a card with Var B.
    cy.get('.primary-workspace .canvas-area .diagram-tool [data-testid="quantity-node"]')
      .findByDisplayValue('Var B')
      .should('exist');
  });

  it('can set the value of a variable', function() {
    textToolTile.getTextTile().last().find('.ccrte-variable').first().dblclick();
    cy.get(".ReactModalPortal").within(() => {
      cy.findByLabelText(/Value/).clear().type("1.234");
      cy.findByRole("button", {name: "OK"}).click();
    });
    // Make sure the text tile now has 2 chips with Var B.
    textToolTile.getTextTile().last().find('.ccrte-variable:contains("Var B=1.234")').should('have.length', 2);
  });

  it('verifies restore of variable chip content',()=>{
    canvas.createNewExtraDocumentFromFileMenuWithoutTabs('text tool test','my-work');
    cy.wait(2000);
    textToolTile.getTextTile().should('not.exist');
    //re-open investigation
    canvas.openDocumentWithTitleWithoutTabs(title);
    // Make sure the text tile still has 2 chips with Var B.
    textToolTile.getTextTile().last().find('.ccrte-variable:contains("Var B=1.234")').should('have.length', 2);
    // Make sure the diagram tile still has a card with Var B.
    cy.get('.primary-workspace .canvas-area .diagram-tool [data-testid="quantity-node"]')
      .findByDisplayValue('Var B')
      .should('exist');  
  });

});
