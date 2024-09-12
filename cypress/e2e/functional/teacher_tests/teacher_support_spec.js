import TeacherDashboard from "../../../support/elements/common/TeacherDashboard";
import ClueCanvas from "../../../support/elements/common/cCanvas";
import ResourcesPanel from "../../../support/elements/common/ResourcesPanel";

let dashboard = new TeacherDashboard();

const teacherQueryParams = `${Cypress.config("qaUnitTeacher6")}`;
const studentQueryParams = `${Cypress.config("qaUnitStudent5")}`;

function beforeTest(params) {
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

    const title = "Solving a Mystery with Proportional Reasoning";

    describe('verify supports functionality', function() {
        it('test support functionality',function(){
            cy.log('will verify publish of support appears in Class Work>Workspaces');
            beforeTest(teacherQueryParams);
            clueCanvas.addTile('table');
            clueCanvas.publishDoc("This Class");
            cy.openTopTab("class-work");
            cy.openSection('class-work','workspaces');
            resourcesPanel.getCanvasItemTitle('class-work','workspaces').should('contain',title);

            cy.log('verify teacher support is visible in student nav');
            loadStudentSession(studentQueryParams);
            cy.openTopTab("class-work");
            cy.openSection('class-work', 'workspaces');
            cy.getCanvasItemTitle('workspaces', title).should('be.visible');
        });
    });

});
