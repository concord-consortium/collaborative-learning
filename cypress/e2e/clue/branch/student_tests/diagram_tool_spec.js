import ClueCanvas from '../../../../support/elements/clue/cCanvas';
import DiagramToolTile from '../../../../support/elements/clue/DiagramToolTile';
import DrawToolTile from '../../../../support/elements/clue/DrawToolTile';

let clueCanvas = new ClueCanvas,
  diagramToolTile = new DiagramToolTile,
  drawTile = new DrawToolTile;

context('Diagram Tool Tile', function () {
  before(function () {
    const queryParams = "?appMode=qa&fakeClass=5&fakeUser=student:5&qaGroup=5&unit=m2s";
    cy.clearQAData('all');

    cy.visit(queryParams);
    cy.waitForLoad();
    cy.closeResourceTabs();
  });
  describe("Diagram Tool", () => {
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
  describe("Drawing Tool with Variables", () => {
    it("drawing tile has proper toolbar buttons", () => {
      clueCanvas.addTile("drawing");
      drawTile.getDrawTile().should("exist");
      drawTile.getDrawToolNewVariable().should("exist").should("not.be.disabled");
      drawTile.getDrawToolEditVariable().should("exist").should("be.disabled");
    });
    it("new variable dialog works", () => {
      const vName = "variable-name";
      const vValue = "1.2";
      const vUnit = "meter";
      drawTile.getDrawToolNewVariable().click();
      cy.get(".custom-modal").should("exist");
      cy.get("#evd-name").type(vName);
      cy.get("#evd-value").type(vValue);
      cy.get("#evd-units").type(vUnit);
      drawTile.getVariableChip().should("not.exist");
      cy.get(".modal-button").last().click();
      drawTile.getVariableChip().should("exist");
      drawTile.getVariableChip().should("contain", vName);
      drawTile.getVariableChip().should("contain", vValue);
      drawTile.getVariableChip().should("contain", vUnit);
    });
    it("edit variable dialog works", () => {
      const newName = "vn2";
      const newValue = "47";
      const newUnit = "util";
      drawTile.getVariableChip().click();
      drawTile.getDrawToolEditVariable().should("not.be.disabled").click();
      cy.get("#evd-name").type(newName);
      cy.get("#evd-value").type(newValue);
      cy.get("#evd-units").type(newUnit);
      cy.get(".modal-button").last().click();
      drawTile.getVariableChip().should("contain", newName);
      drawTile.getVariableChip().should("contain", newValue);
      drawTile.getVariableChip().should("contain", newUnit);

      it("updates in diagram tile", () => {
        diagramToolTile.getVariableCardField("name").value().should("equal", newName);
        diagramToolTile.getVariableCardField("value").value().should("equal", newValue);
        diagramToolTile.getVariableCardField("unit").value().should("equal", newUnit);
      });
    });
  });
});
