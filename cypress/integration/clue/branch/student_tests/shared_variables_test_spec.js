import ClueCanvas from '../../../../support/elements/clue/cCanvas';
import TextToolTile from '../../../../support/elements/clue/TextToolTile';

const clueCanvas = new ClueCanvas;
const textToolTile = new TextToolTile;

context('Shared Variables', function () {
  const queryParam = "?appMode=qa&fakeClass=5&fakeUser=student:5&demoOffering=5&problem=1.1&qaGroup=5&unit=m2s";
  // What is the difference between fakeOffering and demoOffering

  before(()=>{
    cy.clearQAData('all');
    cy.visit(queryParam);
    cy.waitForLoad();
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
});
