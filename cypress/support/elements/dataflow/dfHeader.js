class dfHeader{
    getDataflowWorkspaceSwitch(){
        return cy.get('.dataflow-app-content .app-header .bp3-button')
    }
    switchWorkspace(workspace){
        if (workspace !== 'Workspace') {
            cy.wait(1000)
            this.getDataflowWorkspaceSwitch().contains(workspace).click();
        }
    }
}
export default dfHeader;