import Dialog from "../common/Dialog";

const dialog = new Dialog

class TeacherDashboard {
    // Global
    getTeacherDashboard() {
        return cy.get('.teacher-dashboard');
    }
    getPreviousPageButton() {
        return cy.get('.previous-page-button')
    }
    getNextPageButton() {
        return cy.get('.next-page-button')
    }
    // Dashboard Header
    getInvestigationTitle() {
        return cy.get('[data-test="investigation-title"]');
    }
    getProblemDropdown() {
        return cy.get('.problem-dropdown[data-test="user-class"] .header')
    }
    getClassDropdown() {
        return cy.get('.class[data-test="user-class"] .header')
    }
    getProblemList() {
        return cy.get('.problem-dropdown .list')
    }
    getClassList() {
        return cy.get('.class .list')
    }
    getViewToggle(view) { //view=["Dashboard", "Workspace"]
        return cy.get('.toggle-button').contains(view)
    }
    switchView(view) {
        this.getViewToggle(view).click();
    }

    // Dashboard Right Nav
    // type=["Current", "Published"]
    // sectionID = ["IN","IC","WI","NW"]
    getWorkToggle(type) {
        return cy.get('.toggle-button').contains(type+" Work")
    }
    switchWorkView(type) {
        this.getWorkToggle(type).should('not.have.class', 'selected').click({ force: true }).should('have.class', 'selected')
    }
    getSectionProgressIcons(sectionID) {
        return cy.get('.section-circle').should('contain', sectionID)
    }
    getTotalProgressNumber(sectionID) {
        return cy.get('.section-circle').contains(sectionID).siblings('.section-progress').find('.section-total');
    }
    getCurrentProgressNumber(sectionID) {
        return cy.get('.section-circle').contains(sectionID).siblings('.section-progress').find('.section-current');
    }

    // Dashboard 6 - Pack (Current Work)

    getSixPackView() {
        return cy.get('.teacher-group-six-pack')
    }
    getGroupName() {
        return cy.get('.group-label');
    }
    getGroups() {
        return cy.get('.teacher-group')
    }
    getGroupByName(groupName) {
        return cy.get('.teacher-group').contains(groupName)
    }
    getGroup(groupIndex) {
        return cy.get('.group-0-'+groupIndex)
    }
    getStickyNoteIcon(){
        return cy.get('[data-test=sticky-note-icon]')
    }
    getDashboardSupportButton() {
        return cy.get('[data-test=support-icon]')
    }
    getExpandGroupViewButton() {
        return cy.get('[data-test=expand-group-view-icon]')
    }
    getFourUpViews() {
        return cy.get('.four-up')
    }
    getStudentOverlay(quadrant) {
        return cy.get(quadrant).siblings().last().within(() => {
            cy.get('.four-up-overlay').eq(0) //this is only getting the first overlay of the group
        })
    }
    getStudentCanvas(quadrant) {
        return cy.get(quadrant)
    }
    closeStudentCanvas(quadrant){
        return cy.get('.four-up-overlay').click({force:true})
    }
    getStudentID(index) {
        return cy.get('.member').eq(index)
    }
    getZoomedStudentID() {
        return cy.get('.member-centered')
    }
    sendGroupNote(group,text){
        this.getGroup(group).within(() => {
            this.getStickyNoteIcon().click();
        })
        dialog.getDialogTitle().should('contain','Message Group');
        dialog.getDialogTextInput().type(text)
        dialog.getDialogOKButton().click();
    }
    sendStudentNote(group, student, quadrant, text){
        this.getGroup(group).within(() => {
            this.getStudentOverlay(quadrant).click({force:true});
            this.getStickyNoteIcon().click();
        })
        dialog.getDialogTitle().should('contain','Message '+ student);
        dialog.getDialogTextInput().type(text)
        dialog.getDialogOKButton().click();
    }
    verifyWorkForGroupReadOnly(group) {
        for (let i = 0; i < group.students.length; i++) {
            if (group.students[i].tools.textTool > 0) {
                this.getGroups().eq(group.groupIndex).within(() => {
                    this.getStudentCanvas(group.students[i].quadrant).find('.text-tool').should('have.class', 'read-only')
                })
            }
            if (group.students[i].tools.geometryTool > 0) {
                this.getGroups().eq(group.groupIndex).within(() => {
                    this.getStudentCanvas(group.students[i].quadrant).find('.geometry-wrapper').should('have.class', 'read-only')
                })
            }
            if (group.students[i].tools.drawingTool > 0) {
                this.getGroups().eq(group.groupIndex).within(() => {
                    this.getStudentCanvas(group.students[i].quadrant).find('.drawing-tool').should('have.class', 'read-only')
                })
            }
            if (group.students[i].tools.imageTool > 0) {
                this.getGroups().eq(group.groupIndex).within(() => {
                    this.getStudentCanvas(group.students[i].quadrant).find('.image-tool').should('have.class', 'read-only')
                })
            }
        }
    }

    // Dashboard 6 - Pack (Published Work)
    getStarPublishIcon() {
        return cy.get('.icon-star')
    }
    starPublishedWork(groups) {
        let totalPublished = 0
        let tempGroup
        let tempStudent

        for (let i = 0; i < groups.length; i++) {
            tempGroup = groups[i]
            for (let j = 0; j < tempGroup.students.length; j++) {
                tempStudent = tempGroup.students[j]
                if (tempStudent.published == 1) {
                    totalPublished += 1;
                }
            }
        }
        // subtract 4 because there are 4 published docs that are not in view
        this.getStarPublishIcon().should('have.length', totalPublished-4).click({force:true,multiple:true})
    }
    clearAllStarsFromPublishedWork() {
        cy.get('.icon-star').each(star => {
            console.log(star)
            if (star.hasClass('starred')) {
                cy.wrap(star).click({ force: true, multiple: true });
            }
        });
    }
    clearAllStarred() {
        this.getRightNavTabListShown().within(() => {
            cy.get('svg.starred').click({ multiple: true })
        })
    }
    // Teacher Workspace Right Nav
    getRightNavTabListHidden() {
        return cy.get('.class-work').find('.list').should('have.class', 'hidden')
    }
    getRightNavTabListShown() {
        return cy.get('.class-work').find('.shown').should('have.class', 'list')
    }
    verifyPublishStatus(group){
        console.log("students: "+group.students)
        for(let i = 0; i < group.students.length; i++) {
            if (group.students[i].published == 0) {
                this.getGroup(0).within(() => {
                    this.getStudentCanvas(group.students[i].quadrant).find('[data-test=canvas] span').should('contain','Not Published')
                })
            } else {
                this.getStudentCanvas(group.students[i].quadrant).find('[data-test=canvas] .document-content').should('not.contain',"Not Published")
            }
        }
    }
    // selectStudent(student) {
    //     this.getStudentName().contains(student).click();
    // }
    selectGroup(group) {
        this.getGroupName().contains(group).click();
    }

}
export default TeacherDashboard;