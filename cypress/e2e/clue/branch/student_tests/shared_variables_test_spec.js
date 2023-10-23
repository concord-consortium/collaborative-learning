import Canvas from '../../../../support/elements/common/Canvas';
import ClueCanvas from '../../../../support/elements/clue/cCanvas';
import TextToolTile from '../../../../support/elements/clue/TextToolTile';
import DiagramToolTile from '../../../../support/elements/clue/DiagramToolTile';

const canvas = new Canvas;
const clueCanvas = new ClueCanvas;
const textToolTile = new TextToolTile;
const diagramToolTile = new DiagramToolTile;

context('Shared Variables', function () {
  const queryParam = "?appMode=qa&fakeClass=5&fakeUser=student:5&qaGroup=5&unit=example-variables";
  // What is the difference between fakeOffering and demoOffering

  let title;
  before(()=>{
    cy.clearQAData('all');
    cy.visit(queryParam);
    cy.waitForLoad();
    // cy.collapseResourceTabs();
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
    const dialogField = (field) => cy.get(`#evd-${field}`);
    const dialogOkButton = () => cy.get(".modal-button").last();
    const textTileVName1 = "varA";
    const textTileVValue1 = "7";
    const textTileVUnit1 = "seconds";
    const textTileVName2 = "varB";
    const textTileVValue2 = "1.234";

    it('can add a variable chip to the text tool with appropriate spacing', function() {
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
      addLastCard();
      cy.get('.primary-workspace .canvas-area .diagram-tool [data-testid="quantity-node"]')
        .findByDisplayValue(textTileVName1)
        .should('exist');
    });

    it('can add a duplicate variable chip to the text tool', function() {
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
    });

    // FIXME: The method for highlighting text using shift+leftarrow that was being used here
    // doesn't seem to work. It was possibly broken by the Slate upgrade, but it also doesn't
    // seem like Cypress supports selecting text like that.
    // it('can pre populate the notes field based on the selected text', function() {
    //   textToolTile.getTextEditor().last().click().type(' 0 time for this{shift}{leftarrow}{leftarrow}{leftarrow}{leftarrow}');
    //   clueCanvas.clickToolbarButton('text', 'new-variable');
    //   dialogField("name").type("new");
    //   dialogField("value").type("1");
    //   dialogField("units").type("hour");
    //   cy.pause();
    //   dialogField("notes").should("have.value", "this");
    //   dialogOkButton().click();
    // });

    it('can edit a variable name', function() {
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
    });
    it('can change the value of a variable', function() {
      textToolTile.getTextTile().last().find('.variable-chip').first().click();
      clueCanvas.clickToolbarButton('text', 'edit-variable');
      cy.get(".custom-modal").should("exist");
      dialogField("value").clear().type(textTileVValue2);
      dialogOkButton().click();
      // Make sure the text tile now has 2 chips with the new variable value.
      textToolTile.getTextTile().last().find(`.variable-chip:contains("${textTileVName2}=${textTileVValue2}")`).should('have.length', 2);
    });

    it('verifies restore of variable chip content',()=>{
      canvas.createNewExtraDocumentFromFileMenuWithoutTabs('text tool test','my-work');
      cy.wait(2000);
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

  // FIXME: these are broken from slate upgrade.
  describe("Drawing tile", () => {
    it('dummy test', function () {
      expect(true).to.equal(true);
    });
  });

    // const diagramTile = () => cy.get(".diagram-tool");
    // const drawTile = () => drawToolTile.getDrawTile().last();
    // const listChip = () => cy.get(`.variable-chip-list .variable-chip`);

  //   it("verify Insert Variable dialog opens on variable button click in drawing tile", () => {
  //     clueCanvas.addTile('drawing');
  //     drawToolTile.getDrawToolInsertVariable().click();
  //     cy.get(".modal-header").should("contain", "Insert Variables");
  //     cy.get(".ReactModalPortal").within(() => {
  //       // cy.findByRole("combobox").type("VarC{enter}");
  //       listChip().last().click();
  //       cy.get(".custom-modal .modal-button").last().click();
  //     });
  //   });
  //   it("verify variables appears in draw tool", () => {
  //     drawTile().find('.drawing-variable:contains("VarC")').should('have.length', 1);
  //   });
  //   it("verify changes in diagram view propagates to draw tool", () => {
  //     // Delete the existing variable card so it won't overlap with the new card
  //     diagramTile().find(".node").click();
  //     diagramToolTile.getDiagramToolbarButton("button-delete", undefined, true).click();

  //     addCard();
  //     diagramTile().find(".variable-info.name[value=VarC]");
  //     diagramTile().find(".variable-info.name[value=VarC]").type('Var D').blur();
  //     // Look for "VarCVarD" because spaces are not allowed in variable names
  //     drawTile().find('.drawing-variable:contains("VarCVarD")').should('exist');
  //   });
  //   it("verify edit variable dialog works", () => {
  //     const editVariableButton = () => drawToolTile.getDrawToolEditVariable();
  //     const customModal = () => cy.get(".custom-modal");
  //     drawToolTile.getDrawTile().last().click();
  //     editVariableButton().should("exist");
  //     editVariableButton().should("be.disabled");
  //     drawTile().find('.drawing-variable:contains("VarC")').click();
  //     editVariableButton().should("be.enabled");
  //     customModal().should("not.exist");
  //     editVariableButton().click();
  //     customModal().should("exist");
  //     cy.get("#evd-units").type("util");
  //     customModal().find(".modal-button").last().click();
  //     customModal().should("not.exist");
  //     diagramTile().find(".variable-info.unit").should("exist");
  //     diagramTile().find(".variable-info.unit").should("have.value", "util");
  //   });
  //   it('deletes variable chip in draw tool', () => {
  //     drawTile().click();
  //     drawToolTile.getDrawToolSelect().click();
  //     drawTile().find('.drawing-variable:contains("VarC")').click();
  //     drawToolTile.getDrawToolDelete().click();
  //     drawTile().find('.drawing-variable:contains("VarCVarD")').should('not.exist');
  //   });
  //   it("verify create new variable", () => {
  //     drawToolTile.getDrawToolNewVariable().click();
  //     cy.get(".modal-header").should("contain", "New Variable");
  //     cy.get(".ReactModalPortal").within(() => {
  //       cy.get("#evd-name").type("VarE");
  //       cy.get("#evd-value").type("5.432");
  //       cy.findByRole("button", {name: "OK"}).click();
  //     });
  //     drawTile().find('.drawing-variable:contains("VarE")').should('have.length', 1);
  //     drawTile().find('.drawing-variable:contains("5.432")').should('have.length', 1);

  //   });
   });
