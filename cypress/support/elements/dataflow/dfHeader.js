class dfHeader{
    getDataflowWorkspaceSwitch(){
        return cy.get('.dataflow-app-content .app-header .bp3-button')
    }
    switchWorkspace(workspace){
        this.getDataflowWorkspaceSwitch().contains(workspace).click();
    }
}
export default dfHeader;