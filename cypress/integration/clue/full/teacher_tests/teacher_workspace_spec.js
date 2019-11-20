import TeacherDashboard from "../../../../support/elements/clue/TeacherDashboard";
import RightNav from "../../../../support/elements/common/RightNav";
import ClueCanvas from "../../../../support/elements/clue/cCanvas";
import Canvas from "../../../../support/elements/common/Canvas";
import TextToolTile from "../../../../support/elements/clue/TextToolTile";
import GraphToolTile from "../../../../support/elements/clue/GraphToolTile";
import TableToolTile from "../../../../support/elements/clue/TableToolTile";


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
    let rightNav = new RightNav();
    let clueCanvas = new ClueCanvas;
    let canvas = new Canvas;
    let textToolTile = new TextToolTile;
    let graphToolTile = new GraphToolTile;
    let tableToolTile = new TableToolTile;

    let teacherWorkspace = 'My Teacher Test Workspace';
    let teacherDoc = "Teacher Investigation Copy"
    const testSupportLabel = '1.2 Now What Do You Know? Support 2'


    const clueTeacher = {
        username: "clueteachertest",
        password: "password"
    }

    before(function() {
        cy.login("https://learn.concord.org", clueTeacher)
        // insert offering number for your activity below
        cy.visit('https://learn.concord.org/portal/offerings/40557/external_report/25')
        cy.waitForSpinner();
    })

    beforeEach(() => {
        cy.fixture("teacher-dash-data.json").as("clueData")
    })

    context('Teacher Workspace', () => {
        before(function(){
            dashboard.switchView("Workspace")
            cy.wait(2000)
            clueCanvas.getInvestigationCanvasTitle().text().as('investigationTitle')               
        })
        describe('UI visibility', () => {
            it('verify right nav elements', () => {
                //Supports will be labeled with <Investigation#>.<Prob#> <Section Name> Support <n>
                rightNav.getRightNavTab("student-work").should('be.visible')
                rightNav.getRightNavTab("my-work").should('be.visible')
                rightNav.getRightNavTab("class-work").should('be.visible')
                rightNav.getRightNavTab("learning-log").should('be.visible')
                rightNav.getRightNavTab("supports").should('be.visible')
            })    
        })
        describe('teacher document functionality',function(){
            before(function(){
                clueCanvas.addTile('geometry');
                clueCanvas.addTile('table');
                textToolTile.addText('this is ' + teacherWorkspace);
                rightNav.openRightNavTab("my-work");
                rightNav.openSection('my-work','workspaces')
                rightNav.openCanvasItem('my-work','workspaces',teacherDoc)
                clueCanvas.addTile('text')
                textToolTile.addText('this is a my workspace');
            })
            it('verify save and restore investigation',function(){
                rightNav.openRightNavTab("my-work");
                rightNav.openSection("my-work","investigations");
                rightNav.getCanvasItemTitle("my-work","investigations",this.investigationTitle).should('exist');
                rightNav.openCanvasItem("my-work","investigations",this.investigationTitle);
                cy.wait(2000);
                graphToolTile.getGraphTile().should('exist')
                tableToolTile.getTableTile().should('exist')
                textToolTile.getTextTile().should('exist').and('contain','this is ' + teacherWorkspace)
            })
            it('verify save and restore extra workspace',function(){
                rightNav.openRightNavTab("my-work");
                rightNav.getCanvasItemTitle("my-work","workspaces",teacherDoc).should('exist');
                rightNav.openCanvasItem("my-work","workspaces",teacherDoc);
                cy.wait(2000);
                textToolTile.getTextTile().should('exist').and('contain','this is a my workspace')
            })
            it('verify restore after switching classes', function(){
                cy.get('@clueData').then((clueData) => {
                    const initClassIndex = 0
                    const tempClassIndex = 1
                    let initClass = clueData.classes[initClassIndex]
                    let tempClass = clueData.classes[tempClassIndex]
                    let className = tempClass.className
                    let initClassName = initClass.className

                    dashboard.getClassDropdown().click({ force: true }).then(() => {
                        dashboard.getClassList().contains(className).click({ force: true })
                        cy.waitForSpinner()
                    })
                    dashboard.getClassDropdown().should('contain', className)
                    dashboard.switchView('Workspace')
                    graphToolTile.getGraphTile().should('not.exist')
                    tableToolTile.getTableTile().should('not.exist')
                    textToolTile.getTextTile().should('not.exist')
                    //switch back to original problem for later test
                    dashboard.getClassDropdown().click({force:true})
                    dashboard.getClassList().find('.Menuitem').contains(initClassName).click({ force: true })
                    cy.waitForSpinner()
                    dashboard.switchView('Workspace')
                    graphToolTile.getGraphTile().should('exist')
                    tableToolTile.getTableTile().should('exist')
                    textToolTile.getTextTile().should('exist').and('contain','this is ' + teacherWorkspace)
                    rightNav.openRightNavTab("my-work");
                    rightNav.openSection('my-work', 'workspaces')
                    rightNav.getCanvasItemTitle("my-work","workspaces",teacherDoc).should('exist');
                    rightNav.openCanvasItem("my-work","workspaces",teacherDoc);
                    cy.wait(2000);
                    textToolTile.getTextTile().should('exist').and('contain','this is a my workspace') 
                })

            })
            it('verify restore after switching investigation',function(){
                cy.get('@clueData').then((clueData) => {
                    let problems = clueData.classes[0].problems
                    let initProblemIndex = 0
                    let tempProblemIndex = 1
    
                    dashboard.getProblemDropdown().click({ force: true }).then(() => {
                        dashboard.getProblemList().should('have.attr','open')
                        dashboard.getProblemList().find('.Menuitem').contains(problems[tempProblemIndex].problemTitle).click({ force: true })
                        cy.waitForSpinner()
                        tempProblemIndex += 1
                    })
                    dashboard.getProblemDropdown().should('contain', problems[tempProblemIndex].problemTitle)
                    dashboard.switchView('Workspace')
                    clueCanvas.getInvestigationCanvasTitle().should('contain',problems[tempProblemIndex].problemTitle)
                    graphToolTile.getGraphTile().should('not.exist')
                    tableToolTile.getTableTile().should('not.exist')
                    textToolTile.getTextTile().should('not.exist')
                    //switch back to original problem to verify restore
                    dashboard.getProblemDropdown().click({force:true})
                    dashboard.getProblemList().find('.Menuitem').contains(problems[initProblemIndex].problemTitle).click({ force: true })
                    cy.waitForSpinner()
                    dashboard.switchView('Workspace')
                    clueCanvas.getInvestigationCanvasTitle().should('contain',problems[initProblemIndex].problemTitle)
                    graphToolTile.getGraphTile().should('exist')
                    tableToolTile.getTableTile().should('exist')
                    textToolTile.getTextTile().should('exist').and('contain','this is ' + teacherWorkspace)
                    rightNav.openRightNavTab("my-work");
                    rightNav.openSection('my-work', 'workspaces')
                    rightNav.getCanvasItemTitle("my-work","workspaces",teacherDoc).should('exist');
                    rightNav.openCanvasItem("my-work","workspaces",teacherDoc);
                    cy.wait(2000);
                    textToolTile.getTextTile().should('exist').and('contain','this is a my workspace')
                })
            })
            after(function(){
                clueCanvas.deleteTile('text')
                rightNav.openRightNavTab("my-work");
                rightNav.openSection('my-work','investigations')
                rightNav.openCanvasItem("my-work","investigations",this.investigationTitle);
                clueCanvas.deleteTile('geometry');
                clueCanvas.deleteTile('table');
                clueCanvas.deleteTile('text');
            })
        })
        describe('teacher only functionalities', () => {

            it('verify document curation', () => {//adding a star to a student document
            
            })
            it('verify supports functionality', () => {//may need to break down even further between class, group, and student

            })
        })
        describe.skip('teacher functionality', () => {
            /**
             * Smoke test includes logging into LARA for verifying class + problem switching
             * Verify how teacher workspace behaves when switching classes + problems
             * Test the supports tab since the other tabs are testing in the student tests
             */
        })
    })

    context.skip("Teacher Supports in student's view", () => {
        describe("test visibility of teacher supports in student's workspace", () => {
            it('verify support thumbnails are visible', () => {
            })
            it('verify supports open in 2up view righthand workspace', () => {
            })
        })
    })
})

