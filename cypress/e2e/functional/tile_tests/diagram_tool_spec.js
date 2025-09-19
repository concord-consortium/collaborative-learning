import ClueCanvas from '../../../support/elements/common/cCanvas';
import DiagramToolTile from '../../../support/elements/tile/DiagramToolTile';
import DrawToolTile from '../../../support/elements/tile/DrawToolTile';
import TextToolTile from '../../../support/elements/tile/TextToolTile';

let clueCanvas = new ClueCanvas,
  diagramTile = new DiagramToolTile,
  drawTile = new DrawToolTile;
const textTile = new TextToolTile;

const cmdKey = Cypress.platform === "darwin" ? "cmd" : "ctrl";
const undoKeystroke = `{${cmdKey}}z`;
const redoKeystroke = `{${cmdKey}}{shift}z`;

function beforeTest() {
  const queryParams = `${Cypress.config("qaVariablesUnitStudent5")}&mouseSensor`;
  cy.visit(queryParams);
  cy.waitForLoad();
  cy.showOnlyDocumentWorkspace();
}

context('Diagram Tool Tile', function () {
  const dialogField = (field) => cy.get(`#evd-${field}`);
  const dialogOkButton = () => cy.get(".modal-button").last();

  it("Shared Variable Tiles (Diagram, Drawing)", () => {

    beforeTest();
    clueCanvas.addTile("diagram");
    clueCanvas.addTile("text");

    // Tile, toolbar, and buttons render
    diagramTile.getDiagramTile().should("exist").click();
    // No variables created, can create but not add or edit.
    clueCanvas.toolbarButtonIsEnabled("diagram", "new-variable");
    clueCanvas.toolbarButtonIsDisabled("diagram", "insert-variable");
    clueCanvas.toolbarButtonIsDisabled("diagram", "edit-variable");
    clueCanvas.toolbarButtonIsEnabled("diagram", "zoom-in");
    clueCanvas.toolbarButtonIsEnabled("diagram", "zoom-out");
    clueCanvas.toolbarButtonIsEnabled("diagram", "fit-view");
    clueCanvas.toolbarButtonIsEnabled("diagram", "toggle-lock");
    clueCanvas.toolbarButtonIsEnabled("diagram", "toggle-navigator");
    clueCanvas.toolbarButtonIsDisabled("diagram", "delete");

    // Title
    const newName = "Test Diagram";
    diagramTile.getTileTitleText().should("contain", "Diagram 1");
    diagramTile.getTileTitleContainer().click();
    diagramTile.getTileTitleContainer().type(newName + '{enter}');
    diagramTile.getTileTitleText().should("contain", newName);

    // Navigator can be hidden and shown
    const navigator = () => diagramTile.getDiagramTile().find(".react-flow__minimap");
    navigator().should("exist");
    clueCanvas.clickToolbarButton("diagram", "toggle-navigator");
    navigator().should("not.exist");
    clueCanvas.clickToolbarButton("diagram", "toggle-navigator");
    navigator().should("exist");

    // Navigator is not shown when tile is not selected
    textTile.getTextTile().click();
    navigator().should("not.exist");
    diagramTile.getDiagramTile().click();
    navigator().should("exist");

    // New variable dialog works
    diagramTile.getVariableCard().should("not.exist");
    clueCanvas.clickToolbarButton("diagram", "new-variable");
    diagramTile.getDiagramDialog().should("exist");
    const name = "name1";
    dialogField("name").should("exist").type(name);
    dialogOkButton().click();
    diagramTile.getVariableCard().should("exist");
    diagramTile.getVariableCardField("name").should("have.value", name);

    // Diagram tile restore upon page reload
    cy.wait(2000);
    cy.reload();
    cy.waitForLoad();
    cy.showOnlyDocumentWorkspace();
    diagramTile.getDiagramTile().should("exist").click();

    diagramTile.getTileTitleText().should("contain", newName);
    diagramTile.getVariableCard().should("exist");
    diagramTile.getVariableCardField("name").should("have.value", name);

    // Insert variable button is disabled when all variables are in the diagram
    clueCanvas.toolbarButtonIsDisabled("diagram", "insert-variable");

    // Lock layout button prevents nodes from being selected
    clueCanvas.clickToolbarButton("diagram", "toggle-lock");
    clueCanvas.toolbarButtonIsDisabled("diagram", "delete");
    diagramTile.getVariableCard().should("have.css", "pointer-events", "none");
    clueCanvas.clickToolbarButton("diagram", "toggle-lock");
    diagramTile.getVariableCard().click();
    clueCanvas.toolbarButtonIsEnabled("diagram", "delete");

    // Edit variable dialog works
    const vName = "name3";
    const vValue = "999.999";
    const vUnit = "C";
    clueCanvas.clickToolbarButton("diagram", "edit-variable");
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

    // Edit directly in variable card
    const eName = "name4";
    const eValue = "888.888";
    const eUnit = "M";
    diagramTile.getVariableCardField("name").clear();
    diagramTile.getVariableCardField("name").type(eName);
    diagramTile.getVariableCardField("value").clear();
    diagramTile.getVariableCardField("value").type(eValue);
    diagramTile.getVariableCardField("unit").clear();
    diagramTile.getVariableCardField("unit").type(eUnit);
    diagramTile.getVariableCardField("name").should("have.value", eName);
    diagramTile.getVariableCardField("value").should("have.value", eValue);
    diagramTile.getVariableCardField("unit").should("have.value", eUnit);

    // Add notes in variable card
    diagramTile.getVariableCardNotesField().should("not.exist");
    diagramTile.getVariableCardDescriptionToggle().click();
    diagramTile.getVariableCardNotesField().should("exist");
    diagramTile.getVariableCardNotesField().clear();
    diagramTile.getVariableCardNotesField().type("test notes");
    diagramTile.getVariableCardNotesField().should("have.value", "test notes");

    // Edit variable card color
    diagramTile.getColorEditorDialog().should("not.exist");
    diagramTile.getVariableCardColorEditButton().click();
    diagramTile.getColorEditorDialog().should("exist");
    diagramTile.getColorPicker().last().click();
    diagramTile.getVariableCard().children().should("have.class", "red");
    diagramTile.getVariableCardColorEditButton().click();
    diagramTile.getColorPicker().eq(3).click();
    diagramTile.getVariableCard().children().should("have.class", "green");

    // Fit view
    clueCanvas.clickToolbarButton("diagram", "fit-view");
    diagramTile.getVariableCard().parent().parent().should("have.attr", "style").and("contain", "scale(2)");

    // Delete button works
    clueCanvas.clickToolbarButton("diagram", "delete");
    diagramTile.getVariableCard().should("not.exist");

    // Insert variable dialog shows unused variables
    clueCanvas.clickToolbarButton("diagram", "insert-variable");
    diagramTile.getDiagramDialog().should("contain.text", "Unused variables:");
    diagramTile.getDiagramDialogCloseButton().click();
    diagramTile.getVariableCard().should("not.exist");

    // Can drag new variable button to create a new variable card
    // This uses dnd-kit so it is actually looking for mouse down/moved/up events, not drag events.
    const draggable = () => diagramTile.getDraggableToolbarButton();
    draggable().should("exist");
    draggable().parent("button").should("have.class", "new-variable");

    draggable().then((button) => {
      const rect = button[0].getBoundingClientRect();
      draggable().trigger('mousedown', { force: true });
      draggable().trigger('mousemove', { force: true, clientX: rect.left+50, clientY: rect.top-200});
      draggable().trigger('mouseup', { force: true });
      cy.wait(300); // wait for the variable card to be fully created, otherwise undo fails
    });

    diagramTile.getVariableCard().should("exist");

    // Can undo previous step by pressing control+z or command+z on the keyboard
    cy.get("body").type(undoKeystroke);
    diagramTile.getVariableCard().should("not.exist");

    // Can redo previous step by pressing control+shift+z or command+shift+z on the keyboard
    cy.get("body").type(redoKeystroke);
    diagramTile.getVariableCard().should("exist");

    cy.log("Make sure only one diagram tile is allowed");
    clueCanvas.addTile("diagram");
    clueCanvas.verifyToolDisabled("diagram");
    clueCanvas.deleteTile("diagram");
    clueCanvas.verifyToolEnabled("diagram");
    clueCanvas.addTile("diagram");
    diagramTile.getDiagramTile().should("exist");
  });

  it("Drawing tile, text tile, toolbar, dialogs, and interactions between tiles", () => {
    beforeTest();

    clueCanvas.addTile("diagram");
    clueCanvas.addTile("drawing");
    clueCanvas.addTile("text");

    // Draw tile and toolbar buttons render
    drawTile.getDrawTile().should("exist");
    drawTile.getDrawTile().first().click();
    drawTile.getDrawToolNewVariable().should("exist").should("be.enabled");
    drawTile.getDrawToolEditVariable().should("exist").should("be.disabled");
    drawTile.getDrawToolInsertVariable().should("exist").should("be.disabled");

    // Text tile and editor render
    textTile.getTextTile().should("exist");
    textTile.getTextEditor().should("exist");

    // New variable dialog works
    const vName = "variable-name";
    const vNameProcessed = "variablename";
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
    drawTile.getVariableChip().should("contain", vNameProcessed);
    drawTile.getVariableChip().should("contain", vValue);
    drawTile.getVariableChip().should("contain", vUnit);

    // Diagram tile can insert variable created by another tile
    const dialogChip = () => diagramTile.getDiagramDialog().find(".variable-chip");
    diagramTile.getDiagramTile().click();
    diagramTile.getVariableCard().should("not.exist");
    clueCanvas.clickToolbarButton("diagram", "insert-variable");
    diagramTile.getDiagramDialog().should("contain.text", "other tiles:");
    dialogChip().click();
    dialogOkButton().click();
    diagramTile.getVariableCard().should("exist");
    clueCanvas.toolbarButtonIsDisabled("diagram", "insert-variable");

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

    // Editing variable in diagram tile also changes it in drawing tile
    const eName = "vn3";
    const eValue = "2.5";
    const eUnit = "meter";
    diagramTile.getVariableCardField("name").clear();
    diagramTile.getVariableCardField("name").type(eName);
    diagramTile.getVariableCardField("value").clear();
    diagramTile.getVariableCardField("value").type(eValue);
    diagramTile.getVariableCardField("unit").clear();
    diagramTile.getVariableCardField("unit").type(eUnit);
    diagramTile.getVariableCardField("name").should("have.value", eName);
    diagramTile.getVariableCardField("value").should("have.value", eValue);
    diagramTile.getVariableCardField("unit").should("have.value", eUnit);

    drawTile.getDrawTile().click();
    drawTile.getVariableChip().should("contain", eName);
    drawTile.getVariableChip().should("contain", eValue);
    drawTile.getVariableChip().should("contain", eUnit);

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
    diagramTile.getVariableCardField("name").should("have.value", eName);
    diagramTile.getVariableCardField("name").clear();
    textTile.getTextTile().click();
    textTile.enterText("Hello");
    cy.get("body").type(undoKeystroke);
    diagramTile.getVariableCardField("name").should("have.value", "");
    textTile.getTextTile().should("contain", "Hell");
  });

  it("Undo Redo Actions", () => {
    beforeTest();

    // Creation - Undo/Redo
    clueCanvas.addTile('diagram');
    diagramTile.getDiagramTile().should("exist");
    clueCanvas.getUndoTool().should("not.have.class", "disabled");
    clueCanvas.getRedoTool().should("have.class", "disabled");
    clueCanvas.getUndoTool().click();
    diagramTile.getDiagramTile().should("not.exist");
    clueCanvas.getUndoTool().should("have.class", "disabled");
    clueCanvas.getRedoTool().should("not.have.class", "disabled");
    clueCanvas.getRedoTool().click();
    diagramTile.getDiagramTile().should("exist");
    clueCanvas.getUndoTool().should("not.have.class", "disabled");
    clueCanvas.getRedoTool().should("have.class", "disabled");

    diagramTile.getDiagramTile().should("exist").click();
    clueCanvas.clickToolbarButton("diagram", "new-variable");
    diagramTile.getDiagramDialog().should("exist");
    const name = "name1";
    dialogField("name").should("exist").type(name);
    dialogOkButton().click();
    diagramTile.getVariableCard().should("exist");

    //undo redo
    clueCanvas.getUndoTool().click();
    diagramTile.getVariableCard().should("not.exist");
    clueCanvas.getRedoTool().click();
    diagramTile.getVariableCard().should("exist");

    // undo redo on text tile after inserting a variable card
    const dialogChip = () => diagramTile.getDiagramDialog().find(".variable-chip");
    clueCanvas.addTile("text");
    textTile.getTextTile().click();
    clueCanvas.clickToolbarButton('text', 'insert-variable');
    diagramTile.getDiagramDialog().should("contain.text", "other tiles:");
    dialogChip().click();
    dialogOkButton().click();
    textTile.getVariableChip().should("exist");
    clueCanvas.getUndoTool().click();
    textTile.getVariableChip().should("not.exist");
    clueCanvas.getRedoTool().click();
    textTile.getVariableChip().should("exist");
    clueCanvas.getUndoTool().click();

    //undo redo on text tile after adding a new variable
    textTile.getTextTile().click();
    clueCanvas.clickToolbarButton('text', 'new-variable');
    dialogField("name").should("exist").type("name2");
    dialogOkButton().click();
    textTile.getVariableChip().should("exist");
    clueCanvas.getUndoTool().click();
    textTile.getVariableChip().should("not.exist");
    clueCanvas.getRedoTool().click();
    textTile.getVariableChip().should("exist");
  });
});
