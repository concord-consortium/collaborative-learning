import ClueCanvas from '../../../../support/elements/clue/cCanvas';
import DataflowTile from "../../../../support/elements/clue/DataflowToolTile";
import SimulatorTile from '../../../../support/elements/clue/SimulatorTile';

let clueCanvas = new ClueCanvas;
const dataflowTile = new DataflowTile;
let simulatorTile = new SimulatorTile;

// FIXME: this test seems to be causing cypress timeouts.
context.skip('Simulator Tile', function () {
  beforeEach(function () {
    const queryParams = "?appMode=qa&fakeClass=5&fakeUser=student:5&qaGroup=5&mouseSensor&unit=dfe";
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
      // TODO: These should be removed when we change what's displayed in the simulator tile
      simulatorTile.getSimulatorTile().should("contain.text", "EMG Sensor");
      simulatorTile.getSimulatorTile().should("contain.text", "Surface Pressure Sensor");
      simulatorTile.getSimulatorTile().should("contain.text", "Gripper Output");
      // Icons are being rendered
      simulatorTile.getSimulatorTile().find(".leading-box.variable-icon").should("have.length", 3);

      cy.get(".arm-image").should("exist");
      cy.get(".arduino-image").should("exist");
      cy.get(".gripper-image").should("exist");
    });
    it("edit tile title", () => {
      const newName = "Test Simulation";
      clueCanvas.addTile("simulator");
      simulatorTile.getTileTitle().should("contain", "Simulation 1");
      simulatorTile.getSimulatorTileTitle().click();
      simulatorTile.getSimulatorTileTitle().type(newName + '{enter}');
      simulatorTile.getTileTitle().should("contain", newName);
    });
    it("links to dataflow tile", () => {
      clueCanvas.addTile("dataflow");

      // Simulation options are not present in the sensor before the simulation has been added to the document
      const sensor = "sensor";
      dataflowTile.getCreateNodeButton(sensor).click();
      dataflowTile.getDropdown(sensor, "sensor-type").click();
      dataflowTile.getSensorDropdownOptions(sensor).eq(7).find(".label").click(); // EMG
      dataflowTile.getDropdown(sensor, "sensor-select").click();
      dataflowTile.getSensorDropdownOptions(sensor).should("have.length", 4);
      // Click the background to not select any option
      cy.get(".flow-tool").click();
      dataflowTile.getNodeValueContainer(sensor).invoke('text').then(parseFloat).should("equal", 0);

      // Simulation options are not present in the live output before the simulation has been added to the document
      const lo = "live-output";
      dataflowTile.getCreateNodeButton(lo).click();
      dataflowTile.getDropdown(lo, "liveOutputType").click();
      dataflowTile.getDropdownOptions(lo, "liveOutputType").eq(1).click(); // Gripper
      dataflowTile.getDropdown(lo, "hubSelect").click();
      dataflowTile.getDropdownOptions(lo, "hubSelect").should("have.length", 4);
      // Click the background to not select any option
      cy.get(".flow-tool").click();

      // Sensor options are correct after adding the simulation to the document
      clueCanvas.addTile("simulator");
      dataflowTile.getDropdown(sensor, "sensor-select").click();
      dataflowTile.getSensorDropdownOptions(sensor).should("have.length", 5);
      dataflowTile.getSensorDropdownOptions(sensor).eq(3).click();
      dataflowTile.getNodeValueContainer(sensor).invoke('text').then(parseFloat).should("be.gt", 0);

      // Live output options are correct after adding the simulation to the document
      dataflowTile.getDropdown(lo, "hubSelect").click();
      dataflowTile.getDropdownOptions(lo, "hubSelect").should("have.length", 5);
      dataflowTile.getDropdownOptions(lo, "hubSelect").eq(4).click();

      // Simulator tile's output variable updates when dataflow sets it
      dataflowTile.getCreateNodeButton("number").click();
      dataflowTile.getNumberField().type("1{enter}");
      const output = () => dataflowTile.getNode("number").find(".socket.output");
      const input = () => dataflowTile.getNode(lo).find(".socket.input");
      output().click();
      input().click({ force: true });
      dataflowTile.getOutputNodeValueText().should("contain", "100% closed");
      simulatorTile.getSimulatorTile().should("contain.text", "Gripper Output: 100");

      // Pressure variable updates when the gripper changes
      simulatorTile.getSimulatorTile().should("contain.text", "Surface Pressure Sensor: 400");
    });
  });
});
