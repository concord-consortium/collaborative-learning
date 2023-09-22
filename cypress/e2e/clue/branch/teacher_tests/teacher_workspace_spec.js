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

const queryParams = {
  teacherQueryParams: "/?appMode=qa&fakeClass=5&fakeOffering=5&problem=2.1&fakeUser=teacher:7&unit=msa",
  studentWorkspaceQueryParams: "/?appMode=demo&demoName=CLUE-Test&fakeClass=5&fakeOffering=5&problem=2.1&fakeUser=teacher:7&unit=msa"
};

function beforeTest(params) {
  cy.clearQAData('all');
  cy.visit(params);
  cy.waitForLoad();
  dashboard.switchView("Workspace & Resources");
  cy.wait(2000);
  clueCanvas.getInvestigationCanvasTitle().text().as('investigationTitle');
}

function beforeAdd() {
  clueCanvas.addTile('table');
  clueCanvas.addTile('drawing');
  canvas.copyDocument(teacherDoc);
  cy.wait(2000);
  cy.openTopTab("my-work");
  cy.openDocumentWithTitle('my-work', 'workspaces', teacherDoc);
  clueCanvas.addTile('table');
}

function afterDelete() { //Clean up teacher document and copy
  canvas.deleteDocument();
  cy.openTopTab("my-work");
  cy.openSection('my-work', 'workspaces');
  clueCanvas.deleteTile('draw');
  clueCanvas.deleteTile('table');
}

function loadStudentWorkspace(params) {
  cy.visit(params);
  cy.waitForLoad();
}

context('Teacher Workspace', () => {
  describe('teacher document functionality', function () {
    
    it('verify teacher workspace tab', function () {
      cy.log('verify save and restore');
      beforeTest(queryParams.teacherQueryParams);
      beforeAdd();

      cy.log('verify save and restore investigation');
      cy.openSection("my-work", "workspaces");
      cy.wait(2000);
      tableToolTile.getTableTile().should('exist');
      drawToolTile.getDrawTile().should('exist');

      cy.log('verify save and restore extra workspace');
      cy.openTopTab("my-work");
      cy.openSection("my-work", "workspaces");
      cy.getCanvasItemTitle("workspaces").contains(teacherDoc).should('exist');
      cy.openDocumentWithTitle("my-work", "workspaces", teacherDoc);
      cy.wait(2000);
      tableToolTile.getTableTile().should('exist');
      drawToolTile.getDrawTile().should('exist');

      afterDelete();
  // });

    
  // });

  // TODO: The placement of this context in the order matters because for some reason the
  // Teacher Guide tab doesn't appear until after the test user clicks on the My Work tab
  // in the above context (although it does appear immediately for real-world teachers).
  // See the TODO comment above addDisposer in src/models/stores/stores.ts. After that is
  // addressed, this context should be moved so it's first in the order.
  // describe('teacher specific navigation tabs', () => {
      cy.log('verify problem tab solution switch');
      // cy.get('.resources-expander').click();
      cy.wait(500);
      cy.get('.top-tab.tab-problems').should('exist').click();
      cy.get('.prob-tab').contains('Initial Challenge').click();
      cy.get('[data-test=solutions-button]').should('have.class', "toggled");
      cy.get('.has-teacher-tiles').should("exist");
      cy.get('.prob-tab').contains('What If...?').click();
      cy.get('[data-test=solutions-button]').should('have.class', "toggled");
      cy.get('.has-teacher-tiles').should("exist");
      cy.get('[data-test=solutions-button]').click();
      cy.get('[data-test=solutions-button]').should('have.not.class', "toggled");
      cy.get('.has-teacher-tiles').should("not.exist");

      cy.log('verify teacher guide');
      //There is race condition that sometimes doesn't load the teacher guide
      //So we close the Resources panel, and re-open to force it to rerender
      cy.collapseResourceTabs();
      cy.openResourceTabs();
      cy.get('.top-tab.tab-teacher-guide').should('exist').click({ force:true });
      cy.get('.prob-tab.teacher-guide').should('exist').and('have.length', 4).each(function (subTab, index, subTabList) {
        const teacherGuideSubTabs = ["Launch", "Explore", "Summarize", "Unit Plan"];
        cy.wrap(subTab).text().should('contain', teacherGuideSubTabs[index]);
      });
    });
  });

  describe('Student Workspace', () => { //flaky -- could be because it is trying to connect to firebase?
    it('verify student workspace tab', () => {
      loadStudentWorkspace(queryParams.studentWorkspaceQueryParams);
      cy.fixture("teacher-dash-data-msa-test.json").as("clueData");
      dashboard.switchView("Workspace & Resources");
      primaryWorkSpace.getResizePanelDivider().click();
      cy.wait(2000);
      cy.get('@clueData').then((clueData) => {
        const groups = clueData.classes[0].problems[0].groups;
        cy.get('.top-tab.tab-student-work').should('exist').click({ force:true });
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
