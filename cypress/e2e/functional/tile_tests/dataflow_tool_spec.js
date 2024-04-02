import ClueCanvas from '../../../support/elements/common/cCanvas';
import DataflowToolTile from '../../../support/elements/tile/DataflowToolTile';

let clueCanvas = new ClueCanvas;
let dataflowToolTile = new DataflowToolTile;
let dragXDestination = 300;

function beforeTest() {
  const url = "./doc-editor.html?appMode=qa&unit=./curriculum/example-curriculum/example-curriculum.json&mouseSensor";
  cy.visit(url);
}
context('Dataflow Tool Tile', function () {
  it("Dataflow Tool and Number Node", () => {
    beforeTest();

    cy.log("renders dataflow tool tile");
    clueCanvas.addTile("dataflow");
    dataflowToolTile.getDataflowTile().should("exist");
    dataflowToolTile.getTileTitle().should("exist");

    cy.log("edit tile title");
    const newName = "Dataflow Tile";
    dataflowToolTile.getTileTitle().should("contain", "Program 1");
    dataflowToolTile.getDataflowTileTitle().click();
    dataflowToolTile.getDataflowTileTitle().type(newName + '{enter}');
    dataflowToolTile.getTileTitle().should("contain", newName);

    cy.log("add new tile");
    const newName2 = "Dataflow Tile 2";
    clueCanvas.addTile("dataflow");
    dataflowToolTile.getTileTitle().last().should("contain", "Program 1");
    dataflowToolTile.getDataflowTileTitle().last().click();
    dataflowToolTile.getDataflowTileTitle().last().type(newName2 + '{enter}');
    dataflowToolTile.getTileTitle().last().should("contain", newName2);

    cy.log("remove second dataflow tile");
    dataflowToolTile.getDataflowTile().last().click();
    clueCanvas.deleteTile("dataflow");

    cy.log("makes link button active when table is present");
    dataflowToolTile.getLinkTileButton().should("exist");
    dataflowToolTile.getLinkTileButton().should("have.class", "disabled");
    clueCanvas.addTile("table");
    dataflowToolTile.getLinkTileButton().should("not.have.class", "disabled");
    clueCanvas.deleteTile("table");

    cy.log("Number Node");
    const numberNode = "number";
    cy.log("can create number node");

    dataflowToolTile.getCreateNodeButton(numberNode).click();
    dataflowToolTile.getNode(numberNode).should("exist");
    dataflowToolTile.getNodeTitle().should("contain", "Number");

    cy.log("can toggle minigraph");
    dataflowToolTile.getShowGraphButton(numberNode).click();
    dataflowToolTile.getMinigraph(numberNode).should("exist");
    dataflowToolTile.getShowGraphButton(numberNode).click();
    dataflowToolTile.getMinigraph(numberNode).should("not.exist");

    cy.log("can change the number");
    dataflowToolTile.getNumberField().type("3{enter}");
    dataflowToolTile.getNumberField().should("have.value", "3");

    //TODO: write a test that can check min and max (should be 0 and 3)
    // could be in class .chartjs-size-monitor

    cy.log("can click zoom in positive button");
    dataflowToolTile.getShowGraphButton(numberNode).click(); //open minigraph
    dataflowToolTile.getShowZoomInButton(numberNode).click();

    cy.log("can click zoom out negative button");
    dataflowToolTile.getShowZoomOutButton(numberNode).click();
    dataflowToolTile.getShowGraphButton(numberNode).click(); //close minigraph

    cy.log("verify node inputs outputs");
    dataflowToolTile.getNodeInput().should("not.exist");
    dataflowToolTile.getNodeOutput().should("exist");

    cy.log("verify zoom in & out");
    dataflowToolTile.getFlowtool().children().invoke("attr", "style").then(scale => {
      dataflowToolTile.getZoomInButton().click();
      dataflowToolTile.verifyZoomIn(scale);
    });
    dataflowToolTile.getFlowtool().children().invoke("attr", "style").then(scale => {
      dataflowToolTile.getZoomOutButton().click();
      dataflowToolTile.verifyZoomOut(scale);
    });

    cy.log("can delete number node");
    dataflowToolTile.getDeleteNodeButton(numberNode).click();
    dataflowToolTile.getNode(numberNode).should("not.exist");

    cy.log('can create node by dragging button onto tile');
    const draggable = () => cy.get(".program-toolbar [aria-roledescription='draggable'] button").eq(1);
    dataflowToolTile.getNode(numberNode).should("not.exist");
    draggable().trigger("mousedown", { force: true })
      .wait(100)
      .trigger("mousemove", {
        force: true,
        clientX: 500,
        clientY: 200
      })
      .wait(100)
      .trigger("mouseup", { force: true })
      .wait(100);
    // const dataTransfer = new DataTransfer;
    // draggable().focus().trigger('dragstart', { dataTransfer });
    // dataflowToolTile.getDataflowTile().trigger('drop', { dataTransfer });
    // draggable().trigger('dragend');
    dataflowToolTile.getNode(numberNode).should("exist");
    dataflowToolTile.getDeleteNodeButton(numberNode).click();
    dataflowToolTile.getNode(numberNode).should("not.exist");

    cy.log("Manage Decimals");
    cy.log('can create a number node and change it to a decimal');
    // create a number node
    dataflowToolTile.getCreateNodeButton("number").click();
    dataflowToolTile.getNode("number").should("exist");
    dataflowToolTile.getNodeTitle().should("contain", "Number");
    dataflowToolTile.getNumberField().type("1.8309{enter}");

    cy.log('values should be rounded to three decimals for display');
    // create transform node and drag to the right
    dataflowToolTile.getCreateNodeButton("transform").click();
    dataflowToolTile.getNode("transform").should("exist");
    dataflowToolTile.getNodeTitle().should("contain", "Transform");
    dataflowToolTile.getNode("transform").click(50, 10)
      .trigger("pointerdown", 50, 10)
      .trigger("pointermove", dragXDestination, 10, { force: true })
      .trigger("pointerup", dragXDestination, 10, { force: true });
    cy.wait(2000);
    // connect the number node to the transform node
    dataflowToolTile.getNodeOutput().eq(0).click();
    dataflowToolTile.getNodeInput().eq(0).click();
    // verify the transform node has the correct value
    dataflowToolTile.getNode("transform").should("contain", "1.831");
    dataflowToolTile.getDeleteNodeButton("number").click();
    dataflowToolTile.getDeleteNodeButton("transform").click();
    dataflowToolTile.getNode("number").should("not.exist");
    dataflowToolTile.getNode("transform").should("not.exist");
  });
  it("Generator and Timer Nodes", () => {
    const generatorNode = "generator";
    beforeTest();
    clueCanvas.addTile("dataflow");

    cy.log("can create generator node");
    dataflowToolTile.getCreateNodeButton(generatorNode).click();
    dataflowToolTile.getNode(generatorNode).should("exist");
    dataflowToolTile.getNodeTitle().should("contain", "Generator");

    cy.log("can toggle minigraph");
    dataflowToolTile.getShowGraphButton(generatorNode).click();
    dataflowToolTile.getMinigraph(generatorNode).should("exist");
    dataflowToolTile.getShowGraphButton(generatorNode).click();
    dataflowToolTile.getMinigraph(generatorNode).should("not.exist");

    cy.log("can change the number");
    dataflowToolTile.getAmplitudeField().clear();
    dataflowToolTile.getAmplitudeField().type("3{enter}");
    dataflowToolTile.getAmplitudeField().find('input').should("have.value", "3");

    cy.log("verify generator types");
    const dropdown2 = "generatorType";
    const generatorTypes = ["Sine", "Square", "Triangle"];
    dataflowToolTile.getDropdown(generatorNode, dropdown2).click();
    dataflowToolTile.getDropdownOptions(generatorNode, dropdown2).should("have.length", 3);
    dataflowToolTile.getDropdownOptions(generatorNode, dropdown2).each(($tab, index, $typeList) => {
      expect($tab.text()).to.contain(generatorTypes[index]);
    });
    dataflowToolTile.getDropdownOptions(generatorNode, dropdown2).last().click();
    dataflowToolTile.getDropdownOptions(generatorNode, dropdown2).should("have.length", 0);
    dataflowToolTile.getDropdown(generatorNode, dropdown2).contains("Triangle").should("exist");

    cy.log("verify node inputs outputs");
    dataflowToolTile.getNodeInput().should("not.exist");
    dataflowToolTile.getNodeOutput().should("exist");

    cy.log("can delete generator node");
    dataflowToolTile.getDeleteNodeButton(generatorNode).click();
    dataflowToolTile.getNode(generatorNode).should("not.exist");

    cy.log("Timer Node");
    const timerNode = "timer";
    beforeTest();
    clueCanvas.addTile("dataflow");

    cy.log("can create timer node");
    dataflowToolTile.getCreateNodeButton(timerNode).click();
    dataflowToolTile.getNode(timerNode).should("exist");
    dataflowToolTile.getNodeTitle().should("contain", "Timer (on/off)");

    cy.log("timer node labels");
    dataflowToolTile.getLabel("On").should('contain', "time on");
    dataflowToolTile.getLabel("Off").should('contain', "time off");

    cy.log("can toggle minigraph");
    dataflowToolTile.getShowGraphButton(timerNode).click();
    dataflowToolTile.getMinigraph(timerNode).should("exist");
    dataflowToolTile.getShowGraphButton(timerNode).click();
    dataflowToolTile.getMinigraph(timerNode).should("not.exist");

    cy.log("verify node inputs outputs");
    dataflowToolTile.getNodeInput().should("not.exist");
    dataflowToolTile.getNodeOutput().should("exist");

    cy.log("can delete timer node");
    dataflowToolTile.getDeleteNodeButton(timerNode).click();
    dataflowToolTile.getNode(timerNode).should("not.exist");
  });

  it("Math and Logic Nodes", () => {
    const mathNode = "math";
    beforeTest();
    clueCanvas.addTile("dataflow");

    cy.log("can create math node");
    dataflowToolTile.getCreateNodeButton(mathNode).click();
    dataflowToolTile.getNode(mathNode).should("exist");
    dataflowToolTile.getNodeTitle().should("contain", "Math");

    cy.log("can toggle minigraph");
    dataflowToolTile.getShowGraphButton(mathNode).click();
    dataflowToolTile.getMinigraph(mathNode).should("exist");
    dataflowToolTile.getShowGraphButton(mathNode).click();
    dataflowToolTile.getMinigraph(mathNode).should("not.exist");

    cy.log("verify math operator types");
    const mathOperator = "mathOperator";
    const mathOperatorTypes = ["Add", "Subtract", "Multiply", "Divide"];
    dataflowToolTile.getDropdown(mathNode, mathOperator).click();
    dataflowToolTile.getDropdownOptions(mathNode, mathOperator).should("have.length", 4);
    dataflowToolTile.getDropdownOptions(mathNode, mathOperator).each(($tab, index, $typeList) => {
      expect($tab.text()).to.contain(mathOperatorTypes[index]);
    });
    dataflowToolTile.getDropdownOptions(mathNode, mathOperator).last().click();
    dataflowToolTile.getDropdownOptions(mathNode, mathOperator).should("have.length", 0);
    dataflowToolTile.getDropdown(mathNode, mathOperator).contains("Divide").should("exist");

    cy.log("verify node inputs outputs");
    dataflowToolTile.getNodeInput().should("exist");
    dataflowToolTile.getNodeInput().should('have.length', 2);
    dataflowToolTile.getNodeOutput().should("exist");

    cy.log("can delete math node");
    dataflowToolTile.getDeleteNodeButton(mathNode).click();
    dataflowToolTile.getNode(mathNode).should("not.exist");

    cy.log("Logic Node");
    const logicNode = "logic";
    beforeTest();
    clueCanvas.addTile("dataflow");

    cy.log("can create logic node");
    dataflowToolTile.getCreateNodeButton(logicNode).click();
    dataflowToolTile.getNode(logicNode).should("exist");
    dataflowToolTile.getNodeTitle().should("contain", "Logic");

    cy.log("can toggle minigraph");
    dataflowToolTile.getShowGraphButton(logicNode).click();
    dataflowToolTile.getMinigraph(logicNode).should("exist");
    dataflowToolTile.getShowGraphButton(logicNode).click();
    dataflowToolTile.getMinigraph(logicNode).should("not.exist");

    cy.log("verify logic operator types");
    const logicOperator = "logicOperator";
    const logicOperatorTypes = ["Greater Than", "Less Than", "Greater Than Or Equal To", "Less Than Or Equal To", "Equal", "Not Equal", "And", "Or", "Nand", "Xor"];
    dataflowToolTile.getDropdown(logicNode, logicOperator).click();
    dataflowToolTile.getDropdownOptions(logicNode, logicOperator).should("have.length", 10);
    dataflowToolTile.getDropdownOptions(logicNode, logicOperator).each(($tab, index, $typeList) => {
      expect($tab.text()).to.contain(logicOperatorTypes[index]);
    });
    dataflowToolTile.getDropdownOptions(logicNode, logicOperator).last().click();
    dataflowToolTile.getDropdownOptions(logicNode, logicOperator).should("have.length", 0);
    dataflowToolTile.getDropdown(logicNode, logicOperator).contains("Xor").should("exist");

    cy.log("verify node inputs outputs");
    dataflowToolTile.getNodeInput().should("exist");
    dataflowToolTile.getNodeInput().should('have.length', 2);
    dataflowToolTile.getNodeOutput().should("exist");

    cy.log("can delete logic node");
    dataflowToolTile.getDeleteNodeButton(logicNode).click();
    dataflowToolTile.getNode(logicNode).should("not.exist");
  });
  it("Transform and Control Nodes", () => {
    const transformNode = "transform";
    beforeTest();
    clueCanvas.addTile("dataflow");

    cy.log("can create transform node");
    dataflowToolTile.getCreateNodeButton(transformNode).click();
    dataflowToolTile.getNode(transformNode).should("exist");
    dataflowToolTile.getNodeTitle().should("contain", "Transform");

    cy.log("can toggle minigraph");
    dataflowToolTile.getShowGraphButton(transformNode).click();
    dataflowToolTile.getMinigraph(transformNode).should("exist");
    dataflowToolTile.getShowGraphButton(transformNode).click();
    dataflowToolTile.getMinigraph(transformNode).should("not.exist");

    cy.log("verify logic operator types");
    const transformOperator = "transformOperator";
    const transformOperatorTypes = ["Absolute Value", "Negation", "Not", "Round", "Floor", "Ceil", "Ramp"];
    dataflowToolTile.getDropdown(transformNode, transformOperator).click();
    dataflowToolTile.getDropdownOptions(transformNode, transformOperator).should("have.length", 7);
    dataflowToolTile.getDropdownOptions(transformNode, transformOperator).each(($tab, index, $typeList) => {
      expect($tab.text()).to.contain(transformOperatorTypes[index]);
    });
    dataflowToolTile.getDropdownOptions(transformNode, transformOperator).last().click();
    dataflowToolTile.getDropdownOptions(transformNode, transformOperator).should("have.length", 0);
    dataflowToolTile.getDropdown(transformNode, transformOperator).contains("Ramp").should("exist");

    cy.log("verify node inputs outputs");
    dataflowToolTile.getNodeInput().should("exist");
    dataflowToolTile.getNodeInput().should('have.length', 1);
    dataflowToolTile.getNodeOutput().should("exist");

    cy.log("can delete transform node");
    dataflowToolTile.getDeleteNodeButton(transformNode).click();
    dataflowToolTile.getNode(transformNode).should("not.exist");

    cy.log("Control Node");
    const controlNode = "control";

    cy.log("can create control node");
    dataflowToolTile.getCreateNodeButton(controlNode).click();
    dataflowToolTile.getNode(controlNode).should("exist");
    dataflowToolTile.getNodeTitle().should("contain", "Hold");

    cy.log("can toggle minigraph");
    dataflowToolTile.getShowGraphButton(controlNode).click();
    dataflowToolTile.getMinigraph(controlNode).should("exist");
    dataflowToolTile.getShowGraphButton(controlNode).click();
    dataflowToolTile.getMinigraph(controlNode).should("not.exist");

    cy.log("verify control operator types");
    const controlOperator = "controlOperator";
    const controlOperatorDisplayNames = ["Hold this", "Hold previous", "Hold 0"];
    dataflowToolTile.getDropdown(controlNode, controlOperator).click();
    dataflowToolTile.getDropdownOptions(controlNode, controlOperator).should("have.length", 3);
    dataflowToolTile.getDropdownOptions(controlNode, controlOperator).each(($tab, index, $typeList) => {
      expect($tab.text()).to.contain(controlOperatorDisplayNames[index]);
    });
    dataflowToolTile.getDropdownOptions(controlNode, controlOperator).last().click();
    dataflowToolTile.getDropdownOptions(controlNode, controlOperator).should("have.length", 0);
    dataflowToolTile.getDropdown(controlNode, controlOperator).contains("Hold 0").should("exist");

    cy.log("verify node inputs outputs");
    dataflowToolTile.getNodeInput().should("exist");
    dataflowToolTile.getNodeInput().should('have.length', 2);
    dataflowToolTile.getNodeOutput().should("exist");

    cy.log("can delete control node");
    dataflowToolTile.getDeleteNodeButton(controlNode).click();
    dataflowToolTile.getNode(controlNode).should("not.exist");
  });
  it("Demo Output and Live Output Nodes", () => {
    const demoOutputNode = "demo-output";
    beforeTest();
    clueCanvas.addTile("dataflow");

    cy.log("can create demo output node");
    dataflowToolTile.getCreateNodeButton(demoOutputNode).click();
    dataflowToolTile.getNode(demoOutputNode).should("exist");
    dataflowToolTile.getNodeTitle().should("contain", "Demo Output");

    cy.log("can change output type");
    const demoOutputType = "outputType";
    const demoOutputTypes = ["Light Bulb", "Gripper", "Advanced Gripper", "Fan", "Humidifier"];
    dataflowToolTile.getDropdown(demoOutputNode, demoOutputType).click();
    dataflowToolTile.getDropdownOptions(demoOutputNode, demoOutputType).should("have.length", 5);
    dataflowToolTile.getDropdownOptions(demoOutputNode, demoOutputType).each(($tab, index, $typeList) => {
      expect($tab.text()).to.contain(demoOutputTypes[index]);
    });
    dataflowToolTile.getDropdownOptions(demoOutputNode, demoOutputType).last().click();
    dataflowToolTile.getDropdownOptions(demoOutputNode, demoOutputType).should("have.length", 0);
    dataflowToolTile.getDropdown(demoOutputNode, demoOutputType).contains("Humidifier").should("exist");

    cy.log("verify demo output images, node inputs outputs & toggle minigraph");
    //verify advanced grabber
    dataflowToolTile.getDropdown(demoOutputNode, demoOutputType).click();
    dataflowToolTile.getDropdownOptions(demoOutputNode, demoOutputType).eq(2).click();
    dataflowToolTile.getAdvancedGrabberImages();
    dataflowToolTile.getNodeInput().should("exist");
    dataflowToolTile.getNodeInput().should('have.length', 2);
    dataflowToolTile.getNodeOutput().should("not.exist");

    dataflowToolTile.getShowGraphButton(demoOutputNode).should('have.length', 2);
    dataflowToolTile.getShowGraphButton(demoOutputNode).eq(0).click();
    dataflowToolTile.getMinigraph(demoOutputNode).should("exist");
    dataflowToolTile.getShowGraphButton(demoOutputNode).eq(0).click();
    dataflowToolTile.getMinigraph(demoOutputNode).should("not.exist");
    dataflowToolTile.getShowGraphButton(demoOutputNode).eq(1).click();
    dataflowToolTile.getMinigraph(demoOutputNode).should("exist");
    dataflowToolTile.getShowGraphButton(demoOutputNode).eq(1).click();
    dataflowToolTile.getMinigraph(demoOutputNode).should("not.exist");

    dataflowToolTile.getOutputNodeValueText().should("contain", "0% closed");
    dataflowToolTile.getOutputTiltValueText().should("contain", "tilt: center");

    // verify grabber
    dataflowToolTile.getDropdown(demoOutputNode, demoOutputType).click();
    dataflowToolTile.getDropdownOptions(demoOutputNode, demoOutputType).eq(1).click();
    dataflowToolTile.getGrabberImage();
    dataflowToolTile.getNodeInput().should("exist");
    dataflowToolTile.getNodeInput().should('have.length', 1);
    dataflowToolTile.getNodeOutput().should("not.exist");

    dataflowToolTile.getShowGraphButton(demoOutputNode).click();
    dataflowToolTile.getMinigraph(demoOutputNode).should("exist");
    dataflowToolTile.getShowGraphButton(demoOutputNode).click();
    dataflowToolTile.getMinigraph(demoOutputNode).should("not.exist");

    dataflowToolTile.getOutputNodeValueText().should("contain", "0% closed");

    // verify light bulb
    dataflowToolTile.getDropdown(demoOutputNode, demoOutputType).click();
    dataflowToolTile.getDropdownOptions(demoOutputNode, demoOutputType).first().click();
    dataflowToolTile.getLightBulbImage();
    dataflowToolTile.getNodeInput().should("exist");
    dataflowToolTile.getNodeInput().should('have.length', 1);
    dataflowToolTile.getNodeOutput().should("not.exist");

    dataflowToolTile.getShowGraphButton(demoOutputNode).click();
    dataflowToolTile.getMinigraph(demoOutputNode).should("exist");
    dataflowToolTile.getShowGraphButton(demoOutputNode).click();
    dataflowToolTile.getMinigraph(demoOutputNode).should("not.exist");
    dataflowToolTile.getOutputNodeValueText().should("contain", "off");

    cy.log("can delete demo output node");
    dataflowToolTile.getDeleteNodeButton(demoOutputNode).click();
    dataflowToolTile.getNode(demoOutputNode).should("not.exist");

    cy.log("Live Output Node");
    const liveOutputNode = "live-output";
    cy.log("can create live output node");
    dataflowToolTile.getCreateNodeButton(liveOutputNode).click();
    dataflowToolTile.getNode(liveOutputNode).should("exist");
    dataflowToolTile.getNodeTitle().should("contain", "Live Output");

    cy.log("can toggle minigraph");
    dataflowToolTile.getShowGraphButton(liveOutputNode).click();
    dataflowToolTile.getMinigraph(liveOutputNode).should("exist");
    dataflowToolTile.getShowGraphButton(liveOutputNode).click();
    dataflowToolTile.getMinigraph(liveOutputNode).should("not.exist");

    cy.log("verify live output types");
    const liveOutputType = "liveOutputType";
    const liveOutputTypes = ["Gripper 2.0", "Gripper", "Humidifier", "Fan", "Heat Lamp", "Servo"];
    dataflowToolTile.getDropdown(liveOutputNode, liveOutputType).click();
    dataflowToolTile.getDropdownOptions(liveOutputNode, liveOutputType).should("have.length", 6);
    dataflowToolTile.getDropdownOptions(liveOutputNode, liveOutputType).each(($tab, index, $typeList) => {
      expect($tab.text()).to.contain(liveOutputTypes[index]);
    });
    dataflowToolTile.getDropdownOptions(liveOutputNode, liveOutputType).eq(4).click();
    dataflowToolTile.getDropdownOptions(liveOutputNode, liveOutputType).should("have.length", 0);
    dataflowToolTile.getDropdown(liveOutputNode, liveOutputType).contains("Heat Lamp").should("exist");
    dataflowToolTile.getOutputNodeValueText().should("contain", "off");

    cy.log("verify live binary outputs indicate hub not present if not connected");
    dataflowToolTile.getDropdown(liveOutputNode, liveOutputType).click();
    dataflowToolTile.getDropdownOptions(liveOutputNode, liveOutputType).eq(3).click();
    dataflowToolTile.getDropdown(liveOutputNode, liveOutputType).contains("Fan").should("exist");
    dataflowToolTile.getOutputNodeValueText().should("contain", "(no hub)");

    cy.log("can be dragged to the right and set back to light bulb");
    dataflowToolTile.getNode(liveOutputNode).click(50, 10)
      .trigger("pointerdown", 50, 10)
      .trigger("pointermove", dragXDestination, 10, { force: true })
      .trigger("pointerup", dragXDestination, 10, { force: true });
    dataflowToolTile.getDropdown(liveOutputNode, liveOutputType).click();
    dataflowToolTile.getDropdownOptions(liveOutputNode, liveOutputType).eq(0).click();

    cy.log("can connect and trigger modal connection warning");
    // vars for controlling click and drag to connect nodes
    const startX = 306;
    const startY = 182;
    const deltaX = 70;  //  60 with fixed styles
    const deltaY = -22; // -10 with fixed styles
    dataflowToolTile.getCreateNodeButton("number").click();
    dataflowToolTile.getNode("number").should("exist");
    dataflowToolTile.getNumberField().type("1{enter}");
    dataflowToolTile.getNumberNodeOutput().should("exist");
    dataflowToolTile.getDataflowTile().click(startX, startY)
      .trigger("pointerdown", startX, startY, { force: true })
      .trigger("pointermove", startX + deltaX, startY + deltaY, { force: true })
      .trigger("pointerup", startX + deltaX, startY + deltaY, { force: true });
    dataflowToolTile.getModalOkButton().click();

    cy.log("should show needs connection message when fan is selected and there are no outputs");
    dataflowToolTile.getDropdown(liveOutputNode, liveOutputType).click();
    dataflowToolTile.getDropdownOptions(liveOutputNode, liveOutputType).eq(3).click();
    dataflowToolTile.getDropdown(liveOutputNode, liveOutputType).contains("Fan").should("exist");
    dataflowToolTile.getDropdown(liveOutputNode, "hubSelect").should("contain", "connect device");

    cy.log("can recieve a value from a connected block, and display correct on or off string");
    dataflowToolTile.getNode("number").should("exist");
    dataflowToolTile.getOutputNodeValueText().should("contain", "on");
    dataflowToolTile.getNumberField().type("{backspace}0{enter}");
    dataflowToolTile.getNumberNodeOutput().should("exist");
    dataflowToolTile.getOutputNodeValueText().should("contain", "off");
    dataflowToolTile.getDeleteNodeButton("number").click();

    cy.log("verify node inputs outputs");
    dataflowToolTile.getNodeInput().should("exist");
    dataflowToolTile.getNodeInput().should('have.length', 1);
    dataflowToolTile.getNodeOutput().should("not.exist");

    cy.log("can delete live output node");
    dataflowToolTile.getDeleteNodeButton(liveOutputNode).click();
    dataflowToolTile.getNode(liveOutputNode).should("not.exist");
  });
  it("Sensor Node and Record Data", () => {
    const sensorNode = "sensor";
    beforeTest();
    clueCanvas.addTile("dataflow");

    cy.log("can create sensor node");
    dataflowToolTile.getCreateNodeButton(sensorNode).click();
    dataflowToolTile.getNode(sensorNode).should("exist");
    dataflowToolTile.getNodeTitle().should("contain", "Sensor");

    cy.log("can toggle minigraph");
    dataflowToolTile.getShowGraphButton(sensorNode).click();
    dataflowToolTile.getMinigraph(sensorNode).should("exist");
    dataflowToolTile.getShowGraphButton(sensorNode).click();
    dataflowToolTile.getMinigraph(sensorNode).should("not.exist");

    cy.log("verify sensor types");
    const dropdown10 = "sensor-type";
    const sensorTypes = ["Temperature", "Humidity", "CO₂", "O₂", "Light", "Soil Moisture", "Particulates", "EMG", "Surface Pressure"];
    dataflowToolTile.getDropdown(sensorNode, dropdown10).click();
    dataflowToolTile.getSensorDropdownOptions(sensorNode).should("have.length", 9);
    dataflowToolTile.getSensorDropdownOptions(sensorNode).each(($tab, index, $typeList) => {
      expect($tab.text()).to.contain(sensorTypes[index]);
    });

    cy.log("verify clear button");
    dataflowToolTile.getClearButton().click();
    dataflowToolTile.getNode(sensorNode).should("not.exist");

    cy.log("verify sensor select");
    const sensorSelectdropdown = "sensor-select";
    const sensorSelect = [
      "Temperature Demo Data", "Humidity Demo Data", "CO2 Demo Data", "O2 Demo Data", "Light Demo Data", "Particulates Demo Data",
      "⚠️ Connect Arduino for live EMG",
      "⚠️ Connect Arduino for live Pressure",
      "⚠️ Connect Arduino for live Temperature",
      "⚠️ Connect micro:bit for live Temperature A",
      "⚠️ Connect micro:bit for live Humidity A",
      "⚠️ Connect micro:bit for live Temperature B",
      "⚠️ Connect micro:bit for live Humidity B",
      "⚠️ Connect micro:bit for live Temperature C",
      "⚠️ Connect micro:bit for live Humidity C",
      "⚠️ Connect micro:bit for live Temperature D",
      "⚠️ Connect micro:bit for live Humidity D",
    ];
    dataflowToolTile.getCreateNodeButton(sensorNode).click();
    dataflowToolTile.getDropdown(sensorNode, sensorSelectdropdown).click();
    dataflowToolTile.getSensorDropdownOptions(sensorNode).should("have.length", 17);
    dataflowToolTile.getSensorDropdownOptions(sensorNode).each(($tab, index, $typeList) => {
      expect($tab.text()).to.contain(sensorSelect[index]);
    });
    dataflowToolTile.getClearButton().click();
    dataflowToolTile.getNode(sensorNode).should("not.exist");

    cy.log("verify node inputs outputs");
    dataflowToolTile.getCreateNodeButton(sensorNode).click();
    dataflowToolTile.getNodeInput().should("not.exist");
    dataflowToolTile.getNodeOutput().should("exist");

    cy.log("can delete sensor node");
    dataflowToolTile.getDeleteNodeButton(sensorNode).click();
    dataflowToolTile.getNode(sensorNode).should("not.exist");

    cy.log("Record Data");
    cy.log("can create a small program");
    const nodes = ["timer", "demo-output"];
    dataflowToolTile.getCreateNodeButton(nodes[0]).click();
    dataflowToolTile.getNode(nodes[0]).should("exist");
    dataflowToolTile.getNodeTitle().should("contain", "Timer (on/off)");
    dataflowToolTile.getCreateNodeButton(nodes[1]).click();
    dataflowToolTile.getNode(nodes[1]).should("exist");
    dataflowToolTile.getNodeTitle().should("contain", "Demo Output");
    dataflowToolTile.getNodeOutput().eq(0).click();
    dataflowToolTile.getNodeInput().eq(0).click();
    dataflowToolTile.getShowGraphButton("demo-output").click();
    dataflowToolTile.getMinigraph("demo-output").should("exist");

    cy.log("verify sampling rate");
    const rate = "500";
    dataflowToolTile.getSamplingRateLabel().should("have.text", "Sampling Rate");
    dataflowToolTile.selectSamplingRate(rate);

    cy.log("verify recording and stop recording");
    dataflowToolTile.verifyRecordButtonText();
    dataflowToolTile.verifyRecordButtonIcon();
    dataflowToolTile.getRecordButton().click();
    dataflowToolTile.verifyPlayButtonText();
    dataflowToolTile.verifyPlayButtonIcon();
    dataflowToolTile.getPlayButton().should("be.disabled");
    dataflowToolTile.verifyStopButtonText();
    dataflowToolTile.verifyStopButtonIcon();
    dataflowToolTile.getTimeSlider().should("be.visible");
    dataflowToolTile.getCountdownTimer().should("contain", "/");
    cy.wait(5000);

    dataflowToolTile.getStopButton().click();

    cy.log("verify play and pause recording");
    dataflowToolTile.getPlayButton().should("be.enabled");
    dataflowToolTile.verifyRecordingClearButtonText();
    dataflowToolTile.verifyRecordingClearButtonIcon();
    dataflowToolTile.getPlayButton().click();

    dataflowToolTile.verifyPauseButtonText();
    dataflowToolTile.verifyPauseButtonIcon();
    dataflowToolTile.getPauseButton().should("be.enabled");
    dataflowToolTile.getPauseButton().click();

    dataflowToolTile.getPlayButton().should("be.enabled");
    dataflowToolTile.getPlayButton().click();
    cy.wait(5000);

    cy.log("verify clear recording");
    dataflowToolTile.verifyRecordingClearButtonText();
    dataflowToolTile.verifyRecordingClearButtonIcon();
    dataflowToolTile.getRecordingClearButton().click();
    dataflowToolTile.getClearDataWarningTitle().should("have.text", "Clear Data");
    dataflowToolTile.getClearDataWarningContent().should(
      "contain",
      "Remove the program's recorded data and any linked displays of this data? This action is not undoable.");
    dataflowToolTile.getClearDataWarningCancel().click();
    dataflowToolTile.verifyRecordingClearButtonText();
    dataflowToolTile.verifyRecordingClearButtonIcon();
    dataflowToolTile.getRecordingClearButton().click();
    dataflowToolTile.getClearDataWarningClear().click();
    dataflowToolTile.getSamplingRateLabel().should("have.text", "Sampling Rate");
    dataflowToolTile.verifyRecordButtonText();
    dataflowToolTile.verifyRecordButtonIcon();
  });
});
