class dfHeader{
    getDataflowWorkspaceSwitch(){
        return cy.get('.dataflow-app-content .app-header .toggle-button')
    }
    switchWorkspace(workspace){
        cy.wait(1000)
        this.getDataflowWorkspaceSwitch().contains(workspace).click();
    }
}
export default dfHeader;