import TeacherDashboard from "../../../../support/elements/clue/TeacherDashboard";
import ClueCanvas from "../../../../support/elements/clue/cCanvas";
import TableToolTile from "../../../../support/elements/clue/TableToolTile";
import DrawToolTile from "../../../../support/elements/clue/DrawToolTile";

/**
 * Notes:
 *
 * Teacher dashboard test needs static data from 'clueteachertest's class 'CLUE'
 * Here is the ID for the class in firebase: a1f7b8f8b7b1ad1d2d6240c41bd2354d8575ee09ae8bd641
 *
 * Currently issues with problem switcher/class switcher. Maybe split these into two tests. Have this test
 * log into portal with data that doesn't need to be static.
 *
 * -> This may also help with issue when verifying read-only student canvases which is currently looping through
 *    all of the students in the dashboard's current view
 */

context("Teacher Space", () => {

    let dashboard = new TeacherDashboard();
    let clueCanvas = new ClueCanvas;
    let tableToolTile = new TableToolTile;
    let drawToolTile = new DrawToolTile;

    let teacherDoc = "Teacher Investigation Copy";


    const offeringId = "40557";

    const clueTeacher = {
        username: "clueteachertest",
        password: "password"
    };
    // const clueStudent = {
    //     username: "ctesting1",
    //     password: "password",
    //     studentUid: "345979"
    // }

    before(function () {
        cy.login("https://learn.concord.org", clueTeacher);
        cy.launchReport('https://learn.concord.org/portal/offerings/' + offeringId + '/external_report/25');
        cy.waitForSpinner();
        dashboard.switchView("Workspace & Resources");
        cy.wait(4000);
        clueCanvas.getInvestigationCanvasTitle().text().as('investigationTitle');
    });

    beforeEach(() => {
        cy.fixture("teacher-dash-data.json").as("clueData");
    });

    context.skip('Teacher Workspace', function () {
        describe('teacher document functionality', function () {
            before(function () {
                clueCanvas.getSectionHeader('IN').click();
                clueCanvas.addTile('drawing');
                clueCanvas.addTile('table');
                cy.openResourcesTab();
                cy.openTopTab("my-work");
                cy.openSection('my-work', 'workspaces');
                cy.openDocumentWithTitle('my-work', 'workspaces', teacherDoc);
                clueCanvas.addTile('table');
            });
            it('verify restore after switching classes', function () {
                cy.get('@clueData').then((clueData) => {
                    const initClassIndex = 0;
                    const tempClassIndex = 1;
                    let initClass = clueData.classes[initClassIndex];
                    let tempClass = clueData.classes[tempClassIndex];
                    let className = tempClass.className;
                    let initClassName = initClass.className;

                    dashboard.getClassDropdown().click({ force: true }).then(() => {
                        dashboard.getClassList().contains(className).click({ force: true });
                        cy.waitForSpinner();
                    });
                    dashboard.getClassDropdown().should('contain', className);
                    dashboard.switchView('Workspace & Resources');
                    tableToolTile.getTableTile().should('not.exist');
                    drawToolTile.getDrawTile().should('not.exist');
                    //switch back to original problem for later test
                    dashboard.getClassDropdown().click({ force: true });
                    dashboard.getClassList().find('.list-item').contains(initClassName).click({ force: true });
                    cy.waitForSpinner();
                    dashboard.switchView('Workspace & Resources');
                    tableToolTile.getTableTile().should('exist');
                    drawToolTile.getDrawTile().should('exist');
                    cy.openResourcesTab();
                    cy.openTopTab("my-work");
                    cy.openSection('my-work', 'workspaces');
                    cy.getCanvasItemTitle("workspaces").contains(teacherDoc).should('exist');
                    cy.openDocumentWithTitle("my-work", "workspaces", teacherDoc);
                    cy.wait(2000);
                    tableToolTile.getTableTile().should('exist');
                });

            });
            it('verify restore after switching investigation', function () {
                cy.get('@clueData').then((clueData) => {
                    let problems = clueData.classes[0].problems;
                    let initProblemIndex = 0;
                    let tempProblemIndex = 1;

                    dashboard.getProblemDropdown().click({ force: true }).then(() => {
                        dashboard.getProblemList().should('have.class', 'show');
                        dashboard.getProblemList().find('.list-item').contains(problems[tempProblemIndex].problemTitle).click({ force: true });
                        cy.waitForSpinner();
                        tempProblemIndex += 1;
                    });
                    dashboard.getProblemDropdown().should('contain', problems[tempProblemIndex].problemTitle);
                    dashboard.switchView('Workspace & Resources');
                    clueCanvas.getInvestigationCanvasTitle().should('contain', problems[tempProblemIndex].problemTitle);
                    tableToolTile.getTableTile().should('not.exist');
                    drawToolTile.getDrawTile().should('not.exist');
                    //switch back to original problem to verify restore
                    dashboard.getProblemDropdown().click({ force: true });
                    dashboard.getProblemList().find('.list-item').contains(problems[initProblemIndex].problemTitle).click({ force: true });
                    cy.waitForSpinner();
                    dashboard.switchView('Workspace & Resources');
                    cy.openResourcesTab();
                    cy.openTopTab("my-work");
                    cy.openSection('my-work', 'workspaces');
                    clueCanvas.getInvestigationCanvasTitle().should('contain', problems[initProblemIndex].problemTitle);
                    tableToolTile.getTableTile().should('exist');
                    drawToolTile.getDrawTile().should('exist');
                    cy.openTopTab("my-work");
                    cy.openSection('my-work', 'workspaces');
                    cy.getCanvasItemTitle("workspaces").contains(teacherDoc).should('exist');
                    cy.openDocumentWithTitle("my-work", "workspaces", teacherDoc);
                    cy.wait(2000);
                    tableToolTile.getTableTile().should('exist');
                });
            });
            after(function () {
                clueCanvas.deleteTile('table');
                cy.openTopTab("my-work");
                cy.openSection('my-work', 'workspaces');
                cy.openDocumentWithTitle("my-work", "workspaces", this.investigationTitle[0]);
                clueCanvas.deleteTile('draw');
                clueCanvas.deleteTile('table');
            });
        });
    });
});
