import ClueCanvas from '../../../support/elements/common/cCanvas';
import Canvas from '../../../support/elements/common/Canvas';
import BarGraphTile from '../../../support/elements/tile/BarGraphTile';
import TableToolTile
 from '../../../support/elements/tile/TableToolTile';
import { LogEventName } from "../../../../src/lib/logger-types";


let clueCanvas = new ClueCanvas,
  barGraph = new BarGraphTile,
  tableTile = new TableToolTile;

// eslint-disable-next-line unused-imports/no-unused-vars
const canvas = new Canvas;

const workspaces = ['.primary-workspace', '.read-only-local-workspace', '.read-only-remote-workspace'];

function textMatchesList(selector, expected) {
  selector.should('have.length', expected.length);
  selector.each(($el, index) => {
    cy.wrap($el).invoke('text').then(text => cy.wrap(text).should('eq', expected[index]));
  });
}

function beforeTest() {
  const url = "/editor/?appMode=qa&unit=./demo/units/qa/content.json";
  cy.visit(url);
  cy.window().then(win => {
    cy.stub(win.ccLogger, "log").as("log");
  });
}

context('Bar Graph Tile', function () {

  it('Basic tile operations', function () {
    beforeTest();

    clueCanvas.addTile('bargraph');
    for (const workspace of workspaces) {
      barGraph.getTiles(workspace).should('have.length', 1);
      barGraph.getTile(workspace, 0)
        .should('be.visible')
        .and('have.class', 'bar-graph-tile');
      barGraph.getTileTitle(workspace).should("be.visible").and('have.text', 'Bar Graph 1');
      barGraph.getYAxisLabel(workspace).should('have.text', 'Counts');
      barGraph.getXAxisPulldownButton(workspace).should('have.text', 'Categories');
    }
    barGraph.getTile(workspaces[0]).should('not.have.class', 'readonly');
    barGraph.getTile(workspaces[1]).should('have.class', 'readonly');
    barGraph.getTile(workspaces[2]).should('have.class', 'readonly');

    cy.get("@log")
      .should("have.been.been.calledWith", LogEventName.CREATE_TILE, Cypress.sinon.match.object)
      .its("firstCall.args.1").should("deep.include", { objectType: "BarGraph" });

    // Undo/redo tile creation
    clueCanvas.getUndoTool().click();
    for (const workspace of workspaces) {
      barGraph.getTiles(workspace).should('have.length', 0);
    }
    clueCanvas.getRedoTool().click();
    for (const workspace of workspaces) {
      barGraph.getTiles(workspace).should('have.length', 1);
    }

    cy.log('Change Y axis label');
    barGraph.getYAxisLabelEditor().should('not.exist');
    barGraph.getYAxisLabelButton().click();
    barGraph.getYAxisLabelEditor().should('be.visible').type(' of something{enter}');
    barGraph.getYAxisLabelEditor().should('not.exist');
    for (const workspace of workspaces) {
      barGraph.getYAxisLabel(workspace).should('have.text', 'Counts of something');
    }

    cy.get("@log").its("lastCall.args.0").should("equal", LogEventName.BARGRAPH_TOOL_CHANGE);
    cy.get("@log").its("lastCall.args.1").should("deep.include", { operation: "setYAxisLabel", text: "Counts of something" });

    // Undo/redo label change
    clueCanvas.getUndoTool().click();
    barGraph.getYAxisLabel().should('have.text', 'Counts');
    clueCanvas.getRedoTool().click();
    barGraph.getYAxisLabel().should('have.text', 'Counts of something');

    // ESC key should cancel the edit
    barGraph.getYAxisLabelButton().click();
    barGraph.getYAxisLabelEditor().should('be.visible').type(' abandon this{esc}');
    barGraph.getYAxisLabelEditor().should('not.exist');
    barGraph.getYAxisLabel().should('have.text', 'Counts of something');

    // Should not be able to change Y axis label in read-only views
    barGraph.getYAxisLabelButton(workspaces[1]).click();
    barGraph.getYAxisLabelEditor(workspaces[1]).should('not.exist');
    barGraph.getYAxisLabelButton(workspaces[2]).click();
    barGraph.getYAxisLabelEditor(workspaces[2]).should('not.exist');

    cy.log('Duplicate tile');
    clueCanvas.getDuplicateTool().click();
    for (const workspace of workspaces) {
      barGraph.getTiles(workspace).should('have.length', 2);
      barGraph.getTile(workspace, 0)
        .should('be.visible')
        .and('have.class', 'bar-graph-tile');
      barGraph.getTileTitle(workspace, 0).should("be.visible").and('have.text', 'Bar Graph 1');
      barGraph.getYAxisLabel(workspace, 0).should('have.text', 'Counts of something');
      barGraph.getXAxisPulldownButton(workspace, 0).should('have.text', 'Categories');

      barGraph.getTile(workspace, 1)
        .should('be.visible')
        .and('have.class', 'bar-graph-tile');
      barGraph.getTileTitle(workspace, 1).should("be.visible").and('have.text', 'Bar Graph 2');
      barGraph.getYAxisLabel(workspace, 1).should('have.text', 'Counts of something');
      barGraph.getXAxisPulldownButton(workspace, 1).should('have.text', 'Categories');
    }

    cy.get("@log").its("lastCall.args.0").should("equal", LogEventName.COPY_TILE);
    cy.get("@log").its("lastCall.args.1").should("deep.include", { objectType: "BarGraph" });

    // Undo/redo tile duplication
    clueCanvas.getUndoTool().click();
    for (const workspace of workspaces) {
      barGraph.getTiles(workspace).should('have.length', 1);
    }
    clueCanvas.getRedoTool().click();
    for (const workspace of workspaces) {
      barGraph.getTiles(workspace).should('have.length', 2);
    }

    cy.log('Delete tile');
    clueCanvas.deleteTile('bargraph');
    clueCanvas.deleteTile('bargraph');
    for (const workspace of workspaces) {
      barGraph.getTiles(workspace).should('have.length', 0);
    }

    cy.get("@log").its("lastCall.args.0").should("equal", LogEventName.DELETE_TILE);
    cy.get("@log").its("lastCall.args.1").should("deep.include", { objectType: "BarGraph" });

    // Undo/redo tile deletion
    clueCanvas.getUndoTool().click();
    for (const workspace of workspaces) {
      barGraph.getTiles(workspace).should('have.length', 1);
    }
    clueCanvas.getUndoTool().click();
    for (const workspace of workspaces) {
      barGraph.getTiles(workspace).should('have.length', 2);
    }
    clueCanvas.getRedoTool().click();
    for (const workspace of workspaces) {
      barGraph.getTiles(workspace).should('have.length', 1);
    }
    clueCanvas.getRedoTool().click();
    for (const workspace of workspaces) {
      barGraph.getTiles(workspace).should('have.length', 0);
    }
  });

  it('Can link data ', function () {
    beforeTest();

    clueCanvas.addTile('bargraph');
    for (const workspace of workspaces) {
      barGraph.getYAxisLabel(workspace).should('have.text', 'Counts');
      barGraph.getXAxisPulldown(workspace).should('have.text', 'Categories');
      barGraph.getYAxisTickLabel(workspace).should('not.exist');
      barGraph.getXAxisTickLabel(workspace).should('not.exist');
      barGraph.getLegendArea(workspace).should('not.exist');
      barGraph.getBar(workspace).should('not.exist');
    }

    // Table dataset for testing:
    // 4 instances of X / Y / Z
    // 2 instances of XX / Y / Z
    // 1 instance of X / YY / Z
    clueCanvas.addTile('table');
    tableTile.fillTable(tableTile.getTableTile(), [
      ['X', 'Y', 'Z'],
      ['XX', 'Y', 'Z'],
      ['X', 'YY', 'Z'],
      ['X', 'Y', 'Z'],
      ['XX', 'Y', 'Z'],
      ['X', 'Y', 'Z'],
      ['X', 'Y', 'Z'],
    ]);

    cy.log('Link bar graph');
    barGraph.getTile().click();
    clueCanvas.clickToolbarButton('bargraph', 'link-tile');
    cy.get('select').select('Table Data 1');
    cy.get('.modal-button').contains("Graph It!").click();

    for (const workspace of workspaces) {
      barGraph.getXAxisPulldown(workspace).should('have.text', 'x');
      textMatchesList(barGraph.getXAxisTickLabel(workspace), ['X', 'XX']);
      textMatchesList(barGraph.getYAxisTickLabel(workspace), ['0', '1', '2', '3', '4', '5']);
      barGraph.getBar(workspace).should('have.length', 2);
      barGraph.getDatasetLabel(workspace).should('have.text', 'Table Data 1');
      barGraph.getSortByMenuButton(workspace).should('have.text', 'None');
      barGraph.getSecondaryValueName(workspace).should('have.length', 1).and('have.text', 'x');
    }

    cy.get("@log").its("lastCall.args.0").should("equal", LogEventName.TILE_LINK);
    cy.get("@log").its("lastCall.args.1").should("nested.include", { "sourceTile.type": "BarGraph", "sharedModel.type": "SharedDataSet" });

    // Undo/redo linking
    clueCanvas.getUndoTool().click();
    for (const workspace of workspaces) {
      barGraph.getXAxisPulldown(workspace).should('have.text', 'Categories');
      barGraph.getLegendArea(workspace).should('not.exist');
      barGraph.getBar(workspace).should('not.exist');
    }

    clueCanvas.getRedoTool().click();
    for (const workspace of workspaces) {
      barGraph.getDatasetLabel(workspace).should('have.text', 'Table Data 1');
      barGraph.getXAxisPulldown(workspace).should('have.text', 'x');
      barGraph.getBar(workspace).should('have.length', 2);
    }

    cy.log('Legend should move to bottom when tile is narrow');
    barGraph.getTileContent().should('have.class', 'horizontal').and('not.have.class', 'vertical');
    clueCanvas.addTileByDrag('table', 'right');
    clueCanvas.addTileByDrag('table', 'right');
    for (const workspace of workspaces) {
      barGraph.getTileContent(workspace).should('have.class', 'vertical').and('not.have.class', 'horizontal');
    }
    clueCanvas.getUndoTool().click(); // undo add table
    clueCanvas.getUndoTool().click(); // undo add table
    for (const workspace of workspaces) {
      tableTile.getTableTile(workspace).should('have.length', 1);
      barGraph.getTileContent(workspace).should('have.class', 'horizontal').and('not.have.class', 'vertical');
    }

    cy.log('Change Sort By');
    barGraph.getSortByMenuButton().should('have.text', 'None');

    // Cannot change sort by in read-only views
    for (const workspace of workspaces.slice(1)) {
      barGraph.getSortByMenuButton(workspace).click();
      barGraph.getChakraMenuItem(workspace).should('have.length', 3);
      barGraph.getChakraMenuItem(workspace).eq(1).should('have.text', 'y'); // menu exists
      barGraph.getChakraMenuItem(workspace).should('be.disabled'); // all options disabled
      barGraph.getSortByMenuButton(workspace).click(); // close menu
    }

    barGraph.getSortByMenuButton().click();
    barGraph.getChakraMenuItem().should('have.length', 3);
    barGraph.getChakraMenuItem().eq(1).should('have.text', 'y').click();
    for (const workspace of workspaces) {
      textMatchesList(barGraph.getXAxisTickLabel(workspace), ['X', 'XX']);
      textMatchesList(barGraph.getYAxisTickLabel(workspace), ['0', '1', '2', '3', '4', '5']);
      barGraph.getBar(workspace).should('have.length', 3);
      barGraph.getDatasetLabel(workspace).should('have.text', 'Table Data 1');
      barGraph.getSortByMenuButton(workspace).should('have.text', 'y');
      textMatchesList(barGraph.getSecondaryValueName(workspace), ['Y', 'YY']);
    }

    cy.get("@log").its("lastCall.args.0").should("equal", LogEventName.BARGRAPH_TOOL_CHANGE);
    cy.get("@log").its("lastCall.args.1").should("deep.include", { operation: "setSecondaryAttribute" });

    // Undo-redo sort by
    clueCanvas.getUndoTool().click();
    for (const workspace of workspaces) {
      barGraph.getSortByMenuButton(workspace).should('have.text', 'None');
      barGraph.getBar(workspace).should('have.length', 2);
      barGraph.getSecondaryValueName(workspace).should('have.text', 'x');
    }
    clueCanvas.getRedoTool().click();
    for (const workspace of workspaces) {
      barGraph.getSortByMenuButton(workspace).should('have.text', 'y');
      textMatchesList(barGraph.getSecondaryValueName(workspace), ['Y', 'YY']);
      barGraph.getBar(workspace).should('have.length', 3);
    }

    cy.log('Change Category');

    // Cannot change category in read-only views
    for (const workspace of workspaces.slice(1)) {
      barGraph.getXAxisPulldownButton(workspace).click();
      barGraph.getChakraMenuItem(workspace).should('have.length', 3).and('be.disabled');
      barGraph.getXAxisPulldownButton(workspace).click(); // close menu
    }

    barGraph.getXAxisPulldownButton().click();
    barGraph.getChakraMenuItem().should('have.length', 3);
    barGraph.getChakraMenuItem().eq(1).should('have.text', 'y').click();
    for (const workspace of workspaces) {
      barGraph.getXAxisPulldown(workspace).should('have.text', 'y');
      textMatchesList(barGraph.getXAxisTickLabel(workspace), ['Y', 'YY']);
      textMatchesList(barGraph.getYAxisTickLabel(workspace), ['0', '2', '4', '6', '8', '10']); // there are 6 Ys in this view so scale expands.
      barGraph.getBar(workspace).should('have.length', 2);
      barGraph.getDatasetLabel(workspace).should('have.text', 'Table Data 1');
      barGraph.getSortByMenuButton(workspace).should('have.text', 'None');
      barGraph.getSecondaryValueName(workspace).should('have.length', 1).and('have.text', 'y');
    }

    cy.get("@log").its("lastCall.args.0").should("equal", LogEventName.BARGRAPH_TOOL_CHANGE);
    cy.get("@log").its("lastCall.args.1").should("deep.include", { operation: "setPrimaryAttribute" });

    // Undo-redo category change
    clueCanvas.getUndoTool().click();
    for (const workspace of workspaces) {
      barGraph.getXAxisPulldown(workspace).should('have.text', 'x');
      textMatchesList(barGraph.getXAxisTickLabel(workspace), ['X', 'XX']);
    }
    clueCanvas.getRedoTool().click();
    for (const workspace of workspaces) {
      barGraph.getXAxisPulldown(workspace).should('have.text', 'y');
      textMatchesList(barGraph.getXAxisTickLabel(workspace), ['Y', 'YY']);
    }

    cy.log('Unlink data');
    barGraph.getDatasetUnlinkButton().click();
    for (const workspace of workspaces) {
      barGraph.getXAxisPulldown(workspace).should('have.text', 'Categories');
      barGraph.getYAxisTickLabel(workspace).should('not.exist');
      barGraph.getXAxisTickLabel(workspace).should('not.exist');
      barGraph.getLegendArea(workspace).should('not.exist');
      barGraph.getBar(workspace).should('not.exist');
    }

    cy.get("@log").its("lastCall.args.0").should("equal", LogEventName.TILE_UNLINK);
    cy.get("@log").its("lastCall.args.1").should("nested.include", { "sourceTile.type": "BarGraph", "sharedModel.type": "SharedDataSet" });

    // Undo-redo unlink
    clueCanvas.getUndoTool().click();
    for (const workspace of workspaces) {
      barGraph.getXAxisPulldown().should('have.text', 'y');
      textMatchesList(barGraph.getXAxisTickLabel(workspace), ['Y', 'YY']);
      barGraph.getBar(workspace).should('have.length', 2);
    }
    clueCanvas.getRedoTool().click();
    for (const workspace of workspaces) {
      barGraph.getXAxisPulldown(workspace).should('have.text', 'Categories');
      barGraph.getBar(workspace).should('not.exist');
    }
  });

});
