import ClueCanvas from "../../../support/elements/common/cCanvas";
import DataflowTile from "../../../support/elements/tile/DataflowToolTile";
import SimulatorTile from "../../../support/elements/tile/SimulatorTile";

let clueCanvas = new ClueCanvas;
const dataflowTile = new DataflowTile;
let simulatorTile = new SimulatorTile;

const queryParams1 = `${Cypress.config("qaUnitStudent5")}`;
const queryParams2 = `${Cypress.config("qaConfigSubtabsUnitStudent5")}`;
const queryParams3 = `${Cypress.config("qaUnitStudent7Investigation3")}`;

function beforeTest(params) {
  cy.visit(params);
  cy.waitForLoad();
}

context('Simulator Tile', function () {
  it("Simulator Tile with Brainwaves Gripper Simulation", () => {
    beforeTest(queryParams1);

    cy.log("renders simulator tile");
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

  it("Simulator Tile with Dataflow", () => {
    beforeTest(queryParams1 + "&mouseSensor");

    cy.log("links to dataflow tile");
    clueCanvas.addTile("dataflow");
    dataflowTile.selectSamplingRate("50ms");

    // Simulation options are not present in the sensor before the simulation has been added to the document
    const sensor = "sensor";
    dataflowTile.getCreateNodeButton(sensor).click();
    dataflowTile.getDropdown(sensor, "sensorType").click();
    dataflowTile.getSensorDropdownOptions(sensor).find(".label").contains("EMG").click(); // EMG
    dataflowTile.getDropdown(sensor, "sensor").click();
    dataflowTile.getSensorDropdownOptions(sensor).should("have.length", 1);
    // Click the background to not select any option
    cy.get(".primary-workspace .flow-tool").click();

    dataflowTile.getNodeValueContainer(sensor).invoke('text').should("equal", "__");

    // Simulation options are not present in the live output before the simulation has been added to the document
    const lo = "live-output";
    dataflowTile.getCreateNodeButton(lo).click();
    dataflowTile.getDropdown(lo, "liveOutputType").click();
    dataflowTile.getDropdownOptions(lo, "liveOutputType").eq(1).click(); // Gripper
    dataflowTile.getDropdown(lo, "hubSelect").click();
    dataflowTile.getDropdownOptions(lo, "hubSelect").should("have.length", 1);
    // Click the background to not select any option
    cy.get(".primary-workspace .flow-tool").click();

    // Need to move it out of the way
    dataflowTile.getNode("live-output").click(50, 10)
      .trigger("pointerdown", 50, 10)
      .trigger("pointermove", 300, 100, { force: true })
      .trigger("pointerup", 300, 100, { force: true });


    // Sensor options are correct after adding the simulation to the document
    clueCanvas.addTile("simulator");
    dataflowTile.getDropdown(sensor, "sensor").click();
    dataflowTile.getSensorDropdownOptions(sensor).should("have.length", 2);
    dataflowTile.getSensorDropdownOptions(sensor).eq(0).click();

    // Sometimes the value of the input block takes some time to show up
    // I think the invoke('text') breaks cypress's built in retry code
    cy.wait(100);
    dataflowTile.getNodeValueContainer(sensor).invoke('text').then(parseFloat).should("be.below", 41).should("be.above", 35);

    simulatorTile.getEMGSlider().click("right");

    cy.wait(50);

    dataflowTile.getNodeValueContainer(sensor).invoke('text').then(parseFloat).should("be.below", 441).should("be.above", 390);

    // Live output options are correct after adding the simulation to the document
    dataflowTile.getDropdown(lo, "hubSelect").click();
    dataflowTile.getDropdownOptions(lo, "hubSelect").should("have.length", 2);
    dataflowTile.getDropdownOptions(lo, "hubSelect").eq(0).click({ force: true });

    // Simulator tile's output variable updates when dataflow sets it
    dataflowTile.getCreateNodeButton("number").click();
    dataflowTile.getNumberField().type("1{enter}");
    const output = () => dataflowTile.getNode("number").find(".output-socket");
    const input = () => dataflowTile.getNode(lo).find(".input-socket");
    output().trigger("pointerdown");
    input().trigger("pointermove", {force: true});
    input().trigger("pointerup", {force: true});
    dataflowTile.getOutputNodeValueText().should("contain", "100% closed");
    simulatorTile.getSimulatorTile().should("contain.text", "Gripper Output100");

    // Pressure variable updates when the gripper changes
    simulatorTile.getSimulatorTile().should("contain.text", "Surface Pressure Sensor300");

    cy.log("edit tile title");
    const newName = "Test Simulation";
    clueCanvas.addTile("simulator");
    simulatorTile.getTileTitle().should("contain", "Simulation 1");
    simulatorTile.getSimulatorTileTitle().click();
    simulatorTile.getSimulatorTileTitle().type(newName + '{enter}');
    simulatorTile.getTileTitle().should("contain", newName);

    //Simulator tile restore upon page reload
    cy.wait(2000);
    cy.reload();
    cy.waitForLoad();
    simulatorTile.getTileTitle().should("contain", newName);
    dataflowTile.getOutputNodeValueText().should("contain", "100% closed");
    simulatorTile.getSimulatorTile().should("contain.text", "Gripper Output100");
    simulatorTile.getSimulatorTile().should("contain.text", "Surface Pressure Sensor300");

    simulatorTile.getSimulatorTile().click();
    clueCanvas.deleteTile("simulator");

    cy.log("Make sure only one simulator tile is allowed");
    clueCanvas.addTile("simulator");
    clueCanvas.verifyToolDisabled("simulator");
    clueCanvas.deleteTile("simulator");
    clueCanvas.verifyToolEnabled("simulator");
    clueCanvas.addTile("simulator");
    simulatorTile.getSimulatorTile().should("exist");
  });

  it("Simulator Tile with Terrarium Simulation", () => {
    beforeTest(queryParams2);

    cy.log("links to dataflow tile");
    // Copy a simulator tile over from curriculum
    simulatorTile.getSimulatorTile().should("not.exist");
    clueCanvas.addTile("simulator");
    simulatorTile.getSimulatorTile().should("exist");
    cy.collapseResourceTabs();

    clueCanvas.addTile("dataflow");

    // Correct sensors have simulated data
    const sensor = "sensor";
    dataflowTile.getCreateNodeButton(sensor).click();
    dataflowTile.getDropdown(sensor, "sensorType").click();
    dataflowTile.getSensorDropdownOptions(sensor).eq(0).find(".label").click(); // Temperature
    dataflowTile.getDropdown(sensor, "sensor").click();
    dataflowTile.getSensorDropdownOptions(sensor).should("have.length", 7);
    dataflowTile.getDropdown(sensor, "sensorType").click();
    dataflowTile.getSensorDropdownOptions(sensor).eq(1).find(".label").click(); // Humidity
    dataflowTile.getDropdown(sensor, "sensor").click();
    dataflowTile.getSensorDropdownOptions(sensor).should("have.length", 6);

    // Live outputs can be linked to output variables
    dataflowTile.getCreateNodeButton("number").click();
    dataflowTile.getNumberField().type("1{enter}");
    const lo = "live-output";
    const output = () => dataflowTile.getNode("number").find(".output-socket");

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

    // Need to move it out of the way
    dataflowTile.getNode("live-output").click(50, 10)
      .trigger("pointerdown", 50, 10)
      .trigger("pointermove", 300, 10, { force: true })
      .trigger("pointerup", 300, 10, { force: true });

    dataflowTile.getDropdown(lo, "liveOutputType").eq(0).click();
    dataflowTile.getDropdownOptions(lo, "liveOutputType").eq(liveOutputIndex).click();
    const input = () => dataflowTile.getNode(lo).eq(0).find(".input-socket");
    output().click();
    input().click({ force: true });
    dataflowTile.getDropdown(lo, "hubSelect").eq(0).click();
    // The hubSelect should have both the simulated heat lamp and the "connect to sensor" warning.
    // We might want to change this in the future, since the "connect to sensor" won't automatically
    // switch to the correct sensor when an "microbit" is connected.
    dataflowTile.getDropdownOptions(lo, "hubSelect").should("have.length", 2);
    dataflowTile.getDropdownOptions(lo, "hubSelect").eq(0).click();
    simulatorTile.getSimulatorTile().should("contain.text", `Heat Lamp Output1`);
  });
  it("Simulator tile with potentiometer, arduino, servo simulation", () => {
    beforeTest(queryParams3);
    cy.log("renders simulator tile");
    simulatorTile.getSimulatorTile().should("not.exist");
    cy.collapseResourceTabs();
    clueCanvas.addTile("simulator");
    clueCanvas.addTile("dataflow");
    simulatorTile.getSimulatorTile().should("exist");
    simulatorTile.getTileTitle().should("exist");
    simulatorTile.getSimulatorTile().should("contain.text", "Potentiometer Position");
    simulatorTile.getSimulatorTile().should("contain.text", "Pin Reading");
    simulatorTile.getSimulatorTile().should("contain.text", "Servo Position");

    cy.log("pot value starts at 0");
    simulatorTile.getVariableDisplayedValue().eq(0).should("contain.text", "0 deg");
    simulatorTile.getVariableDisplayedValue().eq(1).should("contain.text", "0");

    cy.log("pot can be adjusted and pin value changes");
    simulatorTile.getPotValueSlider().click("right")
      .trigger('mousedown', { which: 1, pageX: 100, pageY: 100 })
      .trigger('mousemove', { which: 1, pageX: 200, pageY: 100 })
      .trigger('mouseup', {force: true});
    simulatorTile.getVariableDisplayedValue().eq(0).should("contain.text", "225 deg");
    simulatorTile.getVariableDisplayedValue().eq(1).should("contain.text", "853");

    cy.log("dataflow can drive servo position");
    // collect initial position of servo arm
    const initialPos = simulatorTile.getServoArm().invoke('offset').its('top');
    simulatorTile.getVariableDisplayedValue().eq(2).should("contain.text", "0 deg");
    dataflowTile.getCreateNodeButton("number").click();
    dataflowTile.getNumberField().type("90{enter}");
    dataflowTile.getCreateNodeButton("live-output").click();
    // Need to move it out of the way
    dataflowTile.getNode("live-output").click(50, 10)
      .trigger("pointerdown", 50, 10)
      .trigger("pointermove", 300, 10, { force: true })
      .trigger("pointerup", 300, 10, { force: true });

    dataflowTile.getDropdown("live-output", "liveOutputType").eq(0).click();
    dataflowTile.getDropdownOptions("live-output", "liveOutputType").eq(5).click(); // Servo
    dataflowTile.getNode("number").find(".output-socket").click();
    dataflowTile.getNode("live-output").find(".input-socket").click({ force: true });
    simulatorTile.getVariableDisplayedValue().eq(2).should("contain.text", "90 deg");
    cy.wait(500); // wait for servo animation to move, then assert position has changed
    simulatorTile.getServoArm().invoke('offset').its('top').should('not.eq', initialPos);

    cy.log("Dataflow can read pin value");
    dataflowTile.getCreateNodeButton("sensor").click();
    dataflowTile.getDropdown("sensor", "sensorType").eq(0).click({scrollBehavior: false});
    dataflowTile.getSensorDropdownOptions("sensor").eq(6).find(".label").click({force: true}); // Pin?
    dataflowTile.getDropdown("sensor", "sensor").eq(0).click({scrollBehavior: false});
    dataflowTile.getNode("sensor").find(".item.sensor").eq(0).click({scrollBehavior: false});

    simulatorTile.getVariableDisplayedValue().eq(1).should("contain.text", "853");
    simulatorTile.getPotValueSlider().click("right")
    .trigger('mousedown', { which: 1, pageX: 100, pageY: 100 })
    .trigger('mousemove', { which: 1, pageX: 50, pageY: 100 })
    .trigger('mouseup', {force: true});

    cy.wait(3000); // wait for a tick to update data from sim to dataflow
    let simVarValue;
    simulatorTile.getVariableDisplayedValue().eq(1).invoke('text').then((text) => {
      simVarValue = text.trim();
      expect(Number(simVarValue)).to.be.within(400, 475);
    });

    let pinValue;
    dataflowTile.getNodeValueContainer("sensor").invoke('text').then((text) => {
      pinValue = text.trim();
      console.log("| pinValue: ", pinValue);
      expect(Number(pinValue)).to.be.within(400, 475);
    });

    cy.log("when there are more than five mini-nodes in a family, the extra nodes count is displayed");
    const buttons = ["number", "number", "number", "sensor", "sensor"];
    buttons.forEach(button => {
      dataflowTile.getCreateNodeButton(button).click();
    });
    simulatorTile.getExtraNodesCount().should("contain.text", "+ 2 more");
  });
});
