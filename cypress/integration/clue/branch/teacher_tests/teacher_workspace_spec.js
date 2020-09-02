import TeacherDashboard from "../../../../support/elements/clue/TeacherDashboard";
import RightNav from "../../../../support/elements/common/RightNav";
import ClueCanvas from "../../../../support/elements/clue/cCanvas";
import Canvas from "../../../../support/elements/common/Canvas";
import TableToolTile from "../../../../support/elements/clue/TableToolTile";
import DrawToolTile from "../../../../support/elements/clue/DrawToolTile";

    let dashboard = new TeacherDashboard();
    let rightNav = new RightNav();
    let clueCanvas = new ClueCanvas;
    let canvas = new Canvas;
    let tableToolTile = new TableToolTile;
    let drawToolTile = new DrawToolTile;

    let teacherDoc = "Teacher Investigation Copy";

    const baseUrl = `${Cypress.config("baseUrl")}`;
    const queryParams = `${Cypress.config("teacherQueryParams")}`;

before(function() {
    cy.clearQAData('all');

    cy.visit(baseUrl+queryParams);
    cy.waitForSpinner();
    dashboard.switchView("Workspace");
    cy.wait(2000);
    clueCanvas.getInvestigationCanvasTitle().text().as('investigationTitle');               
});

describe('UI visibility', () => {
    it('verify right nav elements', function() {
         //Supports will be labeled with <Investigation#>.<Prob#> <Section Name> Support <n>
        rightNav.getRightNavTab("student-work").should('be.visible');
        rightNav.getRightNavTab("my-work").should('be.visible');
        rightNav.getRightNavTab("class-work").should('be.visible');
        rightNav.getRightNavTab("learning-log").should('be.visible');
        rightNav.getRightNavTab("supports").should('be.visible');
        });    
});
describe('teacher document functionality',function(){
     before(function(){
        clueCanvas.addTile('table');
        clueCanvas.addTile('drawing');
        canvas.copyDocument(teacherDoc);
        rightNav.openRightNavTab("my-work");
        rightNav.openSection('my-work','workspaces');
        rightNav.openCanvasItem('my-work','workspaces',teacherDoc);
        clueCanvas.addTile('table');
    });
    it('verify save and restore investigation',function(){
        rightNav.openRightNavTab("my-work");
        rightNav.openSection("my-work","investigations");
        rightNav.getCanvasItemTitle("my-work","investigations",this.investigationTitle).should('exist');
        rightNav.openCanvasItem("my-work","investigations",this.investigationTitle);
        cy.wait(2000);
        tableToolTile.getTableTile().should('exist');
        drawToolTile.getDrawTile().should('exist');
    });
    it('verify save and restore extra workspace',function(){
        rightNav.openRightNavTab("my-work");
        rightNav.openSection("my-work","workspaces");
        rightNav.getCanvasItemTitle("my-work","workspaces",teacherDoc).should('exist');
        rightNav.openCanvasItem("my-work","workspaces",teacherDoc);
        cy.wait(2000);
        tableToolTile.getTableTile().should('exist');
        drawToolTile.getDrawTile().should('exist');
    });
});
after(function(){
    rightNav.openRightNavTab("my-work");
    rightNav.openSection('my-work','investigations');
    rightNav.openCanvasItem("my-work","investigations",this.investigationTitle);
    clueCanvas.deleteTile('table');
    clueCanvas.deleteTile('draw');
    cy.deleteWorkspaces(baseUrl,queryParams);
    cy.clearQAData('all');
});

