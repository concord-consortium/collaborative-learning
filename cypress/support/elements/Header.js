class Header{
    getClassName(){
        return cy.get('[data-test=user-class]');
    }
    getGroupName(){
        return cy.get('[data-test=group-name]');
        // return cy.get('.header .group .name');
    }
    getGroupMembers(){
        return cy.get('[data-test=group-members]')
    }
    getUserName(){
        return cy.get('[data-test=user-name]')
    }
    getProblemTitle(){
        return cy.get('[data-test=problem-title]')
    }
    getDataflowWorkspaceSwitch(){
        return cy.get('.dataflow-app-content .app-header .bp3-button')
    }
    switchWorkspace(workspace){
        this.getDataflowWorkspaceSwitch().contains(workspace).click();
    }
}
export default Header;