import TeacherDashboard from "../../../../support/elements/clue/TeacherDashboard";
// import PrimaryWorkspace from "../../../../support/elements/common/PrimaryWorkspace";
import ClueCanvas from "../../../../support/elements/clue/cCanvas";
import ResourcesPanel from "../../../../support/elements/clue/ResourcesPanel";

    let dashboard = new TeacherDashboard();
    // let primaryWorkspace = new PrimaryWorkspace();
    let resourcesPanel = new ResourcesPanel();
    let clueCanvas = new ClueCanvas;

    const title = "Drawing Wumps";

    before(function() {
        const queryParams = `${Cypress.config("teacherQueryParams")}`;
        cy.clearQAData('all');

        cy.visit(queryParams);
        cy.waitForLoad();
        dashboard.switchView("Workspace & Resources");
        cy.wait(2000);
    });

    describe('verify supports functionality', function() {
        it('will verify publish of support appears in Class Work>Workspaces',function(){
            clueCanvas.addTile('table');
            clueCanvas.publishTeacherDoc();
            cy.get(".collapsed-resources-tab.my-work").click();
            cy.openTopTab("class-work");
            cy.openSection('class-work','workspaces');
            resourcesPanel.getCanvasItemTitle('class-work','workspaces').should('contain',title);
        });
    });

    describe("test visibility of teacher supports in student's workspace", function() {
            it('verify teacher support is visible in student nav', function() {
              const queryParams = `${Cypress.config("queryParams")}`;

              cy.visit(queryParams);
              cy.waitForLoad();
              cy.openResourceTabs();
              cy.openTopTab("class-work");
              cy.openSection('class-work', 'workspaces');
              cy.getCanvasItemTitle('workspaces', title).should('be.visible');
            });
    });

after(function(){
        const queryParams = `${Cypress.config("teacherQueryParams")}`;

        cy.visit(queryParams);
        cy.waitForLoad();
        cy.clearQAData('all');
});
