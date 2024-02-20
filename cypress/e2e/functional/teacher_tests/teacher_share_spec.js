import TeacherDashboard from "../../../support/elements/common/TeacherDashboard";
import ClueCanvas from "../../../support/elements/common/cCanvas";

let dashboard = new TeacherDashboard();
let clueCanvas = new ClueCanvas();

const teacherQueryParams = `${Cypress.config("qaUnitTeacher6")}`;

function beforeTest(params) {
    cy.clearQAData('all');
    cy.visit(params);
    cy.waitForLoad();
    dashboard.switchView("Workspace & Resources");
    cy.wait(2000);
}

context('Teacher Share', function() {
    describe('verify share functionality', function() {
        it('test share functionality',function(){
            cy.log('will share and unshare a teacher document');
            beforeTest(teacherQueryParams);
            clueCanvas.getShareButton().should('be.visible');
            clueCanvas.getShareButton().should('have.class', 'private');
            clueCanvas.shareCanvas();
            clueCanvas.getShareButton().should('be.visible');
            clueCanvas.getShareButton().should('have.class', 'public');
            clueCanvas.unshareCanvas();
            clueCanvas.getShareButton().should('be.visible');
            clueCanvas.getShareButton().should('have.class', 'private');
        });
    });
});
