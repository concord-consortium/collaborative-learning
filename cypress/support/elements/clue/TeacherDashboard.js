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
        return cy.get('.problem-dropdown[data-test="user-class"] .dropdown')
    }
    getClassDropdown() {
        return cy.get('.class[data-test="user-class"] .dropdown')
    }
    getProblemList() {
        return cy.get('.problem-dropdown .dropdown')
    }
    getClassList() {
        return cy.get('.class .dropdown')
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
        return cy.get('#icon-support')
    }
    getExpandGroupViewButton() {
        return cy.get('[data-test=expand-group-view-icon]')
    }
    getFourUpViews() {
        return cy.get('.four-up')
    }
    getStudentCanvas(quadrant) {
        return cy.get(quadrant)
    }
    getStudentID() {
        return cy.get('.member')
    }
    sendGroupNote(group,text){
        this.getGroup(group).find(this.getStickyNoteIcon()).click();
        dialog.getDialogTitle().should('contain','Message Group');
        dialog.getDialogTextInput().type(text)
        dialog.getDialogOKButton().click();
    }
    sendStudentNote(group, student, quadrant, text){
        this.getStudentCanvas(quadrant).click();
        this.getGroup(group).find(this.getStickyNoteIcon()).click();
        dialog.getDialogTitle().should('contain','Message Student '+ student);
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
            if (group.students[i].tools.tableTool > 0) {
                this.getGroups().eq(group.groupIndex).within(() => {
                    this.getStudentCanvas(group.students[i].quadrant).find('.table-tool')
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
        return cy.get('.icon-star').each(star => {
            if (star.hasClass('starred')) {
                star.click({ force: true, multiple: true });
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

    verifyWorkForGroupReadOnly(group) { //table-tool does not get the .read-only class
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