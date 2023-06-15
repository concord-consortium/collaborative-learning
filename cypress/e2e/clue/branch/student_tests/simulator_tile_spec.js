import ClueCanvas from '../../../../support/elements/clue/cCanvas';
import SimulatorTile from '../../../../support/elements/clue/SimulatorTile';

let clueCanvas = new ClueCanvas;
let simulatorTile = new SimulatorTile;

context('Simulator Tile', function () {
  beforeEach(function () {
    const queryParams = "?appMode=qa&fakeClass=5&fakeUser=student:5&qaGroup=5&mouseSensor&unit=https://collaborative-learning.concord.org/branch/simulator-tile/curriculum/dataflow/dataflow-example.json";
    cy.clearQAData('all');
    cy.visit(queryParams);
    cy.waitForLoad();
    cy.closeResourceTabs();
  });
  describe("Simulator Tile", () => {
    it("renders simulator tile", () => {
      simulatorTile.getSimulatorTile().should("not.exist");
      clueCanvas.addTile("simulator");
      simulatorTile.getSimulatorTile().should("exist");
      simulatorTile.getTileTitle().should("exist");
      simulatorTile.getSimulatorTile().should("contain.text", "sensor1");
      simulatorTile.getSimulatorTile().should("contain.text", "output1");
    });
    it("edit tile title", () => {
      const newName = "Test Simulation";
      clueCanvas.addTile("simulator");
      simulatorTile.getTileTitle().should("contain", "Simulation 1");
      simulatorTile.getSimulatorTileTitle().click();
      simulatorTile.getSimulatorTileTitle().type(newName + '{enter}');
      simulatorTile.getTileTitle().should("contain", newName);
    });
  });
});
