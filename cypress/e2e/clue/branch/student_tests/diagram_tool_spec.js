import ClueCanvas from '../../../../support/elements/clue/cCanvas';
import DiagramToolTile from '../../../../support/elements/clue/DiagramToolTile';
import DrawToolTile from '../../../../support/elements/clue/DrawToolTile';
import TextToolTile from '../../../../support/elements/clue/TextToolTile';

let clueCanvas = new ClueCanvas,
  diagramTile = new DiagramToolTile,
  drawTile = new DrawToolTile,
  textTile = new TextToolTile;

const cmdKey = Cypress.platform === "darwin" ? "cmd" : "ctrl";
const undoKeystroke = `{${cmdKey}}z`;
const redoKeystroke = `{${cmdKey}}{shift}z`;

context('Diagram Tool Tile', function () {
  const dialogField = (field) => cy.get(`#evd-${field}`);
  // The following functions specify undefined, true as parameters to avoid clicking on the tile and therefore deselecting a variable card
  const diagramNewVariableButton = () => diagramTile.getDiagramToolbarButton("button-add-variable", undefined, true);
  const diagramInsertVariableButton = () => diagramTile.getDiagramToolbarButton("button-insert-variable", undefined, true);
  const diagramEditVariableButton = () => diagramTile.getDiagramToolbarButton("button-edit-variable", undefined, true);
  const lockLayoutButton = () => diagramTile.getDiagramToolbarButton("button-lock-layout", undefined, true);
  const hideNavigatorButton = () => diagramTile.getDiagramToolbarButton("button-hide-navigator", undefined, true);
  const diagramDeleteButton = () => diagramTile.getDiagramToolbarButton("button-delete", undefined, true);
  const dialogOkButton = () => cy.get(".modal-button").last();
  beforeEach(function () {
    const queryParams = "?appMode=qa&fakeClass=5&fakeUser=student:5&qaGroup=5&unit=m2s";
    cy.clearQAData('all');

    cy.visit(queryParams);
    cy.waitForLoad();
    cy.closeResourceTabs();
  });
  describe("Shared Variable Tiles (Diagram, Drawing)", () => {
    it("Diagram tile, toolbar, and dialogs", () => {
      clueCanvas.addTile("diagram");

      // Tile, toolbar, and buttons render
      diagramTile.getDiagramTile().should("exist").click();
      diagramTile.getDiagramToolbar().should("exist");
      diagramNewVariableButton().should("exist");
      diagramInsertVariableButton().should("exist").should("be.disabled"); // Insert variable button is disabled when no variables have been created
      diagramEditVariableButton().should("exist").should("be.disabled");
      diagramTile.getDiagramToolbarButton("button-zoom-in").should("be.enabled");
      diagramTile.getDiagramToolbarButton("button-zoom-out").should("be.enabled");
      diagramTile.getDiagramToolbarButton("button-fit-view").should("be.enabled");
      lockLayoutButton().should("exist");
      hideNavigatorButton().should("exist");
      diagramDeleteButton().should("exist").should("be.disabled");

      // Navigator can be hidden and shown
      const navigator = () => diagramTile.getDiagramTile().find(".react-flow__minimap");
      navigator().should("exist");
      hideNavigatorButton().click();
      navigator().should("not.exist");
      hideNavigatorButton().click();
      navigator().should("exist");

      // New variable dialog works
      diagramTile.getVariableCard().should("not.exist");
      diagramNewVariableButton().click();
      diagramTile.getDiagramDialog().should("exist");
      const name = "name1";
      dialogField("name").should("exist").type(name);
      dialogOkButton().click();
      diagramTile.getVariableCard().should("exist");
      diagramTile.getVariableCardField("name").should("have.value", name);

      // Insert variable button is disabled when all variables are in the diagram
      diagramInsertVariableButton().should("be.disabled");

      // Lock layout button prevents nodes from being selected
      lockLayoutButton().click();
      diagramDeleteButton().should("be.disabled");
      diagramTile.getVariableCard().should("have.css", "pointer-events", "none");
      lockLayoutButton().click();
      diagramTile.getVariableCard().click();
      diagramDeleteButton().should("be.enabled");

      // Edit variable dialog works
      const vName = "name3";
      const vValue = "999.999";
      const vUnit = "C";
      diagramEditVariableButton().should("be.enabled").click();
      dialogField("name").clear();
      dialogField("name").type(vName);
      dialogField("value").clear();
      dialogField("value").type(vValue);
      dialogField("units").clear();
      dialogField("units").type(vUnit);
      dialogOkButton().click();
      diagramTile.getVariableCardField("name").should("have.value", vName);
      diagramTile.getVariableCardField("value").should("have.value", vValue);
      diagramTile.getVariableCardField("unit").should("have.value", vUnit);

      // Delete button works
      diagramDeleteButton().should("be.enabled").click();
      diagramTile.getVariableCard().should("not.exist");

      // Insert variable dialog shows unused variables
      diagramInsertVariableButton().should("be.enabled").click();
      diagramTile.getDiagramDialog().should("contain.text", "Unused variables:");
      diagramTile.getDiagramDialogCloseButton().click();

      // Can drag new variable button to create a new variable card
      const dataTransfer = new DataTransfer;
      const draggable = () => diagramTile.getDiagramToolbar(undefined, true).find("div[role=button]").first();
      draggable().focus().trigger("dragstart", { dataTransfer });
      diagramTile.getDiagramTile().trigger("drop", { dataTransfer });
      draggable().trigger("dragend");
      diagramTile.getVariableCard().should("exist");

      // Can undo previous step by pressing control+z or command+z on the keyboard
      cy.get("body").type(undoKeystroke);
      diagramTile.getVariableCard().should("not.exist");

      // Can redo previous step by pressing control+shift+z or command+shift+z on the keyboard
      cy.get("body").type(redoKeystroke);
      diagramTile.getVariableCard().should("exist");
    });

    it("Drawing tile, text tile, toolbar, dialogs, and interactions between tiles", () => {
      clueCanvas.addTile("diagram");
      clueCanvas.addTile("drawing");
      clueCanvas.addTile("text");

      // Draw tile and toolbar buttons render
      drawTile.getDrawTile().should("exist");
      drawTile.getDrawToolNewVariable().should("exist").should("be.enabled");
      drawTile.getDrawToolEditVariable().should("exist").should("be.disabled");
      drawTile.getDrawToolInsertVariable().should("exist").should("be.disabled");

      // Text tile and editor render
      textTile.getTextTile().should("exist");
      textTile.getTextEditor().should("exist");

      // New variable dialog works
      const vName = "variable-name";
      const vValue = "1.2";
      const vUnit = "meter";
      drawTile.getDrawTile().click();
      drawTile.getDrawToolNewVariable().click();
      cy.get(".custom-modal").should("exist");
      dialogField("name").type(vName);
      dialogField("value").type(vValue);
      dialogField("units").type(vUnit);
      drawTile.getVariableChip().should("not.exist");
      dialogOkButton().click();
      drawTile.getVariableChip().should("exist");
      drawTile.getVariableChip().should("contain", vName);
      drawTile.getVariableChip().should("contain", vValue);
      drawTile.getVariableChip().should("contain", vUnit);

      // Diagram tile can insert variable created by another tile
      const dialogChip = () => diagramTile.getDiagramDialog().find(".variable-chip");
      diagramTile.getDiagramTile().click();
      diagramTile.getVariableCard().should("not.exist");
      diagramInsertVariableButton().should("be.enabled").click();
      diagramTile.getDiagramDialog().should("contain.text", "other tiles:");
      dialogChip().click();
      dialogOkButton().click();
      diagramTile.getVariableCard().should("exist");
      diagramInsertVariableButton().should("be.disabled");

      // Draw tile edit variable dialog works
      const newName = "vn2";
      const newValue = "47";
      const newUnit = "util";
      drawTile.getDrawTile().click();
      drawTile.getVariableChip().click();
      drawTile.getDrawToolEditVariable().should("not.be.disabled").click();
      dialogField("name").clear();
      dialogField("name").type(newName);
      dialogField("value").clear();
      dialogField("value").type(newValue);
      dialogField("units").clear();
      dialogField("units").type(newUnit);
      dialogOkButton().click();
      drawTile.getVariableChip().should("contain", newName);
      drawTile.getVariableChip().should("contain", newValue);
      drawTile.getVariableChip().should("contain", newUnit);

      // Editing variable in drawing tile also changes it in dialog tile
      diagramTile.getVariableCardField("name").should("have.value", newName);
      diagramTile.getVariableCardField("value").should("have.value", newValue);
      diagramTile.getVariableCardField("unit").should("have.value", newUnit);

      // Draw tile insert variable dialog works
      const listChip = otherClass => cy.get(`.variable-chip-list .variable-chip${otherClass || ""}`);
      drawTile.getDrawTile().click();
      drawTile.getVariableChip().click();
      drawTile.getDrawToolDelete().click();
      drawTile.getVariableChip().should("not.exist");
      drawTile.getDrawToolInsertVariable().click();
      listChip().click();
      listChip(".selected").should("exist");
      listChip().click();
      listChip(".selected").should("not.exist");
      listChip().click();
      dialogOkButton().click();
      drawTile.getVariableChip().should("exist");
      drawTile.getVariableChip().click();
      drawTile.getDrawToolDelete().click();

      // Undoing previous step in diagram tile by pressing control+z or command+z on
      // the keyboard does not undo the most recent step in a different tile
      diagramTile.getDiagramTile().click();
      diagramTile.getVariableCardField("name").should("have.value", newName);
      diagramTile.getVariableCardField("name").clear();
      textTile.getTextTile().click();
      textTile.enterText("Hello");
      cy.get("body").type(undoKeystroke);
      diagramTile.getVariableCardField("name").should("have.value", "");
      textTile.getTextTile().should("contain", "Hell");
    });
  });
});
