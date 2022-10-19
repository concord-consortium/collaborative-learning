import ClueCanvas from '../../../../support/elements/clue/cCanvas';
import DiagramToolTile from '../../../../support/elements/clue/DiagramToolTile';

let clueCanvas = new ClueCanvas,
  diagramToolTile = new DiagramToolTile;

context('Diagram Tool Tile', function () {
  before(function () {
    const queryParams = "?appMode=qa&fakeClass=5&fakeUser=student:5&qaGroup=5&unit=m2s";
    cy.clearQAData('all');

    cy.visit(queryParams);
    cy.waitForLoad();
    cy.closeResourceTabs();
  });
  describe("Dataflow Tool", () => {
    it("renders dataflow tool tile", () => {
      clueCanvas.addTile("diagram");
      diagramToolTile.getDiagramTile().should("exist");
      diagramToolTile.getDiagramToolbar().should("exist");
      diagramToolTile.getDiagramToolbarButton("button-dialog").should("exist");
      diagramToolTile.getDiagramToolbarButton("button-delete").should("exist");
    });
    it("renders dialogs", () => {
      diagramToolTile.getDiagramToolbarButton("button-dialog").click();
      diagramToolTile.getDiagramDialog().should("exist");
      diagramToolTile.getDiagramDialogCloseButton().click();
      diagramToolTile.getDiagramDialog().should("not.exist");
    });
  });
});
