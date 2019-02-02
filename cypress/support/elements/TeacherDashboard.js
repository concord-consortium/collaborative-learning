class TeacherDashboard {
    getTeacherDashboard(){
        return cy.get('.teacher-dashboard');
    }
    getGroupChooserTab(){
        return cy.get('#teacher-dashboard-groups');
    }
    getGroupList(){
        return cy.get('.teacher-group-tab > .group-list')
    }
    getGroupName(){
        return cy.get('.teacher-dashboard > .tabbed-area > .tab-contents > .contents > .teacher-group-tab > .group-list > .group > .group-title');
    }
    getStudentList(){
        return cy.get('.teacher-student-tab > .user-list')
    }
    getStudentName(){
        return cy.get('.teacher-student-tab > .user-list > .user')
    }
    joinGroup(){
        cy.get('.teacher-group-tab > .selected-group > .title > .actions > span').should('contain','Join Group').click();
    }
    getGroupMembers(){
        return cy.get('.teacher-dashboard > .tabbed-area > .tab-contents > .contents > .teacher-group-tab > .group-list > .group > .group-users');
    }
    getUserName(){
        return cy.get('.header > .user > .name')
    }
    getClassSupportsSectionDropdown(){
        return cy.get('.tab-contents > .teacher-supports > .teacher-support > .section-dropdown')
    }
    getClassSupportsSectionDropdownOptions(){
        return cy.get('.tab-contents > .teacher-supports > .teacher-support > .section-dropdown > .option')
    }
    getClassSupportsMessageInput(){
        return cy.get('[data-test=support-input-class]')
    }
    getGroupSupportsSectionDropdown(){
        return cy.get('.teacher-group-tab > .selected-group > .content > .teacher-supports > .teacher-support > .section-dropdown')
    }
    getGroupSupportsSectionDropdownOptions(){
        return cy.get('.teacher-group-tab > .selected-group > .content > .teacher-supports > .teacher-support > .section-dropdown > .option')
    }
    getGroupSupportsMessageInput(){
        return cy.get('[data-test=support-input-group]')
    }
    getStudentSupportsSectionDropdown(){
        return cy.get('.teacher-student-tab > .selected-group > .content > .teacher-supports > .teacher-support > .section-dropdown')
    }
    getStudentSupportsSectionDropdownOptions(){
        return cy.get('.teacher-student-tab > .selected-group > .content > .teacher-supports > .teacher-support > .section-dropdown > .option')
    }
    getStudentSupportsMessageInput(){
        return cy.get('[data-test=support-input-student]')
    }
    sendSupportMessage(level,text){
        cy.get('[data-test=support-input-'+level+']').type(text);
        cy.get('[data-test=support-submit-'+level+']').click();
    }
    selectStudent(student){
        this.getStudentName().contains(student).click();
    }
    selectGroup(group){
        this.getGroupName().contains(group).click();
    }
    selectSection(level, section){
        const sectionValue = {"All":"all", "Introduction":"introduction", "Initial Challenge":"initialChallenge", "What if...?":"whatIf", "Now What":"nowWhat", "Extra Workspace":"extraWorkspace"};
        cy.log('in selectSection. level: '+level+' section: '+section);
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
    deleteClassSupportMessage () {
        cy.get ('.tab-contents> .teacher-supports > .teacher-support > .icon-delete-tool').click();
    }
    deleteGroupSupportMessage () {
        cy.get ('.teacher-group-tab > .selected-group > .content > .teacher-supports > .teacher-support > .icon-delete-tool').click();
    }
    deleteStudentSupportMessage () {
        cy.get ('.teacher-student-tab > .selected-group > .content > .teacher-supports > .teacher-support > .icon-delete-tool').click();
    }
}
export default TeacherDashboard;