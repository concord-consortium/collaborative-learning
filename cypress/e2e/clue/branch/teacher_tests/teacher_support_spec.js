import TeacherDashboard from "../../../../support/elements/clue/TeacherDashboard";
// import PrimaryWorkspace from "../../../../support/elements/common/PrimaryWorkspace";
import ClueCanvas from "../../../../support/elements/clue/cCanvas";
import ResourcesPanel from "../../../../support/elements/clue/ResourcesPanel";

let dashboard = new TeacherDashboard();

const queryParams = {
    teacherQueryParams: `${Cypress.config("teacherQueryParams")}`,
    studentQueryParams: `${Cypress.config("queryParams")}`
};

function beforeTest(params) {
    cy.clearQAData('all');
    cy.visit(params);
    cy.waitForLoad();
    dashboard.switchView("Workspace & Resources");
    cy.wait(4000);
}
  
function loadStudentSession(params) {
    cy.visit(params);
    cy.waitForLoad();
}

context('Teacher Support', function() {
    // let primaryWorkspace = new PrimaryWorkspace();
    let resourcesPanel = new ResourcesPanel();
    let clueCanvas = new ClueCanvas;

    const title = "Drawing Wumps";

    describe('verify supports functionality', function() {
        it('test support functionality', function(){
            cy.log('will verify publish of support appears in Class Work>Workspaces');
            beforeTest(queryParams.teacherQueryParams);
            clueCanvas.addTile('table');
            clueCanvas.publishDoc("This Class");
            cy.openTopTab("class-work");
            cy.openSection('class-work', 'workspaces');
            resourcesPanel.getCanvasItemTitle('class-work', 'workspaces').should('contain', title);
        
            cy.log('verify teacher support is visible in student nav');
            loadStudentSession(queryParams.studentQueryParams);
            cy.openTopTab("class-work");
            cy.openSection('class-work', 'workspaces');
            cy.getCanvasItemTitle('workspaces', title).should('be.visible');
        });
    });

});
