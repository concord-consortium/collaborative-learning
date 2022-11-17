import ClueCanvas from '../../../../support/elements/clue/cCanvas';
import DiagramToolTile from '../../../../support/elements/clue/DiagramToolTile';
import DrawToolTile from '../../../../support/elements/clue/DrawToolTile';

let clueCanvas = new ClueCanvas,
  diagramToolTile = new DiagramToolTile,
  drawTile = new DrawToolTile;

context('Diagram Tool Tile', function () {
  const dialogField = (field) => cy.get(`#evd-${field}`);
  const dialogOkButton = () => cy.get(".modal-button").last();
  before(function () {
    const queryParams = "?appMode=qa&fakeClass=5&fakeUser=student:5&qaGroup=5&unit=m2s";
    cy.clearQAData('all');

    cy.visit(queryParams);
    cy.waitForLoad();
    cy.closeResourceTabs();
  });
  describe("Diagram Tile", () => {
    it("renders diagram tile", () => {
      clueCanvas.addTile("diagram");
      diagramToolTile.getDiagramTile().should("exist");
      diagramToolTile.getDiagramToolbar().should("exist");
      diagramToolTile.getDiagramToolbarButton("button-dialog").should("exist");
      diagramToolTile.getDiagramToolbarButton("button-delete").should("exist");
    });
    it("renders dialogs", () => {
      diagramToolTile.getDiagramToolbarButton("button-dialog").should("be.disabled");
      // TODO Add these tests back in after we have a convenient way of adding cards to the tile
      // diagramToolTile.getDiagramToolbarButton("button-dialog").click();
      // diagramToolTile.getDiagramDialog().should("exist");
      // diagramToolTile.getDiagramDialogCloseButton().click();
      // diagramToolTile.getDiagramDialog().should("not.exist");
    });
  });
  describe("Drawing Tile with Variables", () => {
    const dialogInsertVariableButton = () => diagramToolTile.getDiagramToolbarButton("button-insert-variable");
    it("drawing tile has proper toolbar buttons", () => {
      clueCanvas.addTile("drawing");
      drawTile.getDrawTile().should("exist");
      drawTile.getDrawToolNewVariable().should("exist").should("not.be.disabled");
      drawTile.getDrawToolEditVariable().should("exist").should("be.disabled");
      drawTile.getDrawToolInsertVariable().should("exist").should("be.disabled");
    });
    it("new variable dialog works", () => {
      const vName = "variable-name";
      const vValue = "1.2";
      const vUnit = "meter";
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
    });
    it("can add the new variable to the diagram tile", () => {
      const dialogChip = () => diagramToolTile.getDiagramDialog().find(".variable-chip");
      diagramToolTile.getVariableCard().should("not.exist");
      dialogInsertVariableButton().should("be.enabled").click();
      diagramToolTile.getDiagramDialog().should("contain.text", "other tiles:");
      dialogChip().click();
      dialogOkButton().click();
      diagramToolTile.getVariableCard().should("exist");
      dialogInsertVariableButton().should("be.disabled");
    });
    const newName = "vn2";
    const newValue = "47";
    const newUnit = "util";
    it("edit variable dialog works", () => {
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
    });
    it("updates in diagram tile", () => {
      diagramToolTile.getVariableCardField("name").should("have.value", newName);
      diagramToolTile.getVariableCardField("value").should("have.value", newValue);
      diagramToolTile.getVariableCardField("unit").should("have.value", newUnit);
    });
    it("diagram tile edit variable dialog", () => {
      // TODO Move this to the diagram tile section when the new variable dialog is added to it
      const vName = "name3";
      const vValue = "999.999";
      const vUnit = "C";
      diagramToolTile.getVariableCard().click();
      diagramToolTile.getDiagramToolbarButton("button-dialog", undefined, true).should("not.be.disabled").click();
      dialogField("name").clear();
      dialogField("name").type(vName);
      dialogField("value").clear();
      dialogField("value").type(vValue);
      dialogField("units").clear();
      dialogField("units").type(vUnit);
      dialogOkButton().click();
      diagramToolTile.getVariableCardField("name").should("have.value", vName);
      diagramToolTile.getVariableCardField("value").should("have.value", vValue);
      diagramToolTile.getVariableCardField("unit").should("have.value", vUnit);
    });
    it("insert variable dialog works", () => {
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
    });
    it("diagram tile delete works", () => {
      const deleteButton = () => diagramToolTile.getDiagramToolbarButton("button-delete", undefined, true);
      drawTile.getVariableChip().click();
      drawTile.getDrawToolDelete().click();
      diagramToolTile.getDiagramTile().click();
      deleteButton().should("be.disabled");
      diagramToolTile.getVariableCard().click();
      deleteButton().should("be.enabled").click();
      diagramToolTile.getVariableCard().should("not.exist");
      dialogInsertVariableButton().click();
      diagramToolTile.getDiagramDialog().should("contain.text", "Unused variables:");
      diagramToolTile.getDiagramDialogCloseButton().click();
    });
  });
});
