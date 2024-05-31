import ClueCanvas from '../../../support/elements/common/cCanvas';
import DataflowToolTile from '../../../support/elements/tile/DataflowToolTile';
import TableToolTile from '../../../support/elements/tile/TableToolTile';
import XYPlotToolTile from '../../../support/elements/tile/XYPlotToolTile';
import DocEditor from '../../../support/elements/common/DocEditor';

let clueCanvas = new ClueCanvas;
let dataflowToolTile = new DataflowToolTile;
let tableTile = new TableToolTile;
let graphTile = new XYPlotToolTile;
let docEditor = new DocEditor;

const programTitle = "Program 1";
const graphTitle = "Graph 1";

const programNodes = [
  { name: "timer", title: "Timer (on/off)", attribute: "Timer (on/off) 1" },
  { name: "demo-output", title: "Demo Output 1", attribute: "Demo Output 1" }];
const linkedTableAttributes = ["Time (sec)", programNodes[0].attribute, programNodes[1].attribute];
const defaultTableAttributes = ["x", "y"];
const timer1 = 5;
const timer2 = 3;


function beforeTest() {
  const url = "/editor/?appMode=qa&unit=./demo/units/qa-config-subtabs/content.json&mouseSensor";
  cy.visit(url);
}

context('Dataflow Tool Tile', function () {
  it("Data is shared properly with tables and graphs", () => {
    beforeTest();

    cy.log("create a small program, select sampling rate and record data");
    clueCanvas.addTile("dataflow");
    dataflowToolTile.createProgram(programNodes);
    dataflowToolTile.checkInitialStateButtons();

    cy.log("create linked table, verify empty and with recorded data");
    clueCanvas.clickToolbarButton("dataflow", "data-set-view");
    dataflowToolTile.checkEmptyLinkedTable(tableTile, programTitle, defaultTableAttributes);

    dataflowToolTile.recordData("1000", timer1);
    dataflowToolTile.checkLinkedTableRecordedData(tableTile, programTitle, linkedTableAttributes, timer1);

    dataflowToolTile.clearRecordedData();
    dataflowToolTile.checkEmptyLinkedTable(tableTile, programTitle, defaultTableAttributes);

    dataflowToolTile.recordData("1000", timer2);
    dataflowToolTile.checkLinkedTableRecordedData(tableTile, programTitle, linkedTableAttributes, timer2);

    // dataflowToolTile.clearRecordedData();
    clueCanvas.deleteTile("table");
    dataflowToolTile.getDataflowTile().click();

    cy.log("create a linked graph");

    // FIXME: there is a bug in the graph that shows up when a readOnly view of the same document
    // is open. For now we close the readOnly views first.
    docEditor.hideReadOnlyPanes();

    clueCanvas.clickToolbarButton("dataflow", "data-set-link");
    tableTile.getLinkGraphModalTileMenu().select("New Graph");
    tableTile.getLinkGraphModalLinkButton().should("contain.text", "Graph It!").click({force: true});
    graphTile.getTile().should("exist").contains(graphTitle);
    graphTile.getLayerName().should("contain.text", programTitle);
    graphTile.getXAttributesLabel().should("contain.text", linkedTableAttributes[0]);
    graphTile.getYAttributesLabel().should("contain.text", linkedTableAttributes[1]);
    graphTile.getGraphDot().should("exist");

    // Unlink
    clueCanvas.clickToolbarButton("dataflow", "data-set-link");
    tableTile.getLinkGraphModalTileMenu().select(graphTitle);
    tableTile.getLinkGraphModalLinkButton().should("contain.text", "Clear It!").click({force: true});
    graphTile.getTile().should("exist").contains(graphTitle);
    graphTile.getLayerName().should("not.exist");
    graphTile.getGraphDot().should("not.exist");

    // Relink to existing tile
    clueCanvas.clickToolbarButton("dataflow", "data-set-link");
    tableTile.getLinkGraphModalTileMenu().select(graphTitle);
    tableTile.getLinkGraphModalLinkButton().should("contain.text", "Graph It!").click({force: true});
    graphTile.getTile().should("exist").contains(graphTitle);
    graphTile.getLayerName().should("contain.text", programTitle);
    graphTile.getXAttributesLabel().should("contain.text", linkedTableAttributes[0]);
    graphTile.getYAttributesLabel().should("contain.text", linkedTableAttributes[1]);
    graphTile.getGraphDot().should("exist");

  });

  it("verify the effect of page reload cause on various button states and linked table state", () => {
    beforeTest();

    cy.log("create a small program, select sampling rate and record data");
    clueCanvas.addTile("dataflow");
    dataflowToolTile.createProgram(programNodes);
    dataflowToolTile.checkInitialStateButtons();
    dataflowToolTile.recordData("1000", timer1);
    clueCanvas.clickToolbarButton("dataflow", "data-set-view");

    // record data
    dataflowToolTile.clearRecordedData();
    dataflowToolTile.recordDataWithoutStop("1000", timer2);

    // reload while recording
    cy.reload();

    // check buttons after reload
    dataflowToolTile.checkRecordedStateButtons();
    dataflowToolTile.checkLinkedTableRecordedData(tableTile, programTitle, linkedTableAttributes, timer2);

    // play recorded data
    dataflowToolTile.clickPlayButton();

    // reload while playing
    cy.reload();

    // check buttons after reload
    dataflowToolTile.checkRecordedStateButtons();
    dataflowToolTile.checkLinkedTableRecordedData(tableTile, programTitle, linkedTableAttributes, timer2);

    // pause recorded data
    dataflowToolTile.clickPlayButton();
    cy.wait(1000);
    dataflowToolTile.clickPauseButton();

    // reload while in pause
    cy.reload();

    // check buttons after reload
    dataflowToolTile.checkRecordedStateButtons();
    dataflowToolTile.checkLinkedTableRecordedData(tableTile, programTitle, linkedTableAttributes, timer2);

    // click clear
    dataflowToolTile.getRecordingClearButton().click();

    // reload before confirming clear
    cy.reload();

    // check buttons after reload
    dataflowToolTile.checkRecordedStateButtons();
    dataflowToolTile.checkLinkedTableRecordedData(tableTile, programTitle, linkedTableAttributes, timer2);

    // record data
    dataflowToolTile.clearRecordedData();

    // reload after confirming clear
    // cy.reload();

    // check buttons after reload
    dataflowToolTile.checkInitialStateButtons();
    dataflowToolTile.checkEmptyLinkedTable(tableTile, programTitle, defaultTableAttributes);
  });
});
