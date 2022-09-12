import TeacherDashboard from "../../../../support/elements/clue/TeacherDashboard";
import ClueCanvas from "../../../../support/elements/clue/cCanvas";
import Canvas from "../../../../support/elements/common/Canvas";
import TableToolTile from "../../../../support/elements/clue/TableToolTile";
import DrawToolTile from "../../../../support/elements/clue/DrawToolTile";
import PrimaryWorkspace from "../../../../support/elements/common/PrimaryWorkspace";

let dashboard = new TeacherDashboard();
let clueCanvas = new ClueCanvas;
let canvas = new Canvas;
let tableToolTile = new TableToolTile;
let drawToolTile = new DrawToolTile;
let primaryWorkSpace = new PrimaryWorkspace;

let teacherDoc = "Teacher Investigation Copy";
const queryParams = "/?appMode=qa&fakeClass=5&fakeOffering=5&problem=2.1&fakeUser=teacher:7&unit=msa";

context('Teacher Workspace', () => {

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

  describe('teacher specific navigation tabs', () => {
    it('verify problem tab solution switch', () => {
      // cy.get('.collapsed-resources-tab').click();
      cy.wait(500);
      cy.get('.top-tab.tab-problems').should('exist').click();
      cy.get('.prob-tab').contains('What If...?').click();
      cy.get('[data-test=solutions-button]').should('have.class', "toggled");
      cy.get('.has-teacher-tiles').should("exist");
      cy.get('[data-test=solutions-button]').click();
      cy.get('[data-test=solutions-button]').should('have.not.class', "toggled");
      cy.get('.has-teacher-tiles').should("not.exist");
    });

    it('verify teacher guide', () => {
      cy.get('.top-tab.tab-teacher-guide').should('exist').click({force:true});
      cy.get('.prob-tab.teacher-guide').should('exist').and('have.length', 4).each(function (subTab, index, subTabList) {
        const teacherGuideSubTabs = ["Overview", "Launch", "Explore", "Summarize"];
        cy.wrap(subTab).text().should('contain', teacherGuideSubTabs[index]);
      });
    });

    describe('verify playback', () => {
      it('verify playback is disabled if there is not history', function() {
        cy.openTopTab('my-work');
        cy.openDocumentThumbnail('workspaces', this.investigationTitle);
        cy.get('[data-testid="playback-component"]').should('have.class', 'disabled');
      });
      it('verify playback button enables when there is a history', () => {
        clueCanvas.addTile('drawing');
        cy.get('[data-testid="playback-component"]').should('not.have.class', 'disabled');
      });
      it('verify playback controls open', () => {
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
      after('cleanup', () => {
        clueCanvas.deleteTile('draw');
      });
    });
  });

  describe('teacher document functionality', function () {
    before(function () {
      clueCanvas.addTile('table');
      clueCanvas.addTile('drawing');
      canvas.copyDocument(teacherDoc);
      cy.wait(2000);
      cy.openTopTab("my-work");
      cy.openDocumentWithTitle('my-work', 'workspaces', teacherDoc);
      clueCanvas.addTile('table');
    });
    it('verify save and restore investigation', function () {
      cy.openSection("my-work", "workspaces");
      cy.wait(2000);
      tableToolTile.getTableTile().should('exist');
      drawToolTile.getDrawTile().should('exist');
    });
    it('verify save and restore extra workspace', function () {
      cy.openTopTab("my-work");
      cy.openSection("my-work", "workspaces");
      cy.getCanvasItemTitle("workspaces").contains(teacherDoc).should('exist');
      cy.openDocumentWithTitle("my-work", "workspaces", teacherDoc);
      cy.wait(2000);
      tableToolTile.getTableTile().should('exist');
      drawToolTile.getDrawTile().should('exist');
    });
    after(function () { //Clean up teacher document and copy
      canvas.deleteDocument();
      cy.openTopTab("my-work");
      cy.openSection('my-work', 'workspaces');
      clueCanvas.deleteTile('draw');
      clueCanvas.deleteTile('table');
    });
  });

  describe.skip('Student Workspace', () => { //flaky -- could be because it is trying to connect to firebase?
    it('verify student workspace tab', () => {
      cy.visit("/?appMode=demo&demoName=CLUE-Test&fakeClass=5&fakeOffering=5&problem=2.1&fakeUser=teacher:7&unit=msa");
      cy.waitForLoad();
      dashboard.switchView("Workspace & Resources");
      primaryWorkSpace.getResizeRightPanelHandle().click();
      cy.wait(2000);
      cy.get('@clueData').then((clueData) => {
        const groups = clueData.classes[0].problems[0].groups;
        cy.get('.top-tab.tab-student-work').should('exist').click({force:true});
        cy.get('.student-group-view').should('be.visible');
        cy.get('.student-group .group-number').should('be.visible').and('have.length', groups.length);
        cy.get('.student-group .group-number').eq(0).should('have.class', 'active');
        cy.get('.group-title').should('contain', 'Group 1');
        cy.get('.canvas-area .four-up .member').should('have.length', 4);
        cy.get('.canvas-area .four-up .member').eq(0).should('contain', 'S1');
        cy.get('.student-group .group-number').contains('G3').click();
        cy.get('.student-group .group-number').eq(2).should('have.class', 'active');
        cy.get('.group-title').should('contain', 'Group 3');
        cy.get('.canvas-area .four-up .member').eq(0).should('contain', 'S9');
      });
    });
  });

});
