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
        // cy.wait(1000)
        cy.waitForSpinner()
    })

    beforeEach(() => {
        cy.fixture("teacher-dash-data.json").as("clueData")
    })

    context('Teacher Workspace', () => {
        describe('UI visibility', () => {
            it.skip('verify right nav elements', () => {
                //Supports will be labeled with <Investigation#>.<Prob#> <Section Name> Support <n>
                const testSupportLabel = '1.2 Now What Do You Know? Support 2'

                dashboard.getViewToggle("Workspace").click({ force: true })
                rightNav.getRightNavTab("student-work").should('be.visible')
                rightNav.getRightNavTab("my-work").should('be.visible')
                rightNav.getRightNavTab("class-work").should('be.visible')
                rightNav.getRightNavTab("learning-log").should('be.visible')
                rightNav.getRightNavTab("supports").should('be.visible')
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
