import TeacherDashboard from "../../../../support/elements/clue/TeacherDashboard";
import RightNav from "../../../../support/elements/common/RightNav";

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

    const clueTeacher = {
        username: "clueteachertest",
        password: "password"
    }

    before(() => {
        cy.login("https://learn.concord.org", clueTeacher)
        // insert offering number for your activity below
        cy.visit('https://learn.concord.org/portal/offerings/40557/external_report/25')
        cy.wait(1000)
        cy.waitForSpinner()
        cy.reload()
        cy.wait(1000)
        cy.waitForSpinner()
    })

    beforeEach(() => {
        cy.fixture("teacher-dash-data.json").as("clueData")
    })

    context('Teacher Dashboard View', () => {
        describe('UI visibility', () => {
            it('verify header elements', () => {
                cy.get('@clueData').then((clueData) => {
                    let tempClass = clueData.classes[0]

                    // Check Investigation Name visibility
                    dashboard.getInvestigationTitle().should('be.visible').and('contain', clueData.investigationTitle)
                    // Check problem list  UI and visibility
                    dashboard.getProblemList().should('not.exist')
                    dashboard.getProblemDropdown().should('be.visible').click({ force: true })
                    dashboard.getProblemList().should('exist').and('have.length', tempClass.problemTotal)
                    dashboard.getProblemDropdown().click({ force: true })
                    dashboard.getProblemList().should('not.exist')
                    // Check class list UI and visibility
                    dashboard.getClassList().should('not.exist')
                    dashboard.getClassDropdown().should('be.visible').click({ force: true })
                    dashboard.getClassList().should('exist').and('have.length', clueData.classes.length) // FIX THIS - currently shows all classes including inactive classes. Should only show active classes. Story in PT.
                    dashboard.getClassDropdown().click({ force: true })
                    dashboard.getClassList().children().should('not.exist')
                    // Check Dashboard and Workspace toggle default
                    dashboard.getViewToggle('Dashboard').should('be.visible')
                    dashboard.getViewToggle('Dashboard').parent().should('have.class', 'bp3-active')
                    dashboard.getViewToggle('Workspace').should('be.visible')
                    dashboard.getViewToggle('Workspace').parent().should('not.have.class', 'bp3-active')
                    // Check Teacher Username visibility and content
                    dashboard.getUserName().should('be.visible').and('contain', clueData.teacherName)
                })
            })
            it('verifies six pack and group names', () => { //check this test again
                cy.get('@clueData').then((clueData) => {
                    let tempGroupIndex = 0
                    let groups = clueData.classes[0].problems[0].groups
                    let group = groups[tempGroupIndex]

                    // Check for group title
                    dashboard.getSixPackView().should('exist').and('be.visible')
                    dashboard.getGroupName().eq(group.groupIndex).should('contain', group.groupName)
                    // Check for group length (4Up Count)
                    dashboard.getSixPackView().then(() => {
                        dashboard.getFourUpViews().should('have.length', groups.length)
                    })
                })
            })
            it('verify current and published toggle button appear and work', () => {
                dashboard.getWorkToggle("Current").should('have.class', 'selected').and('be.visible')
                dashboard.getWorkToggle("Published").should('not.have.class', 'selected').and('be.visible').click({ force: true })
                dashboard.getWorkToggle("Current").should('not.have.class', 'selected')
                dashboard.getWorkToggle("Published").should('have.class', 'selected')
                dashboard.getWorkToggle("Current").click({ force: true })
            })
            describe('Progress area',()=>{
                let sectionIDArr = ["IN","IC","WI","NW"]
                it('displays progress icons', () => {
                    sectionIDArr.forEach((section)=>{
                        dashboard.getSectionProgressIcons(section).should('be.visible')
                    })
                })
                it('displays progress numbers', ()=>{
                    sectionIDArr.forEach((section)=>{
                        dashboard.getTotalProgressNumber(section).should('be.visible')
                        dashboard.getCurrentProgressNumber(section).should('be.visible')
                    })
                })
            })
        })
        describe('Header element functionality', () => {
            it('verify switching problems changes six pack content and problem title', () => {
                cy.get('@clueData').then((clueData) => {
                    let problems = clueData.classes[0].problems
                    let initProblemIndex = 0
                    let tempProblemIndex = 1

                    dashboard.getProblemDropdown().should('not.contain', problems[tempProblemIndex].problemTitle)
                    dashboard.getGroups().should('have.length',6)
                    dashboard.getProblemDropdown().click({ force: true }).then(() => {
                        dashboard.getProblemList().contains(problems[tempProblemIndex].problemTitle).click({ force: true })
                        cy.wait(1000)
                        cy.waitForSpinner()
                        tempProblemIndex += 1
                    })
                    dashboard.getProblemDropdown().should('contain', problems[tempProblemIndex].problemTitle)
                    dashboard.getGroups().should('have.length',0)

                    //switch back to original problem for later test
                    dashboard.getProblemDropdown().click({force:true})
                    dashboard.getProblemList().contains(problems[initProblemIndex].problemTitle).click({ force: true })
                })
            })
            it('verify dashboard/workspace switch changes workspace view', () => {
                dashboard.getViewToggle('Dashboard').should('be.visible')
                dashboard.getViewToggle('Dashboard').parent().should('have.class', 'bp3-active')
                dashboard.getSingleWorkspace().should('not.be.visible')
                dashboard.getViewToggle('Workspace').should('be.visible')
                dashboard.getViewToggle('Workspace').parent().should('not.have.class', 'bp3-active')
                dashboard.getViewToggle('Workspace').click({ force: true })
                dashboard.getViewToggle("Workspace").parent().should('have.class', 'bp3-active')
                dashboard.getSingleWorkspace().should('be.visible')
                dashboard.getViewToggle("Dashboard").click({ force: true })
                dashboard.getViewToggle('Dashboard').should('be.visible')
                dashboard.getViewToggle('Dashboard').parent().should('have.class', 'bp3-active')
            })
            it('verify selected class is shown in class dropdown', () => {
                cy.get('@clueData').then((clueData) => {
                    let initialClassIndex = 0
                    let tempClass = clueData.classes[initialClassIndex]

                    dashboard.getClassDropdown().should('contain', tempClass.className).and('be.visible')
                })
            })
            it('verify switching classes changes six pack content', () => {
                cy.get('@clueData').then((clueData) => {
                    const initClassIndex = 0
                    const tempClassIndex = 1
                    let initClass = clueData.classes[initClassIndex]
                    let tempClass = clueData.classes[tempClassIndex]
                    let className = tempClass.className
                    let initClassName = initClass.className

                    dashboard.getClassDropdown().should('contain', initClassName)
                    dashboard.getGroups().should('have.length',6)
                    dashboard.getClassDropdown().click({ force: true }).then(() => {
                        dashboard.getClassList().contains(className).click({ force: true })
                        cy.wait(1000)
                        cy.waitForSpinner()
                    })
                    dashboard.getClassDropdown().should('contain', className)
                    dashboard.getGroups().should('have.length',0)

                    //switch back to original problem for later test
                    dashboard.getClassDropdown().click({force:true})
                    dashboard.getClassList().contains(initClassName).click({ force: true })
                })
            })
            // after(()=>{// switch back to first problem to get back six pack problem[0]
            //     dashboard.getClassDropdown().click({force:true}).then(()=>{
            //         dashboard.getClassList().contains("CLUE").click({force:true})
            //         cy.wait(1000)
            //         cy.waitForSpinner()
            //     })
            //     dashboard.getProblemDropdown().click({force:true}).then(()=>{
            //         // dashboard.getProblemList().contains(problems[0].problemTitle).click({ force: true })
            //         // cy.wait(1000)
            //         // cy.waitForSpinner()
            //         dashboard.getProblemList().contains("1.1 Solving a Mystery").click({force:true})
            //         cy.wait(1000)
            //         cy.waitForSpinner()
            //     })
            // })
        })
        describe('6-pack view functionality - Current Work', () => {
            it('verifies students are in correct groups', () => {
                cy.get('@clueData').then((clueData) => {
                    let groups = clueData.classes[0].problems[0].groups
                    let groupIndex = 0
                    let studentIndex = 0

                    let groupName = groups[groupIndex].groupName
                    let studentID = groups[groupIndex].students[studentIndex].studentID


                    dashboard.getGroupName().eq(groupIndex).should('contain', 'Group ' + groupName)
                    dashboard.getGroups().eq(groupIndex).within(() => {
                        //for (let i = 0; i < groups[tempGroupIndex].students.length; i++) {
                        dashboard.getStudentID().eq(studentIndex).should('contain', studentID)
                        //}
                    })
                })
            })
            it.skip('verify each canvas in a 4 up view is read only', () => {
                // skipping because this test verify that it has the read-only class, 
                //but sometimes it misses the read-only class in some tool tile element.
                cy.get('@clueData').then((clueData) => {
                    let tempGroupIndex = 0
                    let tempGroup = clueData.classes[0].problems[0].groups[tempGroupIndex]
                    dashboard.verifyWorkForGroupReadOnly(tempGroup)
                })
            })
            it('verify clicking a students canvas in 4 up view zooms into students canvas', () => { 
                cy.get('@clueData').then((clueData) => {
                    let groupIndex = 0
                    let studentIndex = 0

                    let group = clueData.classes[0].problems[0].groups[groupIndex]
                    let student = group.students[studentIndex]

                    dashboard.getGroups().eq(group.groupIndex).within(() => {
                        dashboard.getStudentCanvas(student.quadrant).click({ force: true })
                    })

                })
                it('clicking support button opens two up with group open', () => {

                })
                it('clicking expand group button will open that single group in teacher workspace', () => {

                })
                it('verifies full student names are displayed when student canvas is expanded', () => {

                })
            })
            it('verifies section tool progress', () => { //currently hard coded since we are using a static test class
                
            })
            it('can switch pages', () => {
                // Use when clue class has LESS than 6 groups
                dashboard.getPreviousPageButton().should('exist').and('not.be.visible').and('have.class', 'disabled')
                dashboard.getNextPageButton().should('exist').and('not.be.visible').and('have.class', 'disabled')

                // Use when clue class has MORE than 6 groups

                // dashboard.getPreviousPageButton().should('have.class', 'disabled')
                // dashboard.getNextPageButton().should('not.have.class', 'disabled').and('be.visible').click({force:true})
                // dashboard.getPreviousPageButton().should('not.have.class', 'disabled').click({force:true})
                // dashboard.getPreviousPageButton().should('have.class', 'disabled')
            })
        })
        describe('6-pack view functionality - Published Work', () => {
            it('switches to published work tab and checks UI options', () => {
            })
            it('select stars for students', () => { // Want this to be for all students once it passes
                let classIndex = 0
                let problemIndex = 0
                let groups

                dashboard.switchWorkView("Published")
                cy.get('@clueData').then((clueData) => {
                    let dashboard = new TeacherDashboard()
                    groups = clueData.classes[classIndex].problems[problemIndex].groups
                    dashboard.starPublishedWork(groups)
                })
            })
            //Skipping for now because need to investigate how many are starred prior to this test
            it.skip('removes all stars from student published work', () => { 
                dashboard.getStarPublishIcon().should('have.class', 'starred')
                dashboard.getStarPublishIcon().click({ force: true, multiple: true })
                dashboard.getStarPublishIcon().should('not.have.class', 'starred')
            })
        })
        describe('6-pack view live updates', () => {
            it('verify 4up views in 6 pack are updated as student makes changes', () => {
                /**
                 * Check for current existing element in student canvas
                 * Visit student link
                 * Do some work as student
                 * Verify that there were changes/new elements
                 */
            })
        })
    })

    context('Teacher Workspace', () => {
        describe('UI visibility', () => {
            it.skip('verify right nav elements', () => {
                //Supports will be labeled with <Investigation#>.<Prob#> <Section Name> Support <n>
                const testSupportLabel = '1.2 Now What Do You Know? Support 2'

                dashboard.getWorkspaceViewToggle().click({ force: true })
                dashboard.getRightNavMyWorkTab().should('be.visible').and('have.attr', 'aria-selected', false)
                dashboard.getRightNavClassWorkTab().should('be.visible').and('have.attr', 'aria-selected', false)
                dashboard.getRightNavSupportsTab().should('be.visible').and('have.attr', 'aria-selected', false)
                rightNav.getClassWorkTab().click({ force: true })
            })
        })
        describe('teacher functionalities', () => {
            it('verify document curation', () => {//adding a star to a student document
            })
            it('verify supports functionality', () => {//may need to break down even further between class, group, and student
            })
        })
        describe('teacher functionality', () => {
            /**
             * Smoke test includes logging into LARA for verifying class + problem switching
             * Verify how teacher workspace behaves when switching classes + problems
             * Test the supports tab since the other tabs are testing in the student tests
             */
        })
    })

    context("Teacher Supports in student's view", () => {
        describe("test visibility of teacher supports in student's workspace", () => {
            it('verify support thumbnails are visible', () => {
            })
            it('verify supports open in 2up view righthand workspace', () => {
            })
        })
    })
})
