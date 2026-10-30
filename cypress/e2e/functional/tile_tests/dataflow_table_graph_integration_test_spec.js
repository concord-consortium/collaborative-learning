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
// Preparing a capture appends its start time to the program's name, so the linked table's header
// reads "Program 1 14:32:07". Clearing the recording strips it again, back to programTitle.
const capturedTitle = /^Program 1 \d{2}:\d{2}:\d{2}$/;
const graphTitle = "Graph 1";

const programNodes = [
  { name: "number", title: "Number 1", attribute: "Number 1" },
  { name: "demo-output", title: "Demo Device 1", attribute: "Demo Device 1" }];
// Point, not "Time (sec)": a capture numbers its points 1, 2, 3 and records its start time in the
// program's name instead (see prepareCapture). Table It prepares these columns up front, so an
// empty linked table already carries them; only clearing the recording puts x | y back.
const linkedTableAttributes = ["Point", programNodes[0].attribute, programNodes[1].attribute];
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
    clueCanvas.clickToolbarButtonLabelled("dataflow", "table-it", "Table It!");
    dataflowToolTile.checkEmptyLinkedTable(tableTile, capturedTitle, linkedTableAttributes);

    dataflowToolTile.recordData("1000", timer1);
    dataflowToolTile.checkLinkedTableRecordedData(tableTile, capturedTitle, linkedTableAttributes, timer1);

    dataflowToolTile.clearRecordedData();
    dataflowToolTile.checkEmptyLinkedTable(tableTile, programTitle, defaultTableAttributes);

    dataflowToolTile.recordData("1000", timer2);
    dataflowToolTile.checkLinkedTableRecordedData(tableTile, capturedTitle, linkedTableAttributes, timer2);

    // dataflowToolTile.clearRecordedData();
    clueCanvas.deleteTile("table");
    dataflowToolTile.getDataflowTile().click();

    cy.log("create a linked graph");

    // FIXME: there is a bug in the graph that shows up when a readOnly view of the same document
    // is open. For now we close the readOnly views first.
    docEditor.hideReadOnlyPanes();

    clueCanvas.clickToolbarButtonLabelled("dataflow", "data-set-view", "Graph It!");
    graphTile.getTile().should("exist").contains(graphTitle);
    graphTile.getLayerName().should("contain.text", programTitle);
    graphTile.getXAttributesLabel().should("contain.text", linkedTableAttributes[0]);
    graphTile.getYAttributesLabel().should("contain.text", linkedTableAttributes[1]);
    graphTile.getGraphDot().should("exist");

    cy.log("unlink the program from the graph");

    // The dialog's "Clear It!" is no longer on the Dataflow toolbar; the graph carries its own
    // unlink button on the layer legend, which is the path a student now has.
    graphTile.getLayerDeleteButton().click({force: true});
    graphTile.getTile().should("exist").contains(graphTitle);
    graphTile.getLayerName().should("not.exist");
    graphTile.getGraphDot().should("not.exist");

    cy.log("re-link and unlink through the data-set-link dialog");

    // `data-set-link` is no longer on the default Dataflow toolbar, but units may still configure
    // it, so it keeps a test. qa-dataflow-link has it; the /editor/ route restores this document
    // from sessionStorage whatever the unit, so the program and the unlinked graph come back with
    // that unit's toolbar. Linking the graph back is also the state the dialog needs for
    // "Clear It!". The unit must leave the graph's defaultSeriesLegend on: with it off, as in
    // qa-moth-plot, the graph renders no legend at all and none of the assertions below can pass.
    cy.visit("/editor/?appMode=qa&unit=./demo/units/qa-dataflow-link/content.json&mouseSensor");
    docEditor.hideReadOnlyPanes();

    // The restore has to finish, and the tile has to be selected, before its toolbar exists.
    // Selecting by the tile rather than its title: after the revisit the document holds both the
    // program and Graph 1, so the title selector matches two elements.
    dataflowToolTile.getDataflowTile().should("exist");
    dataflowToolTile.getDataflowTile().click();

    // Relink to existing tile
    clueCanvas.clickToolbarButton("dataflow", "data-set-link");
    tableTile.getLinkGraphModalTileMenu().select(graphTitle);
    // The dialog's primary button ignores a click while it is disabled, and it stays disabled
    // until React commits the selection, which lags cy.select() after a page load.
    tableTile.getLinkGraphModalLinkButton().should("not.have.class", "disabled");
    tableTile.getLinkGraphModalLinkButton().should("contain.text", "Graph It!").click({force: true});
    graphTile.getTile().should("exist").contains(graphTitle);
    graphTile.getLayerName().should("contain.text", programTitle);
    graphTile.getXAttributesLabel().should("contain.text", linkedTableAttributes[0]);
    graphTile.getYAttributesLabel().should("contain.text", linkedTableAttributes[1]);
    graphTile.getGraphDot().should("exist");

    // Unlink
    clueCanvas.clickToolbarButton("dataflow", "data-set-link");
    tableTile.getLinkGraphModalTileMenu().select(graphTitle);
    tableTile.getLinkGraphModalLinkButton().should("not.have.class", "disabled");
    tableTile.getLinkGraphModalLinkButton().should("contain.text", "Clear It!").click({force: true});
    graphTile.getTile().should("exist").contains(graphTitle);
    graphTile.getLayerName().should("not.exist");
    graphTile.getGraphDot().should("not.exist");
  });

  it("verify the effect of page reload cause on various button states and linked table state", () => {
    beforeTest();

    cy.log("create a small program, select sampling rate and record data");
    clueCanvas.addTile("dataflow");
    dataflowToolTile.createProgram(programNodes);
    dataflowToolTile.checkInitialStateButtons();
    dataflowToolTile.recordData("1000", timer1);
    clueCanvas.clickToolbarButtonLabelled("dataflow", "table-it", "Table It!");

    // record data
    dataflowToolTile.clearRecordedData();
    dataflowToolTile.recordDataWithoutStop("1000", timer2);

    // reload while recording
    cy.reload();

    // check buttons after reload
    dataflowToolTile.checkRecordedStateButtons();
    dataflowToolTile.checkLinkedTableRecordedData(tableTile, capturedTitle, linkedTableAttributes, timer2);

    // play recorded data
    dataflowToolTile.clickPlayButton();

    // reload while playing
    cy.reload();

    // check buttons after reload
    dataflowToolTile.checkRecordedStateButtons();
    dataflowToolTile.checkLinkedTableRecordedData(tableTile, capturedTitle, linkedTableAttributes, timer2);

    // pause recorded data
    dataflowToolTile.clickPlayButton();
    cy.wait(1000);
    dataflowToolTile.clickPauseButton();

    // reload while in pause
    cy.reload();

    // check buttons after reload
    dataflowToolTile.checkRecordedStateButtons();
    dataflowToolTile.checkLinkedTableRecordedData(tableTile, capturedTitle, linkedTableAttributes, timer2);

    // click clear
    dataflowToolTile.getRecordingClearButton().click();

    // reload before confirming clear
    cy.reload();

    // check buttons after reload
    dataflowToolTile.checkRecordedStateButtons();
    dataflowToolTile.checkLinkedTableRecordedData(tableTile, capturedTitle, linkedTableAttributes, timer2);

    // record data
    dataflowToolTile.clearRecordedData();

    // reload after confirming clear
    // cy.reload();

    // check buttons after reload
    dataflowToolTile.checkInitialStateButtons();
    dataflowToolTile.checkEmptyLinkedTable(tableTile, programTitle, defaultTableAttributes);
  });
});
