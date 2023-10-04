import ClueCanvas from '../../../../support/elements/clue/cCanvas';
import DataflowTile from "../../../../support/elements/clue/DataflowToolTile";
import SimulatorTile from '../../../../support/elements/clue/SimulatorTile';

let clueCanvas = new ClueCanvas;
const dataflowTile = new DataflowTile;
let simulatorTile = new SimulatorTile;

context('Simulator Tile with Brainwaves Gripper Simulation', function () {
  beforeEach(function () {
    const queryParams = "?appMode=qa&fakeClass=5&fakeUser=student:5&qaGroup=5&mouseSensor&unit=brain";
    cy.clearQAData('all');
    cy.visit(queryParams);
    cy.waitForLoad();
    cy.collapseResourceTabs();
  });
  describe("Simulator Tile", () => {
    it("renders simulator tile", () => {
      simulatorTile.getSimulatorTile().should("not.exist");
      clueCanvas.addTile("simulator");
      simulatorTile.getSimulatorTile().should("exist");
      simulatorTile.getTileTitle().should("exist");
      simulatorTile.getSimulatorTile().should("contain.text", "EMG Sensor");
      simulatorTile.getSimulatorTile().should("contain.text", "Surface Pressure Sensor");
      simulatorTile.getSimulatorTile().should("contain.text", "Gripper Output");
      // Icons are being rendered
      simulatorTile.getSimulatorTile().find(".leading-box.variable-icon").should("have.length", 4);

      cy.get(".arm-image").should("exist");
      cy.get(".arduino-image").should("exist");
      cy.get(".gripper-image").should("exist");

      cy.log("Can switch to temperature variant.");
      cy.get(".temperature-part").should("not.exist");
      simulatorTile.getSelectionButtons().should("have.length", 2).eq(1).click();
      cy.get(".gripper-image").should("not.exist");
      cy.get(".temperature-part").should("exist");
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
      dataflowTile.selectSamplingRate("50ms");

      // Simulation options are not present in the sensor before the simulation has been added to the document
      const sensor = "sensor";
      dataflowTile.getCreateNodeButton(sensor).click();
      dataflowTile.getDropdown(sensor, "sensor-type").click();
      dataflowTile.getSensorDropdownOptions(sensor).eq(7).find(".label").click(); // EMG
      dataflowTile.getDropdown(sensor, "sensor-select").click();
      dataflowTile.getSensorDropdownOptions(sensor).should("have.length", 1);
      // Click the background to not select any option
      cy.get(".primary-workspace .flow-tool").click();
      dataflowTile.getNodeValueContainer(sensor).invoke('text').then(parseFloat).should("equal", 0);

      // Simulation options are not present in the live output before the simulation has been added to the document
      const lo = "live-output";
      dataflowTile.getCreateNodeButton(lo).click();
      dataflowTile.getDropdown(lo, "liveOutputType").click();
      dataflowTile.getDropdownOptions(lo, "liveOutputType").eq(1).click(); // Gripper
      dataflowTile.getDropdown(lo, "hubSelect").click();
      dataflowTile.getDropdownOptions(lo, "hubSelect").should("have.length", 1);
      // Click the background to not select any option
      cy.get(".primary-workspace .flow-tool").click();

      // Sensor options are correct after adding the simulation to the document
      clueCanvas.addTile("simulator");
      dataflowTile.getDropdown(sensor, "sensor-select").click();
      dataflowTile.getSensorDropdownOptions(sensor).should("have.length", 2);
      dataflowTile.getSensorDropdownOptions(sensor).eq(0).click();
      dataflowTile.getNodeValueContainer(sensor).invoke('text').then(parseFloat).should("equal", 40);
      simulatorTile.getEMGSlider().click("right");
      cy.wait(50);
      dataflowTile.getNodeValueContainer(sensor).invoke('text').then(parseFloat).should("equal", 440);

      // Live output options are correct after adding the simulation to the document
      dataflowTile.getDropdown(lo, "hubSelect").click();
      dataflowTile.getDropdownOptions(lo, "hubSelect").should("have.length", 2);
      dataflowTile.getDropdownOptions(lo, "hubSelect").eq(0).click({force: true});

      // Simulator tile's output variable updates when dataflow sets it
      dataflowTile.getCreateNodeButton("number").click();
      dataflowTile.getNumberField().type("1{enter}");
      const output = () => dataflowTile.getNode("number").find(".socket.output");
      const input = () => dataflowTile.getNode(lo).find(".socket.input");
      output().click();
      input().click({ force: true });
      dataflowTile.getOutputNodeValueText().should("contain", "100% closed");
      simulatorTile.getSimulatorTile().should("contain.text", "Gripper Output100");

      // Pressure variable updates when the gripper changes
      simulatorTile.getSimulatorTile().should("contain.text", "Surface Pressure Sensor400");
    });
  });
});

