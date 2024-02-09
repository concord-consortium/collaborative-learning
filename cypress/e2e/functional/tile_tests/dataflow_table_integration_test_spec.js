import ClueCanvas from '../../../support/elements/common/cCanvas';
import DataflowToolTile from '../../../support/elements/tile/DataflowToolTile';
import TableToolTile from '../../../support/elements/tile/TableToolTile';

let clueCanvas = new ClueCanvas;
let dataflowToolTile = new DataflowToolTile;
let tableTile = new TableToolTile;
const tableTitle = "Table 1";
const programTitle = "Program 1";
const programNodes = [{ name: "timer", title: "Timer (on/off)", attribute: "Timer 1" },
{ name: "demo-output", title: "Demo Output", attribute: "Demo Output 2" }];
const linkedTableAttributes = ["Time (sec)", programNodes[0].attribute, programNodes[1].attribute];
const defaultTableAttributes = ["x", "y"];
const timer1 = 5;
const timer2 = 3;


function beforeTest() {
  const queryParams = `${Cypress.config("qaUnitStudent5")}&mouseSensor`;
  cy.clearQAData('all');
  cy.visit(queryParams);
  cy.waitForLoad();
  cy.collapseResourceTabs();
}

// FIXME: this test seems to be causing cypress timeouts.
context.skip('Dataflow Tool Tile', function () {
  it("Link table with Recorded Data", () => {
    beforeTest();

    cy.log("create a small program, select sampling rate and record data");
    clueCanvas.addTile("dataflow");
    dataflowToolTile.createProgram(programNodes);
    dataflowToolTile.checkInitialStateButtons();
    dataflowToolTile.recordData("1000", timer1);
    clueCanvas.addTile("table");
    cy.linkTableToDataflow(programTitle, tableTitle);

    cy.log("verify link table from dataflow with recorded data");
    dataflowToolTile.checkLinkedTableRecordedData(tableTile, tableTitle, linkedTableAttributes, timer1);

    dataflowToolTile.clearRecordedData();
    dataflowToolTile.checkEmptyLinkedTable(tableTile, tableTitle, defaultTableAttributes);

    dataflowToolTile.recordData("1000", timer2);
    dataflowToolTile.checkLinkedTableRecordedData(tableTile, tableTitle, linkedTableAttributes, timer2);

    cy.unlinkTableToDataflow("Program 1", "Table 1");
    dataflowToolTile.checkEmptyLinkedTable(tableTile, tableTitle, defaultTableAttributes);

    cy.linkTableToDataflow(programTitle, tableTitle);
    dataflowToolTile.checkLinkedTableRecordedData(tableTile, tableTitle, linkedTableAttributes, timer2);

    dataflowToolTile.clearRecordedData();
    dataflowToolTile.checkEmptyLinkedTable(tableTile, tableTitle, defaultTableAttributes);

  });
  it("verify the effect of page reload cause on various button states and linked table state", () => {
    beforeTest();

    cy.log("create a small program, select sampling rate and record data");
    clueCanvas.addTile("dataflow");
    dataflowToolTile.createProgram(programNodes);
    dataflowToolTile.checkInitialStateButtons();
    dataflowToolTile.recordData("1000", timer1);
    clueCanvas.addTile("table");
    cy.linkTableToDataflow(programTitle, tableTitle);

    // record data
    dataflowToolTile.clearRecordedData();
    dataflowToolTile.recordDataWithoutStop("1000", timer2);

    // reload while recording
    cy.reload();

    // check buttons after reload
    dataflowToolTile.checkRecordedStateButtons();
    dataflowToolTile.checkLinkedTableRecordedData(tableTile, tableTitle, linkedTableAttributes, timer2);

    // play recorded data
    dataflowToolTile.clickPlayButton();

    // reload while playing
    cy.reload();

    // check buttons after reload
    dataflowToolTile.checkRecordedStateButtons();
    dataflowToolTile.checkLinkedTableRecordedData(tableTile, tableTitle, linkedTableAttributes, timer2);

    // pause recorded data
    dataflowToolTile.clickPlayButton();
    cy.wait(1000);
    dataflowToolTile.clickPauseButton();

    // reload while in pause
    cy.reload();

    // check buttons after reload
    dataflowToolTile.checkRecordedStateButtons();
    dataflowToolTile.checkLinkedTableRecordedData(tableTile, tableTitle, linkedTableAttributes, timer2);

    // click clear
    dataflowToolTile.getRecordingClearButton().click();

    // reload before confirming clear
    cy.reload();

    // check buttons after reload
    dataflowToolTile.checkRecordedStateButtons();
    dataflowToolTile.checkLinkedTableRecordedData(tableTile, tableTitle, linkedTableAttributes, timer2);

    // record data
    dataflowToolTile.clearRecordedData();

    // reload after confirming clear
    // cy.reload();

    // check buttons after reload
    dataflowToolTile.checkInitialStateButtons();
    dataflowToolTile.checkEmptyLinkedTable(tableTile, tableTitle, defaultTableAttributes);
  });
});
