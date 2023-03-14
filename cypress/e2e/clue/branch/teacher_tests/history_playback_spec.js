import TeacherDashboard from "../../../../support/elements/clue/TeacherDashboard";
import ClueCanvas from "../../../../support/elements/clue/cCanvas";
import TableToolTile from "../../../../support/elements/clue/TableToolTile";
import DrawToolTile from "../../../../support/elements/clue/DrawToolTile";

let dashboard = new TeacherDashboard;
let clueCanvas = new ClueCanvas;
let tableToolTile = new TableToolTile;
let drawToolTile = new DrawToolTile;

const queryParams = "/?appMode=qa&fakeClass=5&fakeOffering=5&problem=2.1&fakeUser=teacher:7&unit=msa";

context('History Playback', () => {

  before(() => {
    cy.clearQAData('all');

    cy.visit(queryParams);
    cy.waitForLoad();
    dashboard.switchView("Workspace & Resources");
    cy.wait(2000);
    clueCanvas.getInvestigationCanvasTitle().text().as('investigationTitle');
  });
  beforeEach(() => {
    cy.fixture("teacher-dash-data-msa-test.json").as("clueData");
  });

  it('verify playback shows no history if there is no history', function() {
    cy.openTopTab('my-work');
    cy.openDocumentThumbnail('workspaces', this.investigationTitle);
    cy.get('[data-testid="playback-component-button"]').click();
    cy.get('.playback-controls').contains("This document has no history");
    cy.get('[data-testid="playback-component-button"]').click();
  });
  it('verify playback controls open with slider when there is history', () => {
    clueCanvas.addTile('drawing');
    // give firestore some time to record this new history entry before we try
    // to find it.
    // FIXME: really this is a bug, it shouldn't matter how quickly a user 
    // opens the history controls. The code should know what the history entry is that
    // matches the document that it is displaying
    cy.wait(4000);
    cy.get('[data-testid="playback-component-button"]').click();
    cy.get('[data-testid="playback-slider"]').should('be.visible');
    cy.get('[data-testid="playback-time-info"]').should('be.visible');
  });
  it('verify play button is disabled when slider handle is at the right end', () => {
    cy.get('[data-testid="playback-play-button"]').should('have.class', "disabled");
  });
  it('verify added tile is visible in the playback document', () => {
    cy.get('[data-test="subtab-workspaces"] .editable-document-content .canvas .document-content .drawing-tool-tile').should('be.visible');
  });
  it('verify play button is enabled when playback is rewound', () => {
    cy.get('.rc-slider-horizontal').click('left');
    cy.get('[data-testid="playback-play-button"]').should('not.have.class', 'disabled');
  });
  it('verify correct document state is shown in playback document when slider is moved', () => {
    cy.get('[data-test="subtab-workspaces"] .editable-document-content .canvas .document-content .drawing-tool-tile').should('not.exist');
  });
  it('verify primary document remains unchanged during playback', () => {
    cy.get('.primary-workspace .editable-document-content .canvas .document-content .drawing-tool-tile').should('be.visible');
  });
  it('verify playback document does not have changes to primary document', () => {
    drawToolTile.getDrawToolLine().click();
    drawToolTile.getDrawTile()
      .trigger('mousedown')
      .trigger('mousemove', 50,0)
      .trigger('mouseup');
    cy.get('.primary-workspace .editable-document-content .canvas .document-content .drawing-tool .drawing-layer line').should('be.visible');
    cy.get('[data-test="subtab-workspaces"] .editable-document-content .canvas .document-content .drawing-tool .drawing-layer line').should('not.exist');
  });
  it('verify playback document is updated when playback controls is closed and reopened', () => {
    cy.get('[data-testid="playback-component-button"]').click(); //close playback controls
    cy.get('[data-testid="playback-component-button"]').click(); //open playback controls
    cy.get('[data-test="subtab-workspaces"] .editable-document-content .canvas .document-content .drawing-tool .drawing-layer line').should('be.visible');
  });
  it('verify playback of history', () => {
    cy.get('.rc-slider-horizontal').click('left');
    cy.get('[data-test="subtab-workspaces"] .editable-document-content .canvas .document-content .drawing-tool .drawing-layer line').should('not.exist');
    cy.get('[data-testid="playback-play-button"]').click();
    cy.wait(2000);
    cy.get('[data-test="subtab-workspaces"] .editable-document-content .canvas .document-content .drawing-tool .drawing-layer line').should('be.visible');
  });
  describe('Table Tile History Support', () => {
    before(() => {
      // Close playback controls
      cy.get('[data-testid="playback-component-button"]').click(); //open playback controls

      // create a table
      clueCanvas.addTile('table');
      // 
      // By default getTableTile looks in the right side (editable) workspace
      tableToolTile.getTableTile().within(() => {
        tableToolTile.typeInTableCell(1, '1');
        tableToolTile.typeInTableCell(2, '2');
      });
    });

    it('verify table shows up in main doc on the left', () => {
      tableToolTile.getTableTile('[data-test="subtab-workspaces"] .editable-document-content').should('exist');

      tableToolTile.getTableTile('[data-test="subtab-workspaces"] .editable-document-content').within(() => {
        tableToolTile.getTableCell().eq(1).should('contain', '1');
        tableToolTile.getTableCell().eq(2).should('contain', '2');
      });
    });

    it('verify table shows up in history doc on the left', () => {
      // Open playback controls
      cy.get('[data-testid="playback-component-button"]').click(); //open playback controls

      // wait for it to load
      cy.get('.rc-slider-horizontal').should('exist');

      tableToolTile.getTableTile('[data-test="subtab-workspaces"] .editable-document-content').should('exist');

      tableToolTile.getTableTile('[data-test="subtab-workspaces"] .editable-document-content').within(() => {
        tableToolTile.getTableCell().eq(1).should('contain', '1');
        tableToolTile.getTableCell().eq(2).should('contain', '2');
      });
    });

    function moveSliderTo(percent) {
      cy.get('.rc-slider-horizontal').then($slider => {
        const width = $slider.width();
        cy.wrap($slider).click(width*percent/100, 0);
      });
    }

    it('verify table is undone in the correctly', () => {
      moveSliderTo(80);
      tableToolTile.getTableTile('[data-test="subtab-workspaces"] .editable-document-content').within(() => {
        tableToolTile.getTableCell().eq(1).should('contain', '1');
        tableToolTile.getTableCell().eq(2).should('not.contain', '2');
      });

      moveSliderTo(60);
      tableToolTile.getTableTile('[data-test="subtab-workspaces"] .editable-document-content').within(() => {
        tableToolTile.getTableCell().should('not.exist');
      });

      moveSliderTo(40);
      cy.get('[data-test="subtab-workspaces"] .editable-document-content .canvas .document-content .table-tool').should('not.exist');
    });

    it('verify table is redone in the correctly', () => {
      moveSliderTo(60);
      tableToolTile.getTableTile('[data-test="subtab-workspaces"] .editable-document-content').within(() => {
        tableToolTile.getTableCell().should('not.exist');
      });

      moveSliderTo(80);
      tableToolTile.getTableTile('[data-test="subtab-workspaces"] .editable-document-content').within(() => {
        tableToolTile.getTableCell().eq(1).should('contain', '1');
        tableToolTile.getTableCell().eq(2).should('not.contain', '2');
      });

      moveSliderTo(99);
      tableToolTile.getTableTile('[data-test="subtab-workspaces"] .editable-document-content').within(() => {
        tableToolTile.getTableCell().eq(1).should('contain', '1');
        tableToolTile.getTableCell().eq(2).should('contain', '2');
      });
    });
    it('verify undo action in primary document and verify playback of history', () => {
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
    });
    it('verify playback icon in class work & learning logs & icon background color', () => {
      cy.get('[data-testid="playback-component-button"]').click();
      cy.get('.playback-toolbar-button.themed.my-work').should('have.css', 'background-color', 'rgb(183, 226, 236)');
      clueCanvas.publishDoc("This Class");
      cy.openSection('my-work', "learning-log");
      cy.openDocumentWithTitle('my-work', 'learning-log','My First Learning Log');
      cy.get('[data-testid="playback-component-button"]').should('be.visible');
      cy.get('.playback-toolbar-button.themed.my-work').should('have.css', 'background-color', 'rgb(183, 226, 236)');
      clueCanvas.publishDoc("This Class");
      cy.openTopTab('class-work');
      cy.openSection('class-work', "workspaces");
      cy.openDocumentThumbnail('workspaces','Network User');
      cy.get('[data-testid="playback-component-button"]').should('be.visible');
      cy.get('.playback-toolbar-button.themed.class-work').should('have.css', 'background-color', 'rgb(236, 201, 255)');
      cy.openSection('class-work', "learning-logs");
      cy.openDocumentThumbnail('learning-logs','Network User');
      cy.get('[data-testid="playback-component-button"]').should('be.visible');
      cy.get('.playback-toolbar-button.themed.class-work').should('have.css', 'background-color', 'rgb(236, 201, 255)');
    });
  });
});

context('History Playback for student', () => {

  before(() => {
    cy.clearQAData('all');

    cy.visit('/?appMode=demo&demoName=CLUE-Test&fakeClass=5&fakeOffering=5&problem=2.1&fakeUser=student:1');
    cy.waitForLoad();
    cy.wait(2000);
    clueCanvas.getInvestigationCanvasTitle().text().as('investigationTitle');
  });

  it('verify playback icon not displayed for student', function() {
    cy.openTopTab('my-work');
    cy.openDocumentThumbnail('workspaces', this.investigationTitle);
    cy.get('[data-testid="playback-component-button"]').should("not.exist");
  });
});