context('Simulator Tile with Brain Simulation', function() {
  beforeEach(function () {
    const queryParams = "?appMode=qa&fakeClass=5&fakeUser=student:5&qaGroup=5&mouseSensor&unit=brain";
    cy.clearQAData('all');
    cy.visit(queryParams);
    cy.waitForLoad();
  });
  it("Make sure only one simulator tile is allowed", () => {
    clueCanvas.addTile("simulator");
    clueCanvas.verifyToolDisabled("simulator");
    clueCanvas.deleteTile("simulator");
    clueCanvas.verifyToolEnabled("simulator");
    clueCanvas.addTile("simulator");
    simulatorTile.getSimulatorTile().should("exist");
  });
});

context('Simulator Tile with Terrarium Simulation', function() {
  beforeEach(function () {
    const queryParams = "?appMode=qa&fakeClass=5&fakeUser=student:5&qaGroup=5&mouseSensor&unit=seeit";
    cy.clearQAData('all');
    cy.visit(queryParams);
    cy.waitForLoad();
  });
  it("links to dataflow tile", () => {
    // Copy a simulator tile over from curriculum
    simulatorTile.getSimulatorTile().should("not.exist");
    const dataTransfer = new DataTransfer;
    const leftSimulatorTile = () => cy.get(".nav-tab-panel .problem-panel .simulator-tool-tile");
    leftSimulatorTile().trigger("mouseover");
    const draggable = () => leftSimulatorTile().find(".tool-tile-drag-handle-wrapper");
    draggable().trigger("dragstart", { dataTransfer, force: true });
    cy.get(".primary-workspace .document-content").trigger("drop", { dataTransfer });
    draggable().trigger("dragend", { force: true });
    simulatorTile.getSimulatorTile().should("exist");
    cy.collapseResourceTabs();

    clueCanvas.addTile("dataflow");

    // Correct sensors have simulated data
    const sensor = "sensor";
    dataflowTile.getCreateNodeButton(sensor).click();
    dataflowTile.getDropdown(sensor, "sensor-type").click();
    dataflowTile.getSensorDropdownOptions(sensor).eq(0).find(".label").click(); // Temperature
    dataflowTile.getDropdown(sensor, "sensor-select").click();
    dataflowTile.getSensorDropdownOptions(sensor).should("have.length", 6);
    dataflowTile.getDropdown(sensor, "sensor-type").click();
    dataflowTile.getSensorDropdownOptions(sensor).eq(1).find(".label").click(); // Humidity
    dataflowTile.getDropdown(sensor, "sensor-select").click();
    dataflowTile.getSensorDropdownOptions(sensor).should("have.length", 6);

    // Live outputs can be linked to output variables
    dataflowTile.getCreateNodeButton("number").click();
    dataflowTile.getNumberField().type("1{enter}");
    const lo = "live-output";
    const output = () => dataflowTile.getNode("number").find(".socket.output");

    // verify we can send output data to a sim output variable

    // Sim tile is going in and out of DOM during the test?
    // Looks like this is making the output "forget" about the simulated option on the last go round of the loop.
    // So...the looping version is disabled for now.

    // const liveOutputs = [
    //   { displayName: "Humidifier", liveOutputIndex: 3 },
    //   { displayName: "Heat Lamp", liveOutputIndex: 5 },
    //   { displayName: "Fan", liveOutputIndex: 4 },
    // ];

    // liveOutputs.forEach((liveOutputType, index) => {
    //   dataflowTile.getCreateNodeButton(lo).click();
    //   simulatorTile.getSimulatorTile().should("contain.text", `${liveOutputType.displayName} Output: 0`);
    //   dataflowTile.getDropdown(lo, "liveOutputType").eq(index).click();
    //   dataflowTile.getDropdownOptions(lo, "liveOutputType").eq(liveOutputType.liveOutputIndex).click();
    //   const myInput = () => dataflowTile.getNode(lo).eq(index).find(".socket.input");
    //   output().click();
    //   myInput().click({ force: true });
    //   dataflowTile.getDropdown(lo, "hubSelect").eq(index).click();
    //   dataflowTile.getDropdownOptions(lo, "hubSelect").should("have.length", 1);
    //   dataflowTile.getDropdownOptions(lo, "hubSelect").eq(0).click();
    //   simulatorTile.getSimulatorTile().should("contain.text", `${liveOutputType.displayName} Output: 1`);
    // });

    // verify we can send output data to a sim output variable - single variable only

    const liveOutputIndex = 4; // Heat Lamp
    dataflowTile.getCreateNodeButton(lo).click();
    simulatorTile.getSimulatorTile().should("contain.text", `Heat Lamp Output0`);
    dataflowTile.getDropdown(lo, "liveOutputType").eq(0).click();
    dataflowTile.getDropdownOptions(lo, "liveOutputType").eq(liveOutputIndex).click();
    const input = () => dataflowTile.getNode(lo).eq(0).find(".socket.input");
    output().click();
    input().click({ force: true });
    dataflowTile.getDropdown(lo, "hubSelect").eq(0).click();
    dataflowTile.getDropdownOptions(lo, "hubSelect").should("have.length", 1);
    dataflowTile.getDropdownOptions(lo, "hubSelect").eq(0).click();
    simulatorTile.getSimulatorTile().should("contain.text", `Heat Lamp Output1`);
  });
});
