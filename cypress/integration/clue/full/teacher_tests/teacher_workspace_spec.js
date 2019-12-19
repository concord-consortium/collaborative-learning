import TeacherDashboard from "../../../../support/elements/clue/TeacherDashboard";
import RightNav from "../../../../support/elements/common/RightNav";
import ClueCanvas from "../../../../support/elements/clue/cCanvas";
import Canvas from "../../../../support/elements/common/Canvas";
import TableToolTile from "../../../../support/elements/clue/TableToolTile";
import DrawToolTile from "../../../../support/elements/clue/DrawToolTile";
import ClueRightNav from "../../../../support/elements/clue/cRightNav";

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

context.skip("Teacher Space", () => {

    let dashboard = new TeacherDashboard();
    let rightNav = new RightNav();
    let clueCanvas = new ClueCanvas;
    let canvas = new Canvas;
    let tableToolTile = new TableToolTile;
    let drawToolTile = new DrawToolTile;
    let clueRightNav = new ClueRightNav;

    let teacherWorkspace = 'My Teacher Test Workspace';
    let teacherDoc = "Teacher Investigation Copy"
    const testSupportLabel = '1.2 Now What Do You Know? Support 2'
    const offeringId = "40557"

    const clueTeacher = {
        username: "clueteachertest",
        password: "password"
    }

    before(function() {
        cy.login("https://learn.concord.org", clueTeacher)
        cy.visit('https://learn.concord.org/portal/offerings/'+offeringId+'/external_report/25')
        cy.waitForSpinner();
        dashboard.switchView("Workspace")
        cy.wait(2000)
        clueCanvas.getInvestigationCanvasTitle().text().as('investigationTitle')               
    })

    beforeEach(() => {
        cy.fixture("teacher-dash-data.json").as("clueData")
    })

    context('Teacher Workspace', function() {
        // before(function(){
        //     dashboard.switchView("Workspace")
        //     cy.wait(2000)
        //     clueCanvas.getInvestigationCanvasTitle().text().as('investigationTitle')               
        // })
        describe('UI visibility', () => {
            it('verify right nav elements', function() {
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
                clueCanvas.addTile('table');
                clueCanvas.addTile('drawing');
                // textToolTile.addText('this is ' + teacherWorkspace);
                rightNav.openRightNavTab("my-work");
                rightNav.openSection('my-work','workspaces')
                rightNav.openCanvasItem('my-work','workspaces',teacherDoc)
                clueCanvas.addTile('table')
                // textToolTile.addText('this is a my workspace');
            })
            it('verify save and restore investigation',function(){
                rightNav.openRightNavTab("my-work");
                rightNav.openSection("my-work","investigations");
                rightNav.getCanvasItemTitle("my-work","investigations",this.investigationTitle).should('exist');
                rightNav.openCanvasItem("my-work","investigations",this.investigationTitle);
                cy.wait(2000);
                tableToolTile.getTableTile().should('exist')
                drawToolTile.getDrawTile().should('exist')
            })
            it('verify save and restore extra workspace',function(){
                rightNav.openRightNavTab("my-work");
                rightNav.getCanvasItemTitle("my-work","workspaces",teacherDoc).should('exist');
                rightNav.openCanvasItem("my-work","workspaces",teacherDoc);
                cy.wait(2000);
                tableToolTile.getTableTile().should('exist')
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
                    tableToolTile.getTableTile().should('not.exist')
                    drawToolTile.getDrawTile().should('not.exist')
                    //switch back to original problem for later test
                    dashboard.getClassDropdown().click({force:true})
                    dashboard.getClassList().find('.Menuitem').contains(initClassName).click({ force: true })
                    cy.waitForSpinner()
                    dashboard.switchView('Workspace')
                    tableToolTile.getTableTile().should('exist')
                    drawToolTile.getDrawTile().should('exist')
                    rightNav.openRightNavTab("my-work");
                    rightNav.openSection('my-work', 'workspaces')
                    rightNav.getCanvasItemTitle("my-work","workspaces",teacherDoc).should('exist');
                    rightNav.openCanvasItem("my-work","workspaces",teacherDoc);
                    cy.wait(2000);
                    tableToolTile.getTableTile().should('exist')
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
                    tableToolTile.getTableTile().should('not.exist')
                    drawToolTile.getDrawTile().should('not.exist')
                    //switch back to original problem to verify restore
                    dashboard.getProblemDropdown().click({force:true})
                    dashboard.getProblemList().find('.Menuitem').contains(problems[initProblemIndex].problemTitle).click({ force: true })
                    cy.waitForSpinner()
                    dashboard.switchView('Workspace')
                    clueCanvas.getInvestigationCanvasTitle().should('contain',problems[initProblemIndex].problemTitle)
                    tableToolTile.getTableTile().should('exist')
                    drawToolTile.getDrawTile().should('exist')
                    rightNav.openRightNavTab("my-work");
                    rightNav.openSection('my-work', 'workspaces')
                    rightNav.getCanvasItemTitle("my-work","workspaces",teacherDoc).should('exist');
                    rightNav.openCanvasItem("my-work","workspaces",teacherDoc);
                    cy.wait(2000);
                    tableToolTile.getTableTile().should('exist')
                })
            })
            after(function(){
                clueCanvas.deleteTile('table')
                rightNav.openRightNavTab("my-work");
                rightNav.openSection('my-work','investigations')
                rightNav.openCanvasItem("my-work","investigations",this.investigationTitle);
                clueCanvas.deleteTile('table');
                clueCanvas.deleteTile('drawing');
            })
        })
        describe('teacher only functionalities', function() {
            describe('verify document curation', function() {//adding a star to a student document
                let studentDoc = "clue testing5: 1.1 Solving a Mystery"

                it('verify starring a student published investigation',function(){
                    rightNav.openRightNavTab('class-work')
                    rightNav.openSection('class-work','published')
                    rightNav.starCanvasItem('class-work','published',studentDoc)
                    rightNav.getCanvasStarIcon('class-work','published',studentDoc).should('have.class','starred')
                    //make sure only one canvas is starred, 
                    // but length 2 because there is one in published section and one in Starred section
                    cy.get('.icon-star.starred').should('have.length',2)

                })
                it('verify starred document appears in Starred section in right nav',function(){
                    rightNav.closeSection('class-work','published')
                    rightNav.openSection('class-work','starred')
                    cy.wait(1000)
                    rightNav.getCanvasItemTitle('class-work','starred',studentDoc)
                })
                it('verify starred document has a star in the dashboard', function(){
                    dashboard.switchView('Dashboard');
                    dashboard.switchWorkView('Published');
                    dashboard.getGroup(1).find('.four-up-overlay .icon-star').should('have.class', 'starred')
                })
                it('verify unstar in dashboard unstars in workspace', function(){
                    dashboard.clearAllStarsFromPublishedWork()
                    cy.wait(1000)
                    dashboard.switchView('Workspace')
                    rightNav.openRightNavTab('class-work')
                    rightNav.openSection('class-work','starred')
                    rightNav.getCanvasItemTitle('class-work', 'starred', studentDoc).should('not.exist')
                    rightNav.openSection('class-work','published')
                    rightNav.getCanvasStarIcon('class-work','published',studentDoc).should('not.have.class','starred')
                })
            })

            describe('verify supports functionality', function() {//may need to break down even further between class, group, and student
                before(function(){
                    dashboard.switchView("Workspace")
                    cy.wait(2000)
                })
                it('will verify publish of support appears in Support>Teacher Workspace',function(){
                    let title = ((this.investigationTitle).split('1.1')[1]).trim()
                    clueCanvas.addTile('table');
                    clueCanvas.publishSupportDoc();
                    rightNav.openRightNavTab('supports');
                    rightNav.openSection('supports','teacher-supports');
                    rightNav.getCanvasItemTitle('supports','teacher-supports').should('contain',title)
                })
            })
        })
    })

    context("Teacher Supports in student's view", function() { //going to student page is not working
        const clueStudent = {
            username: "ctesting1",
            password: "password",
            studentUid: "345979"
        }
        let title = "Solving a Mystery"

        // let title = ((this.investigationTitle).split('1.1 ')[1]).trim();

        // before(function(){
        //     cy.login("https://learn.concord.org", clueStudent)
        //     cy.visit("https://learn.concord.org/users/" + clueStuden.studentUid + "/portal/offerings/"+offeringId+".run_resource_html")
        //     cy.waitForSpinner();
        // })
        describe("test visibility of teacher supports in student's workspace", function() {
            // let title = ((this.investigationTitle).split('1.1')[1]).trim()
            it('verify badge on Support Tab',function(){
                cy.login("https://learn.concord.org", clueStudent)
                cy.visit("https://learn.concord.org/users/" + clueStudent.studentUid + "/portal/offerings/"+offeringId+".run_resource_html")
                cy.waitForSpinner();
                clueRightNav.getSupportBadge().should('be.visible')
            })
            it('verify teacher support isvisible in student rightnav', function() {
                rightNav.openRightNavTab('supports');
                rightNav.openSection('supports', 'teacher-supports');
                rightNav.getCanvasItemTitle('supports', 'teacher-supports', title).should('be.visible')
            })
            it('verify supports open in 2up view righthand workspace', () => {
                rightNav.openCanvasItem('supports', 'teacher-supports', title);
                clueCanvas.getRightSideInvestigationTitle().should('contain',title)
            })
        })

        after(function(){
            cy.login("https://learn.concord.org", clueTeacher)
            cy.visit('https://learn.concord.org/portal/offerings/'+offeringId+'/external_report/25')
            cy.waitForSpinner();
    
            dashboard.switchView('Workspace');
            clueCanvas.deleteTile('table');
            rightNav.openRightNavTab('supports');
            rightNav.openSection('supports','teacher-supports');
            // clueRightNav.deleteTeacherSupport('supports','teacher-supports',title)
        })
    })
})

