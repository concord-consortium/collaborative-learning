class TeacherWorkspace {
    getGroupNumberButton(){
        return cy.get('.icon.group-number');
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
export default TeacherWorkspace;
