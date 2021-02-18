import TeacherDashboard from "../../../../support/elements/clue/TeacherDashboard";
import ClueCanvas from "../../../../support/elements/clue/cCanvas";
import Canvas from "../../../../support/elements/common/Canvas";
import TableToolTile from "../../../../support/elements/clue/TableToolTile";
import DrawToolTile from "../../../../support/elements/clue/DrawToolTile";

    let dashboard = new TeacherDashboard();
    let clueCanvas = new ClueCanvas;
    let canvas = new Canvas;
    let tableToolTile = new TableToolTile;
    let drawToolTile = new DrawToolTile;

    let teacherDoc = "Teacher Investigation Copy";
    const queryParams = `${Cypress.config("teacherQueryParams")}`;

before(function() {
  cy.fixture("teacher-dash-data-CLUE-test.json").as("clueData");

  cy.visit(queryParams+`&unit=msa`);
  cy.waitForSpinner();
  dashboard.switchView("Workspace");
  cy.wait(2000);
  clueCanvas.getInvestigationCanvasTitle().text().as('investigationTitle');
});

describe('teacher specific navigation tabs', function() {
    it('verify problem tab solution switch', function() {
      cy.get('.nav-tab.tab-problems').should('exist').click();
      cy.get('.prob-tab').contains('What If...?').click();
      cy.get('[data-test=solutions-button]').should('have.class',"toggled");
      cy.get('.has-teacher-tiles').should("exist");
      cy.get('[data-test=solutions-button]').click();
      cy.get('[data-test=solutions-button]').should('have.not.class',"toggled");
      cy.get('.has-teacher-tiles').should("not.exist");

      cy.get('.close-button').click();
    });
    it('verify teacher guide', function() {
      cy.get('.nav-tab.tab-teacher-guide').should('exist').click();
      cy.get('.prob-tab.teacher-guide').should('exist').and('have.length', 4).each(function(subTab, index, subTabList) {
        const teacherGuideSubTabs = ["Overview", "Launch", "Explore", "Summerize"];
        cy.wrap(subTab).text().should('contain',teacherGuideSubTabs[index]);
      });

      cy.get('.close-button').click();
    });
    it('verify student workspace tab', function() {
      cy.get('.nav-tab.tab-student-work').should('exist').click();

    });
});


describe.skip('teacher document functionality',function(){
     before(function(){
        clueCanvas.addTile('table');
        clueCanvas.addTile('drawing');
        canvas.copyDocument(teacherDoc);
        cy.wait(2000);
        cy.openTab("my-work");
        cy.openDocumentWithTitle('my-work','workspaces',teacherDoc);
        clueCanvas.addTile('table');
    });
    it('verify save and restore investigation',function(){
        cy.openSection("my-work","workspaces");
        cy.getCanvasItemTitle("workspaces").contains(this.investigationTitle[0]).should('exist');
        cy.openDocumentWithTitle("my-work","workspaces",this.investigationTitle[0]);
        cy.wait(2000);
        tableToolTile.getTableTile().should('exist');
        drawToolTile.getDrawTile().should('exist');
    });
    it('verify save and restore extra workspace',function(){
        cy.openTopTab("my-work");
        cy.openSection("my-work","workspaces");
        cy.getCanvasItemTitle("workspaces").contains(teacherDoc).should('exist');
        cy.openDocumentWithTitle("my-work","workspaces",teacherDoc);
        cy.wait(2000);
        tableToolTile.getTableTile().should('exist');
        drawToolTile.getDrawTile().should('exist');
    });
});

