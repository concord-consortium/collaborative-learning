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
        return cy.get('.problem[data-test="user-class"] .bp3-button')
    }
    getClassDropdown() {
        // return cy.get('.bp3-button').eq(3)
        return cy.get('.class[data-test="user-class"] .bp3-button')
    }
    getProblemList() {
        return cy.get('.bp3-fill')
    }
    getClassList() {
        return cy.get('.bp3-fill')
    }
    getViewToggle(view) { //view=["Dashboard", "Workspace"]
        return cy.get('.bp3-button').contains(view)
    }
    getSingleWorkspace() {
        return cy.get('.single-workspace')
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
        return cy.get('.section-circle').contains(sectionID).siblings('.section-progress').find('.section-total')
    }
    getCurrentProgressNumber(sectionID) {
        return cy.get('.section-circle').contains(sectionID).siblings('.section-progress').find('.section-current')
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
    getFourUpViews() {
        return cy.get('.four-up')
    }
    getStudentCanvas(quadrant) {
        return cy.get(quadrant)
    }
    getStudentID() {
        return cy.get('.member')
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
        this.getStarPublishIcon().should('have.length', totalPublished-4).click({force:true,multiple:true})
    }
    clearAllStarred() {
        this.getRightNavTabListShown().within(() => {
            cy.get('svg.starred').click({ multiple: true })
        })
    }


    // Teacher Workspace Right Nav
    getRightNavMyWorkTab() {
        return cy.get('div#rightNavTab-my-work')
    }
    getRightNavClassWorkTab() {
        return cy.get('div#rightNavTab-class-work')
    }
    getRightNavSupportsTab() {
        return cy.get('div#rightNavTab-supports')
    }
    getClassWorkExtraWorkspaceTab() {
        return cy.get('.section.personal.published')
    }
    getClassWorkProblemWorkspaceTab() {
        return cy.get('.section.problem.published')
    }
    getClassWorkLearningLogsTab() {
        return cy.get('.section.learning-log.published')
    }
    getClassWorkStarredTab() {
        return cy.get('.section.problem.starred')
    }
    getRightNavTabListHidden() {
        return cy.get('.class-work').find('.list').should('have.class', 'hidden')
    }
    getRightNavTabListShown() {
        return cy.get('.class-work').find('.shown').should('have.class', 'list')
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












    // getGroupChooserTab(){
    //     return cy.get('#teacher-dashboard-groups');
    // }
    // getGroupName(){
    //     return cy.get('.teacher-dashboard .teacher-group-tab > .group-list > .group > .group-title');
    // }
    // getStudentList(){
    //     return cy.get('.teacher-student-tab > .user-list')
    // }
    // getStudentName(){
    //     return cy.get('.teacher-student-tab > .user-list > .user')
    // }
    // joinGroup(){
    //     cy.get('.teacher-group-tab > .selected-group > .title > .actions > span').should('contain','Join Group').click();
    // }
    // getGroupMembers(){
    //     return cy.get('.teacher-dashboard .teacher-group-tab > .group-list > .group > .group-users');
    // }
    getUserName() {
        return cy.get('[data-test="user-name"]')
    }
    // getClassSupportsSectionDropdown(){
    //     return cy.get('.tab-contents > .teacher-supports > .teacher-support > .section-dropdown')
    // }
    // getClassSupportsSectionDropdownOptions(){
    //     return cy.get('.tab-contents > .teacher-supports > .teacher-support > .section-dropdown > .option')
    // }
    // getClassSupportsMessageInput(){
    //     return cy.get('[data-test=support-input-class]')
    // }
    // getClassSupportsMessage(){
    //     return cy.get('.tab-contents > .teacher-supports > .teacher-support > div.content')
    // }
    // getGroupSupportsSectionDropdown(){
    //     return cy.get('.teacher-group-tab > .selected-group .teacher-support > .section-dropdown')
    // }
    // getGroupSupportsSectionDropdownOptions(){
    //     return cy.get('.teacher-group-tab > .selected-group .teacher-support > .section-dropdown > .option')
    // }
    // getGroupSupportsMessageInput(){
    //     return cy.get('[data-test=support-input-group]')
    // }
    // getGroupSupportsMessage(){
    //     return cy.get('.teacher-group-tab > .selected-group .teacher-support > div.content')
    // }
    // getStudentSupportsSectionDropdown(){
    //     return cy.get('.teacher-student-tab > .selected-group .teacher-support > .section-dropdown')
    // }
    // getStudentSupportsSectionDropdownOptions(){
    //     return cy.get('.teacher-student-tab > .selected-group .teacher-support > .section-dropdown > .option')
    // }
    // getStudentSupportsMessageInput(){
    //     return cy.get('[data-test=support-input-student]')
    // }
    // getStudentSupportsMessage(){
    //     return cy.get('.teacher-student-tab > .selected-group .teacher-support > div.content')
    // }
    // sendSupportMessage(level,text){
    //     cy.get('[data-test=support-input-'+level+']').type(text);
    //     cy.get('[data-test=support-submit-'+level+']').click();
    // }
    selectStudent(student) {
        this.getStudentName().contains(student).click();
    }
    selectGroup(group) {
        this.getGroupName().contains(group).click();
    }
    selectSection(level, section) {
        const sectionValue = { "All": "all", "Introduction": "introduction", "Initial Challenge": "initialChallenge", "What if...?": "whatIf", "Now What": "nowWhat", "Extra Workspace": "extraWorkspace" };
        cy.log('in selectSection. level: ' + level + ' section: ' + section);
        switch (level) {
            case 'class':
                this.getClassSupportsSectionDropdown().select(section).should('have.value', sectionValue[section]);
                cy.log('selected class');
                break;
            case 'group':
                this.getGroupSupportsSectionDropdown().select(section).should('have.value', sectionValue[section]);
                cy.log('selected group');
                break;
            case 'user':
                this.getStudentSupportsSectionDropdown().select(section).should('have.value', sectionValue[section]);
                cy.log('selected student');
                break;
        }
    }
    // deleteClassSupportMessage () {
    //     cy.get ('.tab-contents> .teacher-supports > .teacher-support > .icon-delete-tool').last().click();
    // }
    // deleteGroupSupportMessage () {
    //     cy.get ('.teacher-group-tab > .selected-group .teacher-support > .icon-delete-tool').last().click();
    // }
    // deleteStudentSupportMessage () {
    //     cy.get ('.teacher-student-tab > .selected-group .teacher-support > .icon-delete-tool').last().click();
    // }
}
export default TeacherDashboard;