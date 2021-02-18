class TeacherWorkspace {
    getGroupNumberButton(){
        return cy.get('.icon.group-number');
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
}
export default TeacherWorkspace;
