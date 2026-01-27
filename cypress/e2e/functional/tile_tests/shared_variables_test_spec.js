import Canvas from '../../../support/elements/common/Canvas';
import ClueCanvas from '../../../support/elements/common/cCanvas';
import TextToolTile from '../../../support/elements/tile/TextToolTile';
import DiagramToolTile from '../../../support/elements/tile/DiagramToolTile';

const canvas = new Canvas;
const clueCanvas = new ClueCanvas;
const textToolTile = new TextToolTile;
const diagramToolTile = new DiagramToolTile;

function beforeTest() {
  const queryParam = `${Cypress.config("qaVariablesUnitStudent5")}`;
  cy.visit(queryParam);
  cy.waitForLoad();
}

context('Shared Variables', function () {
  it('Text Tile', function () {
    beforeTest();

    cy.get('.primary-workspace [data-test=personal-doc-title]')
      .then(($canvasTitle) => {
        let title = $canvasTitle.text().trim();

        const addCard = (last) => {
          clueCanvas.clickToolbarButton("diagram", "insert-variable");
          if (last) {
            cy.get(".custom-modal .variable-chip").last().click();
          } else {
            cy.get(".custom-modal .variable-chip").first().click();
          }
          cy.get(".custom-modal .modal-button").last().click();
        };

        const addLastCard = () => addCard(true);

        const dialogField = (field) => cy.get(`#evd-${field}`);
        const dialogOkButton = () => cy.get(".modal-button").last();
        const textTileVName1 = "varA";
        const textTileVValue1 = "7";
        const textTileVUnit1 = "seconds";
        const textTileVName2 = "varB";
        const textTileVValue2 = "1.23";

        cy.log('can add a variable chip to the text tool with appropriate spacing');
        clueCanvas.addTile('text');
        clueCanvas.addTile('diagram');

        textToolTile.enterText('Hello World!');
        textToolTile.getTextTile().last().should('contain', 'Hello World!');
        textToolTile.getTextTile().last().should('not.contain', ' Hello World!');
        textToolTile.enterText("{moveToStart}");
        clueCanvas.clickToolbarButton('text', 'new-variable');
        cy.get(".custom-modal").should("exist");
        dialogField("name").type(textTileVName1);
        dialogField("value").type(textTileVValue1);
        dialogField("units").type(textTileVUnit1);
        textToolTile.getVariableChip().should("not.exist");
        dialogOkButton().click();
        textToolTile.getVariableChip().should("exist");
        textToolTile.getVariableChip().should("contain", textTileVName1);
        textToolTile.getVariableChip().should("contain", textTileVValue1);
        textToolTile.getVariableChip().should("contain", textTileVUnit1);
        textToolTile.getTextTile().last().should('contain', ' Hello World!');
        // Make sure the diagram tile now has a card with variable name.
        diagramToolTile.getDiagramTile().click();
        addLastCard();
        cy.get('.primary-workspace .canvas-area .diagram-tool [data-testid="quantity-node"]')
          .findByDisplayValue(textTileVName1)
          .should('exist');

        cy.log('can add a duplicate variable chip to the text tool');
        textToolTile.enterText('Second Chip:');
        textToolTile.getTextTile().last().should('contain', 'Second Chip:');
        textToolTile.getTextTile().last().should('not.contain', 'Second Chip: ');
        clueCanvas.clickToolbarButton('text', 'insert-variable');
        cy.get(".custom-modal").should("exist");
        cy.get(".variable-chip-list .variable-chip").click();
        dialogOkButton().click();
        textToolTile.getTextTile().last().should('contain', 'Second Chip: ');
        // Make sure the text tile now has 2 chips with the same name.
        textToolTile.getTextTile().last().find(`.variable-chip:contains("${textTileVName1}")`).should('have.length', 2);

        cy.log('can edit a variable name');
        textToolTile.getTextTile().last().find('.variable-name').first().click();
        clueCanvas.clickToolbarButton('text', 'edit-variable');
        cy.get(".custom-modal").should("exist");
        dialogField("name").clear().type(textTileVName2);
        dialogOkButton().click();
        // Make sure the text tile now has 2 chips with the new variable name.
        textToolTile.getTextTile().last().find(`.variable-chip:contains("${textTileVName2}")`).should('have.length', 2);
        // Make sure the diagram tile now has a card with the new variable name.
        cy.get('.primary-workspace .canvas-area .diagram-tool [data-testid="quantity-node"]')
          .findByDisplayValue(textTileVName2)
          .should('exist');

        cy.log('can change the value of a variable');
        textToolTile.getTextTile().last().find('.variable-chip').first().click();
        clueCanvas.clickToolbarButton('text', 'edit-variable');
        cy.get(".custom-modal").should("exist");
        dialogField("value").clear().type(textTileVValue2);
        dialogOkButton().click();
        // Make sure the text tile now has 2 chips with the new variable value.
        textToolTile.getTextTile().last().find(`.variable-chip:contains("${textTileVName2}=${textTileVValue2}")`).should('have.length', 2);

        cy.log('verifies restore of variable chip content');
        canvas.createNewExtraDocumentFromFileMenu('text tool test', 'my-work', true);
        textToolTile.getTextTile().should('not.exist');
        //re-open investigation
        canvas.openDocumentWithTitleWithoutTabs(title);
        // Make sure the text tile still has 2 chips with Var B.
        textToolTile.getTextTile().last().find(`.variable-chip:contains("${textTileVName2}=${textTileVValue2}")`).should('have.length', 2);
        // Make sure the diagram tile still has a card with Var B.
        cy.get('.primary-workspace .canvas-area .diagram-tool [data-testid="quantity-node"]')
          .findByDisplayValue(textTileVName2)
          .should('exist');
      });
  });
});
