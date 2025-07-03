import ClueCanvas from "../../../support/elements/common/cCanvas";
import TableToolTile from "../../../support/elements/tile/TableToolTile";
import DrawToolTile from "../../../support/elements/tile/DrawToolTile";

let clueCanvas = new ClueCanvas;
let tableToolTile = new TableToolTile;
let drawToolTile = new DrawToolTile;

const queryParams = `${Cypress.config("qaUnitTeacher6")}`;
const studentQueryParams = `${Cypress.config("clueTestqaUnitStudent5")}`;

function moveSliderTo(percent) {
  cy.get('.rc-slider-horizontal').then($slider => {
    const width = $slider.width();
    cy.wrap($slider).click(width * percent / 100, 0);
  });
}

function beforeTest(params) {
  cy.visit(params);
  cy.waitForLoad();
  clueCanvas.getInvestigationCanvasTitle().text().then((investigationTitle) => {
    cy.openTopTab('my-work');
    cy.openDocumentThumbnail('my-work', 'workspaces', investigationTitle);
  });
}

context('History Playback', () => {
  it.skip('verify playback', function () {
    beforeTest(queryParams);

    cy.log('verify playback shows no history if there is no history');
    cy.get('.toolbar .tool.toggleplayback').click();
    cy.get('.playback-controls').contains("This document has no history");
    cy.get('.toolbar .tool.toggleplayback').click();

    cy.log('verify playback controls open with slider when there is history');
    clueCanvas.addTile('drawing');
    // give firestore some time to record this new history entry before we try
    // to find it.
    // FIXME: really this is a bug, it shouldn't matter how quickly a user
    // opens the history controls. The code should know what the history entry is that
    // matches the document that it is displaying
    cy.wait(4000);
    cy.get('.toolbar .tool.toggleplayback').click();
    cy.get('[data-testid="playback-slider"]').should('be.visible');
    cy.get('[data-testid="playback-time-info"]').should('be.visible');

    cy.log('verify play button is disabled when slider handle is at the right end');
    cy.wait(10);
    cy.get('[data-testid="playback-play-button"]').should('have.class', "disabled");

    cy.log('verify added tile is visible in the playback document');
    cy.get('[data-test="subtab-workspaces"] .editable-document-content .canvas .document-content .drawing-tool-tile').should('be.visible');

    cy.log('verify play button is enabled when playback is rewound');
    cy.get('.rc-slider-horizontal').click('left');
    cy.get('[data-testid="playback-play-button"]').should('not.have.class', 'disabled');

    cy.log('verify correct document state is shown in playback document when slider is moved');
    cy.get('[data-test="subtab-workspaces"] .editable-document-content .canvas .document-content .drawing-tool-tile').should('not.exist');

    cy.log('verify primary document remains unchanged during playback');
    cy.get('.primary-workspace .editable-document-content .canvas .document-content .drawing-tool-tile').should('be.visible');

    cy.log('verify playback document does not have changes to primary document');
    drawToolTile.drawVector(50, 50, 50, 0);
    cy.get('.primary-workspace .editable-document-content .canvas .document-content .drawing-tool .drawing-layer line').should('be.visible');
    cy.get('[data-test="subtab-workspaces"] .editable-document-content .canvas .document-content .drawing-tool .drawing-layer line').should('not.exist');

    cy.log('verify playback document is updated when playback controls is closed and reopened');
    cy.get('.toolbar .tool.toggleplayback').click(); //close playback controls
    cy.get('.toolbar .tool.toggleplayback').click(); //open playback controls
    cy.get('[data-test="subtab-workspaces"] .editable-document-content .canvas .document-content .drawing-tool .drawing-layer line').should('be.visible');

    cy.log('verify playback of history');
    cy.get('.rc-slider-horizontal').click('left');
    cy.get('[data-test="subtab-workspaces"] .editable-document-content .canvas .document-content .drawing-tool .drawing-layer line').should('not.exist');
    cy.get('[data-testid="playback-play-button"]').click();
    cy.wait(2000);
    cy.get('[data-test="subtab-workspaces"] .editable-document-content .canvas .document-content .drawing-tool .drawing-layer line').should('be.visible');
  });

  it.skip("verify table tile history", () => {
    beforeTest(queryParams);

    cy.log('create table and add a row in it');
    // create a table
    clueCanvas.addTile('table');
    // By default getTableTile looks in the right side (editable) workspace
    tableToolTile.getTableTile().within(() => {
      tableToolTile.typeInTableCell(1, '1');
      tableToolTile.typeInTableCell(2, '2');
    });

    cy.log('verify table shows up in main doc on the left');
    tableToolTile.getTableTile('[data-test="subtab-workspaces"] .editable-document-content').should('exist');
    tableToolTile.getTableTile('[data-test="subtab-workspaces"] .editable-document-content').within(() => {
      tableToolTile.getTableCell().eq(1).should('contain', '1');
      tableToolTile.getTableCell().eq(2).should('contain', '2');
    });

    cy.log('verify table shows up in history doc on the left');
    // Open playback controls
    cy.get('.toolbar .tool.toggleplayback').click(); //open playback controls
    // wait for it to load
    cy.get('.rc-slider-horizontal').should('exist');
    tableToolTile.getTableTile('[data-test="subtab-workspaces"] .editable-document-content').should('exist');
    tableToolTile.getTableTile('[data-test="subtab-workspaces"] .editable-document-content').within(() => {
      tableToolTile.getTableCell().eq(1).should('contain', '1');
      tableToolTile.getTableCell().eq(2).should('contain', '2');
    });

    cy.log('verify table is undone in the correctly');
    moveSliderTo(80);
    tableToolTile.getTableTile('[data-test="subtab-workspaces"] .editable-document-content').within(() => {
      tableToolTile.getTableCell().eq(1).should('contain', '1');
      tableToolTile.getTableCell().eq(2).should('not.contain', '2');
    });
    moveSliderTo(40);
    tableToolTile.getTableTile('[data-test="subtab-workspaces"] .editable-document-content').within(() => {
      tableToolTile.getTableCell().should('not.exist');
    });
    moveSliderTo(10);
    cy.get('[data-test="subtab-workspaces"] .editable-document-content .canvas .document-content .table-tool').should('not.exist');

    cy.log('verify table is redone in the correctly');
    moveSliderTo(40);
    tableToolTile.getTableTile('[data-test="subtab-workspaces"] .editable-document-content').within(() => {
      tableToolTile.getTableCell().should('not.exist');
    });
    moveSliderTo(80);
    tableToolTile.getTableTile('[data-test="subtab-workspaces"] .editable-document-content').within(() => {
      tableToolTile.getTableCell().eq(1).should('contain', '1');
      tableToolTile.getTableCell().eq(2).should('not.contain', '2');
    });
    // This was 99 and sometimes Cypress said it was covered by the parent element
    moveSliderTo(98);
    tableToolTile.getTableTile('[data-test="subtab-workspaces"] .editable-document-content').within(() => {
      tableToolTile.getTableCell().eq(1).should('contain', '1');
      tableToolTile.getTableCell().eq(2).should('contain', '2');
    });

    cy.log('verify undo action in primary document and verify playback of history');
    clueCanvas.getUndoTool().click();
    tableToolTile.getTableTile('[data-test="subtab-workspaces"] .editable-document-content').within(() => {
      tableToolTile.getTableCell().eq(1).should('contain', '1');
      tableToolTile.getTableCell().eq(2).should('contain', '2');
    });
    tableToolTile.getTableTile().within(() => {
      tableToolTile.getTableCell().eq(1).should('contain', '1');
      tableToolTile.getTableCell().eq(2).should('not.contain', '2');
    });
    cy.get('[data-testid="playback-play-button"]').click();
    cy.wait(2000);
    tableToolTile.getTableTile('[data-test="subtab-workspaces"] .editable-document-content').within(() => {
      tableToolTile.getTableCell().eq(1).should('contain', '1');
      tableToolTile.getTableCell().eq(2).should('not.contain', '2');
    });
    clueCanvas.getRedoTool().click();
    tableToolTile.getTableTile().within(() => {
      tableToolTile.getTableCell().eq(1).should('contain', '1');
      tableToolTile.getTableCell().eq(2).should('contain', '2');
    });
    tableToolTile.getTableTile('[data-test="subtab-workspaces"] .editable-document-content').within(() => {
      tableToolTile.getTableCell().eq(1).should('contain', '1');
      tableToolTile.getTableCell().eq(2).should('not.contain', '2');
    });
    cy.get('[data-testid="playback-play-button"]').click();
    cy.wait(2000);
    tableToolTile.getTableTile('[data-test="subtab-workspaces"] .editable-document-content').within(() => {
      tableToolTile.getTableCell().eq(1).should('contain', '1');
      tableToolTile.getTableCell().eq(2).should('contain', '2');
    });

    cy.log('verify playback icon in class work & learning logs & icon background color');
    // playback is already open here...
    cy.get('.playback-component.my-work').should('have.css', 'background-color', 'rgb(240, 249, 251)');
    clueCanvas.publishDoc("This Class");
    cy.openSection('my-work', "learning-log");
    cy.openDocumentWithTitle('my-work', 'learning-log', 'My First Learning Log');
    cy.get('.toolbar .tool.toggleplayback').eq(1).click();
    cy.get('.toolbar .tool.toggleplayback').eq(1).should('be.visible');
    cy.get('.playback-component.my-work').should('have.css', 'background-color', 'rgb(240, 249, 251)');
    clueCanvas.publishDoc("This Class");
    //removed palyback button in published documents
    // cy.openTopTab('class-work');
    // cy.openSection('class-work', "workspaces");
    // cy.openDocumentThumbnail('class-work','workspaces','Network User');
    // cy.get('.toolbar .tool.toggleplayback').should('be.visible');
    // cy.get('.playback-toolbar-button.themed.class-work').should('have.css', 'background-color', 'rgb(236, 201, 255)');
    // cy.openSection('class-work', "learning-logs");
    // cy.openDocumentThumbnail('class-work','learning-logs','Network User');
    // cy.get('.toolbar .tool.toggleplayback').should('be.visible');
    // cy.get('.playback-toolbar-button.themed.class-work').should('have.css', 'background-color', 'rgb(236, 201, 255)');
  });

  it('verify playback icon not displayed for student', function() {
    beforeTest(studentQueryParams);

    cy.get('.toolbar .tool.toggleplayback').should("not.exist");
  });
});
