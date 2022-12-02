import Canvas from '../../../../support/elements/common/Canvas';
import ClueCanvas from '../../../../support/elements/clue/cCanvas';
import TextToolTile from '../../../../support/elements/clue/TextToolTile';
import DrawToolTile from '../../../../support/elements/clue/DrawToolTile';
import DiagramToolTile from '../../../../support/elements/clue/DiagramToolTile';

const canvas = new Canvas;
const clueCanvas = new ClueCanvas;
const textToolTile = new TextToolTile;
const drawToolTile = new DrawToolTile;
const diagramToolTile = new DiagramToolTile;

context('Shared Variables', function () {
  const queryParam = "?appMode=qa&fakeClass=5&fakeUser=student:5&qaGroup=5&unit=example-variables";
  // What is the difference between fakeOffering and demoOffering

  let title;
  before(()=>{
    cy.clearQAData('all');
    cy.visit(queryParam);
    cy.waitForLoad();
    // cy.closeResourceTabs();
    cy.get('.primary-workspace [data-test=personal-doc-title]')
    .then(($canvasTitle)=>{
        title = $canvasTitle.text().trim();
        cy.log('title is: '+title);
    });
  });

  const addCard = (last) => {
    diagramToolTile.getDiagramToolbarButton("button-insert-variable").click();
    if (last) {
      cy.get(".custom-modal .variable-chip").last().click();
    } else {
      cy.get(".custom-modal .variable-chip").first().click();
    }
    cy.get(".custom-modal .modal-button").last().click();
  };

  const addLastCard = () => addCard(true);

  describe("Text tile", () => {
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
      addLastCard();
      cy.get('.primary-workspace .canvas-area .diagram-tool [data-testid="quantity-node"]')
        .findByDisplayValue('Var A')
        .should('exist');
    });

    it('can add a duplicate variable chip to the text tool', function() {
      // Note that when the chip is focused you can't type so we have to use
      // rightArrow to move off of the chip
      // We aren't using textToolTile.enterText because that calls focus() which seems
      // to mess up the cursor position in Electron
      textToolTile.getTextEditor().last().type('Second Chip:');
      textToolTile.getTextTile().last().should('contain', 'Second Chip');
      textToolTile.clickToolbarTool("Variables");
      cy.get(".ReactModalPortal").within(() => {
        cy.findByRole("combobox").type("Var{enter}");
        cy.findByRole("button", {name: "OK"}).click();
      });
      // Make sure the text tile now has 2 chips with Var A.
      textToolTile.getTextTile().last().find('.variable-chip:contains("Var A")').should('have.length', 2);
    });

    it('can pre populate the name field based on the selected text', function() {
      // textToolTile.enterText uses `focus` which messes up the cursor position in Electron.
      // So instead we click on the text tile, to do position the cursor and cause the focus event.
      textToolTile.getTextTile().last().find('.variable-chip:contains("Var A")').last().click();

      // Note that when the chip is focused you can't type so we have to use
      // rightArrow to move off of the chip
      textToolTile.getTextEditor().last().type('{rightArrow} VarC{shift}{leftArrow}{leftArrow}{leftArrow}{leftArrow}');

      textToolTile.clickToolbarTool("Variables");
      cy.get(".ReactModalPortal").within(() => {
        cy.findByDisplayValue('VarC').should('exist');
        cy.findByRole("button", {name: "OK"}).click();
      });
      // Make sure the text tile now has a chips with VarC
      textToolTile.getTextTile().last().find('.variable-chip:contains("VarC")').should('exist');
      textToolTile.getTextEditor().last().type('{rightArrow} After chip');
    });

    it('can edit a variable by double clicking', function() {
      textToolTile.getTextTile().last().find('.variable-name').first().dblclick();
      cy.get(".ReactModalPortal").within(() => {
        cy.findByLabelText(/Name/).clear().type("Var B");
        cy.findByRole("button", {name: "OK"}).click();
      });
      // Make sure the text tile now has 2 chips with Var B.
      textToolTile.getTextTile().last().find('.variable-chip:contains("Var B")').should('have.length',  2);
      // Make sure the diagram tile now has a card with Var B.
      cy.get('.primary-workspace .canvas-area .diagram-tool [data-testid="quantity-node"]')
        .findByDisplayValue('Var B')
        .should('exist');
    });

    it('can set the value of a variable', function() {
      textToolTile.getTextTile().last().find('.variable-chip').first().dblclick();
      cy.get(".ReactModalPortal").within(() => {
        cy.findByLabelText(/Value/).clear().type("1.234");
        cy.findByRole("button", {name: "OK"}).click();
      });
      // Make sure the text tile now has 2 chips with Var B.
      textToolTile.getTextTile().last().find('.variable-chip:contains("Var B=1.234")').should('have.length', 2);
    });

    it('verifies restore of variable chip content',()=>{
      canvas.createNewExtraDocumentFromFileMenuWithoutTabs('text tool test','my-work');
      cy.wait(2000);
      textToolTile.getTextTile().should('not.exist');
      //re-open investigation
      canvas.openDocumentWithTitleWithoutTabs(title);
      // Make sure the text tile still has 2 chips with Var B.
      textToolTile.getTextTile().last().find('.variable-chip:contains("Var B=1.234")').should('have.length', 2);
      // Make sure the diagram tile still has a card with Var B.
      cy.get('.primary-workspace .canvas-area .diagram-tool [data-testid="quantity-node"]')
        .findByDisplayValue('Var B')
        .should('exist');
    });
  });

  describe("Drawing tile", () => {
    const diagramTile = () => cy.get(".diagram-tool");
    const drawTile = () => drawToolTile.getDrawTile().last();
    const listChip = () => cy.get(`.variable-chip-list .variable-chip`);
    it("verify Insert Variable dialog opens on variable button click in drawing tile", () => {
      clueCanvas.addTile('drawing');
      drawToolTile.getDrawToolInsertVariable().click();
      cy.get(".modal-header").should("contain", "Insert Variables");
      cy.get(".ReactModalPortal").within(() => {
        // cy.findByRole("combobox").type("VarC{enter}");
        listChip().last().click();
        cy.get(".custom-modal .modal-button").last().click();
      });
    });
    it("verify variables appears in draw tool", () => {
      drawTile().find('.drawing-variable:contains("VarC")').should('have.length', 1);
    });
    it("verify changes in diagram view propagates to draw tool", () => {
      // Delete the existing variable card so it won't overlap with the new card
      diagramTile().find(".node").click();
      diagramToolTile.getDiagramToolbarButton("button-delete", undefined, true).click();

      addCard();
      diagramTile().find(".variable-info.name[value=VarC]");
      diagramTile().find(".variable-info.name[value=VarC]").type('Var D').blur();
      // Look for "VarCVarD" because spaces are not allowed in variable names
      drawTile().find('.drawing-variable:contains("VarCVarD")').should('exist');
    });
    it("verify edit variable dialog works", () => {
      const editVariableButton = () => drawToolTile.getDrawToolEditVariable();
      const customModal = () => cy.get(".custom-modal");
      drawToolTile.getDrawTile().last().click();
      editVariableButton().should("exist");
      editVariableButton().should("be.disabled");
      drawTile().find('.drawing-variable:contains("VarC")').click();
      editVariableButton().should("be.enabled");
      customModal().should("not.exist");
      editVariableButton().click();
      customModal().should("exist");
      cy.get("#evd-units").type("util");
      customModal().find(".modal-button").last().click();
      customModal().should("not.exist");
      diagramTile().find(".variable-info.unit").should("exist");
      diagramTile().find(".variable-info.unit").should("have.value", "util");
    });
    it('deletes variable chip in draw tool', () => {
      drawTile().click();
      drawToolTile.getDrawToolSelect().click();
      drawTile().find('.drawing-variable:contains("VarC")').click();
      drawToolTile.getDrawToolDelete().click();
      drawTile().find('.drawing-variable:contains("VarCVarD")').should('not.exist');
    });
    it("verify create new variable", () => {
      drawToolTile.getDrawToolNewVariable().click();
      cy.get(".modal-header").should("contain", "New Variable");
      cy.get(".ReactModalPortal").within(() => {
        cy.get("#evd-name").type("VarE");
        cy.get("#evd-value").type("5.432");
        cy.findByRole("button", {name: "OK"}).click();
      });
      drawTile().find('.drawing-variable:contains("VarE")').should('have.length', 1);
      drawTile().find('.drawing-variable:contains("5.432")').should('have.length', 1);

    });
  });
});
